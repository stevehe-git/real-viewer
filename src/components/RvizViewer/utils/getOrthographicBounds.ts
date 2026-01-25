/**
 * 正交投影边界计算工具函数
 * 完全基于 regl-worldview 的 getOrthographicBounds.js 实现
 */

/**
 * 边界框类
 */
class BoundingBox {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number

  constructor(left: number, top: number) {
    this.left = left
    this.top = top
    this.right = -left
    this.bottom = -top
    this.width = Math.abs(left) * 2
    this.height = Math.abs(top) * 2
  }
}

/**
 * 计算正交投影的边界框
 * @param zDistance Z 轴距离
 * @param width 宽度
 * @param height 高度
 * @returns 边界框对象
 */
export default function getOrthographicBounds(
  zDistance: number,
  width: number,
  height: number
): BoundingBox {
  const aspect = width / height
  // 永远不低于地面
  const distanceToGround = Math.abs(zDistance)
  const left = (-distanceToGround / 2) * aspect
  const top = distanceToGround / 2
  return new BoundingBox(left, top)
}
