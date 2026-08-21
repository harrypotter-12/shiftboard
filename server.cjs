const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID, scryptSync, timingSafeEqual, randomBytes } = require("crypto");
const { planChat } = require("./schedule-ai.cjs");

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SHIFTS_FILE = path.join(DATA_DIR, "shifts.json");
const OFF_FILE = path.join(DATA_DIR, "off-days.json");
const NOTES_FILE = path.join(DATA_DIR, "day-notes.json");
const HELP_FILE = path.join(DATA_DIR, "password-help.json");
const OFF_REQUESTS_FILE = path.join(DATA_DIR, "off-requests.json");
const OPEN_SHIFTS_FILE = path.join(DATA_DIR, "open-shifts.json");
const MIN_COVERAGE = 2;

const PERSON_COLORS = [
  "#2c9b7f",
  "#1d6f8c",
  "#c47b2c",
  "#7a5cbf",
  "#b24a6b",
  "#3d7a4a",
  "#b85c38",
  "#2f6b8a",
  "#5c7a2f",
  "#8a4f2f",
];

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

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, 32).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    const next = scryptSync(String(password), salt, 32);
    const prev = Buffer.from(hash, "hex");
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  } catch {
    return false;
  }
}

function colorForUser(user) {
  if (user.color) return user.color;
  let hash = 0;
  const key = String(user.id || user.name || "");
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % PERSON_COLORS.length;
  return PERSON_COLORS[hash];
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    color: colorForUser(user),
    active: user.active !== false,
  };
}

function enrichShift(shift, users) {
  const person = users.find((u) => u.id === shift.userId);
  return {
    ...shift,
    staffName: person ? person.name : "Unknown",
    color: person ? colorForUser(person) : PERSON_COLORS[0],
  };
}

// Housekeeping names + HotSOS person codes (used as ShiftBoard passwords).
const HOUSEKEEPING_STAFF = [
  { name: "Cherry", code: "1149" },
  { name: "Hala", code: "2001" },
  { name: "Mustaff", code: "2011" },
  { name: "Shaala", code: "1150" },
  { name: "Elaine", code: "1157" },
  { name: "Reynold", code: "2024" },
  { name: "Marjorie", code: "2015" },
  { name: "Ingrid", code: "2026" },
  { name: "Mellisa", code: "1128" },
  { name: "Sona", code: "1197" },
  { name: "Rex", code: "2027" },
  { name: "Sukhdeep", code: "2018" },
  { name: "Hayley", code: "1140" },
  { name: "Lance", code: "2009" },
  { name: "Rowell", code: "2013" },
  { name: "Susan", code: "1141" },
  { name: "Alaa", code: "2012" },
  { name: "Anureet", code: "2020" },
  { name: "Ruby Rose Ann", code: "2023" },
  { name: "Rachelle", code: "1186" },
  { name: "Louvie", code: "2022" },
  { name: "Mikayla", code: "2014" },
  { name: "Emmie", code: "1127" },
  { name: "Azucena", code: "1191" },
  { name: "Rupinder", code: "2000" },
  { name: "Salome", code: "1147" },
  { name: "Jarrin", code: "1146" },
  { name: "Tanzila", code: "1174" },
];

function seedUsers() {
  const jash = hashPassword("4844");
  const cathy = hashPassword("8167");
  const maria = hashPassword("0000");
  const now = Date.now();
  const list = [
    {
      id: randomUUID(),
      name: "Cathy",
      role: "manager",
      salt: cathy.salt,
      passwordHash: cathy.hash,
      active: true,
      createdAt: now,
    },
    {
      id: randomUUID(),
      name: "Jash",
      role: "admin",
      salt: jash.salt,
      passwordHash: jash.hash,
      active: true,
      createdAt: now,
    },
    {
      id: randomUUID(),
      name: "Maria",
      role: "staff",
      salt: maria.salt,
      passwordHash: maria.hash,
      active: true,
      createdAt: now,
    },
  ];
  for (const person of HOUSEKEEPING_STAFF) {
    const creds = hashPassword(person.code);
    list.push({
      id: randomUUID(),
      name: person.name,
      role: "staff",
      salt: creds.salt,
      passwordHash: creds.hash,
      active: true,
      createdAt: now,
    });
  }
  return list.map((u, i) => ({ ...u, color: PERSON_COLORS[i % PERSON_COLORS.length] }));
}

