const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const REQUESTS_FILE = path.join(DATA_DIR, "requests.json");
const CART_FILE = path.join(DATA_DIR, "cart.json");
const CHECKLIST_FILE = path.join(DATA_DIR, "checklist.json");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const STATUS_FLOW = ["needed", "working", "ready", "delivered"];
const CART_FLOW = ["needed", "filling", "done"];
const ROLES = ["housekeeping", "laundry", "manager"];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDir();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function ensureData() {
  ensureDir();
  if (!fs.existsSync(REQUESTS_FILE)) writeJson(REQUESTS_FILE, []);
  if (!fs.existsSync(CART_FILE)) writeJson(CART_FILE, []);
  if (!fs.existsSync(CHECKLIST_FILE)) writeJson(CHECKLIST_FILE, []);
}

function normalizeRequest(r) {
  const comments = Array.isArray(r.comments) ? r.comments : [];
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
  const parsed = readJson(REQUESTS_FILE, []);
  return Array.isArray(parsed) ? parsed.map(normalizeRequest) : [];
}

function writeRequests(list) {
  writeJson(REQUESTS_FILE, list);
}

function readCart() {
  const parsed = readJson(CART_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeCart(list) {
  writeJson(CART_FILE, list);
}

function readChecklist() {
  const parsed = readJson(CHECKLIST_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeChecklist(list) {
  writeJson(CHECKLIST_FILE, list);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
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

function nextInFlow(flow, status) {
  const idx = flow.indexOf(status);
  if (idx === -1 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

function parseItems(body) {
  return Array.isArray(body.items)
    ? body.items
        .map((item) => ({
          key: String(item.key || ""),
          label: String(item.label || item.key || ""),
          qty: Math.max(0, Number(item.qty) || 0),
        }))
        .filter((item) => item.key && item.qty > 0)
    : [];
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

  // ---- Laundry requests ----
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
    const items = parseItems(body);

    if (!name || !area || !items.length) {
      sendJson(res, 400, { error: "Name, area, and at least one linen item are required." });
      return;
    }

    const createdAt = Date.now();
    const comments = notes
      ? [{ id: randomUUID(), role: "housekeeping", name, text: notes, createdAt }]
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
    const extras = parseItems(body);

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
    for (const item of list[idx].items || []) merged.set(item.key, { ...item });
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
      comments.push({
        id: randomUUID(),
        role: ROLES.includes(String(body.role || "").toLowerCase())
          ? String(body.role).toLowerCase()
          : "housekeeping",
        name: who,
        text: `Added more: ${extras.map((i) => `${i.qty} ${i.label}`).join(", ")}`,
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

    const comment = { id: randomUUID(), role, name, text, createdAt: Date.now() };
    const comments = Array.isArray(list[idx].comments) ? list[idx].comments : [];
    comments.push(comment);
    list[idx] = { ...list[idx], comments, updatedAt: Date.now() };
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
      const nxt = nextInFlow(STATUS_FLOW, status);
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

    list[idx] = { ...list[idx], status, laundryNotes, updatedAt: Date.now() };
    writeRequests(list);
    sendJson(res, 200, { request: list[idx] });
    return;
  }

  // ---- Cart fill ----
  if (urlPath === "/api/cart" && req.method === "GET") {
    sendJson(res, 200, { cart: readCart() });
    return;
  }

  if (urlPath === "/api/cart/clear" && req.method === "POST") {
    const body = await readBody(req);
    const scope = String(body.scope || "done").toLowerCase();
    const list = readCart();
    if (scope === "all") {
      writeCart([]);
      sendJson(res, 200, { cleared: list.length, cart: [] });
      return;
    }
    const remaining = list.filter((r) => r.status !== "done");
    writeCart(remaining);
    sendJson(res, 200, { cleared: list.length - remaining.length, cart: remaining });
    return;
  }

  if (urlPath === "/api/cart" && req.method === "POST") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const notes = String(body.notes || "").trim();
    const items = parseItems(body);

    if (!name || !items.length) {
      sendJson(res, 400, { error: "Name and at least one cart item are required." });
      return;
    }

    const createdAt = Date.now();
    const entry = {
      id: randomUUID(),
      name,
      items,
      notes,
      status: "needed",
      createdAt,
      updatedAt: createdAt,
    };
    const list = readCart();
    list.unshift(entry);
    writeCart(list);
    sendJson(res, 201, { order: entry });
    return;
  }

  const cartPatch = urlPath.match(/^\/api\/cart\/([^/]+)$/);
  if (cartPatch && req.method === "PATCH") {
    const id = decodeURIComponent(cartPatch[1]);
    const body = await readBody(req);
    const list = readCart();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Cart order not found." });
      return;
    }

    let status = list[idx].status;
    if (body.action === "advance") {
      const nxt = nextInFlow(CART_FLOW, status);
      if (!nxt) {
        sendJson(res, 400, { error: "Already done." });
        return;
      }
      status = nxt;
    } else {
      sendJson(res, 400, { error: "Invalid update." });
      return;
    }

    list[idx] = { ...list[idx], status, updatedAt: Date.now() };
    writeCart(list);
    sendJson(res, 200, { order: list[idx] });
    return;
  }

  // ---- Manager checklist ----
  if (urlPath === "/api/checklist" && req.method === "GET") {
    sendJson(res, 200, { items: readChecklist() });
    return;
  }

  if (urlPath === "/api/checklist" && req.method === "POST") {
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    const manager = String(body.manager || "").trim();

    if (!text || !manager) {
      sendJson(res, 400, { error: "Checklist text and manager name are required." });
      return;
    }

    const createdAt = Date.now();
    const entry = {
      id: randomUUID(),
      text,
      manager,
      done: false,
      createdAt,
      updatedAt: createdAt,
    };
    const list = readChecklist();
    list.unshift(entry);
    writeChecklist(list);
    sendJson(res, 201, { item: entry });
    return;
  }

  if (urlPath === "/api/checklist/clear-done" && req.method === "POST") {
    const list = readChecklist();
    const remaining = list.filter((i) => !i.done);
    writeChecklist(remaining);
    sendJson(res, 200, { cleared: list.length - remaining.length, items: remaining });
    return;
  }

  const checkPatch = urlPath.match(/^\/api\/checklist\/([^/]+)$/);
  if (checkPatch && req.method === "PATCH") {
    const id = decodeURIComponent(checkPatch[1]);
    const body = await readBody(req);
    const list = readChecklist();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Checklist item not found." });
      return;
    }

    if (typeof body.done === "boolean") {
      list[idx] = { ...list[idx], done: body.done, updatedAt: Date.now() };
      writeChecklist(list);
      sendJson(res, 200, { item: list[idx] });
      return;
    }

    sendJson(res, 400, { error: "Invalid update." });
    return;
  }

  if (checkPatch && req.method === "DELETE") {
    const id = decodeURIComponent(checkPatch[1]);
    const list = readChecklist();
    const next = list.filter((i) => i.id !== id);
    if (next.length === list.length) {
      sendJson(res, 404, { error: "Checklist item not found." });
      return;
    }
    writeChecklist(next);
    sendJson(res, 200, { ok: true, items: next });
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
