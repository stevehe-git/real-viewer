/**
 * 相机工具函数
 * 基于 regl-worldview 的实现
 */

/**
 * gl-matrix clone of three.js Vector3.setFromSpherical
 * phi: polar angle (between poles, 0 - pi)
 * theta: azimuthal angle (around equator, 0 - 2pi)
 */
export function fromSpherical(
  out: number[],
  r: number,
  theta: number,
  phi: number
): [number, number, number] {
  const rSinPhi = r * Math.sin(phi)
  out[0] = rSinPhi * Math.sin(theta)
  out[1] = r * Math.cos(phi)
  out[2] = rSinPhi * Math.cos(theta)
  return out as [number, number, number]
}

/**
 * 获取正交投影边界
 */
export interface BoundingBox {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export function getOrthographicBounds(
  zDistance: number,
  width: number,
  height: number
): BoundingBox {
  const aspect = width / height
  // never go below ground level
  const distanceToGround = Math.abs(zDistance)
  const left = (-distanceToGround / 2) * aspect
  const top = distanceToGround / 2
  return {
    left,
    top,
    right: -left,
    bottom: -top,
    width: Math.abs(left) * 2,
    height: Math.abs(top) * 2
  }
}
