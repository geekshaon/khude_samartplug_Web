# SmartPlug – ESP32 Relay Controller Web Portal

## Project Purpose
A lightweight, offline-first, mobile-first Web Portal served directly from an **ESP32 microcontroller's LittleFS flash memory**. It allows users to monitor and control multiple relay outputs over a local Wi-Fi network via a browser — no internet required.

---

## Tech Stack & Why

| Choice | Reason |
|---|---|
| Pure HTML + Vanilla CSS + Vanilla JS | Zero build tooling. Files upload directly to LittleFS. Total size < 55 KB raw |
| No frameworks (no React, Vue, etc.) | ESP32 LittleFS budget ≈ 1.5 MB. Frameworks are too heavy |
| Inline SVG icons | No icon font CDN dependency. Works fully offline |
| System font stack | No Google Fonts CDN. `-apple-system, Segoe UI, Roboto` looks premium on mobile |
| Hash-based SPA router | Single `index.html` — ESP32 only needs to serve one file route |
| `fetch()` API | Native browser API, no library needed |

---

## File Structure

```
web_app/
├── index.html          ← SPA shell: navbar, main placeholder, modal skeleton
├── css/
│   └── app.css         ← Full design system (tokens, layout, components, animations)
└── js/
    ├── config.js       ← Constants, mock data, shared State object  [LOAD FIRST]
    ├── api.js          ← All fetch() wrappers with DEV_MODE mock fallback
    ├── ui.js           ← DOM helpers ($, $$, el), loader, toasts, nav, error states
    ├── modal.js        ← Logic Rule modal: 6 rule forms, tab switching, POST handler
    ├── dashboard.js    ← Relay grid renderer, card builder, toggle, name edit, polling
    ├── settings.js     ← Settings page: relay count, GPIO pin grid, save handler
    └── app.js          ← Hash router + DOMContentLoaded boot entry point [LOAD LAST]
```

**Script load order in index.html matters:**
`config.js` → `api.js` → `ui.js` → `modal.js` → `dashboard.js` → `settings.js` → `app.js`

Each file uses globals from the files loaded before it. There is no module bundler.

---

## Architecture: Single-Page Application

The app has **two views** rendered inside `<main id="view-root">` by swapping its innerHTML:

| Hash | View | File |
|---|---|---|
| `#dashboard` | Control Panel (relay cards) | `dashboard.js` |
| `#settings` | System Settings form | `settings.js` |

The router lives in `app.js → route()` and fires on `window.hashchange`.

---

## Global State Object (`config.js`)

```js
const State = {
  config: null,          // from GET /api/config
  status: null,          // from GET /api/status
  relayNames: {},        // { relayId: "Custom Name" } — persisted in localStorage
  currentView: 'dashboard',
  pollingInterval: null, // setInterval handle for 4s status refresh
  modal: {
    relayId: null,       // which relay the modal is editing
    logicType: 1,        // selected rule type (1–6)
    manualState: true,   // for rule type 1 (Manual)
  }
};
```

---

## DEV_MODE (`config.js` + `api.js`)

```js
const DEV_MODE = true;  // ← change to false on ESP32
```

- **`true`**: All `apiFetch()` calls return `null` immediately (no network). Functions fall back to `MOCK_CONFIG` / `MOCK_STATUS`. The app runs from `file://` or any local server with no ESP32 present.
- **`false`**: Real `fetch()` calls go to the ESP32 endpoints with a 5-second timeout.

**Mock data** is defined in `config.js` as `MOCK_CONFIG` and `MOCK_STATUS`. Mutating mock data (e.g. toggle state) makes the UI feel live during development.

---

## API Endpoints

| Method | URL | Request Body | Response |
|---|---|---|---|
| `GET` | `/api/config` | — | `{ relayCount, pins[], powerOnState }` |
| `GET` | `/api/status` | — | `{ temperature, relays[{ id, name, state, activeLogic, logicDetail }] }` |
| `POST` | `/api/setRelay` | `{ relayId, state }` | `{ ok }` |
| `POST` | `/api/setLogic` | `{ relayId, logicType, ...ruleParams, detail }` | `{ ok }` |
| `POST` | `/api/config` | `{ relayCount, pins[], powerOnState }` | `{ ok }` |

`powerOnState`: `0` = Always OFF, `1` = Resume Last State.

