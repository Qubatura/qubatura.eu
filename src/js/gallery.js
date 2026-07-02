// gallery.js — Events: galeria realizacji.
// W RAMCE (.page-gallery, 16:9): slideshow jednego zdjęcia, domyślnie DUOTONE (grayscale +
// fioletowy event przez .gal-tint mix-blend:color). Hover → pełny kolor + zoom + pauza autoplay.
// HUD: licznik „01 / 06" + klikalne kropki. Autoplay co FRAME_MS (crossfade CSS).
// KLIK → lightbox prawie pełnoekranowy: pełny kolor, strzałki ‹ ›, klawiatura ← → / Esc,
// klik-tło zamyka, autoplay co LB_MS gdy nie ruszasz, opcjonalny podpis (data cap).
//
// Placeholder-friendly: brak pliku (onerror) → elegancki gradient + „FOTO 0N" (CSS). Kuba wrzuca
// pliki do assets/events/ pod nazwami ev-01.jpg … i galeria od razu żyje (bez zmian w kodzie).

const PHOTOS = [
  { src: '../assets/events/ev-01.jpg', cap: '' },
  { src: '../assets/events/ev-02.jpg', cap: '' },
  { src: '../assets/events/ev-03.jpg', cap: '' },
  { src: '../assets/events/ev-04.jpg', cap: '' },
  { src: '../assets/events/ev-05.jpg', cap: '' },
  { src: '../assets/events/ev-06.jpg', cap: '' },
];

const FRAME_MS = 4500;   // autoplay w ramce
const LB_MS    = 5000;   // autoplay w lightboxie
const pad = n => String(n).padStart(2, '0');

export function initGallery() {
  const gallery = document.querySelector('[data-gallery]');
  if (!gallery || !PHOTOS.length) return;

  const stage    = gallery.querySelector('.gal-stage');
  const idxEl    = gallery.querySelector('.gal-idx');
  const totEl    = gallery.querySelector('.gal-total');
  const dotsWrap = gallery.querySelector('.gal-dots');

  const lb     = document.getElementById('lightbox');
  const lbFig  = lb.querySelector('.lb-figure');
  const lbImg  = lb.querySelector('.lb-img');
  const lbCap  = lb.querySelector('.lb-cap');
  const lbIdx  = lb.querySelector('.lb-idx');
  const lbTot  = lb.querySelector('.lb-total');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = 0;
  let frameTimer = null;
  let lbTimer = null;

  // ── Budowa slajdów + kropek ──────────────────────────────────────────────
  PHOTOS.forEach((p, i) => {
    const slide = document.createElement('div');
    slide.className = 'gal-slide' + (i === 0 ? ' is-active' : '');
    slide.dataset.idx = pad(i + 1);
    const img = new Image();
    img.alt = p.cap || `Realizacja Events ${i + 1}`;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.addEventListener('error', () => slide.classList.add('is-missing'));
    img.src = p.src;
    slide.appendChild(img);
    stage.appendChild(slide);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gal-dot' + (i === 0 ? ' is-on' : '');
    dot.setAttribute('aria-label', `Pokaż zdjęcie ${i + 1}`);
    dot.addEventListener('click', e => { e.stopPropagation(); show(i); restartFrame(); });
    dotsWrap.appendChild(dot);
  });
  totEl.textContent = pad(PHOTOS.length);
  lbTot.textContent = pad(PHOTOS.length);

  const slides = [...stage.querySelectorAll('.gal-slide')];
  const dots   = [...dotsWrap.querySelectorAll('.gal-dot')];

  function show(i) {
    cur = (i + PHOTOS.length) % PHOTOS.length;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === cur));
    dots.forEach((d, k) => d.classList.toggle('is-on', k === cur));
    idxEl.textContent = pad(cur + 1);
  }
  const next = () => show(cur + 1);
  const prev = () => show(cur - 1);

  // ── Autoplay w ramce (pauza: hover / lightbox / nie-Events / reduced-motion) ──
  function frameTick() {
    if (getComputedStyle(gallery).display === 'none') return;   // widoczna tylko na Events
    if (gallery.classList.contains('is-hot')) return;           // hover = pauza
    if (lb.classList.contains('is-open')) return;               // lightbox otwarty
    next();
  }
  function startFrame() { if (!reduceMotion && !frameTimer) frameTimer = setInterval(frameTick, FRAME_MS); }
  function restartFrame() { if (frameTimer) clearInterval(frameTimer); frameTimer = null; startFrame(); }
  startFrame();

  gallery.addEventListener('mouseenter', () => gallery.classList.add('is-hot'));
  gallery.addEventListener('mouseleave', () => gallery.classList.remove('is-hot'));
  gallery.addEventListener('click', () => openLb(cur));
  gallery.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(cur); }
  });

  // ── Lightbox ──────────────────────────────────────────────────────────────
  function renderLb() {
    const p = PHOTOS[cur];
    lbFig.classList.remove('is-missing');
    lbFig.dataset.idx = pad(cur + 1);
    lbImg.onerror = () => lbFig.classList.add('is-missing');
    lbImg.src = p.src;
    lbImg.alt = p.cap || `Realizacja Events ${cur + 1}`;
    lbCap.textContent = p.cap || '';
    lbCap.style.display = p.cap ? '' : 'none';
    lbIdx.textContent = pad(cur + 1);
  }
  function lbTick() { if (!lb.matches(':hover')) { next(); renderLb(); } }
  function startLbAuto() { if (reduceMotion) return; stopLbAuto(); lbTimer = setInterval(lbTick, LB_MS); }
  function stopLbAuto()  { if (lbTimer) { clearInterval(lbTimer); lbTimer = null; } }

  function openLb(i) {
    show(i); renderLb();
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
    startLbAuto();
  }
  function closeLb() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
    stopLbAuto();
  }
  const lbNext = () => { next(); renderLb(); startLbAuto(); };   // manualna nawigacja resetuje timer
  const lbPrev = () => { prev(); renderLb(); startLbAuto(); };

  lb.querySelector('.lb-close').addEventListener('click', closeLb);
  lb.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); lbNext(); });
  lb.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); lbPrev(); });
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  window.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowRight') lbNext();
    else if (e.key === 'ArrowLeft')  lbPrev();
  });
}
