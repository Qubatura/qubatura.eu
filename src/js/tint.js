import * as THREE from 'three';

// Współdzielony stan reakcji sceny na hover działu (Etap 7).
// navigation.js (GSAP) tweenuje pola navFX; atmosphere.js i signet.js czytają je co klatkę.

// Kolory działów — zgodne z --color-events/studio/lab w main.css
export const DIVISION_COLORS = {
  events: new THREE.Color(0x7C3AED),
  studio: new THREE.Color(0x1E90FF),
  lab:    new THREE.Color(0x00E5FF),
};

// Neutralny tint = fioletowa mgła bazowa
export const BASE_TINT = new THREE.Color(0x5B2EFF);

// Kierunek działu w przestrzeni świata — do KONCENTRACJI tintu po danej stronie
export const DIVISION_DIR = {
  events: { x: -1, y:  0 },   // lewo
  studio: { x:  1, y:  0 },   // prawo
  lab:    { x:  0, y: -1 },   // dół
};

// Pochylenie sygnetu „w stronę" działu (radiany, dodawane do dryfu)
export const DIVISION_LEAN = {
  events: { x: 0,    y: -0.32 },  // lewo
  studio: { x: 0,    y:  0.32 },  // prawo
  lab:    { x: 0.30, y:  0    },  // dół (nod)
};

export const navFX = {
  target:    new THREE.Color().copy(BASE_TINT),  // kolor tintu (tweenowany r/g/b)
  intensity: 0,                                   // 0..1 — siła tintu i koloru outline
  dirX: 0, dirY: 0,                               // kierunek koncentracji
  leanX: 0, leanY: 0,                             // pochylenie sygnetu
};
