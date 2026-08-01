import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { onTick } from './scene.js?v=msag1ucb';

// Alternatywna wersja sygnetu — czysty hologram (wireframe), bez bryły i refrakcji.
// EdgesGeometry z płaskiej ShapeGeometry (nie ExtrudeGeometry) → kontury SVG jako linie.

const _mouse = { x: -9999, y: -9999 };
window.addEventListener('mousemove', e => { _mouse.x = e.clientX; _mouse.y = e.clientY; });

const ACCENT    = new THREE.Color(0xE0218A);  // magenta — przy mouse proximity
const BASE_MAIN = new THREE.Color(0x5B2EFF);
const BASE_HALO = new THREE.Color(0x9B6DFF);

export async function initSignetHologram(ctx) {
  const { scene } = ctx;

  // ─── Load SVG ──────────────────────────────────────────────────────────────
  const loader = new SVGLoader();
  let data;
  try {
    data = await new Promise((resolve, reject) =>
      loader.load('/assets/signet.svg', resolve, undefined, reject)
    );
  } catch (e) {
    console.warn('signet.svg failed to load', e);
    return;
  }

  const shapes = data.paths.flatMap(p => SVGLoader.createShapes(p));
  if (!shapes.length) return;

  // ─── Bounding box + skala (1:1 z signet.js, żeby porównanie było uczciwe) ────
  const bb = new THREE.Box2();
  for (const s of shapes) {
    for (const p of s.getPoints(64)) bb.expandByPoint(p);
  }
  const svgCX  = (bb.min.x + bb.max.x) / 2;
  const svgCY  = (bb.min.y + bb.max.y) / 2;
  const svgMax = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
  const S      = 51.4 / svgMax;

  // ─── EdgesGeometry z płaskiej ShapeGeometry ─────────────────────────────────
  // ShapeGeometry triangularyzuje kształt na płasko; EdgesGeometry zostawia tylko
  // krawędzie konturu (triangle współpłaszczyznowe → znikają krawędzie wewnętrzne).
  const shapeGeo = new THREE.ShapeGeometry(shapes, 32);
  shapeGeo.translate(-svgCX, -svgCY, 0);   // wycentruj → halo skaluje się od środka
  const edges = new THREE.EdgesGeometry(shapeGeo, 1);
  shapeGeo.dispose();

  // ─── Dwie warstwy linii ─────────────────────────────────────────────────────
  const mainMat = new THREE.LineBasicMaterial({
    color: BASE_MAIN.clone(), transparent: true, opacity: 0.9, depthWrite: false,
  });
  const haloMat = new THREE.LineBasicMaterial({
    color: BASE_HALO.clone(), transparent: true, opacity: 0.25, depthWrite: false,
  });

  const mainLines = new THREE.LineSegments(edges, mainMat);
  mainLines.renderOrder = 10;

  const haloLines = new THREE.LineSegments(edges, haloMat);
  haloLines.scale.setScalar(1.012);   // halo odrobinę szersze
  haloLines.renderOrder = 9;

  // ─── Group + pivot (skala/orientacja jak w signet.js: -S flip osi Y) ────────
  const group = new THREE.Group();
  group.add(haloLines, mainLines);
  group.scale.set(S, -S, S);

  const pivot = new THREE.Group();
  pivot.add(group);
  scene.add(pivot);

  // ─── Tick — ten sam organiczny ruch + mouse proximity blend → magenta ───────
  onTick((_dt, elapsed) => {
    pivot.rotation.y = Math.sin(elapsed * 0.18) * 0.35 + Math.sin(elapsed * 0.31) * 0.18;
    pivot.rotation.x = Math.sin(elapsed * 0.23 + 1.2) * 0.15;
    pivot.rotation.z = Math.sin(elapsed * 0.14 + 0.7) * 0.08;

    const dist = Math.hypot(
      _mouse.x - window.innerWidth  * 0.5,
      _mouse.y - window.innerHeight * 0.5
    );
    const proximity = Math.min(1, Math.max(0, 1 - dist / 200));

    mainMat.color.copy(BASE_MAIN).lerp(ACCENT, proximity);
    haloMat.color.copy(BASE_HALO).lerp(ACCENT, proximity);
  });
}
