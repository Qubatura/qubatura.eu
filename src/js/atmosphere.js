import * as THREE from 'three';
import { onTick } from './scene.js';

// ─── Fog — fullscreen nebula plane ────────────────────────────────────────────

async function createFog(scene) {
  const [vert, frag] = await Promise.all([
    fetch('../shaders/fog.vert').then(r => r.text()),
    fetch('../shaders/fog.frag').then(r => r.text()),
  ]);

  const uniforms = {
    time:     { value: 0 },
    fogColor: { value: new THREE.Color(0x5B2EFF) },
    fogAlpha: { value: 0.20 },
  };

  // Plane large enough to fill any viewport from camera z=300
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 900),
    new THREE.ShaderMaterial({
      vertexShader:   vert,
      fragmentShader: frag,
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

// ─── Corona discharge — rare short lightning bolts ────────────────────────────

const CORONA_CLR  = new THREE.Color(200 / 255, 185 / 255, 1.0); // cool lavender
const POOL_SIZE   = 6;
const MAX_PTS     = 8; // max 7 segments = 8 points

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
  const length = 5 + Math.random() * 8;              // ≈ 15–35px at scene scale
  const nSeg   = 4 + Math.floor(Math.random() * 4);  // 4–7 segments
  const nPts   = nSeg + 1;

  for (let i = 0; i < nPts; i++) {
    const t    = i / nSeg;
    const bx   = x + Math.cos(angle) * length * t;
    const by   = y + Math.sin(angle) * length * t;
    // Perpendicular zigzag jitter on interior points
    const jit  = (i > 0 && i < nSeg) ? (Math.random() - 0.5) * 3.5 : 0;
    slot.pos[i * 3]     = bx - Math.sin(angle) * jit;
    slot.pos[i * 3 + 1] = by + Math.cos(angle) * jit;
    slot.pos[i * 3 + 2] = 10; // in front of creatures
  }

  slot.geo.setDrawRange(0, nPts);
  slot.geo.attributes.position.needsUpdate = true;
  slot.mat.opacity = 0.20 + Math.random() * 0.05;
  slot.line.visible = true;
  slot.active  = true;
  slot.life    = 0;
  slot.maxLife = 6 + Math.floor(Math.random() * 3); // 6–8 frames
}

function createCorona(scene) {
  const pool = Array.from({ length: POOL_SIZE }, () => makeSlot(scene));
  let timer  = 3 + Math.random() * 5; // seconds until first bolt

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

export async function initAtmosphere(ctx) {
  const { scene } = ctx;
  const fogUniforms = await createFog(scene);
  const corona      = createCorona(scene);

  onTick((delta, elapsed) => {
    fogUniforms.time.value = elapsed;
    corona.update(delta);
  });
}
