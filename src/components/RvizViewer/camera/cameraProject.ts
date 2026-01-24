/**
 * 相机投影工具
 * 完全基于 regl-worldview 的 cameraProject 实现
 * Copied from Jam3/camera-project
 * in order to replace gl-vec4 dependency with gl-matrix
 */
import { vec4 } from 'gl-matrix'
import type { Vec3, Vec4, Mat4 } from '../types'

const NEAR_RANGE = 0
const FAR_RANGE = 1
const tmp4 = vec4.create()

export default function cameraProject(
  out: Vec4,
  vec: Vec3,
  viewport: Vec4,
  combinedProjView: Mat4
): Vec4 {
  const vX = viewport[0]
  const vY = viewport[1]
  const vWidth = viewport[2]
  const vHeight = viewport[3]
  const n = NEAR_RANGE
  const f = FAR_RANGE

  // convert: clip space -> NDC -> window coords
  // implicit 1.0 for w component
  vec4.set(tmp4, vec[0], vec[1], vec[2], 1.0)

  // transform into clip space
  vec4.transformMat4(tmp4, tmp4, combinedProjView)

  // now transform into NDC
  const w = tmp4[3]
  if (w !== 0) {
    // how to handle infinity here?
    tmp4[0] = tmp4[0] / w
    tmp4[1] = tmp4[1] / w
    tmp4[2] = tmp4[2] / w
  }

  // and finally into window coordinates
  // the fourth component is (1/clip.w)
  // which is the same as gl_FragCoord.w
  out[0] = vX + (vWidth / 2) * tmp4[0] + (0 + vWidth / 2)
  out[1] = vY + (vHeight / 2) * tmp4[1] + (0 + vHeight / 2)
  out[2] = ((f - n) / 2) * tmp4[2] + (f + n) / 2
  out[3] = w === 0 ? 0 : 1 / w
  return out
}
