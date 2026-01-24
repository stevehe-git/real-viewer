/**
 * Cubes 命令
 * 完全基于 regl-worldview 的 Cubes.js 实现
 */
import type { Cube } from '../types'
import fromGeometry from './utils/fromGeometry'
import withRenderStateOverrides from './utils/withRenderStateOverrides'

export const cubes = withRenderStateOverrides(
  fromGeometry(
    [
      // bottom face corners
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      // top face corners
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5]
    ],
    [
      // bottom
      [0, 1, 2],
      [1, 2, 3],
      // top
      [4, 5, 6],
      [5, 6, 7],
      // left
      [0, 2, 4],
      [2, 4, 6],
      // right
      [1, 3, 5],
      [3, 5, 7],
      // front
      [2, 3, 6],
      [3, 6, 7],
      // back
      [0, 1, 4],
      [1, 4, 5]
    ]
  )
)

export default function Cubes(props: { children: Cube[] }) {
  return cubes
}
