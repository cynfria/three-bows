# 財神降臨 · Cai Shen's Fortune — Project Spec

## Overview
A single-page Chinese New Year party web app. Users enter their birthdate, bow three times to the God of Wealth via webcam gesture detection, and receive a personalized Ba Zi fortune for the Year of the Snake (2025).

---

## Tech Stack
- **Framework**: Vite + vanilla JS
- **Pose Detection**: MediaPipe Pose (via CDN) — detect bow gesture from webcam
- **Fortune Generation**: Anthropic Claude API (`claude-sonnet-4-5`) — streamed response
- **Runs locally** — `npm run dev` on your laptop, no deployment needed

---

## App Flow — 4 Screens

### Screen 1: Entry
- Full-screen atmospheric layout, dark red/black/gold color palette
- Large illustrated image of **Cai Shen (財神), the God of Wealth** centered on screen — use a high-quality public domain or generated illustration
- Title: `財神降臨` (large Chinese characters) + subtitle `"Cai Shen's Fortune"` in styled English
- Form inputs:
  - **Date of Birth** (required) — date picker
  - **Time of Birth** (optional) — time picker, labeled with a note that it improves accuracy
- CTA button: `"Approach the God of Wealth"` — validates date is filled, then advances to Screen 2

### Screen 2: Bow Detection
- Webcam feed shown in background or small preview (can be subtle/dimmed)
- Large text: `"Bow three times to receive your fortune"`
- Subtitle in italic: `"Lower your head deeply, three times, as an offering"`
- **Bow counter**: 3 circular indicators (empty → filled with gold glow as each bow is detected)
- Bow figure emoji or icon animates on each detected bow
- After 3 bows detected: brief golden flash/particle burst, then auto-advance to Screen 3
- **Fallback button**: `"Bow Manually"` (tap/click 3 times) for devices without camera access or permission denied

### Screen 3: Oracle Consultation
- Transition screen shown while the API call runs (~3–6 seconds)
- Animated spinning coins or incense smoke SVG animation
- Text cycles through atmospheric phrases:
  - `"Cai Shen is reading your stars..."`
  - `"Consulting the heavenly stems..."`
  - `"Your Ba Zi chart is forming..."`

### Screen 4: Fortune Reveal
- Styled like an unrolling scroll or imperial decree
- **Ba Zi Chart** displayed at top — 4 pillars (Year, Month, Day, Hour) each showing Heavenly Stem + Earthly Branch in Chinese characters, with element label below
- Sections (streamed in progressively if possible):
  - 🐍 **Your Zodiac Animal** — animal, element, and personality traits
  - ☯ **Five Elements Balance** — dominant element, what it means for 2025
  - 💰 **Wealth & Prosperity** — specific to Year of the Snake
  - ❤️ **Relationships & Harmony**
  - 🌟 **Overall Fortune for 2025** — one memorable summary sentence
- **Lucky details** displayed as decorative tags: Lucky Numbers, Lucky Colors, Lucky Directions
- Share button (copies fortune text to clipboard)
- `"Seek Another Fortune"` button to restart

---

## Bow Detection Logic (MediaPipe Pose)

Use **MediaPipe Pose Landmarker** (Lite model, via CDN):

```js
// A "bow" is detected when:
// - Nose landmark Y position > Hip landmark Y position * BOW_THRESHOLD
// - i.e., the nose drops significantly below its neutral position

const BOW_THRESHOLD = 0.85; // nose.y / hip.y ratio
const NEUTRAL_THRESHOLD = 0.65; // must return to upright before next bow counts
```

**State machine:**
1. `UPRIGHT` — waiting for head to drop
2. `BOWING` — nose crossed threshold, increment counter, play sound/animation
3. `RETURNING` — wait for head to return above neutral before accepting next bow

Debounce: minimum 800ms between bow detections to avoid double-counts.

Request camera permission on Screen 2 load. If denied, show fallback button immediately.

---

## Ba Zi Calculation (Client-Side)

Calculate the four pillars from birthdate/time before the API call:

```
Year Pillar  — based on birth year (Chinese calendar, adjusted for before/after Feb 4 Solar Term)
Month Pillar — based on birth month (Solar Terms / Jieqi)
Day Pillar   — based on birth date (60-day cycle calculation)
Hour Pillar  — based on birth hour (2-hour blocks / Shichen), omit if no time given
```

