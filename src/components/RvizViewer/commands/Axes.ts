/**
 * Axes 命令
 * 完全基于 regl-worldview 的 Axes.js 实现
 * 使用圆柱体（Cylinders）实现坐标轴：红色X轴、绿色Y轴、蓝色Z轴
 */
import { quat } from 'gl-matrix'
import type { Point, Cylinder } from '../types'

// 坐标轴长度（相对于网格大小，使其在视觉上更明显）
const AXIS_LENGTH = 1.0

// 圆柱体半径（坐标轴的粗细）
const AXIS_RADIUS = 0.02

// 原点
const origin: Point = { x: 0, y: 0, z: 0 }

/**
 * 创建旋转四元数
 * @param axis 旋转轴 (0=x, 1=y, 2=z)
 * @param angle 旋转角度（弧度）
 */
function createRotationQuaternion(axis: 'x' | 'y' | 'z', angle: number): { x: number; y: number; z: number; w: number } {
  const q = quat.create()
  switch (axis) {
    case 'x':
      quat.setAxisAngle(q, [1, 0, 0], angle)
      break
    case 'y':
      quat.setAxisAngle(q, [0, 1, 0], angle)
      break
    case 'z':
      quat.setAxisAngle(q, [0, 0, 1], angle)
      break
  }
  return { x: q[0], y: q[1], z: q[2], w: q[3] }
}

// X轴：红色，从原点向右延伸（正X方向，右手系）
// 圆柱体默认沿Z轴，需要绕Y轴旋转-90度使其指向+X方向（修正方向）
const xAxisRotation = createRotationQuaternion('y', -Math.PI / 2)
const xAxis: Cylinder = {
  pose: {
    position: { x: AXIS_LENGTH / 2, y: 0, z: 0 }, // 圆柱体中心在轴的中点
    orientation: xAxisRotation
  },
  points: [origin], // 圆柱体的位置由pose.position指定
  scale: { x: AXIS_RADIUS, y: AXIS_RADIUS, z: AXIS_LENGTH }, // x和y是半径，z是长度
  color: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 } // 纯红色 (RGB: 255, 0, 0)
}

// Y轴：绿色，从原点向前延伸（正Y方向，右手系）
// 圆柱体默认沿Z轴，需要绕X轴旋转-90度使其指向+Y方向（修正方向）
const yAxisRotation = createRotationQuaternion('x', -Math.PI / 2)
const yAxis: Cylinder = {
  pose: {
    position: { x: 0, y: AXIS_LENGTH / 2, z: 0 }, // 圆柱体中心在轴的中点
    orientation: yAxisRotation
  },
  points: [origin],
  scale: { x: AXIS_RADIUS, y: AXIS_RADIUS, z: AXIS_LENGTH },
  color: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 } // 纯绿色 (RGB: 0, 255, 0)
}

// Z轴：蓝色，从原点向上延伸（正Z方向）
// 圆柱体默认就是沿Z轴的，不需要旋转
const zAxis: Cylinder = {
  pose: {
    position: { x: 0, y: 0, z: AXIS_LENGTH / 2 }, // 圆柱体中心在轴的中点
    orientation: { x: 0, y: 0, z: 0, w: 1 } // 单位四元数，无旋转
  },
  points: [origin],
  scale: { x: AXIS_RADIUS, y: AXIS_RADIUS, z: AXIS_LENGTH },
  color: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 } // 纯蓝色 (RGB: 0, 0, 255)
}

type Axis = Cylinder

type Props = {
  children?: Axis[]
}

// Renders cylinders along the x, y, and z axes; useful for debugging.
export default function Axes(props: Props = {}) {
  const children = props.children || [xAxis, yAxis, zAxis]
  // Axes 返回默认的 axes 数据，实际渲染由调用者使用 cylinders 命令完成
  return children
}

Axes.defaultProps = {
  children: [xAxis, yAxis, zAxis]
}

// 导出默认的 axes 数据
export const defaultAxes = [xAxis, yAxis, zAxis]
