// parallax.js — warstwowy parallax + autonomiczny dryf sceny
//
// Dwie warstwy:
//   planet  — mesh Three.js z=-500, przesuwa się w jedn. świata
//   fog     — shader atmosphere.js, przesuwa się w "height units" (offset UV shadera)
//
// Każda warstwa: (input * siła) + sin-dryf z innym okresem = razem.
// px.planet/fog eksportowane jako live state — atmosphere.js czyta px.fog co klatkę.
//
// Źródło inputu (raw.x/raw.y, zakres ±1):
//   desktop — mysz
//   mobile  — żyroskop (jeśli zgoda + czujnik), inaczej touch-drag fallback (igloo.inc-style)
//
// iOS 13+ wymaga JAWNEGO gestu do DeviceOrientationEvent.requestPermission() — realizuje to
// widoczny baner (#motion-prompt). Gdy zgody brak / czujnik nieobecny / odmowa → touch-drag,
// więc scena NIGDY nie jest w pełni statyczna. ?debug w URL → HUD z żywym gamma/beta + stanem.

import { onTick } from './scene.js?v=20260702g';

// ─── Konfiguracja ─────────────────────────────────────────────────────────────

const LERP_RATE = 0.10;   // tempo doganiania inputu (niżej = bardziej marzycielski)
const _mob  = window.innerWidth <= 768;
const DEBUG = new URLSearchParams(location.search).has('debug');

// Siła reakcji na input per warstwa. UWAGA: wartości mobile to robocza baza — finalna
// kalibracja po potwierdzeniu żywego sygnału żyroskopu na iOS (HUD: ?debug).
// Wyciszanie ruchu: amplituda mobile −10% (80/50/0.50/0.32 → 72/45/0.45/0.29). (BRIEF 15)
const MOUSE = {
  planet: { x: _mob ? 72 : 28, y: _mob ? 45 : 18 },
  fog:    { x: _mob ? 0.45 : 0.50, y: _mob ? 0.29 : 0.32 },
};

// Autonomiczny dryf — sinusoidy niesynchronizowane (różne okresy, różne fazy)
const DRIFT = {
  planet: [
    { axis: 'x', amp: 20, period: 38, phase: 0.00 },
    { axis: 'y', amp: 13, period: 27, phase: 1.90 },
  ],
  fog: [
    { axis: 'x', amp: 0.13, period: 23, phase: 0.70 },
    { axis: 'y', amp: 0.09, period: 31, phase: 2.40 },
  ],
};

// ─── Stan eksportowany ────────────────────────────────────────────────────────

export const px = {
  planet: { x: 0, y: 0 },
  fog:    { x: 0, y: 0 },
};

// ─── Pomocnicze ───────────────────────────────────────────────────────────────

const clamp1 = v => Math.max(-1, Math.min(1, v));

