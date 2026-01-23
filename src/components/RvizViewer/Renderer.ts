/**
 * 渲染器核心
 * 负责管理 regl 上下文和基础渲染功能
 */
import regl from 'regl'
import type { CameraState, Viewport, RenderOptions } from './types'
import { createPerspectiveMatrix, createViewMatrix } from './utils/math'

export class Renderer {
  private reglContext: regl.Regl
  private viewport: Viewport
  private camera: CameraState
  private options: Required<RenderOptions>

  constructor(canvas: HTMLCanvasElement, viewport: Viewport, camera: CameraState, options?: RenderOptions) {
    this.viewport = viewport
    this.camera = camera
    this.options = {
      clearColor: options?.clearColor || [0.1, 0.1, 0.1, 1.0],
      enableGrid: options?.enableGrid ?? true,
      enableAxes: options?.enableAxes ?? true,
      gridSize: options?.gridSize || 10,
      gridDivisions: options?.gridDivisions || 10
    }

    // 初始化 regl
    this.reglContext = regl({
      canvas,
      attributes: {
        antialias: true,
        depth: true,
        stencil: false,
        alpha: true
      }
    })

    // 设置视口
    this.updateViewport(viewport)
  }

  /**
   * 更新视口大小
   */
  updateViewport(viewport: Viewport): void {
    this.viewport = viewport
    // 视口会在每次绘制时自动更新
  }

  /**
   * 更新相机
   */
  updateCamera(camera: CameraState): void {
    this.camera = camera
  }

  /**
   * 获取 regl 上下文
   */
  getContext(): regl.Regl {
    return this.reglContext
  }

  /**
   * 清除画布
   */
  clear(): void {
    this.reglContext.clear({
      color: this.options.clearColor,
      depth: 1.0
    })
  }

  /**
   * 获取投影矩阵
   */
  getProjectionMatrix(): regl.Mat4 {
    const aspect = this.viewport.width / this.viewport.height
    const matrix = createPerspectiveMatrix(
      this.camera.fov,
      aspect,
      this.camera.near,
      this.camera.far
    )
    // 将 Float32Array 转换为普通数组
    return Array.from(matrix) as regl.Mat4
  }

  /**
   * 获取视图矩阵
   */
  getViewMatrix(): regl.Mat4 {
    const matrix = createViewMatrix(this.camera)
    // 将 Float32Array 转换为普通数组
    return Array.from(matrix) as regl.Mat4
  }

  /**
   * 创建基础绘制命令
   */
  createDrawCommand(config: {
    vert: string
    frag: string
    attributes: any
    uniforms: any
    elements?: any
    primitive?: 'points' | 'lines' | 'line strip' | 'line loop' | 'triangles' | 'triangle strip' | 'triangle fan'
    count?: number
  }): regl.DrawCommand {
    return this.reglContext({
      vert: config.vert,
      frag: config.frag,
      attributes: config.attributes,
      uniforms: {
        ...config.uniforms,
        projection: this.getProjectionMatrix(),
        view: this.getViewMatrix()
      },
      elements: config.elements,
      primitive: config.primitive || 'triangles',
      count: config.count,
      depth: {
        enable: true,
        func: 'less',
        mask: true
      }
    })
  }

  /**
   * 渲染一帧
   */
  render(renderCallback: () => void): void {
    this.reglContext.frame(() => {
      this.clear()
      renderCallback()
    })
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    this.reglContext.destroy()
  }
}
