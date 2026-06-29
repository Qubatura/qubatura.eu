import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { onTick, registerRefraction } from './scene.js';
import { navFX, loadFX } from './tint.js';

const _mouse = { x: -9999, y: -9999 };
window.addEventListener('mousemove', e => { _mouse.x = e.clientX; _mouse.y = e.clientY; });

// Balans percepcyjny glow per dział — kompensuje różną jasność barw działów
// (cyan Lab świeci „glary", fioletowy Events ciemniejszy). NIE zmienia HEX-ów nigdzie
// indziej (nav/tint/HUD) — to wyłącznie mnożnik JASNOŚCI koloru poświaty sygnetu.
// (Mnożnik na opacity nie działał: klipuje się do 1; jasność daje czysty zakres.)
// Cel: wszystkie ~równe, lekko poniżej Studio (środek między Events a Studio).
const GLOW_GAIN = { events: 1.15, studio: 1.15, lab: 0.30 };

// Siła „łapania barwy" działu przez sygnet — DOPASOWANA do mgły. atmosphere.js miesza
// barwę mgły ku kolorowi działu z siłą intensity * 0.4 (uTintIntensity * 0.4 we frag).
// Sygnet łapał ją z pełną siłą (intensity = 1.0) → świecił mocniej i bardziej kolorowo
// niż mgła („każdy efekt na swoją rękę"). Tu zbliżamy oba glow do siebie: ten sam kolor,
// podobna siła — mgła i sygnet „świecą" razem.
const TINT_MATCH = 0.4;

