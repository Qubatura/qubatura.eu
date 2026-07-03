// fireflies.js — robaczki świętojańskie v4.
// Glow sprite, 3D lot (z głębią), puls 50-100%, nieregularna prędkość, cel = etykieta działu.

import * as THREE from 'three';
import { onTick } from './scene.js?v=mr4qcwm5';
import { navFX, DIVISION_COLORS, loadFX } from './tint.js?v=mr4qcwm5';

// ── Konfiguracja ──────────────────────────────────────────────────────────────
const MAX_SPD   = 58;    // wu/s XY
const MAX_ACC   = 42;    // wu/s² XY
const MAX_SPD_Z = 26;    // wu/s głębia — szybsze nurkowanie/powroty (A1: realne wycieczki w głąb)
const MAX_ACC_Z = 16;    // wu/s² głębia — żywsze przyspieszanie w osi Z
const ARRIVE_R  = 30;    // wu — "osiągam cel XY, biorę nowy"
const SIGNET_R  = 52;    // wu od centrum → fade (wyłącznie tryb signet/pong)
const Z_MIN     = -78;   // najdalej od kamery — głębsze nurki "w planetę" (A1)
const Z_MAX     = 108;   // najbliżej kamery — wyraźniejsze przeloty tuż przed nami (A1)
const Z_NORM    = 15;    // głębokość neutralna (brightness = 1.0)
const FF_SIZE   = 7;     // wu — rozmiar glow sprite (sizeAttenuation skaluje perspektywicznie)

// BOUND_X/Y obliczane w initFireflies() z rozmiaru ekranu — na mobile portretowym
// połowa szerokości ekranu to ~80wu, a stałe 270/155 wyrzucały świetliki poza kadr.
let BOUND_X = 270;
let BOUND_Y = 155;

// Selektory: tożsame z atmosphere.js CLOUD_DEFS (te same punkty co centra chmur)
const DEPT_SEL = {
  events: '#nav-events .nav-label',
  studio: '#nav-studio .nav-label',
  lab:    '#nav-lab .nav-label',
};
const IDLE_COL  = new THREE.Color(0x6644EE);
const labelPos  = { events: null, studio: null, lab: null };

// ── DOM → world space (depth ≈ 290 = camera.z 300 − FF_Z̄ ~10) ───────────────
function computeLabelPos() {
  const halfH = 290 * Math.tan(Math.PI / 6);           // = 290 × tan 30° ≈ 167.4 wu
  const halfW = halfH * window.innerWidth / window.innerHeight;
  for (const [div, sel] of Object.entries(DEPT_SEL)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    labelPos[div] = {
      x: ((r.left + r.width  / 2) / window.innerWidth  * 2 - 1) * halfW,
      y: (1 - (r.top  + r.height / 2) / window.innerHeight * 2) * halfH,
    };
  }
}

// ── Glow texture — jedna miękka, rozmyta plama ────────────────────────────────
function makeGlowTex() {
  const sz = 64, r = sz / 2;
  const c  = document.createElement('canvas');
  c.width  = c.height = sz;
  const cx = c.getContext('2d');
  const g  = cx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.14, 'rgba(255,255,255,0.82)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.46, 'rgba(255,255,255,0.02)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(c);
}

// ── Target pickers ────────────────────────────────────────────────────────────
function pickRandom(ff) {
  let tx, ty;
  do {
    tx = (Math.random() - 0.5) * BOUND_X * 2;
    ty = (Math.random() - 0.5) * BOUND_Y * 2;
  } while (Math.hypot(tx, ty) < 35);
  ff.tx        = tx;
  ff.ty        = ty;
  ff.tz        = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
  ff.targeting = null;
}

function pickDeptTarget(ff, activeDiv) {
  let lp = labelPos[activeDiv];
  if (!lp) { computeLabelPos(); lp = labelPos[activeDiv]; }
  if (!lp) { pickRandom(ff); return; }
  const a = Math.random() * Math.PI * 2;
  const r = 10 + Math.random() * 22;
  ff.tx        = Math.min(BOUND_X, Math.max(-BOUND_X, lp.x + Math.cos(a) * r));
  ff.ty        = Math.min(BOUND_Y, Math.max(-BOUND_Y, lp.y + Math.sin(a) * r));
  ff.tz        = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
  ff.targeting = 'dept';
}

