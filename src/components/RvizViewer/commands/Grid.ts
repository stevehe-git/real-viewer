/**
 * Grid 命令
 * 完全基于 regl-worldview 的 Grid.js 实现
 */
import type { Regl } from '../../types'
import { withPose } from './utils/commandUtils'

const DEFAULT_GRID_COLOR: [number, number, number, number] = [0.3, 0.3, 0.3, 1]

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
        const points: number[][] = []
        const count = props.count || 5
        const cellSize = props.cellSize || 1.0
        const bound = count * cellSize
        
        // 绘制内部网格线
        for (let i = -count; i <= count; i++) {
          const pos = i * cellSize
          // 垂直线
          points.push([-bound, pos, 0])
          points.push([bound, pos, 0])
          // 水平线
          points.push([pos, -bound, 0])
          points.push([pos, bound, 0])
        }
        
        // 绘制边界框（封边）
        // 左边界
        points.push([-bound, -bound, 0])
        points.push([-bound, bound, 0])
        // 右边界
        points.push([bound, -bound, 0])
        points.push([bound, bound, 0])
        // 下边界
        points.push([-bound, -bound, 0])
        points.push([bound, -bound, 0])
        // 上边界
        points.push([-bound, bound, 0])
        points.push([bound, bound, 0])
        
        return points
      },
      color: (context: any, props: any) => {
        const color = props.color || DEFAULT_GRID_COLOR
        const count = props.count || 5
        // 内部网格线：(count * 2 + 1) * 4 个点（每条线2个点）
        // 边界框：8 个点（4条边，每条边2个点）
        const totalPoints = (count * 2 + 1) * 4 + 8
        return new Array(totalPoints).fill(color)
      }
    },
    count: (context: any, props: any) => {
      const count = props.count || 5
      // 内部网格线：(count * 2 + 1) * 4 个点（每条线2个点）
      // 边界框：8 个点
      const totalCount = (count * 2 + 1) * 4 + 8
      return totalCount
    }
  })
}

export default grid
