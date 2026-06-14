import * as THREE from 'three';
import { onTick } from './scene.js';

const PRIMARY = new THREE.Color(0x5B2EFF);
const MID     = new THREE.Color(0x7C3AED);
const ACCENT  = new THREE.Color(0xE0218A);
const SEGS    = 160;
const TRAIL   = 80;
const COUNT   = 15;

// Tymczasowo schowane — wracamy do przeprojektowania (fale z mockupu v3).
// NIE usuwać kodu, tylko ten flag przełączyć na false żeby przywrócić.
const HIDDEN  = true;

let camera;
const mouse = { x: -9999, y: -9999 };
const _wp   = new THREE.Vector3();
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

class Creature {
  constructor(scene) {
    this.RX = 12 + Math.random() * 10;  // 12–22
    this.RY =  6 + Math.random() *  5;  //  6–11

    this.group = new THREE.Group();
    this.group.position.set(
      (Math.random() - 0.5) * 560,
      (Math.random() - 0.5) * 320,
      (Math.random() - 0.5) * 120
    );
    scene.add(this.group);

    // Lazy organic rotation — slow sin, natural pauses at extremes, unique per creature
    const rot = () => ({
      spd: 0.10 + Math.random() * 0.30,  // period 20–63s — genuinely slow
      ph:  Math.random() * Math.PI * 2,
      amp: 0.30 + Math.random() * 0.70,  // 17–57°
    });
    this.rx = rot(); this.ry = rot(); this.rz = rot();

    // Drift
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = 0.03 + Math.random() * 0.09;

    // Two electrons, opposite directions, different speeds
    this.e1t   = Math.random() * Math.PI * 2;
    this.e2t   = this.e1t + Math.PI;
    this.e1spd = 0.026 + Math.random() * 0.012;
    this.e2spd = 0.020 + Math.random() * 0.012;
    this.e1h   = [];  // t-value history — positions recomputed in local space each frame
    this.e2h   = [];

    this.baseTrailOpacity = 0.5;
    this.currentOpacity   = this.baseTrailOpacity;

    this._buildTrack();
    this._buildElectrons();
    this._buildTrails();
  }

  _lpos(t) {
    return [this.RX * Math.sin(t), this.RY * Math.sin(2 * t) / 2, 0];
  }

  // ── Static track — barely visible skeleton ───────────────────────────────────

