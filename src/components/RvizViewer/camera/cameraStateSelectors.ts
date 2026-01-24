/**
 * 相机状态选择器
 * 完全基于 regl-worldview 的 cameraStateSelectors 实现
 */
import { vec3, quat, mat4 } from 'gl-matrix'
import type { Vec4, Vec3, Mat4 } from '../types'
import type { CameraState } from './CameraStore'
import { fromSpherical } from './utils'

const UNIT_X_VECTOR: Vec3 = Object.freeze([1, 0, 0]) as Vec3

// reusable arrays for intermediate calculations
const TEMP_VEC3 = vec3.create()
const TEMP_MAT = mat4.create()
const TEMP_QUAT = quat.create()

const stateSelector = (state: CameraState) => state

const perspectiveSelector = (state: CameraState) => state.perspective
const distanceSelector = (state: CameraState) => state.distance
const phiSelector = (state: CameraState) => state.phi
const thetaOffsetSelector = (state: CameraState) => state.thetaOffset
const targetOrientationSelector = (state: CameraState) => state.targetOrientation

// the heading direction of the target
const targetHeadingSelector = (state: CameraState): number => {
  const targetOrientation = targetOrientationSelector(state)
  const out = vec3.transformQuat(TEMP_VEC3, UNIT_X_VECTOR, targetOrientation)
  const heading = -Math.atan2(out[1], out[0])
  return heading
}

// orientation of the camera
const orientationSelector = (state: CameraState): Vec4 => {
  const perspective = perspectiveSelector(state)
  const phi = phiSelector(state)
  const thetaOffset = thetaOffsetSelector(state)
  
  const result = quat.identity(quat.create())
  quat.rotateZ(result, result, -thetaOffset)

  // phi is ignored in 2D mode
  if (perspective) {
    quat.rotateX(result, result, phi)
  }
  return result
}

// position of the camera
const positionSelector = (state: CameraState): Vec3 => {
  const thetaOffset = thetaOffsetSelector(state)
  const phi = phiSelector(state)
  const distance = distanceSelector(state)
  
  const position = fromSpherical([], distance, thetaOffset, phi)

  // poles are on the y-axis in spherical coordinates; rearrange so they are on the z axis
  const [x, y, z] = position
  position[0] = -x
  position[1] = -z
  position[2] = y

  return position
}

/*
Get the view matrix, which transforms points from world coordinates to camera coordinates.

An equivalent and easier way to think about this transformation is that it takes the camera from
its actual position/orientation in the world, and moves it to have position=0,0,0 and orientation=0,0,0,1.

We build up this transformation in 5 steps as demonstrated below:
   T = target
   < = direction of target
   * = target with offset (position that the camera is looking at)
   C = camera (always points toward *)

Starting point: actual positions in world coordinates

  |      *
  |  <T   C
  |
  +--------

Step 1: translate target to the origin

  |
  |  *
 <T---C----

Step 2: rotate around the origin so the target points forward
(Here we use the target's heading only, ignoring other components of its rotation)

  |
  ^
  T--------
  |
  | *
  C

Step 3: translate the target-with-offset point to be at the origin

 ^
 T|
  |
  *--------
 C|
  |


Step 4: translate the camera to be at the origin
(Steps 3 and 4 are both translations, but they're kept separate because it's easier
to conceptualize: 3 uses the targetOffset and 4 uses the distance+thetaOffset+phi.)

 ^
 T
 |
 |*
 C--------
 |

Step 5: rotate the camera to point forward

 \
  T  |
     *
     C--------
     |

*/
const viewSelector = (state: CameraState): Mat4 => {
  const orientation = orientationSelector(state)
  const position = positionSelector(state)
  const targetHeading = targetHeadingSelector(state)
  const { target, targetOffset, perspective } = state
  
  const m = mat4.identity(mat4.create())

  // apply the steps described above in reverse because we use right-multiplication

  // 5. rotate camera to point forward
  mat4.multiply(m, m, mat4.fromQuat(TEMP_MAT, quat.invert(TEMP_QUAT, orientation)))

  // 4. move camera to the origin
  if (perspective) {
    mat4.translate(m, m, vec3.negate(TEMP_VEC3, position))
  }

  // 3. move center to the origin
  mat4.translate(m, m, vec3.negate(TEMP_VEC3, targetOffset))

  // 2. rotate target to point forward
  mat4.rotateZ(m, m, targetHeading)

  // 1. move target to the origin
  const negatedTarget = vec3.negate(TEMP_VEC3, target)
  if (!perspective) {
    // if using orthographic camera ensure the distance from "ground"
    // stays large so no reasonably tall item goes past the camera
    negatedTarget[2] = -2500
  }
  mat4.translate(m, m, negatedTarget)

  return m
}

const billboardRotation = (state: CameraState): Mat4 => {
  const orientation = orientationSelector(state)
  const targetHeading = targetHeadingSelector(state)
  
  const m = mat4.identity(mat4.create())
  mat4.rotateZ(m, m, -targetHeading)
  mat4.multiply(m, m, mat4.fromQuat(TEMP_MAT, orientation))
  return m
}

export default {
  orientation: orientationSelector,
  position: positionSelector,
  targetHeading: targetHeadingSelector,
  view: viewSelector,
  billboardRotation
}