function ensureData() {
  ensureDir();
  if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, seedUsers());
  if (!fs.existsSync(SHIFTS_FILE)) writeJson(SHIFTS_FILE, []);
  if (!fs.existsSync(OFF_FILE)) writeJson(OFF_FILE, []);
  if (!fs.existsSync(NOTES_FILE)) writeJson(NOTES_FILE, []);
  if (!fs.existsSync(HELP_FILE)) writeJson(HELP_FILE, []);
  if (!fs.existsSync(OFF_REQUESTS_FILE)) writeJson(OFF_REQUESTS_FILE, []);
  if (!fs.existsSync(OPEN_SHIFTS_FILE)) writeJson(OPEN_SHIFTS_FILE, []);

  const users = readJson(USERS_FILE, []);
  if (Array.isArray(users) && users.length) {
    const creds = hashPassword("8167");
    let changed = false;
    const next = users.map((u) => {
      const name = String(u.name || "").trim();
      if (u.role !== "manager" || !/^manager$/i.test(name)) return u;
      changed = true;
      return {
        ...u,
        name: "Cathy",
        role: "manager",
        salt: creds.salt,
        passwordHash: creds.hash,
      };
    });
    if (changed) writeJson(USERS_FILE, next);
  }

  const roster = readJson(USERS_FILE, []);
  if (Array.isArray(roster)) {
    const jashIdx = roster.findIndex((u) => /^jash$/i.test(String(u.name || "").trim()) && u.active !== false);
    if (jashIdx === -1) {
      const creds = hashPassword("4844");
      roster.push({
        id: randomUUID(),
        name: "Jash",
        role: "admin",
        salt: creds.salt,
        passwordHash: creds.hash,
        active: true,
        createdAt: Date.now(),
        color: PERSON_COLORS[roster.filter((u) => u.active !== false).length % PERSON_COLORS.length],
      });
      writeJson(USERS_FILE, roster);
    } else if (roster[jashIdx].role !== "admin") {
      roster[jashIdx] = { ...roster[jashIdx], role: "admin" };
      writeJson(USERS_FILE, roster);
    }

    const cathyIdx = roster.findIndex((u) => /^cathy$/i.test(String(u.name || "").trim()) && u.active !== false);
    if (cathyIdx !== -1 && roster[cathyIdx].role !== "manager") {
      roster[cathyIdx] = { ...roster[cathyIdx], role: "manager" };
      writeJson(USERS_FILE, roster);
    }

    const removedNames = new Set(["linda", "melvin", "jerrianne"]);
    const kept = roster.filter((u) => !removedNames.has(String(u.name || "").trim().toLowerCase()));
    if (kept.length !== roster.length) {
      const droppedIds = new Set(
        roster
          .filter((u) => removedNames.has(String(u.name || "").trim().toLowerCase()))
          .map((u) => u.id)
      );
      roster.length = 0;
      roster.push(...kept);
      writeJson(USERS_FILE, roster);
      if (droppedIds.size) {
        writeShifts(readShifts().filter((s) => !droppedIds.has(s.userId)));
      }
    }

    let staffAdded = false;
    const known = new Set(roster.map((u) => String(u.name || "").trim().toLowerCase()));
    for (const person of HOUSEKEEPING_STAFF) {
      const key = person.name.toLowerCase();
      if (known.has(key)) continue;
      const creds = hashPassword(person.code);
      roster.push({
        id: randomUUID(),
        name: person.name,
        role: "staff",
        salt: creds.salt,
        passwordHash: creds.hash,
        active: true,
        createdAt: Date.now(),
        color: PERSON_COLORS[roster.filter((u) => u.active !== false).length % PERSON_COLORS.length],
      });
      known.add(key);
      staffAdded = true;
    }
    if (staffAdded) writeJson(USERS_FILE, roster);
  }

  // Backfill colors for older accounts.
  const colored = readJson(USERS_FILE, []);
  if (Array.isArray(colored) && colored.some((u) => !u.color)) {
    writeJson(
      USERS_FILE,
      colored.map((u, i) => ({ ...u, color: u.color || PERSON_COLORS[i % PERSON_COLORS.length] }))
    );
  }
}

