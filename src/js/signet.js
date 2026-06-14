import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { onTick, registerRefraction } from './scene.js';

const _mouse = { x: -9999, y: -9999 };
window.addEventListener('mousemove', e => { _mouse.x = e.clientX; _mouse.y = e.clientY; });

export async function initSignet(ctx) {
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

  // ─── Material — custom GLSL: refrakcja tła + chromatic aberration + fresnel ──
  const uniforms = {
    tBackground:        { value: null },   // wstrzykiwane co klatkę przez scene.js
    refractionStrength: { value: 0.03 },   // do tuningu
    time:               { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec4 vClip;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vClip   = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vClip;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tBackground;
      uniform float refractionStrength;
      uniform float time;

      varying vec3 vNormal;
      varying vec4 vClip;

      void main() {
        // Screen-space UV — dzielenie perspektywiczne per-fragment (poprawne)
        vec2 vScreenPos = (vClip.xy / vClip.w) * 0.5 + 0.5;

        // Zagięcie UV przez normalną (refrakcja)
        vec2 refractedUV = vScreenPos + vNormal.xy * refractionStrength;

        // Chromatic aberration — rozszczepianie RGB
        float r = texture2D(tBackground, refractedUV + vec2(0.002, 0.0)).r;
        float g = texture2D(tBackground, refractedUV).g;
        float b = texture2D(tBackground, refractedUV - vec2(0.002, 0.0)).b;

        // Fresnel — krawędzie bardziej widoczne
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);

        vec3 color = vec3(r, g, b);
        color += vec3(0.35, 0.18, 1.0) * fresnel * 0.4; // fioletowy poblask na krawędziach

        gl_FragColor = vec4(color, 0.85 + fresnel * 0.15);
      }
    `,
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

  // Pętla renderuje teraz w dwóch przebiegach: tło → renderTarget, potem sygnet
  registerRefraction(pivot, mat);

  // ─── Tick ──────────────────────────────────────────────────────────────────
  let hoverScale = 1.0;

  onTick((_dt, elapsed) => {
    uniforms.time.value = elapsed;

    pivot.rotation.y = Math.sin(elapsed * (Math.PI / 4)) * 0.44;
    pivot.rotation.x = Math.sin(elapsed * 0.19 + 0.8) * 0.09;

    const dist = Math.hypot(
      _mouse.x - window.innerWidth  * 0.5,
      _mouse.y - window.innerHeight * 0.5
    );
    const near = dist < 140;

    hoverScale += ((near ? 1.08 : 1.0) - hoverScale) * 0.07;
    pivot.scale.setScalar(hoverScale);
  });
}
