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
const GLOW_GAIN = { events: 1.15, studio: 1.15, lab: 0.45 };

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
  const { scene } = ctx;

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
  const S      = (51.4 * 1.1) / svgMax;   // +10% rozmiaru bazowego

  // ─── Material — custom GLSL: refrakcja tła + chromatic aberration + fresnel ──
  const uniforms = {
    tBackground:        { value: null },   // wstrzykiwane co klatkę przez scene.js
    refractionStrength: { value: 0.06 },   // siła zagięcia planety (do tuningu)
    time:               { value: 0 },
    uColorMix:          { value: 0 },      // 0 = primary, 1 = magenta (sterowane kątem)
    uGlass:             { value: 0 },      // 0 = normalny tint, 1 = czyste szkło (hover sygnetu, brak działu)
    uLoad:              { value: 0 },      // 0..1 — siła trybu loading (fala wypełnienia) vs normalny
    uFill:              { value: 0 },      // 0..1 — czoło fali primary (wipe lewo→prawo)
    uWipeMinX:          { value: bb.min.x },              // lewa krawędź sygnetu (SVG space)
    uWipeSpanX:         { value: (bb.max.x - bb.min.x) || 1 },  // szerokość → normalizacja vWipe 0..1
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
    vertexShader: /* glsl */`
      uniform float uWipeMinX;
      uniform float uWipeSpanX;
      varying vec3 vNormal;
      varying vec4 vClip;
      varying vec3 vWorldPos;
      varying float vWipe;     // 0..1 wzdłuż szerokości sygnetu (lewo→prawo) — niezależne od obrotu
      void main() {
        vNormal   = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vClip     = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vWipe     = clamp((position.x - uWipeMinX) / uWipeSpanX, 0.0, 1.0);
        gl_Position = vClip;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tBackground;
      uniform float refractionStrength;
      uniform float time;
      uniform float uColorMix;
      uniform float uGlass;
      uniform float uLoad;
      uniform float uFill;

      varying vec3 vNormal;
      varying vec4 vClip;
      varying vec3 vWorldPos;
      varying float vWipe;

      // Proceduralne „środowisko" wypełnienia (Etap 9) — sterowane NORMALNĄ (matcap-like).
      // To ono jest refraktowane/rozszczepiane przez szkło: gradient idzie za formą bryły
      // (głębia), a próbkowanie per-kanał na rozsuniętej normalnej daje dyspersję w objętości.
      vec3 envFill(vec3 n) {
        float facing = n.z * 0.5 + 0.5;                              // 0 krawędź .. 1 na wprost
        float vert   = n.y * 0.5 + 0.5;                              // dół .. góra bryły
        vec3 deep = vec3(0.07, 0.03, 0.30);                          // ciemny primary — głębia
        vec3 lit  = vec3(0.42, 0.20, 1.00);                          // jasny primary — światło
        vec3 c = mix(deep, lit, facing * facing);                    // cieniowanie po formie = 3D
        c = mix(c, vec3(0.78, 0.14, 0.48), smoothstep(0.6, 1.0, vert) * 0.30);  // magenta górą
        return c;
      }

      void main() {
        // Screen-space UV — dzielenie perspektywiczne per-fragment (poprawne)
        vec2 vScreenPos = (vClip.xy / vClip.w) * 0.5 + 0.5;

        // Zagięcie UV przez normalną (refrakcja)
        vec2 refractedUV = vScreenPos + vNormal.xy * refractionStrength;

        // Fresnel — krawędzie bardziej widoczne (liczone przed CA: steruje siłą
        // pryzmatycznego rozszczepienia na krawędziach)
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);

        // Chromatic aberration — rozszczepianie RGB. Rośnie ku krawędziom w trybie szkła
        // (uGlass) → pryzmatyczny, tęczowy rozkład światła na krawędziach.
        float ca = 0.002 + uGlass * fresnel * 0.010;
        float r = texture2D(tBackground, refractedUV + vec2(ca, 0.0)).r;
        float g = texture2D(tBackground, refractedUV).g;
        float b = texture2D(tBackground, refractedUV - vec2(ca, 0.0)).b;
        vec3 refr = vec3(r, g, b);   // zagięte tło (czerń podczas loadingu)

        // ── Blinn-Phong specular — fioletowy refleks (primary) od światła góra-przód ──
        vec3 lightPos = vec3(200.0, 300.0, 400.0);
        vec3 toLight  = normalize(lightPos - vWorldPos);
        vec3 toCamera = normalize(cameraPosition - vWorldPos);
        vec3 halfVec  = normalize(toLight + toCamera);
        float spec    = pow(max(dot(vNormal, halfVec), 0.0), 64.0);
        vec3 specColor = vec3(0.5, 0.3, 1.0) * spec * 2.0;   // fioletowy refleks (primary)

        // Przejście primary → magenta sterowane kątem obrotu (uColorMix)
        vec3 cPrimary = vec3(0.35, 0.18, 1.0);
        vec3 cMagenta = vec3(0.95, 0.15, 0.60);
        vec3 tint     = mix(cPrimary, cMagenta, uColorMix);

        // ── TRYB NORMALNY (HOME / hover-glass) ──────────────────────────────────────
        // Tryb szkła (uGlass): wygaszamy barwny tint, zostawiając refrakcję + białe
        // pryzmatyczne krawędzie. Poza szkłem: pełny barwny tint + refleks.
        float colorAmt  = 1.0 - uGlass;
        vec3  normalCol = refr;
        normalCol += specColor * colorAmt;
        normalCol += tint * 0.4 * colorAmt;
        normalCol += tint * fresnel * 0.5 * colorAmt;
        normalCol += vec3(1.0) * fresnel * 0.6 * uGlass;
        float normalA = 0.85 + fresnel * 0.15;

        // ── TRYB LOADING (Etap 9) — primary ZALEWA sygnet FALĄ (wipe lewo→prawo) ─────
        // vWipe ∈ 0..1 wzdłuż szerokości; uFill = czoło fali (= % postępu). Miękka krawędź.
        float fillAmt = 1.0 - smoothstep(uFill - 0.10, uFill + 0.10, vWipe);
        // jasny grzbiet fali na samym czole (znika przy 0% i 100%)
        float front   = smoothstep(0.10, 0.0, abs(vWipe - uFill))
                        * step(0.001, uFill) * step(uFill, 0.999);

        // GŁĘBIA 3D: zamiast płaskiego koloru — REFRAKCJA proceduralnego środowiska (envFill)
        // z DYSPERSJĄ. Próbkujemy je na trzech rozsuniętych normalnych (per-kanał R/G/B) →
        // kolor jest zaginany i rozszczepiany przez bryłę jak w realnym szkle. Forma + ruchomy
        // refleks (specColor) + magenta rim dają wrażenie pełnej, obrotowej objętości.
        float disp     = 0.05 + fresnel * 0.10;
        vec3  eR       = envFill(normalize(vNormal + vec3( disp, 0.0, 0.0)));
        vec3  eG       = envFill(vNormal);
        vec3  eB       = envFill(normalize(vNormal + vec3(-disp, 0.0, 0.0)));
        vec3  body     = vec3(eR.r, eG.g, eB.b);              // rozszczepione środowisko (głębia)
        body += specColor * 1.3;                              // wędrujący glint — mocny cue 3D
        body += vec3(1.0, 0.35, 0.65) * pow(fresnel, 2.0) * 0.5;   // jasny magenta rim (dyspersja)

        // Niewypełnione: ledwo widoczny szklany kontur (sama refrakcja czerni + cień fresnela).
        vec3  glassCol = refr + vec3(1.0) * fresnel * 0.09;
        vec3  loadCol  = mix(glassCol, body, fillAmt) + vec3(0.7, 0.55, 1.0) * front * 0.45;
        float loadA    = mix(0.05 + fresnel * 0.20, 0.92 + fresnel * 0.08, fillAmt);

        // Wybór trybu: loading (fala) ↔ normalny HOME — krzyżowo przez uLoad (handoff bez cięcia)
        vec3  color = mix(normalCol, loadCol, uLoad);
        float alpha = mix(normalA,  loadA,  uLoad);

        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
      }
    `,
  });

  // ─── Geometry — bevel mały żeby nie pożerał cienkich fragmentów ogona Q ───
  const group  = new THREE.Group();
  const depth  = 3 / S;
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
  addGlowSprite(makeGlowTexture(48), 0x5B2EFF, 0.55, 6);   // szersza warstwa — więcej oddechu
  addGlowSprite(makeGlowTexture(14), 0x9B8CFF, 0.95, 7);
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
  const _c = new THREE.Color();   // scratch do liczenia koloru obrysu per klatkę

  onTick((_dt, elapsed) => {
    uniforms.time.value = elapsed;

    // +25% prędkości — skalowany czas mnoży częstotliwości, zachowuje amplitudy i fazy
    const t = elapsed * 1.25;

    // Dryf jak obiekt w wodzie — sumy sinusoid o niewspółmiernych częstotliwościach
    // i przesuniętych fazach → ruch nieprzewidywalny, nie wahadłowy.
    // Kołysanie lewo-prawo: dominująca fala (~połowa dawnego zakresu, widać bryłę 3D)
    // + dwie mniejsze niewspółmierne fale na losowość.
    pivot.rotation.y = Math.sin(t * 0.15)        * 0.35
                     + Math.sin(t * 0.211 + 1.7) * 0.10
                     + Math.sin(t * 0.087 + 4.1) * 0.06;
    // Przechył góra-dół (~0.22)
    pivot.rotation.x = Math.sin(t * 0.17 + 0.6)  * 0.10
                     + Math.sin(t * 0.283 + 2.9) * 0.07
                     + Math.sin(t * 0.119 + 5.2) * 0.05;
    // Subtelny roll (~0.057)
    pivot.rotation.z = Math.sin(t * 0.093 + 3.3) * 0.035
                     + Math.sin(t * 0.157 + 0.9) * 0.022;

    // Float góra-dół: amplituda −30% (5.0 → ~3.5), też rozbity na kilka fal
    // + navFX.tug = przeskok „jakby go pociągnęło" w stronę działu (heartbeat)
    pivot.position.x = navFX.tugX + navFX.pageX;
    pivot.position.y = Math.sin(t * 0.6)         * 2.2
                     + Math.sin(t * 0.41 + 2.2)  * 0.9
                     + Math.sin(t * 0.83 + 5.0)  * 0.4
                     + navFX.tugY + navFX.pageY;

    // Przejście primary → magenta — sterowane fazą obrotu (edge-on → magenta).
    // Podczas loadingu (Etap 9) pinujemy do 0 (czysty primary #5B2EFF — to barwa, którą
    // sygnet nabiera w miarę progresu; magenta przychodzi dopiero w żywym stanie HOME).
    const target = loadFX.active ? 0 : Math.abs(Math.sin(pivot.rotation.y));
    colorMix += (target - colorMix) * (loadFX.active ? 0.1 : 0.05);
    uniforms.uColorMix.value = colorMix;

    // Hover SAMEGO sygnetu (proxy: kursor blisko środka ekranu) przy BRAKU aktywnego działu
    // → stan „czyste szkło": gaśnie magenta idle i neonowy obrys (pętla niżej), zostaje sama
    // refrakcja + białe pryzmatyczne krawędzie. Osobny stan: idle ≠ szkło ≠ hover działu.
    const distC = Math.hypot(
      _mouse.x - window.innerWidth  * 0.5,
      _mouse.y - window.innerHeight * 0.5
    );
    // Proximity-glass wyłączony podczas loadingu — wtedy wyglądem rządzi tryb loading (uLoad).
    const wantGlass = (distC < 140 && !navFX.activeDiv && !loadFX.active) ? 1 : 0;
    glassMix += (wantGlass - glassMix) * 0.1;   // miękkie wejście/wyjście ze szkła
    uniforms.uGlass.value = glassMix;           // szkło tylko z proximity (hover sygnetu)
    uniforms.uLoad.value  = loadFX.load;        // 1 = tryb loading (fala), →0 handoff
    uniforms.uFill.value  = loadFX.fill;        // czoło fali primary (= % postępu)
    // Neon obrys/blask gaśnie przy hover-szkle (glassMix) ORAZ podczas loadingu (load),
    // fade-in przy handoffie gdy load→0.
    const glowHide = Math.max(glassMix, loadFX.load);

    // Hover dywizji → obrys/glow przyjmują kolor działu; sprite glow „eksploduje".
    // Balans per dział (gain) na JASNOŚCI koloru, wmieszany przez intensity (idle neutralny).
    // Opacity prowadzi tylko heartbeat — gain na opacity klipuje się do 1 i nie różnicuje.
    const gain = GLOW_GAIN[navFX.activeDiv] || 1;
    const eff  = 1 + (gain - 1) * navFX.intensity;
    for (const p of outlineParts) {
      _c.copy(p.base).lerp(navFX.target, navFX.intensity * TINT_MATCH);
      if (p.glow) {
        _c.multiplyScalar(eff);                                       // balans per dział = jasność
        // (1 - glowHide) → w trybie szkła / podczas loadingu neonowy obrys i blask gasną
        p.apply(_c, Math.min(1, p.baseOpacity * (1 + navFX.glow * 1.8)) * (1 - glowHide));
      } else {
        p.apply(_c, p.baseOpacity * (1 - glowHide));
      }
    }

    // Pulsowanie skali "oddychanie" × mouse-proximity hover
    const pulse = 1 + Math.sin(t * 0.8) * 0.03;   // amplituda 0.03 (też +25% prędkości)
    const near = distC < 140;   // ta sama odległość co przy glassMix (liczona wyżej)
    hoverScale += ((near ? 1.08 : 1.0) - hoverScale) * 0.07;
    // „Uderzenie serca" przy hover (navFX.pulse: 0→0.15→0) na wierzchu oddychania i hovera
    // × pageScale — tryb podstrony zmniejsza sygnet do logo w rogu.
    // Loading (Etap 9): BEZ zmian skali — sygnet stoi w skali HOME przez cały czas → handoff
    // jest zerowy (żadnego przeskoku). Ruch „przybliżania" świadomie usunięty.
    pivot.scale.setScalar(pulse * hoverScale * (1 + navFX.pulse) * navFX.pageScale);
  });
}
