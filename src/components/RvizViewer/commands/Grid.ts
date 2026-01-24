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

    attribute vec3 point;
    attribute vec4 color;
    varying vec4 fragColor;

    void main () {
      fragColor = color;
      vec3 p = point;
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
        const bound = props.count
        for (let i = -props.count; i < props.count; i++) {
          points.push([-bound, i, 0])
          points.push([bound, i, 0])
          points.push([i, -bound, 0])
          points.push([i, bound, 0])
        }
        return points
      },
      color: (context: any, props: any) => {
        const color = props.color || DEFAULT_GRID_COLOR
        return new Array(props.count * 4 * 2).fill(color)
      }
    },
    count: (context: any, props: any) => {
      // 8 points per count
      const count = props.count * 4 * 2
      return count
    }
  })
}

export default grid