function readUsers() {
  const parsed = readJson(USERS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeUsers(list) {
  writeJson(USERS_FILE, list);
}

function readShifts() {
  const parsed = readJson(SHIFTS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeShifts(list) {
  writeJson(SHIFTS_FILE, list);
}

function readOffDays() {
  const parsed = readJson(OFF_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeOffDays(list) {
  writeJson(OFF_FILE, list);
}

function readNotes() {
  const parsed = readJson(NOTES_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeNotes(list) {
  writeJson(NOTES_FILE, list);
}

function readPasswordHelp() {
  const parsed = readJson(HELP_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writePasswordHelp(list) {
  writeJson(HELP_FILE, list);
}

function readOffRequests() {
  const parsed = readJson(OFF_REQUESTS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeOffRequests(list) {
  writeJson(OFF_REQUESTS_FILE, list);
}

function readOpenShifts() {
  const parsed = readJson(OPEN_SHIFTS_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeOpenShifts(list) {
  writeJson(OPEN_SHIFTS_FILE, list);
}

function enrichPerson(entry, users) {
  const person = users.find((u) => u.id === entry.userId);
  return {
    ...entry,
    staffName: person ? person.name : "Unknown",
    color: person ? colorForUser(person) : PERSON_COLORS[0],
  };
}

function enrichOpenShift(entry, users) {
  const claimedNames = (entry.claimedBy || [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => ({ id: u.id, name: u.name, color: colorForUser(u) }));
  const needed = Number(entry.needed) > 0 ? Number(entry.needed) : 1;
  return {
    ...entry,
    needed,
    claimed: claimedNames,
    spotsLeft: Math.max(0, needed - claimedNames.length),
    filled: claimedNames.length >= needed,
  };
}

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return String(aStart) < String(bEnd) && String(bStart) < String(aEnd);
}

function markDaysOff(userId, dates, reason, createdBy) {
  const person = readUsers().find((u) => u.id === userId && u.active !== false);
  if (!person) return { created: [], person: null };
  const list = readOffDays();
  const created = [];
  const dateSet = new Set(dates);
  for (const date of dates) {
    if (list.some((o) => o.userId === userId && o.date === date)) continue;
    const entry = {
      id: randomUUID(),
      userId,
      date,
      reason,
      createdAt: Date.now(),
      createdBy,
    };
    list.push(entry);
    created.push({
      ...entry,
      staffName: person.name,
      color: colorForUser(person),
    });
  }
  writeOffDays(list);
  writeShifts(readShifts().filter((s) => !(s.userId === userId && dateSet.has(s.date))));
  return { created, person };
}

function isOff(userId, date) {
  return readOffDays().some((o) => o.userId === userId && o.date === date);
}

function toDateParts(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function dateKeyFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekDate(base = new Date()) {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDaysDate(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
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

function getUserFromRequest(req) {
  const id = String(req.headers["x-user-id"] || "").trim();
  if (!id) return null;
  return readUsers().find((u) => u.id === id && u.active !== false) || null;
}

function requireUser(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "Please sign in again." });
    return null;
  }
  return user;
}

function isLead(user) {
  return Boolean(user && (user.role === "admin" || user.role === "manager"));
}

function isSiteAdmin(user) {
  return Boolean(user && (user.role === "admin" || /^jash$/i.test(String(user.name || "").trim())));
}

function pinStaffOrder(list) {
  return [...list].sort((a, b) => {
    const rank = (u) => {
      const n = String(u.name || "").trim().toLowerCase();
      if (n === "cathy") return 0;
      if (n === "jash") return 1;
      return 2;
    };
    const d = rank(a) - rank(b);
    if (d) return d;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function requireManager(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (!isLead(user)) {
    sendJson(res, 403, { error: "Only Cathy or Jash can do that." });
    return null;
  }
  return user;
}

function padTime(value) {
  const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function findActiveByName(name, users) {
  const key = normalizeName(name).toLowerCase();
  if (!key) return null;
  return (
    users.find((u) => u.active !== false && u.name.toLowerCase() === key) ||
    users.find((u) => u.active !== false && u.name.toLowerCase().split(/\s+/)[0] === key) ||
    users.find(
      (u) =>
        u.active !== false &&
        u.name
          .toLowerCase()
          .split(/\s+/)
          .some((part) => part === key && part.length >= 4)
    ) ||
    null
  );
}

function copyLastWeekShifts() {
  const thisWeekStart = startOfWeekDate(new Date());
  const lastWeekStart = addDaysDate(thisWeekStart, -7);
  const lastFrom = dateKeyFromDate(lastWeekStart);
  const lastTo = dateKeyFromDate(addDaysDate(lastWeekStart, 6));
  const existing = readShifts();
  const source = existing.filter((s) => s.date >= lastFrom && s.date <= lastTo);
  const created = [];
  for (const s of source) {
    const src = toDateParts(s.date);
    const dayOffset = Math.round((src - lastWeekStart) / 86400000);
    const newDate = dateKeyFromDate(addDaysDate(thisWeekStart, dayOffset));
    if (isOff(s.userId, newDate)) continue;
    const already = existing.some(
      (e) => e.userId === s.userId && e.date === newDate && e.start === s.start && e.end === s.end
    );
    if (already) continue;
    const entry = {
      id: randomUUID(),
      userId: s.userId,
      date: newDate,
      start: s.start,
      end: s.end,
      area: s.area || "",
      notes: s.notes || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    existing.push(entry);
    created.push(entry);
  }
  if (created.length) writeShifts(existing);
  return { copied: created.length, hadSource: source.length > 0 };
}

function applyAiPlan(plan, manager, users) {
  const actions = Array.isArray(plan?.actions) ? plan.actions : [];
  const notes = [];
  let made = 0;
  let listText = "";

  for (const action of actions.slice(0, 90)) {
    const type = String(action?.type || "");
    if (type === "copy_week") {
      const copy = copyLastWeekShifts();
      if (!copy.hadSource) notes.push("Last week had no shifts to copy.");
      else if (!copy.copied) notes.push("This week already had those shifts.");
      else {
        made += copy.copied;
        notes.push(`Copied ${copy.copied} shift${copy.copied === 1 ? "" : "s"} from last week.`);
      }
      continue;
    }

    if (type === "list") {
      const date = String(action.date || "");
      if (!isValidDate(date)) continue;
      const on = readShifts()
        .filter((s) => s.date === date)
        .map((s) => enrichShift(s, users))
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
      if (!on.length) listText += `Nobody is on ${date} yet.\n`;
      else {
        listText += on.map((s) => `${s.staffName} ${s.start}–${s.end}${s.area ? ` · ${s.area}` : ""}`).join("\n") + "\n";
      }
      continue;
    }

    const person = findActiveByName(action.name, users);
    if (!person && (type === "add_shift" || type === "remove_shifts" || type === "day_off")) {
      notes.push(`I don’t have a name “${action.name || ""}”.`);
      continue;
    }

    if (type === "remove_shifts") {
      const date = String(action.date || "");
      if (!isValidDate(date)) continue;
      const list = readShifts();
      const next = list.filter((s) => !(s.userId === person.id && s.date === date));
      const gone = list.length - next.length;
      if (gone) {
        writeShifts(next);
        made += gone;
        notes.push(`Removed ${person.name} on ${date}.`);
      } else notes.push(`${person.name} had no shift on ${date}.`);
      continue;
    }

    if (type === "day_off") {
      const date = String(action.date || "");
      if (!isValidDate(date)) continue;
      markDaysOff(person.id, [date], String(action.reason || "Asked in chat"), manager.id);
      notes.push(`${person.name} is off ${date}.`);
      made += 1;
      continue;
    }

    if (type === "add_shift") {
      const date = String(action.date || "");
      const start = padTime(action.start);
      const end = padTime(action.end);
      if (!isValidDate(date) || !isValidTime(start) || !isValidTime(end) || end <= start) {
        notes.push(`Could not add ${person.name}: check the day and times.`);
        continue;
      }
      if (isOff(person.id, date)) {
        notes.push(`${person.name} is marked off on ${date}.`);
        continue;
      }
      const list = readShifts();
      const already = list.some(
        (s) => s.userId === person.id && s.date === date && s.start === start && s.end === end
      );
      if (already) {
        notes.push(`${person.name} already has ${start}–${end} on ${date}.`);
        continue;
      }
      const entry = {
        id: randomUUID(),
        userId: person.id,
        date,
        start,
        end,
        area: String(action.area || "").trim(),
        notes: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: manager.id,
      };
      list.push(entry);
      writeShifts(list);
      made += 1;
    }
  }

  const parts = [String(plan?.reply || "").trim()];
  if (listText.trim()) parts.push(listText.trim());
  if (notes.length) parts.push(notes.join(" "));
  return {
    reply: parts.filter(Boolean).join("\n\n"),
    changed: made > 0,
  };
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function findUserByName(name) {
  const key = normalizeName(name).toLowerCase();
  return readUsers().find((u) => u.active !== false && u.name.toLowerCase() === key) || null;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
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

  if (urlPath === "/api/staff-names" && req.method === "GET") {
    const names = readUsers()
      .filter((u) => u.active !== false)
      .map((u) => ({ id: u.id, name: u.name, role: u.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
    sendJson(res, 200, { staff: pinStaffOrder(names) });
    return;
  }

  if (urlPath === "/api/status" && req.method === "GET") {
    const users = readUsers().filter((u) => u.active !== false);
    const shifts = readShifts();
    sendJson(res, 200, {
      peopleCount: users.length,
      managerCount: users.filter((u) => isLead(u)).length,
      shiftCount: shifts.length,
    });
    return;
  }

  if (urlPath === "/api/signup" && req.method === "POST") {
    sendJson(res, 403, { error: "Ask Jash or Cathy to add your name in People." });
    return;
  }

  if (urlPath === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const name = normalizeName(body.name);
    const password = String(body.password || "").trim();
    if (!name || !password) {
      sendJson(res, 400, { error: "Enter your name and password." });
      return;
    }
    const user = findUserByName(name);
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      sendJson(res, 401, { error: "Name or password is wrong. Try again." });
      return;
    }
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (urlPath === "/api/me" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (urlPath === "/api/users" && req.method === "GET") {
    const manager = requireManager(req, res);
    if (!manager) return;
    sendJson(res, 200, {
      users: pinStaffOrder(
        readUsers()
          .filter((u) => u.active !== false)
          .map(publicUser)
      ),
    });
    return;
  }

  if (urlPath === "/api/users" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const name = normalizeName(body.name);
    const password = String(body.password || "").trim();
    const role = body.role === "manager" ? "manager" : "staff";

    if (!name || password.length < 4) {
      sendJson(res, 400, { error: "Name and a password of at least 4 characters are required." });
      return;
    }
    if (findUserByName(name)) {
      sendJson(res, 400, { error: "That name is already used." });
      return;
    }

    const list = readUsers();
    const creds = hashPassword(password);
    const entry = {
      id: randomUUID(),
      name,
      role,
      color: PERSON_COLORS[list.filter((u) => u.active !== false).length % PERSON_COLORS.length],
      salt: creds.salt,
      passwordHash: creds.hash,
      active: true,
      createdAt: Date.now(),
    };
    list.push(entry);
    writeUsers(list);
    sendJson(res, 201, { user: publicUser(entry) });
    return;
  }

  const userMatch = urlPath.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && req.method === "PATCH") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(userMatch[1]);
    const body = await readBody(req);
    const list = readUsers();
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Person not found." });
      return;
    }

    const next = { ...list[idx] };
    if (typeof body.name === "string") {
      const name = normalizeName(body.name);
      if (!name) {
        sendJson(res, 400, { error: "Name cannot be empty." });
        return;
      }
      const clash = findUserByName(name);
      if (clash && clash.id !== id) {
        sendJson(res, 400, { error: "That name is already used." });
        return;
      }
      next.name = name;
    }
    if (body.role === "manager" || body.role === "staff") {
      if (isSiteAdmin(list[idx])) {
        sendJson(res, 403, { error: "Jash stays the admin." });
        return;
      }
      next.role = body.role;
    }
    if (typeof body.password === "string" && body.password.trim()) {
      if (body.password.trim().length < 4) {
        sendJson(res, 400, { error: "Password must be at least 4 characters." });
        return;
      }
      const creds = hashPassword(body.password.trim());
      next.salt = creds.salt;
      next.passwordHash = creds.hash;
      writePasswordHelp(
        readPasswordHelp().map((h) =>
          h.userId === id && h.status === "pending"
            ? { ...h, status: "done", resolvedAt: Date.now() }
            : h
        )
      );
    }
    if (typeof body.active === "boolean") next.active = body.active;

    list[idx] = next;
    writeUsers(list);
    sendJson(res, 200, { user: publicUser(next) });
    return;
  }

  if (userMatch && req.method === "DELETE") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(userMatch[1]);
    if (id === manager.id) {
      sendJson(res, 400, { error: "You cannot remove your own login." });
      return;
    }
    const list = readUsers();
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Person not found." });
      return;
    }
    if (isSiteAdmin(list[idx])) {
      sendJson(res, 403, { error: "You cannot remove Jash." });
      return;
    }
    list[idx] = { ...list[idx], active: false };
    writeUsers(list);
    writeShifts(readShifts().filter((s) => s.userId !== id));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (urlPath === "/api/shifts" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const mine = url.searchParams.get("mine") === "1";
    const users = readUsers();
    let shifts = readShifts();

    if (mine || !isLead(user)) {
      shifts = shifts.filter((s) => s.userId === user.id);
    }
    if (from && isValidDate(from)) shifts = shifts.filter((s) => s.date >= from);
    if (to && isValidDate(to)) shifts = shifts.filter((s) => s.date <= to);

    shifts = shifts
      .map((s) => enrichShift(s, users))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.start).localeCompare(String(b.start));
      });

    sendJson(res, 200, { shifts });
    return;
  }

  if (urlPath === "/api/today" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const date = isValidDate(url.searchParams.get("date"))
      ? url.searchParams.get("date")
      : dateKeyFromDate(new Date());
    const users = readUsers();
    const shifts = readShifts()
      .filter((s) => s.date === date)
      .map((s) => enrichShift(s, users))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const off = readOffDays()
      .filter((o) => o.date === date)
      .map((o) => {
        const person = users.find((u) => u.id === o.userId);
        return {
          ...o,
          staffName: person ? person.name : "Unknown",
          color: person ? colorForUser(person) : PERSON_COLORS[0],
        };
      });
    const note = readNotes().find((n) => n.date === date) || null;
    const workingCount = new Set(shifts.map((s) => s.userId)).size;
    let coverage = "ok";
    if (workingCount === 0) coverage = "empty";
    else if (workingCount < MIN_COVERAGE) coverage = "short";
    sendJson(res, 200, { date, shifts, off, note, workingCount, coverage, minCoverage: MIN_COVERAGE });
    return;
  }

  if (urlPath === "/api/shifts/copy-week" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const thisWeekStart = body.toWeekStart && isValidDate(body.toWeekStart)
      ? toDateParts(body.toWeekStart)
      : startOfWeekDate(new Date());
    const lastWeekStart = addDaysDate(thisWeekStart, -7);
    const lastFrom = dateKeyFromDate(lastWeekStart);
    const lastTo = dateKeyFromDate(addDaysDate(lastWeekStart, 6));
    const thisFrom = dateKeyFromDate(thisWeekStart);

    const users = readUsers();
    const existing = readShifts();
    const source = existing.filter((s) => s.date >= lastFrom && s.date <= lastTo);
    if (!source.length) {
      sendJson(res, 400, { error: "No shifts found in last week to copy." });
      return;
    }

    const created = [];
    for (const s of source) {
      const src = toDateParts(s.date);
      const dayOffset = Math.round((src - lastWeekStart) / 86400000);
      const newDate = dateKeyFromDate(addDaysDate(thisWeekStart, dayOffset));
      if (isOff(s.userId, newDate)) continue;
      const already = existing.some(
        (e) => e.userId === s.userId && e.date === newDate && e.start === s.start && e.end === s.end
      );
      if (already) continue;
      const entry = {
        id: randomUUID(),
        userId: s.userId,
        date: newDate,
        start: s.start,
        end: s.end,
        area: s.area || "",
        notes: s.notes || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: manager.id,
      };
      existing.push(entry);
      created.push(enrichShift(entry, users));
    }
    writeShifts(existing);
    sendJson(res, 201, {
      copied: created.length,
      from: lastFrom,
      to: thisFrom,
      shifts: created,
      message:
        created.length === 0
          ? "Nothing new to copy (already copied or people are off)."
          : `Copied ${created.length} shifts from last week.`,
    });
    return;
  }

  if (urlPath === "/api/off" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const users = readUsers();
    let off = readOffDays();
    if (!isLead(user)) off = off.filter((o) => o.userId === user.id);
    if (from && isValidDate(from)) off = off.filter((o) => o.date >= from);
    if (to && isValidDate(to)) off = off.filter((o) => o.date <= to);
    off = off
      .map((o) => {
        const person = users.find((u) => u.id === o.userId);
        return {
          ...o,
          staffName: person ? person.name : "Unknown",
          color: person ? colorForUser(person) : PERSON_COLORS[0],
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    sendJson(res, 200, { off });
    return;
  }

  if (urlPath === "/api/off" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const userId = String(body.userId || "").trim();
    const reason = String(body.reason || "Off").trim() || "Off";
    const dates = Array.isArray(body.dates)
      ? body.dates.map((d) => String(d || "").trim()).filter(isValidDate)
      : isValidDate(body.date)
        ? [String(body.date).trim()]
        : [];
    const person = readUsers().find((u) => u.id === userId && u.active !== false);
    if (!person) {
      sendJson(res, 400, { error: "Choose a staff member." });
      return;
    }
    if (!dates.length) {
      sendJson(res, 400, { error: "Pick at least one day off." });
      return;
    }

    const { created } = markDaysOff(userId, dates, reason, manager.id);
    sendJson(res, 201, {
      off: created,
      marked: created.length,
      message:
        created.length === 0
          ? "Those days were already marked off."
          : `Marked ${created.length} day${created.length === 1 ? "" : "s"} off.`,
    });
    return;
  }

  const offMatch = urlPath.match(/^\/api\/off\/([^/]+)$/);
  if (offMatch && req.method === "DELETE") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(offMatch[1]);
    const list = readOffDays();
    const next = list.filter((o) => o.id !== id);
    if (next.length === list.length) {
      sendJson(res, 404, { error: "Off day not found." });
      return;
    }
    writeOffDays(next);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (urlPath === "/api/shifts" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const userId = String(body.userId || "").trim();
    const date = String(body.date || "").trim();
    const start = String(body.start || "").trim();
    const end = String(body.end || "").trim();
    const area = String(body.area || "").trim();
    const notes = String(body.notes || "").trim();

    const person = readUsers().find((u) => u.id === userId && u.active !== false);
    if (!person) {
      sendJson(res, 400, { error: "Choose a staff member." });
      return;
    }
    if (!isValidDate(date) || !isValidTime(start) || !isValidTime(end)) {
      sendJson(res, 400, { error: "Enter a valid date and times." });
      return;
    }
    if (end <= start) {
      sendJson(res, 400, { error: "End time must be after start time." });
      return;
    }
    if (isOff(userId, date)) {
      sendJson(res, 400, { error: `${person.name} is marked off on that day.` });
      return;
    }

    const entry = {
      id: randomUUID(),
      userId,
      date,
      start,
      end,
      area,
      notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: manager.id,
    };
    const list = readShifts();
    list.push(entry);
    writeShifts(list);
    sendJson(res, 201, { shift: enrichShift(entry, readUsers()) });
    return;
  }

  const shiftMatch = urlPath.match(/^\/api\/shifts\/([^/]+)$/);
  if (shiftMatch && req.method === "PATCH") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(shiftMatch[1]);
    const body = await readBody(req);
    const list = readShifts();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Shift not found." });
      return;
    }

    const next = { ...list[idx] };
    if (typeof body.userId === "string") {
      const person = readUsers().find((u) => u.id === body.userId && u.active !== false);
      if (!person) {
        sendJson(res, 400, { error: "Choose a staff member." });
        return;
      }
      next.userId = person.id;
    }
    if (typeof body.date === "string") {
      if (!isValidDate(body.date)) {
        sendJson(res, 400, { error: "Enter a valid date." });
        return;
      }
      next.date = body.date;
    }
    if (typeof body.start === "string") {
      if (!isValidTime(body.start)) {
        sendJson(res, 400, { error: "Enter a valid start time." });
        return;
      }
      next.start = body.start;
    }
    if (typeof body.end === "string") {
      if (!isValidTime(body.end)) {
        sendJson(res, 400, { error: "Enter a valid end time." });
        return;
      }
      next.end = body.end;
    }
    if (typeof body.area === "string") next.area = body.area.trim();
    if (typeof body.notes === "string") next.notes = body.notes.trim();
    if (next.end <= next.start) {
      sendJson(res, 400, { error: "End time must be after start time." });
      return;
    }

    if (isOff(next.userId, next.date)) {
      const person = readUsers().find((u) => u.id === next.userId);
      sendJson(res, 400, {
        error: `${person ? person.name : "That person"} is marked off on that day.`,
      });
      return;
    }

    next.updatedAt = Date.now();
    list[idx] = next;
    writeShifts(list);
    sendJson(res, 200, { shift: enrichShift(next, readUsers()) });
    return;
  }

  if (shiftMatch && req.method === "DELETE") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(shiftMatch[1]);
    const list = readShifts();
    const next = list.filter((s) => s.id !== id);
    if (next.length === list.length) {
      sendJson(res, 404, { error: "Shift not found." });
      return;
    }
    writeShifts(next);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (urlPath === "/api/shifts/swap" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const userA = String(body.userA || "").trim();
    const userB = String(body.userB || "").trim();
    const dayA = String(body.dayA || "").trim();
    const dayB = String(body.dayB || body.dayA || "").trim();
    const users = readUsers();
    const personA = users.find((u) => u.id === userA && u.active !== false);
    const personB = users.find((u) => u.id === userB && u.active !== false);

    if (!personA || !personB) {
      sendJson(res, 400, { error: "Choose two people." });
      return;
    }
    if (userA === userB) {
      sendJson(res, 400, { error: "Pick two different people." });
      return;
    }
    if (!isValidDate(dayA) || !isValidDate(dayB)) {
      sendJson(res, 400, { error: "Choose the days to swap." });
      return;
    }
    if (isOff(userA, dayB)) {
      sendJson(res, 400, { error: `${personA.name} is marked off on ${dayB}.` });
      return;
    }
    if (isOff(userB, dayA)) {
      sendJson(res, 400, { error: `${personB.name} is marked off on ${dayA}.` });
      return;
    }

    const list = readShifts();
    const aIds = new Set(
      list.filter((s) => s.userId === userA && s.date === dayA).map((s) => s.id)
    );
    const bIds = new Set(
      list.filter((s) => s.userId === userB && s.date === dayB).map((s) => s.id)
    );
    if (!aIds.size && !bIds.size) {
      sendJson(res, 400, { error: "Neither person has shifts on those days." });
      return;
    }

    for (const s of list) {
      if (dayA === dayB) {
        if (aIds.has(s.id)) {
          s.userId = userB;
          s.updatedAt = Date.now();
        } else if (bIds.has(s.id)) {
          s.userId = userA;
          s.updatedAt = Date.now();
        }
      } else if (aIds.has(s.id)) {
        s.date = dayB;
        s.updatedAt = Date.now();
      } else if (bIds.has(s.id)) {
        s.date = dayA;
        s.updatedAt = Date.now();
      }
    }

    writeShifts(list);
    sendJson(res, 200, {
      ok: true,
      message: `Swapped ${personA.name} and ${personB.name}.`,
      movedA: aIds.size,
      movedB: bIds.size,
    });
    return;
  }

  if (urlPath === "/api/notes" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    let notes = readNotes();
    if (from && isValidDate(from)) notes = notes.filter((n) => n.date >= from);
    if (to && isValidDate(to)) notes = notes.filter((n) => n.date <= to);
    notes.sort((a, b) => a.date.localeCompare(b.date));
    sendJson(res, 200, { notes });
    return;
  }

  if (urlPath === "/api/notes" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const date = String(body.date || "").trim();
    const text = String(body.text || "").trim();
    if (!isValidDate(date) || !text) {
      sendJson(res, 400, { error: "Choose a day and write a note for everyone." });
      return;
    }
    const list = readNotes();
    const existing = list.findIndex((n) => n.date === date);
    const entry = {
      id: existing >= 0 ? list[existing].id : randomUUID(),
      date,
      text,
      createdAt: existing >= 0 ? list[existing].createdAt : Date.now(),
      updatedAt: Date.now(),
      createdBy: manager.id,
    };
    if (existing >= 0) list[existing] = entry;
    else list.push(entry);
    writeNotes(list);
    sendJson(res, 201, { note: entry });
    return;
  }

  const noteMatch = urlPath.match(/^\/api\/notes\/([^/]+)$/);
  if (noteMatch && req.method === "DELETE") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(noteMatch[1]);
    const list = readNotes();
    const next = list.filter((n) => n.id !== id);
    if (next.length === list.length) {
      sendJson(res, 404, { error: "Note not found." });
      return;
    }
    writeNotes(next);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (urlPath === "/api/password-help" && req.method === "POST") {
    const body = await readBody(req);
    const name = normalizeName(body.name);
    if (!name) {
      sendJson(res, 400, { error: "Enter your name." });
      return;
    }
    const person = findUserByName(name);
    if (!person) {
      sendJson(res, 404, { error: "That name was not found. Ask your manager to add you." });
      return;
    }
    const list = readPasswordHelp();
    const already = list.find((h) => h.userId === person.id && h.status === "pending");
    if (already) {
      sendJson(res, 200, {
        ok: true,
        message: "OK — tell your manager. They already got your request.",
      });
      return;
    }
    list.unshift({
      id: randomUUID(),
      userId: person.id,
      name: person.name,
      status: "pending",
      createdAt: Date.now(),
    });
    writePasswordHelp(list);
    sendJson(res, 201, {
      ok: true,
      message: "OK — tell your manager. They will give you a new password.",
    });
    return;
  }

  if (urlPath === "/api/password-help" && req.method === "GET") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const pending = readPasswordHelp()
      .filter((h) => h.status === "pending")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    sendJson(res, 200, { requests: pending });
    return;
  }

  const helpMatch = urlPath.match(/^\/api\/password-help\/([^/]+)$/);
  if (helpMatch && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(helpMatch[1]);
    const body = await readBody(req);
    const password = String(body.password || "").trim();
    if (password.length < 4) {
      sendJson(res, 400, { error: "New password must be at least 4 characters." });
      return;
    }
    const helps = readPasswordHelp();
    const help = helps.find((h) => h.id === id);
    if (!help || help.status !== "pending") {
      sendJson(res, 404, { error: "Request not found." });
      return;
    }
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === help.userId);
    if (idx === -1) {
      sendJson(res, 404, { error: "Person not found." });
      return;
    }
    const creds = hashPassword(password);
    users[idx] = {
      ...users[idx],
      salt: creds.salt,
      passwordHash: creds.hash,
    };
    writeUsers(users);
    writePasswordHelp(
      helps.map((h) =>
        h.id === id || (h.userId === help.userId && h.status === "pending")
          ? { ...h, status: "done", resolvedAt: Date.now() }
          : h
      )
    );
    sendJson(res, 200, {
      ok: true,
      user: publicUser(users[idx]),
      message: `New password set for ${users[idx].name}. Tell them what it is.`,
    });
    return;
  }

  if (urlPath === "/api/off-requests" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const users = readUsers();
    let requests = readOffRequests();
    if (!isLead(user)) requests = requests.filter((r) => r.userId === user.id);
    requests = requests
      .map((r) => enrichPerson(r, users))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    sendJson(res, 200, {
      requests,
      pendingCount: requests.filter((r) => r.status === "pending").length,
    });
    return;
  }

  if (urlPath === "/api/off-requests" && req.method === "POST") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await readBody(req);
    const reason = String(body.reason || "Day off").trim() || "Day off";
    const dates = Array.isArray(body.dates)
      ? [...new Set(body.dates.map((d) => String(d || "").trim()).filter(isValidDate))].sort()
      : isValidDate(body.date)
        ? [String(body.date).trim()]
        : [];
    if (!dates.length) {
      sendJson(res, 400, { error: "Pick at least one day." });
      return;
    }
    const today = dateKeyFromDate(new Date());
    if (dates.some((d) => d < today)) {
      sendJson(res, 400, { error: "Pick a day that is today or later." });
      return;
    }
    const existing = readOffRequests();
    const clash = existing.some(
      (r) => r.userId === user.id && r.status === "pending" && (r.dates || []).some((d) => dates.includes(d))
    );
    if (clash) {
      sendJson(res, 400, { error: "You already asked for one of those days. Wait for your manager." });
      return;
    }
    const alreadyOff = dates.filter((d) => isOff(user.id, d));
    if (alreadyOff.length === dates.length) {
      sendJson(res, 400, { error: "Those days are already marked off." });
      return;
    }
    const entry = {
      id: randomUUID(),
      userId: user.id,
      dates,
      reason,
      status: "pending",
      createdAt: Date.now(),
    };
    existing.push(entry);
    writeOffRequests(existing);
    sendJson(res, 201, {
      request: enrichPerson(entry, readUsers()),
      message: "Asked your manager. They will say yes or no.",
    });
    return;
  }

  const offReqMatch = urlPath.match(/^\/api\/off-requests\/([^/]+)$/);
  if (offReqMatch && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(offReqMatch[1]);
    const body = await readBody(req);
    const action = String(body.action || "").trim();
    const list = readOffRequests();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "Request not found." });
      return;
    }
    const request = list[idx];
    if (request.status !== "pending") {
      sendJson(res, 400, { error: "That request was already handled." });
      return;
    }
    if (action === "approve") {
      const { created } = markDaysOff(
        request.userId,
        request.dates || [],
        request.reason || "Day off",
        manager.id
      );
      list[idx] = {
        ...request,
        status: "approved",
        resolvedAt: Date.now(),
        resolvedBy: manager.id,
        marked: created.length,
      };
      writeOffRequests(list);
      sendJson(res, 200, {
        request: enrichPerson(list[idx], readUsers()),
        message: created.length
          ? `Marked ${created.length} day${created.length === 1 ? "" : "s"} off.`
          : "Already marked off.",
      });
      return;
    }
    if (action === "deny") {
      list[idx] = {
        ...request,
        status: "denied",
        resolvedAt: Date.now(),
        resolvedBy: manager.id,
        managerNote: String(body.note || "").trim(),
      };
      writeOffRequests(list);
      sendJson(res, 200, {
        request: enrichPerson(list[idx], readUsers()),
        message: "Told them no.",
      });
      return;
    }
    sendJson(res, 400, { error: "Choose yes or no." });
    return;
  }

  if (urlPath === "/api/open-shifts" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const today = dateKeyFromDate(new Date());
    const users = readUsers();
    let opens = readOpenShifts().map((s) => enrichOpenShift(s, users));
    if (from && isValidDate(from)) opens = opens.filter((s) => s.date >= from);
    else opens = opens.filter((s) => s.date >= today);
    if (to && isValidDate(to)) opens = opens.filter((s) => s.date <= to);
    opens.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.start).localeCompare(String(b.start));
    });
    sendJson(res, 200, { opens });
    return;
  }

  if (urlPath === "/api/open-shifts" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const date = String(body.date || "").trim();
    const start = String(body.start || "").trim();
    const end = String(body.end || "").trim();
    const area = String(body.area || "").trim();
    const notes = String(body.notes || "").trim();
    const needed = Math.max(1, Math.min(12, Number(body.needed) || 1));
    if (!isValidDate(date) || !isValidTime(start) || !isValidTime(end)) {
      sendJson(res, 400, { error: "Enter a valid date and times." });
      return;
    }
    if (end <= start) {
      sendJson(res, 400, { error: "End time must be after start time." });
      return;
    }
    const entry = {
      id: randomUUID(),
      date,
      start,
      end,
      area,
      notes,
      needed,
      claimedBy: [],
      createdAt: Date.now(),
      createdBy: manager.id,
    };
    const list = readOpenShifts();
    list.push(entry);
    writeOpenShifts(list);
    sendJson(res, 201, {
      open: enrichOpenShift(entry, readUsers()),
      message: "Posted. Staff can tap to take it.",
    });
    return;
  }

  const openMatch = urlPath.match(/^\/api\/open-shifts\/([^/]+)$/);
  if (openMatch && req.method === "DELETE") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const id = decodeURIComponent(openMatch[1]);
    const list = readOpenShifts();
    const next = list.filter((s) => s.id !== id);
    if (next.length === list.length) {
      sendJson(res, 404, { error: "Extra shift not found." });
      return;
    }
    writeOpenShifts(next);
    sendJson(res, 200, { ok: true });
    return;
  }

  const claimMatch = urlPath.match(/^\/api\/open-shifts\/([^/]+)\/claim$/);
  if (claimMatch && req.method === "POST") {
    const user = requireUser(req, res);
    if (!user) return;
    const id = decodeURIComponent(claimMatch[1]);
    const list = readOpenShifts();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) {
      sendJson(res, 404, { error: "That extra shift is gone." });
      return;
    }
    const open = list[idx];
    const needed = Number(open.needed) > 0 ? Number(open.needed) : 1;
    const claimedBy = Array.isArray(open.claimedBy) ? [...open.claimedBy] : [];
    if (claimedBy.includes(user.id)) {
      sendJson(res, 400, { error: "You already took this one." });
      return;
    }
    if (claimedBy.length >= needed) {
      sendJson(res, 400, { error: "Someone else already took it." });
      return;
    }
    if (isOff(user.id, open.date)) {
      sendJson(res, 400, { error: "You are marked off that day." });
      return;
    }
    const overlap = readShifts().some(
      (s) => s.userId === user.id && s.date === open.date && timesOverlap(s.start, s.end, open.start, open.end)
    );
    if (overlap) {
      sendJson(res, 400, { error: "You already work at that time." });
      return;
    }
    claimedBy.push(user.id);
    list[idx] = { ...open, claimedBy };
    writeOpenShifts(list);
    const shift = {
      id: randomUUID(),
      userId: user.id,
      date: open.date,
      start: open.start,
      end: open.end,
      area: open.area || "",
      notes: open.notes ? `Extra shift · ${open.notes}` : "Extra shift",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: user.id,
      fromOpenShiftId: open.id,
    };
    const shifts = readShifts();
    shifts.push(shift);
    writeShifts(shifts);
    sendJson(res, 200, {
      open: enrichOpenShift(list[idx], readUsers()),
      shift: enrichShift(shift, readUsers()),
      message: "You got it. It’s on your schedule.",
    });
    return;
  }

  if (urlPath === "/api/ai-chat" && req.method === "POST") {
    const manager = requireManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const message = String(body.message || "").trim();
    if (!message) {
      sendJson(res, 400, { error: "Type a message first." });
      return;
    }
    const users = readUsers().filter((u) => u.active !== false);
    const shifts = readShifts().map((s) => enrichShift(s, users));
    const plan = await planChat(message, body.history, {
      users,
      shifts,
      today: new Date(),
    });
    const result = applyAiPlan(plan, manager, users);
    sendJson(res, 200, result);
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
  console.log(`ShiftBoard running at http://localhost:${PORT}`);
});
