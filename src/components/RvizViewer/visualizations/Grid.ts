/**
 * 网格可视化组件
 */
import type regl from 'regl'
import { vertexShader, fragmentShader } from '../utils/shaders'

export class Grid {
  private drawCommand: regl.DrawCommand
  private size: number
  private divisions: number

  constructor(reglContext: regl.Regl, size: number = 10, divisions: number = 10) {
    this.size = size
    this.divisions = divisions
    this.drawCommand = this.createGridCommand(reglContext)
  }

  private createGridCommand(reglContext: regl.Regl): regl.DrawCommand {
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    const step = this.size / this.divisions
    const halfSize = this.size / 2

    // 创建网格线
    for (let i = 0; i <= this.divisions; i++) {
      const x = -halfSize + i * step
      
      // 垂直线
      positions.push(x, 0, -halfSize)
      positions.push(x, 0, halfSize)
      
      // 主网格线更亮
      const isMainLine = i === 0 || i === this.divisions || i === Math.floor(this.divisions / 2)
      const brightness = isMainLine ? 0.5 : 0.2
      colors.push(brightness, brightness, brightness)
      colors.push(brightness, brightness, brightness)

      const baseIndex = i * 2
      indices.push(baseIndex, baseIndex + 1)

      // 水平线
      const z = -halfSize + i * step
      positions.push(-halfSize, 0, z)
      positions.push(halfSize, 0, z)
      
      colors.push(brightness, brightness, brightness)
      colors.push(brightness, brightness, brightness)

      const hBaseIndex = (this.divisions + 1) * 2 + i * 2
      indices.push(hBaseIndex, hBaseIndex + 1)
    }

    return reglContext({
      vert: vertexShader,
      frag: fragmentShader,
      attributes: {
        position: reglContext.buffer(positions),
        color: reglContext.buffer(colors)
      },
      uniforms: {
        projection: reglContext.prop<{}, 'projection'>('projection'),
        view: reglContext.prop<{}, 'view'>('view'),
        model: reglContext.prop<{}, 'model'>('model'),
        opacity: 1.0
      },
      elements: reglContext.elements(indices),
      primitive: 'lines',
      lineWidth: 1
    })
  }

  render(
    projection: regl.Mat4,
    view: regl.Mat4,
    model: regl.Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  ): void {
    this.drawCommand({ projection, view, model })
  }

  updateSize(size: number, divisions: number): void {
    this.size = size
    this.divisions = divisions
    // 重新创建绘制命令
    // 注意：实际应用中可能需要重新初始化
  }
}
