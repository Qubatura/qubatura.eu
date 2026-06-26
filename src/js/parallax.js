// parallax.js — warstwowy parallax + autonomiczny dryf sceny
//
// Dwie warstwy:
//   planet  — mesh Three.js z=-500, przesuwa się w jedn. świata
//   fog     — shader atmosphere.js, przesuwa się w "height units" (offset UV shadera)
//
// Każda warstwa: (mouse * siła) + sin-dryf z innym okresem = razem.
// px.planet/fog eksportowane jako live state — atmosphere.js czyta px.fog co klatkę.

import { onTick } from './scene.js';

// ─── Konfiguracja ─────────────────────────────────────────────────────────────

const LERP_RATE = 0.10;   // tempo doganiania myszy (niżej = bardziej marzycielski)

// Siła reakcji na mysz/żyroskop per warstwa.
// Na mobile żyroskop daje pełny zakres ±1 już przy ±20° → mocniejsze wartości dają
// efekt "latania po planecie". Planet jest 2000wu wide — jest gdzie jeździć.
const _mob = window.innerWidth <= 768;
const MOUSE = {
  planet: { x: _mob ? 130 : 28, y: _mob ? 80 : 18 },
  fog:    { x: _mob ? 0.80 : 0.50, y: _mob ? 0.52 : 0.32 },
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

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initParallax(ctx) {
  const { planetMesh, basePlanetY } = ctx;

  const raw    = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

  window.addEventListener('mousemove', e => {
    raw.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
    raw.y = -(e.clientY / window.innerHeight - 0.5) * 2;  // ekran → świat: Y odwrócone
  });

  // Żyroskop (mobile) — przechylenie telefonu zastępuje mysz.
  // gamma = obrót lewo/prawo (-90..+90°), beta = przechyl przód/tył (0..180°).
  // Kalibracja do pierwszego eventu: neutralna pozycja = jak trzymasz telefon teraz.
  {
    let betaBase = null;
    const GAMMA_RANGE = 18;   // stopnie przechylenia na pełny efekt (±1)
    const BETA_RANGE  = 14;   // stopnie od bazowej pozycji na pełny efekt

    function onOrientation(e) {
      if (e.gamma == null) return;
      if (betaBase === null) betaBase = e.beta ?? 90;
      raw.x =  Math.max(-1, Math.min(1, (e.gamma || 0) / GAMMA_RANGE));
      raw.y =  Math.max(-1, Math.min(1, (betaBase - (e.beta ?? betaBase)) / BETA_RANGE));
    }

    if (typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ — requestPermission wymaga gestu użytkownika. Ponawiamy przy każdym dotyku
        // (nie tylko pierwszym) — dialog pojawia się tylko raz, kolejne wywołania zwracają
        // cached decyzję bez UI. Dzięki temu nie tracimy szansy gdy użytkownik nie widział
        // pierwszego dialogu (loading screen, nieoczekiwany timing).
        let gyroGranted = false;
        function tryGyro() {
          if (gyroGranted) return;
          DeviceOrientationEvent.requestPermission()
            .then(s => {
              if (s === 'granted' && !gyroGranted) {
                gyroGranted = true;
                window.addEventListener('deviceorientation', onOrientation, true);
              }
            })
            .catch(() => {});
        }
        // click jest pewniejszy niż touchstart jako "user gesture" na iOS Safari
        document.addEventListener('click',      tryGyro, { passive: true });
        document.addEventListener('touchstart', tryGyro, { passive: true });
      } else {
        // Android i iOS < 13 — bez zezwolenia, listener od razu
        window.addEventListener('deviceorientation', onOrientation, true);
      }
    }
  }

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

    // Planeta przesuwa się w jedn. świata (x=0 jest bazą, y ma offset viewTop)
    planetMesh.position.x = px.planet.x;
    planetMesh.position.y = basePlanetY + px.planet.y;
  });
}
