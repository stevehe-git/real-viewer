/**
 * Cones 命令
 * 完全基于 regl-worldview 的 Cones.js 实现
 */
import type { Cone } from '../types'
import fromGeometry from './utils/fromGeometry'
import withRenderStateOverrides from './utils/withRenderStateOverrides'
import { createCylinderGeometry } from './Cylinders'

const { points, sideFaces, endCapFaces } = createCylinderGeometry(30, true)

export const cones = withRenderStateOverrides(fromGeometry(points, sideFaces.concat(endCapFaces)))

export default function Cones(props: { children: Cone[] }) {
  return cones
}
