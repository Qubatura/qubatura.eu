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
import { initCreatures }        from './creatures.js';
import { initAtmosphere }       from './atmosphere.js';
import { initSignet }           from './signet.js';
import { initNavigation }       from './navigation.js';
import { initRouter }           from './router.js';

async function boot() {
  const ctx = await initScene();
  initCreatures(ctx);
  await initAtmosphere(ctx);
  await initSignet(ctx);
  initNavigation(ctx);
  initRouter();
  startLoop();
}

boot();
