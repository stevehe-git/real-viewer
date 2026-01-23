/**
 * 相机控制器
 * 负责处理相机的交互控制（旋转、平移、缩放）
 */
import { vec3 } from 'gl-matrix'
import type { CameraState } from './types'

export class CameraController {
  private camera: CameraState
  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0
  private distance = 10
  private rotationX = 0
  private rotationY = 0
  private panX = 0
  private panY = 0

  constructor(initialCamera: CameraState) {
    this.camera = { ...initialCamera }
    this.updateDistance()
    // 初始化旋转角度（基于初始相机位置）
    this.initializeRotation()
  }

  /**
   * 根据初始相机位置初始化旋转角度
   */
  private initializeRotation(): void {
    const dx = this.camera.position[0] - this.camera.target[0]
    const dy = this.camera.position[1] - this.camera.target[1]
    const dz = this.camera.position[2] - this.camera.target[2]
    
    // 计算水平角度（从正Y轴开始，逆时针为正）
    this.rotationY = Math.atan2(dx, dy)
    
    // 计算垂直角度（俯仰角）
    const horizontalDist = Math.sqrt(dx * dx + dy * dy)
    this.rotationX = Math.atan2(dz, horizontalDist)
  }

  /**
   * 更新相机到目标的距离
   */
  private updateDistance(): void {
    const dx = this.camera.position[0] - this.camera.target[0]
    const dy = this.camera.position[1] - this.camera.target[1]
    const dz = this.camera.position[2] - this.camera.target[2]
    this.distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**
   * 处理鼠标按下事件
   */
  onMouseDown(event: MouseEvent): void {
    this.isDragging = true
    this.lastMouseX = event.clientX
    this.lastMouseY = event.clientY
  }

  /**
   * 处理鼠标移动事件（rviz 风格）
   */
  onMouseMove(event: MouseEvent, button: number): void {
    if (!this.isDragging) return

    const deltaX = event.clientX - this.lastMouseX
    const deltaY = event.clientY - this.lastMouseY

    if (button === 0) {
      // 左键：旋转（轨道控制）
      const sensitivity = 0.005
      this.rotationY += deltaX * sensitivity
      this.rotationX += deltaY * sensitivity
      this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX))
      this.updateCameraPosition()
    } else if (button === 1 || button === 2) {
      // 中键或右键：平移
      const panSpeed = this.distance * 0.001
      this.panX -= deltaX * panSpeed
      this.panY += deltaY * panSpeed
      this.updateCameraPosition()
    }

    this.lastMouseX = event.clientX
    this.lastMouseY = event.clientY
  }

  /**
   * 处理鼠标释放事件
   */
  onMouseUp(): void {
    this.isDragging = false
  }

  /**
   * 处理滚轮缩放（rviz 风格）
   */
  onWheel(event: WheelEvent): void {
    const zoomSpeed = 0.05
    const zoomFactor = 1 + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed)
    this.distance *= zoomFactor
    this.distance = Math.max(0.5, Math.min(200, this.distance))
    this.updateCameraPosition()
  }

  /**
   * 更新相机位置（球坐标系统）
   */
  private updateCameraPosition(): void {
    // 更新目标点（考虑平移）
    const target = vec3.fromValues(
      this.camera.target[0] + this.panX,
      this.camera.target[1] + this.panY,
      this.camera.target[2]
    )

    // 球坐标转笛卡尔坐标
    // rotationY: 水平角度（绕Z轴，从正Y轴开始）
    // rotationX: 垂直角度（俯仰角，从水平面开始）
    const x = this.distance * Math.cos(this.rotationX) * Math.sin(this.rotationY)
    const y = this.distance * Math.cos(this.rotationX) * Math.cos(this.rotationY)
    const z = this.distance * Math.sin(this.rotationX)

    this.camera.position[0] = target[0] + x
    this.camera.position[1] = target[1] + y
    this.camera.position[2] = target[2] + z
  }

  /**
   * 重置相机
   */
  reset(): void {
    this.rotationX = Math.PI / 6 // 30度俯视角度
    this.rotationY = Math.PI / 4 // 45度水平角度
    this.panX = 0
    this.panY = 0
    this.distance = 10
    this.updateCameraPosition()
  }

  /**
   * 获取当前相机状态
   */
  getCamera(): CameraState {
    return { ...this.camera }
  }

  /**
   * 设置相机目标点
   */
  setTarget(target: [number, number, number]): void {
    this.camera.target = [...target]
    this.updateDistance()
    this.updateCameraPosition()
  }
}