function makeHUD() {
  if (!DEBUG) return null;
  const el = document.createElement('div');
  el.id = 'gyro-debug';
  document.body.appendChild(el);
  return el;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initParallax(ctx) {
  const { planetMesh, basePlanetY, basePlanetX = 0 } = ctx;

  const raw    = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  const hud    = makeHUD();

  // Stan diagnostyczny — czytany przez HUD i baner.
  const diag = {
    source: 'none',   // none | mouse | gyro | touch
    perm:   'init',   // init | no-api | needs-tap | granted | denied | error | auto
    events: 0,        // licznik realnych eventów deviceorientation
    gamma:  0, beta: 0,
  };

  // ── Mysz (desktop) ──
  window.addEventListener('mousemove', e => {
    raw.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
    raw.y = -(e.clientY / window.innerHeight - 0.5) * 2;  // ekran → świat: Y odwrócone
    diag.source = 'mouse';
  });

  // ── Żyroskop (mobile) ──
  // gamma = obrót lewo/prawo (-90..+90°), beta = przechył przód/tył (0..180°).
  // Kalibracja bazy do pierwszego eventu: neutralna pozycja = jak trzymasz telefon teraz.
  let betaBase = null;
  const GAMMA_RANGE = 23;   // stopnie przechylenia na pełny efekt (±1) — szerszy = spokojniej
  const BETA_RANGE  = 18;
  let gyroLive = false;     // true gdy realnie przychodzą eventy (≠ samej zgody)

  function onOrientation(e) {
    if (e.gamma == null && e.beta == null) return;
    diag.events++;
    diag.gamma = e.gamma || 0;
    diag.beta  = e.beta  || 0;
    gyroLive = true;
    diag.source = 'gyro';
    if (betaBase === null) betaBase = e.beta ?? 90;
    raw.x = clamp1((e.gamma || 0) / GAMMA_RANGE);
    raw.y = clamp1((betaBase - (e.beta ?? betaBase)) / BETA_RANGE);
  }
  const attachGyro = () => window.addEventListener('deviceorientation', onOrientation, true);

  // ── Touch-drag fallback ──
  // Uniwersalny ruch palcem, gdy żyroskop nie nadaje. Aktywny tylko na żywej scenie HOME
  // (nie podczas loadingu / pongu / podstron / kontaktu) i tylko gdy gyro milczy.
  function overlayBusy() {
    if (document.body.classList.contains('is-loading')) return true;
    // Gate (pełny overlay zgody iOS) przejmuje wejście — touch-drag nie rusza sceny pod nim.
    if (banner && banner.classList.contains('is-gate') && !banner.hidden) return true;
    for (const id of ['pong-overlay', 'page', 'contact-overlay']) {
      const el = document.getElementById(id);
      if (el && el.getAttribute('aria-hidden') === 'false') return true;
    }
    return false;
  }

  let touchEnabled = false;
  let tPrev = null;
  function enableTouchFallback() {
    if (touchEnabled) return;
    touchEnabled = true;
    window.addEventListener('touchstart', e => {
      if (gyroLive || overlayBusy()) { tPrev = null; return; }
      tPrev = e.touches[0];
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (gyroLive || overlayBusy() || !tPrev) return;
      const t = e.touches[0];
      raw.x = clamp1(raw.x + (t.clientX - tPrev.clientX) / window.innerWidth  * 2.5);
      raw.y = clamp1(raw.y - (t.clientY - tPrev.clientY) / window.innerHeight * 2.5);
      tPrev = t;
      diag.source = 'touch';
    }, { passive: true });
    window.addEventListener('touchend',    () => { tPrev = null; }, { passive: true });
    window.addEventListener('touchcancel', () => { tPrev = null; }, { passive: true });
  }

  // ── Baner zgody / podpowiedź (mobile) ──
  const banner = document.getElementById('motion-prompt');
  const bText  = banner ? banner.querySelector('.mp-text') : null;
  let bannerHideT = null;

  // Tryby banera (B4 — Opcja A):
  //   'invite' → nieblokujące zaproszenie do żyroskopu (iOS): pill łapie tap (gest do
  //              requestPermission), ale scena pod spodem klikalna, touch-drag działa równolegle.
  //   'touch'  → toast-podpowiedź o przesuwaniu palcem (gdy gyro odmówiony/nieobecny).
  // Gate pełnoekranowy ('tap'/is-gate) ZDJĘTY — nie zmuszamy klienta do kliknięcia.
  function showBanner(msg, mode, autoHideMs) {
    if (!banner) return;
    clearTimeout(bannerHideT);
    if (msg && bText) bText.textContent = msg;
    banner.classList.remove('is-gate', 'is-toast', 'is-invite');
    banner.classList.add(mode === 'invite' ? 'is-invite' : 'is-toast');
    banner.hidden = false;
    banner.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => banner.classList.add('is-on'));
    if (autoHideMs) bannerHideT = setTimeout(hideBanner, autoHideMs);
  }
  function hideBanner() {
    if (!banner) return;
    banner.classList.remove('is-on');
    banner.setAttribute('aria-hidden', 'true');
    setTimeout(() => { banner.hidden = true; banner.classList.remove('is-gate', 'is-toast', 'is-invite'); }, 500);
  }

  // Baner pokazujemy DOPIERO po loading screen (nie walczy o uwagę z sygnetem).
  function whenLoaded(fn) {
    if (!document.body.classList.contains('is-loading')) return fn();
    const obs = new MutationObserver(() => {
      if (!document.body.classList.contains('is-loading')) { obs.disconnect(); fn(); }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // Watchdog: zgoda ≠ czujnik. Po zgodzie/auto sprawdź czy realnie lecą eventy; jak nie
  // (część Androidów, brak żyroskopu) → włącz touch i powiedz o tym.
  function watchdog() {
    const before = diag.events;
    setTimeout(() => {
      if (diag.events === before) {
        enableTouchFallback();
        if (_mob) whenLoaded(() => showBanner('Przesuwaj scenę palcem', 'touch', 4000));
      }
    }, 1500);
  }

  // ── Wybór ścieżki wejścia ──
  if (typeof DeviceOrientationEvent === 'undefined') {
    diag.perm = 'no-api';
    if (_mob) { enableTouchFallback(); whenLoaded(() => showBanner('Przesuwaj scenę palcem', 'touch', 4000)); }

  } else if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ — requestPermission MUSI iść z gestu. Pill-zaproszenie = ten gest, ale OPCJONALNY:
    // nie blokuje sceny. Brak tapnięcia → touch-drag + dryf niosą scenę (Opcja A, B4).
    diag.perm = 'needs-tap';
    enableTouchFallback();   // fallback od razu — scena żyje niezależnie od decyzji o żyroskopie
    whenLoaded(() => showBanner('Przechyl, by ożywić scenę', 'invite', 8000));

    let asking = false;
    const ask = (e) => {
      // KLUCZOWE: zatrzymaj propagację — pill gate jest na środku ekranu, a cursor.js łapie
      // klik <72px od centrum jako „tap w sygnet" → odpalał Q-PONG po zgodzie. (BRIEF 14 #34)
      if (e) { e.stopPropagation(); e.preventDefault(); }
      if (asking) return;
      asking = true;
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          diag.perm = state;
          if (state === 'granted') {
            attachGyro();
            watchdog();          // sprawdzi czy faktycznie lecą eventy
            hideBanner();
          } else {
            showBanner('Przesuwaj scenę palcem', 'touch', 4000);
          }
        })
        .catch(() => {
          diag.perm = 'error';
          showBanner('Przesuwaj scenę palcem', 'touch', 4000);
        });
    };
    if (banner) banner.addEventListener('click', ask);

  } else {
    // Android / iOS < 13 — bez zezwolenia, listener od razu.
    diag.perm = 'auto';
    attachGyro();
    enableTouchFallback();   // gdyby urządzenie nie miało czujnika
    watchdog();
  }

  // ── Pętla ──
  onTick((delta, elapsed) => {
    // Frame-rate independent lerp (stała "odczucia" niezależna od FPS)
    const t = 1 - Math.pow(1 - LERP_RATE, delta * 60);
    smooth.x += (raw.x - smooth.x) * t;
    smooth.y += (raw.y - smooth.y) * t;

    for (const [key, drifts] of Object.entries(DRIFT)) {
      const m = MOUSE[key];
      let ox = smooth.x * m.x;
      let oy = smooth.y * m.y;
      for (const d of drifts) {
        const w = Math.sin(elapsed * (Math.PI * 2 / d.period) + d.phase) * d.amp;
        if (d.axis === 'x') ox += w; else oy += w;
      }
      px[key].x = ox;
      px[key].y = oy;
    }

    // Planeta przesuwa się w jedn. świata (x/y mają bazę zadaną w scene.js)
    planetMesh.position.x = basePlanetX + px.planet.x;
    planetMesh.position.y = basePlanetY + px.planet.y;

    if (hud) {
      hud.textContent =
        `perm: ${diag.perm}\n` +
        `src:  ${diag.source}\n` +
        `ev:   ${diag.events}\n` +
        `γ ${diag.gamma.toFixed(1)}  β ${diag.beta.toFixed(1)}\n` +
        `raw ${raw.x.toFixed(2)} ${raw.y.toFixed(2)}`;
    }
  });
}
