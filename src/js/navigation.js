// navigation.js — hover działu → reakcja sceny WebGL (Etap 7), GSAP-em.
// Warstwa DOM (neonowa nitka + label glow + tooltip) jest w CSS; tu warstwa 3D:
//   • tint atmosfery (skoncentrowany po stronie działu — atmosphere.js)
//   • outline sygnetu zmienia kolor na kolor działu (signet.js)
//   • sygnet pochyla się w stronę działu (signet.js)
// Wszystko czyta navFX, który tu płynnie tweenujemy.

import * as GSAPmod from 'gsap';
import { DIVISION_COLORS, DIVISION_DIR, DIVISION_LEAN, BASE_TINT, navFX } from './tint.js';

// +esm bywa default albo named — bądź odporny na obie postacie
const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const DUR  = 0.7;
const EASE = 'power2.out';

export function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(el => {
    const d = el.dataset.division;
    if (!DIVISION_COLORS[d]) return;

    el.addEventListener('mouseenter', () => {
      const c = DIVISION_COLORS[d], dir = DIVISION_DIR[d], lean = DIVISION_LEAN[d];
      gsap.to(navFX.target, {
        r: c.r, g: c.g, b: c.b, duration: DUR, ease: EASE, overwrite: 'auto',
      });
      gsap.to(navFX, {
        intensity: 1,
        dirX: dir.x, dirY: dir.y,
        leanX: lean.x, leanY: lean.y,
        duration: DUR, ease: EASE, overwrite: 'auto',
      });
    });

    el.addEventListener('mouseleave', () => {
      gsap.to(navFX, {
        intensity: 0, leanX: 0, leanY: 0,
        duration: DUR, ease: EASE, overwrite: 'auto',
      });
      gsap.to(navFX.target, {
        r: BASE_TINT.r, g: BASE_TINT.g, b: BASE_TINT.b,
        duration: DUR, ease: EASE, overwrite: 'auto',
      });
    });
  });
}
