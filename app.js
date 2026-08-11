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

  const LINEN_PACKS = {
    towels: { "face-cloths": 12, "hand-towels": 12, "bath-towels": 12, "bath-mats": 6 },
    queen: { "queen-sheets": 4, pillowcases: 8, "duvet-covers": 2 },
    king: { "king-sheets": 4, pillowcases: 8, "duvet-covers": 2 },
    suite: {
      "king-sheets": 2,
      pillowcases: 4,
      "bath-towels": 6,
      "hand-towels": 6,
      "face-cloths": 6,
      "bath-mats": 2,
    },
  };

  const CART_CATALOG = [
    { key: "toilet-paper", label: "Toilet paper" },
    { key: "facial-tissue", label: "Facial tissue" },
    { key: "soap", label: "Bar soap" },
    { key: "shampoo", label: "Shampoo" },
    { key: "conditioner", label: "Conditioner" },
    { key: "lotion", label: "Body lotion" },
    { key: "shower-cap", label: "Shower caps" },
    { key: "trash-bags", label: "Trash bags" },
    { key: "laundry-bags", label: "Laundry bags" },
    { key: "glasses", label: "Glasses / cups" },
    { key: "coffee", label: "Coffee / tea" },
    { key: "notepads", label: "Notepads / pens" },
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

  const CART_LABELS = {
    needed: "Needs fill",
    filling: "Filling",
    done: "Done",
  };

  const NEXT_ACTION = {
    needed: { label: "Start preparing" },
    working: { label: "Mark ready" },
    ready: { label: "Mark delivered" },
  };

  const CART_NEXT = {
    needed: { label: "Start filling" },
    filling: { label: "Mark done" },
  };

  const ROLE_LABELS = {
    housekeeping: "Housekeeping",
    laundry: "Laundry",
    manager: "Manager",
  };

  const sections = {
    laundry: document.getElementById("view-laundry"),
    cart: document.getElementById("view-cart"),
    checklist: document.getElementById("view-checklist"),
  };

  const subviews = {
    board: document.getElementById("sub-board"),
    request: document.getElementById("sub-request"),
    history: document.getElementById("sub-history"),
  };

  const boardColumns = document.getElementById("board-columns");
  const historyList = document.getElementById("history-list");
  const statsBar = document.getElementById("stats-bar");
  const liveStatus = document.getElementById("live-status");
  const linenItemsEl = document.getElementById("linen-items");
  const cartItemsEl = document.getElementById("cart-items");
  const cartList = document.getElementById("cart-list");
  const checklistList = document.getElementById("checklist-list");
  const requestForm = document.getElementById("request-form");
  const requestSuccess = document.getElementById("request-success");
  const cartForm = document.getElementById("cart-form");
  const checklistForm = document.getElementById("checklist-form");
  const toastEl = document.getElementById("toast");
  const sectionLabel = document.getElementById("section-label");
  const badgeLaundry = document.getElementById("badge-laundry");
  const badgeCart = document.getElementById("badge-cart");
  const badgeChecklist = document.getElementById("badge-checklist");
  const roleGate = document.getElementById("role-gate");
  const staffChip = document.getElementById("staff-chip");
  const boardUpdated = document.getElementById("board-updated");

  const SECTION_LABELS = {
    laundry: "Laundry board",
    cart: "Cart fill",
    checklist: "Team checklist",
  };

  let requests = [];
  let cartOrders = [];
  let checklistItems = [];
  let currentSection = "laundry";
  let currentSub = "board";
  const linenState = { qty: Object.fromEntries(LINEN_CATALOG.map((i) => [i.key, 0])) };
  const cartState = { qty: Object.fromEntries(CART_CATALOG.map((i) => [i.key, 0])) };
  let selectedRoles = {};
  let addMoreQty = {};
  let openPanels = new Set();
  let posting = false;
  let lastOpenLaundryCount = null;
  let gateRole = localStorage.getItem("linenboard-comment-role") || "";

  function boardBusy() {
    if (posting) return true;
    const active = document.activeElement;
    if (active && boardColumns.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
      return true;
    }
    return Boolean(boardColumns.querySelector("details.ticket-panel[open]"));
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

  function formatAgo(ts) {
    const diff = Date.now() - Number(ts || 0);
    if (!Number.isFinite(diff) || diff < 0) return formatWhen(ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return formatWhen(ts);
  }

  function staffProfile() {
    return {
      name: localStorage.getItem("linenboard-name") || "",
      role: localStorage.getItem("linenboard-comment-role") || "",
    };
  }

  function updateStaffChip() {
    const { name, role } = staffProfile();
    if (!staffChip) return;
    if (name && ROLE_LABELS[role]) {
      staffChip.textContent = `${name.split(" ")[0]} · ${ROLE_LABELS[role]}`;
      document.body.dataset.role = role;
    } else {
      staffChip.textContent = "Set profile";
      delete document.body.dataset.role;
    }
  }

  function openRoleGate(force = false) {
    const { name, role } = staffProfile();
    if (!force && name && ROLE_LABELS[role]) {
      roleGate.hidden = true;
      updateStaffChip();
      return;
    }
    roleGate.hidden = false;
    document.getElementById("gate-name").value = name || "";
    gateRole = ROLE_LABELS[role] ? role : "";
    document.querySelectorAll(".role-choice").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.role === gateRole);
    });
  }

  function applyLinenPack(packKey) {
    const pack = LINEN_PACKS[packKey];
    if (!pack) return;
    Object.entries(pack).forEach(([key, qty]) => {
      linenState.qty[key] = (linenState.qty[key] || 0) + qty;
    });
    renderPicker(linenItemsEl, LINEN_CATALOG, linenState.qty);
    showToast("Pack added — adjust if needed");
  }

  function maybeAlertNewOrders(openCount) {
    if (lastOpenLaundryCount === null) {
      lastOpenLaundryCount = openCount;
      return;
    }
    if (openCount > lastOpenLaundryCount) {
      const added = openCount - lastOpenLaundryCount;
      showToast(added === 1 ? "New linen order on the board" : `${added} new linen orders`);
      document.querySelector('.tab[data-nav="laundry"]')?.classList.add("is-alert");
      clearTimeout(maybeAlertNewOrders._timer);
      maybeAlertNewOrders._timer = setTimeout(() => {
        document.querySelector('.tab[data-nav="laundry"]')?.classList.remove("is-alert");
      }, 4000);
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 880;
          gain.gain.value = 0.04;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        }
      } catch {
        /* ignore audio errors */
      }
    }
    lastOpenLaundryCount = openCount;
  }

  function orderCode(id) {
    return `LB-${String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  }

  function savedCommentName() {
    return localStorage.getItem("linenboard-comment-name") || localStorage.getItem("linenboard-name") || "";
  }

  function savedCommentRole() {
    const role = localStorage.getItem("linenboard-comment-role");
    return ROLE_LABELS[role] ? role : "housekeeping";
  }

  function setBadge(el, count) {
    if (!el) return;
    if (count > 0) {
      el.hidden = false;
      el.textContent = count > 99 ? "99+" : String(count);
    } else {
      el.hidden = true;
    }
  }

  function updateBadges() {
    const openLaundry = requests.filter((r) => r.status !== "delivered").length;
    const openCart = cartOrders.filter((o) => o.status !== "done").length;
    const openTasks = checklistItems.filter((i) => !i.done).length;
    setBadge(badgeLaundry, openLaundry);
    setBadge(badgeCart, openCart);
    setBadge(badgeChecklist, openTasks);
  }

  function showSection(name) {
    currentSection = name;
    Object.entries(sections).forEach(([key, el]) => {
      if (!el) return;
      const active = key === name;
      el.classList.toggle("is-active", active);
      el.hidden = !active;
    });
    document.querySelectorAll(".tabbar .tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.nav === name);
    });
    document.body.dataset.section = name;
    if (sectionLabel) sectionLabel.textContent = SECTION_LABELS[name] || "LinenBoard";
    if (name === "laundry") {
      showSub(currentSub === "request" ? "board" : currentSub, false);
      loadRequests(true);
    }
    if (name === "cart") loadCart(true);
    if (name === "checklist") loadChecklist(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", `#${name}`);
  }

  function showSub(name, resetForm = true) {
    currentSub = name;
    Object.entries(subviews).forEach(([key, el]) => {
      if (!el) return;
      const active = key === name;
      el.classList.toggle("is-active", active);
      el.hidden = !active;
    });
    document.querySelectorAll(".section-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.sub === name);
    });
    if (name === "request" && resetForm) resetRequestForm();
    if (name === "board" || name === "history") loadRequests(true);
    if (name === "request" && sectionLabel) sectionLabel.textContent = "New linen order";
    if (name === "board" && sectionLabel) sectionLabel.textContent = "Laundry board";
    if (name === "history" && sectionLabel) sectionLabel.textContent = "Completed orders";
  }

  function renderPicker(el, catalog, state) {
    el.innerHTML = catalog
      .map(
        (item) => `
      <div class="linen-row ${state[item.key] > 0 ? "has-qty" : ""}" data-key="${item.key}">
        <strong>${item.label}</strong>
        <div class="qty-controls">
          <button type="button" class="qty-btn" data-action="dec" aria-label="Less ${item.label}">−</button>
          <span class="qty-value" data-qty>${state[item.key]}</span>
          <button type="button" class="qty-btn" data-action="inc" aria-label="More ${item.label}">+</button>
          <button type="button" class="qty-btn qty-fast" data-action="add5" aria-label="Add 5 ${item.label}">+5</button>
        </div>
      </div>
    `
      )
      .join("");
  }

  function bindPicker(el, stateRef) {
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest(".linen-row");
      const key = row.dataset.key;
      const state = stateRef.qty;
      if (btn.dataset.action === "inc") state[key] += 1;
      if (btn.dataset.action === "dec") state[key] = Math.max(0, state[key] - 1);
      if (btn.dataset.action === "add5") state[key] += 5;
      if (btn.dataset.action === "add10") state[key] += 10;
      row.querySelector("[data-qty]").textContent = state[key];
      row.classList.toggle("has-qty", state[key] > 0);
    });
  }

  function resetRequestForm() {
    requestForm.hidden = false;
    requestSuccess.hidden = true;
    requestForm.reset();
    linenState.qty = Object.fromEntries(LINEN_CATALOG.map((i) => [i.key, 0]));
    renderPicker(linenItemsEl, LINEN_CATALOG, linenState.qty);
    const savedName = localStorage.getItem("linenboard-name");
    if (savedName) document.getElementById("requester-name").value = savedName;
  }

  function resetCartForm() {
    cartForm.reset();
    cartState.qty = Object.fromEntries(CART_CATALOG.map((i) => [i.key, 0]));
    renderPicker(cartItemsEl, CART_CATALOG, cartState.qty);
    const savedName = localStorage.getItem("linenboard-name");
    if (savedName) document.getElementById("cart-name").value = savedName;
  }

  function renderStats() {
    const open = requests.filter((r) => r.status !== "delivered");
    const waiting = open.filter((r) => r.status === "needed").length;
    const laundry = open.filter((r) => r.status === "working").length;
    const ready = open.filter((r) => r.status === "ready").length;
    const urgent = open.filter((r) => r.priority === "urgent").length;
    statsBar.innerHTML = `
      <div class="stat tone-wait"><strong>${waiting}</strong><span>Waiting</span></div>
      <div class="stat tone-work"><strong>${laundry}</strong><span>In laundry</span></div>
      <div class="stat tone-ready"><strong>${ready}</strong><span>Ready</span></div>
      <div class="stat ${urgent ? "is-urgent" : ""}"><strong>${urgent}</strong><span>Urgent</span></div>
    `;
    if (boardUpdated) boardUpdated.textContent = `Updated ${formatAgo(Date.now())}`;
    maybeAlertNewOrders(open.length);
    updateBadges();
  }

  function rememberOpenPanels() {
    boardColumns.querySelectorAll("details[data-panel]").forEach((el) => {
      const key = el.dataset.panel;
      if (!key) return;
      if (el.open) openPanels.add(key);
      else openPanels.delete(key);
    });
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
      <details class="ticket-panel" data-panel="add:${r.id}" ${openPanels.has(`add:${r.id}`) ? "open" : ""}>
        <summary>Add items</summary>
        <div class="add-more-body">
          ${rows}
          <button type="button" class="btn btn-soft btn-wide" data-action="save-more">Save items</button>
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
      <details class="ticket-panel" data-panel="comment:${r.id}" ${isOpen ? "open" : ""}>
        <summary>Notes${count ? ` · ${count}` : ""}</summary>
        <div class="comment-later-body">
          ${existing}
          <label class="field compact">
            <span>Role</span>
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
            <span>Name</span>
            <input class="comment-name" type="text" placeholder="Your name" value="${escapeHtml(savedCommentName())}" />
          </label>
          <label class="field compact">
            <span>Comment</span>
            <input class="comment-text" type="text" placeholder="Add a note" />
          </label>
          <button type="button" class="btn btn-soft btn-wide" data-action="post-comment">Post</button>
          <label class="field compact">
            <span>Laundry stock note</span>
            <input type="text" class="laundry-note-input" value="${escapeHtml(r.laundryNotes || "")}" placeholder="e.g. Short on face cloths" />
          </label>
          <button type="button" class="btn btn-soft btn-wide" data-action="save-laundry-note">Save stock note</button>
        </div>
      </details>
    `;
  }

  function cardHtml(r) {
    const chips = r.items
      .map((i) => `<span class="item-chip"><b>${i.qty}</b> ${escapeHtml(i.label)}</span>`)
      .join("");
    const action = NEXT_ACTION[r.status];
    return `
      <article class="request-card ticket ${r.priority === "urgent" ? "is-urgent" : ""}" data-id="${r.id}">
        <div class="card-top">
          <span class="order-id">${orderCode(r.id)}</span>
          <span class="ticket-meta">
            ${r.priority === "urgent" ? `<span class="urgent-flag">Urgent</span>` : ""}
            <time>${formatAgo(r.createdAt)}</time>
          </span>
        </div>
        <h3>${escapeHtml(r.area)}</h3>
        <p class="area">${escapeHtml(r.name)}</p>
        <div class="item-chips">${chips}</div>
        ${r.notes ? `<p class="note">${escapeHtml(r.notes)}</p>` : ""}
        <div class="ticket-actions">
          ${addMoreHtml(r)}
          ${commentsHtml(r)}
        </div>
        ${action ? `<button type="button" class="btn btn-action" data-action="advance">${action.label}</button>` : ""}
      </article>
    `;
  }

  function renderBoard() {
    const open = requests.filter((r) => r.status !== "delivered");
    if (!open.length) {
      boardColumns.innerHTML = `
        <div class="empty-state wide">
          <div class="empty-visual laundry-empty" aria-hidden="true"></div>
          <strong>No open linen orders</strong>
          <p>Tap the blue button to send a request to laundry.</p>
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
            ${list.length ? list.map(cardHtml).join("") : `<p class="column-empty">No orders</p>`}
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
      historyList.innerHTML = `
        <div class="empty-state">
          <strong>No completed orders</strong>
          <p>Delivered linen requests show up here.</p>
        </div>`;
      return;
    }

    historyList.innerHTML = done
      .map((r) => {
        const items = r.items.map((i) => `${i.qty} ${i.label}`).join(" · ");
        const comments = Array.isArray(r.comments) ? r.comments : [];
        return `
          <article class="history-card">
            <div class="history-top">
              <div>
                <span class="order-id">${orderCode(r.id)}</span>
                <h3>${escapeHtml(r.area)}</h3>
                <p class="area">Completed · ${escapeHtml(r.name)}</p>
              </div>
              <time>${formatWhen(r.updatedAt || r.createdAt)}</time>
            </div>
            <p class="history-items">${escapeHtml(items)}</p>
            ${
              comments.length
                ? `<div class="history-comments">${comments
                    .map(
                      (c) =>
                        `<div class="history-comment"><strong>${escapeHtml(ROLE_LABELS[c.role] || c.role)}</strong> ${escapeHtml(c.name)}: ${escapeHtml(c.text)}</div>`
                    )
                    .join("")}</div>`
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  function renderCart() {
    const open = cartOrders.filter((o) => o.status !== "done");
    const done = cartOrders.filter((o) => o.status === "done");
    updateBadges();

    if (!cartOrders.length) {
      cartList.innerHTML = `
        <div class="empty-state">
          <div class="empty-visual cart-empty" aria-hidden="true"></div>
          <strong>No cart fill requests</strong>
          <p>Tap <b>Request cart fill</b> when you need amenities.</p>
        </div>`;
      return;
    }

    const card = (o) => {
      const items = o.items.map((i) => `<li><b>${i.qty}</b> ${escapeHtml(i.label)}</li>`).join("");
      const action = CART_NEXT[o.status];
      return `
        <article class="simple-card cart-card status-${o.status}" data-id="${o.id}">
          <div class="card-top">
            <span class="status-pill">${CART_LABELS[o.status] || o.status}</span>
            <time>${formatWhen(o.createdAt)}</time>
          </div>
          <h3>${escapeHtml(o.name)}</h3>
          <ul class="item-list">${items}</ul>
          ${o.notes ? `<p class="note">${escapeHtml(o.notes)}</p>` : ""}
          ${action ? `<button type="button" class="btn btn-cart btn-wide" data-cart-advance>${action.label}</button>` : ""}
        </article>
      `;
    };

    cartList.innerHTML = `
      ${open.length ? `<div class="list-block">${open.map(card).join("")}</div>` : `<div class="empty-state tight"><strong>All carts filled</strong></div>`}
      ${
        done.length
          ? `<h2 class="list-heading">Done</h2><div class="list-block dim">${done.map(card).join("")}</div>`
          : ""
      }
    `;
  }

  function renderChecklist() {
    updateBadges();
    if (!checklistItems.length) {
      checklistList.innerHTML = `
        <div class="empty-state">
          <div class="empty-visual check-empty" aria-hidden="true"></div>
          <strong>No team tasks yet</strong>
          <p>Manager can add a checklist item for everyone.</p>
        </div>`;
      return;
    }

    const open = checklistItems.filter((i) => !i.done);
    const done = checklistItems.filter((i) => i.done);

    const row = (item) => `
      <label class="check-row ${item.done ? "is-done" : ""}" data-id="${item.id}">
        <input type="checkbox" ${item.done ? "checked" : ""} data-check-toggle />
        <span class="check-body">
          <strong>${escapeHtml(item.text)}</strong>
          <small>Posted by ${escapeHtml(item.manager)} · ${formatWhen(item.createdAt)}</small>
        </span>
        <button type="button" class="check-delete" data-check-delete aria-label="Delete">×</button>
      </label>
    `;

    checklistList.innerHTML = `
      ${open.length ? open.map(row).join("") : `<div class="empty-state tight"><strong>All caught up</strong></div>`}
      ${done.length ? `<h2 class="list-heading">Done</h2>${done.map(row).join("")}` : ""}
    `;
  }

  async function loadRequests(force = false) {
    if (!force && boardBusy()) return;
    try {
      rememberOpenPanels();
      const res = await fetch("/api/requests", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      requests = Array.isArray(data.requests) ? data.requests : [];
      liveStatus.textContent = "Online";
      liveStatus.classList.add("is-online");
      renderStats();
      renderBoard();
      renderHistory();
    } catch {
      liveStatus.textContent = "Offline";
      liveStatus.classList.remove("is-online");
      boardColumns.innerHTML = `
        <div class="empty-state wide">
          <strong>Can't load board</strong>
          <p>Check your connection and try again.</p>
        </div>
      `;
      historyList.innerHTML = "";
      statsBar.innerHTML = "";
    }
  }

  async function loadCart() {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      cartOrders = Array.isArray(data.cart) ? data.cart : [];
      liveStatus.textContent = "Online";
      liveStatus.classList.add("is-online");
      renderCart();
    } catch {
      liveStatus.textContent = "Offline";
      liveStatus.classList.remove("is-online");
      cartList.innerHTML = `<div class="empty-state">Can't load cart fill list.</div>`;
    }
  }

  async function loadChecklist() {
    try {
      const res = await fetch("/api/checklist", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      checklistItems = Array.isArray(data.items) ? data.items : [];
      liveStatus.textContent = "Online";
      liveStatus.classList.add("is-online");
      renderChecklist();
    } catch {
      liveStatus.textContent = "Offline";
      liveStatus.classList.remove("is-online");
      checklistList.innerHTML = `<div class="empty-state">Can't load checklist.</div>`;
    }
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

  // ---- Nav ----
  document.querySelectorAll(".tabbar [data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.nav));
  });

  document.querySelectorAll(".section-tab").forEach((btn) => {
    btn.addEventListener("click", () => showSub(btn.dataset.sub));
  });

  document.getElementById("success-back").addEventListener("click", () => showSub("board"));
  document.getElementById("another-request").addEventListener("click", () => resetRequestForm());
  document.getElementById("fab-new-order")?.addEventListener("click", () => showSub("request"));

  document.querySelectorAll(".role-choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      gateRole = btn.dataset.role;
      document.querySelectorAll(".role-choice").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.role === gateRole);
      });
    });
  });

  document.getElementById("gate-continue").addEventListener("click", () => {
    const name = document.getElementById("gate-name").value.trim();
    if (!name) {
      showToast("Add your name");
      return;
    }
    if (!ROLE_LABELS[gateRole]) {
      showToast("Choose Housekeeping, Laundry, or Manager");
      return;
    }
    localStorage.setItem("linenboard-name", name);
    localStorage.setItem("linenboard-comment-name", name);
    localStorage.setItem("linenboard-comment-role", gateRole);
    if (gateRole === "manager") localStorage.setItem("linenboard-manager", name);
    roleGate.hidden = true;
    updateStaffChip();
    document.getElementById("requester-name").value = name;
    document.getElementById("cart-name").value = name;
    document.getElementById("manager-name").value =
      gateRole === "manager" ? name : document.getElementById("manager-name").value;
    showToast(`Signed in as ${ROLE_LABELS[gateRole]}`);
  });

  staffChip?.addEventListener("click", () => openRoleGate(true));

  document.getElementById("linen-packs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pack]");
    if (!btn) return;
    applyLinenPack(btn.dataset.pack);
  });

  document.getElementById("clear-history").addEventListener("click", async () => {
    if (!window.confirm("Clear finished linen orders from history?")) return;
    try {
      const result = await clearRequests("history");
      showToast(result.cleared ? `Cleared ${result.cleared} from history` : "History already empty");
      await loadRequests(true);
    } catch (err) {
      showToast(err.message || "Could not clear");
    }
  });

  document.getElementById("clear-all").addEventListener("click", async () => {
    if (!window.confirm("Clear EVERYTHING — open linen orders and history?")) return;
    try {
      const result = await clearRequests("all");
      showToast(result.cleared ? `Cleared ${result.cleared} requests` : "Board already empty");
      await loadRequests(true);
    } catch (err) {
      showToast(err.message || "Could not clear");
    }
  });

  document.getElementById("clear-cart-done").addEventListener("click", async () => {
    if (!window.confirm("Clear finished cart fill requests?")) return;
    try {
      const res = await fetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "done" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not clear");
      showToast(data.cleared ? `Cleared ${data.cleared}` : "Nothing to clear");
      await loadCart();
    } catch (err) {
      showToast(err.message || "Could not clear");
    }
  });

  document.getElementById("clear-checklist-done").addEventListener("click", async () => {
    if (!window.confirm("Clear checked-off checklist items?")) return;
    try {
      const res = await fetch("/api/checklist/clear-done", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not clear");
      showToast(data.cleared ? `Cleared ${data.cleared}` : "Nothing to clear");
      await loadChecklist();
    } catch (err) {
      showToast(err.message || "Could not clear");
    }
  });

  bindPicker(linenItemsEl, linenState);
  bindPicker(cartItemsEl, cartState);

  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("requester-name").value.trim();
    const area = document.getElementById("floor-area").value.trim();
    const notes = document.getElementById("notes").value.trim();
    const priority = document.getElementById("priority-urgent").checked ? "urgent" : "normal";
    const items = LINEN_CATALOG.map((item) => ({
      key: item.key,
      label: item.label,
      qty: linenState.qty[item.key],
    })).filter((i) => i.qty > 0);

    if (!name || !area) {
      showToast("Please add your name and floor/closet.");
      return;
    }
    if (!items.length) {
      showToast("Add at least one linen item");
      return;
    }

    try {
      localStorage.setItem("linenboard-name", name);
      await createRequest({ name, area, notes, priority, items });
      requestForm.hidden = true;
      requestSuccess.hidden = false;
      showToast("Linen order sent");
    } catch (err) {
      showToast(err.message || "Could not send");
    }
  });

  cartForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("cart-name").value.trim();
    const notes = document.getElementById("cart-notes").value.trim();
    const items = CART_CATALOG.map((item) => ({
      key: item.key,
      label: item.label,
      qty: cartState.qty[item.key],
    })).filter((i) => i.qty > 0);

    if (!name) {
      showToast("Add your name");
      return;
    }
    if (!items.length) {
      showToast("Add at least one cart item");
      return;
    }

    try {
      localStorage.setItem("linenboard-name", name);
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, notes, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      resetCartForm();
      const composer = document.getElementById("cart-composer");
      if (composer) composer.open = false;
      showToast("Cart fill sent");
      await loadCart();
    } catch (err) {
      showToast(err.message || "Could not send");
    }
  });

  checklistForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const manager = document.getElementById("manager-name").value.trim();
    const text = document.getElementById("checklist-text").value.trim();
    if (!manager || !text) {
      showToast("Add manager name and checklist item");
      return;
    }
    try {
      localStorage.setItem("linenboard-manager", manager);
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not post");
      document.getElementById("checklist-text").value = "";
      const composer = document.getElementById("check-composer");
      if (composer) composer.open = false;
      showToast("Posted for everyone");
      await loadChecklist();
    } catch (err) {
      showToast(err.message || "Could not post");
    }
  });

  cartList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cart-advance]");
    if (!btn) return;
    const card = btn.closest("[data-id]");
    if (!card) return;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/cart/${encodeURIComponent(card.dataset.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      showToast(CART_LABELS[data.order.status] || "Updated");
      await loadCart();
    } catch (err) {
      showToast(err.message || "Update failed");
      btn.disabled = false;
    }
  });

  checklistList.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-check-delete]");
    if (del) {
      e.preventDefault();
      const row = del.closest("[data-id]");
      if (!row || !window.confirm("Delete this checklist item?")) return;
      try {
        const res = await fetch(`/api/checklist/${encodeURIComponent(row.dataset.id)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not delete");
        showToast("Deleted");
        await loadChecklist();
      } catch (err) {
        showToast(err.message || "Could not delete");
      }
      return;
    }
  });

  checklistList.addEventListener("change", async (e) => {
    const box = e.target.closest("[data-check-toggle]");
    if (!box) return;
    const row = box.closest("[data-id]");
    if (!row) return;
    posting = true;
    try {
      const res = await fetch(`/api/checklist/${encodeURIComponent(row.dataset.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: box.checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update");
      await loadChecklist();
    } catch (err) {
      showToast(err.message || "Could not update");
      box.checked = !box.checked;
    } finally {
      posting = false;
    }
  });

  boardColumns.addEventListener(
    "toggle",
    (e) => {
      const details = e.target.closest("details[data-panel]");
      if (!details || !boardColumns.contains(details)) return;
      const key = details.dataset.panel;
      if (details.open) openPanels.add(key);
      else openPanels.delete(key);
    },
    true
  );

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
      const panel = card.querySelector(".ticket-panel .comment-later-body") || card.querySelector(".comment-later-body");
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

  renderPicker(linenItemsEl, LINEN_CATALOG, linenState.qty);
  renderPicker(cartItemsEl, CART_CATALOG, cartState.qty);
  const savedManager = localStorage.getItem("linenboard-manager");
  if (savedManager) document.getElementById("manager-name").value = savedManager;
  const savedName = localStorage.getItem("linenboard-name");
  if (savedName) {
    document.getElementById("requester-name").value = savedName;
    document.getElementById("cart-name").value = savedName;
  }

  async function refreshBadgesQuietly() {
    try {
      const [reqRes, cartRes, checkRes] = await Promise.all([
        fetch("/api/requests", { cache: "no-store" }),
        fetch("/api/cart", { cache: "no-store" }),
        fetch("/api/checklist", { cache: "no-store" }),
      ]);
      if (reqRes.ok) {
        const data = await reqRes.json();
        requests = Array.isArray(data.requests) ? data.requests : requests;
      }
      if (cartRes.ok) {
        const data = await cartRes.json();
        cartOrders = Array.isArray(data.cart) ? data.cart : cartOrders;
      }
      if (checkRes.ok) {
        const data = await checkRes.json();
        checklistItems = Array.isArray(data.items) ? data.items : checklistItems;
      }
      updateBadges();
    } catch {
      /* keep last known */
    }
  }

  openRoleGate(false);
  updateStaffChip();

  const hash = (location.hash || "#laundry").replace("#", "");
  const start = sections[hash] ? hash : "laundry";
  showSection(start);
  refreshBadgesQuietly();

  setInterval(() => {
    if (posting) return;
    if (currentSection === "laundry" && currentSub !== "request" && !boardBusy()) loadRequests();
    else if (currentSection === "cart") loadCart();
    else if (currentSection === "checklist") loadChecklist();
    else refreshBadgesQuietly();
  }, 5000);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || posting) return;
    if (currentSection === "laundry" && !boardBusy()) loadRequests();
    if (currentSection === "cart") loadCart();
    if (currentSection === "checklist") loadChecklist();
    refreshBadgesQuietly();
  });
})();
