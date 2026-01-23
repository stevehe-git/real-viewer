/**
 * 相机状态管理（基于 regl-worldview 的 CameraStore）
 */
import { vec3, quat } from 'gl-matrix'
import type { CameraState } from '../types'

export interface WorldviewCameraState {
  distance: number
  perspective: boolean
  phi: number // 垂直角度（0 到 PI）
  target: [number, number, number]
  targetOffset: [number, number, number]
  targetOrientation: [number, number, number, number] // 四元数
  thetaOffset: number // 水平角度偏移
  fovy: number
  near: number
  far: number
}

const UNIT_Z_VECTOR: [number, number, number] = [0, 0, 1]
const TEMP_QUAT = quat.create()

export const DEFAULT_CAMERA_STATE: WorldviewCameraState = {
  distance: 10,
  perspective: true,
  phi: Math.PI / 4, // 45度
  target: [0, 0, 0],
  targetOffset: [0, 0, 0],
  targetOrientation: [0, 0, 0, 1],
  thetaOffset: 1.0,
  fovy: Math.PI / 4,
  near: 0.1,
  far: 1000
}

function distanceAfterZoom(startingDistance: number, zoomPercent: number): number {
  return Math.max(0.001, startingDistance * (1 - zoomPercent / 100))
}

export class CameraStore {
  state: WorldviewCameraState
  private onChange: (state: WorldviewCameraState) => void

  constructor(
    handler: (state: WorldviewCameraState) => void = () => {},
    initialCameraState?: Partial<WorldviewCameraState>
  ) {
    this.onChange = handler
    this.state = { ...DEFAULT_CAMERA_STATE, ...initialCameraState }
  }

  /**
   * 旋转相机（基于 regl-worldview 的 cameraRotate）
   */
  cameraRotate([x, y]: [number, number]): void {
    if (x === 0 && y === 0) return

    const { thetaOffset, phi } = this.state
    this.state = {
      ...this.state,
      thetaOffset: thetaOffset - x,
      phi: Math.max(0, Math.min(phi + y, Math.PI))
    }
    this.onChange(this.state)
  }

  /**
   * 平移相机（基于 regl-worldview 的 cameraMove）
   */
  cameraMove([x, y]: [number, number]): void {
    if (x === 0 && y === 0) return

    const { targetOffset, thetaOffset } = this.state

    // 根据 thetaOffset 旋转偏移量
    const result: [number, number, number] = [x, y, 0]
    const rotation = quat.setAxisAngle(TEMP_QUAT, UNIT_Z_VECTOR, -thetaOffset)
    const offset = vec3.transformQuat([0, 0, 0], result, rotation) as [number, number, number]

    this.state = {
      ...this.state,
      targetOffset: vec3.add([0, 0, 0], targetOffset, offset) as [number, number, number]
    }
    this.onChange(this.state)
  }

  /**
   * 缩放相机（基于 regl-worldview 的 cameraZoom）
   */
  cameraZoom(zoomPercent: number): void {
    const { distance } = this.state
    const newDistance = distanceAfterZoom(distance, zoomPercent)
    
    if (distance === newDistance) return

    this.state = {
      ...this.state,
      distance: newDistance
    }
    this.onChange(this.state)
  }

  /**
   * 转换为标准 CameraState（基于 regl-worldview 的 positionSelector）
   */
  toCameraState(): CameraState {
    const { distance, phi, thetaOffset, target, targetOffset, fovy, near, far } = this.state
    
    // 基于 regl-worldview 的 fromSpherical 逻辑
    // fromSpherical: x = r * sin(phi) * sin(theta), y = r * cos(phi), z = r * sin(phi) * cos(theta)
    const rSinPhi = distance * Math.sin(phi)
    const x = rSinPhi * Math.sin(thetaOffset)
    const y = distance * Math.cos(phi)
    const z = rSinPhi * Math.cos(thetaOffset)
    
    // regl-worldview 的坐标系统转换（poles 在 y 轴，需要转换到 z 轴）
    // 从 cameraStateSelectors.js 的 positionSelector: position[0] = -x, position[1] = -z, position[2] = y
    const position: [number, number, number] = [-x, -z, y]

    // 计算实际目标点（包含偏移）
    const actualTarget: [number, number, number] = [
      target[0] + targetOffset[0],
      target[1] + targetOffset[1],
      target[2] + targetOffset[2]
    ]

    return {
      position: [
        actualTarget[0] + position[0],
        actualTarget[1] + position[1],
        actualTarget[2] + position[2]
      ],
      target: actualTarget,
      up: [0, 0, 1],
      fov: fovy,
      near,
      far
    }
  }

  /**
   * 重置相机
   */
  reset(): void {
    this.state = { ...DEFAULT_CAMERA_STATE }
    this.onChange(this.state)
  }

  /**
   * 获取相机距离
   */
  getDistance(): number {
    return this.state.distance
  }
}
