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

  // ── Settings Hero Header ──────────────────────
  const hero = document.createElement('div');
  hero.className = 'settings-hero';
  hero.innerHTML = `
    <div class="settings-hero-left">
      <div class="settings-title-row">
        <h1 class="page-title">System Settings</h1>
        <span class="settings-cfg-tag">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
          Configuration
        </span>
      </div>
      <p class="settings-hero-sub">
        Adjust hardware layout and power-on behaviour. Changes are written to ESP32 flash.
      </p>
    </div>
    <div class="settings-hero-right">
      <div class="settings-hero-stat">
        <span class="settings-hero-stat-num">${config.relayCount}</span>
        <span class="settings-hero-stat-label">Relays</span>
      </div>
      <div class="settings-hero-stat">
        <span class="settings-hero-stat-num">${config.pins.length}</span>
        <span class="settings-hero-stat-label">GPIO Pins</span>
      </div>
    </div>
    <div class="settings-hero-line"></div>`;
  root.appendChild(hero);

  const wrap = document.createElement('div');
  wrap.className = 'settings-wrap';

  // ── Card 1: General Configuration ─────────────
  const card1 = document.createElement('div');
  card1.className = 'settings-card';
  card1.innerHTML = `
    <div class="sc-header">
      <div class="sc-header-left">
        <div class="sc-icon-bubble sc-bubble-purple">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <div class="sc-title">General Configuration</div>
          <div class="sc-sub">Controls how many relays the ESP32 manages and their startup state.</div>
        </div>
      </div>
      <span class="sc-tag">GENERAL</span>
    </div>

    <div class="sc-divider"></div>

    <div class="sc-field">
      <label class="sc-label" for="cfg-count">Number of Relays</label>
      <p class="sc-field-desc">How many relay channels are physically wired to the ESP32. Maximum 8.</p>
      <div class="sc-stepper">
        <button type="button" class="sc-step-btn" onclick="stepRelay(-1)" aria-label="Decrease">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
        </button>
        <input id="cfg-count" type="number" min="1" max="8" value="${config.relayCount}"
          class="sc-stepper-input" oninput="rebuildPinInputs()" />
        <button type="button" class="sc-step-btn" onclick="stepRelay(1)" aria-label="Increase">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
        </button>
      </div>
      <span class="sc-hint">Supported range: 1 – 8</span>
    </div>

    <div class="sc-field">
      <label class="sc-label" for="cfg-poweron">Power-On State</label>
      <p class="sc-field-desc">What happens to the relays when the ESP32 boots or resets.</p>
      <select id="cfg-poweron" class="sc-select" onchange="updatePowerOnHint()">
        <option value="0" ${config.powerOnState === 0 ? 'selected' : ''}>Always OFF on boot</option>
        <option value="1" ${config.powerOnState === 1 ? 'selected' : ''}>Resume Last State</option>
      </select>
      <p class="sc-hint" id="poweron-hint">${config.powerOnState === 1
        ? '🔄 Each relay will restore the state it had before the last power cycle.'
        : '⚡ All relays will be OFF every time the device powers on — safest default.'}</p>
    </div>`;
  wrap.appendChild(card1);

  // ── Card 2: GPIO Pin Mapping ───────────────────
  const card2 = document.createElement('div');
  card2.className = 'settings-card';
  card2.innerHTML = `
    <div class="sc-header">
      <div class="sc-header-left">
        <div class="sc-icon-bubble sc-bubble-blue">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zM4 13a2 2 0 00-2 2v.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V15a2 2 0 00-2-2H4z"/></svg>
        </div>
        <div>
          <div class="sc-title">GPIO Pin Mapping</div>
          <div class="sc-sub">Assign a physical GPIO pin to each relay channel. Valid range: 0 – 39.</div>
        </div>
      </div>
      <span class="sc-tag">HARDWARE</span>
    </div>

    <div class="sc-divider"></div>

    <p class="sc-field-desc" style="margin-bottom:1rem">
      Avoid pins 6–11 (SPI flash) and 34–39 (input-only). Commonly used: 4, 5, 12–15, 21–23.
    </p>
    <div class="pin-grid" id="pin-grid"></div>`;
  wrap.appendChild(card2);

  // ── Card 3: Save ───────────────────────────────
  const card3 = document.createElement('div');
  card3.className = 'settings-card';
  card3.innerHTML = `
    <div class="sc-header">
      <div class="sc-header-left">
        <div class="sc-icon-bubble sc-bubble-amber">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </div>
        <div>
          <div class="sc-title">Apply Configuration</div>
          <div class="sc-sub">Writes your settings to ESP32 flash memory and restarts the relay engine.</div>
        </div>
      </div>
      <span class="sc-tag">APPLY</span>
    </div>

    <div class="sc-divider"></div>

    <div class="sc-warning">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
      <span><strong>Heads up:</strong> Saving will restart the relay logic engine. Any active automation timers will be cancelled and relays will follow the power-on state rule.</span>
    </div>

    <button id="save-cfg-btn" class="sc-save-btn" onclick="handleSaveConfig()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      Save Configuration
    </button>`;
  wrap.appendChild(card3);

  root.appendChild(wrap);
  rebuildPinInputs(config.pins);
}

// ── Stepper buttons ───────────────────────────────
function stepRelay(delta) {
  const el = $('#cfg-count');
  if (!el) return;
  const next = Math.min(8, Math.max(1, (parseInt(el.value, 10) || 1) + delta));
  el.value = next;
  rebuildPinInputs();
}

// ── Dynamic power-on hint ─────────────────────────
function updatePowerOnHint() {
  const el = $('#cfg-poweron');
  const hint = $('#poweron-hint');
  if (!el || !hint) return;
  hint.textContent = el.value === '1'
    ? '🔄 Each relay will restore the state it had before the last power cycle.'
    : '⚡ All relays will be OFF every time the device powers on — safest default.';
}

// ── Dynamically rebuild pin inputs ────────────────
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
      <div class="pin-item-header">
        <span class="pin-relay-badge">R${i + 1}</span>
        <svg class="pin-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zM4 13a2 2 0 00-2 2v.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V15a2 2 0 00-2-2H4z"/></svg>
      </div>
      <label class="pin-label" for="pin-${i}">Relay ${i + 1}</label>
      <div class="pin-input-wrap">
        <span class="pin-gpio-prefix">GPIO</span>
        <input id="pin-${i}" type="number" min="0" max="39"
          value="${pins[i] !== undefined ? pins[i] : ''}"
          placeholder="—"
          class="pin-input" />
      </div>`;
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
  btn.innerHTML = `
    <svg class="sc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    Saving…`;

  try {
    await apiSaveConfig(payload);
    State.config = payload;
    toast('Configuration saved! Loading dashboard…', 'success');
    setTimeout(() => { window.location.hash = '#dashboard'; }, 1200);
  } catch (_) {
    toast('Failed to save configuration.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      Save Configuration`;
  }
}
