/**
 * 点云可视化组件
 */
import type regl from 'regl'
import { pointCloudVertexShader, pointCloudFragmentShader } from '../utils/shaders'
import type { Point3D, Color } from '../types'

export interface PointCloudData {
  points: Point3D[]
  colors?: Color[]
  pointSize?: number
}

export class PointCloud {
  private drawCommand: regl.DrawCommand | null = null
  private reglContext: regl.Regl
  private data: PointCloudData | null = null

  constructor(reglContext: regl.Regl) {
    this.reglContext = reglContext
  }

  /**
   * 更新点云数据
   */
  updateData(data: PointCloudData): void {
    this.data = data
    this.createDrawCommand()
  }

  private createDrawCommand(): void {
    if (!this.data || this.data.points.length === 0) {
      this.drawCommand = null
      return
    }

    const positions: number[] = []
    const colors: number[] = []
    const pointSizes: number[] = []

    const defaultColor: Color = { r: 1, g: 1, b: 1 }
    const pointSize = this.data.pointSize || 2.0

    this.data.points.forEach((point, index) => {
      positions.push(point.x, point.y, point.z)
      
      const color = this.data!.colors?.[index] || defaultColor
      colors.push(color.r, color.g, color.b)
      
      pointSizes.push(pointSize)
    })

    this.drawCommand = this.reglContext({
      vert: pointCloudVertexShader,
      frag: pointCloudFragmentShader,
      attributes: {
        position: this.reglContext.buffer(positions),
        color: this.reglContext.buffer(colors),
        pointSize: this.reglContext.buffer(pointSizes)
      },
      uniforms: {
        projection: this.reglContext.prop<any, 'projection'>('projection'),
        view: this.reglContext.prop<any, 'view'>('view'),
        model: this.reglContext.prop<any, 'model'>('model'),
        opacity: 1.0
      },
      count: this.data.points.length,
      primitive: 'points',
      depth: {
        enable: true,
        func: 'less',
        mask: true
      }
    })
  }

  render(
    projection: regl.Mat4,
    view: regl.Mat4,
    model: regl.Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  ): void {
    if (this.drawCommand) {
      this.drawCommand({ projection, view, model })
    }
  }

  clear(): void {
    this.data = null
    this.drawCommand = null
  }
}
