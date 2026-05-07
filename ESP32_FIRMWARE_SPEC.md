# ESP32 Firmware Specification
## For: SmartPlug Relay Controller — Backend (C++ / PlatformIO)

This document is the **complete contract** between the frontend web portal and the ESP32 firmware.
The frontend is already fully built. The firmware must implement everything described here exactly.

---

## 1. Hardware & Platform

| Item | Requirement |
|---|---|
| MCU | ESP32 (any variant with ≥ 4MB flash) |
| Framework | Arduino (via PlatformIO) |
| Filesystem | **LittleFS** (stores the web portal HTML/CSS/JS files) |
| Web Server | **ESPAsyncWebServer** (async, non-blocking) |
| JSON Library | **ArduinoJson v6** |
| Persistence | **Preferences** library (NVS — stores relay config + last states) |
| HTTP Port | **80** |

### Recommended `platformio.ini`
```ini
[env:esp32dev]
platform  = espressif32
board     = esp32dev
framework = arduino

board_build.filesystem = littlefs
board_build.partitions = default.csv

lib_deps =
  ESP Async WebServer
  ArduinoJson@^6
  AsyncTCP

upload_speed   = 921600
monitor_speed  = 115200
```

---

## 2. LittleFS — Serving the Web Portal

The web portal files (HTML/CSS/JS) are uploaded to LittleFS under the `/data` folder.
The server must serve them as static files with correct MIME types.

```cpp
// Mount LittleFS
if (!LittleFS.begin(true)) { /* fatal error */ }

// Serve all static files from root of LittleFS
// index.html is the default for "/"
server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
```

**File structure in LittleFS:**
```
/index.html
/css/app.css
/js/config.js
/js/api.js
/js/ui.js
/js/modal.js
/js/dashboard.js
/js/settings.js
/js/app.js
```

**Critical MIME types** (ESPAsyncWebServer handles these automatically via `serveStatic`):
- `.html` → `text/html`
- `.css`  → `text/css`
- `.js`   → `application/javascript`
- `.json` → `application/json`

---

## 3. Wi-Fi

The firmware should support **Station mode (STA)** — connecting to the user's home Wi-Fi.
Optionally support **AP mode** as a fallback if STA connection fails.

```
STA mode → user opens browser → http://<ESP32_IP>/
AP mode  → user connects to ESP32's own Wi-Fi → http://192.168.4.1/
```

Print the IP address to Serial after connection:
```
IP: 192.168.1.105
```

---

## 4. API Endpoints — Full Specification

All endpoints return `Content-Type: application/json`.
All POST endpoints accept `Content-Type: application/json` body.
All responses must include **CORS headers** (browser requires them):

```cpp
response->addHeader("Access-Control-Allow-Origin",  "*");
response->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
response->addHeader("Access-Control-Allow-Headers", "Content-Type");
```

Also register an OPTIONS handler for preflight:
```cpp
server.onNotFound([](AsyncWebServerRequest* req) {
  if (req->method() == HTTP_OPTIONS) {
    AsyncWebServerResponse* res = req->beginResponse(204);
    res->addHeader("Access-Control-Allow-Origin",  "*");
    res->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res->addHeader("Access-Control-Allow-Headers", "Content-Type");
    req->send(res);
  } else {
    req->send(404);
  }
});
```

---

### 4.1 `GET /api/config`

Returns the current hardware configuration.

**Response:**
```json
{
  "relayCount":   4,
  "pins":         [4, 5, 12, 14],
  "powerOnState": 0
}
```

| Field | Type | Description |
|---|---|---|
| `relayCount` | int | Number of relays (1–8) |
| `pins` | int[] | GPIO pin number for each relay, index 0 = Relay 1 |
| `powerOnState` | int | `0` = Always OFF on boot, `1` = Resume last saved state |

**Source:** Read from **NVS (Preferences)**, not hardcoded.

---

### 4.2 `POST /api/config`

Saves a new hardware configuration sent from the Settings page.

