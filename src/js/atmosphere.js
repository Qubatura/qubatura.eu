// atmosphere.js — mgła wolumetryczna (fragment shader) + chmury tintu działów + corona.
//
// Etap 7 kontrakt: czytamy współdzielony stan navFX (tint.js) i odwzorowujemy:
//   • globalny tint mgły      ← mix(BASE_TINT, navFX.target, intensity * 0.4)
//   • chmurę koloru działu    ← navFX.activeDiv (per-dział, fade 0.08/klatkę do 0.55)
//   • corona discharge        ← mix(BASE_TINT, navFX.target, intensity) → ku bieli
// navFX.dirX/dirY/tug/pulse/glow konsumuje wyłącznie signet.js — tu nieużywane.
//
// Mgła + chmury żyją w JEDNYM shaderze na pełnoekranowym planie (z=0). Plan jest
// w `scene`, więc Pass 1 refrakcji łapie go do renderTarget → sygnet zagina mgłę.
// Blending: pure-add RGB (OneFactor), alpha = luminancja → canvas zostaje przezroczysty
// w ciemnych miejscach, dzięki czemu CSS #planet-bg dalej prześwituje.

import * as THREE from 'three';
import { onTick } from './scene.js';
import { navFX, BASE_TINT, DIVISION_COLORS } from './tint.js';

// ─── Konfiguracja ───────────────────────────────────────────────────────────
const CLOUD_DEFS = [
  { div: 'events', sel: '#nav-events .nav-label' },
  { div: 'studio', sel: '#nav-studio .nav-label' },
  { div: 'lab',    sel: '#nav-lab .nav-label' },
];
const CLOUD_OPACITY = 0.55;   // docelowa siła chmury działu (jak w wersji sprite'owej)
const CLOUD_EASE_RATE = 5;    // tempo fade in/out chmur (na sekundę; skalowane delta → stałe przy zmiennym FPS)
const CLOUD_RADIUS  = 150;    // promień chmury w jedn. świata (= pół sprite'a 300)
const FOG_STRENGTH  = 0.45;   // TEST (docelowo ~0.18) — sprawdzamy czy plan w ogóle widać
const FOG_Z         = 0;      // głębokość planu mgły (jak poprzednie sprite'y)

