// gallery.js — Events: galeria realizacji (zdjęcia + WIDEO).
// Ramka .page-gallery: slideshow, wtopienie „D" (realny kolor + fiolet w cieniach + owalna maska,
// overlaye w CSS) → hover = czysty pełny kolor „B". Autoplay: zdjęcie ~PHOTO_MS, wideo ~VIDEO_MS.
// Licznik + klikalne kropki.
// Wideo: MP4 muted/loop/playsinline, LAZY (preload=none → pobiera się dopiero przy play()),
// gra tylko gdy jego slajd aktywny (reszta pauzowana) — zero wpływu na start strony.
// Klik → lightbox: strzałki ‹ ›, klawiatura ←/→/Esc, klik-tło zamyka, autoplay, pasek miniaturek
// (dla wideo miniatura = poster + znaczek ▶). Placeholder „FOTO 0N" gdy brak pliku zdjęcia.

// Wideo tymczasowo WYWALONE (Kuba: obecne nieprofesjonalne — dorobi porządne krótkie pętle).
// Kolejność na razie LOSOWANA przy starcie (shuffle w initGallery) — do ustalenia z Kubą.
import { t } from './i18n.js?v=msakzm11';

const MEDIA = [
  { src: '../assets/events/ev-07.webp' },
  { src: '../assets/events/ev-01.webp' },
  { src: '../assets/events/ev-02.webp' },
  { src: '../assets/events/ev-03.webp' },
  { src: '../assets/events/ev-04.webp' },
  { src: '../assets/events/ev-05.webp' },
  { src: '../assets/events/ev-06.webp' },
  { src: '../assets/events/ev-08.webp' },
  { src: '../assets/events/ev-09.webp' },
  { src: '../assets/events/ev-11.webp' },
  { src: '../assets/events/ev-10.webp' },
  { src: '../assets/events/ev-12.webp' },
];

const PHOTO_MS = 2600;   // czas slajdu-zdjęcia — gęsto, by trzymać widza
const VIDEO_MS = 9000;   // (nieużywane póki brak wideo)
const LB_MS    = 5500;   // autoplay w lightboxie
const pad = n => String(n).padStart(2, '0');
const isVid = m => m.type === 'video';

// Assety jako ABSOLUTNY URL liczony z URL modułu (import.meta.url) — ODPORNY na SPA pushState.
// Router zmienia document.baseURI (/events…), przez co względne ../assets/… 404-owały na żywo
// (localhost maskował: root serwera = root projektu). DOC_ROOT = katalog /src/, jak baza dokumentu.
const DOC_ROOT = new URL('../', import.meta.url).href;
const asset = rel => new URL(rel, DOC_ROOT).href;

