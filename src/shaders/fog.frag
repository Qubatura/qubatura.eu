// fog.frag — fragment shader for nebula fog (Etap 5)
// Simplex/fbm noise, slow drift, tints on nav hover
uniform float time;
uniform vec3  fogColor;
uniform float fogAlpha;
varying vec2  vUv;

void main() {
  // Etap 5: add noise nebula implementation here
  gl_FragColor = vec4(fogColor, fogAlpha * 0.0); // invisible placeholder
}
