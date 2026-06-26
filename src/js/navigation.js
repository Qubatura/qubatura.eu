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

// Timeline'y HUD wszystkich dywizji — zbierane przy init, resetowane przy powrocie na HOME
const hudTimelines = [];

// Aktywne tweeny reakcji sygnetu — w scope modułu, żeby resetNavState()/router mogły je
// ubić przy zmianie stanu (powrót HOME / wejście na podstronę).
let beat  = null;   // „heartbeat" przy wejściu: puls skali + eksplozja glow
let pull  = null;   // pulsujące przyciąganie tug w stronę działu (yoyo, nieskończone)
let nudge = null;   // cykliczny impuls obrotu sygnetu ku dywizji (yoyo, nieskończony)

// Jeden silnik nudge — używany przez wszystkie 4 odnogi nav (Events/Studio/Lab/Q-PONG).
// gsap.set do 0 przed tweenем: gwarantuje że yoyo zawsze biegnie 0 → target → 0,
// a nie od resztkowej wartości poprzedniego hover (co powodowało "zawsze Events" bug).
function startNudge(rotY, rotX) {
  if (nudge) nudge.kill();
  gsap.killTweensOf(navFX, 'nudgeRotY,nudgeRotX');  // ubija tween powrotny z stopNudge
  gsap.set(navFX, { nudgeRotY: 0, nudgeRotX: 0 });  // bazuje yoyo zawsze na 0
  nudge = gsap.to(navFX, {
    nudgeRotY: rotY, nudgeRotX: rotX,
    duration: 0.65, ease: 'sine.inOut', yoyo: true, repeat: -1, repeatDelay: 0.35,
  });
}
function stopNudge() {
  if (nudge) { nudge.kill(); nudge = null; }
  gsap.to(navFX, { nudgeRotY: 0, nudgeRotX: 0, duration: 0.4, ease: EASE, overwrite: 'auto' });
}

// Wymuszenie czystego stanu nawigacji — wołane przez router.js przy renderze HOME.
// Naprawia „zamrożone" HUD-y: guard trybu strony blokuje mouseleave, więc timeline
// klikniętej dywizji nie cofa się sam. Tu cofamy WSZYSTKIE do czasu 0 (stan ukryty).
export function resetNavState() {
  hudTimelines.forEach(tl => tl.pause(0));   // seek do 0 = stan „from" (opacity 0, ukryte)
  navFX.activeDiv = null;                     // zgaś chmury tintu przy napisach
  if (beat) { beat.kill(); beat = null; }
  if (pull) { pull.kill(); pull = null; }
  stopNudge();
  // Tint sceny i sygnet resetuje closePage() w router.js (tweenem) — nie dublujemy tu.
}

export function initNavigation() {
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
      hudTimelines.push(hud);   // do resetNavState() przy powrocie na HOME
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

      // Pulsujące przyciąganie — sygnet „oddycha" w stronę działu: pozycja bazowa → bliżej
      // działu → baza, w nieskończonej, miękkiej pętli (sine.inOut). Zamiast statycznego
      // przechylenia, które tu było wcześniej. fromTo {0,0} → cel z yoyo gwarantuje powrót
      // do bazy w każdym cyklu (nie utyka przy dziale).
      if (pull) pull.kill();
      pull = gsap.timeline({ repeat: -1, yoyo: true });
      pull.fromTo(navFX,
        { tugX: 0, tugY: 0 },
        { tugX: dir.x * TUG, tugY: dir.y * TUG, duration: 1.6, ease: 'sine.inOut' });

      // Cykliczny zwrot „głowy" sygnetu (tug = pozycja; nudge = obrót — dwa osobne kanały)
      startNudge(dir.x * 0.25, -dir.y * 0.18);

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
      if (pull) { pull.kill(); pull = null; }
      stopNudge();
      gsap.to(navFX, {
        intensity: 0, glow: 0, pulse: 0,
        duration: 0.5, ease: EASE, overwrite: 'auto',
      });
      // Dryf powrotny do bazy — równie dostojny, wolny (z punktu, w którym zastał go puls)
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

  // Q-PONG — brak DIVISION_COLORS, więc pominięty wyżej; dodajemy tylko cykliczny zwrot ku górze
  if (isDesktop) {
    const pongEl = document.querySelector('#nav-pong');
    if (pongEl) {
      pongEl.addEventListener('mouseenter', () => {
        if (document.body.classList.contains('page-active')) return;
        startNudge(0, -0.18);   // Q-PONG jest u góry → sygnet patrzy w górę
      });
      pongEl.addEventListener('mouseleave', () => stopNudge());
    }
  }
}
