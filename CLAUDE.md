# CLAUDE.md — Instrukcja dla Claude Code
## Projekt: qubatura.eu

Czytasz to pracując lokalnie na MSI. Jesteś głównym budowniczym strony qubatura.eu.
Pracuj na branchu `dev`. Commituj często — każdy działający etap to commit.
Branch `main` = tylko produkcja, nie dotykasz bez wyraźnej zgody.

---

## Pierwsze zadania PRZED budową (setup)

### 1. Wyciągnij sygnet SVG z PDF
```bash
# Inkscape CLI — wyciąga wektory z PDF
inkscape --pdf-poppler assets/source/qubaturalogopoziomblack.pdf \
         --export-plain-svg=assets/source/logo_full.svg

# Sprawdź SVG, zidentyfikuj ścieżki sygnetu vs napis "QUBATURA"
# Usuń ścieżki/tekst napisu, zostaw tylko sygnet (okrąg + fala wewnętrzna + ogon Q)
# Zapisz jako:
assets/signet.svg
```

Sygnet to: okrąg z przerwą (ogon Q), ogon = ukośna linia, wewnątrz = 3 łuki fali + stemmy poziome po bokach.
KRYTYCZNE: użyj oryginalnych ścieżek wektorowych — nie rysuj od nowa.

### 2. Sprawdź assets
```
assets/
├── signet.svg          ← wyciągnięty w kroku 1
├── planet-bg.png       ← tło planety 4K (dostarczone)
├── ref-activetheory.png ← screenshot referencyjny (dostarczone)
└── mockup-v3.html      ← proof of feel (dostarczone)
```

### 3. Obejrzyj referencję
Otwórz `assets/ref-activetheory.png` — to jest wzorzec interakcji i klimatu.
Otwórz `assets/mockup-v3.html` w przeglądarce — to jest proof of feel Qubatury.
Różnica: ActiveTheory = zimny/korporacyjny. Qubatura = organiczny, ciepły, elektryczny.

---

## Struktura projektu

```
qubatura-eu/
├── CLAUDE.md               ← ten plik
├── QUBATURA_PRD_v3.md      ← pełna specyfikacja
├── assets/
│   ├── signet.svg
│   ├── planet-bg.png
│   ├── ref-activetheory.png
│   ├── mockup-v3.html
│   └── source/             ← pliki źródłowe (PDF logo itp.)
├── src/
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── main.js
│   │   ├── scene.js        ← Three.js setup
│   │   ├── creatures.js    ← DNA infinity creatures
│   │   ├── signet.js       ← sygnet 3D
│   │   ├── atmosphere.js   ← mgła + corona
│   │   ├── navigation.js   ← nawigacja kierunkowa
│   │   └── router.js       ← SPA routing
│   └── shaders/
│       ├── fog.frag
│       └── fog.vert
└── pages/
    ├── events.html
    ├── studio.html
    └── lab.html
```

---

## Kolory systemowe — FINALNE

```css
--color-bg:       #0A0A0F;
--color-primary:  #5B2EFF;   /* fiolet główny */
--color-accent:   #E0218A;   /* magenta — akcent marki */
--color-events:   #7C3AED;   /* Events */
--color-studio:   #1E90FF;   /* Studio */
--color-lab:      #00E5FF;   /* Lab */
```

Nigdy nie używaj starych kolorów z PRD v2: #F5A623, #00D4FF, #39FF14.

---

## Kolejność budowy — HOME

Buduj warstwami, każda działa zanim zaczniesz następną:

### Etap 1 — szkielet HTML + CSS
- `index.html` z prawidłową strukturą
- CSS zmienne kolorów
- Fonty: Chakra Petch + Space Mono z Google Fonts
- Canvas fullscreen + overlay divs (nav, topbar, tagline)
- Responsywność podstawowa

### Etap 2 — tło planety
- `planet-bg.png` jako warstwa CSS background lub Three.js plane
- Opacity 15–20%
- Sprawdź czy widoczna ale nie dominuje

### Etap 3 — Three.js scene setup
- Renderer, camera, scene
- Additive blending od razu (kluczowe dla glow creatures)
- Podstawowe oświetlenie ambientowe

### Etap 4 — DNA Infinity Creatures
Patrz sekcja "Creatures" poniżej.
To jest serce wizualne — poświęć czas.

### Etap 5 — Elektryczna atmosfera
- Fog shader (noise/nebula, wolno driftuje)
- Corona discharge (rzadkie błyski, bardzo subtelne)
- Tint sceny przy hover nawigacji

### Etap 6 — Sygnet 3D
- SVGLoader → Shape → ExtrudeGeometry
- Mouse proximity: fiolet → magenta + glow
- Click: burst światła

### Etap 7 — Nawigacja kierunkowa
- Trzy kierunki: Events←, Studio→, Lab↓
- Linia świetlna + napis, BLISKO sygnetu
- Hover: glow neonowy za linią i napisem + tooltip
- Hover: tint całej sceny

