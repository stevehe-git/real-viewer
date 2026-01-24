/**
 * Axes 命令
 * 完全基于 regl-worldview 的 Axes.js 实现
 */
import type { Point, Vec3, Line } from '../../types'
import { lines } from './Lines'

const pointToVec3 = (p: Vec3): Point => ({
  x: p[0],
  y: p[1],
  z: p[2]
})

const scale = 10
const xAxisPoints = [[-scale, 0, 0], [scale, 0, 0]].map(pointToVec3)
const yAxisPoints = [[0, -scale, 0], [0, scale, 0]].map(pointToVec3)
const zAxisPoints = [[0, 0, -scale], [0, 0, scale]].map(pointToVec3)
const pose = {
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  position: { x: 0, y: 0, z: 0 }
}
const xAxis: Line = {
  pose,
  points: xAxisPoints,
  scale: { x: 0.5, y: 0.5, z: 0.5 },
  color: { r: 0.95, g: 0.26, b: 0.4, a: 1 }
}
const yAxis: Line = {
  pose,
  points: yAxisPoints,
  scale: { x: 0.5, y: 0.5, z: 0.5 },
  color: { r: 0.02, g: 0.82, b: 0.49, a: 1 }
}
const zAxis: Line = {
  pose,
  points: zAxisPoints,
  scale: { x: 0.5, y: 0.5, z: 0.5 },
  color: { r: 0.11, g: 0.51, b: 0.92, a: 1 }
}

type Axis = Line

type Props = {
  children?: Axis[]
}

// Renders lines along the x, y, and z axes; useful for debugging.
export default function Axes(props: Props = {}) {
  const children = props.children || [xAxis, yAxis, zAxis]
  // Axes 返回默认的 axes 数据，实际渲染由调用者使用 lines 命令完成
  return children
}

Axes.defaultProps = {
  children: [xAxis, yAxis, zAxis]
}

// 导出默认的 axes 数据
export const defaultAxes = [xAxis, yAxis, zAxis]
