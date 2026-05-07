'use strict';

// ── Render the Settings view ──────────────────────
async function renderSettings() {
  stopPolling();
  const root = $('#view-root');
  renderLoading(root, 'Loading configuration…');

  try {
    State.config = await apiGetConfig();
    buildSettingsPage(root, State.config);
  } catch (_) {
    renderError(root, 'Could not load configuration.', renderSettings);
  }
}

// ── Build settings page DOM ───────────────────────
function buildSettingsPage(root, config) {
  root.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'settings-wrap';

  // ── Page header
  const hdr = document.createElement('div');
  hdr.className = 'page-header';
  hdr.innerHTML = `
    <div>
      <h1 class="page-title">System Settings</h1>
      <p class="page-subtitle">Hardware configuration &amp; power-on behaviour</p>
    </div>`;
  root.appendChild(hdr);

  // ── Card 1: Relay Count + Power-on state
  const card1 = document.createElement('div');
  card1.className = 'settings-card';
  card1.innerHTML = `
    <div class="settings-section-title">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
      General Configuration
    </div>

    <div class="form-group" style="margin-bottom:1rem">
      <label class="form-label" for="cfg-count">Number of Relays</label>
      <input id="cfg-count" type="number" min="1" max="8" value="${config.relayCount}"
        class="form-input" style="max-width:140px"
        oninput="rebuildPinInputs()" />
      <span class="form-hint">1 – 8 relays supported</span>
    </div>

    <div class="form-group">
      <label class="form-label" for="cfg-poweron">Power-On State</label>
      <select id="cfg-poweron" class="form-select" style="max-width:260px">
        <option value="0" ${config.powerOnState === 0 ? 'selected' : ''}>Always OFF on boot</option>
        <option value="1" ${config.powerOnState === 1 ? 'selected' : ''}>Resume Last State</option>
      </select>
      <span class="form-hint">Behaviour when the ESP32 is powered on or reset</span>
    </div>`;
  wrap.appendChild(card1);

  // ── Card 2: GPIO Pin mapping
  const card2 = document.createElement('div');
  card2.className = 'settings-card';
  card2.innerHTML = `
    <div class="settings-section-title">
      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zM4 13a2 2 0 00-2 2v.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V15a2 2 0 00-2-2H4z"/></svg>
      GPIO Pin Mapping
    </div>
    <div class="pin-grid" id="pin-grid"></div>`;
  wrap.appendChild(card2);

  // ── Card 3: Save button
  const card3 = document.createElement('div');
  card3.className = 'settings-card';
  card3.innerHTML = `
    <div class="settings-section-title">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      Apply Configuration
    </div>
    <p style="font-size:.78rem;color:var(--muted);margin-bottom:1rem;line-height:1.6">
      Saving will restart the relay logic engine on the ESP32. Any active timers will be reset.
    </p>
    <button id="save-cfg-btn" class="btn btn-primary" onclick="handleSaveConfig()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      Save Configuration
    </button>`;
  wrap.appendChild(card3);

  root.appendChild(wrap);

  // Build the initial pin inputs
  rebuildPinInputs(config.pins);
}

// ── Dynamically rebuild pin inputs ───────────────
function rebuildPinInputs(existingPins) {
  const countEl = $('#cfg-count');
  if (!countEl) return;
  const count = parseInt(countEl.value, 10) || 1;
  const pins = existingPins || (State.config ? State.config.pins : []);
  const grid = $('#pin-grid');
  if (!grid) return;

  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'pin-item';
    item.innerHTML = `
      <label class="pin-label" for="pin-${i}">Relay ${i + 1}</label>
      <input id="pin-${i}" type="number" min="0" max="39"
        value="${pins[i] !== undefined ? pins[i] : ''}"
        placeholder="GPIO"
        class="form-input" />`;
    grid.appendChild(item);
  }
}

// ── Save config handler ───────────────────────────
async function handleSaveConfig() {
  const count = parseInt($('#cfg-count').value, 10);
  if (!count || count < 1 || count > 8) {
    toast('Enter a relay count between 1 and 8.', 'error'); return;
  }

  const pins = [];
  for (let i = 0; i < count; i++) {
    const v = parseInt($(`#pin-${i}`).value, 10);
    if (isNaN(v) || v < 0 || v > 39) {
      toast(`Invalid GPIO for Relay ${i + 1}.`, 'error'); return;
    }
    pins.push(v);
  }

  const powerOnState = parseInt($('#cfg-poweron').value, 10);
  const payload = { relayCount: count, pins, powerOnState };

  const btn = $('#save-cfg-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await apiSaveConfig(payload);
    State.config = payload;
    toast('Configuration saved! Loading dashboard…', 'success');
    // Navigate to dashboard after a short delay so the toast is readable
    setTimeout(() => { window.location.hash = '#dashboard'; }, 1200);
  } catch (_) {
    toast('Failed to save configuration.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Save Configuration`;
  }
}
