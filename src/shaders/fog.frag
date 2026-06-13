// fog.frag — nebula fog plane (Etap 5)
uniform float time;
uniform vec3  fogColor;
uniform float fogAlpha;
varying vec2  vUv;

// ── Value noise ────────────────────────────────────────────────────────────────
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 43.21);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),                  hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// ── FBM (5 octaves) ────────────────────────────────────────────────────────────
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p  = p * 2.03 + vec2(0.31, 0.73); // slight offset avoids axis-aligned artifacts
    a *= 0.5;
  }
  return v;
}

void main() {
  // Slow drift on two axes — nearly imperceptible speed
  vec2 p = vUv * 3.5 + vec2(time * 0.00012, time * 0.00008);
  float n = fbm(p);

  // Threshold cuts out most of the plane; keeps wispy nebula patches
  float a = max(0.0, n - 0.42) * fogAlpha;
  gl_FragColor = vec4(fogColor, a);
}
