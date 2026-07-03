// player.js — mini odtwarzacz muzyki (TYLKO HOME, w headerze).
// Forma: rolka numerów [ ‹ ] ₁ 2 ₃ [ › ] + tytuł aktywnego utworu (organicznie, bez ramki, Space Mono).
// Ruch zmiany = rolka zjeżdża w bok + tytuł blur-to-sharp (spójnie z nav-intro/galerią).
// Dźwięk spięty z istniejącym #sound-toggle (waveform): klik = graj/stop (gest odblokowuje audio —
// autoplay z dźwiękiem jest blokowany przez przeglądarki). Strzałki = zmiana utworu.
// Znika na podstronach (CSS: body.page-active), ale toggle w topbarze steruje dźwiękiem wszędzie.
// Pliki dostarcza Kuba — na teraz placeholdery; brak pliku = UI działa, tylko cisza.

import * as GSAPmod from 'gsap';
const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

// Assety jako absolutny URL z URL modułu — ODPORNE na SPA pushState (jak gallery/studio).
const DOC_ROOT = new URL('../', import.meta.url).href;
const asset = rel => new URL(rel, DOC_ROOT).href;

// Sloty — Kuba dostarczy pliki + tytuły. Tytuł = JEDEN wyraz po angielsku (nazwa stylu/klimatu).
// Numer 1 = „bezpieczny organiczny" starter na home. Poniżej placeholdery do podmiany.
const TRACKS = [
  { src: '../assets/audio/ambient-01.mp3', title: 'Organic' },
  { src: '../assets/audio/ambient-02.mp3', title: 'Nocturne' },
  { src: '../assets/audio/ambient-03.mp3', title: 'Drift' },
];
const SHOW_TITLE = true;   // ← flaga: tytuł przy aktywnym numerze (wyłącz = same numerki)

export function initPlayer() {
  const root = document.getElementById('music-player');
  if (!root || !TRACKS.length) return;
  const N = TRACKS.length;

  const reel   = root.querySelector('.mp-reel');
  const nPrev  = root.querySelector('.mp-prev-n');
  const nCur   = root.querySelector('.mp-cur');
  const nNext  = root.querySelector('.mp-next-n');
  const titleE = root.querySelector('.mp-title');
  const bPrev  = root.querySelector('.mp-prev');
  const bNext  = root.querySelector('.mp-next');
  const toggle = document.getElementById('sound-toggle');

  if (!SHOW_TITLE && titleE) titleE.style.display = 'none';

  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';        // pobiera się dopiero przy pierwszym graniu

  let cur = 0;
  let playing = false;
  let loadedIdx = -1;

  const num = i => String(i + 1);   // 3 utwory → pojedyncze cyfry (1,2,3)

  function render() {
    nPrev.textContent = num((cur - 1 + N) % N);
    nCur.textContent  = num(cur);
    nNext.textContent = num((cur + 1) % N);
    if (SHOW_TITLE && titleE) titleE.textContent = TRACKS[cur].title || '';
  }

  function applyTrack() {
    if (loadedIdx !== cur) { audio.src = asset(TRACKS[cur].src); loadedIdx = cur; }
    if (playing) audio.play().catch(() => {});
  }

  // Zmiana utworu — rolka zjeżdża w kierunku ruchu, tytuł wchodzi blur-to-sharp
  function slide(dir) {
    const SLOT = 22;
    gsap.timeline()
      .to(reel, { x: -dir * SLOT, opacity: 0.5, duration: 0.24, ease: 'power2.in' })
      .add(() => {
        cur = (cur + dir + N) % N;
        render();
        applyTrack();
        gsap.set(reel, { x: dir * SLOT });
      })
      .to(reel, { x: 0, opacity: 1, duration: 0.30, ease: 'power2.out' });
    if (SHOW_TITLE && titleE) {
      gsap.fromTo(titleE,
        { opacity: 0, filter: 'blur(6px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out', delay: 0.24 });
    }
  }

  bPrev.addEventListener('click', () => slide(-1));
  bNext.addEventListener('click', () => slide(1));

  // Waveform toggle = graj/stop (pierwszy klik to gest, który odblokowuje audio)
  if (toggle) {
    toggle.addEventListener('click', () => {
      playing = !playing;
      toggle.dataset.active = String(playing);
      root.dataset.playing = String(playing);   // hook pod ew. akcent „gra" (magenta) — do decyzji
      if (playing) applyTrack();
      else audio.pause();
    });
  }

  render();
}
