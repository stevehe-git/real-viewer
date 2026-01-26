/**
 * 相机控制 Composable
 * 负责相机相关的控制功能（重置、模式切换等）
 */
import { type Ref } from 'vue'

export interface CameraControlMethods {
  resetCamera: () => void
  setCameraMode: (mode: 'orbit' | 'firstPerson') => void
}

export interface UseCameraControlOptions {
  viewerRef: Ref<{ resetCamera: () => void } | null>
}

export function useCameraControl(options: UseCameraControlOptions) {
  const { viewerRef } = options

  /**
   * 重置相机到默认状态
   */
  function resetCamera(): void {
    if (viewerRef.value) {
      viewerRef.value.resetCamera()
    }
  }

  /**
   * 设置相机模式
   * TODO: 实现相机模式切换逻辑
   */
  function setCameraMode(mode: 'orbit' | 'firstPerson'): void {
    // 相机模式切换逻辑将在后续实现
    console.log('Set camera mode:', mode)
  }

  return {
    resetCamera,
    setCameraMode
  }
}
