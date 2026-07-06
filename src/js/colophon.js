// colophon.js — „Tę stronę zrobiliśmy sami". Overlay #colophon otwierany kliknięciem taglinu
// [data-colophon] („Przybywamy z sygnałem"). Portfolio + flex techniczny (stack) → CTA do kontaktu.
// Zamknięcie: „‹ Wróć", klik w tło, Escape. CTA (data-contact) zamyka colophon i otwiera formularz.

export function initColophon() {
  const overlay = document.getElementById('colophon');
  if (!overlay) return;

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
