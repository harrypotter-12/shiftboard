function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function atNoon(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function startOfWeek(base) {
  const d = atNoon(base);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatNice(dateStr) {
  const d = atNoon(toDate(dateStr));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function toDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function hour24(hour, minute, mer) {
  let h = Number(hour);
  const min = minute == null || minute === "" ? 0 : Number(minute);
  const merLower = String(mer || "").toLowerCase();
  if (merLower === "pm" && h < 12) h += 12;
  if (merLower === "am" && h === 12) h = 0;
  return `${pad(h)}:${pad(min)}`;
}

function parseTimes(text) {
  const raw = String(text || "");
  const range = raw.match(
    /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i
  );
  if (!range) return null;
  let mer1 = range[3];
  let mer2 = range[6];
  if (mer1) mer1 = mer1.replace(/\./g, "").toLowerCase();
  if (mer2) mer2 = mer2.replace(/\./g, "").toLowerCase();
  let startH = Number(range[1]);
  let endH = Number(range[4]);
  if (!mer1 && !mer2) {
    if (endH <= startH && endH <= 11) endH += 12;
    else if (startH <= 11 && endH <= 11 && endH > startH && startH <= 8 && endH <= 8) {
      endH += 12;
    }
  } else if (!mer1 && mer2) mer1 = Number(range[1]) === 12 ? mer2 : startH >= 7 && startH <= 11 ? "am" : mer2;
  const start = hour24(startH, range[2], mer1);
  const end = hour24(endH, range[5], mer2);
  if (end <= start) return { start, end: hour24(endH + (endH <= 12 ? 12 : 0), range[5], mer2 === "am" ? "pm" : mer2) };
  return { start, end };
}

const WEEKDAYS = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function weekdayDate(today, weekday, nextWeek) {
  const start = startOfWeek(today);
  let d = addDays(start, weekday === 0 ? 6 : weekday - 1);
  if (nextWeek) d = addDays(d, 7);
  else if (dateKey(d) < dateKey(today) && !nextWeek) {
    // keep this week's date even if past — managers often fill the current week
  }
  return d;
}

const MONTHS = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function daysInMonth(year, monthIndex) {
  const keys = [];
  const d = new Date(year, monthIndex, 1, 12);
  while (d.getMonth() === monthIndex) {
    keys.push(dateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function weekdaysInText(text) {
  const raw = String(text || "").toLowerCase();
  const found = [];
  for (const [label, num] of Object.entries(WEEKDAYS)) {
    if (label.length < 3) continue;
    if (new RegExp(`\\b${label}\\b`).test(raw) && !found.includes(num)) found.push(num);
  }
  return found;
}

function parseMonthSpan(text, today) {
  const raw = String(text || "").toLowerCase();
  const clip = (keys) => keys.filter((key) => key >= dateKey(today));
  if (/\b(this month|the month|entire month|whole month|all month|full month|all month long)\b/.test(raw)) {
    return clip(daysInMonth(today.getFullYear(), today.getMonth()));
  }
  if (/\bnext month\b/.test(raw)) {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1, 12);
    return daysInMonth(next.getFullYear(), next.getMonth());
  }
  for (const [label, idx] of Object.entries(MONTHS)) {
    if (label.length < 3) continue;
    if (label === "may") {
      if (!/\b(this|next|in|for)\s+may\b/.test(raw) && !/\bmay\s+20\d{2}\b/.test(raw)) continue;
    } else if (!new RegExp(`\\b${label}\\b`).test(raw)) continue;
    let year = today.getFullYear();
    if (idx < today.getMonth()) year += 1;
    const keys = daysInMonth(year, idx);
    if (year === today.getFullYear() && idx === today.getMonth()) return clip(keys);
    return keys;
  }
  return null;
}

function weekSpan(today, nextWeek) {
  const start = startOfWeek(nextWeek ? addDays(today, 7) : today);
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i)));
}

function wantsWeekendsToo(text) {
  const raw = String(text || "").toLowerCase();
  return /\b(every day|all days|all week|7 days|including weekend|weekends?|saturday|sunday|sat\b|sun\b)\b/.test(raw);
}

function parseOffWeekdays(text) {
  const raw = String(text || "").toLowerCase();
  if (!/\boff\b/.test(raw)) return [];
  if (/\bweekends?\s+off\b|\boff\s+(on\s+)?weekends?\b/.test(raw)) return [0, 6];
  const named = raw.match(
    /\b((?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|r|rs)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:\s*(?:,|and|&)\s*(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|r|rs)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))*)\s+off\b/
  );
  const afterOff = raw.match(
    /\boff(?:\s+on)?\s+((?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|r|rs)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:\s*(?:,|and|&)\s*(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|r|rs)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))*)/
  );
  const blob = (named && named[1]) || (afterOff && afterOff[1]) || "";
  const fromBlob = weekdaysInText(blob);
  if (fromBlob.length) return fromBlob;
  if (/\b(two|2)\s+days?\s+off\b/.test(raw)) return [0, 6];
  return [];
}

