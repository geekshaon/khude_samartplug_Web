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

// ── Fast DOM update (no full re-render) ──────────
function updateCardStates(relays) {
  relays.forEach(relay => {
    const card = document.getElementById(`card-${relay.id}`);
    if (!card) return;

    // Toggle class
    card.classList.toggle('is-on', relay.state);

    // Status dot
    const dot = card.querySelector('.status-dot');
    if (dot) dot.className = 'status-dot' + (relay.state ? ' on' : '');

    // Toggle checkbox
    const chk = card.querySelector(`#toggle-${relay.id}`);
    if (chk) chk.checked = relay.state;

    // Rule chip
    const ruleWrap = card.querySelector('.active-rule-wrap');
    if (ruleWrap) ruleWrap.innerHTML = logicChipHTML(relay.activeLogic, relay.logicDetail);
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

  const card = document.createElement('div');
  card.className = 'relay-card' + (relay.state ? ' is-on' : '');
  card.id = `card-${relay.id}`;

  card.innerHTML = `
    <div class="card-top">
      <div style="min-width:0;flex:1">
        <div class="card-id-badge">RELAY ${relay.id} · GPIO ${(State.config.pins[relay.id - 1] ?? '?')}</div>
        <div class="card-name-wrap">
          <span class="status-dot${relay.state ? ' on' : ''}"></span>
          <span class="card-name" id="name-${relay.id}" title="Click to rename">${name}</span>
        </div>
      </div>
      <label class="toggle" title="${relay.state ? 'Turn OFF' : 'Turn ON'}">
        <input type="checkbox" id="toggle-${relay.id}" ${relay.state ? 'checked' : ''}
          onchange="handleToggle(${relay.id}, this.checked)" aria-label="Toggle relay ${relay.id}" />
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="card-divider"></div>

    <div class="active-rule-wrap">
      ${logicChipHTML(relay.activeLogic, relay.logicDetail)}
    </div>

    <button class="btn-add-rule" onclick="openModal(${relay.id})" aria-label="Configure rule for ${name}">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
      Add Rule / Schedule
    </button>`;

  // Inline name editing
  const nameEl = card.querySelector(`#name-${relay.id}`);
  nameEl.addEventListener('click', () => startEditName(relay.id, nameEl));

  return card;
}

// ── Handle toggle click ───────────────────────────
async function handleToggle(relayId, newState) {
  const card = document.getElementById(`card-${relayId}`);
  try {
    await apiSetRelay(relayId, newState);
    if (card) card.classList.toggle('is-on', newState);
    const dot = card ? card.querySelector('.status-dot') : null;
    if (dot) dot.className = 'status-dot' + (newState ? ' on' : '');
    toast(`Relay ${relayId} turned ${newState ? 'ON' : 'OFF'}.`, 'success');
    // Update active-count badge
    const onCount = State.status.relays.filter(r => r.state).length;
    const badge = document.querySelector('.active-count-badge .count');
    if (badge) badge.textContent = onCount;
  } catch (_) {
    toast('Failed to toggle relay.', 'error');
    // Revert checkbox
    const chk = document.getElementById(`toggle-${relayId}`);
    if (chk) chk.checked = !newState;
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
