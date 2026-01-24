/**
 * 三维可视化类型定义
 */

// 基础向量和矩阵类型（基于 regl-worldview）
export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
]

// 视图端口类型
export type Viewport = Vec4 // [x, y, width, height]

// 兼容旧版本的 CameraState（用于渲染器）
export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  fov: number
  near: number
  far: number
}

export interface Viewport {
  width: number
  height: number
}

export interface RenderOptions {
  clearColor?: [number, number, number, number]
  enableGrid?: boolean
  enableAxes?: boolean
  gridSize?: number
  gridDivisions?: number
  gridColor?: [number, number, number, number]
}

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface Color {
  r: number
  g: number
  b: number
  a?: number
}

export interface VisualizationConfig {
  visible: boolean
  color?: Color
  opacity?: number
}

export interface PointCloudData {
  points: Point3D[]
  colors?: Color[]
  pointSize?: number
}

export interface PathData {
  waypoints: Point3D[]
  color?: Color
  lineWidth?: number
  showPoints?: boolean
}
