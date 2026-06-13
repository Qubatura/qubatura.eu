import * as THREE from 'three';
import { onTick } from './scene.js';

const ACCENT   = new THREE.Color(0xE0218A);
const PRIMARY  = new THREE.Color(0x5B2EFF);
const SEGMENTS = 180;   // per full loop; split in half for depth trick
const HALF_PTS = SEGMENTS / 2 + 1; // points per half-loop (includes both endpoints)
const TRAIL    = 55;    // electron trail length
const COUNT    = 3;

// ─── Lemniscate helpers ───────────────────────────────────────────────────────

function lpos(cx, cy, RX, RY, t) {
  return [
    cx + RX * Math.sin(t),
    cy + RY * Math.sin(2 * t) / 2,
  ];
}

function lnormal(RX, RY, t) {
  const dx =  RX * Math.cos(t);
  const dy =  RY * Math.cos(2 * t);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [-dy / len, dx / len];
}

// ─── Creature ─────────────────────────────────────────────────────────────────

class Creature {
  constructor(scene) {
    this.cx = (Math.random() - 0.5) * 480;
    this.cy = (Math.random() - 0.5) * 240;
    this.RX = 70  + Math.random() * 55;
    this.RY = 35  + Math.random() * 25;
    this.off = 9  + Math.random() * 4;   // strand offset along normal

    const angle = Math.random() * Math.PI * 2;
    const spd   = 0.06 + Math.random() * 0.08;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd * 0.6;

    // Two electrons — opposite directions, slight speed difference
    this.e1t   = Math.random() * Math.PI * 2;
    this.e2t   = this.e1t + Math.PI;
    this.e1spd =  0.020 + Math.random() * 0.006;
    this.e2spd =  0.017 + Math.random() * 0.006;

    this._initStrands(scene);
    this._initTrails(scene);
    this._updateStrands(); // populate on first frame
  }

  // ── Strand geometry ─────────────────────────────────────────────────────────

  _initStrands(scene) {
    const makeHalf = () => {
      const pos = new Float32Array(HALF_PTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return { pos, geo };
    };

    const mat = new THREE.LineBasicMaterial({
      color: PRIMARY,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Strand A: right loop in FRONT (renderOrder 2), left loop behind (1)
    // Strand B: left loop in FRONT (renderOrder 2), right loop behind (1)
    this._aR = makeHalf(); this._aL = makeHalf();
    this._bR = makeHalf(); this._bL = makeHalf();

    const add = (half, order) => {
      const line = new THREE.Line(half.geo, mat.clone());
      line.renderOrder = order;
      scene.add(line);
    };
    add(this._aR, 2); add(this._aL, 1);
    add(this._bR, 1); add(this._bL, 2);
  }

  _updateStrands() {
    const { cx, cy, RX, RY, off } = this;
    const H = SEGMENTS / 2;

    for (let h = 0; h <= H; h++) {
      const tR = (h / H) * Math.PI;           // 0 → π  (right loop)
      const tL = Math.PI + (h / H) * Math.PI; // π → 2π (left loop)

      for (const [t, aHalf, bHalf] of [[tR, this._aR, this._bR], [tL, this._aL, this._bL]]) {
        const [px, py] = lpos(cx, cy, RX, RY, t);
        const [nx, ny] = lnormal(RX, RY, t);

        aHalf.pos[h*3]   = px + nx * off;
        aHalf.pos[h*3+1] = py + ny * off;
        aHalf.pos[h*3+2] = 0;

        bHalf.pos[h*3]   = px - nx * off;
        bHalf.pos[h*3+1] = py - ny * off;
        bHalf.pos[h*3+2] = 0;
      }
    }

    for (const h of [this._aR, this._aL, this._bR, this._bL])
      h.geo.attributes.position.needsUpdate = true;
  }

  // ── Electron trails ─────────────────────────────────────────────────────────

  _initTrails(scene) {
    const makeTrail = () => {
      const pos   = new Float32Array(TRAIL * 3);
      const color = new Float32Array(TRAIL * 3);
      const geo   = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
      geo.setAttribute('color',    new THREE.BufferAttribute(color, 3));
      const line  = new THREE.Line(geo, new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }));
      line.renderOrder = 10;
      scene.add(line);
      return { pos, color, line };
    };

    this._t1 = makeTrail();
    this._t2 = makeTrail();
  }

  _updateTrail(trail, et) {
    // Shift existing positions back by one slot to make room for new head
    trail.pos.copyWithin(3, 0, (TRAIL - 1) * 3);

    const [x, y] = lpos(this.cx, this.cy, this.RX, this.RY, et);
    trail.pos[0] = x;
    trail.pos[1] = y;
    trail.pos[2] = 2;

    // Recompute brightness falloff (additive blending: brightness = perceived alpha)
    for (let i = 0; i < TRAIL; i++) {
      const fade = Math.pow(1 - i / (TRAIL - 1), 1.6);
      trail.color[i*3]   = ACCENT.r * fade;
      trail.color[i*3+1] = ACCENT.g * fade;
      trail.color[i*3+2] = ACCENT.b * fade;
    }

    trail.line.geometry.attributes.position.needsUpdate = true;
    trail.line.geometry.attributes.color.needsUpdate    = true;
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  update() {
    this.cx += this.vx;
    this.cy += this.vy;

    // Wrap — slightly wider than visible frustum so creatures slide in from off-screen
    const BW = 380, BH = 220;
    if (this.cx >  BW + this.RX) this.cx = -BW - this.RX;
    if (this.cx < -BW - this.RX) this.cx =  BW + this.RX;
    if (this.cy >  BH + this.RY) this.cy = -BH - this.RY;
    if (this.cy < -BH - this.RY) this.cy =  BH + this.RY;

    this.e1t += this.e1spd;
    this.e2t -= this.e2spd;

    this._updateStrands();
    this._updateTrail(this._t1, this.e1t);
    this._updateTrail(this._t2, this.e2t);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initCreatures(ctx) {
  const { scene } = ctx;
  const creatures = Array.from({ length: COUNT }, () => new Creature(scene));
  onTick(() => { for (const c of creatures) c.update(); });
}
