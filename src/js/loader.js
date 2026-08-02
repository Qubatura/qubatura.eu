// loader.js — loading screen (Etap 9).
//
// Bohaterem jest SYGNET 3D na canvasie (ten sam co HOME, w tym samym miejscu) — nie nakładka 2D.
// 0→100% = jeden pełny obrót sygnetu (loadFX.spin). Świat składa się wokół niego wraz z
// progresem: NAJPIERW mgła, PÓŹNIEJ miasto/planeta (sceneFX.fog/planet). Dzięki temu szklany
// sygnet refraktuje świat, który dopiero powstaje — „nabiera życia", nie wisi w pustce.
//
// FAZA 1 (0–100%): realny Promise tracking → loadFX.target; wygładzony progress steruje
//   obrotem, etapowym ujawnianiem świata i licznikiem %. MIN_DURATION = dolna granica czasu.
// FAZA 2 (100%): sygnet OSIADA z obrotu w idle (spinWeight→0), licznik znika, a UI
//   (nav/topbar/tagline) wjeżdża DOPIERO TERAZ (po fontach) staggerem.

import * as GSAPmod from 'gsap';
import { onTick } from './scene.js?v=msc41wce';
import { loadFX, sceneFX } from './tint.js?v=msc41wce';
import { playNavIntro } from './nav-intro.js?v=msc41wce';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const MIN_DURATION = 3.0;          // dolna granica czasu Fazy 1 (s) — minimum, nie limit
const TWO_PI       = Math.PI * 2;  // jeden pełny obrót na 0→100%

// smoothstep — łagodne ujawnianie warstw świata w zadanym oknie progresu
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function initLoader(promises) {
  const loading = document.getElementById('loading');
  const pct     = document.getElementById('loading-pct');

  loadFX.active = true;
  loadFX.revealed = false;         // świetliki milczą w loadingu; bloom rusza dopiero na wjeździe nav
  loadFX.ramping = true;
  loadFX.progress = 0;
  loadFX.target = 0;
  loadFX.spin = 0;
  loadFX.spinWeight = 1;            // pełny obrót rządzi rotacją; idle dochodzi na finale
  loadFX.scale = 1;
  loadFX.charge = 0;               // sygnet startuje jako czyste szkło → gęstnieje w primary
  sceneFX.fog = 0;
  sceneFX.planet = 0;

  // Realny tracking — każdy rozwiązany (lub odrzucony) zasób podbija target. Bez fake timera.
  const total = Math.max(1, promises.length);
  let done = 0;
  promises.forEach(p => Promise.resolve(p).finally(() => {
    done++;
    loadFX.target = done / total;
  }));

  let elapsed = 0;
  let finishing = false;
  onTick((dt) => {
    if (!loadFX.ramping) return;
    elapsed += dt;
    const timeCap = Math.min(1, elapsed / MIN_DURATION);
    // Progres CZYSTO CZASOWY — eliminuje stalle/skoki gdy zasoby są już pre-resolved.
    // target >= 1 jest tylko bramką dla finish(), nie sterownikiem paska.
    loadFX.progress = timeCap;
    // Safety valve: po 1.5× MIN_DURATION wymuszamy target=1 (zasoby nie załadowane w czasie)
    if (elapsed > MIN_DURATION * 1.5) loadFX.target = 1;

    const p = loadFX.progress;
    loadFX.spin    = p * TWO_PI;                                     // jeden pełny obrót 0→100%
    loadFX.charge  = Math.pow(p, 1.8) * 0.8;                         // ease-in: prawie czyste szkło na starcie → mocniej później (≈80% przy stówie)
    sceneFX.fog    = smoothstep(0.00, 0.45, p);                      // mgła NAJPIERW
    sceneFX.planet = smoothstep(0.35, 0.85, p);                      // miasto/planeta PÓŹNIEJ
    loadFX.scale   = 1.0 + smoothstep(0.88, 1.00, p) * 0.07;        // delikatniejsze, łagodniej narastające puchnięcie ku nam (A3)
    if (pct) pct.textContent = Math.round(p * 100);

    if (!finishing && loadFX.target >= 1 && loadFX.progress > 0.992) {
      finishing = true;
      loadFX.ramping = false;
      loadFX.progress = 1;
      loadFX.spin = 0;                          // na wprost (≡ 2π), ale 0 → osiadanie NIE odkręca obrotu
      loadFX.scale = 1.07;                      // łagodniejszy szczyt zbliżenia gdy GSAP przejmuje powrót (A3)
      loadFX.charge = 0.8;                      // dobity do pełni dopiero pulsem w finish()
      if (pct) pct.textContent = 100;
      finish(loading);
    }
  });
}