function pickSignetTarget(ff) {
  const a = Math.random() * Math.PI * 2;
  const r = 8 + Math.random() * 18;
  ff.tx        = Math.cos(a) * r;
  ff.ty        = Math.sin(a) * r;
  ff.tz        = 5 + Math.random() * 25;
  ff.targeting = 'signet';
}

// 'orbit': krążenie wokół sygnetu BEZ fade — domyślny tryb na mobile (brak hover)
function pickSignetOrbit(ff) {
  const a = Math.random() * Math.PI * 2;
  const r = 20 + Math.random() * 35;   // orbit 20-55wu — wokół, nie na sygnecie
  ff.tx        = Math.cos(a) * r;
  ff.ty        = Math.sin(a) * r;
  ff.tz        = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
  ff.targeting = 'orbit';
}

// ── Fabryka świetlika ─────────────────────────────────────────────────────────
function makeFF() {
  const ff = {
    x:  (Math.random() - 0.5) * BOUND_X * 1.6,
    y:  (Math.random() - 0.5) * BOUND_Y * 1.6,
    z:  Z_MIN + Math.random() * (Z_MAX - Z_MIN),
    vx: (Math.random() - 0.5) * MAX_SPD   * 0.6,
    vy: (Math.random() - 0.5) * MAX_SPD   * 0.6,
    vz: (Math.random() - 0.5) * MAX_SPD_Z * 0.6,
    tx: 0, ty: 0, tz: 0,
    targeting: null,
    maxBright:   0.55 + Math.random() * 0.45,   // per-firefly max (0.55..1.00) — jaśniejsze w spoczynku (A1)
    phase:       Math.random() * Math.PI * 2,
    pulseMod:    0.75 + Math.random() * 0.55,   // 0.75–1.30× — każdy świetlik inny rytm
    flicker:     0.78,
    speedPeriod: 0.9  + Math.random() * 1.8,
    speedPhase:  Math.random() * Math.PI * 2,
    cr: IDLE_COL.r, cg: IDLE_COL.g, cb: IDLE_COL.b,
    intensity: Math.random() * 0.15,
    state: 'wander',
  };
  pickRandom(ff);
  return ff;
}

