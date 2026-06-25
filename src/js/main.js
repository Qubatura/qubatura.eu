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

import { initScene, startLoop } from './scene.js';
import { initParallax }         from './parallax.js';
import { initAtmosphere }       from './atmosphere.js';
import { initFireflies }        from './fireflies.js';
import { initSignet }           from './signet.js';
import { initNavigation }       from './navigation.js';
import { initRouter }           from './router.js';
import { initCursor }           from './cursor.js';
import { initContact }          from './contact.js';
import { initLoader }           from './loader.js';   // Etap 9: loading screen
import { initPong }             from './pong.js';     // Easter egg: Chwila relaksu

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
  initPong();

  // Etap 9 — loading screen: realny tracking zasobów (Promise.all, nie fake timer).
  // fonty + tekstura planety + sygnet (już gotowy) → progres sterujący kolorem sygnetu.
  initLoader([document.fonts.ready, ctx.planetReady, signetReady]);

  startLoop();                  // pętla rusza → sygnet renderuje się jako wskaźnik loadingu
}

boot();
