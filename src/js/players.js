// players.js — odtwarzacze audio działu Studio (Część 2)
//
// Wskaźnik postępu = pierścień wokół przycisku play (reużycie motywu obręczy sygnetu z HOME):
// świecąca linia zapełnia się zegarowo (stroke-dashoffset), środek = ikona play/pause.
// Tylko JEDEN player gra naraz — start nowego pauzuje poprzedni.
//
// Skeleton (stan na teraz): karty mają data-audio="" (pusto) → odpalamy SYMULACJĘ postępu
// na podstawie data-dur (sekundy), żeby UI żyło przed podpięciem realnych nagrań. Po wrzuceniu
// plików do assets/audio/ i ustawieniu data-audio="../assets/audio/xxx.mp3" → realny <audio>
// (timeupdate steruje pierścieniem) bez żadnej zmiany w HTML/CSS.

const R    = 21;                    // promień pierścienia (zgodny z <circle r="21"> w HTML)
const CIRC = 2 * Math.PI * R;       // obwód → dasharray/dashoffset

export function initPlayers() {
  const cards = [...document.querySelectorAll('.pl-card')];
  if (!cards.length) return;

  let active = null;                // aktualnie grający kontroler (jeden naraz)

  cards.forEach(card => {
    const ring = card.querySelector('.pl-ring');
    const prog = card.querySelector('.pl-prog');
    if (!ring || !prog) return;

    const src = (card.dataset.audio || '').trim();
    const dur = parseFloat(card.dataset.dur) || 24;

    prog.style.strokeDasharray  = CIRC.toFixed(2);
    prog.style.strokeDashoffset = CIRC.toFixed(2);   // pusty pierścień na start

    let audio   = null;
    let raf     = null;
    let pos     = 0;     // postęp 0..1
    let t0      = 0;     // performance.now() startu symulacji (skorygowany o pos = wznawianie)
    let playing = false;

    const setProg = p => {
      pos = Math.min(1, Math.max(0, p));
      prog.style.strokeDashoffset = (CIRC * (1 - pos)).toFixed(2);
    };

    const stopRaf = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };

    // Pauza. reset=true → pierścień wraca do zera (koniec materiału / restart).
    const pause = (reset) => {
      playing = false;
      ring.classList.remove('is-playing');
      card.classList.remove('is-active');
      stopRaf();
      if (audio) audio.pause();
      if (reset) setProg(0);
      if (active === ctrl) active = null;
    };

    const finish = () => pause(true);

    const simTick = () => {
      const p = (performance.now() - t0) / 1000 / dur;
      if (p >= 1) { setProg(1); finish(); return; }
      setProg(p);
      raf = requestAnimationFrame(simTick);
    };

    const play = () => {
      if (active && active !== ctrl) active.pause(false);   // tylko jeden gra naraz
      playing = true;
      ring.classList.add('is-playing');
      card.classList.add('is-active');
      active = ctrl;

      if (src) {
        if (!audio) {
          audio = new Audio(src);
          audio.preload = 'none';
          audio.addEventListener('timeupdate', () => setProg(audio.currentTime / (audio.duration || dur)));
          audio.addEventListener('ended', finish);
        }
        if (pos >= 1) { setProg(0); audio.currentTime = 0; }
        audio.play().catch(err => console.warn('[players] odtwarzanie nieudane:', src, err));
      } else {
        if (pos >= 1) setProg(0);                           // restart po dobiciu do końca
        t0 = performance.now() - pos * dur * 1000;          // wznów od bieżącego postępu
        raf = requestAnimationFrame(simTick);
      }
    };

    const ctrl = { play, pause };
    ring.addEventListener('click', () => (playing ? pause(false) : play()));
  });
}