### Etap 8 — Topbar + UI
- CONTACT / PL/EN (prawy górny róg)
- Waveform toggle audio (przy CONTACT)
- Tagline "PRZYBYWAMY Z SYGNAŁEM" (dół, center)

### Etap 9 — Loading screen
- Sygnet się materializuje (rysuje/pojawia)
- 1.5–2.5s
- Potem wejście na HOME (GSAP)

### Etap 10 — SPA Routing + podstrony
- History API
- GSAP page transitions
- Podstrony: na starcie czarne tło + kolor dywizji

---

## DNA Infinity Creatures — szczegóły implementacji

### Kształt — lemniskata Lissajous
```javascript
// Parametryczna ósemka
x(t) = cx + RX * Math.sin(t)
y(t) = cy + RY * Math.sin(2 * t) / 2
// t ∈ [0, 2π]
// RX ≈ 100–160px, RY ≈ 60–90px (zróżnicowane per creature)
```

### Normalna do krzywej (do offsetowania nitek)
```javascript
function normal(t, RX, RY) {
  const dx = RX * Math.cos(t);
  const dy = RY * Math.cos(2 * t);
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  return { x: -dy/len, y: dx/len };
}
```

### Dwie orbity
- strand +1 i strand -1 (offset ±8–12px wzdłuż normalnej)
- Brak mostków — tylko dwie czyste linie
- Linie: bardzo cienkie (0.5–1px), --color-primary, opacity 0.3–0.5

### 3D efekt (kluczowe)
W punkcie przecięcia (t ≈ 0 i t ≈ π) jedna linia przechodzi "nad" drugą:
- Three.js: ustaw depthTest + renderOrder na segmentach
- Alternatywnie: rysuj prawą pętlę ostatnią (wyższy renderOrder)

### Elektrony — główny efekt wizualny
```javascript
// Dwa elektrony, przeciwne kierunki
electron1.t += 0.022;   // do przodu
electron2.t -= 0.019;   // do tyłu (lekko inna prędkość)

// Trail (ślad) = ciało stworzenia
// Długość traila: 40–60 punktów
// Alpha: liniowy falloff od elektronu wstecz
// Additive blending: THREE.AdditiveBlending
// Kolor: --color-accent (#E0218A) + glow
```

### Ruch stworków po ekranie
- Każdy stworek ma własne cx, cy (centrum ósemki) które powoli dryfuje
- Łagodne zmiany kierunku (nie gwałtowne)
- Boundary: wrap przy krawędziach viewport

### Hover nawigacji — zmiana koloru
```javascript
// onDivisionHover(divisionColor):
//   - elektrony: kolor traila → divisionColor
//   - mgła: tint → divisionColor
//   - corona: kolor → divisionColor
// Przejście: lerp przez 0.8s
```

---

## Sygnet — implementacja

```javascript
// 1. Załaduj SVG
const loader = new THREE.SVGLoader();
loader.load('assets/signet.svg', (data) => {
  const shapes = data.paths.flatMap(p => p.toShapes(true));

  // 2. Extrude (płaska bryła z głębokością)
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 8,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 0.5
  });

  // 3. Materiał — holograficzny/metaliczny
  const material = new THREE.MeshStandardMaterial({
    color: 0x5B2EFF,
    emissive: 0x5B2EFF,
    emissiveIntensity: 0.3,
    metalness: 0.8,
    roughness: 0.2
  });

  // 4. Mesh
  const mesh = new THREE.Mesh(geometry, material);
  // Wycentruj geometrię
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  mesh.position.sub(center);

  scene.add(mesh);
});
```

Mouse proximity (w animation loop):
```javascript
// dist = odległość kursora od centrum sygnetu
const proximity = Math.max(0, 1 - dist / 200);
material.color.lerpColors(primaryColor, accentColor, proximity);
material.emissiveIntensity = 0.3 + proximity * 0.7;
```

---

## Elektryczna atmosfera

### Mgła (fragment shader)
```glsl
// fog.frag — noise nebula
uniform float time;
uniform vec3 fogColor;
uniform float fogAlpha;

// Simplex noise lub fbm
// Powolny drift: time * 0.0002
// Output: kolor mgły z bardzo niską alpha (0.02–0.06)
```

### Corona discharge
```javascript
// Rzadkie, krótkie błyski
// Timing: losowo co 3–8 sekund
// Kształt: polyline zygzak, 15–35px długości, 4–7 segmentów
// Czas życia: 6–8 klatek (0.1–0.13s przy 60fps)
// Alpha: max 0.2–0.25, gaśnie liniowo
// Kolor: rgba(200, 185, 255, alpha) baseline
//        adoptuje kolor dywizji przy hover
```

---

## Nawigacja kierunkowa

```
Układ:    [sygnet] ──────── EVENTS
          [sygnet] ──────── STUDIO (prawo)
          [sygnet]
              |
              |
            LAB
```

