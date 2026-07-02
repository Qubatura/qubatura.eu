// main.js — entry point qubatura.eu
// Wired in Etap 3 (Three.js scene setup)
//
// Import order mirrors build stages:
//   Etap 3: scene.js        — Three.js renderer, camera, scene
//   Etap 4: creatures.js    — DNA Infinity Creatures (lemniscate Lissajous)
//   Etap 5: atmosphere.js   — fog shader + corona discharge
//   Etap 6: signet.js       — 3D extruded signet + mouse proximity
//   Etap 7: navigation.js   — directional nav tint integration
//   Etap 10: router.js      — SPA History API + GSAP transitions

import { initScene, startLoop } from './scene.js?v=20260702i';
import { initParallax }         from './parallax.js?v=20260702i';
import { initAtmosphere }       from './atmosphere.js?v=20260702i';
import { initFireflies }        from './fireflies.js?v=20260702i';
import { initSignet }           from './signet.js?v=20260702i';
import { initNavigation }       from './navigation.js?v=20260702i';
import { initRouter }           from './router.js?v=20260702i';
import { initPlayers }          from './players.js?v=20260702i';   // Część 2: playery audio (Studio)
import { initCursor }           from './cursor.js?v=20260702i';
import { initContact }          from './contact.js?v=20260702i';
import { initLoader }           from './loader.js?v=20260702i';   // Etap 9: loading screen
import { initPong }             from './pong.js?v=20260702i';     // Easter egg: Chwila relaksu
import { initGallery }          from './gallery.js?v=20260702i';              // Events: galeria realizacji + lightbox
import { initLab }              from './lab.js?v=20260702i';                  // Lab: oprogramowanie audio + podstrona produktu

async function boot() {
  initCursor();                 // własna kulka kursora — od razu aktywna
  initContact();                // contact overlay (trigger: [data-contact])
  const ctx = await initScene();
  initParallax(ctx);
  initAtmosphere(ctx);
  initFireflies(ctx);

  // Sygnet musi istnieć, by być wskaźnikiem loadingu — budujemy go (ładuje SVG).
  const signetReady = initSignet(ctx);
  await signetReady;

  initNavigation(ctx);
  initRouter();
  initPlayers();                // playery audio działu Studio (skeleton + slot 1)
  initPong();
  initGallery();                // galeria realizacji działu Events (slideshow + lightbox)
  initLab();                    // Lab: kafelki oprogramowania + podstrona produktu (overlay)

  // Etap 9 — loading screen: realny tracking zasobów (Promise.all, nie fake timer).
  // fonty + tekstura planety + sygnet (już gotowy) → progres sterujący kolorem sygnetu.
  // + PRELOAD teł departamentów (WebP ~150KB): 100% czeka też na nie i są w cache PRZED
  //   wejściem na podstronę → koniec „trzyma tło home, a napisy już z podstrony".
  const preloadImg = src => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = src; });
  initLoader([
    document.fonts.ready, ctx.planetReady, signetReady,
    preloadImg('../assets/qubatura.eu-tlo-dep-events.webp'),
    preloadImg('../assets/qubatura.eu-tlo-dep-studio.webp'),
    preloadImg('../assets/qubatura.eu-tlo-dep-lab.webp'),
  ]);

  startLoop();                  // pętla rusza → sygnet renderuje się jako wskaźnik loadingu
}

boot();
