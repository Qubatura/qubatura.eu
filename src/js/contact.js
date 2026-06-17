// contact.js — fullscreen contact overlay (NIE podstrona). Nad żywą sceną HOME.
// Otwierany przez dowolny [data-contact] (KONTAKT w topbarze, CTA podstron).
// Zamykany: CLOSE-×, klik w tło poza contentem, Escape.

import * as GSAPmod from 'gsap';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

export function initContact() {
  const overlay = document.getElementById('contact-overlay');
  if (!overlay) return;
  const closeBtn = document.getElementById('contact-close');
  // kolejność stagger: koordynaty → miasto → dane → social
  const items = overlay.querySelectorAll('.coords-line, .coords-city, .contact-data, .contact-social');

  let open = false;
  let tl = null;

  function openOverlay() {
    if (open) return;
    open = true;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';

    if (tl) tl.kill();
    tl = gsap.timeline();
    // wejście kontenera: opacity 0→1 + scale 0.97→1, 0.5s
    tl.fromTo(overlay,
      { opacity: 0, scale: 0.97 },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' });
    // stagger treści: y 20→0 + opacity 0→1, 0.08s, start 0.2s po otwarciu
    tl.fromTo(items,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, 0.2);
  }

  function closeOverlay() {
    if (!open) return;
    open = false;
    overlay.setAttribute('aria-hidden', 'true');
    if (tl) tl.kill();
    gsap.to(overlay, {
      opacity: 0, scale: 0.97, duration: 0.35, ease: 'power2.in',
      onComplete: () => {
        overlay.style.visibility = 'hidden';
        overlay.style.pointerEvents = 'none';
      },
    });
  }

  // Trigger — delegacja: każdy element z [data-contact] otwiera overlay
  document.addEventListener('click', e => {
    const trg = e.target.closest('[data-contact]');
    if (!trg) return;
    e.preventDefault();
    openOverlay();
  });

  // „← Powrót" — ta sama funkcja zamknięcia co Escape i klik w tło
  closeBtn.addEventListener('click', closeOverlay);
  // hover koloru — GSAP, 0.2s ease (spójnie z animacjami strony)
  closeBtn.addEventListener('mouseenter', () =>
    gsap.to(closeBtn, { color: '#E0218A', duration: 0.2, ease: 'power2.out' }));
  closeBtn.addEventListener('mouseleave', () =>
    gsap.to(closeBtn, { color: 'rgba(255,255,255,0.45)', duration: 0.2, ease: 'power2.out' }));

  // klik w tło (sam overlay, nie content) zamyka
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });
}