Glow neonowy — WAŻNE:
```css
/* Nie tylko kolor tekstu — prawdziwy neon glow */
.nav-label, .nav-line {
  text-shadow: 0 0 8px currentColor, 0 0 20px currentColor;
  box-shadow: 0 0 8px currentColor, 0 0 20px currentColor;
}
```

Odległość od sygnetu: linia zaczyna się ~10px od krawędzi sygnetu.
Długość linii: ~80–120px (nie do krawędzi ekranu).

---

## Zasady pracy

1. **Commituj po każdym etapie** — nawet jeśli niedokończone
2. **Nie dotykaj main** — tylko dev
3. **Wydajność:** Three.js + additive blending, nie canvas 2D shadowBlur
4. **Mobile:** nawigacja kierunkowa → trzy karty pod sygnetem
5. **"Mniej znaczy więcej"** — jeśli scena jest przytłaczająca, odejmuj
6. **Testuj na pełnym ekranie** — to jest fullscreen experience
7. **Istniejąca strona qubatura.eu nie jest dotykana** — budujemy równolegle

---

## Referencje w assets/

- `ref-activetheory.png` — wzorzec interakcji (NIE kopiuj stylu — inspiruj się mechaniką)
- `mockup-v3.html` — proof of feel Qubatury (kolory, atmsofera, DNA creatures v1)
- `QUBATURA_PRD_v3.md` — pełna specyfikacja

---

## STAN SYGNETU — 2026-06-14

### Co działa (zacommitowane)
- **Creatures tymczasowo ukryte** — `creatures.js` ma flagę `HIDDEN = true`
  (groups `visible=false`, tick nierejestrowany). Kod nietknięty — wrócimy do
  przeprojektowania (fale z mockupu v3). Przywrócenie: flaga na `false`.
- **Pipeline refrakcji sygnetu DZIAŁA** — porzucony `MeshPhysicalMaterial`
  (transmission nie wystarcza na ciemnym tle). Zamiast tego custom shader:
  - `scene.js` — dwuprzebiegowy render loop + `WebGLRenderTarget`:
    Pass 1 renderuje scenę BEZ sygnetu → renderTarget; Pass 2 renderuje całość,
    sygnet próbkuje renderTarget jako `tBackground`. Hook `registerRefraction()`.
  - `signet.js` — `ShaderMaterial`: refrakcja UV przez normalną
    (`refractionStrength 0.03`), chromatic aberration (±0.002 RGB), fresnel rim
    fioletowy, alpha `0.85 + fresnel*0.15`. Krawędzie realnie się rozszczepiają.

### Zrobione w sesji 2026-06-15
- **Planeta przeniesiona do sceny Three.js** (`scene.js`) — `PlaneGeometry(2000×1200)`,
  `MeshBasicMaterial` opacity 0.17, z=-500; top obrazka przyklejony do góry kadru
  (liczone z FOV/pozycji kamery: `viewTop − wys/2`). CSS `#planet-bg` → `display:none`.
  → Pass 1 łapie planetę do renderTarget, sygnet ją REALNIE zagina (PRIORYTET 1 ✅).
- **Refrakcja podbita** — `refractionStrength` 0.03→0.06; planeta w renderTargecie
  (Pass 1) renderowana z opacity 1.0, na ekranie (Pass 2) zostaje 0.17 → jaśniejsza
  „soczewka", a tło dalej subtelne. Przełączanie opacity w `startLoop`.
- **Neon outline sygnetu** (`signet.js`) — linie z subPaths SVG: główny #5B2EFF op.0.7
  + halo ×1.008 #9B6DFF op.0.3. Przejście primary→magenta sterowane kątem (`uColorMix`).
- **Ruch sygnetu** — dryf wielofalowy (niewspółmierne sinusoidy + fazy), kołysanie Y
  ~±20°, float góra-dół, puls skali; +10% rozmiaru bazowego, +25% prędkości.
- **Mgła** (`atmosphere.js`) — staggered breathing: wspólny okres 10s + fazy
  równomierne (`i/10·2π`) → suma jasności ≈ stała, zero skoków kolorytu sceny.
  Dynamika z RUCHU: dryf ~3,5× szybszy + oddychanie rozmiarem ±12%. +10% widoczności.

### BACKLOG — przyszłe etapy
- **Etap: fog noise shader (dym)** — zamienić sprite'y mgły na shader przepływowego
  szumu (fbm/simplex noise) na płaszczyźnie; wolumetryczny dym, który kłębi się
  i przepływa (zamiast nakładanych radialnych blobów). Zalążki: `src/shaders/fog.frag`,
  `src/shaders/fog.vert`. Powód: additive sprite'y to tani trik — szum daje premium feel
  i prawdziwą dynamikę bez modulacji jasności.

---

*CLAUDE.md — qubatura.eu — 2026-06-15*
