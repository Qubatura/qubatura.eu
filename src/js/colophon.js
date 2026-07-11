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
  const vv = window.visualViewport;
  const syncVV = () => {
    if (!vv) return;
    overlay.style.left  = vv.offsetLeft + 'px';
    overlay.style.top   = vv.offsetTop + 'px';
    overlay.style.width = vv.width + 'px';
    overlay.style.height = vv.height + 'px';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
  };
  const clearVV = () => {
    for (const p of ['left', 'top', 'width', 'height', 'right', 'bottom']) overlay.style[p] = '';
  };

  // ─── TEMP DIAGNOSTYKA (usunąć po namierzeniu dryfu iOS) ──────────────────────────
  // Wpisuje realne pomiary z urządzenia na ekran — Kuba robi screena, my widzimy prawdę.
  let dbg = null;
  const showDiag = () => {
    if (!dbg) {
      dbg = document.createElement('div');
      dbg.setAttribute('style', [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
        'background:rgba(255,40,120,.92)', 'color:#fff', 'font:11px/1.45 monospace',
        'padding:6px 8px', 'white-space:pre-wrap', 'pointer-events:none', 'text-align:left',
      ].join(';'));
      document.body.appendChild(dbg);
    }
    const de = document.documentElement;
    const oR = overlay.getBoundingClientRect();
    const plate = overlay.querySelector('.cph-plate');
    const pR = plate ? plate.getBoundingClientRect() : null;
    const cb = overlay.querySelector('.cph-close');
    const cbR = cb ? cb.getBoundingClientRect() : null;
    dbg.textContent =
      'iw=' + window.innerWidth + ' ih=' + window.innerHeight +
      '\ndeClientW=' + de.clientWidth + ' scrollW=' + de.scrollWidth +
      '\nvv=' + (vv ? (Math.round(vv.width) + 'x' + Math.round(vv.height) +
        ' offL=' + Math.round(vv.offsetLeft) + ' pageL=' + Math.round(vv.pageLeft) +
        ' scale=' + (vv.scale || 1).toFixed(2)) : 'BRAK') +
      '\noverlay L=' + Math.round(oR.left) + ' R=' + Math.round(oR.right) + ' W=' + Math.round(oR.width) +
      '\nplate  L=' + (pR ? Math.round(pR.left) : '?') + ' R=' + (pR ? Math.round(pR.right) : '?') + ' W=' + (pR ? Math.round(pR.width) : '?') +
      '\nwrocBtn L=' + (cbR ? Math.round(cbR.left) : '?') + ' T=' + (cbR ? Math.round(cbR.top) : '?') +
      ' onScreen=' + (cbR ? (cbR.left >= 0 && cbR.right <= window.innerWidth && cbR.top >= 0) : '?');
  };
  const hideDiag = () => { if (dbg) { dbg.remove(); dbg = null; } };

  const open = () => {
    syncVV();
    if (vv) { vv.addEventListener('resize', syncVV); vv.addEventListener('scroll', syncVV); }
    setTimeout(showDiag, 750);   // po animacji wjazdu — plakietka w spoczynku
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
    if (ff) ff.start();
  };
  const close = () => {
    if (vv) { vv.removeEventListener('resize', syncVV); vv.removeEventListener('scroll', syncVV); }
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
    if (ff) ff.stop();
    clearVV();
    hideDiag();
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
