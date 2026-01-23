/**
 * 三维可视化类型定义
 */

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
