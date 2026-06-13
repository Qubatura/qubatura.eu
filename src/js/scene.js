import * as THREE from 'three';

let renderer, scene, camera, clock;
const tickCallbacks = [];

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

  // Dim violet ambient — creatures use additive blending, so they self-illuminate
  scene.add(new THREE.AmbientLight(0x5B2EFF, 0.15));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  return { scene, camera, renderer, clock };
}

// Modules register their per-frame callbacks here
export function onTick(fn) {
  tickCallbacks.push(fn);
}

export function startLoop() {
  renderer.setAnimationLoop(() => {
    const delta   = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    for (const fn of tickCallbacks) fn(delta, elapsed);
    renderer.render(scene, camera);
  });
}
