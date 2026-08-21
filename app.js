(() => {
  const loginGate = document.getElementById("login-gate");
  const appShell = document.getElementById("app-shell");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const loginError = document.getElementById("login-error");
  const signupError = document.getElementById("signup-error");
  const namePicker = document.getElementById("name-picker");
  const namePickerEmpty = document.getElementById("name-picker-empty");
  const nameSearch = document.getElementById("name-search");
  const loginStepName = document.getElementById("login-step-name");
  const loginStepPass = document.getElementById("login-step-pass");
  const loginStepSignup = document.getElementById("login-step-signup");
  const selectedNameEl = document.getElementById("selected-name");
  const selectedAvatar = document.getElementById("selected-avatar");
  const loginNameInput = document.getElementById("login-name");
  const loginPassword = document.getElementById("login-password");
  const signupPassword = document.getElementById("signup-password");
  const loginSubmit = document.getElementById("login-submit");
  const signupSubmit = document.getElementById("signup-submit");
  const togglePassword = document.getElementById("toggle-password");
  const toggleSignupPassword = document.getElementById("toggle-signup-password");
  const helloLabel = document.getElementById("hello-label");
  const toastEl = document.getElementById("toast");
  const mySchedule = document.getElementById("my-schedule");
  const teamSchedule = document.getElementById("team-schedule");
  const manageShifts = document.getElementById("manage-shifts");
  const peopleList = document.getElementById("people-list");
  const shiftForm = document.getElementById("shift-form");
  const peopleForm = document.getElementById("people-form");
  const shiftUser = document.getElementById("shift-user");
  const scheduleTitle = document.getElementById("schedule-title");
  const scheduleRange = document.getElementById("schedule-range");
  const teamRange = document.getElementById("team-range");
  const staffGuide = document.getElementById("staff-guide");
  const managerGuide = document.getElementById("manager-guide");
  const monthCalendar = document.getElementById("month-calendar");
  const teamMonthCalendar = document.getElementById("team-month-calendar");
  const personChips = document.getElementById("person-chips");
  const dayChips = document.getElementById("day-chips");
  const hearScheduleBtn = document.getElementById("hear-schedule");
  const hearTeamBtn = document.getElementById("hear-team");
  const voiceNoteBtn = document.getElementById("voice-note");
  const micHint = document.getElementById("mic-hint");
  const reminderBanner = document.getElementById("reminder-banner");
  const todayBoard = document.getElementById("today-board");
  const todayOff = document.getElementById("today-off");
  const todayDateLabel = document.getElementById("today-date-label");
  const offForm = document.getElementById("off-form");
  const offList = document.getElementById("off-list");
  const offUser = document.getElementById("off-user");
  const offDayChips = document.getElementById("off-day-chips");
  const noteForm = document.getElementById("note-form");
  const noteList = document.getElementById("note-list");
  const swapForm = document.getElementById("swap-form");
  const todayTeamNote = document.getElementById("today-team-note");
  const views = {
    today: document.getElementById("view-today"),
    mine: document.getElementById("view-mine"),
    team: document.getElementById("view-team"),
    manage: document.getElementById("view-manage"),
    people: document.getElementById("view-people"),
  };

  const I18N = window.SHIFTBOARD_I18N || { langs: [], en: {} };
  const LANG_LOCALES = { en: "en-US", es: "es", fr: "fr-CA", pa: "pa-Guru-IN", fil: "fil-PH", ar: "ar" };
  let currentLang = localStorage.getItem("shiftboard-lang") || "en";
  if (!I18N[currentLang]) currentLang = "en";
  let currentViewName = "mine";

  function t(key, vars) {
    const dict = I18N[currentLang] || I18N.en || {};
    let text = dict[key] || I18N.en?.[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, String(value));
      });
    }
    return text;
  }

  function dateLocale() {
    return LANG_LOCALES[currentLang] || "en-US";
  }

  function offReasonLabel(reason) {
    const text = String(reason || "").trim();
    if (!text) return "";
    if (/^(off|day off|days off|asked in chat|two days off)$/i.test(text)) return "";
    return text;
  }

  function applyI18n() {
    document.documentElement.lang = currentLang === "pa" ? "pa" : currentLang === "fil" ? "fil" : currentLang;
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const label = t(el.dataset.i18nTitle);
      el.title = label;
      el.setAttribute("aria-label", label);
    });
    if (loginPassword?.type === "password" && togglePassword) togglePassword.textContent = t("login.show");
    if (signupPassword?.type === "password" && toggleSignupPassword) toggleSignupPassword.textContent = t("login.show");
  }

  function renderLangChoices() {
    const box = document.getElementById("lang-choices");
    if (!box) return;
    box.innerHTML = (I18N.langs || [])
      .map(
        (lang) => `
      <button type="button" class="lang-choice ${lang.id === currentLang ? "is-active" : ""}" data-lang="${lang.id}">
        <strong>${escapeHtml(lang.native)}</strong>
        <small>${escapeHtml(lang.hint)}</small>
      </button>`
      )
      .join("");
  }

  function openLangSheet() {
    const sheet = document.getElementById("lang-sheet");
    if (!sheet) return;
    renderLangChoices();
    sheet.hidden = false;
  }

  function closeLangSheet() {
    const sheet = document.getElementById("lang-sheet");
    if (sheet) sheet.hidden = true;
  }

  function setLang(id) {
    if (!I18N[id]) return;
    currentLang = id;
    localStorage.setItem("shiftboard-lang", id);
    applyI18n();
    closeLangSheet();
    syncHomeCards();
    if (currentUser) {
      helloLabel.textContent = t("hello.hi", { name: currentUser.name.split(" ")[0] });
      showView(currentViewName);
    } else {
      loadStaffNames();
    }
  }

  let currentUser = null;
  let usersCache = [];
  let staffNamesCache = [];

  function isLead(user = currentUser) {
    if (!user) return false;
    if (user.role === "admin" || user.role === "manager") return true;
    const n = String(user.name || "").trim().toLowerCase();
    return n === "jash" || n === "cathy";
  }

  function roleTag(role) {
    if (role === "admin") return "Admin";
    if (role === "manager") return "Manager";
    return "Staff";
  }
  let myMode = "day";
  let teamMode = "day";
  let myCursor = new Date();
  let teamCursor = new Date();
  let mySelectedDay = todayKey();
  let teamSelectedDay = todayKey();
  let lastMyShifts = [];
  let lastTeamShifts = [];
  let speechRecognition = null;
  let selectedDays = new Set([todayKey()]);
  let selectedPeople = new Set();
  let selectedOffDays = new Set();

  myCursor.setHours(12, 0, 0, 0);
  teamCursor.setHours(12, 0, 0, 0);

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("is-visible"));
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
      setTimeout(() => {
        toastEl.hidden = true;
      }, 220);
    }, 2400);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function initials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  function authHeaders(extra = {}) {
    return {
      "Content-Type": "application/json",
      "X-User-Id": currentUser?.id || "",
      ...extra,
    };
  }

  function startOfWeek(base = new Date()) {
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayKey() {
    return toDateKey(new Date());
  }

  function parseDateKey(key) {
    const [y, m, d] = String(key).split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }

  function weekBoundsFrom(date) {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return { start, end, from: toDateKey(start), to: toDateKey(end) };
  }

  function monthBoundsFrom(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 12);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
    return { start, end, from: toDateKey(start), to: toDateKey(end) };
  }

  function rangeForMode(mode, cursor, selectedDay) {
    if (mode === "day") {
      const day = selectedDay || toDateKey(cursor);
      const d = parseDateKey(day);
      return { from: day, to: day, start: d, end: d, label: formatDayLabel(day) };
    }
    if (mode === "month") {
      const bounds = monthBoundsFrom(cursor);
      return {
        ...bounds,
        label: cursor.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" }),
      };
    }
    const bounds = weekBoundsFrom(cursor);
    return {
      ...bounds,
      label: `${bounds.start.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })} – ${bounds.end.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })}`,
    };
  }

  function formatDayLabel(dateKey) {
    const date = parseDateKey(dateKey);
    return date.toLocaleDateString(dateLocale(), {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  function formatShortDay(dateKey) {
    const date = parseDateKey(dateKey);
    return date.toLocaleDateString(dateLocale(), {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(value) {
    if (!value) return "";
    const [h, min] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(h, min || 0, 0, 0);
    return date.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });
  }

  function shiftHours(shift) {
    const [sh, sm] = String(shift.start || "00:00").split(":").map(Number);
    const [eh, em] = String(shift.end || "00:00").split(":").map(Number);
    return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
  }

  function formatHours(n) {
    const rounded = Math.round(Number(n) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function timeToMinutes(value) {
    const [h, m] = String(value || "00:00").split(":").map(Number);
    return h * 60 + m;
  }

  function savedSession() {
    try {
      return JSON.parse(localStorage.getItem("shiftboard-user") || "null");
    } catch {
      return null;
    }
  }

  function saveSession(user) {
    localStorage.setItem("shiftboard-user", JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem("shiftboard-user");
  }

  function setFormError(el, message) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function setLoginError(message) {
    setFormError(loginError, message);
  }

  function setSignupError(message) {
    setFormError(signupError, message);
  }

  function hideAllLoginSteps() {
    loginStepName.hidden = true;
    loginStepPass.hidden = true;
    loginStepSignup.hidden = true;
  }

  function showNameStep() {
    hideAllLoginSteps();
    loginStepName.hidden = false;
    loginNameInput.value = "";
    loginPassword.value = "";
    loginPassword.type = "password";
      togglePassword.textContent = t("login.show");
    togglePassword.setAttribute("aria-pressed", "false");
    setLoginError("");
    setSignupError("");
  }

  function showPasswordStep(name) {
    hideAllLoginSteps();
    loginStepPass.hidden = false;
    loginNameInput.value = name;
    selectedNameEl.textContent = name;
    selectedAvatar.textContent = initials(name);
    loginPassword.value = "";
    setLoginError("");
    const forgotMsg = document.getElementById("forgot-message");
    if (forgotMsg) {
      forgotMsg.hidden = true;
      forgotMsg.textContent = "";
    }
    setTimeout(() => loginPassword.focus(), 80);
  }

  function showSignupStep() {
    hideAllLoginSteps();
    loginStepSignup.hidden = false;
    setSignupError("");
    signupForm.reset();
    const roleInput = signupForm.querySelector('input[name="signup-role"]');
    if (roleInput) roleInput.value = "staff";
    signupPassword.type = "password";
      toggleSignupPassword.textContent = t("login.show");
    toggleSignupPassword.setAttribute("aria-pressed", "false");
    setTimeout(() => document.getElementById("signup-name").focus(), 80);
  }

  function nameMatches(name, query) {
    const n = String(name || "").toLowerCase();
    const parts = String(query || "")
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return true;
    return parts.every(
      (part) => n.includes(part) || n.split(/\s+/).some((word) => word.startsWith(part))
    );
  }

  function matchingStaff() {
    const query = String(nameSearch?.value || "").trim();
    if (!query) return staffNamesCache;
    return staffNamesCache.filter((s) => nameMatches(s.name, query));
  }

  function renderNamePicker(staff) {
    if (Array.isArray(staff)) staffNamesCache = staff;
    const visible = matchingStaff();

    if (!staffNamesCache.length) {
      namePicker.innerHTML = "";
      namePickerEmpty.hidden = false;
      namePickerEmpty.textContent = t("login.noAccounts");
      const continueBtn = document.getElementById("continue-as");
      if (continueBtn) continueBtn.hidden = true;
      return;
    }

    if (!visible.length) {
      namePicker.innerHTML = "";
      namePickerEmpty.hidden = false;
      namePickerEmpty.textContent = t("login.noMatch");
      const continueBtn = document.getElementById("continue-as");
      if (continueBtn) continueBtn.hidden = true;
      return;
    }

    namePickerEmpty.hidden = true;
    const last = localStorage.getItem("shiftboard-last-name") || "";
    const continueBtn = document.getElementById("continue-as");
    const lastPerson = staffNamesCache.find((s) => s.name === last);
    if (continueBtn) {
      const showContinue = Boolean(lastPerson && (!String(nameSearch?.value || "").trim() || visible.some((s) => s.name === last)));
      continueBtn.hidden = !showContinue;
      continueBtn.dataset.name = lastPerson?.name || "";
      const continueAvatar = document.getElementById("continue-avatar");
      const continueLabel = document.getElementById("continue-label");
      if (continueAvatar) continueAvatar.textContent = initials(last);
      if (continueLabel) continueLabel.textContent = t("login.continue", { name: last });
    }
    const sorted = [...visible].sort((a, b) => {
      const rank = (u) => {
        const n = String(u.name || "").trim().toLowerCase();
        if (n === "cathy") return 0;
        if (n === "jash") return 1;
        if (u.name === last) return 2;
        return 3;
      };
      const d = rank(a) - rank(b);
      if (d) return d;
      return a.name.localeCompare(b.name);
    });

    namePicker.innerHTML = sorted
      .map(
        (s) => `
      <button type="button" class="name-chip" data-name="${escapeHtml(s.name)}">
        <span class="avatar" aria-hidden="true">${escapeHtml(initials(s.name))}</span>
        <span class="chip-meta">
          <span>${escapeHtml(s.name)}</span>
          <small>${roleTag(s.role)}</small>
        </span>
      </button>
    `
      )
      .join("");
  }

  async function loadStaffNames() {
    try {
      const cached = JSON.parse(localStorage.getItem("shiftboard-staff-names") || "[]");
      if (Array.isArray(cached) && cached.length) renderNamePicker(cached);
    } catch {
      /* ignore bad cache */
    }
    if (!staffNamesCache.length) {
      namePickerEmpty.hidden = false;
      namePickerEmpty.textContent = t("login.loading");
    }
    try {
      const res = await fetch("/api/staff-names", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const staff = Array.isArray(data.staff) ? data.staff : [];
      renderNamePicker(staff);
      localStorage.setItem("shiftboard-staff-names", JSON.stringify(staff));
    } catch {
      if (staffNamesCache.length) return;
      namePicker.innerHTML = "";
      staffNamesCache = [];
      namePickerEmpty.hidden = false;
      namePickerEmpty.textContent = t("login.loadFail");
    }
  }

  function stopSpeech() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    hearScheduleBtn?.classList.remove("is-speaking");
    hearTeamBtn?.classList.remove("is-speaking");
    if (hearScheduleBtn) hearScheduleBtn.textContent = t("hear.schedule");
    if (hearTeamBtn) hearTeamBtn.textContent = t("hear.team");
  }

  function speakShifts(shifts, { showName = false, button } = {}) {
    if (!window.speechSynthesis) {
      showToast("Voice is not available on this device.");
      return;
    }
    if (button?.classList.contains("is-speaking")) {
      stopSpeech();
      return;
    }
    stopSpeech();
    if (!shifts.length) {
      const utter = new SpeechSynthesisUtterance("You have no shifts for this time.");
      utter.rate = 0.92;
      window.speechSynthesis.speak(utter);
      return;
    }

    const lines = shifts.map((s) => {
      const who = showName && s.staffName ? `${s.staffName}, ` : "";
      const area = s.area ? `, ${s.area}` : "";
      const notes = s.notes ? `. Note: ${s.notes}` : "";
      return `${who}${formatDayLabel(s.date)}, ${formatTime(s.start)} to ${formatTime(s.end)}${area}${notes}.`;
    });
    const text = `Here is the schedule. ${lines.join(" ")}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    if (button) {
      button.classList.add("is-speaking");
      button.textContent = t("hear.stop");
    }
    utter.onend = () => stopSpeech();
    utter.onerror = () => stopSpeech();
    window.speechSynthesis.speak(utter);
  }

  function showApp() {
    loginGate.hidden = true;
    appShell.hidden = false;
    helloLabel.textContent = t("hello.hi", { name: currentUser.name.split(" ")[0] });
    document.body.dataset.role = currentUser.role;
    const lead = isLead();
    document.querySelectorAll(".manager-only").forEach((el) => {
      el.hidden = !lead;
    });
    document.querySelectorAll(".staff-only").forEach((el) => {
      el.hidden = lead;
    });
    document.getElementById("tabbar").classList.toggle("is-manager", lead);
    // Staff always see a simple week; managers keep day/week/month.
    myMode = lead ? "day" : "week";
    myCursor = new Date();
    myCursor.setHours(12, 0, 0, 0);
    mySelectedDay = todayKey();
    syncModeButtons();
    showView("mine");
    loadReminders();
    loadPendingBadge();
  }

  function showLogin() {
    stopSpeech();
    stopMic();
    currentUser = null;
    clearSession();
    appShell.hidden = true;
    loginGate.hidden = false;
    document.body.removeAttribute("data-role");
    showNameStep();
    loadStaffNames();
    setTimeout(() => nameSearch?.focus(), 80);
  }

  function showView(name) {
    currentViewName = name;
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      const active = key === name;
      el.classList.toggle("is-active", active);
      el.hidden = !active;
    });
    document.querySelectorAll(".tabbar .tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.nav === name);
    });
    if (name === "today") loadTodayBoard();
    if (name === "mine") {
      loadMySchedule();
      loadStaffExtras();
    }
    if (name === "team") loadTeamSchedule();
    if (name === "manage") {
      loadUsersForForms();
      renderDayChips();
      renderOffDayChips();
      loadManageShifts();
      loadOffDays();
      loadNoteList();
      loadPendingRequests();
      loadOpenShiftsManage();
      setupAiChat();
    }
    if (name === "people") {
      loadPeople();
      loadPasswordHelp();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function emptyState(title, text) {
    return `
      <div class="empty-state">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
  }

  function personColor(shiftOrUser) {
    return shiftOrUser?.color || "#2c9b7f";
  }

  function shiftCardHtml(shift, { showName = false, manage = false } = {}) {
    const isToday = shift.date === todayKey();
    const color = personColor(shift);
    const simpleStaff = !isLead() && !manage && !showName;
    return `
      <article class="shift-card ${isToday ? "is-today" : ""} ${simpleStaff ? "is-simple" : ""}" data-id="${escapeHtml(shift.id)}" style="--person-color:${escapeHtml(color)}">
        ${isToday ? `<div class="today-badge">${escapeHtml(t("badge.today"))}</div>` : ""}
        ${simpleStaff ? "" : `<div class="shift-day">${escapeHtml(formatDayLabel(shift.date))}</div>`}
        <div class="shift-time">${escapeHtml(formatTime(shift.start))} – ${escapeHtml(formatTime(shift.end))}</div>
        ${showName ? `<div class="shift-name">${escapeHtml(shift.staffName || "")}</div>` : ""}
        ${shift.area ? `<div class="shift-area">${escapeHtml(shift.area)}</div>` : ""}
        ${shift.notes ? `<p class="shift-notes">${escapeHtml(shift.notes)}</p>` : ""}
        ${
          manage
            ? `<div class="shift-actions">
                <button type="button" class="btn btn-soft" data-edit-shift>Edit</button>
                <button type="button" class="btn btn-danger" data-delete-shift>Remove</button>
              </div>`
            : ""
        }
      </article>
    `;
  }

  function shiftsToText(shifts, title) {
    const lines = shifts.map((s) => {
      const area = s.area ? ` · ${s.area}` : "";
      const notes = s.notes ? ` (${s.notes})` : "";
      return `${s.staffName || currentUser.name}: ${formatDayLabel(s.date)} ${formatTime(s.start)}–${formatTime(s.end)}${area}${notes}`;
    });
    return `${title}\n${lines.length ? lines.join("\n") : "No shifts."}`;
  }

  async function shareText(title, text) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied schedule text");
    } catch {
      showToast("Could not share on this device");
    }
  }

  async function loadReminders() {
    if (!reminderBanner || !currentUser) return;
    try {
      const tomorrow = toDateKey(addDays(new Date(), 1));
      const today = todayKey();
      const shifts = await fetchShiftsRange({ mine: true, from: today, to: tomorrow });
      const todayShifts = shifts.filter((s) => s.date === today);
      const tomorrowShifts = shifts.filter((s) => s.date === tomorrow);
      const dismissedKey = `shiftboard-reminder-${today}-${currentUser.id}`;
      if (sessionStorage.getItem(dismissedKey)) {
        reminderBanner.hidden = true;
        return;
      }

      if (todayShifts.length) {
        const first = todayShifts[0];
        reminderBanner.hidden = false;
        reminderBanner.innerHTML = `
          <strong>You work today</strong>
          <span>${escapeHtml(formatTime(first.start))} – ${escapeHtml(formatTime(first.end))}${first.area ? ` · ${escapeHtml(first.area)}` : ""}</span>
          <button type="button" class="btn btn-soft btn-mini" id="dismiss-reminder" style="margin-top:0.55rem">Got it</button>
        `;
      } else if (tomorrowShifts.length) {
        const first = tomorrowShifts[0];
        reminderBanner.hidden = false;
        reminderBanner.innerHTML = `
          <strong>Reminder: you work tomorrow</strong>
          <span>${escapeHtml(formatTime(first.start))} – ${escapeHtml(formatTime(first.end))}${first.area ? ` · ${escapeHtml(first.area)}` : ""}</span>
          <button type="button" class="btn btn-soft btn-mini" id="dismiss-reminder" style="margin-top:0.55rem">Got it</button>
        `;
      } else {
        reminderBanner.hidden = true;
        return;
      }
      document.getElementById("dismiss-reminder")?.addEventListener("click", () => {
        sessionStorage.setItem(dismissedKey, "1");
        reminderBanner.hidden = true;
      });
    } catch {
      reminderBanner.hidden = true;
    }
  }

  async function loadTodayBoard() {
    try {
      const res = await fetch("/api/today", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load today");
      const date = data.date || todayKey();
      todayDateLabel.textContent = formatDayLabel(date);
      const shifts = Array.isArray(data.shifts) ? data.shifts : [];
      const off = Array.isArray(data.off) ? data.off : [];
      lastTeamShifts = shifts;

      if (todayTeamNote) {
        if (data.note?.text) {
          todayTeamNote.hidden = false;
          todayTeamNote.innerHTML = `<strong>${escapeHtml(t("teamNote"))}</strong><span>${escapeHtml(data.note.text)}</span>`;
        } else {
          todayTeamNote.hidden = true;
          todayTeamNote.innerHTML = "";
        }
      }

      const coverageEl = document.getElementById("coverage-strip");
      const withEl = document.getElementById("working-with");
      const count = Number(data.workingCount ?? shifts.length);
      if (coverageEl) {
        coverageEl.hidden = false;
        coverageEl.classList.remove("is-short", "is-empty", "is-ok");
        if (data.coverage === "empty") {
          coverageEl.classList.add("is-empty");
          coverageEl.innerHTML = `<strong>${escapeHtml(t("coverage.empty"))}</strong><span>${escapeHtml(t("coverage.emptyHint"))}</span>`;
        } else if (data.coverage === "short") {
          coverageEl.classList.add("is-short");
          coverageEl.innerHTML = `<strong>${escapeHtml(
            t(count === 1 ? "coverage.short" : "coverage.shortPlural", { count })
          )}</strong><span>${escapeHtml(t("coverage.shortHint", { min: data.minCoverage || 2 }))}</span>`;
        } else {
          coverageEl.classList.add("is-ok");
          coverageEl.innerHTML = `<strong>${escapeHtml(t("coverage.ok", { count }))}</strong><span>${escapeHtml(t("coverage.okHint"))}</span>`;
        }
      }

      if (withEl && !isLead()) {
        const others = shifts.filter((s) => s.userId !== currentUser.id);
        const mine = shifts.filter((s) => s.userId === currentUser.id);
        if (mine.length && others.length) {
          withEl.hidden = false;
          const names = others.map((s) => s.staffName).filter(Boolean);
          const unique = [...new Set(names)];
          withEl.innerHTML = `<strong>${escapeHtml(t("with.title"))}</strong><span>${escapeHtml(unique.join(", "))}</span>`;
        } else if (mine.length && !others.length) {
          withEl.hidden = false;
          withEl.innerHTML = `<strong>${escapeHtml(t("with.aloneTitle"))}</strong><span>${escapeHtml(t("with.alone"))}</span>`;
        } else {
          withEl.hidden = true;
          withEl.innerHTML = "";
        }
      }

      if (!shifts.length) {
        todayBoard.innerHTML = emptyState(t("empty.nobodyToday"), t("empty.addShifts"));
      } else {
        todayBoard.innerHTML = shifts
          .map(
            (s) => `
          <article class="today-card ${s.userId === currentUser?.id ? "is-you" : ""}" style="--person-color:${escapeHtml(personColor(s))}">
            <span class="avatar" aria-hidden="true">${escapeHtml(initials(s.staffName))}</span>
            <div>
              <strong>${escapeHtml(s.staffName || "")}${s.userId === currentUser?.id ? ` · ${t("you")}` : ""}</strong>
              <div class="today-time">${escapeHtml(formatTime(s.start))} – ${escapeHtml(formatTime(s.end))}</div>
              <div class="today-meta">${s.area ? escapeHtml(s.area) : "No floor set"}${s.notes ? ` · ${escapeHtml(s.notes)}` : ""}</div>
            </div>
          </article>
        `
          )
          .join("");
      }

      if (!off.length) {
        todayOff.innerHTML = "";
      } else {
        todayOff.innerHTML =
          `<h2 class="list-heading">${escapeHtml(t("off.chip"))}</h2>` +
          off
            .map(
              (o) => `
          <div class="off-chip" style="--person-color:${escapeHtml(personColor(o))}">
            <span class="off-dot" aria-hidden="true"></span>
            <span>${escapeHtml(o.staffName)}${offReasonLabel(o.reason) ? ` · ${escapeHtml(offReasonLabel(o.reason))}` : ""}</span>
          </div>`
            )
            .join("");
      }
    } catch (err) {
      todayBoard.innerHTML = emptyState("Can't load today", err.message || "Try again.");
      todayOff.innerHTML = "";
    }
  }

  async function loadOffDays() {
    if (!offList) return;
    try {
      const { from, to } = weekBoundsFrom(new Date());
      const toNext = toDateKey(addDays(parseDateKey(to), 7));
      const res = await fetch(`/api/off?from=${from}&to=${toNext}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load off days");
      const off = Array.isArray(data.off) ? data.off : [];
      if (!off.length) {
        offList.innerHTML = emptyState("No days off set", "Mark vacation or off days above.");
        return;
      }
      offList.innerHTML = off
        .map(
          (o) => `
        <article class="off-card" data-off-id="${escapeHtml(o.id)}">
          <div>
            <strong>${escapeHtml(o.staffName)}</strong>
            <small>${escapeHtml(formatDayLabel(o.date))}${offReasonLabel(o.reason) ? ` · ${escapeHtml(offReasonLabel(o.reason))}` : ""}</small>
          </div>
          <button type="button" class="btn btn-danger btn-mini" data-remove-off>Remove</button>
        </article>
      `
        )
        .join("");
    } catch (err) {
      offList.innerHTML = emptyState("Can't load off days", err.message || "Try again.");
    }
  }

  function groupByDate(shifts) {
    const map = new Map();
    for (const shift of shifts) {
      if (!map.has(shift.date)) map.set(shift.date, []);
      map.get(shift.date).push(shift);
    }
    return map;
  }

  function daysBetween(from, to) {
    const start = parseDateKey(from);
    const end = parseDateKey(to);
    const days = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      days.push(toDateKey(d));
    }
    return days;
  }

  function offCardHtml(off) {
    return `
      <div class="day-off-card">
        <strong>Off${off.staffName ? ` · ${escapeHtml(off.staffName)}` : ""}</strong>
        ${offReasonLabel(off.reason) ? `<span>${escapeHtml(offReasonLabel(off.reason))}</span>` : ""}
      </div>
    `;
  }

  function noteCardHtml(note) {
    if (!note) return "";
    return `
      <div class="day-note-card">
        <strong>Team note</strong>
        <span>${escapeHtml(note.text)}</span>
      </div>
    `;
  }

  function renderShiftList(
    el,
    shifts,
    {
      showName = false,
      manage = false,
      emptyTitle,
      emptyText,
      fillFrom,
      fillTo,
      offDays = [],
      notes = [],
    } = {}
  ) {
    const grouped = groupByDate(shifts);
    const offByDate = new Map();
    for (const o of offDays) {
      if (!offByDate.has(o.date)) offByDate.set(o.date, []);
      offByDate.get(o.date).push(o);
    }
    const noteByDate = new Map(notes.map((n) => [n.date, n]));

    let days;
    if (fillFrom && fillTo) {
      days = daysBetween(fillFrom, fillTo);
    } else {
      days = [...new Set([...grouped.keys(), ...offByDate.keys(), ...noteByDate.keys()])].sort();
    }

    if (!days.length) {
      el.innerHTML = emptyState(emptyTitle, emptyText);
      return;
    }

    el.innerHTML = days
      .map((date) => {
        const list = grouped.get(date) || [];
        const offs = offByDate.get(date) || [];
        const note = noteByDate.get(date);
        let body = "";
        if (note) body += noteCardHtml(note);
        if (offs.length) body += offs.map(offCardHtml).join("");
        if (list.length) body += list.map((s) => shiftCardHtml(s, { showName, manage })).join("");
        if (!body) {
          body =
            !isLead()
              ? `<div class="day-empty">Off / no work</div>`
              : `<div class="day-empty">No shift</div>`;
        }
        return `
          <section class="day-block ${date === todayKey() ? "is-today" : ""}">
            <h2 class="day-heading">${escapeHtml(formatShortDay(date))}</h2>
            <div class="day-shifts">${body}</div>
          </section>
        `;
      })
      .join("");
  }

  async function fetchOffRange({ from, to, mine = false } = {}) {
    const params = new URLSearchParams({ from, to });
    const res = await fetch(`/api/off?${params}`, {
      cache: "no-store",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load off days");
    let off = Array.isArray(data.off) ? data.off : [];
    if (mine && currentUser) off = off.filter((o) => o.userId === currentUser.id);
    return off;
  }

  async function fetchNotesRange({ from, to } = {}) {
    const params = new URLSearchParams({ from, to });
    const res = await fetch(`/api/notes?${params}`, {
      cache: "no-store",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load notes");
    return Array.isArray(data.notes) ? data.notes : [];
  }

  function renderMonthCalendar(el, cursor, shifts, selectedDay, onSelectAttr, offDays = []) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1, 12);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const counts = {};
    const offSet = new Set(offDays.map((o) => o.date));
    for (const s of shifts) counts[s.date] = (counts[s.date] || 0) + 1;

    const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((d) => `<div class="month-dow">${d}</div>`)
      .join("");

    let cells = "";
    for (let i = 0; i < startPad; i += 1) {
      cells += `<div class="month-day is-outside"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = toDateKey(new Date(year, month, day, 12));
      const count = counts[key] || 0;
      const isOffDay = offSet.has(key);
      const classes = [
        "month-day",
        key === todayKey() ? "is-today" : "",
        count ? "has-shift" : "",
        isOffDay ? "is-off" : "",
        key === selectedDay ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cells += `
        <button type="button" class="${classes}" data-${onSelectAttr}="${key}" aria-label="${formatDayLabel(key)}">
          <span>${day}</span>
          ${count || isOffDay ? `<span class="dot" aria-hidden="true"></span>` : ""}
        </button>
      `;
    }
    el.innerHTML = dow + cells;
    el.hidden = false;
  }

  async function fetchShiftsRange({ mine = false, from, to } = {}) {
    const params = new URLSearchParams({ from, to });
    if (mine) params.set("mine", "1");
    const res = await fetch(`/api/shifts?${params}`, {
      cache: "no-store",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load schedule");
    return Array.isArray(data.shifts) ? data.shifts : [];
  }

  function syncModeButtons() {
    document.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === myMode);
    });
    document.querySelectorAll("[data-team-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.teamMode === teamMode);
    });
  }

  function updateGuides(shiftCount) {
    if (!staffGuide || !managerGuide) return;
    const lead = isLead();
    const onTodayWindow = myMode === "day" && mySelectedDay === todayKey();
    const staffEmptyWeek = !lead && myMode === "week" && shiftCount === 0;
    managerGuide.hidden = !(lead && onTodayWindow && shiftCount === 0);
    staffGuide.hidden = !(staffEmptyWeek || (!lead && onTodayWindow && shiftCount === 0));
  }

  async function loadMySchedule() {
    syncModeButtons();
    const range = rangeForMode(myMode, myCursor, mySelectedDay);
    scheduleTitle.textContent =
      !isLead()
        ? t("mine.title")
        : myMode === "day"
          ? t("title.day")
          : myMode === "week"
            ? t("title.week")
            : t("title.month");
    if (isLead() && myMode === "day" && mySelectedDay === todayKey()) {
      scheduleTitle.textContent = t("title.today");
    }
    scheduleRange.textContent = range.label;

    try {
      const [all, offAll, notesAll] = await Promise.all([
        fetchShiftsRange({ mine: true, from: range.from, to: range.to }),
        fetchOffRange({ from: range.from, to: range.to, mine: true }),
        fetchNotesRange({ from: range.from, to: range.to }),
      ]);
      monthCalendar.hidden = myMode !== "month";
      let visible = all;
      let offVisible = offAll;
      let notesVisible = notesAll;
      let fillFrom;
      let fillTo;
      if (myMode === "week") {
        fillFrom = range.from;
        fillTo = range.to;
      } else if (myMode === "month") {
        renderMonthCalendar(monthCalendar, myCursor, all, mySelectedDay, "pick-day", offAll);
        visible = all.filter((s) => s.date === mySelectedDay);
        offVisible = offAll.filter((o) => o.date === mySelectedDay);
        notesVisible = notesAll.filter((n) => n.date === mySelectedDay);
        scheduleRange.textContent = `${range.label} · ${formatShortDay(mySelectedDay)}`;
      } else {
        visible = all.filter((s) => s.date === range.from);
        offVisible = offAll.filter((o) => o.date === range.from);
        notesVisible = notesAll.filter((n) => n.date === range.from);
        fillFrom = range.from;
        fillTo = range.to;
      }
      lastMyShifts = visible;
      updateGuides(all.length);
      renderWeekSummary(all, range);
      renderShiftList(mySchedule, visible, {
        fillFrom,
        fillTo,
        offDays: offVisible,
        notes: notesVisible,
        emptyTitle: myMode === "month" ? t("empty.noDay") : t("empty.noDays"),
        emptyText:
          isLead() ? t("empty.useManage") : t("empty.askMgr"),
      });
    } catch (err) {
      monthCalendar.hidden = true;
      lastMyShifts = [];
      updateGuides(0);
      const summary = document.getElementById("week-summary");
      if (summary) {
        summary.hidden = true;
        summary.innerHTML = "";
      }
      mySchedule.innerHTML = emptyState("Can't load schedule", err.message || "Try again.");
    }
  }

  async function loadTeamSchedule() {
    syncModeButtons();
    const range = rangeForMode(teamMode, teamCursor, teamSelectedDay);
    teamRange.textContent = range.label;
    try {
      const [all, offAll, notesAll] = await Promise.all([
        fetchShiftsRange({ from: range.from, to: range.to }),
        fetchOffRange({ from: range.from, to: range.to }),
        fetchNotesRange({ from: range.from, to: range.to }),
      ]);
      teamMonthCalendar.hidden = teamMode !== "month";
      let visible = all;
      let offVisible = offAll;
      let notesVisible = notesAll;
      let fillFrom;
      let fillTo;
      if (teamMode === "week") {
        fillFrom = range.from;
        fillTo = range.to;
      } else if (teamMode === "month") {
        renderMonthCalendar(teamMonthCalendar, teamCursor, all, teamSelectedDay, "team-pick-day", offAll);
        visible = all.filter((s) => s.date === teamSelectedDay);
        offVisible = offAll.filter((o) => o.date === teamSelectedDay);
        notesVisible = notesAll.filter((n) => n.date === teamSelectedDay);
        teamRange.textContent = `${range.label} · ${formatShortDay(teamSelectedDay)}`;
      } else {
        fillFrom = range.from;
        fillTo = range.to;
      }
      lastTeamShifts = visible;
      renderShiftList(teamSchedule, visible, {
        showName: true,
        fillFrom,
        fillTo,
        offDays: offVisible,
        notes: notesVisible,
        emptyTitle: "No team shifts",
        emptyText: "Use Make schedule to add shifts.",
      });
    } catch (err) {
      teamMonthCalendar.hidden = true;
      lastTeamShifts = [];
      teamSchedule.innerHTML = emptyState("Can't load team schedule", err.message || "Try again.");
    }
  }

  function renderWeekSummary(shifts, range) {
    const el = document.getElementById("week-summary");
    if (!el) return;
    const hours = shifts.reduce((sum, s) => sum + shiftHours(s), 0);
    const days = new Set(shifts.map((s) => s.date)).size;
    el.hidden = false;
    el.innerHTML = `
      <div>
        <strong>${escapeHtml(t("hours", { hours: formatHours(hours) }))}</strong>
        <span>${escapeHtml(
          t(days === 1 ? "workDays" : "workDaysPlural", { days, label: range?.label || t("title.week") })
        )}</span>
      </div>
    `;
  }

  function openShiftCardHtml(open, { manage = false } = {}) {
    const taken = (open.claimed || []).map((p) => p.name).join(", ");
    const mine = (open.claimedBy || []).includes(currentUser?.id);
    const spots = Number(open.spotsLeft ?? 0);
    const actions = manage
      ? `<button type="button" class="btn btn-danger" data-cancel-open>${escapeHtml(t("open.remove"))}</button>`
      : mine
        ? `<span class="open-taken">${escapeHtml(t("open.takenYou"))}</span>`
        : spots > 0
          ? `<button type="button" class="btn btn-primary" data-claim-open>${escapeHtml(t("open.take"))}</button>`
          : `<span class="open-taken">${escapeHtml(t("open.taken"))}</span>`;
    return `
      <article class="open-card ${open.filled ? "is-filled" : ""}" data-open-id="${escapeHtml(open.id)}" style="--person-color:${escapeHtml(open.claimed?.[0]?.color || "#2c9b7f")}">
        <div class="shift-day">${escapeHtml(formatDayLabel(open.date))}</div>
        <div class="shift-time">${escapeHtml(formatTime(open.start))} – ${escapeHtml(formatTime(open.end))}</div>
        <div class="shift-area">${escapeHtml(t(spots === 1 ? "open.spot" : "open.spots", { count: spots }))}${open.area ? ` · ${escapeHtml(open.area)}` : ""}</div>
        ${open.notes ? `<p class="shift-notes">${escapeHtml(open.notes)}</p>` : ""}
        ${taken ? `<p class="shift-notes">${escapeHtml(t("open.takenBy", { names: taken }))}</p>` : ""}
        <div class="shift-actions">${actions}</div>
      </article>
    `;
  }

  async function loadStaffExtras() {
    const askForm = document.getElementById("ask-off-form");
    if (askForm) askForm.hidden = isLead();
    const dateInput = document.getElementById("ask-off-date");
    if (dateInput && !dateInput.value) dateInput.value = todayKey();
    await Promise.all([loadNextShift(), loadOpenShiftsBoard(), loadMyOffRequests(), loadPendingBadge()]);
  }

  async function loadNextShift() {
    const el = document.getElementById("next-shift-card");
    if (!el || !currentUser) return;
    try {
      const from = todayKey();
      const to = toDateKey(addDays(new Date(), 21));
      const shifts = await fetchShiftsRange({ mine: true, from, to });
      const upcoming = shifts.find((s) => {
        if (s.date > from) return true;
        if (s.date === from) return timeToMinutes(s.end) > nowMinutes();
        return false;
      });
      if (!upcoming) {
        el.hidden = true;
        el.innerHTML = "";
        return;
      }
      const when =
        upcoming.date === from
          ? t("today.today")
          : upcoming.date === toDateKey(addDays(new Date(), 1))
            ? t("tomorrow")
            : formatDayLabel(upcoming.date);
      el.hidden = false;
      el.innerHTML = `
        <span class="next-kicker">${escapeHtml(t("nextShift"))}</span>
        <strong>${escapeHtml(when)}</strong>
        <span>${escapeHtml(formatTime(upcoming.start))} – ${escapeHtml(formatTime(upcoming.end))}${upcoming.area ? ` · ${escapeHtml(upcoming.area)}` : ""}</span>
      `;
    } catch {
      el.hidden = true;
    }
  }

  async function loadOpenShiftsBoard() {
    const el = document.getElementById("open-shifts-board");
    if (!el) return;
    try {
      const res = await fetch("/api/open-shifts", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load extra shifts");
      const opens = (data.opens || []).filter((o) => !o.filled || (o.claimedBy || []).includes(currentUser?.id));
      const available = opens.filter((o) => !o.filled);
      if (!available.length) {
        el.hidden = true;
        el.innerHTML = "";
        return;
      }
      el.hidden = false;
      el.innerHTML =
        `<h2 class="list-heading">${escapeHtml(t("open.available"))}</h2>` +
        available.map((o) => openShiftCardHtml(o)).join("");
    } catch {
      el.hidden = true;
    }
  }

  async function loadMyOffRequests() {
    const el = document.getElementById("my-off-requests");
    if (!el || isLead()) {
      if (el) el.innerHTML = "";
      return;
    }
    try {
      const res = await fetch("/api/off-requests", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      const recent = (data.requests || []).slice(0, 6);
      if (!recent.length) {
        el.innerHTML = "";
        return;
      }
      el.innerHTML = recent
        .map((r) => {
          const days = (r.dates || []).map(formatShortDay).join(", ");
          const status =
            r.status === "approved"
              ? t("ask.statusYes")
              : r.status === "denied"
                ? t("ask.statusNo")
                : t("ask.statusWait");
          return `<div class="request-chip is-${escapeHtml(r.status)}"><span>${escapeHtml(days)}</span><strong>${escapeHtml(status)}</strong></div>`;
        })
        .join("");
    } catch {
      el.innerHTML = "";
    }
  }

  async function loadPendingBadge() {
    const badge = document.getElementById("request-badge");
    if (!badge || !isLead()) {
      if (badge) badge.hidden = true;
      return;
    }
    try {
      const res = await fetch("/api/off-requests", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      const count = Number(data.pendingCount || 0);
      badge.hidden = count === 0;
      badge.textContent = String(count);
    } catch {
      badge.hidden = true;
    }
  }

  async function loadPendingRequests() {
    const el = document.getElementById("pending-requests");
    if (!el || !isLead()) return;
    try {
      const res = await fetch("/api/off-requests", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      const pending = (data.requests || []).filter((r) => r.status === "pending");
      loadPendingBadge();
      if (!pending.length) {
        el.hidden = true;
        el.innerHTML = "";
        return;
      }
      el.hidden = false;
      el.innerHTML =
        `<h2 class="list-heading">${escapeHtml(t("pending.heading"))}</h2>` +
        pending
          .map((r) => {
            const days = (r.dates || []).map(formatDayLabel).join(", ");
            return `
              <article class="request-card" data-request-id="${escapeHtml(r.id)}">
                <strong>${escapeHtml(r.staffName)}</strong>
                <span>${escapeHtml(days)}</span>
                ${offReasonLabel(r.reason) ? `<p>${escapeHtml(offReasonLabel(r.reason))}</p>` : ""}
                <div class="shift-actions">
                  <button type="button" class="btn btn-primary" data-approve-off>${escapeHtml(t("pending.yes"))}</button>
                  <button type="button" class="btn btn-ghost" data-deny-off>${escapeHtml(t("pending.no"))}</button>
                </div>
              </article>
            `;
          })
          .join("");
    } catch {
      el.hidden = true;
    }
  }

  async function loadOpenShiftsManage() {
    const el = document.getElementById("open-shift-list");
    const dateInput = document.getElementById("open-date");
    if (dateInput && !dateInput.value) dateInput.value = todayKey();
    if (!el) return;
    try {
      const res = await fetch("/api/open-shifts", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load");
      const opens = data.opens || [];
      if (!opens.length) {
        el.innerHTML = `<p class="field-hint">No extra shifts posted yet.</p>`;
        return;
      }
      el.innerHTML = opens.map((o) => openShiftCardHtml(o, { manage: true })).join("");
    } catch (err) {
      el.innerHTML = emptyState("Can't load extra shifts", err.message || "Try again.");
    }
  }

  function updatePeopleSelectedLabel() {
    const label = document.getElementById("people-selected-label");
    const count = selectedPeople.size;
    if (!label) return;
    label.textContent =
      count === 0 ? "(tap one or more)" : count === 1 ? "(1 person)" : `(${count} people)`;
  }

  function updateShiftSubmitLabel() {
    const submit = document.getElementById("shift-submit");
    const editing = Boolean(document.getElementById("shift-id").value);
    if (!submit || editing) return;
    const total = selectedPeople.size * selectedDays.size;
    if (total <= 1) submit.textContent = "Save shift";
    else submit.textContent = `Save ${total} shifts`;
  }

  function renderPersonChips() {
    if (!personChips) return;
    if (!usersCache.length) {
      personChips.innerHTML = `<p class="field-hint">No people yet. Add someone in People, or ask them to create an account.</p>`;
      return;
    }
    personChips.innerHTML = usersCache
      .map(
        (u) => `
      <button type="button" class="person-chip ${selectedPeople.has(u.id) ? "is-active" : ""}" data-user-id="${escapeHtml(u.id)}" style="--person-color:${escapeHtml(personColor(u))}" aria-pressed="${selectedPeople.has(u.id)}">
        <span class="chip-dot" aria-hidden="true"></span>${escapeHtml(u.name)}
      </button>
    `
      )
      .join("");
    updatePeopleSelectedLabel();
    updateShiftSubmitLabel();
  }

  function updateDaysSelectedLabel() {
    const label = document.getElementById("days-selected-label");
    const count = selectedDays.size;
    if (label) {
      label.textContent =
        count === 0 ? "(tap days below)" : count === 1 ? "(1 day selected)" : `(${count} days selected)`;
    }
    updateShiftSubmitLabel();
  }

  function renderDayChips() {
    if (!dayChips) return;
    const start = startOfWeek(new Date());
    // Show this week + next week so managers can tap more days.
    dayChips.innerHTML = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(start, i);
      const key = toDateKey(d);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const num = d.getDate();
      return `
        <button type="button" class="day-chip ${selectedDays.has(key) ? "is-active" : ""}" data-day="${key}" aria-pressed="${selectedDays.has(key)}">
          <span>${label}</span>
          <small>${num}</small>
        </button>
      `;
    }).join("");
    updateDaysSelectedLabel();
  }

  function setSelectedDays(days) {
    selectedDays = new Set(days);
    renderDayChips();
  }

  function toggleSelectedDay(day) {
    const editing = Boolean(document.getElementById("shift-id").value);
    if (editing) {
      selectedDays = new Set([day]);
    } else if (selectedDays.has(day)) {
      selectedDays.delete(day);
    } else {
      selectedDays.add(day);
    }
    renderDayChips();
  }

  async function loadUsersForForms() {
    try {
      const res = await fetch("/api/users", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load people");
      usersCache = Array.isArray(data.users) ? data.users : [];
      renderPersonChips();
      if (offUser) {
        const selected = offUser.value;
        offUser.innerHTML =
          `<option value="">Choose person</option>` +
          usersCache.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
        if (selected) offUser.value = selected;
      }
      const personOptions =
        `<option value="">Choose</option>` +
        usersCache.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
      const swapA = document.getElementById("swap-user-a");
      const swapB = document.getElementById("swap-user-b");
      if (swapA) {
        const keep = swapA.value;
        swapA.innerHTML = personOptions;
        if (keep) swapA.value = keep;
      }
      if (swapB) {
        const keep = swapB.value;
        swapB.innerHTML = personOptions;
        if (keep) swapB.value = keep;
      }
      const noteDate = document.getElementById("note-date");
      if (noteDate && !noteDate.value) noteDate.value = todayKey();
      const swapDayA = document.getElementById("swap-day-a");
      const swapDayB = document.getElementById("swap-day-b");
      if (swapDayA && !swapDayA.value) swapDayA.value = todayKey();
      if (swapDayB && !swapDayB.value) swapDayB.value = todayKey();
      renderOffDayChips();
    } catch (err) {
      showToast(err.message || "Could not load people");
    }
  }

  async function loadNoteList() {
    if (!noteList) return;
    try {
      const { from } = weekBoundsFrom(new Date());
      const to = toDateKey(addDays(parseDateKey(from), 13));
      const notes = await fetchNotesRange({ from, to });
      if (!notes.length) {
        noteList.innerHTML = emptyState("No team notes yet", "Add a note above for everyone to see.");
        return;
      }
      noteList.innerHTML = notes
        .map(
          (n) => `
        <article class="note-card" data-note-id="${escapeHtml(n.id)}">
          <div>
            <strong>${escapeHtml(formatDayLabel(n.date))}</strong>
            <small>${escapeHtml(n.text)}</small>
          </div>
          <button type="button" class="btn btn-danger btn-mini" data-remove-note>Remove</button>
        </article>
      `
        )
        .join("");
    } catch (err) {
      noteList.innerHTML = emptyState("Can't load notes", err.message || "Try again.");
    }
  }

  async function loadManageShifts() {
    try {
      const { from, to } = weekBoundsFrom(new Date());
      const [shifts, offDays, notes] = await Promise.all([
        fetchShiftsRange({ from, to }),
        fetchOffRange({ from, to }),
        fetchNotesRange({ from, to }),
      ]);
      renderShiftList(manageShifts, shifts, {
        showName: true,
        manage: true,
        fillFrom: from,
        fillTo: to,
        offDays,
        notes,
        emptyTitle: "No shifts yet this week",
        emptyText: "Use the form above to add the first shift.",
      });
    } catch (err) {
      manageShifts.innerHTML = emptyState("Can't load shifts", err.message || "Try again.");
    }
  }

  function updateOffDaysLabel() {
    const label = document.getElementById("off-days-label");
    const count = selectedOffDays.size;
    if (!label) return;
    label.textContent =
      count === 0 ? "(tap one or more)" : count === 1 ? "(1 day selected)" : `(${count} days selected)`;
  }

  function renderOffDayChips() {
    if (!offDayChips) return;
    const start = startOfWeek(new Date());
    offDayChips.innerHTML = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(start, i);
      const key = toDateKey(d);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const num = d.getDate();
      return `
        <button type="button" class="day-chip ${selectedOffDays.has(key) ? "is-active" : ""}" data-off-day="${key}" aria-pressed="${selectedOffDays.has(key)}">
          <span>${label}</span>
          <small>${num}</small>
        </button>
      `;
    }).join("");
    updateOffDaysLabel();
  }

  async function loadPasswordHelp() {
    const box = document.getElementById("password-help-box");
    const list = document.getElementById("password-help-list");
    if (!box || !list || !isLead()) return;
    try {
      const res = await fetch("/api/password-help", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load requests");
      const requests = Array.isArray(data.requests) ? data.requests : [];
      if (!requests.length) {
        box.hidden = true;
        list.innerHTML = "";
        return;
      }
      box.hidden = false;
      list.innerHTML = requests
        .map(
          (h) => `
        <div class="help-row" data-help-id="${escapeHtml(h.id)}">
          <div>
            <strong>${escapeHtml(h.name)}</strong>
            <small>Needs a new password</small>
          </div>
          <button type="button" class="btn btn-primary btn-compact" data-set-help-password>Give password</button>
        </div>
      `
        )
        .join("");
    } catch {
      box.hidden = true;
      list.innerHTML = "";
    }
  }

  async function loadPeople() {
    try {
      const res = await fetch("/api/users", { headers: authHeaders(), cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load people");
      const users = Array.isArray(data.users) ? data.users : [];
      if (!users.length) {
        peopleList.innerHTML = emptyState("No people yet", "Add the first person above.");
        return;
      }
      peopleList.innerHTML = users
        .map(
          (u) => `
        <article class="person-card" data-id="${escapeHtml(u.id)}">
          <div class="person-main">
            <span class="avatar" aria-hidden="true" style="background:${escapeHtml(personColor(u))}">${escapeHtml(initials(u.name))}</span>
            <div>
              <strong>${escapeHtml(u.name)}</strong>
              <small>${roleTag(u.role)}</small>
            </div>
          </div>
          <div class="person-actions">
            <button type="button" class="btn btn-soft" data-reset-pin>New password</button>
            ${
              u.id === currentUser.id || u.role === "admin"
                ? ""
                : `<button type="button" class="btn btn-danger" data-remove-person>Remove</button>`
            }
          </div>
        </article>
      `
        )
        .join("");
      await loadPasswordHelp();
    } catch (err) {
      peopleList.innerHTML = emptyState("Can't load people", err.message || "Try again.");
    }
  }

  function cellTextForPersonDay(shifts, offs) {
    if (offs?.length) {
      const extra = offs.map((o) => offReasonLabel(o.reason)).filter(Boolean);
      return extra.length ? `Off (${extra.join("; ")})` : "Off";
    }
    if (!shifts?.length) return "";
    return shifts
      .map((s) => {
        const time = `${formatTime(s.start)} – ${formatTime(s.end)}`;
        return s.area ? `${time} · ${s.area}` : time;
      })
      .join("; ");
  }

  async function buildWeekGrid() {
    const bounds = weekBoundsFrom(teamCursor);
    const days = daysBetween(bounds.from, bounds.to);
    const [usersRes, shifts, offs] = await Promise.all([
      fetch("/api/users", { headers: authHeaders(), cache: "no-store" }).then((r) => r.json()),
      fetchShiftsRange({ from: bounds.from, to: bounds.to }),
      fetchOffRange({ from: bounds.from, to: bounds.to }),
    ]);
    if (usersRes.error) throw new Error(usersRes.error);
    const users = Array.isArray(usersRes.users) ? usersRes.users : [];
    const byUserDay = new Map();
    for (const s of shifts) {
      const key = `${s.userId}|${s.date}`;
      if (!byUserDay.has(key)) byUserDay.set(key, []);
      byUserDay.get(key).push(s);
    }
    const offByUserDay = new Map();
    for (const o of offs) {
      const key = `${o.userId}|${o.date}`;
      if (!offByUserDay.has(key)) offByUserDay.set(key, []);
      offByUserDay.get(key).push(o);
    }
    const ids = new Set([
      ...users.map((u) => u.id),
      ...shifts.map((s) => s.userId),
      ...offs.map((o) => o.userId),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    for (const s of shifts) if (s.staffName) nameById.set(s.userId, s.staffName);
    for (const o of offs) if (o.staffName) nameById.set(o.userId, o.staffName);
    const people = [...ids]
      .map((id) => ({ id, name: nameById.get(id) || "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const dayLabels = days.map((d) =>
      parseDateKey(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    );
    const rows = people.map((p) => ({
      name: p.name,
      cells: days.map((d) =>
        cellTextForPersonDay(byUserDay.get(`${p.id}|${d}`) || [], offByUserDay.get(`${p.id}|${d}`) || [])
      ),
    }));
    return {
      title: `Week of ${bounds.start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
      days,
      dayLabels,
      rows,
    };
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  async function exportWeekExcel() {
    try {
      const grid = await buildWeekGrid();
      const lines = [[csvEscape("Name"), ...grid.dayLabels.map(csvEscape)].join(",")];
      for (const row of grid.rows) {
        lines.push([csvEscape(row.name), ...row.cells.map(csvEscape)].join(","));
      }
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${grid.days[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Excel file downloaded");
    } catch (err) {
      showToast(err.message || "Could not export Excel");
    }
  }

  async function exportWeekPdf() {
    try {
      const grid = await buildWeekGrid();
      const head = `<tr><th>Name</th>${grid.dayLabels.map((d) => `<th>${escapeHtml(d)}</th>`).join("")}</tr>`;
      const body = grid.rows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.name)}</td>${row.cells
              .map((c) => `<td>${escapeHtml(c || "—")}</td>`)
              .join("")}</tr>`
        )
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
        grid.title
      )}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #333; padding: 8px; vertical-align: top; text-align: left; }
          th { background: #e8eef4; }
          td:first-child, th:first-child { background: #f7fafc; font-weight: bold; white-space: nowrap; }
          @media print { body { padding: 0; } }
        </style></head><body>
        <h1>${escapeHtml(grid.title)}</h1>
        <table class="export-table"><thead>${head}</thead><tbody>${body}</tbody></table>
        <script>window.onload=function(){window.print();}</script>
        </body></html>`;
      const win = window.open("", "_blank");
      if (!win) {
        showToast("Allow pop-ups to save the PDF.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      showToast("Use Print → Save as PDF");
    } catch (err) {
      showToast(err.message || "Could not export PDF");
    }
  }

  async function printThisWeek() {
    try {
      const grid = await buildWeekGrid();
      const head = `<tr><th>Name</th>${grid.dayLabels.map((d) => `<th>${escapeHtml(d)}</th>`).join("")}</tr>`;
      const body = grid.rows
        .map((row) => {
          const cells = row.cells
            .map((c) => {
              const off = /^off/i.test(c);
              return `<td class="${off ? "is-off" : ""}">${escapeHtml(c || "")}</td>`;
            })
            .join("");
          return `<tr><th>${escapeHtml(row.name)}</th>${cells}</tr>`;
        })
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(grid.title)}</title>
        <style>
          @page { size: landscape; margin: 0.4in; }
          body { font-family: Nunito, Arial, sans-serif; color: #143652; margin: 0; }
          .banner { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
          h1 { font-size: 28px; margin: 0; }
          .sub { font-size: 16px; font-weight: 700; color: #5c6b76; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 2px solid #143652; padding: 10px 8px; vertical-align: middle; text-align: center; font-size: 15px; font-weight: 800; }
          thead th { background: #143652; color: #fff; font-size: 14px; }
          tbody th { text-align: left; background: #eaf3f8; width: 9rem; font-size: 16px; }
          td.is-off { background: #f8e8e6; color: #b24a6b; }
          @media print { .no-print { display: none !important; } }
        </style></head><body>
        <div class="banner">
          <h1>Housekeeping · ShiftBoard</h1>
          <div class="sub">${escapeHtml(grid.title)}</div>
        </div>
        <table><thead>${head}</thead><tbody>${body}</tbody></table>
        <p class="no-print" style="margin-top:16px"><button onclick="window.print()" style="font-size:18px;padding:10px 18px">Print</button></p>
        <script>window.onload=function(){window.print();}</script>
        </body></html>`;
      const win = window.open("", "_blank");
      if (!win) {
        showToast("Allow pop-ups to print.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      showToast(err.message || "Could not print");
    }
  }

  function resetShiftForm() {
    shiftForm.reset();
    document.getElementById("shift-id").value = "";
    shiftUser.value = "";
    selectedPeople = new Set();
                document.getElementById("shift-start").value = "09:30";
    document.getElementById("shift-end").value = "17:00";
    document.getElementById("shift-submit").textContent = "Save shift";
    document.getElementById("shift-cancel").hidden = true;
    document.querySelectorAll("#time-presets .quick-chip").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll("#area-presets .quick-chip").forEach((b) => b.classList.remove("is-active"));
    renderPersonChips();
    setSelectedDays([todayKey()]);
    document.getElementById("shift-date").value = "";
  }

  function stopMic() {
    try {
      speechRecognition?.stop();
    } catch {
      /* ignore */
    }
    voiceNoteBtn?.classList.remove("is-listening");
    if (micHint) micHint.textContent = "Tap Mic and say the note out loud.";
  }

  function startVoiceNote() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice typing is not available on this browser.");
      return;
    }
    if (voiceNoteBtn.classList.contains("is-listening")) {
      stopMic();
      return;
    }
    stopMic();
    speechRecognition = new SpeechRecognition();
    speechRecognition.lang = navigator.language || "en-US";
    speechRecognition.interimResults = false;
    speechRecognition.maxAlternatives = 1;
    voiceNoteBtn.classList.add("is-listening");
    if (micHint) micHint.textContent = "Listening… speak now.";
    speechRecognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      const notes = document.getElementById("shift-notes");
      notes.value = notes.value ? `${notes.value} ${text}`.trim() : text;
      showToast("Note added from your voice");
    };
    speechRecognition.onerror = () => {
      showToast("Could not hear that. Try again.");
      stopMic();
    };
    speechRecognition.onend = () => {
      voiceNoteBtn.classList.remove("is-listening");
      if (micHint) micHint.textContent = "Tap Mic and say the note out loud.";
    };
    speechRecognition.start();
  }

  function wireShowHide(input, button) {
    button.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? t("login.show") : t("login.hide");
      button.setAttribute("aria-pressed", showing ? "false" : "true");
      input.focus();
    });
  }

  function moveCursor(mode, cursor, direction) {
    const next = new Date(cursor);
    if (mode === "day") next.setDate(next.getDate() + direction);
    else if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    next.setHours(12, 0, 0, 0);
    return next;
  }

  document.querySelectorAll("[data-open-lang]").forEach((btn) => {
    btn.addEventListener("click", () => openLangSheet());
  });
  document.getElementById("lang-close")?.addEventListener("click", () => closeLangSheet());
  document.getElementById("lang-backdrop")?.addEventListener("click", () => closeLangSheet());
  document.getElementById("lang-choices")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;
    setLang(btn.dataset.lang);
  });

  namePicker.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-name]");
    if (!chip) return;
    showPasswordStep(chip.dataset.name);
  });

  function runNameSearch(pickIfOne) {
    renderNamePicker(staffNamesCache);
    const visible = matchingStaff();
    if (pickIfOne && visible.length === 1) showPasswordStep(visible[0].name);
  }

  document.getElementById("name-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    runNameSearch(true);
  });

  nameSearch?.addEventListener("input", () => runNameSearch(false));
  nameSearch?.addEventListener("search", () => runNameSearch(true));
  document.getElementById("continue-as")?.addEventListener("click", (e) => {
    const name = e.currentTarget?.dataset?.name;
    if (name) showPasswordStep(name);
  });

  document.getElementById("login-back").addEventListener("click", () => showNameStep());
  document.getElementById("go-signup")?.addEventListener("click", () => showSignupStep());
  document.getElementById("signup-back")?.addEventListener("click", () => showNameStep());
  document.getElementById("guide-make-schedule")?.addEventListener("click", () => showView("manage"));

  wireShowHide(loginPassword, togglePassword);
  wireShowHide(signupPassword, toggleSignupPassword);

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      myMode = btn.dataset.mode;
      if (myMode === "day") mySelectedDay = toDateKey(myCursor);
      if (myMode === "month") mySelectedDay = toDateKey(myCursor);
      syncModeButtons();
      loadMySchedule();
    });
  });

  document.querySelectorAll("[data-team-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      teamMode = btn.dataset.teamMode;
      if (teamMode === "day" || teamMode === "month") teamSelectedDay = toDateKey(teamCursor);
      syncModeButtons();
      loadTeamSchedule();
    });
  });

  document.getElementById("sched-prev").addEventListener("click", () => {
    myCursor = moveCursor(myMode, myCursor, -1);
    if (myMode === "day") mySelectedDay = toDateKey(myCursor);
    loadMySchedule();
  });
  document.getElementById("sched-next").addEventListener("click", () => {
    myCursor = moveCursor(myMode, myCursor, 1);
    if (myMode === "day") mySelectedDay = toDateKey(myCursor);
    loadMySchedule();
  });
  document.getElementById("sched-today").addEventListener("click", () => {
    myCursor = new Date();
    myCursor.setHours(12, 0, 0, 0);
    mySelectedDay = todayKey();
    loadMySchedule();
  });

  document.getElementById("team-prev").addEventListener("click", () => {
    teamCursor = moveCursor(teamMode, teamCursor, -1);
    if (teamMode === "day") teamSelectedDay = toDateKey(teamCursor);
    loadTeamSchedule();
  });
  document.getElementById("team-next").addEventListener("click", () => {
    teamCursor = moveCursor(teamMode, teamCursor, 1);
    if (teamMode === "day") teamSelectedDay = toDateKey(teamCursor);
    loadTeamSchedule();
  });
  document.getElementById("team-today").addEventListener("click", () => {
    teamCursor = new Date();
    teamCursor.setHours(12, 0, 0, 0);
    teamSelectedDay = todayKey();
    loadTeamSchedule();
  });

  monthCalendar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pick-day]");
    if (!btn) return;
    mySelectedDay = btn.dataset.pickDay;
    myCursor = parseDateKey(mySelectedDay);
    loadMySchedule();
  });

  teamMonthCalendar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-team-pick-day]");
    if (!btn) return;
    teamSelectedDay = btn.dataset.teamPickDay;
    teamCursor = parseDateKey(teamSelectedDay);
    loadTeamSchedule();
  });

  hearScheduleBtn?.addEventListener("click", () => {
    speakShifts(lastMyShifts, { button: hearScheduleBtn });
  });
  hearTeamBtn?.addEventListener("click", () => {
    speakShifts(lastTeamShifts, { showName: true, button: hearTeamBtn });
  });
  voiceNoteBtn?.addEventListener("click", () => startVoiceNote());

  document.getElementById("share-mine")?.addEventListener("click", () => {
    shareText("My schedule", shiftsToText(lastMyShifts, "My schedule"));
  });
  document.getElementById("share-team")?.addEventListener("click", () => {
    shareText("Team schedule", shiftsToText(lastTeamShifts, "Team schedule"));
  });
  document.getElementById("share-today")?.addEventListener("click", () => {
    shareText("Who's working today", shiftsToText(lastTeamShifts, "Who's working today"));
  });
  document.getElementById("print-week")?.addEventListener("click", () => printThisWeek());
  document.getElementById("export-excel")?.addEventListener("click", () => exportWeekExcel());
  document.getElementById("export-pdf")?.addEventListener("click", () => exportWeekPdf());

  document.getElementById("forgot-password")?.addEventListener("click", async () => {
    const name = (loginNameInput.value || selectedNameEl?.textContent || "").trim();
    const msg = document.getElementById("forgot-message");
    if (msg) {
      msg.hidden = true;
      msg.textContent = "";
    }
    if (!name) {
      setLoginError("Tap your name first.");
      return;
    }
    try {
      const res = await fetch("/api/password-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not ask for help");
      setLoginError("");
        const simple = t("forgot.ok");
      if (msg) {
        msg.hidden = false;
        msg.textContent = simple;
      }
      showToast(simple);
    } catch (err) {
      setLoginError(err.message || "Could not ask for help");
    }
  });

  document.getElementById("password-help-list")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-set-help-password]");
    if (!btn) return;
    const row = btn.closest("[data-help-id]");
    if (!row) return;
    const password = window.prompt("New password (4 numbers is fine):");
    if (password === null) return;
    if (String(password).trim().length < 4) {
      showToast("Use at least 4 characters.");
      return;
    }
    try {
      const res = await fetch(`/api/password-help/${encodeURIComponent(row.dataset.helpId)}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ password: String(password).trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      showToast(`Done. Tell them the new password: ${String(password).trim()}`);
      await loadPasswordHelp();
    } catch (err) {
      showToast(err.message || "Could not save");
    }
  });

  noteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("note-date").value;
    const text = document.getElementById("note-text").value.trim();
    if (!date || !text) {
      showToast("Choose a day and write a note.");
      return;
    }
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ date, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save note");
      document.getElementById("note-text").value = "";
      showToast("Team note saved");
      await loadNoteList();
      await loadManageShifts();
      await loadTodayBoard();
    } catch (err) {
      showToast(err.message || "Could not save note");
    }
  });

  noteList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove-note]");
    if (!btn) return;
    const card = btn.closest("[data-note-id]");
    if (!card || !window.confirm("Remove this team note?")) return;
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(card.dataset.noteId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      showToast("Note removed");
      await loadNoteList();
      await loadManageShifts();
      await loadTodayBoard();
    } catch (err) {
      showToast(err.message || "Could not remove");
    }
  });

  swapForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      userA: document.getElementById("swap-user-a").value,
      dayA: document.getElementById("swap-day-a").value,
      userB: document.getElementById("swap-user-b").value,
      dayB: document.getElementById("swap-day-b").value,
    };
    if (!payload.userA || !payload.userB || !payload.dayA || !payload.dayB) {
      showToast("Choose both people and both days.");
      return;
    }
    if (payload.userA === payload.userB) {
      showToast("Pick two different people.");
      return;
    }
    if (!window.confirm("Swap these two people’s shifts?")) return;
    try {
      const res = await fetch("/api/shifts/swap", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not swap");
      showToast(data.message || "Shifts swapped");
      await loadManageShifts();
      await loadTodayBoard();
    } catch (err) {
      showToast(err.message || "Could not swap");
    }
  });

  document.getElementById("copy-last-week")?.addEventListener("click", async () => {
    if (!window.confirm("Copy all shifts from last week into this week?")) return;
    try {
      const res = await fetch("/api/shifts/copy-week", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not copy");
      showToast(data.message || `Copied ${data.copied || 0}`);
      await loadManageShifts();
      await loadTodayBoard();
    } catch (err) {
      showToast(err.message || "Could not copy");
    }
  });

  offDayChips?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-off-day]");
    if (!chip) return;
    const day = chip.dataset.offDay;
    if (selectedOffDays.has(day)) selectedOffDays.delete(day);
    else selectedOffDays.add(day);
    renderOffDayChips();
  });

  document.getElementById("off-date")?.addEventListener("change", (e) => {
    const value = e.target.value;
    if (!value) return;
    selectedOffDays.add(value);
    renderOffDayChips();
    e.target.value = "";
    showToast("Off day added");
  });

  offForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = offUser.value;
    const dates = [...selectedOffDays].sort();
    const reason = document.getElementById("off-reason").value.trim();
    if (!userId) {
      showToast("Choose who is off.");
      return;
    }
    if (!dates.length) {
      showToast("Tap the days they are off (only those days).");
      return;
    }
    try {
      const res = await fetch("/api/off", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId, dates, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark off");
      document.getElementById("off-reason").value = "";
      selectedOffDays = new Set();
      renderOffDayChips();
      showToast(data.message || "Marked off");
      await loadOffDays();
      await loadManageShifts();
      await loadTodayBoard();
    } catch (err) {
      showToast(err.message || "Could not mark off");
    }
  });

  offList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove-off]");
    if (!btn) return;
    const card = btn.closest("[data-off-id]");
    if (!card) return;
    if (!window.confirm("Remove this off day?")) return;
    try {
      const res = await fetch(`/api/off/${encodeURIComponent(card.dataset.offId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      showToast("Off day removed");
      await loadOffDays();
      await loadTodayBoard();
    } catch (err) {
      showToast(err.message || "Could not remove");
    }
  });

  personChips?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-user-id]");
    if (!chip) return;
    const id = chip.dataset.userId;
    const editing = Boolean(document.getElementById("shift-id").value);
    if (editing) {
      selectedPeople = new Set([id]);
      shiftUser.value = id;
    } else if (selectedPeople.has(id)) {
      selectedPeople.delete(id);
    } else {
      selectedPeople.add(id);
    }
    renderPersonChips();
  });

  document.getElementById("people-all")?.addEventListener("click", () => {
    selectedPeople = new Set(usersCache.map((u) => u.id));
    renderPersonChips();
  });

  document.getElementById("people-clear")?.addEventListener("click", () => {
    selectedPeople = new Set();
    renderPersonChips();
  });

  dayChips?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-day]");
    if (!chip) return;
    toggleSelectedDay(chip.dataset.day);
  });

  document.getElementById("days-clear")?.addEventListener("click", () => {
    setSelectedDays([]);
  });

  document.getElementById("days-weekdays")?.addEventListener("click", () => {
    const start = startOfWeek(new Date());
    const days = Array.from({ length: 5 }, (_, i) => toDateKey(addDays(start, i)));
    setSelectedDays(days);
  });

  document.getElementById("shift-date")?.addEventListener("change", (e) => {
    const value = e.target.value;
    if (!value) return;
    selectedDays.add(value);
    renderDayChips();
    e.target.value = "";
    showToast("Day added");
  });

  document.getElementById("time-presets")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-start]");
    if (!chip) return;
    document.getElementById("shift-start").value = chip.dataset.start;
    document.getElementById("shift-end").value = chip.dataset.end;
    document.querySelectorAll("#time-presets .quick-chip").forEach((b) => {
      b.classList.toggle("is-active", b === chip);
    });
  });

  document.getElementById("area-presets")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-area]");
    if (!chip) return;
    document.getElementById("shift-area").value = chip.dataset.area;
    document.querySelectorAll("#area-presets .quick-chip").forEach((b) => {
      b.classList.toggle("is-active", b === chip);
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoginError("");
    const name = loginNameInput.value.trim();
    const password = loginPassword.value.trim();
    if (!name) {
      showNameStep();
      return;
    }
    if (!password) {
      setLoginError("Please enter your password.");
      loginPassword.focus();
      return;
    }

    loginSubmit.classList.add("is-loading");
    loginSubmit.textContent = "Checking…";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not sign in");
      currentUser = data.user;
      saveSession(currentUser);
      localStorage.setItem("shiftboard-last-name", name);
      showApp();
      showToast(`Welcome, ${currentUser.name}`);
    } catch (err) {
      setLoginError(err.message || "Could not sign in");
      loginPassword.value = "";
      loginPassword.focus();
    } finally {
      loginSubmit.classList.remove("is-loading");
      loginSubmit.textContent = "Show my schedule";
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setSignupError("");
    const name = document.getElementById("signup-name").value.trim();
    const password = signupPassword.value.trim();
    const confirm = document.getElementById("signup-confirm").value.trim();
    const role =
      signupForm.querySelector('input[name="signup-role"]:checked')?.value ||
      signupForm.querySelector('input[name="signup-role"]')?.value ||
      "staff";

    if (!name) {
      setSignupError("Please enter your name.");
      return;
    }
    if (password.length < 4) {
      setSignupError("Password needs at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setSignupError("Passwords do not match. Type the same password twice.");
      return;
    }

    signupSubmit.classList.add("is-loading");
    signupSubmit.textContent = "Creating…";
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, confirm, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create account");
      currentUser = data.user;
      saveSession(currentUser);
      localStorage.setItem("shiftboard-last-name", name);
      showApp();
      if (isLead(currentUser)) {
        showToast("Account ready — now make the schedule");
        showView("manage");
      } else {
        showToast("Account created — wait for your shifts");
      }
    } catch (err) {
      setSignupError(err.message || "Could not create account");
    } finally {
      signupSubmit.classList.remove("is-loading");
      signupSubmit.textContent = "Create account";
    }
  });

  document.getElementById("sign-out-btn").addEventListener("click", () => {
    showLogin();
    showToast("Signed out");
  });

  document.querySelectorAll(".tabbar [data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.nav));
  });

  shiftForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("shift-id").value.trim();
    const dates = [...selectedDays].sort();
    const people = [...selectedPeople];
    const base = {
      start: document.getElementById("shift-start").value,
      end: document.getElementById("shift-end").value,
      area: document.getElementById("shift-area").value.trim(),
      notes: document.getElementById("shift-notes").value.trim(),
    };
    if (!people.length || !base.start || !base.end) {
      showToast("Please choose people and times.");
      return;
    }
    if (!dates.length) {
      showToast("Tap one or more days.");
      return;
    }

    const submitBtn = document.getElementById("shift-submit");
    submitBtn.disabled = true;
    try {
      if (id) {
        const res = await fetch(`/api/shifts/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ ...base, userId: people[0], date: dates[0] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not save shift");
        showToast("Shift updated");
      } else {
        let saved = 0;
        for (const userId of people) {
          for (const date of dates) {
            const res = await fetch("/api/shifts", {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ ...base, userId, date }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not save shift");
            saved += 1;
          }
        }
        showToast(saved === 1 ? "Shift saved" : `${saved} shifts saved`);
      }
      resetShiftForm();
      await loadUsersForForms();
      await loadManageShifts();
    } catch (err) {
      showToast(err.message || "Could not save");
    } finally {
      submitBtn.disabled = false;
      updateShiftSubmitLabel();
    }
  });

  document.getElementById("shift-cancel").addEventListener("click", () => {
    resetShiftForm();
  });

  manageShifts.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.closest("[data-delete-shift]")) {
      if (!window.confirm("Remove this shift?")) return;
      try {
        const res = await fetch(`/api/shifts/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not remove");
        showToast("Shift removed");
        await loadManageShifts();
      } catch (err) {
        showToast(err.message || "Could not remove");
      }
      return;
    }

    if (e.target.closest("[data-edit-shift]")) {
      try {
        const { from, to } = weekBoundsFrom(new Date());
        const shifts = await fetchShiftsRange({ from, to });
        const shift = shifts.find((s) => s.id === id);
        if (!shift) {
          showToast("Shift not found");
          return;
        }
        document.getElementById("shift-id").value = shift.id;
        shiftUser.value = shift.userId;
        selectedPeople = new Set([shift.userId]);
        renderPersonChips();
        setSelectedDays([shift.date]);
        document.getElementById("shift-start").value = shift.start;
        document.getElementById("shift-end").value = shift.end;
        document.getElementById("shift-area").value = shift.area || "";
        document.getElementById("shift-notes").value = shift.notes || "";
        document.getElementById("shift-submit").textContent = "Update shift";
        document.getElementById("shift-cancel").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        showToast(err.message || "Could not edit");
      }
    }
  });

  peopleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("people-name").value.trim();
    const password = document.getElementById("people-password").value.trim();
    const role = document.getElementById("people-role").value;
    if (!name || password.length < 4) {
      showToast("Name and password (4+ characters) are required.");
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add person");
      peopleForm.reset();
      document.getElementById("people-role").value = "staff";
      showToast(`Added ${data.user.name}`);
      await loadPeople();
      await loadStaffNames();
    } catch (err) {
      showToast(err.message || "Could not add");
    }
  });

  peopleList.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.closest("[data-reset-pin]")) {
      const password = window.prompt("New password (at least 4 characters):");
      if (password === null) return;
      if (String(password).trim().length < 4) {
        showToast("Password must be at least 4 characters.");
        return;
      }
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ password: String(password).trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not update");
        showToast("Password updated");
        await loadPasswordHelp();
      } catch (err) {
        showToast(err.message || "Could not update");
      }
      return;
    }

    if (e.target.closest("[data-remove-person]")) {
      if (!window.confirm("Remove this person and their shifts?")) return;
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not remove");
        showToast("Person removed");
        await loadPeople();
        await loadStaffNames();
      } catch (err) {
        showToast(err.message || "Could not remove");
      }
    }
  });

  document.getElementById("ask-off-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("ask-off-date")?.value;
    const reason = document.getElementById("ask-off-reason")?.value.trim();
    if (!date) {
      showToast("Pick a day first.");
      return;
    }
    try {
      const res = await fetch("/api/off-requests", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ date, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not ask");
      document.getElementById("ask-off-reason").value = "";
      showToast(data.message || "Asked your manager.");
      await loadMyOffRequests();
    } catch (err) {
      showToast(err.message || "Could not ask");
    }
  });

  document.getElementById("pending-requests")?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-request-id]");
    if (!card) return;
    const id = card.dataset.requestId;
    const approve = e.target.closest("[data-approve-off]");
    const deny = e.target.closest("[data-deny-off]");
    if (!approve && !deny) return;
    const action = approve ? "approve" : "deny";
    try {
      const res = await fetch(`/api/off-requests/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      showToast(data.message || "Saved");
      await loadPendingRequests();
      await loadOffDays();
      await loadManageShifts();
    } catch (err) {
      showToast(err.message || "Could not save");
    }
  });

  document.getElementById("open-time-presets")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-start]");
    if (!chip) return;
    document.getElementById("open-start").value = chip.dataset.start;
    document.getElementById("open-end").value = chip.dataset.end;
  });

  document.getElementById("open-shift-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("open-date")?.value;
    const start = document.getElementById("open-start")?.value;
    const end = document.getElementById("open-end")?.value;
    const needed = document.getElementById("open-needed")?.value;
    const area = document.getElementById("open-area")?.value.trim();
    const notes = document.getElementById("open-notes")?.value.trim();
    if (!date || !start || !end) {
      showToast("Pick a day and times.");
      return;
    }
    try {
      const res = await fetch("/api/open-shifts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ date, start, end, needed, area, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not post");
      document.getElementById("open-notes").value = "";
      showToast(data.message || "Posted extra shift");
      await loadOpenShiftsManage();
    } catch (err) {
      showToast(err.message || "Could not post");
    }
  });

  document.getElementById("open-shift-list")?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-open-id]");
    if (!card) return;
    if (!e.target.closest("[data-cancel-open]")) return;
    if (!window.confirm("Remove this extra shift?")) return;
    try {
      const res = await fetch(`/api/open-shifts/${encodeURIComponent(card.dataset.openId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      showToast("Extra shift removed");
      await loadOpenShiftsManage();
    } catch (err) {
      showToast(err.message || "Could not remove");
    }
  });

  document.getElementById("open-shifts-board")?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-open-id]");
    if (!card) return;
    if (!e.target.closest("[data-claim-open]")) return;
    try {
      const res = await fetch(`/api/open-shifts/${encodeURIComponent(card.dataset.openId)}/claim`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not take it");
      showToast(data.message || "You got it");
      await loadStaffExtras();
      await loadMySchedule();
    } catch (err) {
      showToast(err.message || "Could not take it");
    }
  });

  const aiThread = document.getElementById("ai-thread");
  const aiForm = document.getElementById("ai-form");
  const aiInput = document.getElementById("ai-input");
  const aiSend = document.getElementById("ai-send");
  let aiHistory = [];
  let aiReady = false;

  function aiBubble(role, text, pending = false) {
    if (!aiThread) return null;
    const el = document.createElement("div");
    el.className = `ai-bubble is-${role}${pending ? " is-pending" : ""}`;
    el.textContent = text;
    aiThread.appendChild(el);
    aiThread.scrollTop = aiThread.scrollHeight;
    return el;
  }

  function setupAiChat() {
    if (!aiThread || aiReady) return;
    aiReady = true;
    aiThread.innerHTML = "";
    aiBubble("ai", t("ai.hello"));
  }

  let aiPendingConfirm = "";

  async function sendAiMessage(text, options = {}) {
    const message = String(text || "").trim();
    const confirm = Boolean(options.confirm);
    if (!message) return;
    if (!currentUser) {
      showToast("Sign in first");
      return;
    }
    if (!isLead()) {
      showToast("Ask AI is for Jash and Cathy");
      return;
    }
    setupAiChat();
    if (!options.silent) {
      aiBubble("user", message);
      aiHistory.push({ role: "user", content: message });
      if (aiInput) aiInput.value = "";
    }
    const pending = aiBubble("ai", "Working on it…", true);
    if (aiSend) {
      aiSend.disabled = true;
      aiSend.classList.add("is-loading");
    }
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message, history: aiHistory.slice(-8), confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not ask");
      const reply = data.reply || "Done.";
      if (pending) {
        pending.textContent = reply;
        pending.classList.remove("is-pending");
      } else {
        aiBubble("ai", reply);
      }
      aiHistory.push({ role: "assistant", content: reply });
      if (data.needsConfirm) {
        aiPendingConfirm = message;
        const row = document.createElement("div");
        row.className = "ai-confirm";
        row.innerHTML = `<button type="button" class="btn btn-primary" data-ai-yes>${escapeHtml(t("ai.yes"))}</button>
          <button type="button" class="btn btn-ghost" data-ai-no>${escapeHtml(t("ai.no"))}</button>`;
        aiThread?.appendChild(row);
      } else {
        aiPendingConfirm = "";
      }
      if (data.changed) {
        showToast("Schedule updated");
        loadManageShifts();
        loadTeamSchedule();
        loadTodayBoard();
        loadOffDays();
      }
    } catch (err) {
      const fail = err.message || "Could not ask right now.";
      if (pending) {
        pending.textContent = fail;
        pending.classList.remove("is-pending");
      }
      showToast(fail);
    } finally {
      if (aiSend) {
        aiSend.disabled = false;
        aiSend.classList.remove("is-loading");
      }
      if (aiThread) aiThread.scrollTop = aiThread.scrollHeight;
    }
  }

  aiForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendAiMessage(aiInput?.value);
  });

  aiInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiMessage(aiInput.value);
    }
  });

  document.getElementById("ai-suggestions")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-ai-prompt]");
    if (!chip) return;
    sendAiMessage(chip.dataset.aiPrompt);
  });

  aiThread?.addEventListener("click", (e) => {
    if (e.target.closest("[data-ai-yes]") && aiPendingConfirm) {
      e.target.closest(".ai-confirm")?.remove();
      sendAiMessage(aiPendingConfirm, { confirm: true, silent: true });
      return;
    }
    if (e.target.closest("[data-ai-no]")) {
      e.target.closest(".ai-confirm")?.remove();
      aiPendingConfirm = "";
      aiBubble("ai", "Okay, I didn’t change the schedule.");
    }
  });

  function isStandaloneApp() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  let deferredInstall = null;

  function syncHomeCards() {
    const hidden = isStandaloneApp() || localStorage.getItem("shiftboard-hide-home") === "1";
    const ios = isIosDevice();
    document.querySelectorAll(".js-home-help").forEach((el) => {
      el.textContent = t(ios ? "home.ios" : "home.android");
    });
    document.querySelectorAll(".js-home-card").forEach((card) => {
      card.hidden = hidden;
    });
    document.querySelectorAll(".js-home-install").forEach((btn) => {
      btn.hidden = ios || !deferredInstall;
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    syncHomeCards();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    localStorage.setItem("shiftboard-hide-home", "1");
    syncHomeCards();
    showToast(t("home.added"));
  });

  document.querySelectorAll(".js-home-dismiss").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.setItem("shiftboard-hide-home", "1");
      syncHomeCards();
    });
  });
  document.querySelectorAll(".js-home-install").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice.catch(() => {});
      deferredInstall = null;
      syncHomeCards();
    });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    fetch("/api/health", { cache: "no-store" }).catch(() => {});
  }, 8 * 60 * 1000);

  async function boot() {
    const saved = savedSession();
    if (!saved?.id) {
      showLogin();
      return;
    }
    try {
      const res = await fetch("/api/me", {
        headers: { "X-User-Id": saved.id },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error("session");
      currentUser = data.user;
      saveSession(currentUser);
      showApp();
    } catch {
      showLogin();
    }
  }

  resetShiftForm();
  applyI18n();
  syncHomeCards();
  boot();
})();
