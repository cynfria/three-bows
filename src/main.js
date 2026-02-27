/**
 * Three Bows · 財神降臨 · Cai Shen's Fortune
 * Main — screen transitions, state, orchestration
 */

import './style.css';
import { createIcons, Send, RotateCcw, ArrowRight } from 'lucide';
import { calculateBaZi } from './bazi.js';
import { BowDetector }   from './bow-detector.js';
import { getFortune }    from './fortune-api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTobValue() {
  const hour = parseInt(els.tobHour.value);
  if (!els.tobHour.value || isNaN(hour)) return null;
  const minute = parseInt(els.tobMinute.value);
  const min = isNaN(minute) ? 0 : Math.min(59, Math.max(0, minute));
  const isPM = els.tobAmPm.querySelector('.ampm-opt.active')?.dataset.val === 'PM';
  const h24 = (hour % 12) + (isPM ? 12 : 0);
  return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── App State ────────────────────────────────────────────────────────────────
const state = {
  dob:     null,
  tob:     null,
  bazi:    null,
  fortune: null,
};

// ─── Oracle Phrases ───────────────────────────────────────────────────────────
const ORACLE_PHRASES = [
  'Cai Shen is reading your stars...',
  'Consulting the heavenly stems...',
  'Your Ba Zi chart is forming...',
  'The celestial winds are speaking...',
  'The eight characters are aligning...',
];

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const screens = {
  entry:   document.getElementById('screen-entry'),
  bow:     document.getElementById('screen-bow'),
  oracle:  document.getElementById('screen-oracle'),
  fortune: document.getElementById('screen-fortune'),
};

const els = {
  dob:          document.getElementById('dob'),
  tobHour:      document.getElementById('tob-hour'),
  tobMinute:    document.getElementById('tob-minute'),
  tobAmPm:      document.getElementById('tob-ampm'),
  formError:    document.getElementById('form-error'),
  btnApproach:  document.getElementById('btn-approach'),
  webcam:       document.getElementById('webcam'),
  bowFigure:    document.getElementById('bow-figure'),
  bowDots:      [0,1,2].map(i => document.getElementById(`bow-dot-${i}`)),
  btnManual:    document.getElementById('btn-manual-bow'),
  manualHint:   document.getElementById('manual-hint'),
  oraclePhrase:    document.getElementById('oracle-phrase'),
  slidesContainer: document.getElementById('slides-container'),
  slideNav:        document.getElementById('slide-nav'),
  btnRestart:      document.getElementById('btn-restart'),
};

// ─── Date Input Placeholder Color ────────────────────────────────────────────
function syncDobColor() {
  els.dob.classList.toggle('empty', !els.dob.value);
}
els.dob.addEventListener('change', syncDobColor);
syncDobColor();

// ─── Time Picker Interactions ─────────────────────────────────────────────────
function updateAmPmSlider(activeOpt) {
  const seg = els.tobAmPm;
  const segRect = seg.getBoundingClientRect();
  const optRect = activeOpt.getBoundingClientRect();
  seg.style.setProperty('--seg-w',    optRect.width  + 'px');
  seg.style.setProperty('--seg-left', (optRect.left - segRect.left) + 'px');
}

els.tobAmPm.addEventListener('click', (e) => {
  const opt = e.target.closest('.ampm-opt');
  if (!opt) return;
  els.tobAmPm.querySelectorAll('.ampm-opt').forEach(b => b.classList.remove('active'));
  opt.classList.add('active');
  updateAmPmSlider(opt);
});

// Init slider position on load
requestAnimationFrame(() => {
  const initial = els.tobAmPm.querySelector('.ampm-opt.active');
  if (initial) updateAmPmSlider(initial);
});

els.tobHour.addEventListener('input', () => {
  if (els.tobHour.value.length > 2) els.tobHour.value = els.tobHour.value.slice(0, 2);
  if (els.tobHour.value.length === 2) els.tobMinute.focus();
});

els.tobMinute.addEventListener('input', () => {
  if (els.tobMinute.value.length > 2) els.tobMinute.value = els.tobMinute.value.slice(0, 2);
});

els.tobMinute.addEventListener('blur', () => {
  const m = parseInt(els.tobMinute.value);
  if (!isNaN(m)) els.tobMinute.value = String(Math.min(59, Math.max(0, m))).padStart(2, '0');
});

els.tobHour.addEventListener('blur', () => {
  const h = parseInt(els.tobHour.value);
  if (!isNaN(h)) els.tobHour.value = String(Math.min(12, Math.max(1, h)));
});

// ─── Screen Transitions ───────────────────────────────────────────────────────
let currentScreen = 'entry';

function showScreen(name) {
  const prev = screens[currentScreen];
  const next = screens[name];
  if (prev) {
    prev.classList.add('exit');
    setTimeout(() => prev.classList.remove('active', 'exit'), 600);
  }
  setTimeout(() => {
    next.classList.add('active');
    currentScreen = name;
  }, 200);
}

