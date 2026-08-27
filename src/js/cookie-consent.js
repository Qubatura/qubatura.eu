// cookie-consent.js — minimalny baner „tylko niezbędne cookies".
// Strona używa WYŁĄCZNIE niezbędnych cookies / localStorage (zgoda na cookies, ustawienia dźwięku),
// więc baner jest informacyjny + „Rozumiem" (bez opt-outu, bo nie ma czego wyłączać).
// Akceptację pamiętamy w localStorage → potem się nie pokazuje. Link do polityki jest SPA-proof.

import { t } from './i18n.js?v=mtb6bwu8';

const DOC_ROOT = new URL('../', import.meta.url).href;
const asset = rel => new URL(rel, DOC_ROOT).href;
const KEY = 'qub-cookie-ok';

export function initCookies() {
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) { /* prywatny tryb — pokaż baner */ }
  if (seen) return;

  const bar = document.createElement('div');
  bar.className = 'cookie-bar';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', t('Informacja o plikach cookies'));
  bar.innerHTML =
    '<p class="cookie-txt">' + t('Używamy wyłącznie <b>niezbędnych</b> plików cookies, aby strona działała.') + ' ' +
    t('Więcej w') + ' <a href="' + asset('polityka-prywatnosci.html') + '" target="_blank" rel="noopener noreferrer">' +
    t('polityce prywatności') + '</a>.</p>' +
    '<button type="button" class="cookie-ok">' + t('Rozumiem') + '</button>';
  document.body.appendChild(bar);

  // Wejście po loaderze (żeby nie migało pod ekranem ładowania)
  setTimeout(() => bar.classList.add('show'), 1500);

  bar.querySelector('.cookie-ok').addEventListener('click', () => {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    bar.classList.remove('show');
    setTimeout(() => bar.remove(), 450);
  });
}
