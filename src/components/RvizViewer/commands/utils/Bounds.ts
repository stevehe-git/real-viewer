/**
 * Bounds 工具类
 * 完全基于 regl-worldview 的 Bounds.js 实现
 */
import type { Point } from '../../types'

// a single min/max value
class Bound {
  min: number
  max: number

  constructor() {
    this.min = Number.MAX_SAFE_INTEGER
    this.max = Number.MIN_SAFE_INTEGER
  }
  // update the bound based on a value
  update(value: number): void {
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
  }
}

// represents x, y, and z min & max bounds for a 3d scene
export default class Bounds {
  x: Bound
  y: Bound
  z: Bound

  constructor() {
    this.x = new Bound()
    this.y = new Bound()
    this.z = new Bound()
  }

  // update the bounds based on a point
  update(point: Point): void {
    this.x.update(point.x)
    this.y.update(point.y)
    this.z.update(point.z)
  }
}
