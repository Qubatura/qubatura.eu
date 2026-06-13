import * as THREE from 'three';
import { onTick } from './scene.js';

// ─── Shaders inline — no fetch needed ────────────────────────────────────────

const FOG_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FOG_FRAG = /* glsl */`
  uniform float time;
  uniform vec3  fogColor;
  uniform float fogAlpha;
  varying vec2  vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 43.21);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),                  hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p  = p * 2.03 + vec2(0.31, 0.73);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Sinusoidal breathing — visible oscillation, period ~52s / ~79s per axis
    vec2 drift = vec2(
      sin(time * 0.12) * 0.35 + time * 0.006,
      cos(time * 0.08) * 0.25 + time * 0.004
    );
    vec2  p = vUv * 3.5 + drift;
    float n = fbm(p);
    float a = max(0.0, n - 0.42) * fogAlpha;
    gl_FragColor = vec4(fogColor, a);
  }
`;

// ─── Fog plane ────────────────────────────────────────────────────────────────

function createFog(scene) {
  const uniforms = {
    time:     { value: 0 },
    fogColor: { value: new THREE.Color(0x5B2EFF) },
    fogAlpha: { value: 0.20 },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 900),
    new THREE.ShaderMaterial({
      vertexShader:   FOG_VERT,
      fragmentShader: FOG_FRAG,
      uniforms,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
      depthTest:      false,
    })
  );
  mesh.position.z = -80;
  mesh.renderOrder = -1;
  scene.add(mesh);

  return uniforms;
}

// ─── Corona discharge ─────────────────────────────────────────────────────────

const CORONA_CLR = new THREE.Color(200 / 255, 185 / 255, 1.0);
const POOL_SIZE  = 6;
const MAX_PTS    = 8;

function makeSlot(scene) {
  const pos = new Float32Array(MAX_PTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.attributes.position.usage = THREE.DynamicDrawUsage;
  geo.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    color:       CORONA_CLR,
    transparent: true,
    opacity:     0,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
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
  const length = 5 + Math.random() * 8;
  const nSeg   = 4 + Math.floor(Math.random() * 4);
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
  slot.mat.opacity = 0.20 + Math.random() * 0.05;
  slot.line.visible = true;
  slot.active  = true;
  slot.life    = 0;
  slot.maxLife = 6 + Math.floor(Math.random() * 3);
}

function createCorona(scene) {
  const pool = Array.from({ length: POOL_SIZE }, () => makeSlot(scene));
  let timer  = 3 + Math.random() * 5;

  return {
    update(delta) {
      timer -= delta;
      if (timer <= 0) {
        const free = pool.find(s => !s.active);
        if (free) spawnBolt(free);
        timer = 3 + Math.random() * 5;
      }
      for (const s of pool) {
        if (!s.active) continue;
        s.life++;
        s.mat.opacity = 0.22 * (1 - s.life / s.maxLife);
        if (s.life >= s.maxLife) {
          s.line.visible = false;
          s.active = false;
        }
      }
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initAtmosphere(ctx) {
  const { scene } = ctx;
  const fogUniforms = createFog(scene);
  const corona      = createCorona(scene);

  onTick((delta, elapsed) => {
    fogUniforms.time.value = elapsed;
    corona.update(delta);
  });
}