// ─── SCREEN 1: Entry ──────────────────────────────────────────────────────────
els.btnApproach.addEventListener('click', () => {
  els.formError.textContent = '';
  const dob = els.dob.value;
  if (!dob) {
    els.formError.textContent = 'Please enter your date of birth.';
    return;
  }
  state.dob  = dob;
  state.tob  = getTobValue();
  state.bazi = calculateBaZi(dob, state.tob);
  showScreen('bow');
  initBowScreen();
});

// ─── SCREEN 2: Bow Detection ──────────────────────────────────────────────────
let bowDetector   = null;
let manualTapCount = 0;

function initBowScreen() {
  manualTapCount = 0;
  els.bowDots.forEach(d => d.classList.remove('filled'));
  els.bowFigure.classList.remove('bowing');
  els.manualHint.textContent = '';

  bowDetector = new BowDetector({
    onBow: handleBow,
    onStateChange: (newState) => {
      if (newState === 'BOWING') {
        els.bowFigure.classList.add('bowing');
        setTimeout(() => els.bowFigure.classList.remove('bowing'), 600);
      }
    },
    onCalibrated: () => {
      els.manualHint.textContent = 'Ready — bow slowly and deeply three times.';
      setTimeout(() => { els.manualHint.textContent = ''; }, 3000);
    },
  });

  els.manualHint.textContent = 'Calibrating… hold still for a moment.';

  bowDetector.start(els.webcam).then(started => {
    if (!started) {
      els.manualHint.textContent = 'Camera unavailable — tap "Bow Manually" three times.';
    }
  });
}

function handleBow(count) {
  const idx = count - 1;
  if (idx >= 0 && idx < 3) {
    els.bowDots[idx]?.classList.add('filled');
    els.bowFigure.classList.add('bowing');
    setTimeout(() => els.bowFigure.classList.remove('bowing'), 600);
  }
  if (count >= 3) {
    // Golden flash
    const flash = document.createElement('div');
    flash.className = 'golden-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 900);

    bowDetector?.stop();
    setTimeout(() => {
      showScreen('oracle');
      startOracleAndFetch();
    }, 700);
  }
}

els.btnManual.addEventListener('click', () => {
  if (manualTapCount >= 3) return;
  manualTapCount++;
  const remaining = 3 - manualTapCount;
  els.manualHint.textContent = remaining > 0
    ? `${remaining} more bow${remaining > 1 ? 's' : ''} to go...`
    : '';
  handleBow(manualTapCount);
});

// ─── SCREEN 3: Oracle ─────────────────────────────────────────────────────────
let oraclePhraseInterval = null;

function startOracleAndFetch() {
  let phraseIdx = 0;
  els.oraclePhrase.textContent = ORACLE_PHRASES[0];
  els.oraclePhrase.style.opacity = '1';

  oraclePhraseInterval = setInterval(() => {
    els.oraclePhrase.style.opacity = '0';
    setTimeout(() => {
      phraseIdx = (phraseIdx + 1) % ORACLE_PHRASES.length;
      els.oraclePhrase.textContent = ORACLE_PHRASES[phraseIdx];
      els.oraclePhrase.style.opacity = '1';
    }, 500);
  }, 2500);

  getFortune(state.dob, state.tob, state.bazi, null)
    .then(fortune => {
      state.fortune = fortune;
      localStorage.setItem('threebows_last', JSON.stringify(state));
      clearInterval(oraclePhraseInterval);
      populateFortuneScreen(fortune);
      showScreen('fortune');
    })
    .catch(err => {
      clearInterval(oraclePhraseInterval);
      console.error('Fortune API error:', err);
      els.oraclePhrase.textContent = `⚠ ${err.message}`;
    });
}

// ─── SCREEN 4: Fortune Slides ─────────────────────────────────────────────────
function populateFortuneScreen(f) {
  const { year, month, day, hour } = state.bazi;

  // Slide 0: hero
  document.getElementById('text-animal-title').textContent = `${year.element} ${year.animal}`;
  const zodiacImg = document.getElementById('zodiac-img');
  zodiacImg.src = `/assets/zodiac-${year.animal.toLowerCase()}.png`;
  zodiacImg.alt = year.animal;
  fillPillar('year',  year);
  fillPillar('month', month);
  fillPillar('day',   day);
  fillPillar('hour',  hour);

  // Slide 1: overall motto — scale font by length
  const overallEl = document.getElementById('text-overall');
  overallEl.textContent = f.overall;
  const len = (f.overall || '').length;
  overallEl.style.fontSize = len < 100 ? 'clamp(1.6rem, 3vw, 2.2rem)'
                           : len < 180 ? 'clamp(1.2rem, 2.2vw, 1.6rem)'
                           :             'clamp(0.95rem, 1.6vw, 1.15rem)';

  // Slide 2: lucky
  fillTags('lucky-numbers', f.lucky_numbers, true);
  fillTags('lucky-colors', f.lucky_colors);

  // Slide 3: zodiac
  document.getElementById('text-zodiac').textContent =
    `${f.zodiac_animal} · ${f.zodiac_element} — ${f.personality}`;

  // Slide 4: elements
  document.getElementById('text-elements').textContent =
    f.five_elements?.reading ?? String(f.five_elements ?? '');

  // Slide 5: wealth
  document.getElementById('text-wealth').textContent = f.wealth;

  // Slide 6: relationships
  document.getElementById('text-relationships').textContent = f.relationships;

  // Slide 7: compatibility (allies + friction)
  document.getElementById('text-compatibility').textContent = f.compatibility?.reading ?? '';
  fillTags('compat-harmonious', f.compatibility?.harmonious);
  fillTags('compat-challenging', f.compatibility?.challenging);

  initSlideNav();
}

