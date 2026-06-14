import * as THREE from 'three';

let renderer, scene, camera, clock, renderTarget;
const tickCallbacks = [];

// Refraction node — sygnet rejestruje tu siebie (obiekt do ukrycia w Pass 1 +
// materiał z uniformem tBackground). null = zwykły single-pass render.
let refraction = null;
const _dbs = new THREE.Vector2();

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
      // Pass 1 — scena BEZ sygnetu → renderTarget (to staje się tłem do zagięcia)
      refraction.object.visible = false;
      renderer.setRenderTarget(renderTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Pass 2 — pełna scena z sygnetem próbkującym tBackground
      refraction.object.visible = true;
      refraction.material.uniforms.tBackground.value = renderTarget.texture;
      renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }
  });
}