**Request body:**
```json
{
  "relayCount":   6,
  "pins":         [4, 5, 12, 14, 16, 17],
  "powerOnState": 1
}
```

**Actions the firmware must perform:**
1. Save `relayCount`, `pins[]`, `powerOnState` to **NVS**
2. Re-initialise GPIO pins — call `pinMode(pin, OUTPUT)` for each new pin
3. Apply `powerOnState`:
   - If `0`: turn all relays OFF
   - If `1`: restore last known states from NVS
4. Truncate or extend the relay state/logic arrays in RAM to match the new count

**Response:**
```json
{ "ok": true }
```

---

### 4.3 `GET /api/status`

Returns live relay states and sensor data. **Called every 4 seconds by the frontend poller.**

**Response:**
```json
{
  "temperature": 31.5,
  "relays": [
    { "id": 1, "name": "Lab Heater",     "state": true,  "activeLogic": 2, "logicDetail": "28 min left" },
    { "id": 2, "name": "Soldering Iron", "state": false, "activeLogic": 1, "logicDetail": null },
    { "id": 3, "name": "Desk Fan",       "state": true,  "activeLogic": 4, "logicDetail": "Until 11:00 PM" },
    { "id": 4, "name": "LED Strip",      "state": false, "activeLogic": 5, "logicDetail": "Paused (5 min)" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `temperature` | float | Sensor reading in °C. Use `null` if no sensor |
| `relays[].id` | int | Relay index, 1-based |
| `relays[].name` | string | User-assigned name (saved in NVS), default `"Relay N"` |
| `relays[].state` | bool | `true` = ON (GPIO HIGH), `false` = OFF (GPIO LOW) |
| `relays[].activeLogic` | int | Active rule type: 1–6 (see Section 5) |
| `relays[].logicDetail` | string\|null | Human-readable status of the active rule, or `null` |

**`logicDetail` examples by rule type:**

| activeLogic | logicDetail example |
|---|---|
| 1 (Manual) | `null` |
| 2 (Sleep Timer) | `"28 min left"` |
| 3 (Delayed ON) | `"45 min until ON"` |
| 4 (Schedule) | `"Until 11:00 PM"` or `"Starts at 06:00 PM"` |
| 5 (Loop) | `"ON (18 min left)"` or `"Paused (5 min)"` |
| 6 (Temperature) | `"> 35°C"` or `"< 20°C"` |

---

### 4.4 `POST /api/setRelay`

Instantly sets a relay ON or OFF. Called when user clicks the toggle switch.
This sets `activeLogic = 1` (Manual) and cancels any active rule.

**Request body:**
```json
{ "relayId": 2, "state": true }
```

| Field | Type | Description |
|---|---|---|
| `relayId` | int | 1-based relay index |
| `state` | bool | `true` = turn ON, `false` = turn OFF |

**Actions:**
1. `digitalWrite(pin, state ? HIGH : LOW)`
2. Save new state to NVS
3. Cancel any active logic rule for this relay (reset `activeLogic = 1`, `logicDetail = null`)

**Response:**
```json
{ "ok": true }
```

---

### 4.5 `POST /api/setLogic`

Applies a logic rule to a relay. Called when user saves a rule in the modal.

**Request body — common fields (always present):**
```json
{
  "relayId":   1,
  "logicType": 2,
  "detail":    "30 min left"
}
```

**Additional fields per `logicType`:**

#### logicType 1 — Manual
```json
{ "relayId": 1, "logicType": 1, "state": true, "detail": null }
```
→ Same as `POST /api/setRelay`. Set GPIO, save state, clear rule.

#### logicType 2 — Sleep Timer (countdown to OFF)
```json
{ "relayId": 1, "logicType": 2, "minutes": 30, "detail": "30 min left" }
```
→ Turn relay ON immediately. Start countdown. After `minutes` minutes, turn relay OFF.

#### logicType 3 — Delayed ON
```json
{ "relayId": 2, "logicType": 3, "minutes": 120, "detail": "120 min delay" }
```
→ Relay stays OFF. Start countdown. After `minutes` minutes, turn relay ON.
Set `activeLogic = 1` (Manual) after it fires.

#### logicType 4 — Schedule + Duration
```json
{ "relayId": 3, "logicType": 4, "startTime": "18:00", "endTime": "23:00", "detail": "18:00 – 23:00" }
```
→ Every day: turn ON at `startTime`, turn OFF at `endTime`.
Requires the ESP32 to know the current time — use **NTP** (`configTime()`).
`startTime` and `endTime` are 24-hour `"HH:MM"` strings.

#### logicType 5 — Loop Timer
```json
{ "relayId": 4, "logicType": 5, "onMinutes": 20, "offMinutes": 10, "detail": "ON 20m / OFF 10m" }
```
→ Cycle forever: turn ON for `onMinutes`, then OFF for `offMinutes`, repeat.
Start with the ON phase immediately.

#### logicType 6 — Temperature Condition
```json
{ "relayId": 1, "logicType": 6, "targetTemp": 35.0, "condition": "above", "detail": "> 35°C" }
```
→ Poll temperature continuously. If `condition = "above"` and temp > `targetTemp`: turn ON.
If `condition = "below"` and temp < `targetTemp`: turn ON. Otherwise turn OFF.

| Field | Type | Values |
|---|---|---|
| `targetTemp` | float | Target temperature in °C |
| `condition` | string | `"above"` or `"below"` |

---

## 5. Logic Rule Engine — Implementation Guide

Each relay has an associated rule that runs in the background. Implement as a struct array.

### Relay Rule Struct
```cpp
enum LogicType {
  LOGIC_MANUAL    = 1,
  LOGIC_SLEEP     = 2,
  LOGIC_DELAY_ON  = 3,
  LOGIC_SCHEDULE  = 4,
  LOGIC_LOOP      = 5,
  LOGIC_TEMP      = 6
};

