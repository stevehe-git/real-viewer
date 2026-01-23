/**
 * WebGL 着色器代码
 */

export const vertexShader = `
precision mediump float;
attribute vec3 position;
attribute vec3 color;
uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
varying vec3 vColor;

void main() {
  gl_Position = projection * view * model * vec4(position, 1.0);
  vColor = color;
}
`

export const fragmentShader = `
precision mediump float;
varying vec3 vColor;
uniform float opacity;

void main() {
  gl_FragColor = vec4(vColor, opacity);
}
`

export const pointCloudVertexShader = `
precision mediump float;
attribute vec3 position;
attribute vec3 color;
attribute float pointSize;
uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
varying vec3 vColor;

void main() {
  gl_Position = projection * view * model * vec4(position, 1.0);
  gl_PointSize = pointSize;
  vColor = color;
}
`

export const pointCloudFragmentShader = `
precision mediump float;
varying vec3 vColor;
uniform float opacity;

void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if (dist > 0.5) discard;
  float alpha = opacity * (1.0 - smoothstep(0.0, 0.5, dist));
  gl_FragColor = vec4(vColor, alpha);
}
`
