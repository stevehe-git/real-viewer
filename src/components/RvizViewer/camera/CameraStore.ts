/**
 * 相机状态管理
 * 完全基于 regl-worldview 的 CameraStore 实现
 */
import { vec3, quat } from 'gl-matrix'
import type { Vec2, Vec3, Vec4 } from '../types'

export type CameraState = {
  distance: number
  perspective: boolean
  phi: number
  target: Vec3
  targetOffset: Vec3
  targetOrientation: Vec4
  thetaOffset: number
  fovy: number
  near: number
  far: number
}

// we use up on the +z axis
const UNIT_Z_VECTOR: Vec3 = Object.freeze([0, 0, 1]) as Vec3
// reusable array for intermediate calculations
const TEMP_QUAT = quat.create()

export const DEFAULT_CAMERA_STATE: CameraState = {
  distance: 15,
  perspective: true,
  phi: Math.PI / 4,
  target: [0, 0, 0],
  targetOffset: [0, 0, 0],
  targetOrientation: [0, 0, 0, 1],
  thetaOffset: 0,
  fovy: Math.PI / 4,
  near: 0.01,
  far: 5000
}

function distanceAfterZoom(startingDistance: number, zoomPercent: number): number {
  // keep distance above 0 so that percentage-based zoom always works
  return Math.max(0.001, startingDistance * (1 - zoomPercent / 100))
}

export default class CameraStore {
  state: CameraState = DEFAULT_CAMERA_STATE
  _onChange: (state: CameraState) => void

  constructor(
    handler: (state: CameraState) => void = () => {},
    initialCameraState: Partial<CameraState> = DEFAULT_CAMERA_STATE
  ) {
    this._onChange = handler
    this.setCameraState(initialCameraState)
  }

  setCameraState = (state: Partial<CameraState>) => {
    // Fill in missing properties from DEFAULT_CAMERA_STATE.
    // Mutate the `state` parameter instead of copying -- this
    // matches the previous behavior of this method, which didn't
    // fill in missing properties but also didn't copy `state`.
    const filledState: CameraState = { ...DEFAULT_CAMERA_STATE }
    for (const [key, value] of Object.entries(state)) {
      if (value != null) {
        ;(filledState as any)[key] = value
      }
    }
    // `state` must be a valid CameraState now, because we filled in
    // missing properties from DEFAULT_CAMERA_STATE.
    this.state = filledState
  }

  cameraRotate = ([x, y]: Vec2) => {
    // This can happen in 2D mode, when both e.movementX and e.movementY are evaluated as negative and mouseX move is 0
    if (x === 0 && y === 0) {
      return
    }
    const { thetaOffset, phi } = this.state
    this.setCameraState({
      ...this.state,
      thetaOffset: thetaOffset - x,
      phi: Math.max(0, Math.min(phi + y, Math.PI))
    })
    this._onChange(this.state)
  }

  // move the camera along x, y axis; do not move up/down
  cameraMove = ([x, y]: Vec2) => {
    // moveX and moveY both be 0 sometimes
    if (x === 0 && y === 0) {
      return
    }

    const { targetOffset, thetaOffset } = this.state

    // rotate around z axis so the offset is in the target's reference frame
    const result: Vec3 = [x, y, 0]
    const offset = vec3.transformQuat(
      result,
      result,
      quat.setAxisAngle(TEMP_QUAT, UNIT_Z_VECTOR, -thetaOffset)
    )

    this.setCameraState({
      ...this.state,
      targetOffset: vec3.add([0, 0, 0], targetOffset, offset) as Vec3
    })
    this._onChange(this.state)
  }

  cameraZoom = (zoomPercent: number) => {
    const { distance } = this.state
    const newDistance: number = distanceAfterZoom(distance, zoomPercent)
    if (distance === newDistance) {
      return
    }

    this.setCameraState({
      ...this.state,
      distance: newDistance
    })
    this._onChange(this.state)
  }
}
