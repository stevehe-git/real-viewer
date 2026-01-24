/**
 * Triangles 命令
 * 完全基于 regl-worldview 的 Triangles.js 实现
 */
import type { Regl, TriangleList } from '../types'
import {
  defaultBlend,
  getVertexColors,
  pointToVec3Array,
  shouldConvert,
  toRGBA,
  withPose
} from './utils/commandUtils'
import withRenderStateOverrides from './utils/withRenderStateOverrides'

// TODO(Audrey): default to the actual regl defaults before 1.x release
const defaultSingleColorDepth = { enable: true, mask: false }
const defaultVetexColorDepth = {
  enable: true,
  mask: true,
  func: '<='
}

const singleColor = (regl: Regl) =>
  withPose({
    primitive: 'triangles',
    vert: `
  precision mediump float;

  attribute vec3 point;

  uniform mat4 projection, view;

  #WITH_POSE

  void main () {
    vec3 pos = applyPose(point);
    gl_Position = projection * view * vec4(pos, 1);
  }
  `,
    frag: `
  precision mediump float;
  uniform vec4 color;
  void main () {
    gl_FragColor = color;
  }
  `,
    attributes: {
      point: (_context: any, props: any) => {
        if (shouldConvert(props.points)) {
          return pointToVec3Array(props.points)
        }
        return props.points
      }
    },
    uniforms: {
      color: (_context: any, props: any) => {
        if (shouldConvert(props.color)) {
          return toRGBA(props.color)
        }
        return props.color
      }
    },
    // can pass in { enable: true, depth: false } to turn off depth to prevent flicker
    // because multiple items are rendered to the same z plane
    depth: {
      enable: (_context: any, props: any) => {
        return (props.depth && props.depth.enable) || defaultSingleColorDepth.enable
      },
      mask: (_context: any, props: any) => {
        return (props.depth && props.depth.mask) || defaultSingleColorDepth.mask
      }
    },
    blend: defaultBlend,

    count: (_context: any, props: any) => props.points.length
  })

const vertexColors = (regl: Regl) =>
  withPose({
    primitive: 'triangles',
    vert: `
  precision mediump float;

  attribute vec3 point;
  attribute vec4 color;

  uniform mat4 projection, view;

  varying vec4 vColor;

  #WITH_POSE

  void main () {
    vec3 pos = applyPose(point);
    vColor = color;
    gl_Position = projection * view * vec4(pos, 1);
  }
  `,
    frag: `
  precision mediump float;
  varying vec4 vColor;
  void main () {
    gl_FragColor = vColor;
  }
  `,
    attributes: {
      point: (_context: any, props: any) => {
        if (shouldConvert(props.points)) {
          return pointToVec3Array(props.points)
        }
        return props.points
      },
      color: (_context: any, props: any) => {
        if (!props.colors || !props.colors.length) {
          throw new Error(`Invalid empty or null prop "colors" when rendering triangles using vertex colors`)
        }
        if (shouldConvert(props.colors)) {
          return getVertexColors(props)
        }
        return props.colors
      }
    },

    depth: {
      enable: (_context: any, props: any) => {
        return (props.depth && props.depth.enable) || defaultVetexColorDepth.enable
      },
      mask: (_context: any, props: any) => {
        return (props.depth && props.depth.mask) || defaultVetexColorDepth.mask
      }
    },
    blend: defaultBlend,

    count: (_context: any, props: any) => props.points.length
  })

// command to render triangle lists optionally supporting vertex colors for each triangle
export const triangles = (regl: Regl) => {
  const single = withRenderStateOverrides(singleColor)(regl)
  const vertex = withRenderStateOverrides(vertexColors)(regl)
  return (props: any, isHitmap: boolean = false) => {
    const items: TriangleList[] = Array.isArray(props) ? props : [props]
    const singleColorItems: any[] = []
    const vertexColorItems: any[] = []
    items.forEach((item) => {
      // If the item has onlyRenderInHitmap set, only render it in the hitmap.
      if (isHitmap || !item.onlyRenderInHitmap) {
        if (item.colors && item.colors.length) {
          vertexColorItems.push(item)
        } else {
          singleColorItems.push(item)
        }
      }
    })

    single(singleColorItems)
    vertex(vertexColorItems)
  }
}

export const makeTrianglesCommand = () => {
  return triangles
}

export default function Triangles(props: { children: TriangleList[] }) {
  return makeTrianglesCommand()
}
