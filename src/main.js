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

// ─── Date Input — auto-format MM/DD/YYYY as user types ───────────────────────
els.dob.addEventListener('input', (e) => {
  const el = e.target;
  const digits = el.value.replace(/\D/g, '').slice(0, 8);
  let formatted = digits;
  if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
  if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4);
  el.value = formatted;
});

function parseDob(raw) {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

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

els.tobMinute.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' && els.tobMinute.value === '') els.tobHour.focus();
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
  const rawDob = els.dob.value.trim();
  if (!rawDob) {
    els.formError.textContent = 'Please enter your date of birth.';
    return;
  }
  const dob = parseDob(rawDob);
  if (!dob) {
    els.formError.textContent = 'Please use MM/DD/YYYY format.';
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

// ─── Border: WebGL metallic shader ────────────────────────────────────────────
// Blinn-Phong specular on a flat gold surface; cursor = light source position.
// Canvas is masked to the knot border shape via CSS mask-border.
(function initBorderShader() {
  const canvas = document.getElementById('border-frame');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) return;

  const VS = `attribute vec2 p; void main(){gl_Position=vec4(p,0,1);}`;
  const FS = `
    precision highp float;
    uniform vec2 u_res;
    uniform vec2 u_mouse;
    void main() {
      // Work in pixel space so the light radius is viewport-independent
      vec2 frag   = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
      vec2 cursor = u_mouse * u_res;

      // Point light AT cursor position, 220px above the surface.
      // Each fragment computes its own L, so lighting is truly localised.
      vec3 L = normalize(vec3(cursor - frag, 220.0));
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 H = normalize(L + V);

      // L.z == dot(N,L) since N=(0,0,1). Falls off naturally with distance.
      float diff = 0.28 + 0.72 * max(L.z, 0.0);
      float spec = pow(max(H.z, 0.0), 55.0);

      vec3 dark   = vec3(0.50, 0.33, 0.04);
      vec3 base   = vec3(0.80, 0.60, 0.10);
      vec3 bright = vec3(1.00, 0.88, 0.50);
      vec3 col = mix(dark, base, diff);
      col = mix(col, bright, spec * 0.85);
      col += bright * spec * 0.35;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER,   VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes   = gl.getUniformLocation(prog, 'u_res');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  let mx = 0.5, my = 0.5;
  document.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth;
    my = e.clientY / window.innerHeight;
  });

  // Accelerometer: tilt phone to shift the light on border + button
  function applyOrientation(e) {
    const gamma = Math.max(-45, Math.min(45, e.gamma ?? 0)); // left-right
    const beta  = Math.max(-45, Math.min(45, e.beta  ?? 0)); // front-back
    mx = (gamma + 45) / 90;
    my = (beta  + 45) / 90;
    // Button gradient angle follows left-right tilt
    cancelAnimationFrame(btnReturnAnim);
    const targetAngle = 125 + (gamma / 45) * 35;
    if (ctaBtn) ctaBtn.style.setProperty('--btn-angle', targetAngle.toFixed(1) + 'deg');
  }

  function enableOrientation() {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(state => { if (state === 'granted') window.addEventListener('deviceorientation', applyOrientation); })
        .catch(() => {});
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', applyOrientation);
    }
  }
  document.addEventListener('touchstart', enableOrientation, { once: true });

  (function render() {
    const w = canvas.offsetWidth  | 0;
    const h = canvas.offsetHeight | 0;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  })();
})();

// ─── Button: metallic gradient angle shift ────────────────────────────────────
const ctaBtn = document.getElementById('btn-approach');
let btnAngle = 125;
let btnReturnAnim = null;

ctaBtn?.addEventListener('mousemove', (e) => {
  cancelAnimationFrame(btnReturnAnim);
  const r = ctaBtn.getBoundingClientRect();
  btnAngle = 125 + ((e.clientX - r.left) / r.width - 0.5) * 70;
  ctaBtn.style.setProperty('--btn-angle', btnAngle.toFixed(1) + 'deg');
});

ctaBtn?.addEventListener('mouseleave', () => {
  function ease() {
    btnAngle += (125 - btnAngle) * 0.1;
    ctaBtn.style.setProperty('--btn-angle', btnAngle.toFixed(1) + 'deg');
    if (Math.abs(btnAngle - 125) > 0.2) btnReturnAnim = requestAnimationFrame(ease);
    else ctaBtn.style.setProperty('--btn-angle', '125deg');
  }
  btnReturnAnim = requestAnimationFrame(ease);
});

// ─── Coin: WebGL metallic shader ──────────────────────────────────────────────
// Renders the gold coin fill. Surface normal is (sin θ, 0, cos θ) for a flat
// disc doing rotateY, so specular shifts naturally as the coin spins.
// Canvas sits behind the SVG overlay (rings + 財 text). Both are inside
// #coin-wrapper which carries the CSS coin-spin animation.
(function initCoinShader() {
  const canvas = document.getElementById('coin-canvas');
  if (!canvas) return;
  canvas.width = 240; canvas.height = 240; // 2× for crisp rendering

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) return;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const VS = `attribute vec2 p; void main(){gl_Position=vec4(p,0,1);}`;
  const FS = `
    precision highp float;
    uniform vec2  u_res;
    uniform float u_angle;
    void main() {
      vec2  uv    = (2.0 * gl_FragCoord.xy - u_res) / min(u_res.x, u_res.y);
      float d     = length(uv);
      float alpha = 1.0 - smoothstep(0.87, 0.93, d);
      if (alpha < 0.01) { gl_FragColor = vec4(0.0); return; }

      // Flat disc rotating around Y: normal tilts with the spin angle
      vec3 N = normalize(vec3(sin(u_angle), 0.0, cos(u_angle)));
      vec3 L = normalize(vec3(0.5, 0.7, 1.0));
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 H = normalize(L + V);

      float diff  = max(dot(N, L), 0.0);
      float spec  = pow(max(dot(N, H), 0.0), 62.0);
      float bevel = smoothstep(0.93, 0.72, d); // edge darkening

      vec3 dark   = vec3(0.38, 0.24, 0.02);
      vec3 base   = vec3(0.82, 0.62, 0.11);
      vec3 bright = vec3(1.00, 0.90, 0.52);

      vec3 col  = mix(dark, base, diff * 0.9);
      col       = mix(col, bright, spec * 0.9);
      col      += bright * spec * 0.4;
      col      *= bevel;

      // Narrow rim highlight at coin edge
      float rim  = 1.0 - smoothstep(0.025, 0.0, abs(d - 0.84));
      col       += bright * rim * 0.45 * (0.3 + 0.7 * spec);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha * bevel);
    }`;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes   = gl.getUniformLocation(prog, 'u_res');
  const uAngle = gl.getUniformLocation(prog, 'u_angle');

  let start = null;
  (function render(t) {
    if (!start) start = t;
    const angle = ((t - start) % 4000) / 4000 * Math.PI * 2;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uAngle, angle);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  })();
})();

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
