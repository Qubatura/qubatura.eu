// loader.js — loading screen (Etap 9).
//
// Sygnet jest JEDYNYM wskaźnikiem progresu i renderuje się na TYM SAMYM canvasie co scena
// (nie nakładka DOM) — dzięki temu po 100% bez cięcia staje się żywym sygnetem HOME.
//
// FAZA 1 (0–100%): scena czarna (sceneFX.reveal=0), sygnet w skali HOME, ledwo widoczny szklany
//   kontur. W miarę realnego ładowania (Promise tracking) primary ZALEWA sygnet falą lewo→prawo
//   (loadFX.fill = % postępu), z głębią 3D (refrakcja środowiska w signet.js). Min. 3s.
// FAZA 2 (przy 100%): BEZ ruchu sygnetu (stoi w miejscu w skali HOME). Scena (planeta/mgła)
//   ujawnia się z czerni, tryb shaderowy schodzi (load→0) — handoff bez cięcia. UI
//   (nav/linie/topbar/tagline) wjeżdża DOPIERO na końcu, jako osobny beat.

import * as GSAPmod from 'gsap';
import { onTick } from './scene.js';
import { loadFX, sceneFX } from './tint.js';

const gsap = GSAPmod.gsap || GSAPmod.default || GSAPmod;

const MIN_DURATION = 3.0;  // dolna granica czasu trwania Fazy 1 (s) — żeby sekwencja była
                           // zawsze widoczna, nawet gdy zasoby załadują się natychmiast.
                           // To minimum, NIE limit: dłuższe realne ładowanie czeka na zasoby.

// Inicjalizacja Fazy 1. `promises` — realne zasoby do śledzenia (fonty, tekstury, sygnet).
export function initLoader(promises) {
  const loading = document.getElementById('loading');
  const pct     = document.getElementById('loading-pct');

  // Stan startowy: czerń + ledwo widoczny szklany sygnet w skali HOME. Chrome ukryty
  // (body.is-loading jest w HTML od pierwszej klatki — brak FOUC nawigacji/tagline).
  loadFX.active = true;
  loadFX.ramping = true;
  loadFX.progress = 0;
  loadFX.target = 0;
  loadFX.fill = 0;            // czoło fali na lewej krawędzi → cały sygnet ledwo widoczny
  loadFX.load = 1;            // pełny tryb loading w shaderze
  sceneFX.reveal = 0;

  // Realny tracking — każdy rozwiązany (lub odrzucony) zasób podbija target. Bez fake timera:
  // endpointy są prawdziwe, a płynność daje interpolacja progress→target w ticku poniżej.
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
    // Limit czasowy — progres nie może wyprzedzić liniowego narastania do 1 w MIN_DURATION.
    // Gdy zasoby szybkie: progres = timeCap (płynne, rozciągnięte do ~3s). Gdy wolne: timeCap
    // dawno = 1 i nie ogranicza → realny target rządzi (loading czeka na zasoby).
    const timeCap = Math.min(1, elapsed / MIN_DURATION);
    // Wygładzony progres dąży do realnego targetu (interpolacja — „płynnie nabiera koloru")…
    loadFX.progress += (loadFX.target - loadFX.progress) * Math.min(1, dt * 3.5);
    loadFX.progress = Math.min(loadFX.progress, timeCap);     // …ale nie szybciej niż minimum 3s
    loadFX.fill = loadFX.progress;                            // fala primary podąża za % postępu
    if (pct) pct.textContent = Math.round(loadFX.progress * 100) + '%';

    if (!finishing && loadFX.target >= 1 && loadFX.progress > 0.992) {
      finishing = true;
      loadFX.ramping = false;                                 // zatrzymaj ramp; GSAP przejmuje
      loadFX.progress = 1;
      loadFX.fill = 1;                                        // sygnet w pełni zalany primary
      if (pct) pct.textContent = '100%';
      finish(loading, pct);
    }
  });
}

// Faza 2 — sygnet stoi w miejscu. Scena z czerni → handoff trybu shaderowego → UI na końcu.
function finish(loading, pct) {
  const chrome = ['#topbar', '#nav', '#tagline'];

  const tl = gsap.timeline({
    onComplete: () => {
      // Handoff — sygnet w normalnym ticku (lewitacja, mysz, hover działów). Skala bez zmian.
      loadFX.active = false;
      loadFX.load = 0;
      sceneFX.reveal = 1;
      document.body.classList.remove('is-loading');
      gsap.set(chrome, { clearProps: 'opacity' });   // oddaj kontrolę CSS-owi
      if (loading) loading.style.display = 'none';
    },
  });

  // SCENA z czerni (planeta/mgła) — pierwszy beat
  tl.to(sceneFX, { reveal: 1, duration: 0.8, ease: 'power2.inOut' }, 0)

  // Handoff trybu shaderowego: fala → normalny sygnet (oba primary → bez przeskoku)
    .to(loadFX, { load: 0, duration: 0.6, ease: 'power2.inOut' }, 0.1)

  // UI (nav/linie/topbar/tagline) — osobny beat NA KOŃCU, po ujawnieniu sceny
    .to(chrome, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.55);

  if (pct) tl.to(pct, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0);
}
