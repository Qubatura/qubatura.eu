import * as THREE from 'three';
import { onTick } from './scene.js';

const PRIMARY = new THREE.Color(0x5B2EFF);
const ACCENT  = new THREE.Color(0xE0218A);
const SEGS    = 220;   // segments per full lemniscate
const TRAIL_E = 22;    // electron trail length
const COUNT   = 8;

// ─── Creature ─────────────────────────────────────────────────────────────────

class Creature {
  constructor(scene) {
    this.RX   = 40 + Math.random() * 30;              // 40–70
    this.RY   = 20 + Math.random() * 20;              // 20–40
    this.nFil = 5 + Math.floor(Math.random() * 4);    // 5–8 filaments
    this.fOff = 3 + Math.random() * 2;                // 3–5 px offset from axis
    this.twist = 6 + Math.random() * 4;               // helical rotations per full loop

    this.group = new THREE.Group();
    this.group.position.set(
      (Math.random() - 0.5) * 500,
      (Math.random() - 0.5) * 260,
      (Math.random() - 0.5) * 80
    );
    scene.add(this.group);

    // 3D rotation — unique per creature, all three axes
    const rp = () => ({ spd: 0.22 + Math.random() * 0.55, ph: Math.random() * Math.PI * 2, amp: 0.60 + Math.random() * 0.75 });
    this.rx = rp(); this.ry = rp(); this.rz = rp();

    // Organic drift via angle random-walk
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = 0.04 + Math.random() * 0.08;

    // Electrons — opposite directions on backbone
    this.e1t   = Math.random() * Math.PI * 2;
    this.e2t   = this.e1t + Math.PI;
    this.e1spd = 0.022 + Math.random() * 0.007;
    this.e2spd = 0.019 + Math.random() * 0.007;
    this.e1h   = []; // t-value history (recomputed in local space each frame)
    this.e2h   = [];

    this._buildFilaments();
    this._buildTrails();
  }

  // ── Lemniscate backbone in local space ──────────────────────────────────────

  _backbone(t) {
    return [
      this.RX * Math.sin(t),
      this.RY * Math.sin(2 * t) / 2,
      0,
    ];
  }

  // Frenet frame — for flat XY curve: N = CCW-perp of tangent, B = (0,0,1)
  _frame(t) {
    const dx  =  this.RX * Math.cos(t);
    const dy  =  this.RY * Math.cos(2 * t);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { Nx: -dy / len, Ny: dx / len }; // Binormal is always (0,0,1) for flat curve
  }

  // ── Filament geometry — built ONCE, static (group handles all transforms) ───

  _buildFilaments() {
    const N = SEGS + 1;

    for (let fi = 0; fi < this.nFil; fi++) {
      const phase = (fi / this.nFil) * Math.PI * 2;
      const pos   = new Float32Array(N * 3);
      const col   = new Float32Array(N * 3);

      for (let i = 0; i < N; i++) {
        const t          = (i / SEGS) * Math.PI * 2;
        const [bx, by]   = this._backbone(t);
        const { Nx, Ny } = this._frame(t);

        const angle = phase + this.twist * t;
        const cosA  = Math.cos(angle);
        const sinA  = Math.sin(angle);
        const off   = this.fOff;

        // offset = cosA * N + sinA * B  where B = (0,0,1)
        pos[i*3]   = bx + off * cosA * Nx;
        pos[i*3+1] = by + off * cosA * Ny;
        pos[i*3+2] =      off * sinA;       // depth from binormal

        // Gradient: ACCENT (magenta) at crossings, PRIMARY (violet) at loop peaks
        // |sin(t)| = 0 at t=0,π (center) → blend=1 → magenta
        // |sin(t)| = 1 at t=π/2,3π/2 (extremes) → blend=0 → violet
        const blend  = 1 - Math.abs(Math.sin(t));
        col[i*3]   = PRIMARY.r + (ACCENT.r - PRIMARY.r) * blend;
        col[i*3+1] = PRIMARY.g + (ACCENT.g - PRIMARY.g) * blend;
        col[i*3+2] = PRIMARY.b + (ACCENT.b - PRIMARY.b) * blend;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

      this.group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent:  true,
        opacity: 0.70 + Math.random() * 0.25, // slight per-filament variation
        blending:     THREE.AdditiveBlending,
        depthWrite:   false,
      })));
    }
  }

  // ── Electron trails — updated every frame in local space ────────────────────

  _buildTrails() {
    const make = () => {
      const pos = new Float32Array(TRAIL_E * 3);
      const col = new Float32Array(TRAIL_E * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      geo.attributes.position.usage = THREE.DynamicDrawUsage;
      geo.attributes.color.usage    = THREE.DynamicDrawUsage;
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        vertexColors: true,
        blending:     THREE.AdditiveBlending,
        depthWrite:   false,
        transparent:  true,
      }));
      line.renderOrder = 10;
      this.group.add(line);
      return { pos, col, geo };
    };
    this._t1 = make();
    this._t2 = make();
  }

  _updateTrail(trail, hist) {
    for (let i = 0; i < TRAIL_E; i++) {
      if (i < hist.length) {
        const [x, y]      = this._backbone(hist[i]);
        trail.pos[i*3]   = x;
        trail.pos[i*3+1] = y;
        trail.pos[i*3+2] = 0;
      }
      // Brightness falloff — boosted so head appears hyper-luminous
      const fade         = Math.pow(1 - i / (TRAIL_E - 1), 1.3);
      trail.col[i*3]   = Math.min(1, ACCENT.r * fade * 1.8);
      trail.col[i*3+1] = Math.min(1, ACCENT.g * fade * 1.8);
      trail.col[i*3+2] = Math.min(1, ACCENT.b * fade * 1.8);
    }
    trail.geo.attributes.position.needsUpdate = true;
    trail.geo.attributes.color.needsUpdate    = true;
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  update(elapsed) {
    // Smooth direction change via angle random-walk
    this.driftAngle += (Math.random() - 0.5) * 0.025;
    this.group.position.x += Math.cos(this.driftAngle) * this.driftSpeed;
    this.group.position.y += Math.sin(this.driftAngle) * this.driftSpeed * 0.5;

    const BW = 380, BH = 230;
    if (this.group.position.x >  BW) this.group.position.x = -BW;
    if (this.group.position.x < -BW) this.group.position.x =  BW;
    if (this.group.position.y >  BH) this.group.position.y = -BH;
    if (this.group.position.y < -BH) this.group.position.y =  BH;

    // 3D rotation — all three axes, sinusoidal, unique per creature
    this.group.rotation.x = Math.sin(elapsed * this.rx.spd + this.rx.ph) * this.rx.amp;
    this.group.rotation.y = Math.sin(elapsed * this.ry.spd + this.ry.ph) * this.ry.amp;
    this.group.rotation.z = Math.sin(elapsed * this.rz.spd + this.rz.ph) * this.rz.amp;

    // Advance electrons + push t to history
    this.e1t += this.e1spd;
    this.e2t -= this.e2spd;
    this.e1h.unshift(this.e1t); if (this.e1h.length > TRAIL_E) this.e1h.pop();
    this.e2h.unshift(this.e2t); if (this.e2h.length > TRAIL_E) this.e2h.pop();

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