  _buildTrack() {
    const N = SEGS + 1;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const [x, y] = this._lpos((i / SEGS) * Math.PI * 2);
      pos[i*3] = x;  pos[i*3+1] = y;  pos[i*3+2] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
      color:       PRIMARY,
      transparent: true,
      opacity:     0.12,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    })));
  }

  // ── Electron heads — 3px bright dots ─────────────────────────────────────────

  _buildElectrons() {
    const makeDot = () => {
      const pos = new Float32Array(3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.attributes.position.usage = THREE.DynamicDrawUsage;
      const dot = new THREE.Points(geo, new THREE.PointsMaterial({
        color:           ACCENT,
        size:            3,
        sizeAttenuation: false,
        blending:        THREE.AdditiveBlending,
        depthWrite:      false,
        transparent:     true,
      }));
      this.group.add(dot);
      return { dot, pos };
    };
    this._d1 = makeDot();
    this._d2 = makeDot();
  }

  // ── Trails — the glowing body ─────────────────────────────────────────────────

  _buildTrails() {
    const make = () => {
      const pos = new Float32Array(TRAIL * 3);
      const col = new Float32Array(TRAIL * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      geo.attributes.position.usage = THREE.DynamicDrawUsage;
      geo.attributes.color.usage    = THREE.DynamicDrawUsage;
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        blending:     THREE.AdditiveBlending,
        depthWrite:   false,
        transparent:  true,
        opacity:      this.baseTrailOpacity,
      });
      this.group.add(new THREE.Line(geo, mat));
      return { pos, col, geo, mat };
    };
    this._t1 = make();
    this._t2 = make();
  }

  _updateDot(d, t) {
    const [x, y] = this._lpos(t);
    d.pos[0] = x;  d.pos[1] = y;  d.pos[2] = 0;
    d.dot.geometry.attributes.position.needsUpdate = true;
  }

  _updateTrail(trail, hist) {
    for (let i = 0; i < TRAIL; i++) {
      if (i < hist.length) {
        const [x, y]     = this._lpos(hist[i]);
        trail.pos[i*3]   = x;
        trail.pos[i*3+1] = y;
        trail.pos[i*3+2] = 0;
      }
      // #5B2EFF → #7C3AED, linear brightness falloff
      const fade         = 1 - i / TRAIL;
      const blend        = i / TRAIL;
      trail.col[i*3]   = (PRIMARY.r + (MID.r - PRIMARY.r) * blend) * fade;
      trail.col[i*3+1] = (PRIMARY.g + (MID.g - PRIMARY.g) * blend) * fade;
      trail.col[i*3+2] = (PRIMARY.b + (MID.b - PRIMARY.b) * blend) * fade;
    }
    trail.geo.attributes.position.needsUpdate = true;
    trail.geo.attributes.color.needsUpdate    = true;
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────────

  update(elapsed) {
    // Organic drift — angle random-walk for smooth direction change
    this.driftAngle += (Math.random() - 0.5) * 0.022;
    this.group.position.x += Math.cos(this.driftAngle) * this.driftSpeed;
    this.group.position.y += Math.sin(this.driftAngle) * this.driftSpeed * 0.5;

    const BW = 330, BH = 200;
    if (this.group.position.x >  BW) this.group.position.x = -BW;
    if (this.group.position.x < -BW) this.group.position.x =  BW;
    if (this.group.position.y >  BH) this.group.position.y = -BH;
    if (this.group.position.y < -BH) this.group.position.y =  BH;

    // Lazy 3D rotation — pauses naturally at sin extremes, axes independent
    this.group.rotation.x = Math.sin(elapsed * this.rx.spd + this.rx.ph) * this.rx.amp;
    this.group.rotation.y = Math.sin(elapsed * this.ry.spd + this.ry.ph) * this.ry.amp;
    this.group.rotation.z = Math.sin(elapsed * this.rz.spd + this.rz.ph) * this.rz.amp;

    // Advance electrons
    this.e1t += this.e1spd;
    this.e2t -= this.e2spd;

    this._updateDot(this._d1, this.e1t);
    this._updateDot(this._d2, this.e2t);

    this.e1h.unshift(this.e1t); if (this.e1h.length > TRAIL) this.e1h.pop();
    this.e2h.unshift(this.e2t); if (this.e2h.length > TRAIL) this.e2h.pop();

    // Mouse proximity — lerp trail brightness toward 1.0 on hover
    _wp.copy(this.group.position).project(camera);
    const sx     = (_wp.x + 1) / 2 * window.innerWidth;
    const sy     = (1 - _wp.y) / 2 * window.innerHeight;
    const target = Math.hypot(mouse.x - sx, mouse.y - sy) < 200
      ? 1.0
      : this.baseTrailOpacity;
    this.currentOpacity     += (target - this.currentOpacity) * 0.08;
    this._t1.mat.opacity     = this.currentOpacity;
    this._t2.mat.opacity     = this.currentOpacity;

    this._updateTrail(this._t1, this.e1h);
    this._updateTrail(this._t2, this.e2h);
  }
}

export function initCreatures(ctx) {
  camera = ctx.camera;
  const { scene } = ctx;
  const creatures = Array.from({ length: COUNT }, () => new Creature(scene));
  if (HIDDEN) { for (const c of creatures) c.group.visible = false; return; }
  onTick((_dt, elapsed) => { for (const c of creatures) c.update(elapsed); });
}