// Faza 2 — sygnet osiada z obrotu w idle, świat dopełniony; UI wjeżdża na końcu.
function finish(loading) {
  // Na mobile: karty animowane osobno ze staggerem — backdrop-filter każdej karty
  // jest pre-aktywny (nie popuje gdy #nav-container staje się widoczny nagle).
  const isMobile = window.innerWidth <= 768;
  // Desktop: #nav odsłania choreografia „głowicy energii" (playNavIntro) — nie prosty fade.
  const chrome = isMobile
    ? ['#topbar', '#nav-events', '#nav-studio', '#nav-lab', '#tagline']
    : ['#topbar', '#tagline'];

  // Pewnik: świat na pełni od razu (gdyby cokolwiek przerwało timeline poniżej).
  sceneFX.fog = 1;
  sceneFX.planet = 1;

  const tl = gsap.timeline({
    onComplete: () => {
      loadFX.active = false;
      loadFX.spinWeight = 0;
      loadFX.scale = 1;
      loadFX.charge = 1;
      sceneFX.fog = 1;
      sceneFX.planet = 1;
      document.body.classList.remove('is-loading');
      loadFX.revealed = true;                          // pewnik (gdyby coś przerwało timeline)
      gsap.set(chrome, { clearProps: 'opacity' });     // oddaj kontrolę CSS-owi
      if (loading) loading.style.display = 'none';
    },
  });

  // POWRÓT — sygnet był na łagodnym szczycie (1.07) przy 99%; dostojnie wraca w pozycję HOME.
  // power2.inOut: wolny start (jakby nie mógł wyjść z atmosfery) + wolne osiadanie (slow-mo zostaje).
  tl.to(loadFX, { scale: 1.0,  duration: 3.20, ease: 'power2.inOut' }, 0)

  // FULL KOLOR — substancja dobija z 80% do pełni na pulsie (moment „ożywienia")
    .to(loadFX, { charge: 1, duration: 0.32, ease: 'power2.out' }, 0)

  // Świat do pełni (zwykle już ~1)
    .to(sceneFX, { fog: 1, planet: 1, duration: 0.5, ease: 'power1.out' }, 0)

  // Powolny obrót osiada w idle drift — BEZ kręcenia (spin=0 → brak odkręcania)
    .to(loadFX, { spinWeight: 0, duration: 0.8, ease: 'power2.out' }, 0.1)

  // Licznik + etykieta znikają
    .to(loading, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.35)

  // UI (topbar/tagline — na desktopie; +karty na mobile) — DOPIERO TERAZ (po fontach), staggerem
    .to(chrome, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.10 }, 0.6);

  // Desktop: nawigacja wchodzi choreografią „głowicy energii" (raz — konsekwencja ładowania).
  // Wołane w SZCZYCIE ruchu sygnetu „do nas" (scale 1.07 @ t=0) → pierścień/plusk jest jego skutkiem;
  // linie/napisy dochodzą później (LINE_START w nav-intro.js).
  if (!isMobile) tl.call(playNavIntro, null, 0.05);

  // Świetliki: bloom rusza TU (razem z wjazdem nav), łagodnie — nie skokowo na końcu osiadania (3.2s).
  tl.call(() => { loadFX.revealed = true; }, null, 0.55);
}
