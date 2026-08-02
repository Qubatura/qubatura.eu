// router.js — SPA History API + GSAP page transitions (Etap 10)
// Scena Three.js zostaje żywa w tle; podstrony to overlay (#page) z fade.
// Przy wejściu na dywizję: scena tinted w kolor działu (navFX) + sygnet zjeżdża
// do lewego górnego rogu jako logo (navFX.pageX/pageY/pageScale, czyta signet.js).

import * as THREE from 'three';
import * as GSAPmod from 'gsap';
import { DIVISION_COLORS, DIVISION_DIR, BASE_TINT, navFX } from './tint.js?v=msc1gg2z';
import { resetNavState } from './navigation.js?v=msc1gg2z';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const EASE = 'power3.out';

// Sygnet w trybie podstrony — pozycja/skala w jedn. świata (tunable).
// scale=0 (pkt 6): rolę logo w rogu przejmuje płaski biały lockup #page-home (sygnet+wordmark);
// sygnet 3D był i tak za scrimem #page (z40) → chowamy go całkiem, by nie prześwitywał za logo.
const SIGNET_PAGE = { x: -235, y: 120, scale: 0.0 };

// Kontakt nie jest dywizją — używa koloru primary
const CONTACT_COLOR = new THREE.Color(0x6B2FD9);

// Kontakt NIE jest podstroną — to overlay (contact.js). Tu tylko dywizje.
const ROUTES = {
  '/events':  { view: 'page-events',  div: 'events'  },
  '/studio':  { view: 'page-studio',  div: 'studio'  },
  '/lab':     { view: 'page-lab',     div: 'lab'     },
  // /qplayer renderuje TĘ SAMĄ podstronę co /lab — kartę produktu otwiera nad nią lab.js.
  // Dzięki temu link z maila prowadzi prosto do Qplayera, a „‹ Wróć" zostawia człowieka
  // w Labie, a nie wyrzuca go na hero. Trasa musi też istnieć w .htaccess (F5 / deep link).
  '/qplayer': { view: 'page-lab',     div: 'lab'     },
};

export function initRouter() {
  const page    = document.getElementById('page');
  const home    = document.getElementById('page-home');   // logo + powrót (jeden element)
  const views   = [...document.querySelectorAll('.page-view')];
  if (!page) return;

  let current = null;   // aktualna ścieżka ('/'=hero)

  // ── Welon pod klastrem powrotu (mobile) ────────────────────────────────────
  // Kolumna działu przewija się POD #page-home (position:fixed) → litery treści
  // wchodzą pod logo i nazwę działu. Klasa włącza gradient-welon (CSS); na górze
  // kolumny welon śpi, bo tło sceny samo daje kontrast.
  const VEIL_AT = 12;   // px — próg włączenia
  let veiled = false;

  function syncVeil() {
    const on = page.scrollTop > VEIL_AT;
    if (on === veiled) return;
    veiled = on;
    page.classList.toggle('is-scrolled', on);
  }
  page.addEventListener('scroll', syncVeil, { passive: true });

  // ── Renderowanie stanu dla ścieżki ─────────────────────────────────────────
  function render(path) {
    const route = ROUTES[path] || null;

    if (!route) {            // ── HERO ──
      closePage();
      current = '/';
      return;
    }

    // ── PODSTRONA ──
    views.forEach(v => { v.hidden = (v.id !== route.view); });

    page.scrollTop = 0;   // nowy dział zawsze od góry (kolumna mobile bywała przewinięta po poprzednim)
    syncVeil();

    document.body.classList.add('page-active');
    page.classList.add('is-open');
    page.dataset.division = route.div;   // → tło podstrony + kolor/label logo (#page[data-division=...])
    if (home) home.classList.add('is-open');
    page.setAttribute('aria-hidden', 'false');

    // subtelny wjazd treści
    const active = document.getElementById(route.view);
    gsap.fromTo(active, { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: EASE, delay: 0.1 });

    // Czysty stan nav: ubij pulsujące przyciąganie/heartbeat i HUD-y, żeby tug nie został
    // „zamrożony" i nie kołysał logiem w rogu podstrony (mouseleave nie odpali — page-active).
    resetNavState();

    // scena: tint w kolor działu + sygnet do rogu
    const c   = DIVISION_COLORS[route.div] || CONTACT_COLOR;
    const dir = DIVISION_DIR[route.div] || { x: 0, y: 0 };
    gsap.to(navFX.target, { r: c.r, g: c.g, b: c.b, duration: 0.6, ease: EASE, overwrite: 'auto' });
    gsap.to(navFX, { intensity: 1, dirX: dir.x, dirY: dir.y, tugX: 0, tugY: 0, duration: 0.6, ease: EASE, overwrite: 'auto' });
    gsap.to(navFX, {
      pageX: SIGNET_PAGE.x, pageY: SIGNET_PAGE.y, pageScale: SIGNET_PAGE.scale,
      duration: 0.9, ease: EASE, overwrite: 'auto',
    });

    current = path;
  }

  function closePage() {
    resetNavState();   // czysty stan nav: zgaś wszystkie HUD-y „zamrożone" przez guard
    page.classList.remove('is-open');
    if (home) home.classList.remove('is-open');
    document.body.classList.remove('page-active');
    page.setAttribute('aria-hidden', 'true');
    page.scrollTop = 0;
    syncVeil();

    // scena wraca: tint neutralny + sygnet na środek/pełna skala
    gsap.to(navFX.target, {
      r: BASE_TINT.r, g: BASE_TINT.g, b: BASE_TINT.b,
      duration: 0.6, ease: EASE, overwrite: 'auto',
    });
    gsap.to(navFX, { intensity: 0, tugX: 0, tugY: 0, duration: 0.6, ease: EASE, overwrite: 'auto' });
    gsap.to(navFX, {
      pageX: 0, pageY: 0, pageScale: 1,
      duration: 0.9, ease: EASE, overwrite: 'auto',
      onComplete: () => {
        views.forEach(v => { v.hidden = true; });
        delete page.dataset.division;
      },
    });
  }

  // ── Nawigacja ───────────────────────────────────────────────────────────────
  function navigate(path) {
    if (path === current) return;
    history.pushState({ path }, '', path);
    render(path);
  }

  // Przejęcie kliknięć w linki dywizji (.nav-item) i CTA ([data-route])
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="/"]');
    if (!link) return;
    const path = new URL(link.href).pathname;
    if (!ROUTES[path]) return;          // nie nasza trasa → puść dalej
    e.preventDefault();
    navigate(path);
  });

  // Logo + strzałka w rogu → zawsze prosto na HOME (świadomy „dom", nie history.back).
  if (home) home.addEventListener('click', () => navigate('/'));

  window.addEventListener('popstate', e => {
    render((e.state && e.state.path) || pathFromLocation());
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  function pathFromLocation() {
    const p = location.pathname;
    return ROUTES[p] ? p : '/';
  }
  render(pathFromLocation());
}
