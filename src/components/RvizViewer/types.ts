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

// 视图端口类型（用于 cameraProject）
export type Viewport = Vec4 // [x, y, width, height]

// regl-worldview 类型定义
export type Dimensions = {
  width: number
  height: number
  left: number
  top: number
}

export type RawCommand = (regl: any) => any
export type CompiledReglCommand = (props: any, isHitmap?: boolean) => void

export type CameraCommand = {
  getProjection(): Mat4
  getView(): Mat4
  toScreenCoord(viewport: Viewport, point: Vec3): [number, number, number] | undefined
  draw(props: any, callback: (ctx: any) => void): void
  viewportWidth: number
  viewportHeight: number
  cameraState: import('./camera/CameraStore').CameraState
}

export type GetChildrenForHitmap<T> = (
  props: T,
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[]
) => T | null

export type AssignNextColorsFn = (object: any, count: number) => Vec4[]

export type ObjectHitmapId = number

export type MouseEventObject = {
  object: any
  instanceIndex?: number
}

export type PaintFn = () => void

export type DrawInput = {
  instance: any
  reglCommand: RawCommand<any>
  children: any
  layerIndex?: number
  getChildrenForHitmap?: GetChildrenForHitmap<any>
}

// 兼容旧版本的 CameraState（用于渲染器）
export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  fov: number
  near: number
  far: number
}

// Viewport 接口已由上面的 Viewport 类型定义（Vec4）替代
// 如果需要对象形式，使用 Dimensions

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

// regl-worldview 类型定义
export type Point = Point3D
export type Orientation = { x: number; y: number; z: number; w: number }
export type Pose = {
  position: Point | Vec3
  orientation: Orientation | Vec4
}
export type PointType = {
  pose: Pose
  points: Point[] | Vec3[]
  scale?: { x: number; y: number; z: number }
  color?: Color
  colors?: Color[] | Vec4[]
}
export type Line = {
  pose: Pose
  points: Point[] | Vec3[]
  scale?: { x: number; y: number; z: number }
  color?: Color
  colors?: Color[] | Vec4[]
  closed?: boolean
  primitive?: 'lines' | 'line strip'
  scaleInvariant?: boolean
  alpha?: number
  depth?: { enable: boolean; mask: boolean }
  blend?: typeof import('./commands/utils/commandUtils').defaultReglBlend
}
export type Regl = any // regl.Regl 类型
export type ReglCommand = any // regl.DrawCommand 类型
export type TriangleList = {
  pose: Pose
  points: Point[] | Vec3[]
  colors?: Color[] | Vec4[]
  color?: Color | Vec4
  scale?: { x: number; y: number; z: number } | Vec3
  depth?: { enable: boolean; mask: boolean; func?: string }
  blend?: typeof import('./commands/utils/commandUtils').defaultReglBlend
  onlyRenderInHitmap?: boolean
}
export type SphereList = {
  pose: Pose
  points: Point[] | Vec3[]
  colors?: Color[] | Vec4[]
  color?: Color | Vec4
  scale?: { x: number; y: number; z: number } | Vec3
  depth?: { enable: boolean; mask: boolean }
  blend?: typeof import('./commands/utils/commandUtils').defaultReglBlend
}
export type DepthState = { enable: boolean; mask?: boolean; func?: string }
export type BlendState = typeof import('./commands/utils/commandUtils').defaultReglBlend
export type Cube = {
  pose: Pose
  points: Point[] | Vec3[]
  colors?: Color[] | Vec4[]
  color?: Color | Vec4
  scale?: { x: number; y: number; z: number } | Vec3
  depth?: { enable: boolean; mask: boolean }
  blend?: BlendState
}
export type Cylinder = {
  pose: Pose
  points: Point[] | Vec3[]
  colors?: Color[] | Vec4[]
  color?: Color | Vec4
  scale?: { x: number; y: number; z: number } | Vec3
  depth?: { enable: boolean; mask: boolean }
  blend?: BlendState
}
export type Cone = {
  pose: Pose
  points: Point[] | Vec3[]
  colors?: Color[] | Vec4[]
  color?: Color | Vec4
  scale?: { x: number; y: number; z: number } | Vec3
  depth?: { enable: boolean; mask: boolean }
  blend?: BlendState
}
export type Arrow = {
  pose: Pose
  points?: Point[] | Vec3[]
  color?: Color | Vec4
  scale?: { x: number; y: number; z: number } | Vec3
  depth?: { enable: boolean; mask: boolean }
  blend?: BlendState
  originalMarker?: any
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
