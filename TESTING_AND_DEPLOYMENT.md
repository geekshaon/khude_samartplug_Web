# SmartPlug – Testing & Deployment Guide

---

## Part 1 — Local Development (No ESP32 Required)

### Prerequisites
- Any modern browser (Chrome, Firefox, Edge)
- Python 3 **or** Node.js (for a local HTTP server)
- A code editor (VS Code recommended)

### Step 1 — Confirm DEV_MODE is ON

Open `js/config.js` and verify:

```js
const DEV_MODE = true;  // ← must be true for local testing
```

When `DEV_MODE = true`:
- All `fetch()` calls are skipped entirely
- The app uses `MOCK_CONFIG` and `MOCK_STATUS` defined in the same file
- No ESP32 or network is needed

---

### Step 2 — Start a Local HTTP Server

You **cannot** open `index.html` directly via `file://` in some browsers due to CORS restrictions on script loading. Use a local server instead.

**Option A — Python (recommended, no install needed on most systems):**
```bash
cd d:\PlatformIO\Projects\Khude_smart_plug\web_app
python -m http.server 7890
```
Then open: **http://localhost:7890**

**Option B — Node.js (`npx`):**
```bash
cd d:\PlatformIO\Projects\Khude_smart_plug\web_app
npx -y serve -p 7890
```
Then open: **http://localhost:7890**

**Option C — VS Code Live Server extension:**
- Right-click `index.html` → "Open with Live Server"

---

### Step 3 — What to Test Locally

#### Dashboard
| Action | Expected Result |
|---|---|
| Page loads | Loader spins ~0.9s, then 4 relay cards appear |
| Relay 1 (Lab Heater) | Shows as ON (green glow, green toggle, pulse dot) |
| Relay 2 (Soldering Iron) | Shows as OFF (dark card, gray toggle) |
| Click a toggle | Card state changes instantly, toast notification appears |
| Wait 4 seconds | Status auto-refreshes (polling cycle) |
| Click relay name | Name becomes editable input |
| Edit name + Enter | Name saves, toast "Name updated" appears |
| Refresh page | Edited name persists (stored in localStorage) |

#### Logic Rule Modal
| Action | Expected Result |
|---|---|
| Click "Add Rule / Schedule" | Modal slides up from bottom (mobile) or scales in (desktop) |
| Click each tab pill | Form content changes to match rule type |
| **Manual** tab | Shows ON / OFF state buttons |
| **Sleep Timer** tab | Shows minutes input field |
| **Delayed ON** tab | Shows minutes input field |
| **Schedule** tab | Shows two `<input type=time>` pickers |
| **Loop** tab | Shows ON-minutes + OFF-minutes inputs |
| **Temperature** tab | Shows target °C input + Above/Below dropdown |
| Click Save with empty field | Shows validation error toast, does NOT close modal |
| Fill in valid values + Save | Toast "Rule saved", modal closes, rule chip updates on card |
| Click backdrop / Press Escape | Modal closes without saving |

#### Settings Page
| Action | Expected Result |
|---|---|
| Click "Settings" in navbar | Settings page renders with 3 cards |
| Change relay count to 6 | Pin grid instantly shows 6 GPIO inputs |
| Change relay count to 2 | Pin grid shrinks to 2 GPIO inputs |
| Enter invalid GPIO (e.g. 99) | Save shows error toast |
| Fill valid data + Save | Toast "Configuration saved!" appears |

---

### Step 4 — Customise Mock Data

To test with different relay counts or states, edit `js/config.js`:

```js
const MOCK_CONFIG = {
  relayCount: 6,          // change relay count
  pins: [4, 5, 12, 14, 16, 17],
  powerOnState: 1
};

const MOCK_STATUS = {
  temperature: 28.3,
  relays: [
    { id: 1, name: 'Pump',       state: true,  activeLogic: 5, logicDetail: 'ON 20m / OFF 10m' },
    { id: 2, name: 'Heater',     state: false, activeLogic: 6, logicDetail: '> 35°C' },
    { id: 3, name: 'Fan',        state: true,  activeLogic: 4, logicDetail: '08:00 – 20:00' },
    { id: 4, name: 'Light',      state: false, activeLogic: 1, logicDetail: null },
    { id: 5, name: 'Exhaust',    state: true,  activeLogic: 2, logicDetail: '15 min left' },
    { id: 6, name: 'Sprinkler',  state: false, activeLogic: 3, logicDetail: '60 min delay' },
  ]
};
```

