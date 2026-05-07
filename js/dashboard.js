'use strict';

// ── Start / stop polling ──────────────────────────
function startPolling() {
  stopPolling();
  State.pollingInterval = setInterval(refreshStatus, 4000);
}

function stopPolling() {
  if (State.pollingInterval) {
    clearInterval(State.pollingInterval);
    State.pollingInterval = null;
  }
}

// ── Refresh status & re-render cards ─────────────
async function refreshStatus() {
  try {
    State.status = await apiGetStatus();
    setTemperature(State.status.temperature);
    setConnected(true);
    updateCardStates(State.status.relays);
  } catch (_) {
    setConnected(false);
  }
}

// ── Apply state to card DOM instantly (optimistic) ─
function applyCardState(relayId, on) {
  const card = document.getElementById(`card-${relayId}`);
  if (!card) return;

  card.classList.toggle('is-on', on);

  const btn = document.getElementById(`power-btn-${relayId}`);
  if (btn) {
    btn.className = `power-btn${on ? ' on' : ''}`;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('onclick', `handleToggle(${relayId}, ${!on})`);
    btn.setAttribute('aria-label', `${on ? 'Turn OFF' : 'Turn ON'} relay ${relayId}`);
  }
  const lbl = document.getElementById(`power-label-${relayId}`);
  if (lbl) lbl.textContent = on ? 'Tap to turn OFF' : 'Tap to turn ON';

  const badge = card.querySelector('.card-status-badge');
  if (badge) badge.className = `card-status-badge ${on ? 'on' : 'off'}`;
  const dot = card.querySelector('.card-status-dot');
  if (dot) dot.className = `card-status-dot${on ? ' on' : ''}`;
  const st = document.getElementById(`status-text-${relayId}`);
  if (st) st.textContent = on ? 'ACTIVE' : 'OFFLINE';

  // Keep State in sync
  if (State.status) {
    const r = State.status.relays.find(x => x.id === relayId);
    if (r) r.state = on;
  }
}

// ── Fast DOM update (no full re-render) ──────────
function updateCardStates(relays) {
  relays.forEach(relay => {
    applyCardState(relay.id, relay.state);
    const card = document.getElementById(`card-${relay.id}`);
    if (!card) return;
    const ruleWrap = card.querySelector('.active-rule-wrap');
    if (ruleWrap) ruleWrap.innerHTML = logicChipInline(relay.activeLogic, relay.logicDetail);
  });
}


// ── Render full dashboard ─────────────────────────
async function renderDashboard() {
  stopPolling();
  const root = $('#view-root');
  renderLoading(root, 'Loading relay status…');

  try {
    [State.config, State.status] = await Promise.all([apiGetConfig(), apiGetStatus()]);
    setTemperature(State.status.temperature);
    setConnected(true);
    buildDashboard(root);
    startPolling();
  } catch (err) {
    renderError(root, 'Could not reach the device.', renderDashboard);
    setConnected(false);
  }
}