struct RelayRule {
  int       relayId;
  LogicType logicType;
  bool      state;          // current GPIO state
  char      name[25];       // relay name

  // Sleep Timer / Delayed ON / Loop
  uint32_t  durationMs;     // total duration in ms
  uint32_t  timerStartMs;   // millis() when timer started
  uint32_t  onDurationMs;   // loop ON duration
  uint32_t  offDurationMs;  // loop OFF duration
  bool      loopPhaseOn;    // true = currently in ON phase

  // Schedule
  uint8_t   startHour, startMin;
  uint8_t   endHour,   endMin;

  // Temperature
  float     targetTemp;
  bool      condAbove;      // true = trigger above, false = trigger below
};
```

### Logic Engine — `loop()` tick

Call a `void tickLogicEngine()` function every second from `loop()`.

```cpp
void tickLogicEngine() {
  for (int i = 0; i < relayCount; i++) {
    RelayRule& r = rules[i];
    switch (r.logicType) {

      case LOGIC_SLEEP: {
        uint32_t elapsed = millis() - r.timerStartMs;
        if (elapsed >= r.durationMs) {
          setRelay(i, false);
          r.logicType = LOGIC_MANUAL;
        }
        break;
      }

      case LOGIC_DELAY_ON: {
        uint32_t elapsed = millis() - r.timerStartMs;
        if (elapsed >= r.durationMs) {
          setRelay(i, true);
          r.logicType = LOGIC_MANUAL;
        }
        break;
      }

      case LOGIC_SCHEDULE: {
        // Requires NTP. Get current hour/min from time_t.
        time_t now = time(nullptr);
        struct tm* t = localtime(&now);
        bool inWindow = isInTimeWindow(t->tm_hour, t->tm_min,
                                       r.startHour, r.startMin,
                                       r.endHour,   r.endMin);
        setRelay(i, inWindow);
        break;
      }

      case LOGIC_LOOP: {
        uint32_t elapsed = millis() - r.timerStartMs;
        if (r.loopPhaseOn && elapsed >= r.onDurationMs) {
          setRelay(i, false);
          r.loopPhaseOn  = false;
          r.timerStartMs = millis();
        } else if (!r.loopPhaseOn && elapsed >= r.offDurationMs) {
          setRelay(i, true);
          r.loopPhaseOn  = true;
          r.timerStartMs = millis();
        }
        break;
      }

      case LOGIC_TEMP: {
        float temp = readTemperature(); // your sensor function
        bool trigger = r.condAbove ? (temp > r.targetTemp)
                                   : (temp < r.targetTemp);
        setRelay(i, trigger);
        break;
      }

      case LOGIC_MANUAL:
      default:
        break;
    }
  }
}
```

### `setRelay()` helper
```cpp
void setRelay(int idx, bool on) {
  rules[idx].state = on;
  digitalWrite(relayPins[idx], on ? HIGH : LOW);
  // Optionally save state to NVS here
}
```

---

## 6. `logicDetail` String Generation

The frontend displays `logicDetail` as a human-readable chip on each relay card.
Generate this string dynamically in `GET /api/status`:

```cpp
// Inside GET /api/status handler, per relay:
char detail[40] = "";

