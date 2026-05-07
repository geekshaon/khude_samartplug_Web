'use strict';

// ── API Endpoints ─────────────────────────────────
const API = {
  config:   '/api/config',
  status:   '/api/status',
  setLogic: '/api/setLogic',
  setRelay: '/api/setRelay',
};

// ── Dev / Mock toggle ─────────────────────────────
// Set DEV_MODE = false when running on the actual ESP32
const DEV_MODE = true;

// ── Mock Data ─────────────────────────────────────
const MOCK_CONFIG = {
  relayCount: 4,
  pins: [4, 5, 12, 14],
  powerOnState: 0
};

const MOCK_STATUS = {
  temperature: 31.5,
  relays: [
    { id: 1, name: 'Lab Heater',     state: true,  activeLogic: 2, logicDetail: '28 min left' },
    { id: 2, name: 'Soldering Iron', state: false, activeLogic: 1, logicDetail: null },
    { id: 3, name: 'Desk Fan',       state: true,  activeLogic: 4, logicDetail: 'Until 11:00 PM' },
    { id: 4, name: 'LED Strip',      state: false, activeLogic: 5, logicDetail: 'Paused (5 min)' }
  ]
};

// ── Logic Type Definitions ────────────────────────
const LOGIC_TYPES = [
  { id: 1, label: 'Manual',      icon: '⚡', desc: 'Direct ON/OFF control' },
  { id: 2, label: 'Sleep Timer', icon: '⏲', desc: 'Countdown then turn OFF' },
  { id: 3, label: 'Delayed ON',  icon: '⏳', desc: 'Turn ON after a delay' },
  { id: 4, label: 'Schedule',    icon: '📅', desc: 'ON at a time, OFF at a time' },
  { id: 5, label: 'Loop',        icon: '🔁', desc: 'Cycle ON/OFF repeatedly' },
  { id: 6, label: 'Temperature', icon: '🌡', desc: 'Trigger on temperature' }
];

// ── Shared Application State ──────────────────────
const State = {
  config:           null,   // from /api/config
  status:           null,   // from /api/status
  relayNames:       {},     // persisted in localStorage
  currentView:      'dashboard',
  pollingInterval:  null,
  modal: {
    relayId:        null,
    logicType:      1,
    manualState:    true,
  }
};

// ── LocalStorage helpers ──────────────────────────
function saveNames() {
  localStorage.setItem('sp_names', JSON.stringify(State.relayNames));
}

function loadNames() {
  try {
    State.relayNames = JSON.parse(localStorage.getItem('sp_names') || '{}');
  } catch (_) {
    State.relayNames = {};
  }
}

// ── Mock persistence (DEV_MODE only) ─────────────
// Saves the current MOCK_CONFIG + MOCK_STATUS to localStorage
// so that settings changes survive a page refresh.
function saveMockState() {
  localStorage.setItem('sp_mock_config', JSON.stringify(MOCK_CONFIG));
  localStorage.setItem('sp_mock_status', JSON.stringify(MOCK_STATUS));
}

// Restores MOCK_CONFIG + MOCK_STATUS from localStorage (if previously saved).
// Called once at boot before any view renders.
function loadMockState() {
  if (!DEV_MODE) return;
  try {
    const cfg = localStorage.getItem('sp_mock_config');
    const sts = localStorage.getItem('sp_mock_status');
    if (cfg) Object.assign(MOCK_CONFIG, JSON.parse(cfg));
    if (sts) Object.assign(MOCK_STATUS, JSON.parse(sts));
  } catch (_) {
    // silently ignore — defaults stay in place
  }
}
