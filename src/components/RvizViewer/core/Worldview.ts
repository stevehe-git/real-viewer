/**
 * Worldview 核心类
 * 完全基于 regl-worldview 的 Worldview.js 实现
 * 负责管理整个 3D 场景的渲染和交互
 */
import type { Dimensions, Vec4, CameraState } from '../types'
import { WorldviewContext } from './WorldviewContext'
import { DEFAULT_CAMERA_STATE } from '../camera'

const DEFAULT_BACKGROUND_COLOR: Vec4 = [0.2, 0.2, 0.2, 1.0]

export type WorldviewOptions = {
  dimension: Dimensions
  canvasBackgroundColor?: Vec4
  cameraState?: Partial<CameraState>
  defaultCameraState?: Partial<CameraState>
  onCameraStateChange?: (state: CameraState) => void
  contextAttributes?: { [key: string]: any }
}

export class Worldview {
  private context: WorldviewContext
  private canvas: HTMLCanvasElement | null = null

  constructor(options: WorldviewOptions) {
    const {
      dimension,
      canvasBackgroundColor = DEFAULT_BACKGROUND_COLOR,
      cameraState,
      defaultCameraState,
      onCameraStateChange,
      contextAttributes
    } = options

    // 合并相机状态
    const finalCameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...defaultCameraState,
      ...cameraState
    } as CameraState

    this.context = new WorldviewContext({
      dimension,
      canvasBackgroundColor,
      cameraState: finalCameraState,
      onCameraStateChange,
      contextAttributes
    })
  }

  /**
   * 初始化（必须在设置 canvas 后调用）
   */
  initialize(canvas: HTMLCanvasElement): void {
    if (this.canvas) {
      throw new Error('Worldview already initialized')
    }
    this.canvas = canvas
    this.context.initialize(canvas)
  }

  /**
   * 获取上下文
   */
  getContext(): WorldviewContext {
    return this.context
  }

  /**
   * 更新尺寸
   */
  setDimension(dimension: Dimensions): void {
    this.context.setDimension(dimension)
    this.context.onDirty()
  }

  /**
   * 渲染（触发一次绘制）
   */
  paint(): void {
    this.context.paint()
  }

  /**
   * 标记需要重新渲染
   */
  markDirty(): void {
    this.context.onDirty()
  }

  /**
   * 获取相机状态
   */
  getCameraState(): CameraState {
    return this.context.cameraStore.state
  }

  /**
   * 设置相机状态
   */
  setCameraState(state: Partial<CameraState>): void {
    this.context.cameraStore.setCameraState(state)
  }

  /**
   * 注册绘制调用
   */
  registerDrawCall(drawInput: import('../types').DrawInput): void {
    this.context.registerDrawCall(drawInput)
    this.context.onDirty()
  }

  /**
   * 取消注册绘制调用
   */
  unregisterDrawCall(instance: any): void {
    this.context.onUnmount(instance)
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.context.destroy()
    this.canvas = null
  }
}
