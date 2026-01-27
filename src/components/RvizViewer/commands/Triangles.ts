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

// 缓存地图数据的 regl buffer，避免每帧重新创建
interface CachedTriangleData {
  pointsBuffer: any
  colorsBuffer: any
  count: number
  dataHash: string
}

const triangleCache = new Map<string, CachedTriangleData>()

function getTriangleCacheKey(points: any, colors: any): string {
  // 使用数据长度和第一个/最后一个元素生成简单的哈希
  // 对于大地图，这可以快速判断数据是否变化
  const pointsHash = Array.isArray(points) 
    ? `${points.length}_${points[0]?.x || 0}_${points[points.length - 1]?.x || 0}`
    : `${points?.length || 0}`
  const colorsHash = Array.isArray(colors)
    ? `${colors.length}_${colors[0]?.r || 0}_${colors[colors.length - 1]?.r || 0}`
    : `${colors?.length || 0}`
  return `${pointsHash}_${colorsHash}`
}

function getCachedTriangleBuffers(
  regl: Regl,
  props: any,
  cacheKey: string
): CachedTriangleData | null {
  const cached = triangleCache.get(cacheKey)
  if (cached) {
    return cached
  }
  return null
}

function createTriangleBuffers(
  regl: Regl,
  props: any,
  cacheKey: string
): CachedTriangleData {
  let pointsData: Float32Array | number[]
  let colorsData: Float32Array | number[]

  // 处理点数据
  if (shouldConvert(props.points)) {
    pointsData = pointToVec3Array(props.points)
  } else if (Array.isArray(props.points)) {
    // 如果已经是数组，直接使用
    pointsData = props.points
  } else {
    pointsData = props.points || []
  }

  // 处理颜色数据
  if (!props.colors || !props.colors.length) {
    throw new Error(`Invalid empty or null prop "colors" when rendering triangles using vertex colors`)
  }
  if (shouldConvert(props.colors)) {
    colorsData = getVertexColors(props) as Float32Array
  } else {
    colorsData = props.colors
  }

  // 创建 regl buffer
  const pointsBuffer = regl.buffer(pointsData)
  const colorsBuffer = regl.buffer(colorsData)

  const cached: CachedTriangleData = {
    pointsBuffer,
    colorsBuffer,
    count: Array.isArray(pointsData) ? pointsData.length / 3 : (pointsData as Float32Array).length / 3,
    dataHash: cacheKey
  }

  triangleCache.set(cacheKey, cached)
  return cached
}

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
        // 性能优化：对于大地图数据，使用缓存机制
        // 如果数据已经转换为 buffer，直接使用
        if (props._cachedBuffers?.pointsBuffer) {
          return props._cachedBuffers.pointsBuffer
        }
        
        // 否则检查缓存
        const cacheKey = getTriangleCacheKey(props.points, props.colors)
        const cached = getCachedTriangleBuffers(regl, props, cacheKey)
        
        if (cached) {
          // 将缓存的 buffer 附加到 props，避免重复查找
          props._cachedBuffers = cached
          return cached.pointsBuffer
        }
        
        // 缓存未命中，创建新的 buffer
        const newCached = createTriangleBuffers(regl, props, cacheKey)
        props._cachedBuffers = newCached
        return newCached.pointsBuffer
      },
      color: (_context: any, props: any) => {
        // 性能优化：使用缓存的 buffer
        if (props._cachedBuffers?.colorsBuffer) {
          return props._cachedBuffers.colorsBuffer
        }
        
        const cacheKey = getTriangleCacheKey(props.points, props.colors)
        const cached = getCachedTriangleBuffers(regl, props, cacheKey)
        
        if (cached) {
          props._cachedBuffers = cached
          return cached.colorsBuffer
        }
        
        const newCached = createTriangleBuffers(regl, props, cacheKey)
        props._cachedBuffers = newCached
        return newCached.colorsBuffer
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

    count: (_context: any, props: any) => {
      // 使用缓存中的 count，避免重复计算
      if (props._cachedBuffers?.count) {
        return props._cachedBuffers.count
      }
      return props.points.length
    }
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
