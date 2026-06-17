import * as THREE from 'three';

// Współdzielony stan reakcji sceny na hover działu (Etap 7).
// navigation.js (GSAP) tweenuje pola navFX; atmosphere.js i signet.js czytają je co klatkę.

// Kolory działów — zgodne z --color-events/studio/lab w main.css
export const DIVISION_COLORS = {
  events: new THREE.Color(0x9D4EDD),   // różowo-fioletowy — wyraźnie odskakuje od ciemnego tła
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

export const navFX = {
  target:    new THREE.Color().copy(BASE_TINT),  // kolor tintu (tweenowany r/g/b)
  intensity: 0,                                   // 0..1 — siła tintu mgły i koloru outline
  dirX: 0, dirY: 0,                               // kierunek koncentracji tintu
  pulse: 0,                                       // „uderzenie serca" — bump skali (0..0.15)
  glow:  0,                                       // intensywność eksplozji glow outline (0..1)
  tugX: 0, tugY: 0,                               // przeskok pozycji w stronę działu (jedn. świata)
  activeDiv: null,                                // id aktywnego działu (dla chmur przy napisach)

  // Tryb podstrony (Etap 10) — sygnet zjeżdża do rogu jako logo. Tweenowane przez router.js.
  pageX: 0, pageY: 0,                             // offset pozycji sygnetu w jedn. świata
  pageScale: 1,                                   // mnożnik skali sygnetu (1 = hero, <1 = logo)
};
