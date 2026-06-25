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

// Siła reakcji na mysz per warstwa
// planet — jedn. świata; mouse ±1 = krawędź ekranu
// fog    — height-units (0..1 = pełna wysokość ekranu)
const MOUSE = {
  planet: { x: 28, y: 18 },    // słabiej — daleko w scenie
  fog:    { x: 0.50, y: 0.32 }, // mocniej — blisko kamery
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
