/**
 * fromGeometry 工具函数
 * 完全基于 regl-worldview 的 fromGeometry.js 实现
 */
import type { ReglCommand, Vec3 } from '../../types'
import { withPose, pointToVec3, defaultBlend, defaultDepth, shouldConvert, colorBuffer } from './commandUtils'

// Creates a regl command factory which will render any geometry described by point positions
// and elements (indexes into the array of positions), and apply the object's pose, scale, and color to it.
export default (positions: Vec3[], elements: Vec3[]) => (regl: any): ReglCommand => {
  const flatPositions: number[] = []
  for (const pos of positions) {
    flatPositions.push(...pos)
  }
  const vertexArray = Float32Array.from(flatPositions)

  if (elements.some((face) => face.some((i) => i < 0 || i >= 1 << 16))) {
    throw new Error('Element index out of bounds for Uint16')
  }
  const flatElements: number[] = []
  for (const elem of elements) {
    flatElements.push(...elem)
  }
  const elementsArray = Uint16Array.from(flatElements)

  const buff = regl.buffer({
    // tell the gpu this buffer's contents will change frequently
    usage: 'dynamic',
    data: []
  })
  const colorBuff = colorBuffer(regl)

  return withPose({
    vert: `
    precision mediump float;
    attribute vec3 point;
    attribute vec3 offset;
    attribute vec4 color;
    uniform mat4 projection, view;
    uniform vec3 scale;
    varying vec4 vColor;

    #WITH_POSE

    void main () {
      vec3 p = applyPose(scale * point + offset);
      vColor = color;
      gl_Position = projection * view * vec4(p, 1);
    }
    `,
    frag: `
    precision mediump float;
    varying vec4 vColor;
    void main () {
      gl_FragColor = vColor;
    }`,

    attributes: {
      point: vertexArray,
      color: (_context: any, props: any) => {
        return colorBuff(props.color, props.colors, props.points ? props.points.length : 1)
      },

      offset: (_context: any, props: any) => {
        const points = shouldConvert(props.points) ? props.points.map(pointToVec3) : props.points || [0, 0, 0]
        return {
          buffer: buff({
            usage: 'dynamic',
            data: points
          }),
          divisor: 1
        }
      }
    },

    elements: elementsArray,

    depth: defaultDepth,
    blend: defaultBlend,

    uniforms: {
      scale: (_context: any, props: any) => (shouldConvert(props.scale) ? pointToVec3(props.scale) : props.scale)
    },

    count: elementsArray.length,

    instances: (_context: any, props: any) => (props.points ? props.points.length : 1)
  })
}
