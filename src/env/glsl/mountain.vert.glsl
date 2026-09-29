attribute float ridge;
varying vec2 vUv;
varying float vRidge;
varying vec3 vWorld;
varying vec3 vNormalW;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vRidge = ridge;
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
