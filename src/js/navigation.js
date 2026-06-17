// navigation.js — hover działu → reakcja sceny WebGL (Etap 7), GSAP-em.
// Warstwa DOM (neonowa nitka + label glow + tooltip) jest w CSS; tu warstwa 3D:
//   • tint atmosfery (skoncentrowany po stronie działu — atmosphere.js)
//   • outline sygnetu zmienia kolor na kolor działu (signet.js)
//   • przy wejściu: JEDEN puls „uderzenie serca" — skala 1.0→1.15→1.0 + eksplozja glow (signet.js)
//   • potem spokojny dryf w kolorze działu
// Wszystko czyta navFX, który tu płynnie tweenujemy.

import * as GSAPmod from 'gsap';
import { DIVISION_COLORS, DIVISION_DIR, BASE_TINT, navFX } from './tint.js';

// +esm bywa default albo named — bądź odporny na obie postacie
const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const EASE = 'power2.out';
const TUG  = 9;   // przeskok w stronę działu w jedn. świata (~28px @1080p)

export function initNavigation() {
  let beat = null;   // aktywny timeline „uderzenia serca"
  // HUD animujemy GSAP-em tylko na desktopie; na mobile jest statyczny (CSS)
  const isDesktop = window.matchMedia('(hover: hover) and (min-width: 769px)').matches;

  document.querySelectorAll('.nav-item').forEach(el => {
    const d = el.dataset.division;
    if (!DIVISION_COLORS[d]) return;

    // ── HUD (sci-fi celownik): narożniki rysują się z zewnątrz do środka,
    //    tekst fade-in z przesunięciem +8px ↑. Wyjście = odwrócony timeline.
    let hud = null;
    if (isDesktop) {
      const corners = el.querySelectorAll('.hud-corner');
      const texts   = el.querySelectorAll('.hud-title, .hud-services');
      hud = gsap.timeline({ paused: true });
      hud.fromTo(corners,
        { opacity: 0,
          x: (i, t) => (t.classList.contains('tr') || t.classList.contains('br')) ?  12 : -12,
          y: (i, t) => (t.classList.contains('bl') || t.classList.contains('br')) ?  12 : -12 },
        { opacity: 1, x: 0, y: 0, duration: 0.40, ease: 'power2.out', stagger: 0.05 });
      hud.fromTo(texts,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.08 }, 0.18);
    }

    el.addEventListener('mouseenter', () => {
      if (document.body.classList.contains('page-active')) return;  // tryb strony rządzi tintem
      const c = DIVISION_COLORS[d], dir = DIVISION_DIR[d];
      navFX.activeDiv = d;   // włącza chmurę tintu wycentrowaną na napisie tego działu
      if (hud) hud.play();

      // Tint + outline color dochodzą płynnie i ZOSTAJĄ (spokojny dryf w kolorze działu)
      gsap.to(navFX.target, { r: c.r, g: c.g, b: c.b, duration: 0.5, ease: EASE, overwrite: 'auto' });
      gsap.to(navFX, {
        intensity: 1, dirX: dir.x, dirY: dir.y,
        duration: 0.5, ease: EASE, overwrite: 'auto',
      });

      // Dostojny dryf w stronę działu — wolny glide (slow-motion), ZOSTAJE póki hover
      gsap.to(navFX, {
        tugX: dir.x * TUG, tugY: dir.y * TUG,
        duration: 1.35, ease: 'power2.out', overwrite: 'auto',
      });

      // Heartbeat — szybki „sygnał": puls skali + eksplozja glow → opadanie (bez ruchu kierunkowego)
      if (beat) beat.kill();
      beat = gsap.timeline();
      beat.fromTo(navFX, { pulse: 0 }, { pulse: 0.15, duration: 0.35, ease: 'power2.out' }, 0)
          .to(navFX,     { pulse: 0,    duration: 0.55, ease: 'power2.inOut' }, 0.35)
          .fromTo(navFX, { glow: 0 },   { glow: 1,   duration: 0.18, ease: 'power3.out' }, 0)
          .to(navFX,     { glow: 0.3,             duration: 0.60, ease: 'power2.out' }, 0.18);
    });

    el.addEventListener('mouseleave', () => {
      if (document.body.classList.contains('page-active')) return;  // nie zeruj tintu strony
      navFX.activeDiv = null;
      if (hud) hud.reverse();
      if (beat) { beat.kill(); beat = null; }
      gsap.to(navFX, {
        intensity: 0, glow: 0, pulse: 0,
        duration: 0.5, ease: EASE, overwrite: 'auto',
      });
      // Dryf powrotny — równie dostojny, wolny
      gsap.to(navFX, {
        tugX: 0, tugY: 0,
        duration: 1.35, ease: 'power2.out', overwrite: 'auto',
      });
      gsap.to(navFX.target, {
        r: BASE_TINT.r, g: BASE_TINT.g, b: BASE_TINT.b,
        duration: 0.5, ease: EASE, overwrite: 'auto',
      });
    });
  });
}
