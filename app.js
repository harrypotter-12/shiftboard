(() => {
  const LINEN_CATALOG = [
    { key: "face-cloths", label: "Face cloths" },
    { key: "hand-towels", label: "Hand towels" },
    { key: "bath-towels", label: "Bath towels" },
    { key: "bath-mats", label: "Bath mats" },
    { key: "double-sheets", label: "Double sheets" },
    { key: "queen-sheets", label: "Queen sheets" },
    { key: "king-sheets", label: "King sheets" },
    { key: "pillowcases", label: "Pillowcases" },
    { key: "duvet-covers", label: "Duvet covers" },
    { key: "blankets", label: "Blankets" },
  ];

  const COLUMNS = [
    { key: "needed", title: "Waiting" },
    { key: "working", title: "In laundry" },
    { key: "ready", title: "Ready" },
  ];

  const STATUS_LABELS = {
    needed: "Waiting",
    working: "In laundry",
    ready: "Ready",
    delivered: "Delivered",
  };

  const NEXT_ACTION = {
    needed: { label: "Start preparing" },
    working: { label: "Mark ready" },
    ready: { label: "Mark delivered" },
  };

  const ROLE_LABELS = {
    housekeeping: "Housekeeping",
    laundry: "Laundry",
    manager: "Manager",
  };

  const views = {
    board: document.getElementById("view-board"),
    request: document.getElementById("view-request"),
  };

  const boardColumns = document.getElementById("board-columns");
  const historyList = document.getElementById("history-list");
  const linenItemsEl = document.getElementById("linen-items");
  const requestForm = document.getElementById("request-form");
  const requestSuccess = document.getElementById("request-success");
  const toastEl = document.getElementById("toast");

  let requests = [];
  let qtyState = Object.fromEntries(LINEN_CATALOG.map((i) => [i.key, 0]));
  let selectedRoles = {};
  let addMoreQty = {}; // requestId -> { key: qty }
  let openPanels = new Set(); // request ids with open comment/add panels
  let posting = false;

  function boardBusy() {
    if (posting) return true;
    const active = document.activeElement;
    if (active && boardColumns.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
      return true;
    }
    return Boolean(boardColumns.querySelector("details[open]"));
  }

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
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatWhen(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function savedCommentName() {
    return localStorage.getItem("linenboard-comment-name") || localStorage.getItem("linenboard-name") || "";
  }

  function savedCommentRole() {
    const role = localStorage.getItem("linenboard-comment-role");
    return ROLE_LABELS[role] ? role : "housekeeping";
  }

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
      const active = key === name;
      el.classList.toggle("is-active", active);
      el.hidden = !active;
    });
    if (name === "request") resetRequestForm();
    if (name === "board") loadRequests();
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", `#${name}`);
  }

  function renderLinenPicker() {
    linenItemsEl.innerHTML = LINEN_CATALOG.map(
      (item) => `
      <div class="linen-row ${qtyState[item.key] > 0 ? "has-qty" : ""}" data-key="${item.key}">
        <strong>${item.label}</strong>
        <div class="qty-controls">
          <button type="button" class="qty-btn" data-action="dec" aria-label="Less ${item.label}">−</button>
          <span class="qty-value" data-qty>${qtyState[item.key]}</span>
          <button type="button" class="qty-btn" data-action="inc" aria-label="More ${item.label}">+</button>
          <button type="button" class="qty-btn qty-fast" data-action="add5" aria-label="Add 5 ${item.label}">+5</button>
          <button type="button" class="qty-btn qty-fast" data-action="add10" aria-label="Add 10 ${item.label}">+10</button>
        </div>
      </div>
    `
    ).join("");
  }

  function resetRequestForm() {
    requestForm.hidden = false;
    requestSuccess.hidden = true;
    requestForm.reset();
    qtyState = Object.fromEntries(LINEN_CATALOG.map((i) => [i.key, 0]));
    renderLinenPicker();
    const savedName = localStorage.getItem("linenboard-name");
    if (savedName) document.getElementById("requester-name").value = savedName;
  }

  function rememberOpenPanels() {
    boardColumns.querySelectorAll("details[data-panel]").forEach((el) => {
      const key = el.dataset.panel;
      if (!key) return;
      if (el.open) openPanels.add(key);
      else openPanels.delete(key);
    });
  }

  async function loadRequests(force = false) {
    if (!force && boardBusy()) return;
    try {
      rememberOpenPanels();
      const res = await fetch("/api/requests", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      requests = Array.isArray(data.requests) ? data.requests : [];
      renderBoard();
      renderHistory();
    } catch {
      boardColumns.innerHTML = `
        <div class="empty-state wide">
          <strong>Can't load requests</strong>
          <p>Start the site with <code>npm start</code>, then refresh.</p>
        </div>
      `;
      historyList.innerHTML = "";
    }
  }

  function ensureAddMoreState(id) {
    if (!addMoreQty[id]) {
      addMoreQty[id] = Object.fromEntries(LINEN_CATALOG.map((i) => [i.key, 0]));
    }
    return addMoreQty[id];
  }

  function addMoreHtml(r) {
    if (r.status === "delivered") return "";
    const state = ensureAddMoreState(r.id);
    const rows = LINEN_CATALOG.map(
      (item) => `
      <div class="add-row" data-add-key="${item.key}">
        <span>${item.label}</span>
        <div class="qty-controls">
          <button type="button" class="qty-btn" data-add-action="dec">−</button>
          <span class="qty-value" data-add-qty>${state[item.key]}</span>
          <button type="button" class="qty-btn" data-add-action="inc">+</button>
          <button type="button" class="qty-btn qty-fast" data-add-action="add5">+5</button>
        </div>
      </div>
    `
    ).join("");

    return `
      <details class="add-more" data-panel="add:${r.id}" ${openPanels.has(`add:${r.id}`) ? "open" : ""}>
        <summary>Add more items</summary>
        <div class="add-more-body">
          ${rows}
          <button type="button" class="btn btn-soft btn-wide" data-action="save-more">Save added items</button>
        </div>
      </details>
    `;
  }

  function commentsHtml(r) {
    const comments = Array.isArray(r.comments) ? r.comments : [];
    const role = selectedRoles[r.id] || localStorage.getItem("linenboard-comment-role") || "laundry";
    const isOpen = openPanels.has(`comment:${r.id}`);
    const count = comments.length + (r.laundryNotes ? 1 : 0);

    const existing =
      comments.length === 0 && !r.laundryNotes
        ? ""
        : `
        <div class="comment-thread">
          ${
            r.laundryNotes
              ? `<div class="comment role-laundry">
                  <div class="comment-meta">
                    <span class="role-tag role-laundry">Laundry</span>
                    <strong>Stock note</strong>
                  </div>
                  <p>${escapeHtml(r.laundryNotes)}</p>
                </div>`
              : ""
          }
          ${comments
            .map(
              (c) => `
            <div class="comment role-${escapeHtml(c.role)}">
              <div class="comment-meta">
                <span class="role-tag role-${escapeHtml(c.role)}">${ROLE_LABELS[c.role] || c.role}</span>
                <strong>${escapeHtml(c.name)}</strong>
              </div>
              <p>${escapeHtml(c.text)}</p>
            </div>
          `
            )
            .join("")}
        </div>
      `;

    return `
      <div class="comments">
        ${existing}
        <details class="comment-later" data-panel="comment:${r.id}" ${isOpen ? "open" : ""}>
          <summary>Add comment later${count ? ` (${count})` : ""}</summary>
          <div class="comment-later-body">
            <label class="field compact">
              <span>Who are you?</span>
              <select class="comment-role">
                ${Object.entries(ROLE_LABELS)
                  .map(
                    ([key, label]) =>
                      `<option value="${key}" ${role === key ? "selected" : ""}>${label}</option>`
                  )
                  .join("")}
              </select>
            </label>
            <label class="field compact">
              <span>Your name</span>
              <input class="comment-name" type="text" placeholder="Your name" value="${escapeHtml(savedCommentName())}" />
            </label>
            <label class="field compact">
              <span>Comment</span>
              <input class="comment-text" type="text" placeholder="e.g. No king sheets until later" />
            </label>
            <button type="button" class="btn btn-soft btn-wide" data-action="post-comment">Post comment</button>
            <label class="field compact">
              <span>Laundry stock note</span>
              <input
                type="text"
                class="laundry-note-input"
                value="${escapeHtml(r.laundryNotes || "")}"
                placeholder="e.g. Short on face cloths"
              />
            </label>
            <button type="button" class="btn btn-soft btn-wide" data-action="save-laundry-note">Save stock note</button>
          </div>
        </details>
      </div>
    `;
  }

  function cardHtml(r) {
    const items = r.items
      .map((i) => `<li><b>${i.qty}</b> ${escapeHtml(i.label)}</li>`)
      .join("");
    const action = NEXT_ACTION[r.status];
    return `
      <article class="request-card ${r.priority === "urgent" ? "is-urgent" : ""}" data-id="${r.id}">
        ${r.priority === "urgent" ? `<div class="urgent-flag">Urgent</div>` : ""}
        <h3>${escapeHtml(r.area)}</h3>
        <p class="area">Asked by ${escapeHtml(r.name)}</p>
        <ul class="item-list">${items}</ul>
        ${r.notes ? `<p class="note"><strong>Note:</strong> ${escapeHtml(r.notes)}</p>` : ""}
        ${addMoreHtml(r)}
        ${commentsHtml(r)}
        ${
          action
            ? `<button type="button" class="btn btn-action" data-action="advance">${action.label}</button>`
            : ""
        }
      </article>
    `;
  }

  function renderBoard() {
    const open = requests.filter((r) => r.status !== "delivered");
    if (!open.length && !requests.length) {
      boardColumns.innerHTML = `
        <div class="empty-state wide">
          <strong>No requests yet</strong>
          <p>Tap <b>I need linens</b> to start.</p>
        </div>
      `;
      return;
    }

    boardColumns.innerHTML = COLUMNS.map((col) => {
      const list = open
        .filter((r) => r.status === col.key)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
          return a.createdAt - b.createdAt;
        });

      return `
        <section class="column" data-status="${col.key}">
          <header class="column-head">
            <h2>${col.title}</h2>
            <span class="count">${list.length}</span>
          </header>
          <div class="column-list">
            ${list.length ? list.map(cardHtml).join("") : `<p class="column-empty">None</p>`}
          </div>
        </section>
      `;
    }).join("");
  }

  function renderHistory() {
    const done = requests
      .filter((r) => r.status === "delivered")
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (!done.length) {
      historyList.innerHTML = `<div class="empty-state">No finished floors or rooms yet.</div>`;
      return;
    }

    historyList.innerHTML = done
      .map((r) => {
        const items = r.items.map((i) => `${i.qty} ${i.label}`).join(" · ");
        const comments = Array.isArray(r.comments) ? r.comments : [];
        const lastComments = comments
          .slice(-3)
          .map(
            (c) => `
            <div class="history-comment">
              <span class="role-tag role-${escapeHtml(c.role)}">${ROLE_LABELS[c.role] || c.role}</span>
              <strong>${escapeHtml(c.name)}:</strong> ${escapeHtml(c.text)}
            </div>
          `
          )
          .join("");

        return `
          <article class="history-card">
            <div class="history-top">
              <div>
                <h3>${escapeHtml(r.area)}</h3>
                <p class="area">Done for ${escapeHtml(r.name)}</p>
              </div>
              <time>${formatWhen(r.updatedAt || r.createdAt)}</time>
            </div>
            <p class="history-items">${escapeHtml(items)}</p>
            ${r.notes ? `<p class="note"><strong>Note:</strong> ${escapeHtml(r.notes)}</p>` : ""}
            ${r.laundryNotes ? `<p class="note laundry"><strong>Laundry:</strong> ${escapeHtml(r.laundryNotes)}</p>` : ""}
            ${lastComments ? `<div class="history-comments">${lastComments}</div>` : ""}
          </article>
        `;
      })
      .join("");
  }

  async function createRequest(payload) {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not send");
    return data.request;
  }

  async function advanceRequest(id) {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not update");
    return data.request;
  }

  async function saveLaundryNote(id, laundryNotes) {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ laundryNotes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save note");
    return data.request;
  }

  async function addItems(id, payload) {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add items");
    return data.request;
  }

  async function postComment(id, payload) {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not post comment");
    return data.request;
  }

  async function clearRequests(scope) {
    const res = await fetch("/api/requests/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not clear");
    return data;
  }

  document.getElementById("goto-request").addEventListener("click", () => showView("request"));
  document.getElementById("back-to-board").addEventListener("click", () => showView("board"));
  document.getElementById("success-back").addEventListener("click", () => showView("board"));
  document.getElementById("another-request").addEventListener("click", () => resetRequestForm());

  document.getElementById("clear-history").addEventListener("click", async () => {
    const ok = window.confirm("Clear all finished floors and rooms from history?");
    if (!ok) return;
    try {
      const result = await clearRequests("history");
      showToast(result.cleared ? `Cleared ${result.cleared} from history` : "History already empty");
      await loadRequests();
    } catch (err) {
      showToast(err.message || "Could not clear");
    }
  });

  document.getElementById("clear-all").addEventListener("click", async () => {
    const ok = window.confirm("Clear EVERYTHING — open requests and history?");
    if (!ok) return;
    try {
      const result = await clearRequests("all");
      showToast(result.cleared ? `Cleared ${result.cleared} requests` : "Board already empty");
      await loadRequests();
    } catch (err) {
      showToast(err.message || "Could not clear");
    }
  });

  linenItemsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const row = btn.closest(".linen-row");
    const key = row.dataset.key;
    if (btn.dataset.action === "inc") qtyState[key] += 1;
    if (btn.dataset.action === "dec") qtyState[key] = Math.max(0, qtyState[key] - 1);
    if (btn.dataset.action === "add5") qtyState[key] += 5;
    if (btn.dataset.action === "add10") qtyState[key] += 10;
    row.querySelector("[data-qty]").textContent = qtyState[key];
    row.classList.toggle("has-qty", qtyState[key] > 0);
  });

  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("requester-name").value.trim();
    const area = document.getElementById("floor-area").value.trim();
    const notes = document.getElementById("notes").value.trim();
    const priority = document.getElementById("priority-urgent").checked ? "urgent" : "normal";
    const items = LINEN_CATALOG.map((item) => ({
      key: item.key,
      label: item.label,
      qty: qtyState[item.key],
    })).filter((i) => i.qty > 0);

    if (!name || !area) {
      showToast("Please add your name and floor/room.");
      return;
    }
    if (!items.length) {
      showToast("Add at least one item with +");
      return;
    }

    try {
      localStorage.setItem("linenboard-name", name);
      await createRequest({ name, area, notes, priority, items });
      requestForm.hidden = true;
      requestSuccess.hidden = false;
      showToast("Request sent");
    } catch (err) {
      showToast(err.message || "Could not send");
    }
  });

  boardColumns.addEventListener("toggle", (e) => {
    const details = e.target.closest("details[data-panel]");
    if (!details || !boardColumns.contains(details)) return;
    const key = details.dataset.panel;
    if (details.open) openPanels.add(key);
    else openPanels.delete(key);
  }, true);

  boardColumns.addEventListener("click", async (e) => {
    const addBtn = e.target.closest("[data-add-action]");
    if (addBtn) {
      const card = addBtn.closest(".request-card");
      const row = addBtn.closest(".add-row");
      if (!card || !row) return;
      const id = card.dataset.id;
      const key = row.dataset.addKey;
      const state = ensureAddMoreState(id);
      if (addBtn.dataset.addAction === "inc") state[key] += 1;
      if (addBtn.dataset.addAction === "dec") state[key] = Math.max(0, state[key] - 1);
      if (addBtn.dataset.addAction === "add5") state[key] += 5;
      row.querySelector("[data-add-qty]").textContent = state[key];
      return;
    }

    const saveMore = e.target.closest("[data-action='save-more']");
    if (saveMore) {
      const card = saveMore.closest(".request-card");
      if (!card) return;
      const id = card.dataset.id;
      const state = ensureAddMoreState(id);
      const items = LINEN_CATALOG.map((item) => ({
        key: item.key,
        label: item.label,
        qty: state[item.key] || 0,
      })).filter((i) => i.qty > 0);

      if (!items.length) {
        showToast("Pick items to add first.");
        return;
      }

      saveMore.disabled = true;
      posting = true;
      try {
        await addItems(id, {
          items,
          name: savedCommentName() || "Staff",
          role: selectedRoles[id] || savedCommentRole(),
        });
        addMoreQty[id] = Object.fromEntries(LINEN_CATALOG.map((i) => [i.key, 0]));
        showToast("Items added");
        await loadRequests(true);
      } catch (err) {
        showToast(err.message || "Could not add");
        saveMore.disabled = false;
      } finally {
        posting = false;
      }
      return;
    }

    const postCommentBtn = e.target.closest("[data-action='post-comment']");
    if (postCommentBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = postCommentBtn.closest(".request-card");
      if (!card) return;
      const id = card.dataset.id;
      const panel = card.querySelector(".comment-later-body");
      if (!panel) return;
      const name = panel.querySelector(".comment-name")?.value.trim() || "";
      const text = panel.querySelector(".comment-text")?.value.trim() || "";
      const role = panel.querySelector(".comment-role")?.value || "laundry";

      if (!name || !text) {
        showToast("Add your name and a comment.");
        return;
      }

      postCommentBtn.disabled = true;
      posting = true;
      try {
        selectedRoles[id] = role;
        localStorage.setItem("linenboard-comment-name", name);
        localStorage.setItem("linenboard-comment-role", role);
        openPanels.add(`comment:${id}`);
        await postComment(id, { role, name, text });
        showToast("Comment posted");
        await loadRequests(true);
      } catch (err) {
        console.error(err);
        showToast(err.message || "Could not post");
        postCommentBtn.disabled = false;
      } finally {
        posting = false;
      }
      return;
    }

    const saveNoteBtn = e.target.closest("[data-action='save-laundry-note']");
    if (saveNoteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = saveNoteBtn.closest(".request-card");
      if (!card) return;
      const id = card.dataset.id;
      const value = card.querySelector(".laundry-note-input")?.value.trim() || "";
      saveNoteBtn.disabled = true;
      posting = true;
      try {
        openPanels.add(`comment:${id}`);
        await saveLaundryNote(id, value);
        showToast("Stock note saved");
        await loadRequests(true);
      } catch (err) {
        console.error(err);
        showToast(err.message || "Could not save");
        saveNoteBtn.disabled = false;
      } finally {
        posting = false;
      }
      return;
    }

    const btn = e.target.closest("[data-action='advance']");
    if (!btn) return;
    const card = btn.closest(".request-card");
    if (!card) return;
    btn.disabled = true;
    try {
      const updated = await advanceRequest(card.dataset.id);
      showToast(STATUS_LABELS[updated.status]);
      await loadRequests(true);
    } catch (err) {
      showToast(err.message || "Update failed");
      btn.disabled = false;
    }
  });

  renderLinenPicker();
  const hash = (location.hash || "#board").replace("#", "");
  showView(views[hash] ? hash : "board");
  setInterval(() => {
    if (!views.board.hidden && !boardBusy()) loadRequests();
  }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !views.board.hidden && !boardBusy()) loadRequests();
  });
})();
