/**
 * Grid 命令
 * 完全基于 regl-worldview 的 Grid.js 实现
 * 性能优化：使用 regl buffer 缓存顶点数据，避免每帧重新计算
 */
import type { Regl } from '../../types'
import { withPose, defaultBlend } from './utils/commandUtils'

const DEFAULT_GRID_COLOR: [number, number, number, number] = [0.3, 0.3, 0.3, 1]

// 缓存网格数据，避免每帧重新计算
interface CachedGridData {
  count: number
  cellSize: number
  color: [number, number, number, number]
  pointBuffer: any
  colorBuffer: any
  totalCount: number
}

const gridCache = new Map<string, CachedGridData>()

function getCacheKey(count: number, cellSize: number, color: [number, number, number, number]): string {
  return `${count}_${cellSize}_${color.join(',')}`
}

function generateGridData(
  regl: Regl,
  count: number,
  cellSize: number,
  color: [number, number, number, number]
): CachedGridData {
  const cacheKey = getCacheKey(count, cellSize, color)
  const cached = gridCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const points: number[] = []
  const colors: number[] = []
  const bound = count * cellSize
  
  // 绘制内部网格线
  for (let i = -count; i <= count; i++) {
    const pos = i * cellSize
    // 垂直线
    points.push(-bound, pos, 0)
    points.push(bound, pos, 0)
    // 水平线
    points.push(pos, -bound, 0)
    points.push(pos, bound, 0)
    // 每个点对应一个颜色
    colors.push(color[0], color[1], color[2], color[3] || 1.0)
    colors.push(color[0], color[1], color[2], color[3] || 1.0)
    colors.push(color[0], color[1], color[2], color[3] || 1.0)
    colors.push(color[0], color[1], color[2], color[3] || 1.0)
  }
  
  // 绘制边界框（封边）
  // 左边界
  points.push(-bound, -bound, 0)
  points.push(-bound, bound, 0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  // 右边界
  points.push(bound, -bound, 0)
  points.push(bound, bound, 0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  // 下边界
  points.push(-bound, -bound, 0)
  points.push(bound, -bound, 0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  // 上边界
  points.push(-bound, bound, 0)
  points.push(bound, bound, 0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  colors.push(color[0], color[1], color[2], color[3] || 1.0)
  
  const totalCount = points.length / 3
  
  // 创建 regl buffer 缓存数据
  const pointBuffer = regl.buffer(points)
  const colorBuffer = regl.buffer(colors)
  
  const cachedData: CachedGridData = {
    count,
    cellSize,
    color,
    pointBuffer,
    colorBuffer,
    totalCount
  }
  
  gridCache.set(cacheKey, cachedData)
  return cachedData
}

export function grid(regl: Regl) {
  if (!regl) {
    throw new Error('Invalid regl instance')
  }

  return withPose({
    vert: `
    precision mediump float;
    uniform mat4 projection, view;
    #WITH_POSE

    attribute vec3 point;
    attribute vec4 color;
    varying vec4 fragColor;

    void main () {
      fragColor = color;
      vec3 p = applyPose(point);
      gl_Position = projection * view * vec4(p, 1);
    }
    `,
    frag: `
      precision mediump float;
      varying vec4 fragColor;
      void main () {
        gl_FragColor = fragColor;
      }
    `,
    primitive: 'lines',
    attributes: {
      point: (context: any, props: any) => {
        const count = props.count || 5
        const cellSize = props.cellSize || 1.0
        const color = props.color || DEFAULT_GRID_COLOR
        const cachedData = generateGridData(regl, count, cellSize, color)
        return cachedData.pointBuffer
      },
      color: (context: any, props: any) => {
        const count = props.count || 5
        const cellSize = props.cellSize || 1.0
        const color = props.color || DEFAULT_GRID_COLOR
        const cachedData = generateGridData(regl, count, cellSize, color)
        return cachedData.colorBuffer
      }
    },
    count: (context: any, props: any) => {
      const count = props.count || 5
      const cellSize = props.cellSize || 1.0
      const color = props.color || DEFAULT_GRID_COLOR
      const cachedData = generateGridData(regl, count, cellSize, color)
      return cachedData.totalCount
    },
    blend: defaultBlend
  })
}

export default grid