switch (r.logicType) {
  case LOGIC_SLEEP: {
    uint32_t remaining = (r.durationMs - (millis() - r.timerStartMs)) / 60000;
    snprintf(detail, sizeof(detail), "%lu min left", remaining);
    break;
  }
  case LOGIC_DELAY_ON: {
    uint32_t remaining = (r.durationMs - (millis() - r.timerStartMs)) / 60000;
    snprintf(detail, sizeof(detail), "%lu min until ON", remaining);
    break;
  }
  case LOGIC_SCHEDULE: {
    // Check if currently in window or waiting
    snprintf(detail, sizeof(detail), "%02d:%02d – %02d:%02d",
             r.startHour, r.startMin, r.endHour, r.endMin);
    break;
  }
  case LOGIC_LOOP: {
    uint32_t remaining = r.loopPhaseOn
      ? (r.onDurationMs  - (millis() - r.timerStartMs)) / 60000
      : (r.offDurationMs - (millis() - r.timerStartMs)) / 60000;
    snprintf(detail, sizeof(detail), r.loopPhaseOn
      ? "ON (%lu min left)" : "Paused (%lu min)", remaining);
    break;
  }
  case LOGIC_TEMP: {
    snprintf(detail, sizeof(detail), "%s %.1f°C",
             r.condAbove ? ">" : "<", r.targetTemp);
    break;
  }
  default:
    // LOGIC_MANUAL: detail = null (omit from JSON or set to JSON null)
    break;
}
```

---

## 7. NTP Time Sync (Required for Schedule Rule)

```cpp
#include <time.h>

void syncTime() {
  // UTC+6 for Bangladesh, adjust offset for your timezone
  configTime(6 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry++ < 20) delay(500);
}
```

Call `syncTime()` once in `setup()` after Wi-Fi connects.

---

## 8. NVS Persistence (Preferences)

Use the **Preferences** library to store config across reboots.

```cpp
#include <Preferences.h>
Preferences prefs;

// Save config
void saveConfig() {
  prefs.begin("relay_cfg", false);
  prefs.putInt("count",       relayCount);
  prefs.putInt("powerOn",     powerOnState);
  for (int i = 0; i < relayCount; i++) {
    prefs.putInt(("pin" + String(i)).c_str(), relayPins[i]);
    prefs.putBool(("st" + String(i)).c_str(), rules[i].state);
    prefs.putString(("nm" + String(i)).c_str(), rules[i].name);
  }
  prefs.end();
}

