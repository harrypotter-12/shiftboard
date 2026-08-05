const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "requests.json");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const STATUS_FLOW = ["needed", "working", "ready", "delivered"];
const ROLES = ["housekeeping", "laundry", "manager"];

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const now = Date.now();
    const seed = [
      {
        id: randomUUID(),
        name: "Maya",
        area: "Floor 2",
        items: [
          { key: "face-cloths", label: "Face cloths", qty: 20 },
          { key: "bath-towels", label: "Bath towels", qty: 12 },
        ],
        priority: "normal",
        notes: "Housekeeping closet near elevators",
        status: "working",
        comments: [
          {
            id: randomUUID(),
            role: "housekeeping",
            name: "Maya",
            text: "Leave at floor closet near elevators",
            createdAt: now - 1000 * 60 * 45,
          },
          {
            id: randomUUID(),
            role: "laundry",
            name: "Sam",
            text: "Towels are in the dryer — about 15 min",
            createdAt: now - 1000 * 60 * 20,
          },
        ],
        createdAt: now - 1000 * 60 * 45,
        updatedAt: now - 1000 * 60 * 10,
      },
      {
        id: randomUUID(),
        name: "Chris",
        area: "Floor 5 / Suites",
        items: [
          { key: "king-sheets", label: "King sheets", qty: 4 },
          { key: "pillowcases", label: "Pillowcases", qty: 8 },
        ],
        priority: "urgent",
        notes: "Checkout turnovers",
        status: "needed",
        comments: [
          {
            id: randomUUID(),
            role: "housekeeping",
            name: "Chris",
            text: "Need before checkout turnovers",
            createdAt: now - 1000 * 60 * 12,
          },
          {
            id: randomUUID(),
            role: "manager",
            name: "Alex",
            text: "Priority for suites — please rush",
            createdAt: now - 1000 * 60 * 8,
          },
        ],
        createdAt: now - 1000 * 60 * 12,
        updatedAt: now - 1000 * 60 * 8,
      },
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function normalizeRequest(r) {
  const comments = Array.isArray(r.comments) ? r.comments : [];
  // Older requests only had a notes field — keep it as a housekeeping comment once.
  if (!comments.length && r.notes) {
    comments.push({
      id: randomUUID(),
      role: "housekeeping",
      name: r.name || "Housekeeping",
      text: String(r.notes),
      createdAt: r.createdAt || Date.now(),
    });
  }
  return { ...r, comments };
}

function readRequests() {
  ensureData();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRequest);
  } catch {
    return [];
  }
}

