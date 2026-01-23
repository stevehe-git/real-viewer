/**
 * 渲染器核心
 * 负责管理 regl 上下文和基础渲染功能
 */
import regl from 'regl'
import type { CameraState, Viewport, RenderOptions } from '../types'
import { createPerspectiveMatrix, createViewMatrix } from '../utils/math'

export class Renderer {
  private reglContext: regl.Regl
  private viewport: Viewport
  private camera: CameraState
  private options: Required<Omit<RenderOptions, 'gridColor'>>
  private cachedProjection: regl.Mat4 | null = null
  private cachedView: regl.Mat4 | null = null
  private cachedAspect: number = 0
  private needsRender: boolean = true

  constructor(canvas: HTMLCanvasElement, viewport: Viewport, camera: CameraState, options?: RenderOptions) {
    this.viewport = viewport
    this.camera = camera
    this.options = {
      clearColor: options?.clearColor || [0.2, 0.2, 0.2, 1.0], // rviz 深灰色背景
      enableGrid: options?.enableGrid ?? true,
      enableAxes: options?.enableAxes ?? true,
      gridSize: options?.gridSize || 10,
      gridDivisions: options?.gridDivisions ?? 5 // 默认5个格子（从-5到5，共10个格子）
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
    if (this.viewport.width !== viewport.width || this.viewport.height !== viewport.height) {
      this.viewport = viewport
      this.cachedProjection = null // 清除缓存
      this.cachedAspect = 0
      this.needsRender = true
    }
  }

  /**
   * 更新相机
   */
  updateCamera(camera: CameraState): void {
    const cameraChanged = 
      this.camera.position[0] !== camera.position[0] ||
      this.camera.position[1] !== camera.position[1] ||
      this.camera.position[2] !== camera.position[2] ||
      this.camera.target[0] !== camera.target[0] ||
      this.camera.target[1] !== camera.target[1] ||
      this.camera.target[2] !== camera.target[2] ||
      this.camera.up[0] !== camera.up[0] ||
      this.camera.up[1] !== camera.up[1] ||
      this.camera.up[2] !== camera.up[2] ||
      this.camera.fov !== camera.fov ||
      this.camera.near !== camera.near ||
      this.camera.far !== camera.far

    if (cameraChanged) {
      this.camera = camera
      this.cachedView = null // 清除视图矩阵缓存
      this.cachedProjection = null // 清除投影矩阵缓存
      this.needsRender = true
    }
  }

  /**
   * 标记需要渲染
   */
  markDirty(): void {
    this.needsRender = true
  }

  /**
   * 检查是否需要渲染
   */
  shouldRender(): boolean {
    return this.needsRender
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
   * 获取投影矩阵（带缓存）
   */
  getProjectionMatrix(): regl.Mat4 {
    const aspect = this.viewport.width / this.viewport.height
    
    // 如果宽高比未变化且缓存存在，直接返回
    if (this.cachedProjection && Math.abs(this.cachedAspect - aspect) < 0.001) {
      return this.cachedProjection
    }

    const matrix = createPerspectiveMatrix(
      this.camera.fov,
      aspect,
      this.camera.near,
      this.camera.far
    )
    // 将 Float32Array 转换为普通数组并缓存
    this.cachedProjection = Array.from(matrix) as regl.Mat4
    this.cachedAspect = aspect
    return this.cachedProjection
  }

  /**
   * 获取视图矩阵（带缓存）
   */
  getViewMatrix(): regl.Mat4 {
    // 如果缓存存在，直接返回
    if (this.cachedView) {
      return this.cachedView
    }

    const matrix = createViewMatrix(this.camera)
    // 将 Float32Array 转换为普通数组并缓存
    this.cachedView = Array.from(matrix) as regl.Mat4
    return this.cachedView
  }

  /**
   * 获取视口
   */
  getViewport(): { width: number; height: number } {
    return { width: this.viewport.width, height: this.viewport.height }
  }

  /**
   * 渲染一帧（优化版本，使用 regl.frame 的批处理机制）
   */
  render(renderCallback: () => void): void {
    // 使用 regl.frame 的优化机制，它会自动处理批处理和优化
    this.reglContext.frame(() => {
      // 只在需要时渲染
      if (this.needsRender) {
        this.clear()
        renderCallback()
        this.needsRender = false
      }
    })
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    this.reglContext.destroy()
  }
}