function parseDates(text, today) {
  const raw = String(text || "").toLowerCase();
  const dates = [];
  const push = (d) => {
    const key = typeof d === "string" ? d : dateKey(d);
    if (!dates.includes(key)) dates.push(key);
  };

  const monthDays = parseMonthSpan(raw, today);
  if (monthDays) {
    if (wantsWeekendsToo(raw)) return monthDays;
    return monthDays.filter((key) => {
      const day = toDate(key).getDay();
      return day !== 0 && day !== 6;
    });
  }

  if (/\btoday\b/.test(raw)) push(today);
  if (/\btomorrow\b/.test(raw)) push(addDays(today, 1));
  if (/\byesterday\b/.test(raw)) push(addDays(today, -1));

  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) push(iso[1]);

  const nextWeek = /\bnext week\b/.test(raw);
  const thisWeek = /\bthis week\b/.test(raw) || /\ball week\b/.test(raw);
  const weekdays = /\bweekdays?\b/.test(raw);
  const weekend = /\bweekends?\b/.test(raw);
  const range = raw.match(
    /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*(?:to|-|through|thru|until)\s*\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
  );

  if (range) {
    const a = WEEKDAYS[range[1]];
    const b = WEEKDAYS[range[2]];
    const start = startOfWeek(nextWeek ? addDays(today, 7) : today);
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, i);
      const day = d.getDay();
      const from = a === 0 ? 0 : a;
      const to = b === 0 ? 0 : b;
      const inRange = from <= to ? day >= from && day <= to : day >= from || day <= to;
      if (inRange) push(d);
    }
  } else if (thisWeek || nextWeek || weekdays || weekend) {
    const start = startOfWeek(nextWeek ? addDays(today, 7) : today);
    const allSeven = /\ball week\b/.test(raw) || wantsWeekendsToo(raw);
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, i);
      const day = d.getDay();
      if (weekend && day !== 0 && day !== 6) continue;
      if (!weekend && !allSeven && (thisWeek || nextWeek || weekdays) && (day === 0 || day === 6)) continue;
      push(d);
    }
  } else {
    const offDays = parseOffWeekdays(raw);
    const nextDay = /\bnext\b/.test(raw);
    for (const [label, num] of Object.entries(WEEKDAYS)) {
      if (label.length < 3) continue;
      if (offDays.includes(num)) continue;
      const re = new RegExp(`\\b${label}\\b`);
      if (re.test(raw)) push(weekdayDate(today, num, nextDay));
    }
  }

  return dates;
}

