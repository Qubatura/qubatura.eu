import * as THREE from 'three';
import { sceneFX } from './tint.js';

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

  const PLANET_W = 2000, PLANET_H = 1200, PLANET_Z = -500;
  const _mobile  = window.innerWidth <= 768;
  // EXTRA_TOP — zapas nieba NAD sceną na mobile (kamera „rozgląda się" w górę). Klamrowanie
  // (BRIEF13) i alphaMapa (BRIEF14) dawały na styku stały PASEK na iOS. Tu DOKLEJAMY do tekstury
  // gładki gradient nieba: dolny stop = kolor górnego rzędu obrazu (styk bezszwowy), górny =
  // tło strony. Brak twardej krawędzi w żadnym położeniu kamery. (BRIEF 15 #1)
  const EXTRA_TOP = _mobile ? 900 : 0;
  const fullH = PLANET_H + EXTRA_TOP;
  const BG_HEX = '#0A0A0F';   // = --color-bg (tło strony)

  planetMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: PLANET_OPACITY_VISIBLE, depthWrite: false,
  });
  const planetMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANET_W, fullH), planetMat);

  // Tekstura budowana po wczytaniu obrazu — na mobile jako kompozyt obraz + gradient-niebo.
  const img = new Image();
  img.onload = () => {
    let tex;
    if (EXTRA_TOP > 0) {
      const cw  = img.width;
      const ch  = Math.round(img.height * (fullH / PLANET_H));  // wyższy canvas (obraz + niebo)
      const top = ch - img.height;                              // px nieba doklejonego u góry
      const cnv = document.createElement('canvas');
      cnv.width = cw; cnv.height = ch;
      const cx = cnv.getContext('2d');
      cx.drawImage(img, 0, top, cw, img.height);                // obraz przy dolnej krawędzi canvasu
      // Średni kolor górnego rzędu obrazu → dolny stop gradientu (bezszwowy styk z niebem).
      let r = 10, g = 10, b = 15;
      try {
        const row = cx.getImageData(0, top, cw, 1).data;
        r = g = b = 0;
        for (let i = 0; i < cw; i++) { r += row[i * 4]; g += row[i * 4 + 1]; b += row[i * 4 + 2]; }
        r = Math.round(r / cw); g = Math.round(g / cw); b = Math.round(b / cw);
      } catch (_) { /* tainted canvas — fallback do BG */ }
      const grad = cx.createLinearGradient(0, 0, 0, top);
      grad.addColorStop(0, BG_HEX);                             // szczyt = tło strony
      grad.addColorStop(1, `rgb(${r},${g},${b})`);             // styk z obrazem = jego górny rząd
      cx.fillStyle = grad; cx.fillRect(0, 0, cw, top);
      tex = new THREE.CanvasTexture(cnv);
    } else {
      tex = new THREE.Texture(img);
      tex.needsUpdate = true;
    }
    tex.colorSpace      = THREE.SRGBColorSpace;
    tex.minFilter       = THREE.LinearFilter;   // NPOT-safe na iOS (bez mipmap)
    tex.generateMipmaps = false;
    planetMat.map = tex;
    planetMat.needsUpdate = true;
    _resolvePlanet();
  };
  img.onerror = () => _resolvePlanet();
  img.src = '../assets/planet-bg.png';
  const viewTop = (camera.position.z - PLANET_Z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // Na mobile przesunięcie w dół o 200wu — budynek w centrum kadru startowo
  const planetShift  = window.innerWidth <= 768 ? -200 : 0;
  // Kotwiczymy DOLNĄ krawędź obrazu tam gdzie była; nadmiar wysokości idzie w górę (niebo).
  const contentBaseY = viewTop - PLANET_H / 2 + planetShift;
  const basePlanetY  = contentBaseY + EXTRA_TOP / 2;   // środek wyższego planu (dół niezmieniony)
  planetMesh.position.set(0, basePlanetY, PLANET_Z);
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

  return { scene, camera, renderer, clock, planetReady, planetMesh, basePlanetY };
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
