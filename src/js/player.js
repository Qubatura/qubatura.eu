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
  { src: '../assets/audio/Qubatura.eu-main.mp3', title: 'Main' },     // ← nowa koncepcja: „main" na jedynce (Theme schowany)
  { src: '../assets/audio/Qubatura.eu-pulse.mp3', title: 'Pulse' },
  { src: '../assets/audio/Qubatura.eu-relax.mp3', title: 'Relax' },   // ← wrzuć plik pod TĄ nazwą, zagra sam
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
      if (playing) { applyTrack(); ogloszStart(); }
      else audio.pause();
    });
  }

  render();

  // ─── Autoplay „zaraz po załadowaniu" (życzenie Kuby, „na moje ryzyko") ───────────
  // Przeglądarki blokują autoplay Z DŹWIĘKIEM bez gestu usera → próbujemy od razu, a jak
  // polityka zablokuje, uzbrajamy JEDNORAZOWY start przy pierwszym dowolnym geście (poza
  // samym #sound-toggle — on ma własną logikę graj/stop, nie chcemy podwójnego przełączenia).
  function armPlaying() {
    playing = true;
    if (toggle) toggle.dataset.active = 'true';
    root.dataset.playing = 'true';
    ogloszStart();
  }
  loadedIdx = cur;
  audio.src = asset(TRACKS[cur].src);

  // 🔴 NIE URUCHAMIAJ MUZYKI NA KARCIE PRODUKTU. Zgłoszone przez Sandrę 01.08: kliknęła
  // w pole „Imię" w formularzu pobierania i ruszyła muzyka ze strony głównej. Gest był
  // dowolny, więc łapał go `kick` niżej.
  // Dlaczego to poważne, a nie kosmetyczne: karta (#product-overlay, z-index 1050) leży
  // NAD paskiem strony, w którym siedzi przełącznik dźwięku — człowiek dostaje granie,
  // którego nie ma jak wyłączyć. Do tego wchodzi z maila po program, a nie po zwiedzanie.
  // Zachowanie na home zostaje nietknięte.
  const kartaOtwarta = () => !!document.querySelector('#product-overlay.is-open');

  // Wyłączność audio (02.11, Kuba: iPhone + Chrome, Studio). Gdy rusza inne źródło (player Studio),
  // muzyka robi pauzę, przełącznik na górze pokazuje „stop” i NIC jej potem samo nie wznawia —
  // po powrocie na home stoi, klik w przełącznik ją włącza. Tylko pause(), nie volume (iOS je ignoruje).
  let cudzeGralo = false;
  function ogloszStart() { document.dispatchEvent(new CustomEvent('qb:audio', { detail: { zrodlo: 'muzyka' } })); }
  // Strategia (Kuba 02.11): KAŻDY inny dźwięk wycisza muzykę strony — płynnie (~0,6 s), potem pauza.
  // iOS ignoruje audio.volume (tylko odczyt = 1) → tam od razu pauza; karta w tle → od razu pauza
  // (rAF w tle stoi). Nowe źródło dźwięku na stronie = jedna linijka: dispatch `qb:audio` z własną nazwą.
  const glosnoscDziala = (() => { const t = new Audio(); t.volume = 0.5; return t.volume === 0.5; })();
  let wyciszanie = null;
  audio.addEventListener('play', () => { cancelAnimationFrame(wyciszanie); wyciszanie = null; audio.volume = 1; });
  function wycisz(odRazu) {
    playing = false;
    if (toggle) toggle.dataset.active = 'false';
    root.dataset.playing = 'false';
    if (audio.paused) return;
    if (odRazu || !glosnoscDziala) { audio.pause(); return; }
    const v0 = audio.volume, t0 = performance.now();
    const krok = now => {
      const x = Math.min(1, Math.max(0, (now - t0) / 600));
      audio.volume = v0 * (1 - x) * (1 - x);
      if (x < 1) wyciszanie = requestAnimationFrame(krok);
      else { wyciszanie = null; audio.pause(); audio.volume = 1; }
    };
    wyciszanie = requestAnimationFrame(krok);
  }
  document.addEventListener('qb:audio', e => {
    if (!e.detail || e.detail.zrodlo === 'muzyka') return;
    cudzeGralo = true; zdejmijKick();
    wycisz(false);
  });
  // karta w tle (np. ktoś otworzył Kliklaka w nowej karcie) → muzyka staje i sama nie wraca
  document.addEventListener('visibilitychange', () => { if (document.hidden && !audio.paused) wycisz(true); });
  let zdejmijKick = () => {};
  if (location.pathname === '/qplayer') return;      // wejście prosto z linku w mailu

  audio.play().then(armPlaying).catch(() => {
    const kick = (e) => {
      if (cudzeGralo) return zdejmijKick();          // coś innego już grało → muzyka nie startuje sama
      // dotknięcie playera Studio to gest „chcę słuchać materiału”, nie muzyki strony (iPhone: autoplay
      // zablokowany, więc ten gest odpalał muzykę RAZEM z materiałem)
      if (e && e.target && e.target.closest && e.target.closest('.pl-card')) return zdejmijKick();
      if (toggle && e && e.target && toggle.contains(e.target)) return;  // niech toggle sam steruje
      if (kartaOtwarta()) return;                    // gest na karcie produktu nie budzi muzyki
      if (e && e.target && e.target.closest && e.target.closest('#product-overlay')) return;
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
      audio.play().then(armPlaying).catch(() => {});
    };
    zdejmijKick = () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
  });
}
