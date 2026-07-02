// lab.js — Lab: podstrona produktu (placeholder Event Player) otwierana z kafelka [data-product].
// Overlay #product-overlay: miejsce na trailer + opis. Zamknięcie: „‹ Wróć", klik w tło, Esc.
// Docelowo: osobne podstrony per produkt (trailer, opis, kilka pozycji) — teraz jeden placeholder.

export function initLab() {
  const overlay = document.getElementById('product-overlay');
  if (!overlay) return;
  const closeBtn = overlay.querySelector('.prod-close');

  const open = () => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
  };
  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
  };

  // Delegacja: każdy [data-product] otwiera overlay (na razie wspólny placeholder).
  document.addEventListener('click', e => {
    const trg = e.target.closest('[data-product]');
    if (!trg) return;
    e.preventDefault();
    open();
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
}
