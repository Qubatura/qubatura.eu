// lab.js — Lab: podstrona produktu (placeholder Event Player) otwierana z kafelka [data-product].
// Overlay #product-overlay: miejsce na trailer + opis. Zamknięcie: „‹ Wróć", klik w tło, Esc.
// Docelowo: osobne podstrony per produkt (trailer, opis, kilka pozycji) — teraz jeden placeholder.

import { t } from './i18n.js?v=msc1gg2z';

// Asset jako ABSOLUTNY URL z URL modulu - ODPORNE na SPA pushState (jak reszta).
const DOC_ROOT = new URL('../', import.meta.url).href;
const asset = rel => new URL(rel, DOC_ROOT).href;

export function initLab() {
  const overlay = document.getElementById('product-overlay');
  if (!overlay) return;
  const closeBtn = overlay.querySelector('.prod-close');

  // Screen Event Playera - src z JS (SPA-proof); do tego czasu widac "Screen - wkrotce".
  const shot = overlay.querySelector('.prod-shot-img');
  if (shot) shot.src = asset('../assets/lab/event-player.webp');

  // Karta produktu ma WŁASNY ADRES (/qplayer) — bez tego nie da się jej wkleić w maila
  // ani zaindeksować, bo overlay żyje tylko w pamięci przeglądarki.
  // Zasada: otwarcie dokłada wpis do historii (Wstecz zamyka kartę), zamknięcie
  // PODMIENIA adres na /lab bez przerysowania — pod spodem i tak jest ta sama podstrona.
  const open = () => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-locked');
    if (location.pathname !== '/qplayer') history.pushState({ path: '/qplayer' }, '', '/qplayer');
  };
  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-locked');
    if (location.pathname === '/qplayer') history.replaceState({ path: '/lab' }, '', '/lab');
  };

  // Delegacja: każdy [data-product] otwiera overlay (na razie wspólny placeholder).
  document.addEventListener('click', e => {
    const trg = e.target.closest('[data-product]');
    if (!trg) return;
    e.preventDefault();
    open();
  });

  // Kod z adresu: /qplayer?kod=QP-XXXX-XXXX-XXXX → pole wypełnia się samo.
  // To kasuje w praktyce cały problem literówek: tester niczego nie przepisuje z palca.
  const kodZUrl = new URLSearchParams(location.search).get('kod');
  if (kodZUrl) {
    const pole = overlay.querySelector('input[name="kod"]');
    if (pole) pole.value = kodZUrl.trim().toUpperCase();
  }

  // Wejście PROSTO z linku (mail, zakładka, F5 na /qplayer): podstronę Lab renderuje
  // router, kartę dokładamy tutaj. Bez opóźnienia — router.render() już się wykonał.
  if (location.pathname === '/qplayer') open();

  // Uchwyt „Pobierz" chowa się, gdy sekcja pobierania sama jest już na ekranie —
  // inaczej pływający guzik zasłaniałby własny cel, czyli formularz.
  // Obserwujemy względem overlaya, bo to ON jest kontenerem przewijania, nie okno.
  const uchwyt = overlay.querySelector('.qp-uchwyt');
  const celPobierz = overlay.querySelector('#qp-pobierz');
  if (uchwyt && celPobierz && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([w]) => uchwyt.classList.toggle('schowany', w.isIntersecting),
      { root: overlay, threshold: 0.12 }
    ).observe(celPobierz);
  }

  // Wstecz z /qplayer → karta znika, człowiek zostaje w Labie.
  window.addEventListener('popstate', () => {
    if (location.pathname === '/qplayer') open();
    else if (overlay.classList.contains('is-open')) close();
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });

  // ── Showcase „oprogramowanie na zamówienie" (#lab-showcase) ─────────────────────────
  // Guzik [data-showcase] w hero → overlay z nowym tłem Lab + LATAJĄCA galeria mockupów.
  // MOCKUPS = rozszerzalna tablica; { src?, cap }. Bez src → placeholder (kropkowana ramka).
  // Do marquee doklejamy DWIE kopie listy (CSS przesuwa -50% → płynna, bezszwowa pętla).
  const showcase = document.getElementById('lab-showcase');
  if (showcase) {
    const track   = showcase.querySelector('.ls-track');
    const caseEl  = document.getElementById('lab-case');

    // 5 realnych platform (mockupy HTML). Każda: plik + nazwa + branża + własny akcent.
    // Karty galerii lecą w swoich barwach; klik → detal z pełnym mockupem (iframe).
    const MOCKUPS = [
      { file: '../assets/lab/mockupy/01-warsztat-samochodowy.html', thumb: '../assets/lab/mockupy/thumbs/01.webp', name: 'Serwis Wójcik',  cap: 'Serwis samochodowy',    accent: '#FF5A1F' },
      { file: '../assets/lab/mockupy/02-druzyna-pilkarska.html',    thumb: '../assets/lab/mockupy/thumbs/02.webp', name: 'UKS Iskra',      cap: 'Klub piłkarski dzieci', accent: '#F2C14E' },
      { file: '../assets/lab/mockupy/03-salon-kosmetyczny.html',    thumb: '../assets/lab/mockupy/thumbs/03.webp', name: 'Nails by Marta', cap: 'Salon stylizacji',      accent: '#C9A227' },
      { file: '../assets/lab/mockupy/04-silownia-fitness.html',     thumb: '../assets/lab/mockupy/thumbs/04.webp', name: 'Atlas Gym',      cap: 'Klub fitness',          accent: '#C6FF3D' },
      { file: '../assets/lab/mockupy/05-restauracja.html',          thumb: '../assets/lab/mockupy/thumbs/05.webp', name: 'Zielona 27',     cap: 'Restauracja',           accent: '#B08D57' },
    ];
    const makeCard = (m, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'ls-card ls-plat';
      c.style.setProperty('--acc', m.accent);
      if (m.thumb) c.style.backgroundImage = "url('" + asset(m.thumb) + "')";   // miniaturka realnego mockupu
      c.dataset.case = i;
      c.setAttribute('aria-label', m.name + ' — ' + t(m.cap));   // m.name = nazwa własna marki, zostaje
      c.innerHTML = '<span class="ls-name">' + m.name + '</span><span class="ls-cap">' + t(m.cap) + '</span>';
      return c;
    };
    // DWIE kopie (płynna pętla marquee -50%); każda karta pamięta swój indeks platformy.
    [...MOCKUPS, ...MOCKUPS].forEach((m, k) => track.appendChild(makeCard(m, k % MOCKUPS.length)));

    const openS = () => {
      showcase.classList.add('is-open');
      showcase.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lb-locked');
    };
    const closeS = () => {
      showcase.classList.remove('is-open');
      showcase.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lb-locked');
    };
    document.addEventListener('click', e => {
      if (e.target.closest('[data-showcase]')) { e.preventDefault(); openS(); }
    });
    showcase.querySelector('.ls-close').addEventListener('click', closeS);
    showcase.addEventListener('click', e => { if (e.target === showcase) closeS(); });
    showcase.querySelector('.ls-cta').addEventListener('click', closeS);
    window.addEventListener('keydown', e => {
      // Escape zamyka showcase tylko gdy NIE ma nad nim otwartego detalu (ten łapie Escape pierwszy).
      if (e.key === 'Escape' && showcase.classList.contains('is-open')
          && !(caseEl && caseEl.classList.contains('is-open'))) closeS();
    });

    // ── Detal branży (#lab-case) — iframe pełnego mockupu + ‹ › między platformami ──────
    // Lazy: iframe.src ustawiamy dopiero przy otwarciu; czyścimy przy zamknięciu. Akcent = kolor platformy.
    if (caseEl) {
      const frame = caseEl.querySelector('.lc-iframe');
      const idxEl = caseEl.querySelector('.lc-idx');
      const pad = n => String(n).padStart(2, '0');
      let ci = 0;
      const loadCase = i => {
        ci = (i + MOCKUPS.length) % MOCKUPS.length;
        const m = MOCKUPS[ci];
        frame.src = asset(m.file);
        idxEl.textContent = pad(ci + 1) + ' / ' + pad(MOCKUPS.length);
        caseEl.style.setProperty('--acc', m.accent);
      };
      const openCase = i => {
        loadCase(i);
        caseEl.classList.add('is-open');
        caseEl.setAttribute('aria-hidden', 'false');
        document.body.classList.add('lb-locked');
      };
      const closeCase = () => {
        caseEl.classList.remove('is-open');
        caseEl.setAttribute('aria-hidden', 'true');
        frame.removeAttribute('src');                       // zwolnij zasób
        if (!showcase.classList.contains('is-open')) document.body.classList.remove('lb-locked');
      };
      track.addEventListener('click', e => {
        const c = e.target.closest('[data-case]');
        if (c) openCase(+c.dataset.case);
      });
      caseEl.querySelector('.lc-prev').addEventListener('click', () => loadCase(ci - 1));
      caseEl.querySelector('.lc-next').addEventListener('click', () => loadCase(ci + 1));
      caseEl.querySelector('.lc-close').addEventListener('click', closeCase);
      caseEl.addEventListener('click', e => { if (e.target === caseEl) closeCase(); });
      window.addEventListener('keydown', e => {
        if (!caseEl.classList.contains('is-open')) return;
        if (e.key === 'Escape')          closeCase();
        else if (e.key === 'ArrowRight') loadCase(ci + 1);
        else if (e.key === 'ArrowLeft')  loadCase(ci - 1);
      });
    }
  }
}