// ── Update ────────────────────────────────────────────────────────────────────
function updateFF(ff, delta, elapsed, activeDiv, divCol, signetActive, orbitActive) {
  if (ff.state === 'wander') {
    const sm = 0.45 + 0.80 * (Math.sin(elapsed / ff.speedPeriod + ff.speedPhase) * 0.5 + 0.5);
    const spdBoost = ff.targeting ? 2.0 : 1.0;
    const effXY    = MAX_SPD   * sm * spdBoost;
    const effZ     = MAX_SPD_Z * sm;

    const dx      = ff.tx - ff.x, dy = ff.ty - ff.y;
    const dist    = Math.hypot(dx, dy) || 0.001;
    const urgency = ff.targeting ? Math.min(3.0, Math.max(1.0, dist / 55)) : 1.0;
    ff.vx += (dx / dist) * MAX_ACC * delta * urgency;
    ff.vy += (dy / dist) * MAX_ACC * delta * urgency;
    const spd = Math.hypot(ff.vx, ff.vy);
    if (spd > effXY) { ff.vx = ff.vx / spd * effXY; ff.vy = ff.vy / spd * effXY; }
    ff.x += ff.vx * delta;
    ff.y += ff.vy * delta;

    const dz = ff.tz - ff.z;
    ff.vz += Math.sign(dz) * MAX_ACC_Z * delta;
    if (Math.abs(ff.vz) > effZ) ff.vz = Math.sign(ff.vz) * effZ;
    ff.z += ff.vz * delta;

    if (ff.x < -BOUND_X) { ff.x = -BOUND_X; ff.vx =  Math.abs(ff.vx) * 0.7; }
    if (ff.x >  BOUND_X) { ff.x =  BOUND_X; ff.vx = -Math.abs(ff.vx) * 0.7; }
    if (ff.y < -BOUND_Y) { ff.y = -BOUND_Y; ff.vy =  Math.abs(ff.vy) * 0.7; }
    if (ff.y >  BOUND_Y) { ff.y =  BOUND_Y; ff.vy = -Math.abs(ff.vy) * 0.7; }
    if (ff.z <    Z_MIN) { ff.z =    Z_MIN; ff.vz =  Math.abs(ff.vz) * 0.6; }
    if (ff.z >    Z_MAX) { ff.z =    Z_MAX; ff.vz = -Math.abs(ff.vz) * 0.6; }

    if (ff.targeting === 'signet' && Math.hypot(ff.x, ff.y) < SIGNET_R) {
      ff.state = 'fading';
      return;
    }

    if (dist < ARRIVE_R) {
      if      (ff.targeting === 'dept'   && activeDiv)    pickDeptTarget(ff, activeDiv);
      else if (ff.targeting === 'orbit'  && orbitActive)  pickSignetOrbit(ff);
      else if (ff.targeting === 'signet' && signetActive) pickSignetTarget(ff);
      else if (!ff.targeting             && activeDiv)    pickDeptTarget(ff, activeDiv);
      else if (!ff.targeting             && orbitActive)  pickSignetOrbit(ff);
      else                                                 pickRandom(ff);
    }

    const pm     = ff.pulseMod;
    const rawSum = 0.50 * Math.sin(elapsed *  3.1 * pm + ff.phase) +
                   0.30 * Math.sin(elapsed *  8.7 * pm + ff.phase * 1.618) +
                   0.20 * Math.sin(elapsed * 19.3 * pm + ff.phase * 2.414);
    const flicker = 0.36 + 0.64 * (rawSum * 0.5 + 0.5);   // większy rozhuśt pulsu (A1: "puls większy")
    ff.flicker = flicker;
    const boost = ff.targeting === 'signet' ? 3.5 :
                  (ff.targeting === 'dept' || ff.targeting === 'orbit') ? 2.5 : 1.45;  // idle: więcej obecności w spoczynku (A1)
    const depthK = Math.min(1.6, Math.pow((300 - Z_NORM) / Math.max(10, 300 - ff.z), 1.8));
    const ti     = Math.min(0.96, ff.maxBright * flicker * boost * depthK);   // wyższy sufit jasności (A1)
    ff.intensity += (ti - ff.intensity) * Math.min(1, delta * 2.8);

    const tc = ff.targeting ? divCol : IDLE_COL;
    const ck = Math.min(1, delta * 3.5);
    ff.cr += (tc.r - ff.cr) * ck;
    ff.cg += (tc.g - ff.cg) * ck;
    ff.cb += (tc.b - ff.cb) * ck;

  } else if (ff.state === 'fading') {
    ff.x += ff.vx * delta * 0.35;
    ff.y += ff.vy * delta * 0.35;
    ff.intensity = Math.max(0, ff.intensity - delta * 2.0);
    if (ff.intensity < 0.012) {
      pickRandom(ff);
      ff.x  = ff.tx + (Math.random() - 0.5) * 35;
      ff.y  = ff.ty + (Math.random() - 0.5) * 35;
      ff.z  = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
      ff.vx = (Math.random() - 0.5) * MAX_SPD   * 0.55;
      ff.vy = (Math.random() - 0.5) * MAX_SPD   * 0.55;
      ff.vz = (Math.random() - 0.5) * MAX_SPD_Z * 0.55;
      ff.state = 'wander';
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function initFireflies(ctx) {
  const { scene } = ctx;

  const halfH = Math.tan(Math.PI / 6) * 300;
  const halfW = halfH * (window.innerWidth / window.innerHeight);
  BOUND_X = Math.min(270, halfW * 0.90);
  BOUND_Y = Math.min(155, halfH * 0.72);

  const POOL = window.innerWidth <= 768 ? 16 : 26;   // desktop +4: gęstszy rój w spoczynku (A1)

  computeLabelPos();
  window.addEventListener('resize', computeLabelPos);

  const pool = Array.from({ length: POOL }, makeFF);

  // Na mobile: domyślny orbit wokół sygnetu — brak hoverów, więc dajemy życie inaczej
  if (window.innerWidth <= 768) {
    for (const ff of pool) pickSignetOrbit(ff);
  }

  const pos = new Float32Array(POOL * 3);
  const col = new Float32Array(POOL * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  geo.attributes.position.usage = THREE.DynamicDrawUsage;
  geo.attributes.color.usage    = THREE.DynamicDrawUsage;

  const mat = new THREE.PointsMaterial({
    size: FF_SIZE, sizeAttenuation: true,
    map: makeGlowTex(), vertexColors: true,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, alphaTest: 0.005,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  let prevDiv          = null;
  let prevOrbitActive  = false;
  let prevSignetActive = false;
  let ffReveal         = 0;

  onTick((delta, elapsed) => {
    const activeDiv    = navFX.activeDiv;
    const signetActive = !activeDiv && document.body.classList.contains('pong-active');
    // Na mobile: orbit zawsze aktywny gdy brak działu i brak pongu — zastępuje brak hoverów
    const orbitActive  = !activeDiv && !signetActive &&
                         (document.body.classList.contains('signet-hover') ||
                          window.innerWidth <= 768);

    if (activeDiv !== prevDiv) {
      for (const ff of pool) {
        if (ff.targeting === 'dept' || ff.targeting === 'orbit') {
          ff.targeting = null; pickRandom(ff);
        }
        if (ff.state === 'fading') { pickRandom(ff); ff.state = 'wander'; }
      }
      if (activeDiv) {
        for (const ff of pool) pickDeptTarget(ff, activeDiv);
      }
      prevDiv = activeDiv;
    }

    if (orbitActive !== prevOrbitActive) {
      if (orbitActive) {
        for (const ff of pool) pickSignetOrbit(ff);
      } else {
        for (const ff of pool) {
          if (ff.targeting === 'orbit') { ff.targeting = null; pickRandom(ff); }
          if (ff.state === 'fading')    { pickRandom(ff); ff.state = 'wander'; }
        }
      }
      prevOrbitActive = orbitActive;
    }

    if (signetActive !== prevSignetActive) {
      if (signetActive) {
        for (const ff of pool) pickSignetTarget(ff);
      } else {
        for (const ff of pool) {
          if (ff.targeting === 'signet') { ff.targeting = null; pickRandom(ff); }
          if (ff.state === 'fading')     { pickRandom(ff); ff.state = 'wander'; }
        }
      }
      prevSignetActive = signetActive;
    }

    const divCol = DIVISION_COLORS[activeDiv] ?? IDLE_COL;
    // Bloom po zakończeniu loadera — szybszy na mobile żeby od razu widać było efekt
    const bloomRate = window.innerWidth <= 768 ? 0.90 : 0.70;
    if (!loadFX.active) ffReveal = Math.min(1, ffReveal + delta * bloomRate);

    for (let i = 0; i < POOL; i++) {
      const ff = pool[i];
      updateFF(ff, delta, elapsed, activeDiv, divCol, signetActive, orbitActive);
      const brightness = ff.intensity * ffReveal;
      const peakW = Math.max(0, (ff.flicker - 0.80) / 0.20) * 0.32 * brightness;   // gorętsze szczyty pulsu (A1)
      pos[i * 3]     = ff.x;
      pos[i * 3 + 1] = ff.y;
      pos[i * 3 + 2] = ff.z;
      col[i * 3]     = Math.min(1, ff.cr * brightness + peakW);
      col[i * 3 + 1] = Math.min(1, ff.cg * brightness + peakW);
      col[i * 3 + 2] = Math.min(1, ff.cb * brightness + peakW);
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate    = true;
  });
}
