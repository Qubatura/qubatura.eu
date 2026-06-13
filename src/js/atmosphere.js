import * as THREE from 'three';
import { onTick } from './scene.js';

// ─── Canvas gradient texture — shared across all fog sprites ──────────────────

function makeGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx  = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0,   'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
  grad.addColorStop(1,   'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

// ─── Fog sprites ──────────────────────────────────────────────────────────────

function createFog(scene) {
  const texture = makeGradientTexture();
  const blobs   = [];

  for (let i = 0; i < 6; i++) {
    const baseOpacity = 0.06 + Math.random() * 0.04; // 0.06–0.10

    const mat = new THREE.SpriteMaterial({
      map:         texture,
      color:       new THREE.Color(0x5B2EFF),
      blending:    THREE.AdditiveBlending,
      transparent: true,
      opacity:     baseOpacity,
      depthWrite:  false,
      depthTest:   false,
    });

    const sprite = new THREE.Sprite(mat);
    const scale  = 300 + Math.random() * 200; // 300–500 world units
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(
      (Math.random() - 0.5) * 600,
      (Math.random() - 0.5) * 360,
      (Math.random() - 0.5) * 60
    );
    scene.add(sprite);

    blobs.push({
      sprite,
      mat,
      baseOpacity,
      vx:      (Math.random() - 0.5) * 0.07,
      vy:      (Math.random() - 0.5) * 0.04,
      period:  8 + Math.random() * 7,           // 8–15s breathing period
      phase:   Math.random() * Math.PI * 2,
    });
  }

  return blobs;
}

function updateFog(blobs, elapsed) {
  const BW = 500, BH = 300;
  for (const b of blobs) {
    b.sprite.position.x += b.vx;
    b.sprite.position.y += b.vy;

    if (b.sprite.position.x >  BW) b.sprite.position.x = -BW;
    if (b.sprite.position.x < -BW) b.sprite.position.x =  BW;
    if (b.sprite.position.y >  BH) b.sprite.position.y = -BH;
    if (b.sprite.position.y < -BH) b.sprite.position.y =  BH;

    // Sinusoidal breathing: oscillates between 0.2× and 1.0× of base opacity
    const s = Math.sin(elapsed * (Math.PI * 2 / b.period) + b.phase);
    b.mat.opacity = b.baseOpacity * (0.6 + s * 0.4);
  }
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
  let   timer = 3 + Math.random() * 5;

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
  const blobs  = createFog(scene);
  const corona = createCorona(scene);

  onTick((delta, elapsed) => {
    updateFog(blobs, elapsed);
    corona.update(delta);
  });
}