function splitWorkAndOff(text, today) {
  const raw = String(text || "").toLowerCase();
  const monthDays = parseMonthSpan(raw, today);
  const offDow = parseOffWeekdays(raw);
  const weekendKeys = (keys) => keys.filter((key) => {
    const day = toDate(key).getDay();
    return day === 0 || day === 6;
  });

  if (monthDays) {
    const workDates = offDow.length
      ? monthDays.filter((key) => !offDow.includes(toDate(key).getDay()))
      : wantsWeekendsToo(raw)
        ? monthDays
        : monthDays.filter((key) => {
            const day = toDate(key).getDay();
            return day !== 0 && day !== 6;
          });
    const offDates = offDow.length ? monthDays.filter((key) => offDow.includes(toDate(key).getDay())) : [];
    const clearOffDates = offDow.length ? [] : weekendKeys(monthDays);
    return { workDates, offDates, clearOffDates, isMonth: true };
  }

  const workDates = parseDates(text, today);
  const span = workDates.length
    ? workDates
    : weekSpan(today, /\bnext week\b/.test(raw));
  const weekKeys = /\b(this week|next week|all week)\b/.test(raw) ? weekSpan(today, /\bnext week\b/.test(raw)) : span;
  if (!offDow.length) {
    return {
      workDates,
      offDates: [],
      clearOffDates: weekendKeys(weekKeys),
      isMonth: false,
    };
  }
  const offDates = weekKeys.filter((key) => offDow.includes(toDate(key).getDay()));
  const work = workDates.filter((key) => !offDow.includes(toDate(key).getDay()));
  return { workDates: work, offDates, clearOffDates: [], isMonth: false };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstNameOf(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function nameTokens(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length >= 4);
}

function aiBlocked(person) {
  return !person;
}

function findPeople(text, users) {
  const raw = String(text || "");
  const found = [];
  const sorted = (users || [])
    .filter((u) => u.active !== false)
    .sort((a, b) => b.name.length - a.name.length);
  for (const person of sorted) {
    const name = person.name.trim();
    const parts = [name, firstNameOf(name), ...nameTokens(name)].filter(Boolean);
    const pattern = new RegExp(parts.map((p) => `\\b${escapeRe(p)}\\b`).join("|"), "i");
    if (pattern.test(raw) && !found.some((p) => p.id === person.id)) found.push(person);
  }
  if (/\b(me|myself|me too)\b/i.test(raw)) {
    const jash = findJash(users);
    if (jash && !found.some((p) => p.id === jash.id)) found.push(jash);
  }
  return found;
}

function findArea(text) {
  const floor = String(text || "").match(/\b(?:floor|fl\.?)\s*(\d{1,2})\b/i) || String(text || "").match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*floor\b/i);
  if (floor) return `Floor ${floor[1]}`;
  const rooms = String(text || "").match(/\brooms?\s+([0-9]+(?:\s*-\s*[0-9]+)?)\b/i);
  if (rooms) return `Rooms ${rooms[1].replace(/\s+/g, "")}`;
  return "";
}

function wantsList(text) {
  const t = String(text || "").trim().toLowerCase();
  return /^(who\b|who's\b|whos\b|show\b|list\b)|who is working|who's working|who works|who is on|who's on|coverage|what('s|s) on\b/.test(t);
}

function isCathy(person) {
  const role = String(person?.role || "").toLowerCase();
  const n = String(person?.name || "").trim().toLowerCase();
  return role === "manager" || n === "cathy";
}

function scheduleTeam(users) {
  return (users || []).filter((u) => u.active !== false && !isCathy(u));
}

function findJash(users) {
  return (users || []).find((u) => u.active !== false && /^jash$/i.test(String(u.name || "").trim())) || null;
}

function wantsTeam(text) {
  return /\b(everyone|everybody|all staff|my staff|the staff|all people|all names|housekeeping|the team|whole team|all the girls|the girls|every staff|any staff)\b/i.test(
    String(text || "")
  );
}

