'use strict';

// ── Rule form templates ───────────────────────────
function getRuleFormHTML(logicType, currentTemp) {
  const inputClass = 'form-input';
  const selClass   = 'form-select';

  switch (logicType) {
    case 1: // Manual
      return `<div class="rule-form">
        <div class="rule-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          <p>Directly set the relay state. This disables any active schedule or timer.</p>
        </div>
        <div class="state-buttons">
          <button class="state-btn on-btn active" id="manual-on" onclick="selectManualState(true)">
            <svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="7"/></svg> Turn ON
          </button>
          <button class="state-btn off-btn" id="manual-off" onclick="selectManualState(false)">
            <svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/></svg> Turn OFF
          </button>
        </div>
      </div>`;

    case 2: // Sleep Timer
      return `<div class="rule-form">
        <div class="rule-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
          <p>Relay turns ON now and automatically turns OFF after the set duration.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Turn OFF after (minutes)</label>
          <input id="f-timer-mins" type="number" min="1" max="1440" placeholder="e.g. 30" class="${inputClass}" />
          <span class="form-hint">Range: 1 – 1440 minutes (24 hrs)</span>
        </div>
      </div>`;

    case 3: // Delayed ON
      return `<div class="rule-form">
        <div class="rule-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
          <p>Relay is currently OFF and will turn ON automatically after the set delay.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Turn ON after (minutes)</label>
          <input id="f-timer-mins" type="number" min="1" max="1440" placeholder="e.g. 120" class="${inputClass}" />
          <span class="form-hint">Range: 1 – 1440 minutes (24 hrs)</span>
        </div>
      </div>`;

    case 4: // Schedule + Duration
      return `<div class="rule-form">
        <div class="rule-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
          <p>Relay turns ON at the start time and turns OFF at the end time, every day.</p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Turn ON at</label>
            <input id="f-start" type="time" class="${inputClass}" value="18:00" />
          </div>
          <div class="form-group">
            <label class="form-label">Turn OFF at</label>
            <input id="f-end" type="time" class="${inputClass}" value="23:00" />
          </div>
        </div>
      </div>`;

    case 5: // Loop Timer
      return `<div class="rule-form">
        <div class="rule-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
          <p>Relay cycles repeatedly: ON for a set duration, then OFF for a set duration.</p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">ON for (minutes)</label>
            <input id="f-on-mins" type="number" min="1" max="1440" placeholder="e.g. 20" class="${inputClass}" />
          </div>
          <div class="form-group">
            <label class="form-label">OFF for (minutes)</label>
            <input id="f-off-mins" type="number" min="1" max="1440" placeholder="e.g. 10" class="${inputClass}" />
          </div>
        </div>
      </div>`;

    case 6: { // Temperature Condition — block required to scope const in switch
      const tempDisplay = currentTemp != null ? ` (now: ${parseFloat(currentTemp).toFixed(1)}°C)` : '';
      return `<div class="rule-form">
        <div class="rule-info">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
          <p>Reads sensor temperature${tempDisplay} and triggers relay based on your condition.</p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Temp (°C)</label>
            <input id="f-temp" type="number" step="0.5" placeholder="e.g. 35" class="${inputClass}" />
          </div>
          <div class="form-group">
            <label class="form-label">Condition</label>
            <select id="f-cond" class="${selClass}">
              <option value="above">Turn ON if Above</option>
              <option value="below">Turn ON if Below</option>
            </select>
          </div>
        </div>
      </div>`;
    }

    default:
      return '<p style="color:var(--muted)">Unknown rule type.</p>';
  }
}

// ── Manual state toggle helper ────────────────────
function selectManualState(on) {
  State.modal.manualState = on;
  const onBtn  = $('#manual-on');
  const offBtn = $('#manual-off');
  if (onBtn)  onBtn.classList.toggle('active', on);
  if (offBtn) offBtn.classList.toggle('active', !on);
}