// ─── Shader ─────────────────────────────────────────────────────────────────
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uAspect;
  uniform vec3  uBaseColor;        // BASE_TINT (mgła w spoczynku)
  uniform vec3  uTintColor;        // navFX.target (już stweenowany kolor działu)
  uniform float uTintIntensity;    // navFX.intensity 0..1
  uniform float uFogStrength;

  uniform vec2  uCloudCenter[3];   // środki napisów działów w przestrzeni „height units"
  uniform vec3  uCloudColor[3];    // STAŁE kolory działów (nie target!)
  uniform float uCloudStrength[3]; // eased 0..0.55
  uniform float uCloudRadius;      // promień chmury w „height units"

  // value noise + fbm
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i),            b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }  // 3 oktawy — koszt/płynność
    return v;
  }

  // Profil radialny chmury — odwzorowuje gradient sprite'a (stops 0→1, .35→.55, .75→.12, 1→0)
  float cloudFalloff(float r) {
    if (r >= 1.0)  return 0.0;
    if (r < 0.35)  return mix(1.0,  0.55, r / 0.35);
    if (r < 0.75)  return mix(0.55, 0.12, (r - 0.35) / 0.40);
    return                mix(0.12, 0.0,  (r - 0.75) / 0.25);
  }

  void main() {
    // przestrzeń „height units": y∈[-0.5,0.5], x skalowany aspektem — koła pozostają kołami
    vec2 ph = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);

    // Dominujący ukośny dryf — mgła „leje się" przez ekran (nie miga w miejscu).
    vec2 flow = vec2(0.50, -0.34);
    // Tani domain-warp (1 oktawa) — zawirowanie, charakter płynącej cieczy.
    vec2 warp = vec2(
      noise(ph * 1.6 + vec2(0.0,        uTime * 0.28)),
      noise(ph * 1.6 + vec2(uTime * 0.28, 5.2))
    ) - 0.5;
    // Dwie warstwy z parallaxem: różny scale i prędkość, ten sam kierunek przepływu.
    vec2 p1 = ph * 2.2 + flow * uTime       + warp * 0.7;
    vec2 p2 = ph * 3.8 + flow * uTime * 1.6 + warp * 0.4;
    float n1 = fbm(p1);
    float n2 = fbm(p2);
    // 3-oktawowy fbm daje średnio ~0.44 — okno smoothstep dostrojone pod ten zakres.
    float density = smoothstep(0.20, 0.70, n1 * 0.6 + n2 * 0.4);

    // globalny tint (cap 0.4 — jak w starym b.mat.color.lerp(target, intensity*0.4))
    vec3 fogColor = mix(uBaseColor, uTintColor, uTintIntensity * 0.4);
    vec3 col = fogColor * density * uFogStrength;

    // chmury działów — additive, kolor STAŁY działu, siła eased
    for (int i = 0; i < 3; i++) {
      float r = length(ph - uCloudCenter[i]) / uCloudRadius;
      col += uCloudColor[i] * cloudFalloff(r) * uCloudStrength[i];
    }

    // alpha = luminancja → przezroczysto w ciemności (CSS planet-bg prześwituje)
    float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`;

// ─── Fog plane ──────────────────────────────────────────────────────────────
function createFog(scene, camera) {
  const uniforms = {
    uTime:           { value: 0 },
    uAspect:         { value: 1 },
    uBaseColor:      { value: new THREE.Vector3(BASE_TINT.r, BASE_TINT.g, BASE_TINT.b) },
    uTintColor:      { value: new THREE.Vector3(BASE_TINT.r, BASE_TINT.g, BASE_TINT.b) },
    uTintIntensity:  { value: 0 },
    uFogStrength:    { value: FOG_STRENGTH },
    uCloudCenter:    { value: [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()] },
    uCloudColor:     { value: CLOUD_DEFS.map(d => {
                        const c = DIVISION_COLORS[d.div]; return new THREE.Vector3(c.r, c.g, c.b);
                      }) },
    uCloudStrength:  { value: [0, 0, 0] },
    uCloudRadius:    { value: 0.43 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthTest: false, depthWrite: false,
    blending:          THREE.CustomBlending,   // pure-add RGB, alpha kontrolowana fragmentem
    blendEquation:     THREE.AddEquation,
    blendSrc:          THREE.OneFactor,
    blendDst:          THREE.OneFactor,
    blendEquationAlpha:THREE.AddEquation,
    blendSrcAlpha:     THREE.OneFactor,
    blendDstAlpha:     THREE.OneFactor,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.position.set(0, 0, FOG_Z);
  mesh.renderOrder = -10;          // mgła rysuje się jako pierwsza (i tak depthTest:false)
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Dopasowanie planu do viewportu + przeliczenie pozycji chmur i promienia (px → świat → height units)
  const resize = () => {
    const dist = camera.position.z - FOG_Z;
    const hWorld = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = window.innerWidth / window.innerHeight;
    mesh.scale.set(hWorld * aspect, hWorld, 1);
    uniforms.uAspect.value = aspect;
    uniforms.uCloudRadius.value = CLOUD_RADIUS / hWorld;   // 1 height-unit = hWorld jedn. świata
    placeClouds(aspect, uniforms);
  };
  resize();
  window.addEventListener('resize', resize);

  return { uniforms };
}

// Środek napisu działu (DOM) → przestrzeń „height units" shadera (top ekranu = +0.5)
function placeClouds(aspect, uniforms) {
  CLOUD_DEFS.forEach((d, i) => {
    const el = document.querySelector(d.sel);
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const ux = (r.left + r.width  / 2) / window.innerWidth;
    const uy = (r.top  + r.height / 2) / window.innerHeight;
    uniforms.uCloudCenter.value[i].set((ux - 0.5) * aspect, 0.5 - uy);
  });
}

// ─── Corona discharge (bez zmian — osobny system linii, karmiony navFX) ────────
const CORONA_CLR = new THREE.Color(0x9B7FFF);
const POOL_SIZE  = 15;
const MAX_PTS    = 8;
const _white     = new THREE.Color(0xffffff);

function makeSlot(scene) {
  const pos = new Float32Array(MAX_PTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.attributes.position.usage = THREE.DynamicDrawUsage;
  geo.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    color: CORONA_CLR, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const line = new THREE.Line(geo, mat);
  line.renderOrder = 20;
  line.visible = false;
  scene.add(line);

  return { line, pos, geo, mat, active: false, life: 0, maxLife: 0 };
}

function spawnBolt(slot) {
  const x      = (Math.random() - 0.5) * 500;
  const y      = (Math.random() - 0.5) * 280;
  const angle  = Math.random() * Math.PI * 2;
  const length = 6 + Math.random() * 7;
  const nSeg   = 4 + Math.floor(Math.random() * 3);
  const nPts   = nSeg + 1;

  for (let i = 0; i < nPts; i++) {
    const t   = i / nSeg;
    const bx  = x + Math.cos(angle) * length * t;
    const by  = y + Math.sin(angle) * length * t;
    const jit = (i > 0 && i < nSeg) ? (Math.random() - 0.5) * 3.5 : 0;
    slot.pos[i * 3]     = bx - Math.sin(angle) * jit;
    slot.pos[i * 3 + 1] = by + Math.cos(angle) * jit;
    slot.pos[i * 3 + 2] = 10;
  }

  slot.geo.setDrawRange(0, nPts);
  slot.geo.attributes.position.needsUpdate = true;
  // Corona przyjmuje tint działu, rozjaśniony ku bieli (jaśniejsza niż mgła)
  slot.mat.color.copy(BASE_TINT).lerp(navFX.target, navFX.intensity).lerp(_white, 0.35);
  slot.mat.opacity = 0.40;
  slot.line.visible = true;
  slot.active  = true;
  slot.life    = 0;
  slot.maxLife = 5 + Math.floor(Math.random() * 4);
}

function createCorona(scene) {
  const pool = Array.from({ length: POOL_SIZE }, () => makeSlot(scene));
  let   timer = 0.3 + Math.random() * 0.7;

  return {
    update(delta) {
      timer -= delta;
      if (timer <= 0) {
        const free = pool.find(s => !s.active);
        if (free) spawnBolt(free);
        timer = 0.3 + Math.random() * 0.7;
      }
      for (const s of pool) {
        if (!s.active) continue;
        s.life++;
        s.mat.opacity = 0.40 * (1 - s.life / s.maxLife);
        if (s.life >= s.maxLife) { s.line.visible = false; s.active = false; }
      }
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function initAtmosphere(ctx) {
  const { scene, camera } = ctx;
  const fog    = createFog(scene, camera);
  const corona = createCorona(scene);
  const u      = fog.uniforms;
  const str    = u.uCloudStrength.value;   // referencja do tablicy float[3]

  onTick((delta, elapsed) => {
    u.uTime.value = elapsed;

    // globalny tint mgły — navFX.target (Color) → vec3
    u.uTintColor.value.set(navFX.target.r, navFX.target.g, navFX.target.b);
    u.uTintIntensity.value = navFX.intensity;

    // chmury działów — fade do 0.55 gdy aktywny, inaczej do 0 (niezależnie od FPS)
    const ease = Math.min(1, delta * CLOUD_EASE_RATE);
    for (let i = 0; i < CLOUD_DEFS.length; i++) {
      const target = (navFX.activeDiv === CLOUD_DEFS[i].div) ? CLOUD_OPACITY : 0;
      str[i] += (target - str[i]) * ease;
    }

    corona.update(delta);
  });
}
