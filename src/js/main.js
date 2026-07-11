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

import { initScene, startLoop } from './scene.js?v=mrgahdhe';
import { initParallax }         from './parallax.js?v=mrgahdhe';
import { initAtmosphere }       from './atmosphere.js?v=mrgahdhe';
import { initFireflies }        from './fireflies.js?v=mrgahdhe';
import { initSignet }           from './signet.js?v=mrgahdhe';
import { initNavigation }       from './navigation.js?v=mrgahdhe';
import { initRouter }           from './router.js?v=mrgahdhe';
import { initPlayers }          from './players.js?v=mrgahdhe';   // Część 2: playery audio (Studio)
import { initCursor }           from './cursor.js?v=mrgahdhe';
import { initContact }          from './contact.js?v=mrgahdhe';
import { initContactConsole }   from './contact-console.js?v=mrgahdhe';   // Kontakt: silnik formularza (konsoleta)
import { initLoader }           from './loader.js?v=mrgahdhe';   // Etap 9: loading screen
import { initPong }             from './pong.js?v=mrgahdhe';     // Easter egg: Chwila relaksu
import { initGallery }          from './gallery.js?v=mrgahdhe';              // Events: galeria realizacji + lightbox
import { initLab }              from './lab.js?v=mrgahdhe';                  // Lab: oprogramowanie audio + podstrona produktu
import { initStudioMonitor }    from './studio.js?v=mrgahdhe';               // Studio: „ożywiony monitor" (smaczek)
import { initPlayer }           from './player.js?v=mrgahdhe';               // HOME: mini player muzyczny (rolka)
import { initCookies }          from './cookie-consent.js?v=mrgahdhe';       // Cookie consent (minimalny, tylko niezbędne)
import { initColophon }         from './colophon.js?v=mrgahdhe';             // Colophon „tę stronę zrobiliśmy sami" (tagline)

async function boot() {
  initCursor();                 // własna kulka kursora — od razu aktywna
  initContact();                // contact overlay (trigger: [data-contact])
  initContactConsole();         // Kontakt: silnik formularza (brama → konsoleta → tor → wyślij)
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
  initStudioMonitor();          // Studio: pulsujący monitor-smaczek → lightbox realizacji
  initPlayer();                 // HOME: mini player muzyczny (rolka numerów + tytuł, spięty z waveform)
  initCookies();                // Cookie consent — minimalny baner „tylko niezbędne" (raz, do akceptacji)
  initColophon();               // Colophon — klik taglinu „Przybywamy z sygnałem" → o tej stronie + stack

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
    preloadImg('../assets/qubatura.eu-tlo-dep-contact.webp'),   // Kontakt: pokój łączności
  ]);

  startLoop();                  // pętla rusza → sygnet renderuje się jako wskaźnik loadingu
}

boot();
