import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { onTick, registerRefraction } from './scene.js';
import { navFX } from './tint.js';

const _mouse = { x: -9999, y: -9999 };
window.addEventListener('mousemove', e => { _mouse.x = e.clientX; _mouse.y = e.clientY; });

export async function initSignet(ctx) {
  const { scene } = ctx;

  // ─── Load SVG ──────────────────────────────────────────────────────────────
  const loader = new SVGLoader();
  let data;
  try {
    data = await new Promise((resolve, reject) =>
      loader.load('/assets/signet.svg', resolve, undefined, reject)
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
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec4 vClip;
      varying vec3 vWorldPos;
      void main() {
        vNormal   = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vClip     = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vClip;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tBackground;
      uniform float refractionStrength;
      uniform float time;
      uniform float uColorMix;

      varying vec3 vNormal;
      varying vec4 vClip;
      varying vec3 vWorldPos;

      void main() {
        // Screen-space UV — dzielenie perspektywiczne per-fragment (poprawne)
        vec2 vScreenPos = (vClip.xy / vClip.w) * 0.5 + 0.5;

        // Zagięcie UV przez normalną (refrakcja)
        vec2 refractedUV = vScreenPos + vNormal.xy * refractionStrength;

        // Chromatic aberration — rozszczepianie RGB
        float r = texture2D(tBackground, refractedUV + vec2(0.002, 0.0)).r;
        float g = texture2D(tBackground, refractedUV).g;
        float b = texture2D(tBackground, refractedUV - vec2(0.002, 0.0)).b;

        // Fresnel — krawędzie bardziej widoczne
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);

        vec3 color = vec3(r, g, b);

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

        color.rgb += specColor;                              // refleks (bonus przy ruchu)
        color.rgb += tint * 0.4;                             // emissive — sygnet jaśniejszy
        color.rgb += tint * fresnel * 0.5;                   // krawędzie podążają za tintem

        gl_FragColor = vec4(color, 0.85 + fresnel * 0.15);
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

  // ─── Świecący obrys — neon wzdłuż krawędzi sygnetu ──────────────────────────
  // Te same ścieżki SVG co bryła, jako linie. Punkty wycentrowane (−svgCX,−svgCY),
  // żeby skalowanie halo (1.008×) działało względem środka sygnetu, nie rogu SVG.
  const outlineParts = [];   // { mat, base } — do tintu na hover dywizji
  function buildOutline(scaleMul, hex, opacity, renderOrder) {
    const og   = new THREE.Group();
    const lmat = new THREE.LineBasicMaterial({
      color: hex, transparent: true, opacity, depthWrite: false,
    });
    outlineParts.push({ mat: lmat, base: new THREE.Color(hex) });
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

  group.add(buildOutline(1.008, 0x9B6DFF, 0.3, 9));   // halo — szersze, słabsze
  group.add(buildOutline(1.0,   0x5B2EFF, 0.7, 10));  // główny neon

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

  onTick((_dt, elapsed) => {
    uniforms.time.value = elapsed;

    // +25% prędkości — skalowany czas mnoży częstotliwości, zachowuje amplitudy i fazy
    const t = elapsed * 1.25;

    // Dryf jak obiekt w wodzie — sumy sinusoid o niewspółmiernych częstotliwościach
    // i przesuniętych fazach → ruch nieprzewidywalny, nie wahadłowy.
    // Kołysanie lewo-prawo: dominująca fala (~połowa dawnego zakresu, widać bryłę 3D)
    // + dwie mniejsze niewspółmierne fale na losowość.
    // (+ navFX.leanY/X = pochylenie „w stronę" najechanej dywizji, tweenowane GSAP-em)
    pivot.rotation.y = Math.sin(t * 0.15)        * 0.35
                     + Math.sin(t * 0.211 + 1.7) * 0.10
                     + Math.sin(t * 0.087 + 4.1) * 0.06
                     + navFX.leanY;
    // Przechył góra-dół (~0.22)
    pivot.rotation.x = Math.sin(t * 0.17 + 0.6)  * 0.10
                     + Math.sin(t * 0.283 + 2.9) * 0.07
                     + Math.sin(t * 0.119 + 5.2) * 0.05
                     + navFX.leanX;
    // Subtelny roll (~0.057)
    pivot.rotation.z = Math.sin(t * 0.093 + 3.3) * 0.035
                     + Math.sin(t * 0.157 + 0.9) * 0.022;

    // Float góra-dół: amplituda −30% (5.0 → ~3.5), też rozbity na kilka fal
    pivot.position.y = Math.sin(t * 0.6)         * 2.2
                     + Math.sin(t * 0.41 + 2.2)  * 0.9
                     + Math.sin(t * 0.83 + 5.0)  * 0.4;

    // Przejście primary → magenta — sterowane fazą obrotu (edge-on → magenta)
    const target = Math.abs(Math.sin(pivot.rotation.y));
    colorMix += (target - colorMix) * 0.05;
    uniforms.uColorMix.value = colorMix;

    // Hover dywizji → outline (główny + halo) przyjmuje kolor działu (navFX, GSAP)
    for (const p of outlineParts) p.mat.color.copy(p.base).lerp(navFX.target, navFX.intensity);

    // Pulsowanie skali "oddychanie" × mouse-proximity hover
    const pulse = 1 + Math.sin(t * 0.8) * 0.03;   // amplituda 0.03 (też +25% prędkości)
    const dist = Math.hypot(
      _mouse.x - window.innerWidth  * 0.5,
      _mouse.y - window.innerHeight * 0.5
    );
    const near = dist < 140;
    hoverScale += ((near ? 1.08 : 1.0) - hoverScale) * 0.07;
    pivot.scale.setScalar(pulse * hoverScale);
  });
}
