import * as THREE from 'three';
import { sceneFX } from './tint.js?v=msaeafs8';

let renderer, scene, camera, clock, renderTarget;
const tickCallbacks = [];

// Refraction node — sygnet rejestruje tu siebie (obiekt do ukrycia w Pass 1 +
// materiał z uniformem tBackground). null = zwykły single-pass render.
let refraction = null;
const _dbs = new THREE.Vector2();

// Planeta — jaśniejsza w renderTargecie (Pass 1, próbkowanym przez sygnet),
// subtelna gołym okiem (Pass 2). Na mobile nieco jaśniejsza bo vignette słabsza.
let planetMat = null;
const PLANET_OPACITY_VISIBLE = window.innerWidth <= 768 ? 0.26 : 0.17;
const PLANET_OPACITY_REFRACT = 1.0;    // co zagina sygnet (jaśniejsza soczewka)

export async function initScene() {
  const canvas = document.getElementById('c');

  scene = new THREE.Scene();
  clock  = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 300);

  // alpha:true — canvas stays transparent so planet-bg CSS layer shows through
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Render target dla przebiegu tła (Pass 1) — sygnet próbkuje go jako tBackground
  renderer.getDrawingBufferSize(_dbs);
  renderTarget = new THREE.WebGLRenderTarget(_dbs.x, _dbs.y, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  // Planeta — tekstura w scenie (była warstwą CSS). Daleko za sygnetem, więc Pass 1
  // refrakcji łapie ją do renderTarget → sygnet realnie ją zagina.
  // planetReady — śledzona Promise dla loading screen (Etap 9); rozwiązuje się też przy
  // błędzie, żeby nie blokować progresu.
  let _resolvePlanet;
  const planetReady = new Promise(res => { _resolvePlanet = res; });
  const _mobile  = window.innerWidth <= 768;

  // Desktop: tło = WIDEO (THREE.VideoTexture, żywy kadr). Mobile: statyczny WebP
  // (autoplay-restrictions + perf + bateria). Materiał/opacity/pozycja BEZ zmian → 1:1.
  const _loadWebp = () => {
    const t = new THREE.TextureLoader().load(
      '../assets/planet-bg.webp',   // 18.8MB PNG → 222KB WebP (2560w) — ładuje się na czas loadingu
      () => _resolvePlanet(), undefined, () => _resolvePlanet(),
    );
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  let planetTexture;
  if (_mobile) {
    planetTexture = _loadWebp();
  } else {
    const video = document.createElement('video');
    video.src = '../assets/planet-bg-web.mp4';
    video.loop = true; video.muted = true; video.playsInline = true;
    video.autoplay = true; video.preload = 'auto';
    video.playbackRate = 0.8;                                // odrobinę wolniej (knob: 1.0 = natywnie)
    planetTexture = new THREE.VideoTexture(video);
    planetTexture.colorSpace = THREE.SRGBColorSpace;
    video.addEventListener('loadeddata', () => _resolvePlanet(), { once: true });
    video.addEventListener('error', () => {                 // fallback → webp
      const fb = _loadWebp();
      if (planetMat) { planetMat.map = fb; planetMat.needsUpdate = true; }
    }, { once: true });
    video.play().catch(() => {});                           // niektóre silniki wymagają jawnego play
    document.addEventListener('visibilitychange', () => {   // pauza gdy karta w tle
      if (document.hidden) video.pause(); else video.play().catch(() => {});
    });
  }
  planetMat = new THREE.MeshBasicMaterial({
    map: planetTexture, transparent: true, opacity: PLANET_OPACITY_VISIBLE, depthWrite: false,
  });

  const PLANET_Z = -500;
  // Mobile: ZOOM tła — obraz wypełnia kadr SWOJĄ treścią (niebo z księżycami u góry, jak na
  // desktopie). Wcześniejsze doklejanie sztucznego nieba (klamr/gradient/alpha) za każdym razem
  // czytało się jako stały granatowy PAS u góry. Tu nie ma żadnej dosztukówki — tylko realny
  // obraz, większy, zakotwiczony tak by wypełniał górę kadru. (BRIEF 15 #1)
  const ZOOM     = _mobile ? 1.25 : 1.0;   // oddalone vs 1.5 → księżyce wracają w kadr
  const PLANET_W = 2000 * ZOOM;
  const PLANET_H = 1200 * ZOOM;
  const planetMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANET_W, PLANET_H), planetMat);

  const viewTop = (camera.position.z - PLANET_Z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // Górna krawędź obrazu = góra widoku (+HEADROOM na ruch w górę na mobile). Budynek ląduje
  // w górnym-centrum kadru. Brak luki nad obrazem = brak pasa. Desktop bez zmian (ZOOM=1, HEADROOM=0).
  const HEADROOM    = _mobile ? 90 : 0;
  const basePlanetY = viewTop + HEADROOM - PLANET_H / 2;
  // Mobile: plan przesunięty w LEWO → wieża (jest po prawej obrazu) wraca obok sygnetu —
  // widoczna startowo + jej jasna wiązka za sygnetem przywraca szklaną refrakcję. (knob do tuningu)
  const basePlanetX = _mobile ? -120 : 0;   // delikatnie w prawo vs -220 (wieża nie wchodzi pod sygnet)
  planetMesh.position.set(basePlanetX, basePlanetY, PLANET_Z);
  scene.add(planetMesh);

  // Dim violet ambient — creatures use additive blending, so they self-illuminate
  scene.add(new THREE.AmbientLight(0x5B2EFF, 0.15));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.getDrawingBufferSize(_dbs);
    renderTarget.setSize(_dbs.x, _dbs.y);
  });

  return { scene, camera, renderer, clock, planetReady, planetMesh, basePlanetY, basePlanetX };
}

// Modules register their per-frame callbacks here
export function onTick(fn) {
  tickCallbacks.push(fn);
}

// Sygnet rejestruje obiekt + materiał refrakcyjny. Pętla robi wtedy 2 przebiegi.
export function registerRefraction(object, material) {
  refraction = { object, material };
}

export function startLoop() {
  renderer.setAnimationLoop(() => {
    const delta   = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    for (const fn of tickCallbacks) fn(delta, elapsed);

    if (refraction) {
      // Pass 1 — scena BEZ sygnetu → renderTarget (to staje się tłem do zagięcia).
      // Planeta podbita do pełni, żeby sygnet zaginał jasne tło, nie przyciemnione.
      // ×planet — podczas loadingu miasto/planeta ujawnia się stopniowo z progresem,
      // więc szklany sygnet refraktuje świat, który dopiero się składa.
      refraction.object.visible = false;
      if (planetMat) planetMat.opacity = PLANET_OPACITY_REFRACT * sceneFX.planet;
      renderer.setRenderTarget(renderTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Pass 2 — pełna scena z sygnetem próbkującym tBackground.
      // Planeta wraca do subtelnego 0.17 (to, co widać gołym okiem) × planet (fade z czerni).
      if (planetMat) planetMat.opacity = PLANET_OPACITY_VISIBLE * sceneFX.planet;
      refraction.object.visible = true;
      refraction.material.uniforms.tBackground.value = renderTarget.texture;
      renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }
  });
}
