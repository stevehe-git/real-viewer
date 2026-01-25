/**
 * 四元数转欧拉角工具函数
 * 完全基于 regl-worldview 的 eulerFromQuaternion.js 实现
 */

import { mat3 } from 'gl-matrix'
import type { Vec3, Vec4 } from '../types'

const scratch = [0, 0, 0, 0, 0, 0, 0, 0, 0]

/**
 * gl-matrix 版本的 three.js Euler.setFromQuaternion
 * 假设默认 XYZ 顺序
 * @param out 输出的欧拉角数组 [x, y, z]
 * @param q 四元数 [x, y, z, w]
 * @returns 欧拉角数组
 */
export default function eulerFromQuaternion(out: number[], q: Vec4): Vec3 {
  const m = mat3.fromQuat(scratch, q)
  const m11 = m[0]
  const m12 = m[3]
  const m13 = m[6]
  const m22 = m[4]
  const m23 = m[7]
  const m32 = m[5]
  const m33 = m[8]

  out[1] = Math.asin(m13 < -1 ? -1 : m13 > 1 ? 1 : m13)
  if (Math.abs(m13) < 0.99999) {
    out[0] = Math.atan2(-m23, m33)
    out[2] = Math.atan2(-m12, m11)
  } else {
    out[0] = Math.atan2(m32, m22)
    out[2] = 0
  }
  return out as Vec3
}
