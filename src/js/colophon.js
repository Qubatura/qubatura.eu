// colophon.js — plakietka „Zero gotowca" (frost, wyjeżdża Z DOŁU). Trigger: tagline
// [data-colophon] („Przybywamy z sygnałem"). Efekt: cienka linia sama rysuje się po froscie
// (CSS stroke-dashoffset), teksty DEKODUJĄ się z losowych znaków (scramble → treść, ~2s),
// fireflies dryfują po tafli. Zamknięcie: „‹ Wróć", klik w tło, Escape.

const GLYPHS = '!<>-_\\/[]{}=+*^?#§%&@01'.split('');
const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

// Dekoduje tekst elementu: litery lecą losowymi znakami i po kolei (od lewej) wskakują na miejsce.
function scramble(el, text, dur, delay = 0) {
  const chars = [...text];
  // próg „ustatkowania" per-znak: lewe litery pierwsze + odrobina losu → nierówny, żywy rozpad
  const settle = chars.map((_, i) => (i / chars.length) * 0.62 + Math.random() * 0.12);
  let raf = 0;
  const run = () => {
    const start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      let out = '';
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        out += (c === ' ' || c === '\n') ? c : (p >= settle[i] + 0.22 ? c : rnd());
      }
      el.textContent = out;
      if (p < 1) raf = requestAnimationFrame(step);
      else el.textContent = text;
    };
    raf = requestAnimationFrame(step);
  };
  el.textContent = '';
  const t = setTimeout(run, delay);
  return () => { clearTimeout(t); cancelAnimationFrame(raf); el.textContent = text; };
}

// Fireflies — kilkanaście miękkich dryfujących punktów w kolorze marki, tylko gdy otwarte (perf).
function fireflies(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0, dots = [], w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#7C3AED';
  function size() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    dots = Array.from({ length: 16 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.16,
      r: 0.8 + Math.random() * 1.6, ph: Math.random() * Math.PI * 2,
    }));
  }
  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < -10) d.x = w + 10; if (d.x > w + 10) d.x = -10;
      if (d.y < -10) d.y = h + 10; if (d.y > h + 10) d.y = -10;
      const a = 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(now * 0.001 + d.ph));
      ctx.beginPath();
      ctx.fillStyle = css;
      ctx.globalAlpha = a;
      ctx.shadowBlur = 8; ctx.shadowColor = css;
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    raf = requestAnimationFrame(frame);
  }
  return {
    start() { size(); seed(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    stop()  { cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); },
  };
}

export function initColophon() {
  const overlay = document.getElementById('colophon');
  if (!overlay) return;

  const decodeEls = [...overlay.querySelectorAll('[data-decode]')]
    .map(el => ({ el, text: el.textContent.trim() }));
  const canvas = overlay.querySelector('.cph-fireflies');
  const ff = canvas ? fireflies(canvas) : null;
  let cancels = [];

  const open = () => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
    if (ff) ff.start();
    // dekodowanie po tym jak plakietka rusza z dołu — kicker, potem tytuł, potem lead
    cancels.forEach(c => c());
    const delays = [180, 360, 620];
    const durs   = [900, 1200, 1900];
    cancels = decodeEls.map((d, i) => scramble(d.el, d.text, durs[i] ?? 1600, delays[i] ?? 200));
  };
  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
    if (ff) ff.stop();
    cancels.forEach(c => c()); cancels = [];
  };

  document.addEventListener('click', e => {
    if (e.target.closest('[data-colophon]')) { e.preventDefault(); open(); }
  });
  overlay.querySelector('.cph-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const cta = overlay.querySelector('.cph-cta');
  if (cta) cta.addEventListener('click', close);   // globalny [data-contact] otworzy formularz
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
}
