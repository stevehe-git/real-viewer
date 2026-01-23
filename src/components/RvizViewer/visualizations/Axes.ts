/**
 * 坐标轴可视化组件
 */
import type regl from 'regl'
import { vertexShader, fragmentShader } from '../utils/shaders'

export class Axes {
  private drawCommand: regl.DrawCommand
  private length: number

  constructor(reglContext: regl.Regl, length: number = 1) {
    this.length = length
    this.drawCommand = this.createAxesCommand(reglContext)
  }

  private createAxesCommand(reglContext: regl.Regl): regl.DrawCommand {
    // X轴 - 红色
    // Y轴 - 绿色
    // Z轴 - 蓝色
    const positions = [
      0, 0, 0, this.length, 0, 0,  // X轴
      0, 0, 0, 0, this.length, 0,  // Y轴
      0, 0, 0, 0, 0, this.length   // Z轴
    ]

    const colors = [
      1, 0, 0, 1, 0, 0,  // X轴 - 红色
      0, 1, 0, 0, 1, 0,  // Y轴 - 绿色
      0, 0, 1, 0, 0, 1   // Z轴 - 蓝色
    ]

    const indices = [0, 1, 2, 3, 4, 5]

    return reglContext({
      vert: vertexShader,
      frag: fragmentShader,
      attributes: {
        position: reglContext.buffer(positions),
        color: reglContext.buffer(colors)
      },
      uniforms: {
        projection: reglContext.prop<any, 'projection'>('projection'),
        view: reglContext.prop<any, 'view'>('view'),
        model: reglContext.prop<any, 'model'>('model'),
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

  updateLength(length: number): void {
    this.length = length
    // 重新创建绘制命令
  }
}