Each pillar = Heavenly Stem (天干, 10 stems) + Earthly Branch (地支, 12 branches)
Earthly Branches map to the 12 zodiac animals.

Pass the calculated pillars directly to the API prompt so the model doesn't need to recalculate.

---

## API Prompt

```
You are a master Ba Zi (八字) fortune teller in the tradition of Chinese metaphysics.

The user was born on {date} {time_or_"time unknown"}.

Their Four Pillars (Ba Zi chart) are:
- Year Pillar: {heavenly_stem} {earthly_branch} ({element} {animal})
- Month Pillar: {heavenly_stem} {earthly_branch} ({element} {animal})  
- Day Pillar: {heavenly_stem} {earthly_branch} ({element} {animal})
- Hour Pillar: {heavenly_stem} {earthly_branch} ({element} {animal}) [or "Not provided"]

Today is Chinese New Year 2025, the Year of the Wood Snake (乙巳).

Provide a Ba Zi reading with the following sections. Use poetic, evocative language. 
Mix in occasional Chinese characters for key terms. Be specific to their chart — 
avoid generic horoscope language.

Format your response as JSON with these keys:
{
  "zodiac_animal": "...",
  "zodiac_element": "...",
  "personality": "2-3 sentences",
  "five_elements": {
    "dominant": "element name",
    "reading": "2-3 sentences about their elemental balance and what it means in 2025"
  },
  "wealth": "2-3 sentences",
  "relationships": "2-3 sentences",
  "overall": "One powerful summary sentence — their fortune motto for 2025",
  "lucky_numbers": [3, 7],
  "lucky_colors": ["Crimson", "Gold"],
  "lucky_directions": ["South", "Southeast"]
}
```

---

## Visual Design

**Palette:**
```css
--red: #C0272D;
--deep-red: #8B0000;
--gold: #D4A017;
--bright-gold: #FFD700;
--pale-gold: #F5E6A3;
--black: #0A0604;
--paper: #1A0A00;
--ink: #F2E8D0;
```

**Typography:**
- Chinese text: `Noto Serif SC` (Google Fonts)
- English headings: `Cinzel Decorative` (Google Fonts)
- English body: `IM Fell English` (Google Fonts, italic for atmosphere)

**Atmosphere:**
- Background: deep radial gradient, dark red bleeding into near-black
- Floating gold particles (CSS animation, random delay/position)
- Thin gold lantern-red strip along top of page
- God of Wealth image with animated golden glow/halo (CSS radial gradient pulse)
- Form card with subtle red inner glow and gold corner ornaments
- Transition between screens: fade + upward slide

**Screen 4 scroll styling:**
- Fortune container styled like aged imperial paper — dark warm background, top gradient border in red→gold→red
- Ba Zi pillars displayed in a 4-column grid, each with a subtle border
- Section headers in small-caps red with flanking decorative lines
- Lucky details as gold pill/tag components

---

## File Structure

```
/
├── index.html
├── style.css
├── main.js              # Screen transitions, state management
├── bazi.js              # Ba Zi calculation logic (4 pillars)
├── bow-detector.js      # MediaPipe pose + bow state machine
├── fortune-api.js       # Anthropic API call + response parsing
├── .env                 # VITE_ANTHROPIC_API_KEY (never commit this)
└── assets/
    └── caishen.png      # God of Wealth illustration
```

---

## Running Locally

```bash
npm create vite@latest caishen-fortune -- --template vanilla
cd caishen-fortune
npm install
```

Create a `.env` file in the project root:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Access it in code as `import.meta.env.VITE_ANTHROPIC_API_KEY`.

Start the dev server:
```bash
npm run dev
```

The app will be at `http://localhost:5173`. If guests want to use it on their own phones over your party wifi, find your local IP (`ipconfig`/`ifconfig`) and share `http://192.168.x.x:5173` — Vite serves on the local network by default.

---

## Nice-to-Haves (if time allows)
- Sound effects: soft gong on each bow, coin jingle on fortune reveal
- Incense smoke SVG path animation on Screen 2
- Fortune card can be saved as image (html2canvas)
- QR code displayed so party guests can pull it up on their own phones
