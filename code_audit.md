# Smart Relay Portal — Full Code Audit

Scanned: `index.html`, `config.js`, `api.js`, `ui.js`, `app.js`, `dashboard.js`, `modal.js`, `settings.js`

---

## 🔴 Critical Bugs

### 1. `handleToggle` — active count is calculated *after* optimistic state update but reads the already-mutated `State.status`
**File:** `dashboard.js` · Line 391

```js
applyCardState(relayId, newState);          // ← mutates State.status.relays[i].state
const onCount = State.status.relays.filter(r => r.state).length;  // ← reads the mutated array
```
`applyCardState()` line 56 sets `r.state = on`, so when `handleToggle` reads `State.status` two lines later, the count is already correct by accident — **but only because the optimistic update and the count read happen on the same relay object**. This is fragile: if `applyCardState` is ever async or the relay isn't in `State.status`, the count will be wrong.

**Fix:** Calculate `onCount` before calling `applyCardState`, or re-derive it from `newState` directly.

---

### 2. `modal.js` — duplicate `id="f-minutes"` on cases 2 and 3
**File:** `modal.js` · Lines 33, 46

```html
<!-- case 2 -->
<input id="f-minutes" ...>
<!-- case 3 — same id! -->
<input id="f-minutes" ...>
```
Only one case renders at a time so it's **functionally fine**, but it's an HTML validity error and will confuse screen readers / automated tests. Give them distinct IDs (`f-minutes-timer` / `f-minutes-delay`).

---

### 3. `modal.js` `case 6` — `const` declaration inside `switch` without a block
**File:** `modal.js` · Line 88

```js
case 6:
  const tempDisplay = ...; // ← const/let inside switch without braces is a strict-mode error in some engines
```
This is **technically a syntax error** in strict mode on some browsers/engines. It works in Chrome V8 today but will break on Safari older versions or ESLint strict configs.

**Fix:** Wrap case 6 in `{ }`:
```js
case 6: {
  const tempDisplay = ...;
  ...
  break;
}
```

---

## 🟠 Functional Bugs

### 4. `settings.js` — `stepRelay()` calls `rebuildPinInputs()` with no args, so it uses stale `State.config.pins`
**File:** `settings.js` · Line 108

```js
function stepRelay(delta) {
  ...
  rebuildPinInputs();  // ← passes no existingPins
}
```
`rebuildPinInputs()` without args falls back to `State.config.pins` (the *saved* config, not the current inputs). So if the user has already edited pin values and then clicks `+`/`−`, the pin fields **reset to the last-saved values**. 