function writeRequests(list) {
  ensureData();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status);
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function serveStatic(req, res, urlPath) {
  let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleApi(req, res, urlPath) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (urlPath === "/api/requests" && req.method === "GET") {
    sendJson(res, 200, { requests: readRequests() });
    return;
  }

  if (urlPath === "/api/requests/clear" && req.method === "POST") {
    const body = await readBody(req);
    const scope = String(body.scope || "history").toLowerCase();
    const list = readRequests();

    if (scope === "all") {
      writeRequests([]);
      sendJson(res, 200, { cleared: list.length, scope: "all", requests: [] });
      return;
    }

    if (scope === "history") {
      const remaining = list.filter((r) => r.status !== "delivered");
      const cleared = list.length - remaining.length;
      writeRequests(remaining);
      sendJson(res, 200, { cleared, scope: "history", requests: remaining });
      return;
    }

    sendJson(res, 400, { error: "Use scope 'history' or 'all'." });
    return;
  }

  if (urlPath === "/api/requests" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const area = String(body.area || "").trim();
    const notes = String(body.notes || "").trim();
    const priority = body.priority === "urgent" ? "urgent" : "normal";
    const items = Array.isArray(body.items)
      ? body.items
          .map((item) => ({
            key: String(item.key || ""),
            label: String(item.label || item.key || ""),
            qty: Math.max(0, Number(item.qty) || 0),
          }))
          .filter((item) => item.key && item.qty > 0)
      : [];

    if (!name || !area || !items.length) {
      sendJson(res, 400, { error: "Name, area, and at least one linen item are required." });
      return;
    }

    const createdAt = Date.now();
    const comments = notes
      ? [
          {
            id: randomUUID(),
            role: "housekeeping",
            name,
            text: notes,
            createdAt,
          },
        ]
      : [];

    const entry = {
      id: randomUUID(),
      name,
      area,
      items,
      priority,
      notes,
      comments,
      status: "needed",
      createdAt,
      updatedAt: createdAt,
    };

    const list = readRequests();
    list.unshift(entry);
    writeRequests(list);
    sendJson(res, 201, { request: entry });
    return;
  }

  const itemsMatch = urlPath.match(/^\/api\/requests\/([^/]+)\/items$/);
  if (itemsMatch && req.method === "POST") {
    const id = decodeURIComponent(itemsMatch[1]);
    const body = await readBody(req);
    const extras = Array.isArray(body.items)
      ? body.items
          .map((item) => ({
            key: String(item.key || ""),
            label: String(item.label || item.key || ""),
            qty: Math.max(0, Number(item.qty) || 0),
          }))
          .filter((item) => item.key && item.qty > 0)
      : [];

    if (!extras.length) {
      sendJson(res, 400, { error: "Add at least one item." });
      return;
    }

    const list = readRequests();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Request not found." });
      return;
    }

    if (list[idx].status === "delivered") {
      sendJson(res, 400, { error: "Can't add items to a delivered request." });
      return;
    }

    const merged = new Map();
    for (const item of list[idx].items || []) {
      merged.set(item.key, { ...item });
    }
    for (const item of extras) {
      if (merged.has(item.key)) {
        const cur = merged.get(item.key);
        merged.set(item.key, { ...cur, qty: cur.qty + item.qty, label: item.label || cur.label });
      } else {
        merged.set(item.key, item);
      }
    }

    const who = String(body.name || "").trim();
    const comments = Array.isArray(list[idx].comments) ? [...list[idx].comments] : [];
    if (who) {
      const summary = extras.map((i) => `${i.qty} ${i.label}`).join(", ");
      comments.push({
        id: randomUUID(),
        role: ROLES.includes(String(body.role || "").toLowerCase())
          ? String(body.role).toLowerCase()
          : "housekeeping",
        name: who,
        text: `Added more: ${summary}`,
        createdAt: Date.now(),
      });
    }

    list[idx] = {
      ...list[idx],
      items: Array.from(merged.values()),
      comments,
      updatedAt: Date.now(),
    };
    writeRequests(list);
    sendJson(res, 200, { request: list[idx] });
    return;
  }

  const commentMatch = urlPath.match(/^\/api\/requests\/([^/]+)\/comments$/);
  if (commentMatch && req.method === "POST") {
    const id = decodeURIComponent(commentMatch[1]);
    const body = await readBody(req);
    const role = String(body.role || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const text = String(body.text || "").trim();

    if (!ROLES.includes(role)) {
      sendJson(res, 400, { error: "Choose Housekeeping, Laundry, or Manager." });
      return;
    }
    if (!name || !text) {
      sendJson(res, 400, { error: "Name and comment are required." });
      return;
    }

    const list = readRequests();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Request not found." });
      return;
    }

    const comment = {
      id: randomUUID(),
      role,
      name,
      text,
      createdAt: Date.now(),
    };

    const comments = Array.isArray(list[idx].comments) ? list[idx].comments : [];
    comments.push(comment);
    list[idx] = {
      ...list[idx],
      comments,
      updatedAt: Date.now(),
    };
    writeRequests(list);
    sendJson(res, 201, { request: list[idx], comment });
    return;
  }

  const patchMatch = urlPath.match(/^\/api\/requests\/([^/]+)$/);
  if (patchMatch && req.method === "PATCH") {
    const id = decodeURIComponent(patchMatch[1]);
    const body = await readBody(req);
    const list = readRequests();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Request not found." });
      return;
    }

    let status = list[idx].status;
    let laundryNotes = list[idx].laundryNotes || "";

    if (body.action === "advance") {
      const nxt = nextStatus(status);
      if (!nxt) {
        sendJson(res, 400, { error: "Already at final status." });
        return;
      }
      status = nxt;
    } else if (typeof body.status === "string" && STATUS_FLOW.includes(body.status)) {
      status = body.status;
    } else if (typeof body.laundryNotes === "string") {
      laundryNotes = body.laundryNotes.trim();
    } else {
      sendJson(res, 400, { error: "Invalid update." });
      return;
    }

    list[idx] = {
      ...list[idx],
      status,
      laundryNotes,
      updatedAt: Date.now(),
    };
    writeRequests(list);
    sendJson(res, 200, { request: list[idx] });
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

ensureData();

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  try {
    if (urlPath.startsWith("/api/")) {
      await handleApi(req, res, urlPath);
      return;
    }
    serveStatic(req, res, urlPath);
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LinenBoard running at http://localhost:${PORT}`);
});
