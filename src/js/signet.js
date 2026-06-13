import * as THREE from 'three';
import { SVGLoader }      from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { onTick } from './scene.js';

const _mouse = { x: -9999, y: -9999 };
window.addEventListener('mousemove', e => { _mouse.x = e.clientX; _mouse.y = e.clientY; });

export async function initSignet(ctx) {
  const { scene, renderer } = ctx;

  // ─── Environment map — RoomEnvironment daje neutralne IBL dla szkła ────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
  scene.environment = envTexture;
  pmrem.dispose();

  // ─── Lights — 3 PointLight wokół sygnetu dla refleksów na szkle ───────────
  const pinkLight   = new THREE.PointLight(0xE0218A, 2, 500);
  pinkLight.position.set(-100, 20, 160);          // przód-lewo
  scene.add(pinkLight);

  const violetLight = new THREE.PointLight(0x5B2EFF, 2, 500);
  violetLight.position.set( 100, 20, 160);         // przód-prawo
  scene.add(violetLight);

  const topLight    = new THREE.PointLight(0xffffff, 1, 400);
  topLight.position.set(0, 120, 100);              // góra
  scene.add(topLight);

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

  // ─── Build shapes ──────────────────────────────────────────────────────────
  const shapes = data.paths.flatMap(p => SVGLoader.createShapes(p));
  if (!shapes.length) return;

  // Bounding box — więcej punktów żeby cieniutkie fragmenty (ogon Q) nie uciekły
  const bb = new THREE.Box2();
  for (const s of shapes) {
    for (const p of s.getPoints(64)) bb.expandByPoint(p);
  }
  const svgCX  = (bb.min.x + bb.max.x) / 2;
  const svgCY  = (bb.min.y + bb.max.y) / 2;
  const svgMax = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
  const S      = 51.4 / svgMax;

  // ─── Material — czyste szkło ───────────────────────────────────────────────
  const mat = new THREE.MeshPhysicalMaterial({
    color:             new THREE.Color(0xffffff),
    emissive:          new THREE.Color(0x5B2EFF),
    emissiveIntensity: 0.03,
    transmission:      0.99,
    roughness:         0.0,
    metalness:         0.0,
    ior:               2.2,
    thickness:         2,
    envMapIntensity:   3.0,
    envMap:            envTexture,
    side:              THREE.DoubleSide,
    transparent:       true,
  });

  // ─── Geometry — bevel mały żeby nie pożerał cienkich fragmentów ogona Q ───
  const group  = new THREE.Group();
  const depth  = 3 / S;
  // bevelSize 0.25wu w przestrzeni świata → ~6 jedn. SVG → nie niszczy detali
  const bevel  = 0.25 / S;

  for (const shape of shapes) {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled:   true,
      bevelThickness: bevel,
      bevelSize:      bevel,
      bevelSegments:  4,
      curveSegments:  32,   // gładsze krzywe SVG → lepsze przybliżenie krawędzi
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-svgCX, -svgCY, -depth / 2);
    group.add(mesh);
  }

  group.scale.set(S, -S, S);

  // ─── Pivot ─────────────────────────────────────────────────────────────────
  const pivot = new THREE.Group();
  pivot.add(group);
  scene.add(pivot);

  // ─── Tick ──────────────────────────────────────────────────────────────────
  let hoverScale    = 1.0;
  let hoverEmissive = 0.03;

  onTick((_dt, elapsed) => {
    pivot.rotation.y = Math.sin(elapsed * (Math.PI / 4)) * 0.44;
    pivot.rotation.x = Math.sin(elapsed * 0.19 + 0.8) * 0.09;

    const dist = Math.hypot(
      _mouse.x - window.innerWidth  * 0.5,
      _mouse.y - window.innerHeight * 0.5
    );
    const near = dist < 140;

    hoverScale    += ((near ? 1.08 : 1.0)  - hoverScale)    * 0.07;
    hoverEmissive += ((near ? 0.35 : 0.05) - hoverEmissive) * 0.07;

    pivot.scale.setScalar(hoverScale);
    mat.emissiveIntensity = hoverEmissive;
  });
}
