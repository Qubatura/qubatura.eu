import * as THREE from 'three';

let renderer, scene, camera, clock, renderTarget;
const tickCallbacks = [];

// Refraction node — sygnet rejestruje tu siebie (obiekt do ukrycia w Pass 1 +
// materiał z uniformem tBackground). null = zwykły single-pass render.
let refraction = null;
const _dbs = new THREE.Vector2();

// Planeta — jaśniejsza w renderTargecie (Pass 1, próbkowanym przez sygnet),
// subtelna gołym okiem (Pass 2).
let planetMat = null;
const PLANET_OPACITY_VISIBLE = 0.17;   // co widać na ekranie
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
  const planetTexture = new THREE.TextureLoader().load('/assets/planet-bg.png');
  planetTexture.colorSpace = THREE.SRGBColorSpace;
  planetMat = new THREE.MeshBasicMaterial({
    map: planetTexture, transparent: true, opacity: PLANET_OPACITY_VISIBLE,
  });
  const planetMesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1200), planetMat);
  planetMesh.position.z = -500;
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

  return { scene, camera, renderer, clock };
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
      refraction.object.visible = false;
      if (planetMat) planetMat.opacity = PLANET_OPACITY_REFRACT;
      renderer.setRenderTarget(renderTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Pass 2 — pełna scena z sygnetem próbkującym tBackground.
      // Planeta wraca do subtelnego 0.17 (to, co widać gołym okiem).
      if (planetMat) planetMat.opacity = PLANET_OPACITY_VISIBLE;
      refraction.object.visible = true;
      refraction.material.uniforms.tBackground.value = renderTarget.texture;
      renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }
  });
}