---

## Dashboard View (`dashboard.js`)

### Boot sequence
1. `renderDashboard()` calls `Promise.all([apiGetConfig(), apiGetStatus()])`
2. Renders page header + relay grid
3. Calls `startPolling()` → `setInterval(refreshStatus, 4000)`

### `refreshStatus()`
Calls `apiGetStatus()` and runs `updateCardStates()` — a **fast DOM patch** (no full re-render). Only updates: card `.is-on` class, status dot class, toggle checkbox, and rule chip text.

### Relay Card HTML structure
```
div.relay-card[id="card-{id}"]  ← .is-on added when relay.state === true
  div.card-top
    div
      div.card-id-badge          ← "RELAY 1 · GPIO 4"
      div.card-name-wrap
        span.status-dot          ← animated green pulse when ON
        span.card-name           ← click to inline-edit (becomes <input>)
    label.toggle                 ← checkbox + .toggle-track (CSS toggle)
  div.card-divider
  div.active-rule-wrap           ← rule chip (icon + label + detail)
  button.btn-add-rule            ← onclick="openModal(relayId)"
```

### Inline Name Editing
Clicking `.card-name` replaces it with `<input>`. On blur/Enter, saves to `State.relayNames[relayId]` and `localStorage`. On Escape, reverts. Names in `localStorage` override names from the API.

---

## Logic Modal (`modal.js`)

### Opening
`openModal(relayId)` — called from card's "Add Rule" button:
1. Sets `State.modal.relayId` and `State.modal.logicType` from current relay data
2. Renders 6 pill tabs via `renderRuleTabs()`
3. Renders form body via `renderModalBody()` → `getRuleFormHTML(logicType)`
4. Sets `#modal-overlay` `hidden = false`

### 6 Rule Types

| ID | Name | Fields | POST params |
|---|---|---|---|
| 1 | Manual | ON / OFF buttons | `{ state }` |
| 2 | Sleep Timer | Minutes input | `{ minutes }` |
| 3 | Delayed ON | Minutes input | `{ minutes }` |
| 4 | Schedule | Start time + End time | `{ startTime, endTime }` |
| 5 | Loop Timer | ON-mins + OFF-mins | `{ onMinutes, offMinutes }` |
| 6 | Temperature | Target °C + condition | `{ targetTemp, condition: 'above'|'below' }` |

All payloads also include `{ relayId, logicType, detail }` where `detail` is a human-readable string shown in the rule chip (e.g. `"28 min left"`, `"18:00 – 23:00"`).

### Closing
`closeModal()` fades the overlay to opacity 0, scales the container to 0.95, then sets `hidden = true` after 300ms. Escape key and backdrop click also close the modal.

### Saving
`saveRule()` reads form values, validates, builds payload, calls `apiSetLogic()`. If rule type is Manual, also calls `apiSetRelay()` to update state immediately. On success: shows toast, calls `closeModal()`, calls `refreshStatus()`.

---

## Settings View (`settings.js`)

1. Loads `apiGetConfig()` and renders 3 glassmorphism cards
2. **Relay count input** (`#cfg-count`) triggers `rebuildPinInputs()` on every keystroke — dynamically renders N `<input type=number>` fields for GPIO pins
3. **Power-on state** dropdown: 0 = Always OFF, 1 = Resume Last State
4. **Save** → validates all GPIO values (0–39), calls `apiSaveConfig({ relayCount, pins, powerOnState })`

---

## CSS Design System (`css/app.css`)

### Key CSS variables
```css
--bg: #080c14          /* deep navy-black */
--card: rgba(255,255,255,.035)  /* glassmorphism surface */
--accent: #7c3aed      /* electric violet */
--accent2: #a78bfa     /* soft violet for text/icons */
--on: #10b981          /* emerald green (relay ON) */
--off: #374151         /* gray (relay OFF) */
--blur: blur(20px)     /* backdrop-filter value */
--tr: .35s cubic-bezier(.4,0,.2,1)  /* standard transition */
```

### Critical CSS rule
```css
[hidden] { display: none !important; }
```
This overrides `display:flex` on `.modal-overlay` and `.app` so the HTML `hidden` attribute works correctly.

