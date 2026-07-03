// nav-intro.js — jednorazowa animacja wejścia nawigacji („głowica energii").
// Po loading screenie z sygnetu wyrasta impuls (pierścień), potem trzy linie rosną OD sygnetu
// (scale 0→1, transform-origin przy sygnecie) z gorącym glow, który STYGNIE do spoczynku;
// gdy linia dobije — napis działu wchodzi blur-to-sharp z „ładunkiem" koloru gasnącym do bieli.
// Stagger: EVENTS+STUDIO równo, LAB +0.2s. Gra RAZ (wołane z loader.finish, który leci raz/ładowanie).
// Desktop only — mobile nie ma linii (karty ogarnia loader); prefers-reduced-motion → bez choreografii.

import * as GSAPmod from 'gsap';
const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const REST_LABEL = 'rgba(255,255,255,0.92)';   // spoczynkowy kolor .nav-label
const DRAW  = 0.55;   // czas rośnięcia linii
const LABEL = 0.5;    // czas wejścia napisu

export function playNavIntro() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth <= 768;

  // Mobile (brak linii) / reduced-motion → tylko odsłoń nav, bez choreografii.
  if (isMobile || reduce) { gsap.to(nav, { opacity: 1, duration: 0.4, ease: 'power2.out' }); return; }

  const arms = [
    { sel: '#nav-events', axis: 'scaleX', origin: 'right center', color: cssVar('--color-events') || '#7C3AED', t: 0   },
    { sel: '#nav-studio', axis: 'scaleX', origin: 'left center',  color: cssVar('--color-studio') || '#1E90FF', t: 0   },
    { sel: '#nav-lab',    axis: 'scaleY', origin: 'top center',   color: cssVar('--color-lab')    || '#00E5FF', t: 0.2 },
  ];

  const pulse = document.getElementById('nav-pulse');
  const q = sel => document.querySelector(sel);

  // Wyłącz przejścia CSS linii/napisów na czas choreografii (GSAP pisze inline co klatkę).
  nav.classList.add('nav-intro');

  // Stan startowy — zanim nav się odsłoni (bez flasha pełnych linii). Kontener od razu widoczny;
  // reveal niosą dzieci (linie/napisy/pierścień), więc nic nie „popuje".
  arms.forEach(a => {
    const line = q(`${a.sel} .nav-line`);
    const label = q(`${a.sel} .nav-label`);
    if (line)  gsap.set(line,  { [a.axis]: 0, transformOrigin: a.origin });
    if (label) gsap.set(label, { opacity: 0, filter: 'blur(8px)' });
  });
  gsap.set(nav, { opacity: 1 });

  const tl = gsap.timeline({
    onComplete: () => {
      nav.classList.remove('nav-intro');
      arms.forEach(a => {
        const line = q(`${a.sel} .nav-line`);
        const label = q(`${a.sel} .nav-label`);
        if (line)  gsap.set(line,  { clearProps: 'transform,boxShadow' });
        if (label) gsap.set(label, { clearProps: 'opacity,filter,color' });
      });
      // UWAGA: NIE czyścimy inline opacity z #nav — is-loading jeszcze trwa (~do 3.2s) i reguła
      // body.is-loading #nav{opacity:0} kazałaby nav zniknąć. Inline opacity:1 zostaje (nieszkodliwe).
    },
  });

  // IMPULS — pierścień emitowany z sygnetu (flash). GSAP trzyma centrowanie (xPercent/yPercent).
  if (pulse) {
    gsap.set(pulse, { xPercent: -50, yPercent: -50, scale: 0.25, opacity: 0 });
    tl.to(pulse, { opacity: 0.8, duration: 0.12, ease: 'power2.out' }, 0)
      .to(pulse, { scale: 2.5, opacity: 0, duration: 0.8, ease: 'power2.out' }, 0.06);
  }

  // Linie wyrastają + napisy dobijają
  arms.forEach(a => {
    const line = q(`${a.sel} .nav-line`);
    const label = q(`${a.sel} .nav-label`);
    const s = 0.18 + a.t;   // start: Events/Studio ~0.18s, Lab +0.2s
    if (line) {
      tl.fromTo(line,
        { [a.axis]: 0, boxShadow: `0 0 9px ${a.color}, 0 0 18px ${a.color}` },
        { [a.axis]: 1, boxShadow: '0 0 0px rgba(255,255,255,0), 0 0 0px rgba(255,255,255,0)', duration: DRAW, ease: 'power2.out' }, s);
    }
    if (label) {
      tl.fromTo(label,
        { opacity: 0, filter: 'blur(8px)', color: a.color },
        { opacity: 1, filter: 'blur(0px)', color: REST_LABEL, duration: LABEL, ease: 'power2.out' }, s + DRAW - 0.12);
    }
  });
}