// ── Build the grid HTML ───────────────────────────
function buildDashboard(root) {
  const { relays } = State.status;
  const onCount = relays.filter(r => r.state).length;

  root.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div>
      <h1 class="page-title">Control Panel</h1>
      <p class="page-subtitle">
        ${State.config.relayCount} relays &nbsp;·&nbsp; GPIO: ${State.config.pins.join(', ')}
      </p>
    </div>
    <div class="active-count-badge">
      <span class="count">${onCount}</span>
      <span>active</span>
    </div>`;
  root.appendChild(header);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'relay-grid';
  relays.forEach(relay => grid.appendChild(buildRelayCard(relay)));
  root.appendChild(grid);
}

// ── Build a single relay card ─────────────────────
function buildRelayCard(relay) {
  const name = State.relayNames[relay.id] || relay.name || `Relay ${relay.id}`;
  const gpio = State.config.pins[relay.id - 1] ?? '?';
  const on   = relay.state;

  const card = document.createElement('div');
  card.className = 'relay-card' + (on ? ' is-on' : '');
  card.id = `card-${relay.id}`;

  card.innerHTML = `
    <!-- ── Header row ── -->
    <div class="card-header">
      <div class="card-header-left">
        <span class="card-relay-num">R${relay.id}</span>
        <div class="card-gpio-badge">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zM4 13a2 2 0 00-2 2v.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V15a2 2 0 00-2-2H4z"/></svg>
          GPIO ${gpio}
        </div>
      </div>
      <div class="card-status-badge ${on ? 'on' : 'off'}">
        <span class="card-status-dot ${on ? 'on' : ''}"></span>
        <span class="card-status-text" id="status-text-${relay.id}">${on ? 'ACTIVE' : 'OFFLINE'}</span>
      </div>
    </div>

    <!-- ── Relay Name ── -->
    <div class="card-name-row">
      <span class="card-name" id="name-${relay.id}" title="Click to rename">${name}</span>
      <button class="card-edit-btn" onclick="document.getElementById('name-${relay.id}').click()" aria-label="Edit name">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
      </button>
    </div>

    <!-- ── Big Power Button ── -->
    <div class="card-power-zone">
      <button
        class="power-btn ${on ? 'on' : ''}"
        id="power-btn-${relay.id}"
        onclick="handleToggle(${relay.id}, ${!on})"
        aria-label="${on ? 'Turn OFF' : 'Turn ON'} relay ${relay.id}"
        aria-pressed="${on}">
        <svg class="power-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
          <line x1="12" y1="2" x2="12" y2="12"/>
        </svg>
      </button>
      <p class="power-label" id="power-label-${relay.id}">${on ? 'Tap to turn OFF' : 'Tap to turn ON'}</p>
    </div>

    <!-- ── Info Row ── -->
    <div class="card-info-row">
      <div class="card-info-item">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        <span class="card-info-label">Rule</span>
        <span class="card-info-value active-rule-wrap">${logicChipInline(relay.activeLogic, relay.logicDetail)}</span>
      </div>
    </div>

    <!-- ── Configure Button ── -->
    <button class="btn-configure" onclick="openModal(${relay.id})" aria-label="Configure rule for ${name}">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
      Configure Rule
    </button>`;

  // Inline name editing
  const nameEl = card.querySelector(`#name-${relay.id}`);
  nameEl.addEventListener('click', () => startEditName(relay.id, nameEl));

  return card;
}

// ── Inline rule text (for new card design) ────────
function logicChipInline(activeLogic, logicDetail) {
  const t = LOGIC_TYPES.find(x => x.id === activeLogic);
  if (!t) return '<span class="rule-inline manual">Manual</span>';
  const detail = logicDetail ? ` · ${logicDetail}` : '';
  return `<span class="rule-inline ${activeLogic === 1 ? 'manual' : 'active'}">${t.icon} ${t.label}${detail}</span>`;
}

// ── Handle toggle click ───────────────────────────
async function handleToggle(relayId, newState) {
  // 1. Update UI instantly (optimistic) — no waiting for API
  applyCardState(relayId, newState);

  // 2. Update active-count badge immediately
  const onCount = (State.status ? State.status.relays.filter(r => r.state).length : 0);
  const countBadge = document.querySelector('.active-count-badge .count');
  if (countBadge) countBadge.textContent = onCount;

  // 3. Fire API in background
  try {
    await apiSetRelay(relayId, newState);
    toast(`Relay ${relayId} turned ${newState ? 'ON' : 'OFF'}.`, 'success');
  } catch (_) {
    // Revert on failure
    applyCardState(relayId, !newState);
    toast('Failed to toggle relay.', 'error');
  }
}

// ── Inline relay name editing ─────────────────────
function startEditName(relayId, nameEl) {
  const current = nameEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'card-name-input';
  input.maxLength = 24;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newName = input.value.trim() || current;
    State.relayNames[relayId] = newName;
    saveNames();
    const span = document.createElement('span');
    span.id = `name-${relayId}`;
    span.className = 'card-name';
    span.title = 'Click to rename';
    span.textContent = newName;
    input.replaceWith(span);
    span.addEventListener('click', () => startEditName(relayId, span));
    toast('Name updated.', 'success');
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = current; input.blur(); }
  });
}
