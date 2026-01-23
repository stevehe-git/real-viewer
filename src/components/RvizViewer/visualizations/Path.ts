/**
 * 路径可视化组件
 */
import type regl from 'regl'
import { vertexShader, fragmentShader } from '../utils/shaders'
import type { Point3D, Color } from '../types'

export interface PathData {
  waypoints: Point3D[]
  color?: Color
  lineWidth?: number
  showPoints?: boolean
}

export class Path {
  private drawCommand: regl.DrawCommand | null = null
  private pointDrawCommand: regl.DrawCommand | null = null
  private reglContext: regl.Regl
  private data: PathData | null = null

  constructor(reglContext: regl.Regl) {
    this.reglContext = reglContext
  }

  /**
   * 更新路径数据
   */
  updateData(data: PathData): void {
    this.data = data
    this.createDrawCommands()
  }

  private createDrawCommands(): void {
    if (!this.data || this.data.waypoints.length < 2) {
      this.drawCommand = null
      this.pointDrawCommand = null
      return
    }

    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    const defaultColor: Color = this.data.color || { r: 0, g: 1, b: 0 }
    
    this.data.waypoints.forEach((point, index) => {
      positions.push(point.x, point.y, point.z)
      colors.push(defaultColor.r, defaultColor.g, defaultColor.b)
      
      if (index > 0) {
        indices.push(index - 1, index)
      }
    })

    // 路径线
    this.drawCommand = this.reglContext({
      vert: vertexShader,
      frag: fragmentShader,
      attributes: {
        position: this.reglContext.buffer(positions),
        color: this.reglContext.buffer(colors)
      },
      uniforms: {
        projection: this.reglContext.prop<any, 'projection'>('projection'),
        view: this.reglContext.prop<any, 'view'>('view'),
        model: this.reglContext.prop<any, 'model'>('model'),
        opacity: defaultColor.a || 1.0
      },
      elements: this.reglContext.elements(indices),
      primitive: 'line strip',
      lineWidth: 1
    })

    // 路径点（如果启用）
    if (this.data.showPoints) {
      const pointPositions: number[] = []
      const pointColors: number[] = []
      
      this.data.waypoints.forEach((point) => {
        pointPositions.push(point.x, point.y, point.z)
        pointColors.push(defaultColor.r, defaultColor.g, defaultColor.b)
      })

      // 使用点云着色器来支持点大小
      this.pointDrawCommand = this.reglContext({
        vert: `
          precision mediump float;
          attribute vec3 position;
          attribute vec3 color;
          uniform mat4 projection;
          uniform mat4 view;
          uniform mat4 model;
          uniform float pointSize;
          varying vec3 vColor;

          void main() {
            gl_Position = projection * view * model * vec4(position, 1.0);
            gl_PointSize = pointSize;
            vColor = color;
          }
        `,
        frag: `
          precision mediump float;
          varying vec3 vColor;
          uniform float opacity;

          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = opacity * (1.0 - smoothstep(0.0, 0.5, dist));
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        attributes: {
          position: this.reglContext.buffer(pointPositions),
          color: this.reglContext.buffer(pointColors)
        },
        uniforms: {
          projection: this.reglContext.prop<any, 'projection'>('projection'),
          view: this.reglContext.prop<any, 'view'>('view'),
          model: this.reglContext.prop<any, 'model'>('model'),
          opacity: defaultColor.a || 1.0,
          pointSize: 5.0
        },
        count: this.data.waypoints.length,
        primitive: 'points'
      })
    }
  }

  render(
    projection: regl.Mat4,
    view: regl.Mat4,
    model: regl.Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  ): void {
    if (this.drawCommand) {
      this.drawCommand({ projection, view, model })
    }
    if (this.pointDrawCommand) {
      this.pointDrawCommand({ projection, view, model })
    }
  }

  clear(): void {
    this.data = null
    this.drawCommand = null
    this.pointDrawCommand = null
  }
}
