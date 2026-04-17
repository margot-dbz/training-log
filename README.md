# Training Log v2

Personal fitness tracker — vanilla JS, no build step, GitHub Pages ready.

## Setup

### 1. Push to GitHub Pages
1. Create a repo (e.g. `training-log`) on GitHub
2. Push all 4 files (`index.html`, `style.css`, `app.js`, `data.json`)
3. Settings → Pages → Source: `main` branch, `/ (root)`
4. Live at `https://yourusername.github.io/training-log`

> **Note:** GitHub Pages serves files over HTTP so `fetch('data.json')` works fine.
> If running locally, use `npx serve .` not just opening the HTML file.

### 2. Add your Anthropic API key
Open `app.js` line 2 and replace:
```js
const API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';
```
This enables the Recommendations tab.

---

## How logging works

1. Pick a **template** (Full session, Wrist-safe, Light, Core focus) — exercises load with your last used weights/reps pre-filled
2. Tap any exercise to tweak the numbers inline
3. Use **+ Add exercise** to add individual exercises from the library, or create a new one on the spot
4. Set intensity (1–5), duration, optional notes → **Save session**

---

## Updating your data

When you have new sessions, paste them to Claude and say:
> "Update my data.json with these sessions"

Claude hands you a new `data.json` — replace the file, push, done.

---

## Adding exercises to the library (in data.json)

```json
{
  "id": "my_exercise",
  "name": "My Exercise",
  "category": "strength",
  "default": { "kg": 20, "sets": 3, "reps": 10 }
}
```

Categories: `cardio`, `strength`, `core`, `mobility`, `physio`

Default fields by category:
- Strength/core: `kg` (optional), `sets`, `reps`
- Timed core: `sets`, `secs`
- Cardio/mobility: `mins`, `note`

---

## Adding templates (in data.json)

```json
{
  "id": "my_template",
  "name": "My Template",
  "emoji": "🔥",
  "type": "full",
  "intensity": 3,
  "exercises": ["chestpress", "vrow", "pullup", "plank"]
}
```
