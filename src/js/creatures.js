import * as THREE from 'three';
import { onTick } from './scene.js';

const ACCENT   = new THREE.Color(0xE0218A);
const CORE_CLR = new THREE.Color(0x5B2EFF);
const HALO_CLR = new THREE.Color(0x9B7FFF); // lighter for outer glow suggestion
const TRAIL    = 50;
const SEGS     = 200;
const COUNT    = 8;

// ─── Creature ─────────────────────────────────────────────────────────────────

class Creature {
  constructor(scene) {
    // Size: 40% smaller (orig 70-125 / 35-60)
    this.RX  = 42 + Math.random() * 33;  // 42–75
    this.RY  = 21 + Math.random() * 15;  // 21–36
    this.off = 6  + Math.random() * 3;

    this.group = new THREE.Group();
    this.group.position.set(
      (Math.random() - 0.5) * 500,
      (Math.random() - 0.5) * 260,
      (Math.random() - 0.5) * 60
    );
    scene.add(this.group);

    // 3D rotation — unique speed + phase + amplitude on all three axes
    const rp = () => ({ spd: 0.25 + Math.random() * 0.6, ph: Math.random() * Math.PI * 2, amp: 0.65 + Math.random() * 0.7 });
    this.rx = rp(); this.ry = rp(); this.rz = rp();

    // Drift: angle random-walk for organic direction change
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = 0.05 + Math.random() * 0.09;

    // Electrons — opposite directions, slightly different speeds
    this.e1t   = Math.random() * Math.PI * 2;
    this.e2t   = this.e1t + Math.PI;
    this.e1spd = 0.020 + Math.random() * 0.006;
    this.e2spd = 0.017 + Math.random() * 0.006;
    this.e1h   = []; // t-value history (not positions — recomputed each frame in local space)
    this.e2h   = [];

    this._buildStrands();
    this._buildTrails();
  }

  // Lemniscate in local space — group transform handles world position + rotation
  _lpos(t) {
    return [this.RX * Math.sin(t), this.RY * Math.sin(2 * t) / 2, 0];
  }

  _lnormal(t) {
    const dx =  this.RX * Math.cos(t);
    const dy =  this.RY * Math.cos(2 * t);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [-dy / len, dx / len];
  }

  _buildStrands() {
    const N    = SEGS + 1;
    const posA = new Float32Array(N * 3);
    const posB = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      const t        = (i / SEGS) * Math.PI * 2;
      const [x, y]   = this._lpos(t);
      const [nx, ny] = this._lnormal(t);
      const o        = this.off;
      posA[i*3] = x + nx*o;  posA[i*3+1] = y + ny*o;  posA[i*3+2] = 0;
      posB[i*3] = x - nx*o;  posB[i*3+1] = y - ny*o;  posB[i*3+2] = 0;
    }

    const addLine = (src, color, opacity) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(src.slice(), 3));
      this.group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
        color, opacity, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })));
    };

    // Halo pass (softer, lighter) + core pass (vivid) per strand
    addLine(posA, HALO_CLR, 0.22); addLine(posA, CORE_CLR, 0.82);
    addLine(posB, HALO_CLR, 0.22); addLine(posB, CORE_CLR, 0.82);
  }

  _buildTrails() {
    const make = () => {
      const pos   = new Float32Array(TRAIL * 3);
      const color = new Float32Array(TRAIL * 3);
      const geo   = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
      geo.setAttribute('color',    new THREE.BufferAttribute(color, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      line.renderOrder = 5;
      this.group.add(line);
      return { pos, color, geo };
    };
    this._t1 = make();
    this._t2 = make();
  }

  _updateTrail(trail, hist) {
    for (let i = 0; i < TRAIL; i++) {
      if (i < hist.length) {
        const [x, y]     = this._lpos(hist[i]);
        trail.pos[i*3]   = x;
        trail.pos[i*3+1] = y;
        trail.pos[i*3+2] = 0;
      }
      const fade           = Math.pow(1 - i / (TRAIL - 1), 1.5);
      trail.color[i*3]   = ACCENT.r * fade;
      trail.color[i*3+1] = ACCENT.g * fade;
      trail.color[i*3+2] = ACCENT.b * fade;
    }
    trail.geo.attributes.position.needsUpdate = true;
    trail.geo.attributes.color.needsUpdate    = true;
  }

  update(elapsed) {
    // Organic drift — angle slowly wanders
    this.driftAngle += (Math.random() - 0.5) * 0.025;
    this.group.position.x += Math.cos(this.driftAngle) * this.driftSpeed;
    this.group.position.y += Math.sin(this.driftAngle) * this.driftSpeed * 0.5;

    const BW = 370, BH = 220;
    if (this.group.position.x >  BW) this.group.position.x = -BW;
    if (this.group.position.x < -BW) this.group.position.x =  BW;
    if (this.group.position.y >  BH) this.group.position.y = -BH;
    if (this.group.position.y < -BH) this.group.position.y =  BH;

    // 3D rotation — all three axes oscillate simultaneously at different frequencies
    this.group.rotation.x = Math.sin(elapsed * this.rx.spd + this.rx.ph) * this.rx.amp;
    this.group.rotation.y = Math.sin(elapsed * this.ry.spd + this.ry.ph) * this.ry.amp;
    this.group.rotation.z = Math.sin(elapsed * this.rz.spd + this.rz.ph) * this.rz.amp;

    // Advance electrons + push t-value to history
    this.e1t += this.e1spd;
    this.e2t -= this.e2spd;
    this.e1h.unshift(this.e1t); if (this.e1h.length > TRAIL) this.e1h.pop();
    this.e2h.unshift(this.e2t); if (this.e2h.length > TRAIL) this.e2h.pop();

    this._updateTrail(this._t1, this.e1h);
    this._updateTrail(this._t2, this.e2h);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initCreatures(ctx) {
  const { scene } = ctx;
  const creatures = Array.from({ length: COUNT }, () => new Creature(scene));
  onTick((_dt, elapsed) => { for (const c of creatures) c.update(elapsed); });
}
