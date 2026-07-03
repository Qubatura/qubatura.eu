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
  nudgeRotY: 0, nudgeRotX: 0,                     // cykliczny zwrot sygnetu ku dywizji (navigation.js)
  activeDiv: null,                                // id aktywnego działu (dla chmur przy napisach)

  // Tryb podstrony (Etap 10) — sygnet zjeżdża do rogu jako logo. Tweenowane przez router.js.
  pageX: 0, pageY: 0, pageZ: 0,                    // offset pozycji sygnetu w jedn. świata
  pageScale: 1,                                   // mnożnik skali sygnetu (1 = hero, <1 = logo)
};

// ─── Etap 9 — loading screen ──────────────────────────────────────────────────
// Sterowane przez loader.js, czytane przez signet.js (loadFX) oraz scene.js +
// atmosphere.js (sceneFX). Loading i scena to ten sam canvas — sygnet jest wskaźnikiem
// progresu, a po 100% bez cięcia staje się żywym sygnetem HOME.
// Etap 9 loading — bohaterem jest SYGNET 3D na canvasie (ten sam co HOME, to samo miejsce).
// 0→100% = jeden pełny obrót (loadFX.spin), a świat składa się wokół niego wraz z progresem:
// najpierw mgła, potem miasto/planeta (sceneFX.fog/planet). UI wjeżdża dopiero na finał.
export const loadFX = {
  active:     false, // true przez całą sekwencję loadingu
  ramping:    false, // true tylko w Fazie 1 — loader.js wygładza progress→target
  progress:   0,     // 0..1 — wygładzony progres (steruje obrotem, światem i licznikiem %)
  target:     0,     // 0..1 — realny ułamek wczytanych zasobów (Promise tracking)
  spin:       0,     // radiany — obrót Y sygnetu (progress * 2π = jeden pełny obrót)
  spinWeight: 0,     // 0..1 — ile obrotu vs idle (1 w loadingu, →0 przy osiadaniu w HOME)
  scale:      1,     // mnożnik skali — krok ku kamerze przy whipie finałowym
  charge:     1,     // 0..1 — „wlewanie koloru": 0 = czyste szkło, 1 = pełny primary (= progress)
  revealed:   true,  // true = świetliki mogą się rozjaśniać (bloom). Loader ustawia false na start,
                     // a true W MOMENCIE wjazdu nawigacji (nie na końcu 3.2s osiadania) → bez późnego popu.
};

// Bramki ujawniania sceny — etapowe (pkt 4). W normalnej pracy oba = 1.
export const sceneFX = {
  fog:    1,         // 0..1 — mgła + corona (atmosphere.js). Ujawnia się PIERWSZA.
  planet: 1,         // 0..1 — planeta/miasto (scene.js). Ujawnia się PÓŹNIEJ.
};