// ── Build rule tab pills ──────────────────────────
function renderRuleTabs(activeId) {
  const container = $('#rule-tabs');
  container.innerHTML = '';
  LOGIC_TYPES.forEach(lt => {
    const btn = document.createElement('button');
    btn.className = 'rule-tab' + (lt.id === activeId ? ' active' : '');
    btn.role = 'tab';
    btn.setAttribute('aria-selected', lt.id === activeId);
    btn.innerHTML = `${lt.icon} ${lt.label}`;
    btn.onclick = () => {
      State.modal.logicType = lt.id;
      renderRuleTabs(lt.id);
      renderModalBody();
    };
    container.appendChild(btn);
  });
}

// ── Render modal body for current logic type ──────
function renderModalBody() {
  const temp = State.status ? State.status.temperature : null;
  $('#modal-body').innerHTML = getRuleFormHTML(State.modal.logicType, temp);
}

// ── Open modal ────────────────────────────────────
function openModal(relayId) {
  const relay = State.status ? State.status.relays.find(r => r.id === relayId) : null;
  const name  = State.relayNames[relayId] || (relay ? relay.name : `Relay ${relayId}`);

  State.modal.relayId     = relayId;
  State.modal.logicType   = relay ? relay.activeLogic : 1;
  State.modal.manualState = relay ? relay.state : true;

  document.getElementById('modal-relay-label').textContent = name;
  document.getElementById('modal-title').textContent       = 'Configure Rule';
  renderRuleTabs(State.modal.logicType);
  renderModalBody();

  const overlay = document.getElementById('modal-overlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

// ── Close modal ───────────────────────────────────
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  overlay.style.opacity = '0';
  container.style.transform = 'scale(0.95)';
  container.style.opacity = '0';
  setTimeout(() => {
    overlay.hidden = true;
    overlay.style.opacity = '';
    container.style.transform = '';
    container.style.opacity = '';
  }, 300);
  document.body.style.overflow = '';
}

// ── Collect form values & POST ────────────────────
async function saveRule() {
  const { relayId, logicType } = State.modal;
  let payload = { relayId, logicType };
  let detailLabel = '';

  try {
    switch (logicType) {
      case 1:
        payload.state = State.modal.manualState;
        detailLabel = null;
        break;
      case 2:
      case 3: {
        const mins = parseInt($('#f-timer-mins').value, 10);
        if (!mins || mins < 1) { toast('Enter a valid number of minutes.', 'error'); return; }
        payload.minutes = mins;
        detailLabel = logicType === 2 ? `${mins} min left` : `${mins} min delay`;
        break;
      }
      case 4: {
        const start = $('#f-start').value;
        const end   = $('#f-end').value;
        if (!start || !end) { toast('Set both ON and OFF times.', 'error'); return; }
        payload.startTime = start;
        payload.endTime   = end;
        detailLabel = `${start} – ${end}`;
        break;
      }
      case 5: {
        const on  = parseInt($('#f-on-mins').value, 10);
        const off = parseInt($('#f-off-mins').value, 10);
        if (!on || !off) { toast('Enter valid ON and OFF durations.', 'error'); return; }
        payload.onMinutes  = on;
        payload.offMinutes = off;
        detailLabel = `ON ${on}m / OFF ${off}m`;
        break;
      }
      case 6: {
        const temp = parseFloat($('#f-temp').value);
        const cond = $('#f-cond').value;
        if (isNaN(temp)) { toast('Enter a valid target temperature.', 'error'); return; }
        payload.targetTemp = temp;
        payload.condition  = cond;
        detailLabel = `${cond === 'above' ? '>' : '<'} ${temp}°C`;
        break;
      }
    }

    payload.detail = detailLabel;
    const saveBtn = $('#modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    await apiSetLogic(payload);

    // If manual, also toggle the relay state
    if (logicType === 1) {
      await apiSetRelay(relayId, payload.state);
    }

    toast('Rule saved successfully!', 'success');
    closeModal();
    // Only refresh if still on dashboard — avoids updating stale/missing DOM
    if (State.currentView === 'dashboard') await refreshStatus();

  } catch (e) {
    toast('Failed to save rule.', 'error');
    console.error(e);
  } finally {
    const saveBtn = $('#modal-save');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Save Rule`; }
  }
}

// ── Wire modal close buttons ──────────────────────
function initModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveRule);

  // Close on backdrop click (but not on container click)
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modal-overlay').hidden) closeModal();
  });
}