Refresh the browser after saving — changes appear immediately.

---

### Step 5 — Browser DevTools Tips

- Open **F12 → Console**: All mock API calls are logged as `[Mock] setRelay {...}` and `[Mock] setLogic {...}`
- Open **F12 → Application → Local Storage**: See/clear saved relay names under key `sp_names`
- Open **F12 → Network**: In DEV_MODE, no network requests will appear (fetch is skipped)
- Test mobile layout: F12 → Toggle device toolbar → Select iPhone 12 Pro (390px)

---

---

## Part 2 — ESP32 Production Integration

### Prerequisites
- PlatformIO IDE (VS Code extension)
- ESP32 board with at least 4MB flash
- `ESPAsyncWebServer` and `ArduinoJson` libraries

---

### Step 1 — platformio.ini Configuration

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

; Use LittleFS for the web files
board_build.filesystem = littlefs

; Partition scheme with enough space for both app + filesystem
board_build.partitions = default.csv

lib_deps =
  ESP Async WebServer
  ArduinoJson@^6
  AsyncTCP

; Optional: increase upload speed
upload_speed = 921600
monitor_speed = 115200
```

---

### Step 2 — Folder Structure for PlatformIO

PlatformIO expects web files inside a `data/` folder at the project root:

```
Khude_smart_plug/
├── src/
│   └── main.cpp          ← ESP32 firmware
├── data/                 ← THIS is what gets uploaded to LittleFS
│   ├── index.html
│   ├── css/
│   │   └── app.css
│   └── js/
│       ├── config.js
│       ├── api.js
│       ├── ui.js
│       ├── modal.js
│       ├── dashboard.js
│       ├── settings.js
│       └── app.js
└── platformio.ini
```

> **Action:** Copy everything from `web_app/` into `data/` — excluding `README.md` and the testing guide.

---

### Step 3 — Disable DEV_MODE

Open `data/js/config.js` and set:

```js
const DEV_MODE = false;  // ← real ESP32 fetch calls
```

**Do this before every production upload.**

---

### Step 4 — ESP32 Firmware (`src/main.cpp`) — Minimum Template

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

const char* SSID     = "YOUR_WIFI_SSID";
const char* PASSWORD = "YOUR_WIFI_PASSWORD";

AsyncWebServer server(80);

// ── Relay state storage ──────────────────────────
const int RELAY_PINS[] = {4, 5, 12, 14};
const int RELAY_COUNT  = 4;
bool relayStates[RELAY_COUNT] = {false};

// ── Serve static files from LittleFS ────────────
void setupStaticFiles() {
  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
}

// ── GET /api/config ──────────────────────────────
void handleGetConfig(AsyncWebServerRequest* req) {
  StaticJsonDocument<256> doc;
  doc["relayCount"]   = RELAY_COUNT;
  doc["powerOnState"] = 0;
  JsonArray pins = doc.createNestedArray("pins");
  for (int i = 0; i < RELAY_COUNT; i++) pins.add(RELAY_PINS[i]);

  String out;
  serializeJson(doc, out);
  req->send(200, "application/json", out);
}

// ── GET /api/status ──────────────────────────────
void handleGetStatus(AsyncWebServerRequest* req) {
  StaticJsonDocument<512> doc;
  doc["temperature"] = 31.5;  // replace with real sensor read

  JsonArray relays = doc.createNestedArray("relays");
  for (int i = 0; i < RELAY_COUNT; i++) {
    JsonObject r = relays.createNestedObject();
    r["id"]          = i + 1;
    r["name"]        = "Relay " + String(i + 1);
    r["state"]       = relayStates[i];
    r["activeLogic"] = 1;
    r["logicDetail"] = nullptr;
  }

  String out;
  serializeJson(doc, out);
  req->send(200, "application/json", out);
}

// ── POST /api/setRelay ───────────────────────────
void handleSetRelay(AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
  StaticJsonDocument<128> doc;
  deserializeJson(doc, data, len);

  int  relayId = doc["relayId"];
  bool state   = doc["state"];
  int  idx     = relayId - 1;

  if (idx >= 0 && idx < RELAY_COUNT) {
    relayStates[idx] = state;
    digitalWrite(RELAY_PINS[idx], state ? HIGH : LOW);
  }
  req->send(200, "application/json", "{\"ok\":true}");
}

// ── POST /api/setLogic ───────────────────────────
void handleSetLogic(AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, data, len);
  // TODO: implement logic engine based on logicType
  // doc["relayId"], doc["logicType"], doc["minutes"], doc["startTime"], etc.
  req->send(200, "application/json", "{\"ok\":true}");
}

// ── POST /api/config ─────────────────────────────
void handleSaveConfig(AsyncWebServerRequest* req, uint8_t* data, size_t len, size_t, size_t) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, data, len);
  // TODO: save relayCount + pins to NVS/Preferences
  req->send(200, "application/json", "{\"ok\":true}");
}

// ── CORS headers (for browser requests) ─────────
void addCorsHeaders(AsyncWebServerResponse* res) {
  res->addHeader("Access-Control-Allow-Origin",  "*");
  res->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res->addHeader("Access-Control-Allow-Headers", "Content-Type");
}

void setup() {
  Serial.begin(115200);

  // Init relay pins
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
  }

  // Mount LittleFS
  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed!");
    return;
  }

  // Connect to Wi-Fi
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("IP: " + WiFi.localIP().toString());

  // Register routes
  setupStaticFiles();
  server.on("/api/config", HTTP_GET,  handleGetConfig);
  server.on("/api/status", HTTP_GET,  handleGetStatus);

  server.on("/api/setRelay", HTTP_POST,
    [](AsyncWebServerRequest* r){},
    nullptr, handleSetRelay);

  server.on("/api/setLogic", HTTP_POST,
    [](AsyncWebServerRequest* r){},
    nullptr, handleSetLogic);

  server.on("/api/config", HTTP_POST,
    [](AsyncWebServerRequest* r){},
    nullptr, handleSaveConfig);

  server.begin();
}

void loop() {
  // Logic engine timers go here (check intervals, fire relay actions)
}
```