// Glow = rozmyta tekstura-sylwetka na planie (zamiast stosu linii). Premultiplied
// additive + dithering (IGN) — gładki blask bez banding/ziarna i bez „technicznych" obrysów.
const GLOW_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const GLOW_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uMap;
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float m   = texture2D(uMap, vUv).a;                  // rozmyta sylwetka (alpha)
    float n   = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3  col = uColor * (m * uOpacity) + (n - 0.5) / 255.0;   // ±0.5 LSB dither
    float a   = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`;

export async function initSignet(ctx) {
  const { scene, renderer } = ctx;

  // ─── Load SVG ──────────────────────────────────────────────────────────────
  const loader = new SVGLoader();
  let data;
  try {
    data = await new Promise((resolve, reject) =>
      loader.load('../assets/signet.svg', resolve, undefined, reject)
    );
  } catch (e) {
    console.warn('signet.svg failed to load', e);
    return;
  }

  // ─── Build shapes ──────────────────────────────────────────────────────────
  const shapes = data.paths.flatMap(p => SVGLoader.createShapes(p));
  if (!shapes.length) return;

  // Bounding box — więcej punktów żeby cieniutkie fragmenty (ogon Q) nie uciekły
  const bb = new THREE.Box2();
  for (const s of shapes) {
    for (const p of s.getPoints(64)) bb.expandByPoint(p);
  }
  const svgCX  = (bb.min.x + bb.max.x) / 2;
  const svgCY  = (bb.min.y + bb.max.y) / 2;
  const svgMax = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
  // Mobile: sygnet-bohater +20% (jedyny element 3D na rzadkim ekranie — może dominować).
  const SIZE_MUL = window.innerWidth <= 768 ? 1.2 : 1.0;
  const S      = (51.4 * 1.1 * SIZE_MUL) / svgMax;   // +10% bazowo, ×1.2 na mobile

  // ─── Material — custom GLSL: refrakcja tła + chromatic aberration + fresnel ──
  // uResolution: rozmiar drawing buffer w pikselach fizycznych — używane w shaderze do
  // obliczenia screen-space UV przez gl_FragCoord (bardziej stabilne niż vClip na mobile).
  const dbSize = new THREE.Vector2();
  renderer.getDrawingBufferSize(dbSize);
  window.addEventListener('resize', () => renderer.getDrawingBufferSize(dbSize));

  const uniforms = {
    tBackground:        { value: null },   // wstrzykiwane co klatkę przez scene.js
    refractionStrength: { value: 0.06 },   // siła zagięcia planety (do tuningu)
    time:               { value: 0 },
    uColorMix:          { value: 0 },      // 0 = primary, 1 = magenta (sterowane kątem)
    uGlass:             { value: 0 },      // 0 = normalny tint, 1 = czyste szkło (hover sygnetu, brak działu)
    uDivColor:          { value: new THREE.Vector3(0.35, 0.18, 1.0) },  // kolor aktywnej dywizji (default = primary)
    uDivMix:            { value: 0 },      // siła blendowania barwy dywizji do tintu ciała sygnetu
    uResolution:        { value: dbSize }, // drawing buffer size — potrzebne do gl_FragCoord UV
    // Mobile: wypełnienie ciała — refrakcja ciemnego nieba dawała czarne wnętrze. ZMNIEJSZONE
    // (0.18→0.16, C6): płaski tint to GŁÓWNE źródło „matowości" frontu — mniej flat fill =
    // więcej widać refrakcję/szkło; flat fill zastępujemy ŻYWĄ opalescencją + sheenem szkła.
    // Niżej nie schodzę: to podłoga chroniąca przed czernieniem wnętrza w trough'ach płynu.
    // Desktop: 0 (refrakcja wieży sama).
    uBaseFill:          { value: window.innerWidth <= 768 ? 0.16 : 0.0 },
    // Mobile: podłoga „szkła" w spoczynku — utrzymuje pryzmatyczny rant + chromatic aberration
    // jak podczas ładowania. PODBITA (0.42→0.52, C1) → rekompensuje niższy uBaseFill: mniej
    // matowego wypełnienia, więcej szklanych krawędzi/refleksów. NIE dotyka glowHide. Desktop=0.
    uGlassFloor:        { value: window.innerWidth <= 768 ? 0.52 : 0.0 },
    // Mnożnik opalizującego płynu (A2/B2): mobile mocniej — matowy sygnet nad ciemnym tłem
    // potrzebuje więcej „mienienia się"; desktop refraktuje jasną wieżę i ma dość naturalnie.
    // PODBITY (1.9→2.2, C6): żywa opalescencja zastępuje ścięty flat fill (uBaseFill↓) —
    // bryła „mieni się płynem" zamiast matowego tintu = mniej matu, bardziej szkło na froncie.
    uOpal:              { value: window.innerWidth <= 768 ? 2.2 : 1.0 },
    // Barwa krawędziowego rozświetlenia (rant fresnela). Desktop: ciepły lawendowo-biały.
    // Mobile (C5): WYRAŹNIE fioletowy (0.78,0.74→0.52,0.40), nie biały. Mobile ma uGlassFloor=0.52
    // → rant >2× jaśniejszy niż desktop w spoczynku; prawie biały uEdgeWarm robił z bryły
    // „matowo-białą frosted", nie szkło. Saturujemy ku primary = mniej bieli, więcej koloru.
    uEdgeWarm:          { value: window.innerWidth <= 768
                            ? new THREE.Vector3(0.52, 0.40, 1.0)
                            : new THREE.Vector3(0.88, 0.76, 1.0) },
    // Bazowa nieprzezroczystość ciała. Mobile (C1): niższa = więcej przezroczystego szkła
    // (refrakcja/glow prześwitują) → mniej „solidnej" matowej bryły, bliżej desktopu. Desktop=0.85.
    uBodyAlpha:         { value: window.innerWidth <= 768 ? 0.80 : 0.85 },
    // Ściągnięcie BARWY ku czystemu primary (C7). Mobile nad ciemnym tłem czytał się różowo —
    // ciepłe człony tint/opal wzmacniają czerwony lean primary #5B2EFF, a brak jasnej refrakcji
    // wieży (jak na desktopie) tego nie chłodzi. Na mobile mamy JEDEN kolor = musi być primary,
    // więc całą bryłę pociągamy: mniej R, lekko więcej B (siła niżej w shaderze). Desktop=0 (idealny).
    uPrimaryShift:      { value: window.innerWidth <= 768 ? 0.7 : 0.0 },
  };

  // Na mobile szyba zagina mocniej — przy ciemnym tle subtelne 0.06 jest niewidoczne.
  // PODBITE (0.18→0.20, C5): więcej refrakcji tła = mocniejsza dystorsja „butelki" zamiast flat fill.
  if (window.innerWidth <= 768) uniforms.refractionStrength.value = 0.20;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vNormal     = normalize(normalMatrix * normal);
        vWorldPos   = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;   /* iOS Safari domyślnie mediump — za mała precyzja dla gl_FragCoord na 3× DPR */
      uniform sampler2D tBackground;
      uniform float refractionStrength;
      uniform float time;
      uniform float uColorMix;
      uniform float uGlass;
      uniform vec3  uDivColor;
      uniform float uDivMix;
      uniform vec2  uResolution;
      uniform float uBaseFill;
      uniform float uGlassFloor;
      uniform float uOpal;
      uniform vec3  uEdgeWarm;
      uniform float uBodyAlpha;
      uniform float uPrimaryShift;

      varying vec3 vNormal;
      varying vec3 vWorldPos;

      void main() {
        // Screen-space UV przez gl_FragCoord — stabilniejsze na mobile niż vClip interpolacja.
        // gl_FragCoord.y=0 u dołu; renderTarget z flipY=false też ma Y=0 u dołu → brak flipu.
        vec2 vScreenPos = gl_FragCoord.xy / uResolution;

        // Fresnel — krawędzie bardziej widoczne. MUSI być policzony PRZED shimmer/CA, które go
        // używają. Wcześniej deklarowany niżej a użyty tu → use-before-declaration = błąd
        // kompilacji frag shadera → CAŁE ciało sygnetu nie renderowało się (zostawał płaski
        // outline + glow). To była przyczyna „płaskiego SVG" na mobile i desktopie.
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);

        // Wewnętrzna animacja szkła — falowanie UV tworzy ruch w centrum nawet na ciemnym tle.
        // Amplituda rośnie tam gdzie fresnel mały (centrum bryły), a maleje przy krawędziach.
        float shimmerAmt = (1.0 - fresnel) * 0.008;
        float sx = sin(vWorldPos.x * 1.4 + time * 0.55) * shimmerAmt;
        float sy = sin(vWorldPos.y * 1.1 + time * 0.42 + 1.5) * shimmerAmt;
        // Zagięcie UV przez normalną (refrakcja) + subtelny shimmer
        vec2 refractedUV = vScreenPos + vNormal.xy * refractionStrength + vec2(sx, sy);

        // Chromatic aberration — rozszczepianie RGB. Rośnie ku krawędziom w trybie szkła
        // (uGlass) → pryzmatyczny, tęczowy rozkład światła na krawędziach.
        float glassEdge = max(uGlass, uGlassFloor);   // rant/CA trzymają „szkło" też po loadingu (mobile)
        float ca = 0.002 + glassEdge * fresnel * 0.010;
        float r = texture2D(tBackground, refractedUV + vec2(ca, 0.0)).r;
        float g = texture2D(tBackground, refractedUV).g;
        float b = texture2D(tBackground, refractedUV - vec2(ca, 0.0)).b;
        vec3 refr = vec3(r, g, b);   // zagięte tło (czerń podczas loadingu)

        // ── Blinn-Phong specular — fioletowy refleks (primary) od światła góra-przód ──
        vec3 lightPos = vec3(200.0, 300.0, 400.0);
        vec3 toLight  = normalize(lightPos - vWorldPos);
        vec3 toCamera = normalize(cameraPosition - vWorldPos);
        vec3 halfVec  = normalize(toLight + toCamera);
        // Specular MIĘKSZY (C4): wykładnik 64→28 = szerszy, łagodniejszy refleks (światło
        // „ślizga się" po powierzchni zamiast punktowego rozbłysku); siła 2.5→1.7 = mniej hot-spota.
        float spec    = pow(max(dot(vNormal, halfVec), 0.0), 28.0);
        vec3 specColor = vec3(0.5, 0.3, 1.0) * spec * 1.7;

        // ── Sheen szkła na FRONCIE (C6) — refleks tam gdzie fresnel niski (twarz bryły) ──
        // Front patrzy w kamerę → fresnel≈0 → cała „szklistość" (rant/CA) go omijała = mat.
        // Szeroki wykładnik (8) daje miękki, rozległy połysk po froncie = tafla szkła odbija
        // światło, nie płaski tint. Primary-niebieski (nie biały/różowy). Gated uGlassFloor →
        // desktop=0 (bez zmian), mobile rośnie z „podłogą szkła". (colorAmt domnożony NIŻEJ —
        // tu jeszcze nie istnieje; jego użycie tu = use-before-declaration = błąd kompilacji.)
        float sheen   = pow(max(dot(vNormal, halfVec), 0.0), 8.0);
        vec3  sheenCol = vec3(0.40, 0.34, 0.95) * sheen * uGlassFloor * 0.35;

        // Przejście primary → magenta sterowane kątem/hoverem (uColorMix).
        // Magenta = AKCENT: stonowana (mniej czerwieni) i sięga max ~akcentu, baza trzyma primary.
        // C1/C3: przesunięta z różu ku elektrycznemu fioletowi (0.80,0.20,0.70 → 0.58,0.20,0.92) —
        // mniej magenty w całej estetyce (mobile bryła + desktop akcenty), bliżej primary.
        vec3 cPrimary = vec3(0.35, 0.18, 1.0);
        vec3 cMagenta = vec3(0.58, 0.20, 0.92);
        vec3 tint     = mix(cPrimary, cMagenta, uColorMix);
        tint          = mix(tint, uDivColor, uDivMix);   // kolor aktywnej dywizji (np. cyjan Lab)

        // Tryb szkła (uGlass): wygaszamy barwny tint, zostawiając refrakcję + białe
        // pryzmatyczne krawędzie. Poza szkłem: pełny barwny tint + refleks.
        float colorAmt = 1.0 - uGlass;
        vec3  color = refr;
        color += specColor * colorAmt;
        color += sheenCol * colorAmt;   // C6: szklany połysk na froncie (mobile, gated uGlassFloor)
        color += tint * 0.4 * colorAmt;
        // Wypełnienie ciała glassem: tint NIEZALEŻNY od tła ORAZ od trybu szkła (BEZ colorAmt) —
        // wcześniej *colorAmt zerowało wypełnienie w trybie szkła/ładowania, czyli dokładnie gdy
        // było potrzebne → czarne wnętrze + glass tylko na obrysie. Teraz CAŁA bryła jest z
        // fioletowego szkła, nigdy czarna; refleks/fresnel/refrakcja zostają na wierzchu.
        // Desktop uBaseFill=0 → bez zmian. (BRIEF 15 #1/#4)
        color += tint * uBaseFill;
        // ── Opalizujący płyn wewnątrz szkła (A2) ──────────────────────────────────
        // Sygnet ma wyglądać jak bryła wypełniona mieniącą się substancją, nie jak
        // pusty obrys. Dwa niewspółmierne wiry → ruchoma „gęstość" płynu; iryzacja
        // trzymana w rodzinie primary→jasny fiolet (NIGDY magenta) = drogie szkło.
        // C4 — „woda w szklanej butelce": niższe częstotliwości wirów (0.95/0.55→0.50/0.30,
        // 1.25/0.40→0.66/0.24) = większe, gładsze komórki płynu, mniej węzłów = łagodniejsze
        // przejścia jasności, światło ślizga się po całej powierzchni zamiast drobić na plamki.
        float swirl1 = sin(vWorldPos.x * 0.50 + vWorldPos.y * 0.30 + time * 0.40);
        float swirl2 = sin(vWorldPos.y * 0.66 - vWorldPos.x * 0.24 - time * 0.30 + 2.1);
        float opal   = 0.5 + 0.5 * swirl1 * swirl2;                 // 0..1 ruchoma substancja
        // C6: jasny koniec iryzacji SCHŁODZONY (0.55,0.45→0.42,0.38) — ciepły fiolet czytał się
        // różowo na froncie (gdzie opal dominuje przy uOpal↑); bliżej primary = mniej różu.
        vec3  opalCol = mix(cPrimary, vec3(0.42, 0.38, 1.0), opal); // refleksy w primary/jasny fiolet
        // Widoczna w głębi bryły (niski fresnel); gaśnie z colorAmt → podczas loadingu
        // wlewa się wraz z „nasiąkaniem" szkła, w trybie czystego szkła ustępuje refrakcji.
        color += opalCol * opal * 0.16 * (1.0 - fresnel) * colorAmt * uOpal;
        // „Plasma" (drobne migotanie) — GŁÓWNE źródło pstrokatych plamek przez wysokie freq.
        // C4: częstotliwości 1.5/1.2→0.80/0.62 (większe plamy) + waga 0.06→0.03 (ledwo widoczne)
        // → jednolita, płynna refrakcja zamiast punktowych rozbłysków.
        float plasma = 0.5 + 0.5 * sin(vWorldPos.x * 0.80 + time * 0.6) * sin(vWorldPos.y * 0.62 - time * 0.45 + 1.8);
        color += tint * plasma * 0.03 * (1.0 - fresnel) * colorAmt;
        color += tint * fresnel * 0.5 * colorAmt;
        // Stałe krawędziowe oświetlenie — widoczne niezależnie od tła i trybu szkła.
        // Idle: delikatna jasna krawędź (bryłowatość na ciemnym mobile bg).
        // Szkło: silniejsze, pryzmatyczne (+0.50). Barwa = uEdgeWarm (mobile chłodniejsza, C1).
        color += uEdgeWarm * fresnel * (0.22 + glassEdge * 0.50);

        // C7 — korekta hue ku czystemu primary (mobile). Ściąga czerwień (rose) i lekko podnosi
        // niebieski → bryła czyta się jak brandowy primary #5B2EFF, nie różowo. Pełna siła
        // mnoży R×0.74 / G×0.94 / B×1.05; faktyczna siła = uPrimaryShift (mobile 0.7). Desktop=0.
        color = mix(color, color * vec3(0.74, 0.94, 1.05), uPrimaryShift);

        gl_FragColor = vec4(color, uBodyAlpha + fresnel * 0.15);
      }
    `,
  });

  // ─── Geometry — bevel mały żeby nie pożerał cienkich fragmentów ogona Q ───
  const group  = new THREE.Group();
  const depth  = 4.5 / S;   // grubsza bryła — wyraźniej widać 3D przy obrocie (było 3)
  // bevelSize 0.25wu w przestrzeni świata → ~6 jedn. SVG → nie niszczy detali
  const bevel  = 0.25 / S;

  for (const shape of shapes) {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled:   true,
      bevelThickness: bevel,
      bevelSize:      bevel,
      bevelSegments:  4,
      curveSegments:  32,   // gładsze krzywe SVG → lepsze przybliżenie krawędzi
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-svgCX, -svgCY, -depth / 2);
    group.add(mesh);
  }

  // ─── Ostry kontur — neon wzdłuż krawędzi (LineBasicMaterial) ──────────────
  // Daje czytelność kształtu w idle; rozlany blask robi osobny sprite (niżej).
  const outlineParts = [];   // { glow, base, baseOpacity, apply(color, opacity) }
  function buildOutline(scaleMul, hex, opacity, renderOrder) {
    const og  = new THREE.Group();
    const lmat = new THREE.LineBasicMaterial({
      color: hex, transparent: true, opacity, depthWrite: false, blending: THREE.NormalBlending,
    });
    outlineParts.push({ glow: false, base: new THREE.Color(hex), baseOpacity: opacity,
      apply: (c, o) => { lmat.color.copy(c); lmat.opacity = o; } });
    for (const path of data.paths) {
      for (const sub of path.subPaths) {
        const pts = sub.getPoints(128);
        const arr = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
          arr[i * 3]     = pts[i].x - svgCX;
          arr[i * 3 + 1] = pts[i].y - svgCY;
          arr[i * 3 + 2] = 0;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const line = new THREE.Line(geo, lmat);
        line.renderOrder = renderOrder;
        og.add(line);
      }
    }
    og.position.z = depth * 0.52;   // tuż przed czołem bryły (czoło @ depth/2)
    og.scale.setScalar(scaleMul);
    return og;
  }

  // ─── Glow = rozmyta sylwetka sygnetu na planie (zamiast stosu linii) ───────
  // Sylwetkę (z dziurami SVG) renderujemy na canvas, rozmywamy ctx.filter blur,
  // → CanvasTexture na kwadratowym planie. Materiał tinту i ditheringu jest w GLOW_FRAG.
  const CANVAS = 512;
  // FILL = ułamek canvasu zajęty przez SYGNET (reszta = margines na blur). UWAGA: działa
  // odwrotnie do „ile blasku" — niższy FILL = większy margines = SZERSZY rozlew w świecie
  // (rozlew ∝ blur/FILL). 0.48 daje oddech bez obcinania przy krawędzi planu.
  const FILL   = 0.48;
  const sc     = (CANVAS * FILL) / svgMax;  // skala SVG → canvas px
  const spanSVG = svgMax / FILL;            // bok planu w jedn. SVG (= cały canvas)

  // Path2D sylwetki (outer + holes, even-odd) we współrzędnych canvasu
  const toCx = p => ({ x: CANVAS / 2 + sc * (p.x - svgCX), y: CANVAS / 2 + sc * (p.y - svgCY) });
  const path2d = new Path2D();
  const addContour = (pts) => {
    pts.forEach((p, i) => { const c = toCx(p); i ? path2d.lineTo(c.x, c.y) : path2d.moveTo(c.x, c.y); });
    path2d.closePath();
  };
  for (const s of shapes) {
    addContour(s.getPoints(200));
    for (const h of (s.holes || [])) addContour(h.getPoints(200));
  }

  function makeGlowTexture(blurPx) {
    const c1 = document.createElement('canvas'); c1.width = c1.height = CANVAS;
    const x1 = c1.getContext('2d');
    x1.fillStyle = '#fff';
    x1.fill(path2d, 'evenodd');                 // biała sylwetka (alpha = kształt)
    const c2 = document.createElement('canvas'); c2.width = c2.height = CANVAS;
    const x2 = c2.getContext('2d');
    x2.filter = `blur(${blurPx}px)`;
    x2.drawImage(c1, 0, 0);                      // rozmycie
    const tex = new THREE.CanvasTexture(c2);
    tex.flipY = false;                          // plan jest dzieckiem group (scale.y = -S) → bez flipY
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function addGlowSprite(tex, hex, opacity, renderOrder) {
    const gmat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color(hex) }, uOpacity: { value: opacity } },
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(spanSVG, spanSVG), gmat);
    plane.position.z = depth * 0.52;
    plane.renderOrder = renderOrder;
    group.add(plane);
    outlineParts.push({ glow: true, base: new THREE.Color(hex), baseOpacity: opacity,
      apply: (c, o) => { gmat.uniforms.uColor.value.copy(c); gmat.uniforms.uOpacity.value = o; } });
  }

  // szeroki, miękki bloom + ciaśniejszy jaśniejszy rdzeń poświaty + ostry kontur
  // Mobile: więcej blasku (×1.1) — poświata bohatera mocniejsza na rzadkim ekranie.
  // ŚCIĘTE (1.3→1.1, C5): jasny lawendowy bloom ×1.3 dokładał się do „białości" bryły na mobile.
  const _glowMul = window.innerWidth <= 768 ? 1.1 : 1.0;
  addGlowSprite(makeGlowTexture(48), 0x5B2EFF, 0.55 * _glowMul, 6);   // szersza warstwa — więcej oddechu
  addGlowSprite(makeGlowTexture(14), 0x9B8CFF, 0.95 * _glowMul, 7);
  group.add(buildOutline(1.0, 0x9B8CFF, 0.90, 8));   // ostry rdzeń (czytelność idle)

  group.scale.set(S, -S, S);

  // ─── Pivot ─────────────────────────────────────────────────────────────────
  const pivot = new THREE.Group();
  pivot.add(group);
  scene.add(pivot);

  // Pętla renderuje teraz w dwóch przebiegach: tło → renderTarget, potem sygnet
  registerRefraction(pivot, mat);

  // Światło: stałe białe (góra-przód) zaszyte w shaderze jako Blinn-Phong specular.

  // ─── Tick ──────────────────────────────────────────────────────────────────
  let hoverScale = 1.0;
  let colorMix   = 0.0;
  let glassMix   = 0.0;   // 0..1 — przejście w stan „czyste szkło" (hover sygnetu, brak działu)
  const _c    = new THREE.Color();   // scratch do liczenia koloru obrysu per klatkę
  const _gray = new THREE.Color();   // scratch dla desaturacji Lab glow

  // Mobile Y-shift — przesuwa sygnet w górę tak, żeby był wizualnie wycentrowany
  // w przestrzeni powyżej tacy nawigacyjnej (3 × 64px ≈ 192px).
  const TAN30 = Math.tan(Math.PI / 6);   // tan(FOV/2) dla FOV=60°
  const CAM_Z = 300;
  let mobileYShift = 0;
  function updateMobileShift() {
    if (window.innerWidth > 768) { mobileYShift = 0; return; }
    const navH    = 192;                                          // 3 karty × 64px
    const wuPerPx = (2 * TAN30 * CAM_Z) / window.innerHeight;   // world units / CSS pixel
    mobileYShift  = (navH * 0.5) * wuPerPx;                     // przesuń w górę o pół tacy
  }
  updateMobileShift();
  window.addEventListener('resize', updateMobileShift);

  onTick((_dt, elapsed) => {
    uniforms.time.value = elapsed;

    // +25% prędkości — skalowany czas mnoży częstotliwości, zachowuje amplitudy i fazy
    const t = elapsed * 1.25;

    // Dryf jak obiekt w wodzie — sumy sinusoid o niewspółmiernych częstotliwościach
    // i przesuniętych fazach → ruch nieprzewidywalny, nie wahadłowy.
    // Kołysanie lewo-prawo: dominująca fala (~połowa dawnego zakresu, widać bryłę 3D)
    // + dwie mniejsze niewspółmierne fale na losowość.
    const idleRotY = Math.sin(t * 0.15)        * 0.35
                   + Math.sin(t * 0.211 + 1.7) * 0.10
                   + Math.sin(t * 0.087 + 4.1) * 0.06;
    // Loading (Etap 9): jeden pełny obrót 360° sterowany progresem (loadFX.spin), mieszany
    // z idle przez spinWeight (1 w loadingu → 0 przy osiadaniu w HOME = bezszwowo).
    const baseRotY = loadFX.active
      ? idleRotY * (1 - loadFX.spinWeight) + loadFX.spin * loadFX.spinWeight
      : idleRotY;
    // nudgeRotY/X: cykliczny impuls obrotu ku dywizji (navigation.js GSAP yoyo)
    pivot.rotation.y = baseRotY + navFX.nudgeRotY;
    // Przechył góra-dół (~0.22)
    pivot.rotation.x = Math.sin(t * 0.17 + 0.6)  * 0.10
                     + Math.sin(t * 0.283 + 2.9) * 0.07
                     + Math.sin(t * 0.119 + 5.2) * 0.05
                     + navFX.nudgeRotX;
    // Subtelny roll (~0.057)
    pivot.rotation.z = Math.sin(t * 0.093 + 3.3) * 0.035
                     + Math.sin(t * 0.157 + 0.9) * 0.022;

    // Float góra-dół: amplituda −30% (5.0 → ~3.5), też rozbity na kilka fal
    // + navFX.tug = przeskok „jakby go pociągnęło" w stronę działu (heartbeat)
    // mobileYShift — na mobile przesuwa sygnet w górę, żeby nie siedział za nisko nad tacą nav
    pivot.position.x = navFX.tugX + navFX.pageX;
    pivot.position.y = mobileYShift
                     + Math.sin(t * 0.6)         * 2.2
                     + Math.sin(t * 0.41 + 2.2)  * 0.9
                     + Math.sin(t * 0.83 + 5.0)  * 0.4
                     + navFX.tugY + navFX.pageY;
    pivot.position.z = navFX.pageZ;   // Q-PONG na mobile: odjazd w głąb sceny

    // Magenta jako nagroda za interakcję — w spoczynku sygnet trzyma się primary.
    // idleMix: kąt obrotu daje cień magenty (max ~0.14 przy edge-on), nie pełne przejście.
    // hoverBoost: hover działu lub sygnetu otwiera pełne przejście ku magenta.
    const idleMix    = 0.0;   // primary 1:1 — bez dryfu ku magencie w spoczynku
    // Magenta = akcent, nie baza (A2/C3): mocno ścięty wkład hovera, żeby sygnet trzymał primary.
    // C3: 0.18→0.14 — jeszcze niższy szczyt magenty na hover = mniej magenty w akcentach desktop.
    const hoverBoost = navFX.intensity * 0.14 + glassMix * 0.10;
    const target     = loadFX.active ? 0 : Math.min(1, idleMix + hoverBoost);
    colorMix += (target - colorMix) * (loadFX.active ? 0.1 : 0.05);
    uniforms.uColorMix.value = colorMix;
    // Barwa dywizji wchodzi bezpośrednio do tintu ciała sygnetu — ta sama siła co w mgłach
    uniforms.uDivColor.value.set(navFX.target.r, navFX.target.g, navFX.target.b);
    uniforms.uDivMix.value  = navFX.intensity * TINT_MATCH;

    // Hover SAMEGO sygnetu (proxy: kursor blisko środka ekranu) przy BRAKU aktywnego działu
    // → stan „czyste szkło": gaśnie magenta idle i neonowy obrys (pętla niżej), zostaje sama
    // refrakcja + białe pryzmatyczne krawędzie. Osobny stan: idle ≠ szkło ≠ hover działu.
    const distC = Math.hypot(
      _mouse.x - window.innerWidth  * 0.5,
      _mouse.y - window.innerHeight * 0.5
    );
    const wantGlass = (distC < 72 && !navFX.activeDiv && !loadFX.active) ? 1 : 0;
    // Przy aktywnym dziale: szybki odpływ szkła (~5 klatek = 83ms → niewidoczny).
    // Zapobiega chwilowemu przeskokowi do „czyste szkło" gdy kursor przechodzi przez centrum
    // w drodze do Lab (bezpośrednio pod sygnetu — leży w strefie distC < 72).
    glassMix += (wantGlass - glassMix) * (navFX.activeDiv ? 0.5 : 0.1);
    // Loading: „materia w kolorze" wlewa się w sygnet — szkło (1−charge) gęstnieje w primary.
    const loadGlass = loadFX.active ? (1 - loadFX.charge) : 0;
    const gEff = Math.max(glassMix, loadGlass);
    uniforms.uGlass.value = gEff;
    // Neon obrys/blask gaśnie w szkle (hover) ORAZ na starcie loadingu, narasta z charge.
    const glowHide = gEff;

    // Hover dywizji → obrys/glow przyjmują kolor działu; sprite glow „eksploduje".
    // Balans per dział (gain) na JASNOŚCI koloru, wmieszany przez intensity (idle neutralny).
    // Opacity prowadzi tylko heartbeat — gain na opacity klipuje się do 1 i nie różnicuje.
    const gain = GLOW_GAIN[navFX.activeDiv] || 1;
    const eff  = 1 + (gain - 1) * navFX.intensity;
    for (const p of outlineParts) {
      _c.copy(p.base).lerp(navFX.target, navFX.intensity * TINT_MATCH);
      if (p.glow) {
        _c.multiplyScalar(eff);                                       // balans per dział = jasność
        // Lab: cyjan percepcyjnie jaśniejszy ~1.5× niż fiolet → desaturacja samej poświaty
        // (baza HUD/ramki zostają nasycone — tylko blask sygnetu jest łagodniejszy)
        if (navFX.activeDiv === 'lab' && navFX.intensity > 0) {
          const lum = _c.r * 0.299 + _c.g * 0.587 + _c.b * 0.114;
          _gray.setRGB(lum, lum, lum);
          _c.lerp(_gray, 0.28 * navFX.intensity);
        }
        // (1 - glowHide) → w trybie szkła / podczas loadingu neonowy obrys i blask gasną
        p.apply(_c, Math.min(1, p.baseOpacity * (1 + navFX.glow * 1.8)) * (1 - glowHide));
      } else {
        p.apply(_c, p.baseOpacity * (1 - glowHide));
      }
    }

    // Pulsowanie skali "oddychanie" × mouse-proximity hover
    const pulse = 1 + Math.sin(t * 0.8) * 0.03;   // amplituda 0.03 (też +25% prędkości)
    const near = distC < 72;   // ta sama odległość co przy glassMix (liczona wyżej)
    hoverScale += ((near ? 1.08 : 1.0) - hoverScale) * 0.07;
    // „Uderzenie serca" przy hover (navFX.pulse: 0→0.15→0) na wierzchu oddychania i hovera
    // × pageScale — tryb podstrony zmniejsza sygnet do logo w rogu.
    // × loadFX.scale — krok ku kamerze przy finałowym whipie (poza tym = 1).
    pivot.scale.setScalar(pulse * hoverScale * (1 + navFX.pulse) * navFX.pageScale * loadFX.scale);
  });
}