// Load config at boot
void loadConfig() {
  prefs.begin("relay_cfg", true);
  relayCount    = prefs.getInt("count",   4);
  powerOnState  = prefs.getInt("powerOn", 0);
  for (int i = 0; i < relayCount; i++) {
    relayPins[i]    = prefs.getInt(("pin" + String(i)).c_str(), defaultPins[i]);
    rules[i].state  = prefs.getBool(("st" + String(i)).c_str(), false);
    String nm       = prefs.getString(("nm" + String(i)).c_str(), "Relay " + String(i+1));
    strncpy(rules[i].name, nm.c_str(), 24);
  }
  prefs.end();
}
```

---

## 9. Temperature Sensor

The frontend displays the value of `temperature` from `GET /api/status`.
Use whichever sensor you have:

| Sensor | Library |
|---|---|
| DS18B20 (1-Wire) | `DallasTemperature` + `OneWire` |
| DHT22 | `DHT sensor library` |
| NTC Thermistor | Analogue read + Steinhart-Hart equation |

Return `null` in the JSON if no sensor is connected:
```cpp
// ArduinoJson: omit the field or set to JSON null
if (sensorAvailable) doc["temperature"] = readTemp();
else                 doc["temperature"] = (char*)nullptr;  // JSON null
```

---

## 10. Power-On State Behaviour

| `powerOnState` value | Behaviour on boot |
|---|---|
| `0` | All relays stay OFF. `activeLogic = 1` (Manual) for all. |
| `1` | Restore each relay's last known state from NVS. `activeLogic = 1` (rules are NOT restored — timers reset). |

> **Note:** Logic rules (timers, schedules) are NOT restored after a reboot. Only the physical relay state (ON/OFF) is restored. This is the expected behaviour — the user re-applies rules if needed.

---

## 11. Relay Name Storage

Relay names are editable by the user in the frontend and saved in `localStorage` on the browser side. However, the firmware should also store and return names via `GET /api/status` so names appear correctly on first load on any new device/browser.

- **Frontend stores names**: in `localStorage` key `sp_names`
- **Firmware stores names**: in NVS (see Section 8)
- **Frontend wins**: if a name exists in `localStorage`, it overrides the name from the API
- **To update firmware name**: the frontend does NOT currently POST names. Add a `POST /api/setName` endpoint if you want names to sync back to the ESP32:

```
POST /api/setName
Body: { "relayId": 1, "name": "Lab Heater" }
Response: { "ok": true }
```

This endpoint is optional but recommended for multi-device use.

---

## 12. Complete API Summary Table

| Method | Endpoint | Called When | Body |
|---|---|---|---|
| GET | `/api/config` | Settings page loads | — |
| POST | `/api/config` | User saves settings | `{ relayCount, pins[], powerOnState }` |
| GET | `/api/status` | Dashboard loads + every 4s | — |
| POST | `/api/setRelay` | User clicks toggle | `{ relayId, state }` |
| POST | `/api/setLogic` | User saves rule in modal | `{ relayId, logicType, ...ruleParams, detail }` |
| POST | `/api/setName` | (Optional) User renames relay | `{ relayId, name }` |

---

## 13. Error Responses

If any operation fails, return:
```json
{ "ok": false, "error": "Descriptive error message" }
```
with HTTP status `500`.

The frontend shows a toast error notification on any non-`ok` response.

---

## 14. Checklist for Gemini / Firmware Developer

- [ ] LittleFS mounted and serving static files from `/`
- [ ] `GET /api/config` reads from NVS, returns correct JSON shape
- [ ] `POST /api/config` saves to NVS, re-inits GPIO pins
- [ ] `GET /api/status` returns all relays with correct `activeLogic` + `logicDetail`
- [ ] `POST /api/setRelay` toggles GPIO, saves to NVS, clears rule
- [ ] `POST /api/setLogic` starts the correct timer/schedule/loop/condition
- [ ] Logic engine runs in `loop()` every ~1 second
- [ ] NTP synced before Schedule rule is usable
- [ ] CORS headers on ALL responses
- [ ] OPTIONS preflight handler registered
- [ ] `powerOnState` respected on boot
- [ ] NVS saves relay names, states, and pin mapping
- [ ] Temperature sensor integrated (or `null` returned if absent)
- [ ] `logicDetail` string generated dynamically in `/api/status`
- [ ] Serial prints ESP32 IP on connect