function planFromMessage(message, context) {
  const text = String(message || "").trim();
  const today = atNoon(context.today || new Date());
  const users = context.users || [];
  const lower = text.toLowerCase();

  if (!text) {
    return { reply: "What should I put on the schedule?", actions: [] };
  }

  if (/\b(copy last week|copy the last week|same as last week)\b/.test(lower)) {
    return { reply: "Copying last week onto this week.", actions: [{ type: "copy_week" }] };
  }

  let people = wantsTeam(text) ? scheduleTeam(users) : findPeople(text, users);
  let window = splitWorkAndOff(text, today);
  const times = parseTimes(text);
  const area = findArea(text);
  const wantOffOnly = /\boff\b/.test(lower) && !window.isMonth && !window.workDates.length;
  const wantRemove = /\b(remove|cancel|delete|clear|take off the shift|no shift)\b/.test(lower);

  if (wantsList(text) && !wantRemove && !window.offDates.length && !window.isMonth) {
    const day = window.workDates[0] || dateKey(today);
    return { reply: `Here’s who is on ${formatNice(day)}.`, actions: [{ type: "list", date: day }] };
  }

  if (wantOffOnly) {
    const offDates = window.offDates.length ? window.offDates : window.workDates;
    if (!people.length || !offDates.length) {
      return { reply: "Say the name and the off days, like “Rose Saturday and Sunday off”.", actions: [] };
    }
    const actions = [];
    for (const person of people) {
      for (const date of offDates) actions.push({ type: "day_off", name: person.name, date, reason: "Off" });
    }
    return { reply: `Marked off: ${people.map((p) => p.name).join(", ")}.`, actions };
  }

  if (wantRemove) {
    if (!people.length || !window.workDates.length) {
      return { reply: "Say which name and which day to take off.", actions: [] };
    }
    const actions = [];
    for (const person of people) {
      for (const date of window.workDates) actions.push({ type: "remove_shifts", name: person.name, date });
    }
    return { reply: "I’ll take those shifts off.", actions };
  }

  if (people.length && !window.workDates.length && !window.offDates.length) {
    window = splitWorkAndOff("this week", today);
  }

  const dates = window.workDates;

  if (people.length && (dates.length || window.offDates.length)) {
    const start = times?.start || "09:30";
    const end = times?.end || "17:00";
    const actions = [];
    for (const person of people) {
      for (const date of dates) {
        actions.push({ type: "add_shift", name: person.name, date, start, end, area });
      }
      for (const date of window.offDates) {
        actions.push({ type: "day_off", name: person.name, date, reason: "Off" });
      }
      for (const date of window.clearOffDates || []) {
        if (window.offDates.includes(date) || dates.includes(date)) continue;
        actions.push({ type: "clear_off", name: person.name, date });
      }
    }
    if (actions.length > 1200) {
      return { reply: "That’s too many days at once. Try this week, or one person for the month.", actions: [] };
    }
    const who = people.length > 3 ? `${people.length} people` : people.map((p) => p.name).join(", ");
    if (!dates.length && window.offDates.length) {
      return {
        reply: `Marked ${who} off ${window.offDates.map(formatNice).join(", ")}.`,
        actions,
      };
    }
    const offNote = window.offDates.length ? ` ${window.offDates.length} days off.` : "";
    const when = window.isMonth ? "this month" : dates.length === 1 ? formatNice(dates[0]) : `${dates.length} days`;
    return {
      reply: `Putting ${who} on ${when}, ${start}–${end}.${offNote}`,
      actions,
    };
  }

  if (people.length && !dates.length) {
    return {
      reply: `Got ${people.map((p) => p.name).join(", ")}. Which day? Say tomorrow, Monday, or this month.`,
      actions: [],
    };
  }

  if (dates.length && !people.length) {
    return {
      reply: `Which names for ${formatNice(dates[0])}? Or say my staff.`,
      actions: [],
    };
  }

  return {
    reply: "Try: Rose this month, or schedule my staff this week.",
    actions: [],
  };
}

function staffDigest(users) {
  return (users || [])
    .filter((u) => u.active !== false)
    .map((u) => u.name)
    .join(", ");
}

