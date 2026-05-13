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
    updateHealthBar();
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

  // ── Dashboard Hero Header ──
  const header = document.createElement('div');
  header.className = 'dash-hero';
  header.innerHTML = `
    <div class="dash-hero-left">
      <div class="dash-title-row">
        <h1 class="page-title">Control Panel</h1>
        <span class="dash-esp-tag">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z"/><path fill-rule="evenodd" d="M7 2a1 1 0 00-1 1v1H5a2 2 0 00-2 2v8a2 2 0 002 2h1v1a1 1 0 102 0v-1h4v1a1 1 0 102 0v-1h1a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 00-1-1H7zm-2 4h10v8H5V6z" clip-rule="evenodd"/></svg>
          ESP32
        </span>
      </div>
      <div class="dash-meta-row">
        <div class="dash-relay-chip">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
          ${State.config.relayCount} Relays
        </div>
        <span class="dash-meta-dot"></span>
        <div class="dash-gpio-group">
          <span class="dash-gpio-label">GPIO</span>
          ${State.config.pins.map(p => `<span class="dash-pin">${p}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="dash-hero-right">
      <div class="dash-stat-card" id="dash-stat-card">
        <div class="dash-stat-counter">
          <span class="dash-stat-num" id="dash-active-num">${onCount}</span>
          <span class="dash-stat-sep">/</span>
          <span class="dash-stat-total">${State.config.relayCount}</span>
        </div>
        <div class="dash-stat-footer">
          <span class="dash-active-dot ${onCount > 0 ? 'on' : ''}" id="dash-active-dot"></span>
          <span class="dash-stat-label">Relays Active</span>
        </div>
      </div>
    </div>

    <div class="dash-hero-line"></div>`;
  root.appendChild(header);

  // Relay Grid
  const grid = document.createElement('div');
  grid.className = 'relay-grid';
  relays.forEach(relay => grid.appendChild(buildRelayCard(relay)));
  root.appendChild(grid);

  // ── Section divider before health bar ──
  const divider = document.createElement('div');
  divider.className = 'health-section-header';
  divider.innerHTML = `
    <div class="health-section-line"></div>
    <span class="health-section-title">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
      </svg>
      System Health
    </span>
    <div class="health-section-line"></div>`;
  root.appendChild(divider);

  // System Health Bar
  const healthBar = document.createElement('div');
  healthBar.id = 'system-health-bar';
  healthBar.className = 'health-bar';
  healthBar.innerHTML = buildHealthBar(State.status);
  root.appendChild(healthBar);
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

// ── System Health Bar ─────────────────────────────
// Computes display values from a status object
function _parseHealth(status) {
  const freeRamKB = status.free_ram  != null ? Math.round(status.free_ram / 1024) : null;
  const rssi      = status.rssi      != null ? status.rssi      : null;
  const uptimeSec = status.uptime    != null ? status.uptime    : null;
  const cpuFreq   = status.cpu_freq  != null ? status.cpu_freq  : null;
  const uptimeStr = uptimeSec != null
    ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
    : '--';
  // Signal colour
  let sigClass = 'hc-sig-red';
  if (rssi != null && rssi > -60)      sigClass = 'hc-sig-green';
  else if (rssi != null && rssi > -80) sigClass = 'hc-sig-yellow';
  // RAM colour (> 100 KB = ok, 50-100 = low, < 50 = critical)
  let ramClass = '';
  if (freeRamKB != null && freeRamKB <= 50)       ramClass = 'hc-ram-critical';
  else if (freeRamKB != null && freeRamKB <= 100)  ramClass = 'hc-ram-low';
  return { freeRamKB, rssi, uptimeStr, cpuFreq, sigClass, ramClass };
}

// Builds the full card HTML (called once on initial render)
function buildHealthBar(status) {
  const { freeRamKB, rssi, uptimeStr, cpuFreq, sigClass, ramClass } = _parseHealth(status);

  return `
    <div class="health-card ${ramClass}" id="hc-ram-card">
      <div class="hc-top">
        <div class="hc-bubble hc-bubble-purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a1 1 0 011-1h14a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V5zm3 8v2H4v1h12v-1h-1v-2H5zm1 0h8v2H6v-2z"/></svg>
        </div>
        <span class="hc-tag">RAM</span>
      </div>
      <p class="hc-main">
        <span id="hc-ram-val">${freeRamKB != null ? freeRamKB : '--'}</span>
        <span class="hc-unit" id="hc-ram-unit">${freeRamKB != null ? ' KB' : ''}</span>
      </p>
      <div class="hc-divider"></div>
      <p class="hc-sub">Free Memory</p>
      <div class="hc-foot hc-foot-purple"></div>
    </div>

    <div class="health-card ${sigClass}" id="hc-signal-card">
      <div class="hc-top">
        <div class="hc-bubble hc-bubble-signal">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3.5A12.5 12.5 0 001.5 7.17l1.42 1.42A10.5 10.5 0 0110 5.5a10.5 10.5 0 017.08 3.09l1.42-1.42A12.5 12.5 0 0010 3.5z" opacity=".4"/>
            <path d="M10 7.5A8.5 8.5 0 004.34 9.76l1.42 1.42A6.5 6.5 0 0110 9.5a6.5 6.5 0 014.24 1.68l1.42-1.42A8.5 8.5 0 0010 7.5z" opacity=".7"/>
            <path d="M10 11.5a4.5 4.5 0 00-2.83 1l1.42 1.42a2.5 2.5 0 012.82 0l1.42-1.42A4.5 4.5 0 0010 11.5z"/>
            <circle cx="10" cy="16" r="1.5"/>
          </svg>
        </div>
        <span class="hc-tag">WiFi</span>
      </div>
      <p class="hc-main">
        <span id="hc-rssi-val">${rssi != null ? rssi : '--'}</span>
        <span class="hc-unit" id="hc-rssi-unit">${rssi != null ? ' dBm' : ''}</span>
      </p>
      <div class="hc-divider"></div>
      <p class="hc-sub">Signal Strength</p>
      <div class="hc-foot hc-foot-signal"></div>
    </div>

    <div class="health-card">
      <div class="hc-top">
        <div class="hc-bubble hc-bubble-blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        </div>
        <span class="hc-tag">TIME</span>
      </div>
      <p class="hc-main hc-main-md" id="hc-uptime-val">${uptimeStr}</p>
      <div class="hc-divider"></div>
      <p class="hc-sub">Device Uptime</p>
      <div class="hc-foot hc-foot-blue"></div>
    </div>

    <div class="health-card">
      <div class="hc-top">
        <div class="hc-bubble hc-bubble-amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z"/><path fill-rule="evenodd" d="M7 2a1 1 0 00-1 1v1H5a2 2 0 00-2 2v8a2 2 0 002 2h1v1a1 1 0 102 0v-1h4v1a1 1 0 102 0v-1h1a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 00-1-1H7zm-2 4h10v8H5V6z" clip-rule="evenodd"/></svg>
        </div>
        <span class="hc-tag">CPU</span>
      </div>
      <p class="hc-main">
        <span id="hc-cpu-val">${cpuFreq != null ? cpuFreq : '--'}</span>
        <span class="hc-unit" id="hc-cpu-unit">${cpuFreq != null ? ' MHz' : ''}</span>
      </p>
      <div class="hc-divider"></div>
      <p class="hc-sub">Clock Frequency</p>
      <div class="hc-foot hc-foot-amber"></div>
    </div>`;
}

// Patches only the changing values in-place (no DOM structure rebuild → no re-animation)
function updateHealthBar() {
  const bar = document.getElementById('system-health-bar');
  if (!bar || !State.status) return;

  // First render: build the full structure
  if (!bar.firstElementChild) {
    bar.innerHTML = buildHealthBar(State.status);
    return;
  }

  // Subsequent polls: patch text only
  const { freeRamKB, rssi, uptimeStr, cpuFreq, sigClass, ramClass } = _parseHealth(State.status);

  const ramVal  = document.getElementById('hc-ram-val');
  const ramUnit = document.getElementById('hc-ram-unit');
  if (ramVal)  ramVal.textContent  = freeRamKB != null ? freeRamKB : '--';
  if (ramUnit) ramUnit.textContent = freeRamKB != null ? ' KB' : '';
  // Update RAM card colour class
  const ramCard = document.getElementById('hc-ram-card');
  if (ramCard) {
    ramCard.classList.remove('hc-ram-low', 'hc-ram-critical');
    if (ramClass) ramCard.classList.add(ramClass);
  }

  const rssiVal  = document.getElementById('hc-rssi-val');
  const rssiUnit = document.getElementById('hc-rssi-unit');
  if (rssiVal)  rssiVal.textContent  = rssi != null ? rssi : '--';
  if (rssiUnit) rssiUnit.textContent = rssi != null ? ' dBm' : '';
  // Update signal card colour class
  const sigCard = document.getElementById('hc-signal-card');
  if (sigCard) {
    sigCard.classList.remove('hc-sig-green', 'hc-sig-yellow', 'hc-sig-red');
    sigCard.classList.add(sigClass);
  }

  const uptimeEl = document.getElementById('hc-uptime-val');
  if (uptimeEl) uptimeEl.textContent = uptimeStr;

  const cpuVal  = document.getElementById('hc-cpu-val');
  const cpuUnit = document.getElementById('hc-cpu-unit');
  if (cpuVal)  cpuVal.textContent  = cpuFreq != null ? cpuFreq : '--';
  if (cpuUnit) cpuUnit.textContent = cpuFreq != null ? ' MHz' : '';
}

// ── Handle toggle click ───────────────────────────
async function handleToggle(relayId, newState) {
  // 1. Update UI instantly (optimistic) — no waiting for API
  applyCardState(relayId, newState);

  // 2. Compute active count using the known newState — avoids relying on
  //    applyCardState() mutation order (safer if relay not in State.status)
  const allRelays = State.status ? State.status.relays : [];
  const onCount = allRelays.filter(r => r.id === relayId ? newState : r.state).length;
  const numEl = document.getElementById('dash-active-num');
  if (numEl) numEl.textContent = onCount;
  const dotEl = document.getElementById('dash-active-dot');
  if (dotEl) dotEl.className = `dash-active-dot ${onCount > 0 ? 'on' : ''}`;
  // Update stat card glow
  const statCard = document.getElementById('dash-stat-card');
  if (statCard) statCard.className = `dash-stat-card ${onCount > 0 ? 'has-active' : ''}`;

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
