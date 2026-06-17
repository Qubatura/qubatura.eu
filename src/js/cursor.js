// cursor.js — własna kulka kursora ze stanami sterowanymi GSAP (zero CSS transition).
// Stany na HOME: idle / hover dywizji / hover sygnetu (pulse) / hover topbaru.
// Na podstronach: idle magenta, a nad elementami interaktywnymi kolor akcentu DYWIZJI,
//   na której aktualnie jesteśmy (#page[data-division]).

import * as GSAPmod from 'gsap';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const C = {
  idle:   '#E0218A',   // magenta — stan bazowy
  events: '#7C3AED',
  studio: '#1E90FF',
  lab:    '#00E5FF',
  signet: '#ffffff',
};

const SIGNET_R = 95;   // promień strefy „hover sygnetu" wokół środka ekranu (px)

export function initCursor() {
  const cur  = document.getElementById('cursor');
  if (!cur) return;
  const page = document.getElementById('page');

  // GSAP przejmuje transform: centrowanie (xPercent/yPercent) + pulse (scale)
  gsap.set(cur, { xPercent: -50, yPercent: -50 });

  let pulseTl = null;
  let key     = null;   // nazwa aktualnego stanu — apply tylko przy zmianie

  function applyVisual({ size, color, pulse }) {
    if (pulseTl) { pulseTl.kill(); pulseTl = null; }
    // rozmiar / kolor / glow — powrót do idle zawsze 0.3s ease
    gsap.to(cur, {
      width: size, height: size,
      backgroundColor: color,
      boxShadow: `0 0 ${Math.round(size * 1.8)}px ${color}`,
      duration: 0.3, ease: 'power2.out', overwrite: 'auto',
    });
    if (pulse) {
      gsap.set(cur, { scale: 1 });
      pulseTl = gsap.timeline({ repeat: -1, yoyo: true });
      pulseTl.to(cur, { scale: 1.15, duration: 0.6, ease: 'sine.inOut' });  // cykl 1.2s
    } else {
      gsap.to(cur, { scale: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    }
  }

  const STATES = {
    idle:   { size: 6,  color: C.idle },
    events: { size: 14, color: C.events },
    studio: { size: 14, color: C.studio },
    lab:    { size: 14, color: C.lab },
    signet: { size: 18, color: C.signet, pulse: true },
    topbar: { size: 10, color: C.idle },
  };

  function setState(name, accentDiv) {
    let k, state;
    if (name === 'page-accent') {
      const div = accentDiv || 'idle';
      k = 'page-' + div;
      state = { size: 14, color: C[div] || C.idle };
    } else {
      k = name;
      state = STATES[name] || STATES.idle;
    }
    if (k === key) return;
    key = k;
    applyVisual(state);
  }

  const pageActive = () => document.body.classList.contains('page-active');

  window.addEventListener('mousemove', e => {
    cur.style.left = e.clientX + 'px';
    cur.style.top  = e.clientY + 'px';

    const t = e.target;
    const hit = sel => (t && t.closest ? t.closest(sel) : null);

    if (hit('#top-right, #tagline')) {
      setState('topbar');                                   // KONTAKT / EN / waveform / tagline (10px magenta)
    } else if (pageActive() && hit('.page-cta, .page-mail, .page-gallery, #page-back, #page a')) {
      setState('page-accent', page && page.dataset.division);  // akcent dywizji aktualnej podstrony
    } else if (!pageActive() && hit('.nav-item')) {
      setState(hit('.nav-item').dataset.division);          // events / studio / lab
    } else if (!pageActive() &&
               Math.hypot(e.clientX - window.innerWidth * 0.5,
                          e.clientY - window.innerHeight * 0.5) < SIGNET_R) {
      setState('signet');                                   // strefa sygnetu (środek)
    } else {
      setState('idle');
    }
  });
}