function initSlideNav() {
  const container = els.slidesContainer;
  const nav = els.slideNav;
  const slides = Array.from(container.querySelectorAll('.slide'));
  const downBtn = document.getElementById('slide-down-btn');
  const lastIdx = slides.length - 1;

  nav.innerHTML = '';
  const dots = [];

  slides.forEach((slide, i) => {
    const dot = document.createElement('button');
    dot.className = 'slide-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.addEventListener('click', () => slide.scrollIntoView({ behavior: 'smooth' }));
    nav.appendChild(dot);
    dots.push(dot);
  });

  downBtn?.addEventListener('click', () => {
    const idx = Math.round(container.scrollTop / container.clientHeight);
    if (idx < lastIdx) slides[idx + 1].scrollIntoView({ behavior: 'smooth' });
  });

  container.addEventListener('scroll', () => {
    const idx = Math.round(container.scrollTop / container.clientHeight);
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    downBtn?.classList.toggle('hidden', idx >= lastIdx);
  }, { passive: true });
}

function fillPillar(name, pillar) {
  const stemEl    = document.getElementById(`stem-${name}`);
  const branchEl  = document.getElementById(`branch-${name}`);
  const elementEl = document.getElementById(`element-${name}`);
  if (!branchEl) return;

  if (!pillar) {
    if (stemEl) stemEl.textContent = '—';
    branchEl.textContent  = '—';
    if (elementEl) elementEl.textContent = 'unknown';
    return;
  }
  if (stemEl) stemEl.textContent = pillar.stem;
  branchEl.textContent  = pillar.branch;
  if (elementEl) elementEl.textContent = `${pillar.element} ${pillar.animal}`;
}

function fillTags(containerId, items, isNumber = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  (items || []).forEach(item => {
    const tag = document.createElement('span');
    tag.className = 'lucky-tag';
    tag.textContent = isNumber ? String(item) : item;
    container.appendChild(tag);
  });
}

// ─── Share (removed) ──────────────────────────────────────────────────────────

// ─── Restart ──────────────────────────────────────────────────────────────────
els.btnRestart.addEventListener('click', () => {
  state.dob = null;
  state.tob = null;
  state.bazi = null;
  state.fortune = null;
  els.dob.value = '';
  syncDobColor();
  els.tobHour.value = '';
  els.tobMinute.value = '';
  const amBtn = els.tobAmPm.querySelector('[data-val="AM"]');
  els.tobAmPm.querySelector('[data-val="PM"]').classList.remove('active');
  amBtn.classList.add('active');
  updateAmPmSlider(amBtn);
  manualTapCount = 0;
  document.getElementById('slide-down-btn')?.classList.remove('hidden');
  showScreen('entry');
  setTimeout(() => {
    els.slidesContainer?.scrollTo({ top: 0, behavior: 'instant' });
    els.slideNav.innerHTML = '';
  }, 650);
});

// ─── Border Metallic Shader ────────────────────────────────────────────────────
// Track cursor and move the specular highlight in SVG coordinate space.
// SVG viewBox is 0 0 1227 739; the element is inset 32px on each side.
const cursorLight = document.getElementById('cursorLight');

document.addEventListener('mousemove', (e) => {
  if (!cursorLight) return;
  const svgX = (e.clientX - 32) / (window.innerWidth  - 64) * 1227;
  const svgY = (e.clientY - 32) / (window.innerHeight - 64) * 739;
  cursorLight.setAttribute('cx', svgX.toFixed(1));
  cursorLight.setAttribute('cy', svgY.toFixed(1));
});

// ─── Init ─────────────────────────────────────────────────────────────────────
createIcons({ icons: { Send, RotateCcw, ArrowRight } });

// Dev shortcut: ?dev in URL jumps straight to last fortune (no API call)
if (new URLSearchParams(location.search).has('dev')) {
  try {
    const saved = JSON.parse(localStorage.getItem('threebows_last'));
    if (saved?.fortune && saved?.bazi) {
      Object.assign(state, saved);
      populateFortuneScreen(state.fortune);
      showScreen('fortune');
    }
  } catch { /* no saved state */ }
}