### Toggle Switch implementation
Pure CSS. `<input type=checkbox>` is `opacity:0`. The visible `.toggle-track` uses `::after` pseudo-element as the thumb. `input:checked ~ .toggle-track` applies green gradient + glow. Thumb slides via `translateX(24px)`.

### Responsive grid
```css
/* Mobile first */
.relay-grid { grid-template-columns: 1fr; }
@media(min-width:540px) { grid-template-columns: 1fr 1fr; }
@media(min-width:900px) { grid-template-columns: 1fr 1fr 1fr; }
```

---

## ESP32 Backend Requirements (for future AI context)

The backend is C++ using **ESPAsyncWebServer** + **LittleFS**.

The server must:
1. Serve `index.html` at `/` and `/index.html`
2. Serve static files from LittleFS with correct MIME types:
   - `.css` → `text/css`
   - `.js` → `application/javascript`
3. Implement the 5 JSON API endpoints listed above
4. Parse POST body as JSON (use `ArduinoJson` library)
5. Store relay config and last state in NVS or SPIFFS

Recommended `platformio.ini` settings:
```ini
board_build.filesystem = littlefs
lib_deps =
  ESP Async WebServer
  ArduinoJson
```

Upload web files: `pio run --target uploadfs`

---

## Deployment Checklist

- [ ] Set `DEV_MODE = false` in `js/config.js`
- [ ] Verify all 5 API endpoints are implemented in C++
- [ ] Run `pio run --target uploadfs` to upload `web_app/` to LittleFS
- [ ] Flash firmware: `pio run --target upload`
- [ ] Connect to ESP32's Wi-Fi (AP mode) or local network (STA mode)
- [ ] Open browser → `http://192.168.x.x/`
- [ ] Go to Settings → set relay count + GPIO pins → Save
- [ ] Dashboard should show live relay states

---

## Known Patterns & Gotchas for Future AI

1. **No module system** — all JS files share the global `window` scope. Functions defined in earlier-loaded scripts are available to later ones.
2. **`$()` and `$$()` helpers** are defined in `ui.js`. They are NOT available before `ui.js` loads. Inside `modal.js`, prefer `document.getElementById()` for elements that exist in static HTML.
3. **Mock data mutation** — `MOCK_STATUS.relays` is mutated directly in `api.js` when `DEV_MODE = true`, so toggle state changes persist across polling cycles during development.
4. **Polling stops on Settings view** — `stopPolling()` is called in `renderSettings()` to avoid unnecessary background requests when the user is on the settings page.
5. **Card re-render vs. patch** — `buildDashboard()` does a full `innerHTML` reset (called once on view load). `updateCardStates()` does a targeted DOM patch (called every 4s by the poller). Never call `buildDashboard()` from the poller.
6. **Modal hidden state** — `#modal-overlay` uses the HTML `hidden` attribute. The CSS rule `[hidden]{display:none !important}` is required because `.modal-overlay` has `display:flex` which would otherwise override `hidden`.
7. **Relay names** — `State.relayNames` is the source of truth for displayed names. It is loaded from `localStorage` on boot and saved on every edit. API-returned names are only used as fallback when no localStorage entry exists.
8. **`activeLogic` field** — integer 1–6 matching the `LOGIC_TYPES` array index by `id`. Used to select the right chip icon/label and pre-select the right tab when the modal opens.

---

## File Size Budget

Measured sizes of all deployable files (README excluded):

| File | Raw Size |
|---|---|
| `css/app.css` | 20.23 KB |
| `js/modal.js` | 11.77 KB |
| `js/dashboard.js` | 6.58 KB |
| `js/settings.js` | 6.37 KB |
| `index.html` | 5.39 KB |
| `js/ui.js` | 4.04 KB |
| `js/api.js` | 2.57 KB |
| `js/config.js` | 2.48 KB |
| `js/app.js` | 0.82 KB |
| **Total (raw)** | **60.24 KB** |
| **Total (gzip est.)** | **~18–20 KB** |

ESP32 LittleFS partition: **~1,536 KB**
Portal usage: **~60 KB = 4% of available flash**

> ESPAsyncWebServer supports `Content-Encoding: gzip`. Pre-compressing files with gzip before uploading to LittleFS reduces transfer time over Wi-Fi significantly. To do this, run `gzip -k *.css *.js *.html` and serve the `.gz` variants with the original MIME type.