function weekDigest(shifts, today) {
  const start = startOfWeek(today);
  const from = dateKey(start);
  const to = dateKey(addDays(start, 6));
  const rows = shifts
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.start).localeCompare(String(b.start)));
  if (!rows.length) return "No shifts this week yet.";
  return rows
    .map((s) => `${s.staffName || s.name || "Someone"} ${s.date} ${s.start}-${s.end}${s.area ? ` ${s.area}` : ""}`)
    .join("\n");
}

async function planWithLlm(message, history, context) {
  const key = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const today = atNoon(context.today || new Date());
  const system = `You help hotel housekeeping managers make staff schedules.
Today is ${dateKey(today)}. People: ${staffDigest(context.users || [])}.
This week:\n${weekDigest(context.shifts || [], today)}
Reply with JSON only: {"reply":"short friendly sentence","actions":[...]}
Action types:
- {"type":"add_shift","name":"Rose","date":"YYYY-MM-DD","start":"09:30","end":"17:00","area":""}
- {"type":"remove_shifts","name":"Rose","date":"YYYY-MM-DD"}
- {"type":"day_off","name":"Rose","date":"YYYY-MM-DD","reason":""}
- {"type":"list","date":"YYYY-MM-DD"}
- {"type":"clear_off","name":"Rose","date":"YYYY-MM-DD"}
If the user wants a whole month, add Monday–Friday shifts only. Do not mark Saturday or Sunday off unless they say days off, weekends off, or name those days.
If they say my staff, everyone, or the team, schedule all housekeeping staff plus Jash. Do not add Cathy unless her name is used. Cathy is the manager; Jash is admin and should be on the board when they say my staff, me, or Jash.
If a name is given with no day, fill this week Monday to Friday, 09:30-17:00. Do not mark Saturday or Sunday as days off unless the user asks for days off.
If time is missing, use 09:30-17:00. If the user says Rose, that is Ruby Rose Ann. Keep reply under 40 words.`;

  const messages = [
    { role: "system", content: system },
    ...(Array.isArray(history) ? history.slice(-8) : []),
    { role: "user", content: String(message || "") },
  ];

  try {
    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages,
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) return null;
      return JSON.parse(raw);
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
        max_tokens: 800,
        system,
        messages: messages.filter((m) => m.role !== "system"),
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

async function planChat(message, history, context) {
  const llm = await planWithLlm(message, history, context);
  const planned =
    llm && typeof llm.reply === "string"
      ? { reply: llm.reply, actions: Array.isArray(llm.actions) ? llm.actions : [] }
      : planFromMessage(message, context);
  const users = context.users || [];
  const actions = (planned.actions || []).filter((action) => {
    if (!action || action.type === "list" || action.type === "copy_week") return true;
    const key = String(action.name || "").trim().toLowerCase();
    if (!key) return false;
    return users.some((u) => {
      if (u.active === false) return false;
      const n = String(u.name || "").toLowerCase();
      const parts = n.split(/\s+/);
      return n === key || parts[0] === key || parts.some((p) => p === key && p.length >= 4);
    });
  });
  const names = new Set();
  for (const action of actions) {
    const name = String(action?.name || "").trim();
    if (name && (action.type === "add_shift" || action.type === "day_off")) names.add(name.toLowerCase());
  }
  if (names.size >= 4 && !context.confirmed) {
    const sample = actions.find((a) => a.type === "add_shift");
    const start = sample?.start || "09:30";
    const end = sample?.end || "17:00";
    const days = new Set(actions.filter((a) => a.type === "add_shift").map((a) => a.date)).size;
    const when = days === 1 ? "1 day" : `${days || 0} days`;
    return {
      reply: `This will put ${names.size} people on the board for ${when}, ${start}–${end}. Tap Yes to save it.`,
      actions: [],
      needsConfirm: true,
    };
  }
  return { reply: planned.reply, actions };
}

module.exports = { planChat, planFromMessage, parseTimes, parseDates, aiBlocked };
