// studio.js — Studio „ożywiony monitor": pulsujący hotspot nad środkowym ekranem konsolety w tle.
// Nie zdradza treści (tylko puls kusi); hover = narożniki HUD + glif; klik → lightbox z realizacjami
// (podpis + link). Hotspot pozycjonowany z GEOMETRII TŁA (background cover) → trzyma się ekranu na
// każdej szerokości okna. Desktop celuje w LEWY ekran, mobile w ŚRODKOWY (ładnie wykadrowany przy
// cover-center na wąskim ekranie). Na mobile position:fixed — kolumna Studio scrolluje nad tłem.

import { t } from './i18n.js?v=msc1gg2z';

const SHOTS = [
  {
    src: '../assets/studio/st-01.webp',
    cap: '2023 — prace nad audiobookiem „Valentino Rossi. Biografia" · czyta Mateusz Kapusta',
    link: 'https://audioteka.com/pl/audiobook/valentino-rossi-biografia/',
    linkLabel: 'Posłuchaj w Audiotece →',
  },
  {
    src: '../assets/studio/st-02.webp',
    cap: '2026 — przygotowania do sesji nagraniowej · Studio koncertowe Radia Katowice im. Jerzego Haralda',
    link: 'https://radio.katowice.pl/txt,4,Studio-nagran.html',
    linkLabel: 'Radio Katowice →',
  },
];

// Intrinsic tła dep-studio (16:9) + pozycja ekranu w OBRAZIE (ułamki 0..1). Do NUDGE.
const IMG_W = 1920, IMG_H = 1080;
// Desktop: LEWY ekran (mapa + kula). Mobile: ŚRODKOWY ekran (mierniki) — przy cover-center to on
// jest ładnie wykadrowany na wąskim ekranie (lewy wypada przy krawędzi). left, top, width, height.
const HOT        = { fx: 0.323, fy: 0.569, fw: 0.116, fh: 0.059 };
const HOT_MOBILE = { fx: 0.451, fy: 0.567, fw: 0.096, fh: 0.062 };
const mqMobile = window.matchMedia('(max-width: 768px)');
const pad = n => String(n).padStart(2, '0');

// Assety jako ABSOLUTNY URL z URL modułu — ODPORNY na SPA pushState (router zmienia document.baseURI
// na /studio → względne ../assets/… 404-owały na żywo; localhost maskował). DOC_ROOT = katalog /src/.
const DOC_ROOT = new URL('../', import.meta.url).href;
const asset = rel => new URL(rel, DOC_ROOT).href;

export function initStudioMonitor() {
  const hot = document.querySelector('[data-studio-monitor]');
  const lb  = document.getElementById('studio-lightbox');
  if (!hot || !lb || !SHOTS.length) return;

  const lbFig  = lb.querySelector('.lb-figure');
  const lbImg  = lb.querySelector('.lb-img');
  const lbCap  = lb.querySelector('.lb-cap');
  const lbLink = lb.querySelector('.lb-link');
  const lbIdx  = lb.querySelector('.lb-idx');
  const lbTot  = lb.querySelector('.lb-total');
  lbTot.textContent = pad(SHOTS.length);

  let cur = 0;

  // ── Pozycja hotspotu z geometrii tła (cover, wyśrodkowane) ──────────────────
  function positionHot() {
    const h = mqMobile.matches ? HOT_MOBILE : HOT;     // mobile → środkowy ekran, desktop → lewy
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.max(vw / IMG_W, vh / IMG_H);   // cover
    const rw = IMG_W * scale, rh = IMG_H * scale;
    const ox = (vw - rw) / 2, oy = (vh - rh) / 2;     // center
    hot.style.left   = (ox + h.fx * rw) + 'px';
    hot.style.top    = (oy + h.fy * rh) + 'px';
    hot.style.width  = (h.fw * rw) + 'px';
    hot.style.height = (h.fh * rh) + 'px';
  }
  positionHot();
  window.addEventListener('resize', positionHot);
  mqMobile.addEventListener('change', positionHot);   // przełączenie desktop↔mobile (obrót/resize)

  // ── Lightbox ────────────────────────────────────────────────────────────────
  function render() {
    const s = SHOTS[cur];
    const url = asset(s.src);
    lbImg.src = url;
    if (lbFig) lbFig.style.setProperty('--lb-amb', `url("${url}")`);   // ambilight
    lbImg.alt = s.cap ? t(s.cap) : `${t('Realizacja studia')} ${cur + 1}`;
    lbCap.textContent = s.cap ? t(s.cap) : '';
    lbCap.style.display = s.cap ? '' : 'none';
    if (s.link) {
      lbLink.href = s.link;
      lbLink.textContent = t(s.linkLabel || 'Zobacz →');
      lbLink.style.display = '';
    } else {
      lbLink.style.display = 'none';
    }
    lbIdx.textContent = pad(cur + 1);
  }
  const show = i => { cur = (i + SHOTS.length) % SHOTS.length; render(); };

  function open(i) {
    show(i);
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
  }
  function close() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
  }

  hot.addEventListener('click', () => open(0));
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); show(cur + 1); });
  lb.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); show(cur - 1); });
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  window.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(cur + 1);
    else if (e.key === 'ArrowLeft')  show(cur - 1);
  });
}
