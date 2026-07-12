// colophon.js — plakietka „Technologia tej strony" (prosty frost-szkiełko, wjeżdża Z DOŁU).
// Trigger: tagline [data-colophon] („Przybywamy z sygnałem"). Efekty czysto-CSS: przejazd
// światła po szkle (.cph-sheen) + treść wyłania się Z SZYBY fadem (blur→ostrość, [data-reveal]).
// JS tu tylko: open/close + subtelne fireflies na tafli (rysowane wyłącznie gdy otwarte, perf).

// Fireflies — kilka miękkich, przygaszonych punktów w kolorze marki (życie szkła, bez krzyku).
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
    dots = Array.from({ length: 8 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.12,
      r: 0.7 + Math.random() * 1.3, ph: Math.random() * Math.PI * 2,
    }));
  }
  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < -10) d.x = w + 10; if (d.x > w + 10) d.x = -10;
      if (d.y < -10) d.y = h + 10; if (d.y > h + 10) d.y = -10;
      const a = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(now * 0.001 + d.ph));
      ctx.beginPath();
      ctx.fillStyle = css;
      ctx.globalAlpha = a;
      ctx.shadowBlur = 7; ctx.shadowColor = css;
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

  const canvas = overlay.querySelector('.cph-fireflies');
  const ff = canvas ? fireflies(canvas) : null;

  // ─── iOS FIX: przypięcie overlayu do VISUAL viewportu ────────────────────────────
  // Na iOS Safari `position:fixed; inset:0` odnosi się do LAYOUT-viewportu, który bywa
  // szerszy niż widzialny obszar → wycentrowana plakietka „ucieka w prawo" i guzik „Wróć"
  // ląduje poza trafialną strefą. Chrome tego nie reprodukuje (headless zawsze wyśrodkowany),
  // dlatego CSS-owe podejścia (sr-only, 92vw) nie pomagały. Tu twardo ustawiamy overlay na
  // dokładny prostokąt window.visualViewport → plakietka liczy szerokość od NIEGO, nie od vw.
  //
  // 2026-07-12 (Kuba, 3 telefony): plakietka ładowała się DOBRZE wyśrodkowana, a po 1-2s „uciekała
  // w prawo i w dół". Przyczyna: przypinaliśmy overlay na KAŻDE `resize`/`scroll` visualViewportu.
  // Na iOS chwilę po otwarciu (pasek adresu chowa się / `lb-locked` przestawia body) leci takie
  // zdarzenie → syncVV nadpisywał left/top wartościami, które w tym momencie robiły się niezerowe
  // → SKOK. Fix: przypinamy overlay TYLKO RAZ przy otwarciu (wtedy jest dobrze), bez żywych listenerów.
  // Dodatkowo: offsetLeft/Top stosujemy WYŁĄCZNIE przy realnym pinch-zoomie (scale>1) — w spoczynku
  // twarde 0, żeby żaden spurious offset iOS nie zepchnął plakietki.
  const vv = window.visualViewport;
  const syncVV = () => {
    if (!vv) return;
    const zoomed = vv.scale > 1.01;   // realny pinch → trackuj offset; spoczynek → 0 (koniec dryfu)
    overlay.style.left  = (zoomed ? vv.offsetLeft : 0) + 'px';
    overlay.style.top   = (zoomed ? vv.offsetTop : 0) + 'px';
    overlay.style.width = vv.width + 'px';
    overlay.style.height = vv.height + 'px';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
  };
  const clearVV = () => {
    for (const p of ['left', 'top', 'width', 'height', 'right', 'bottom']) overlay.style[p] = '';
  };

  const open = () => {
    syncVV();                          // przypięcie RAZ (bez listenerów — inaczej dryf po 1-2s)
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
    if (ff) ff.start();
  };
  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
    if (ff) ff.stop();
    clearVV();
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
