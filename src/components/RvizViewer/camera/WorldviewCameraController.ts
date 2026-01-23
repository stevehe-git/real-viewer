/**
 * 基于 regl-worldview 的相机控制器
 * 实现 rviz 风格的鼠标交互
 */
import { CameraStore, type WorldviewCameraState } from './CameraStore'
import type { CameraState } from '../types'

const PAN_SPEED = 4
const MOUSE_ZOOM_SPEED = 0.1

export class WorldviewCameraController {
  private cameraStore: CameraStore
  private buttons: Set<number> = new Set()
  private initialMouse: [number, number] = [0, 0]
  private rect: DOMRect | null = null
  private canvas: HTMLCanvasElement | null = null

  constructor(initialCamera?: Partial<WorldviewCameraState>) {
    this.cameraStore = new CameraStore(() => {
      // 相机状态变化时的回调
    }, initialCamera)
  }

  /**
   * 设置画布元素
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.updateRect()
  }

  /**
   * 更新画布边界
   */
  private updateRect(): void {
    if (this.canvas) {
      this.rect = this.canvas.getBoundingClientRect()
    }
  }

  /**
   * 获取鼠标在屏幕上的归一化坐标（0-1）
   */
  private getMouseOnScreen(mouse: MouseEvent): [number, number] {
    if (!this.rect) {
      this.updateRect()
    }
    if (!this.rect) return [0, 0]

    const { clientX, clientY } = mouse
    const { top, left, width, height } = this.rect
    const x = (clientX - left) / width
    const y = (clientY - top) / height
    return [x, y]
  }

  /**
   * 处理鼠标按下
   */
  onMouseDown(event: MouseEvent): void {
    event.preventDefault()
    this.buttons.add(event.button)
    this.updateRect()
    this.initialMouse = this.getMouseOnScreen(event)
    this.startDragging()
  }

  /**
   * 处理鼠标移动（基于 regl-worldview 的实现）
   */
  onMouseMove(event: MouseEvent): void {
    if (!this.buttons.size) return

    const mouse = this.getMouseOnScreen(event)
    
    // 计算鼠标移动量
    let moveX = this.initialMouse[0] - mouse[0]
    let moveY = this.initialMouse[1] - mouse[1]
    this.initialMouse = mouse

    // 左键：旋转
    if (this.buttons.has(0)) {
      const magnitude = PAN_SPEED
      const x = moveX * magnitude
      const y = moveY * magnitude
      this.cameraStore.cameraRotate([x, y])
    }

    // 中键：平移
    if (this.buttons.has(1)) {
      const distance = this.getDistance()
      const moveMagnitude = { x: distance, y: distance }
      this.cameraStore.cameraMove([
        moveX * moveMagnitude.x,
        -moveY * moveMagnitude.y
      ])
    }
  }

  /**
   * 处理鼠标释放
   */
  onMouseUp(event: MouseEvent): void {
    this.buttons.delete(event.button)
    this.endDragging()
  }

  /**
   * 处理滚轮缩放（基于 regl-worldview 的实现）
   */
  onWheel(event: WheelEvent): void {
    event.preventDefault()
    
    // 使用 normalize-wheel 的逻辑
    const delta = -event.deltaY
    const zoomPercent = (delta / 100) * MOUSE_ZOOM_SPEED * 100
    this.cameraStore.cameraZoom(zoomPercent)
  }

  /**
   * 开始拖拽
   */
  private startDragging(): void {
    // 可以在这里添加 pointer lock 等功能
  }

  /**
   * 结束拖拽
   */
  private endDragging(): void {
    // 清理拖拽状态
  }

  /**
   * 获取当前相机状态
   */
  getCamera(): CameraState {
    return this.cameraStore.toCameraState()
  }

  /**
   * 重置相机
   */
  reset(): void {
    this.cameraStore.reset()
  }

  /**
   * 检查是否有按钮按下
   */
  isDragging(): boolean {
    return this.buttons.size > 0
  }

  /**
   * 清除所有按钮状态
   */
  clearButtons(): void {
    this.buttons.clear()
  }

  /**
   * 获取相机距离
   */
  private getDistance(): number {
    return this.cameraStore.getDistance()
  }
}