---

### Step 5 — Upload Web Files to LittleFS

```bash
# From the PlatformIO project root (where platformio.ini is):
pio run --target uploadfs
```

This uploads everything inside `data/` to LittleFS on the ESP32.

---

### Step 6 — Upload Firmware

```bash
pio run --target upload
```

---

### Step 7 — Access the Portal

1. Open Serial Monitor (`pio device monitor`)
2. Find the IP address printed: e.g. `IP: 192.168.1.105`
3. Open a browser on the same Wi-Fi network
4. Navigate to: **http://192.168.1.105**

The portal loads directly from the ESP32's LittleFS flash.

---

### Step 8 — First-Time Configuration

1. Go to **Settings** tab in the portal
2. Set the correct **Number of Relays** (e.g. 4)
3. Set the correct **GPIO pin** for each relay
4. Choose **Power-On State** (Always OFF or Resume Last State)
5. Click **Save Configuration**
6. Return to **Dashboard** — relay cards render based on live ESP32 data

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Page loads but cards don't appear | `DEV_MODE` still `true` in config.js | Set `DEV_MODE = false`, re-upload filesystem |
| 404 on `/api/status` | Routes not registered in `main.cpp` | Add `server.on("/api/status", ...)` |
| Portal not loading at all | LittleFS not mounted or files not uploaded | Run `pio run --target uploadfs` again |
| Toggle works but state resets | `relayStates[]` not persisted | Save to `Preferences` (NVS) in `handleSetRelay` |
| Blank page on ESP32 | Wrong MIME type for `.js`/`.css` | `serveStatic` handles this automatically via LittleFS |
| CORS error in browser console | Missing CORS headers on API routes | Add `addCorsHeaders()` to each response |
| Temperature shows `--.-` | `/api/status` not returning `temperature` field | Add sensor read to `handleGetStatus` |

---

## Quick Reference — Re-deploy After Changes

```bash
# 1. Edit files in data/
# 2. Set DEV_MODE = false in data/js/config.js
# 3. Upload filesystem
pio run --target uploadfs
# 4. Hard-refresh browser (Ctrl + Shift + R)
```

No firmware re-flash needed for web-only changes.
