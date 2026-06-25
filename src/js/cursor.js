// cursor.js — natywny kursor systemowy + poświata (glow) pod nim.
// Glow pojawia się przy ruchu, zanika po 500ms bezruchu.
// Kolor: primary (violet) na HOME, kolor działu na hover nawijacji i podstronach.

import * as GSAPmod from 'gsap';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const COLORS = {
  base:   '#5B2EFF',
  events: '#9D4EDD',
  studio: '#1E90FF',
  lab:    '#00E5FF',
};

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function initCursor() {
  const glow = document.getElementById('cursor-glow');
  if (!glow) return;
  const page = document.getElementById('page');

  let idleTimer  = null;
  let currentKey = 'base';
  const rgb = { ...hexToRgb(COLORS.base) };

  const applyRgb = () => {
    glow.style.boxShadow =
      `0 0 55px 28px rgb(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)})`;
  };
  applyRgb();

  function updateColor(key) {
    const k = COLORS[key] ? key : 'base';
    if (k === currentKey) return;
    currentKey = k;
    const target = hexToRgb(COLORS[k]);
    gsap.to(rgb, {
      ...target, duration: 0.35, ease: 'power2.out', overwrite: 'auto', onUpdate: applyRgb,
    });
  }

  const pageActive = () => document.body.classList.contains('page-active');

  // Sygnet + linia + etykieta = jedna zona kliknięcia
  // Kliknięcie w centrum sygnetu (gdy nav-pong widoczny) = to samo co klik przycisku
  window.addEventListener('click', e => {
    if (e.target?.closest('#nav-pong')) return; // przycisk sam się obsługuje
    const pongOn  = document.body.classList.contains('pong-active');
    const pageOn  = document.body.classList.contains('page-active');
    const loading = document.body.classList.contains('is-loading');
    if (pongOn || pageOn || loading) return;
    const W2    = window.innerWidth  * 0.5;
    const H2    = window.innerHeight * 0.5;
    const distC = Math.hypot(e.clientX - W2, e.clientY - H2);
    const inLeg = e.clientY < H2 - 70 && e.clientY > H2 - 190 && Math.abs(e.clientX - W2) < 70;
    if (distC < 72 || inLeg) document.getElementById('nav-pong')?.click();
  });

  window.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';

    gsap.to(glow, { opacity: 1, duration: 0.12, overwrite: 'auto' });

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      gsap.to(glow, { opacity: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
    }, 500);

    const t   = e.target;
    const hit = sel => t?.closest?.(sel);

    // signet-hover: kursor blisko centrum LUB w "korytarzu" ku przyciskowi Ponga (gap ~25px)
    const W2    = window.innerWidth  * 0.5;
    const H2    = window.innerHeight * 0.5;
    const distC = Math.hypot(e.clientX - W2, e.clientY - H2);
    const onPong   = !!hit('#nav-pong');
    // Korytarz w górę — wypełnia lukę między strefą 72px a dolną krawędzią przycisku Ponga
    const inLeg    = e.clientY < H2 - 70 && e.clientY > H2 - 190 && Math.abs(e.clientX - W2) < 70;
    const loading  = document.body.classList.contains('is-loading');
    const pongOn   = document.body.classList.contains('pong-active');
    document.body.classList.toggle('signet-hover',
      (distC < 72 || inLeg || onPong) && !pageActive() && !loading && !pongOn,
    );

    if (pageActive()) {
      updateColor(page?.dataset?.division || 'base');
    } else if (hit('.nav-item')) {
      updateColor(hit('.nav-item').dataset.division);
    } else {
      updateColor('base');
    }
  });
}
