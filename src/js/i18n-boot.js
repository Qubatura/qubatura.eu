// i18n-boot.js — spięcie przełącznika #lang-toggle z silnikiem i18n.js.
// Osobno od i18n.js, żeby ten pozostał czystym silnikiem (t/applyDom/setLang) bez wiedzy o UI.

import { setLang, getLang, storedLang, applyDom } from './i18n.js?v=msaegn67';

export function initI18n() {
  const btn = document.getElementById('lang-toggle');

  // Etykieta guzika (EN↔PL) żyje w inline-skrypcie index.html — tam jest potrzebna zanim
  // moduły się załadują. Tu tylko ją wołamy, żeby nie duplikować słownika etykiet.
  const label = window.qbLangLabel || (() => {});
  const next  = window.qbLangNext  || (c => (c === 'pl' ? 'en' : 'pl'));

  // Kolejność: ?lang= z URL (da się wysłać link od razu po angielsku) → wybór z poprzedniej wizyty.
  // PL to język domyślny marki — NIE zgadujemy z navigator.language (polski klient na angielskim
  // systemie dostałby EN wbrew intencji).
  const q = new URLSearchParams(location.search).get('lang');
  const start = (q === 'en' || q === 'pl') ? q : storedLang();
  setLang(start);
  label(start);

  if (!btn) return;
  btn.addEventListener('click', () => {
    const to = next(getLang());
    setLang(to);
    label(to);
  });

  // Treści wstrzykiwane po starcie (galeria, chipy, mockupy) — moduły wołają applyDom() same,
  // ale sieć bezpieczeństwa: przy zmianie języka przechodzimy DOM jeszcze raz po mikrozadaniach.
  window.qbApplyI18n = applyDom;
}