// Losowa kolejność (Fisher–Yates, in-place) — Kuba ustali docelową
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function initGallery() {
  const gallery = document.querySelector('[data-gallery]');
  if (!gallery || !MEDIA.length) return;
  shuffle(MEDIA);
  const stage    = gallery.querySelector('.gal-stage');
  const idxEl    = gallery.querySelector('.gal-idx');
  const totEl    = gallery.querySelector('.gal-total');
  const dotsWrap = gallery.querySelector('.gal-dots');

  const lb       = document.getElementById('lightbox');
  const lbFig    = lb.querySelector('.lb-figure');
  const lbImg    = lb.querySelector('.lb-img');
  const lbVid    = lb.querySelector('.lb-video');
  const lbCap    = lb.querySelector('.lb-cap');
  const lbIdx    = lb.querySelector('.lb-idx');
  const lbTot    = lb.querySelector('.lb-total');
  const lbThumbs = lb.querySelector('.lb-thumbs');

  // Autoplay gra ZAWSZE — pokaz slajdów to treść, nie ozdoba; nie może zależeć od ustawień
  // dostępności systemu użytkownika (crossfade jest łagodny, nie wywołuje efektu „skoku").
  let cur = 0;
  let frameTimer = null;
  let lbTimer = null;
  const slideVideos = [];   // <video> w ramce (play/pause per aktywność)

  MEDIA.forEach((m, i) => {
    const slide = document.createElement('div');
    slide.className = 'gal-slide' + (i === 0 ? ' is-active' : '');
    slide.dataset.idx = pad(i + 1);
    if (isVid(m)) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      if (m.poster) v.poster = asset(m.poster);
      v.src = asset(m.src);                // preload=none → nie pobiera aż do play()
      slide.appendChild(v);
      slideVideos[i] = v;
    } else {
      // Wtopienie „D": realne zdjęcie w PEŁNYM KOLORZE, jedno <img> (lżej — bez drugiej warstwy).
      // Fiolet-w-cieniach + winieta + owalna maska robią overlaye .gal-stage w CSS; hover → czysty
      // pełny kolor („B"). Zdjęcie widoczne od razu w spoczynku (też na mobile, bez hovera).
      const photo = new Image();
      photo.className = 'gal-photo';
      photo.alt = `Realizacja Events ${i + 1}`;
      photo.decoding = 'async';
      photo.loading = 'lazy';
      photo.addEventListener('error', () => slide.classList.add('is-missing'));
      photo.src = asset(m.src);
      slide.appendChild(photo);
    }
    stage.appendChild(slide);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gal-dot' + (i === 0 ? ' is-on' : '');
    dot.setAttribute('aria-label', `${t('Pokaż')} ${i + 1}`);
    dot.addEventListener('click', e => { e.stopPropagation(); show(i); armFrame(); });
    dotsWrap.appendChild(dot);

    // Miniatura w lightboxie (wideo → poster + znaczek ▶ przez CSS .is-video)
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'lb-thumb' + (i === 0 ? ' is-on' : '') + (isVid(m) ? ' is-video' : '');
    thumb.dataset.idx = pad(i + 1);
    thumb.setAttribute('aria-label', `${t('Pokaż')} ${i + 1}`);
    const tImg = new Image();
    tImg.alt = '';
    tImg.addEventListener('error', () => thumb.classList.add('is-missing'));
    tImg.src = asset(isVid(m) ? (m.poster || m.src) : m.src);
    thumb.appendChild(tImg);
    thumb.addEventListener('click', e => { e.stopPropagation(); show(i); renderLb(); startLbAuto(); });
    lbThumbs.appendChild(thumb);
  });
  totEl.textContent = pad(MEDIA.length);
  lbTot.textContent = pad(MEDIA.length);

  const slides = [...stage.querySelectorAll('.gal-slide')];
  const dots   = [...dotsWrap.querySelectorAll('.gal-dot')];
  const thumbs = [...lbThumbs.querySelectorAll('.lb-thumb')];

  // Odtwarzaj wideo aktywnego slajdu w RAMCE (playIdx); reszta pauza. playIdx=-1 → wszystkie pauza
  // (używane gdy lightbox przejmuje odtwarzanie).
  function playFrameVideo(playIdx) {
    slideVideos.forEach((v, k) => {
      if (!v) return;
      if (k === playIdx) { const p = v.play(); if (p) p.catch(() => {}); }
      else v.pause();
    });
  }

  function show(i) {
    cur = (i + MEDIA.length) % MEDIA.length;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === cur));
    dots.forEach((d, k) => d.classList.toggle('is-on', k === cur));
    idxEl.textContent = pad(cur + 1);
    if (!lb.classList.contains('is-open')) playFrameVideo(cur);
  }
  const next = () => show(cur + 1);
  const prev = () => show(cur - 1);

  // ── Autoplay ramki (setTimeout — różny czas zdjęcie/wideo; pauza: hover/lightbox/nie-Events) ──
  const frameDur = () => (isVid(MEDIA[cur]) ? VIDEO_MS : PHOTO_MS);
  function frameTick() {
    const blocked = getComputedStyle(gallery).display === 'none'
      || gallery.classList.contains('is-hot')
      || lb.classList.contains('is-open');
    if (!blocked) next();
    armFrame();
  }
  function armFrame() {
    if (frameTimer) clearTimeout(frameTimer);
    frameTimer = setTimeout(frameTick, frameDur());
  }
  armFrame();
  playFrameVideo(0);   // gdyby pierwszy slajd był wideo

  gallery.addEventListener('mouseenter', () => gallery.classList.add('is-hot'));
  gallery.addEventListener('mouseleave', () => gallery.classList.remove('is-hot'));
  gallery.addEventListener('click', () => openLb(cur));
  gallery.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(cur); }
  });
  // Strzałki małej ramki — ręczne przewijanie bez otwierania lightboxa
  gallery.querySelector('.gal-prev').addEventListener('click', e => { e.stopPropagation(); prev(); armFrame(); });
  gallery.querySelector('.gal-next').addEventListener('click', e => { e.stopPropagation(); next(); armFrame(); });

  // ── Lightbox ──────────────────────────────────────────────────────────────
  function renderLb() {
    const m = MEDIA[cur];
    lbFig.classList.remove('is-missing');
    lbFig.dataset.idx = pad(cur + 1);
    const ambSrc = asset(isVid(m) ? (m.poster || m.src) : m.src);   // ambilight: poster dla wideo
    lbFig.style.setProperty('--lb-amb', `url("${ambSrc}")`);
    if (isVid(m)) {
      lbImg.removeAttribute('src');
      lbImg.style.display = 'none';
      lbVid.style.display = '';
      if (m.poster) lbVid.poster = asset(m.poster);
      lbVid.src = asset(m.src);
      const p = lbVid.play(); if (p) p.catch(() => {});
    } else {
      lbVid.pause();
      lbVid.removeAttribute('src');
      lbVid.style.display = 'none';
      lbImg.style.display = '';
      lbImg.onerror = () => lbFig.classList.add('is-missing');
      lbImg.src = asset(m.src);
      lbImg.alt = `Realizacja Events ${cur + 1}`;
    }
    lbCap.textContent = m.cap || '';
    lbCap.style.display = m.cap ? '' : 'none';
    lbIdx.textContent = pad(cur + 1);
    thumbs.forEach((t, k) => t.classList.toggle('is-on', k === cur));
    if (thumbs[cur]) thumbs[cur].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  function lbTick() { if (!lb.matches(':hover')) { next(); renderLb(); } }
  function startLbAuto() { stopLbAuto(); lbTimer = setInterval(lbTick, LB_MS); }
  function stopLbAuto() { if (lbTimer) { clearInterval(lbTimer); lbTimer = null; } }

  function openLb(i) {
    show(i);
    playFrameVideo(-1);        // ramka pauzuje — lightbox przejmuje odtwarzanie
    renderLb();
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
    lbVid.pause();
    playFrameVideo(cur);       // wróć do grania w ramce
    armFrame();
  }
  const lbNext = () => { next(); renderLb(); startLbAuto(); };
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
