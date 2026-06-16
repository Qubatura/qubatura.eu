import * as THREE from 'three';
import { onTick } from './scene.js';

// ─── Canvas gradient texture — shared across all fog sprites ──────────────────

function makeGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx  = canvas.getContext('2d');
  // Outer radius 440 (not 512) — leaves ~72px fully-transparent border
  // so mipmap sampling never bleeds the sprite quad edge
  const grad = ctx.createRadialGradient(512, 512, 0, 512, 512, 440);
  grad.addColorStop(0,    'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.12)');
  grad.addColorStop(1,    'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ─── Fog sprites ──────────────────────────────────────────────────────────────

function createFog(scene) {
  const texture = makeGradientTexture();
  const blobs   = [];

  for (let i = 0; i < 10; i++) {
    const baseOpacity = (0.09 + Math.random() * 0.06) * 1.1; // +10% widoczności (≈0.10–0.165)

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
      (Math.random() - 0.5) * 500,  // ±250 — within visible viewport (±308wu)
      (Math.random() - 0.5) * 280,  // ±140 — within visible viewport (±173wu)
      (Math.random() - 0.5) * 60
    );
    scene.add(sprite);

    blobs.push({
      sprite,
      mat,
      baseOpacity,
      vx:      (Math.random() - 0.5) * 0.14,
      vy:      (Math.random() - 0.5) * 0.08,
      // Opacity: wspólny okres + fazy RÓWNOMIERNE → kulminacje rozstawione, suma ≈ stała
      // → brak skoków jasności sceny (okres MUSI być jednakowy, inaczej dudnienie wraca).
      period:  10,
      phase:   (i / 10) * Math.PI * 2,
    });
  }

  return blobs;
}

function updateFog(blobs, elapsed) {
  const BW = 290, BH = 165; // wrap na granicy viewport — nie pozwala sprite'om wychodzić daleko poza
  for (const b of blobs) {
    b.sprite.position.x += b.vx;
    b.sprite.position.y += b.vy;

    if (b.sprite.position.x >  BW) b.sprite.position.x = -BW;
    if (b.sprite.position.x < -BW) b.sprite.position.x =  BW;
    if (b.sprite.position.y >  BH) b.sprite.position.y = -BH;
    if (b.sprite.position.y < -BH) b.sprite.position.y =  BH;

    // Sinusoidal breathing — łagodniejsza głębokość (0.4×–1.0× bazy) → płynniej,
    // mniej gwałtowne zmiany jasności przy szybszym okresie.
    const s = Math.sin(elapsed * (Math.PI * 2 / b.period) + b.phase);
    b.mat.opacity = b.baseOpacity * (0.7 + s * 0.3);
  }
}

// ─── Corona discharge ─────────────────────────────────────────────────────────

const CORONA_CLR = new THREE.Color(0x9B7FFF);
const POOL_SIZE  = 15;
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
