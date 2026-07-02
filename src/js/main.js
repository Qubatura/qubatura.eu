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

import { initScene, startLoop } from './scene.js?v=20260702c';
import { initParallax }         from './parallax.js?v=20260702c';
import { initAtmosphere }       from './atmosphere.js?v=20260702c';
import { initFireflies }        from './fireflies.js?v=20260702c';
import { initSignet }           from './signet.js?v=20260702c';
import { initNavigation }       from './navigation.js?v=20260702c';
import { initRouter }           from './router.js?v=20260702c';
import { initPlayers }          from './players.js?v=20260702c';   // Część 2: playery audio (Studio)
import { initCursor }           from './cursor.js?v=20260702c';
import { initContact }          from './contact.js?v=20260702c';
import { initLoader }           from './loader.js?v=20260702c';   // Etap 9: loading screen
import { initPong }             from './pong.js?v=20260702c';     // Easter egg: Chwila relaksu

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

  // Etap 9 — loading screen: realny tracking zasobów (Promise.all, nie fake timer).
  // fonty + tekstura planety + sygnet (już gotowy) → progres sterujący kolorem sygnetu.
  initLoader([document.fonts.ready, ctx.planetReady, signetReady]);

  startLoop();                  // pętla rusza → sygnet renderuje się jako wskaźnik loadingu
}

boot();
