// cursor.js — własny kursor HUD (dwa narożniki po przekątnej) ze stanami sterowanymi GSAP.
// Geometrię (rozmiar = odległość narożników) animuje zmienna CSS --size; zero CSS transition.
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

  let pulseTl = null;
  let key     = null;          // nazwa aktualnego stanu — apply tylko przy zmianie
  const sizeP = { v: 18 };     // proxy dla animacji zmiennej CSS --size (px)

  const setSize = () => cur.style.setProperty('--size', sizeP.v + 'px');

  function applyVisual({ size, color, pulse }) {
    if (pulseTl) { pulseTl.kill(); pulseTl = null; }

    // rozmiar (odległość narożników) — powrót do bazy zawsze 0.3s ease
    gsap.to(sizeP, {
      v: size, duration: 0.3, ease: 'power2.out', overwrite: 'auto', onUpdate: setSize,
    });
    // wspólny kolor (currentColor dziedziczą oba narożniki + glow)
    gsap.to(cur, { color, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });

    // pulse „lock-on" — oddech rozmiaru size↔size+3, cykl 1.2s (startuje po wejściu)
    if (pulse) {
      pulseTl = gsap.timeline({ repeat: -1, yoyo: true, delay: 0.3 });
      pulseTl.to(sizeP, { v: size + 3, duration: 0.6, ease: 'sine.inOut', onUpdate: setSize });
    }
  }

  const STATES = {
    idle:   { size: 18, color: C.idle },
    events: { size: 12, color: C.events },
    studio: { size: 12, color: C.studio },
    lab:    { size: 12, color: C.lab },
    signet: { size: 16, color: C.signet, pulse: true },
    coords: { size: 16, color: C.signet },
    topbar: { size: 14, color: C.idle },
  };

  function setState(name, accentDiv) {
    let k, state;
    if (name === 'page-accent') {
      const div = accentDiv || 'idle';
      k = 'page-' + div;
      state = { size: 12, color: C[div] || C.idle };
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

    if (hit('.contact-coords')) {
      setState('coords');                                   // koordynaty w overlayu → 16px biały (bez pulse)
    } else if (hit('#top-right, #tagline')) {
      setState('topbar');                                   // KONTAKT / EN / waveform / tagline (10px magenta)
    } else if (pageActive() && hit('.page-cta, .page-gallery, #page-back, #page a')) {
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