**Fix:** Collect current input values before rebuilding:
```js
function stepRelay(delta) {
  const el = $('#cfg-count');
  if (!el) return;
  const oldCount = parseInt(el.value, 10) || 1;
  // Capture currently typed pin values before rebuilding
  const currentPins = Array.from({ length: oldCount }, (_, i) => {
    const inp = $(`#pin-${i}`);
    return inp ? parseInt(inp.value, 10) : undefined;
  });
  el.value = Math.min(8, Math.max(1, oldCount + delta));
  rebuildPinInputs(currentPins);
}
```

---

### 5. `settings.js` — `rebuildPinInputs()` uses `State.config.pins` which is `null` on first page load if settings renders before config is fetched
**File:** `settings.js` · Line 136

```js
const pins = existingPins || (State.config ? State.config.pins : []);
```
`State.config` is `null` at boot until `apiGetConfig()` resolves. In `buildSettingsPage()`, `rebuildPinInputs(config.pins)` is called with the fetched config object so this is fine *normally*, but `stepRelay()` calls `rebuildPinInputs()` with no args — if the race condition hits (unlikely but possible), it renders empty pin inputs.

**Mitigated by fix #4 above** (passing current values explicitly).

---

### 6. `modal.js` — `saveRule()` calls `refreshStatus()` after close, but if the user navigated away, `refreshStatus()` will call `updateHealthBar()` and `updateCardStates()` on stale/missing DOM
**File:** `modal.js` · Line 246

```js
closeModal();
await refreshStatus(); // ← no check that we're still on dashboard view
```
If the user somehow triggers a navigation between `closeModal()` and `await refreshStatus()`, `updateCardStates()` and `updateHealthBar()` will silently fail (they use `getElementById` which returns `null`) — **no crash, but the status poll is wasted**. Low risk but worth guarding.

**Fix:**
```js
if (State.currentView === 'dashboard') await refreshStatus();
```

---

### 7. `ui.js` `renderError()` — `onRetry` passed to `el()` as a string attribute, not an event listener
**File:** `ui.js` · Line 98

```js
el('button', { class: 'btn btn-primary', onclick: onRetry }, 'Retry')
```
Looking at the `el()` helper (lines 11-12):
```js
else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
```
`onclick` → `addEventListener('click', onRetry)` — this is **actually correct** because `el()` converts `on*` keys into `addEventListener` calls. ✅ No bug here, just a non-obvious pattern.

---

## 🟡 Dead / Orphaned Code

### 8. `ui.js` — `logicChipHTML()` function is never called anywhere
**File:** `ui.js` · Lines 103–114

```js
function logicChipHTML(activeLogic, logicDetail) { ... }
```
`dashboard.js` uses `logicChipInline()` (defined in `dashboard.js` itself). The `logicChipHTML()` in `ui.js` is a **dead function** — leftover from an earlier implementation. Safe to delete.

---

### 9. `ui.js` — `el()` helper is defined but only used in `renderError()`
**File:** `ui.js` · Lines 7–19

`el()` is a nice DOM builder utility but is only used once (in `renderError()`). All other code uses `document.createElement` + `innerHTML`. Not a bug, but it's inconsistent — either adopt it everywhere or replace the one use with `innerHTML` and remove `el()`.

---

### 10. `modal.js` — `inputClass` / `selClass` local variables are unnecessary
**File:** `modal.js` · Lines 5–6

```js
const inputClass = 'form-input';
const selClass   = 'form-select';
```
These are used directly in template literals throughout `getRuleFormHTML`. They exist because `form-input` and `form-select` CSS classes were previously styled globally. After the settings redesign, these classes (`form-input`, `form-select`) are **no longer defined in `app.css`** — the modal inputs fall back to browser defaults. The constants themselves are harmless but the **missing CSS is a real visual regression** (modal form inputs are now unstyled).

**Fix:** Either add back `form-input` / `form-select` / `form-group` / `form-label` / `form-hint` CSS rules, or update `getRuleFormHTML` to use the new `sc-*` classes.

---

### 11. `config.js` — `MOCK_STATUS` relay `id` values (1-based) must always match `MOCK_CONFIG.relayCount`
**File:** `config.js` · Lines 28–33

Currently the mock has 4 relays and `relayCount: 4` — they match. But if `loadMockState()` loads a saved config where `relayCount` changed, `MOCK_STATUS.relays` could have a different length than `MOCK_CONFIG.relayCount`. The `apiSaveConfig()` mock does sync them, but `loadMockState()` does `Object.assign` on both independently — if the localStorage entries are out of sync (e.g. one was cleared), mismatch occurs.

**Risk:** Low — only affects DEV_MODE.

---

## 🔵 Minor / Polish Issues

### 12. `dashboard.js` `applyCardState()` — sets `onclick` via `setAttribute` (string), not `addEventListener`
**File:** `dashboard.js` · Line 40

```js
btn.setAttribute('onclick', `handleToggle(${relayId}, ${!on})`);
```
This works but is fragile (inline event handlers in `setAttribute` are discouraged). Since the card is rebuilt on full re-render anyway, this is low risk but inconsistent with the rest of the codebase.

---

### 13. `index.html` — `<meta name="viewport">` has `maximum-scale=1.0` which prevents user zoom on mobile (accessibility concern)
**File:** `index.html` · Line 5

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
```
`maximum-scale=1.0` prevents pinch-to-zoom, which is an **WCAG 1.4.4 accessibility violation**. Remove `maximum-scale=1.0` or set it to `5.0`.

---

### 14. `settings.js` — settings hero "Relay Count" stat uses `config.relayCount` but doesn't update when stepper is used
**File:** `settings.js` · Lines 45–47 (hero HTML)

The hero shows `${config.relayCount}` and `${config.pins.length}` as static text. When the user clicks `+`/`−` stepper, the number in the hero stays at the old value. Minor cosmetic issue — the hero is informational, not interactive.

---

## Summary Table

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 Critical | `dashboard.js` | `onCount` calculated after optimistic state mutation — fragile |
| 2 | 🔴 Critical | `modal.js` | Duplicate `id="f-minutes"` on cases 2 & 3 |
| 3 | 🔴 Critical | `modal.js` | `const` inside `switch` without block — strict-mode hazard |
| 4 | 🟠 Functional | `settings.js` | `stepRelay()` resets edited pin values when stepper clicked |
| 5 | 🟠 Functional | `settings.js` | Null-safety on `State.config.pins` in `rebuildPinInputs` |
| 6 | 🟠 Functional | `modal.js` | `refreshStatus()` called after modal close with no view guard |
| 7 | ✅ False alarm | `ui.js` | `el()` `onclick` handling is correct |
| 8 | 🟡 Dead code | `ui.js` | `logicChipHTML()` never called — orphaned function |
| 9 | 🟡 Style | `ui.js` | `el()` only used once — inconsistent |
| 10 | 🟡 Regression | `modal.js` | `form-input`/`form-select` CSS classes no longer defined — modal inputs unstyled |
| 11 | 🟡 Low risk | `config.js` | `loadMockState()` can produce relay count / array length mismatch |
| 12 | 🔵 Minor | `dashboard.js` | `setAttribute('onclick', …)` antipattern |
| 13 | 🔵 A11y | `index.html` | `maximum-scale=1.0` blocks user zoom |
| 14 | 🔵 Cosmetic | `settings.js` | Hero relay count stat doesn't update with stepper |

**Items requiring code changes:** #1, #3, #4, #8, #10, #13 (high priority)
**Items you should know about but may leave as-is:** #2, #5, #6, #9, #11, #12, #14
