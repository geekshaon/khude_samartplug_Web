'use strict';

// ── Core fetch wrapper ────────────────────────────
async function apiFetch(url, opts = {}) {
  // In DEV_MODE skip all network calls entirely (works from file://)
  if (DEV_MODE) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── GET /api/config ───────────────────────────────
async function apiGetConfig() {
  const data = await apiFetch(API.config);
  return data || MOCK_CONFIG;
}

// ── GET /api/status ───────────────────────────────
async function apiGetStatus() {
  const data = await apiFetch(API.status);
  return data || MOCK_STATUS;
}

// ── POST /api/setRelay ────────────────────────────
async function apiSetRelay(relayId, state) {
  if (DEV_MODE) {
    console.log('[Mock] setRelay', { relayId, state });
    // Mutate mock so toggle feels real
    const r = MOCK_STATUS.relays.find(x => x.id === relayId);
    if (r) r.state = state;
    saveMockState(); // persist across refresh
    return { ok: true };
  }
  return apiFetch(API.setRelay, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relayId, state })
  });
}

// ── POST /api/setLogic ────────────────────────────
async function apiSetLogic(payload) {
  if (DEV_MODE) {
    console.log('[Mock] setLogic', payload);
    const r = MOCK_STATUS.relays.find(x => x.id === payload.relayId);
    if (r) {
      r.activeLogic  = payload.logicType;
      r.logicDetail  = payload.detail || null;
    }
    saveMockState(); // persist across refresh
    return { ok: true };
  }
  return apiFetch(API.setLogic, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// ── POST /api/config ──────────────────────────────
async function apiSaveConfig(payload) {
  if (DEV_MODE) {
    console.log('[Mock] saveConfig', payload);

    // 1. Update MOCK_CONFIG fields
    Object.assign(MOCK_CONFIG, payload);

    // 2. Sync MOCK_STATUS.relays to match the new relay count.
    //    Keep existing relay objects (preserving names/states/logic),
    //    append blank objects for any newly added relays,
    //    or trim the array if relays were removed.
    const current = MOCK_STATUS.relays;
    const synced  = [];
    for (let i = 0; i < payload.relayCount; i++) {
      synced.push(current[i] || {
        id:          i + 1,
        name:        `Relay ${i + 1}`,
        state:       false,
        activeLogic: 1,
        logicDetail: null
      });
    }
    MOCK_STATUS.relays = synced;

    // 3. Persist both to localStorage so page refresh remembers the changes
    saveMockState();

    return { ok: true };
  }
  return apiFetch(API.config, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
