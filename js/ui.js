'use strict';

// ── DOM helpers ───────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

// ── Loader ────────────────────────────────────────
function hideLoader() {
  const loader = $('#loader');
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 600);
  $('#app').hidden = false;
  startClock(); // start ticking as soon as app is visible
}

// ── Connection indicator ──────────────────────────
function setConnected(ok) {
  const dot = $('.conn-dot');
  if (!dot) return;
  dot.className = 'conn-dot ' + (ok ? 'connected' : 'error');
  $('#conn-indicator').title = ok ? 'Connected' : 'Disconnected';
}

// ── Temperature chip ──────────────────────────────
function setTemperature(val) {
  const chip = $('#temp-chip');
  if (val == null) { chip.hidden = true; return; }
  chip.hidden = false;
  $('#temp-value').textContent = parseFloat(val).toFixed(1);
}

// ── Live clock ────────────────────────────────────
function startClock() {
  const hhmmEl = document.getElementById('clock-hhmm');
  const ssEl   = document.getElementById('clock-ss');
  if (!hhmmEl) return;
  function tick() {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    const ss  = String(now.getSeconds()).padStart(2, '0');
    hhmmEl.textContent = `${hh}:${mm}`;
    if (ssEl) ssEl.textContent = `:${ss}`;
  }
  tick();
  const delay = 1000 - (Date.now() % 1000);
  setTimeout(() => { tick(); setInterval(tick, 1000); }, delay);
}

// ── Toast notifications ───────────────────────────
function toast(msg, type = 'info') {
  const icons = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
    error:   `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
  };
  const t = el('div', { class: `toast ${type}` });
  t.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${msg}</span>`;
  $('#toast-container').appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 450);
  }, 3000);
}

// ── Active nav tab highlight ──────────────────────
function setActiveNav(view) {
  $$('.nav-link').forEach(a => {
    a.classList.toggle('active', a.id === `nav-${view}`);
  });
}

// ── Generic loading / error placeholders ─────────
function renderLoading(root, msg = 'Loading…') {
  root.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${msg}</p></div>`;
}

function renderError(root, msg, onRetry) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'error-state' },
    el('div', { class: 'err-icon' }, '⚠️'),
    el('p', {}, msg),
    el('button', { class: 'btn btn-primary', onclick: onRetry }, 'Retry')
  ));
}

// ── Logic detail label ────────────────────────────
function logicChipHTML(activeLogic, logicDetail) {
  const t = LOGIC_TYPES.find(x => x.id === activeLogic);
  if (!t) return '';
  const detail = logicDetail ? ` · ${logicDetail}` : '';
  const isManual = activeLogic === 1;
  return `<div class="active-rule">
    <span class="rule-chip ${isManual ? 'manual' : ''}">
      <span>${t.icon}</span>
      <span>${t.label}${detail}</span>
    </span>
  </div>`;
}
