/**
 * 视图控制 Composable（统一入口）
 * 整合所有视图控制功能，提供统一的接口
 */
import { type Ref, watch } from 'vue'
import { useCameraControl } from './useCameraControl'
import { useSceneDisplayControl } from './useSceneDisplayControl'
import { useBackgroundControl } from './useBackgroundControl'
import { useRvizStore } from '@/stores/rviz'

export interface ViewerControlRef {
  resetCamera: () => void
  setGridVisible: (visible: boolean) => void
  setAxesVisible: (visible: boolean) => void
  setBackgroundColor: (color: string) => void
}

export interface UseViewControlOptions {
  viewerRef: Ref<ViewerControlRef | null>
  gridVisible: Ref<boolean>
  axesVisible: Ref<boolean>
}

export function useViewControl(options: UseViewControlOptions) {
  const { viewerRef, gridVisible, axesVisible } = options
  const rvizStore = useRvizStore()

  // 初始化状态从store读取
  gridVisible.value = rvizStore.sceneState.showGrid
  axesVisible.value = rvizStore.sceneState.showAxes

  // 初始化各个控制模块
  const cameraControl = useCameraControl({ viewerRef })
  const sceneDisplayControl = useSceneDisplayControl({
    viewerRef,
    gridVisible,
    axesVisible
  })
  const backgroundControl = useBackgroundControl({ viewerRef })

  // 监听store变化，实时同步到viewer（仅在外部修改store时触发）
  // 注意：这些watch会在store值变化时同步到viewer，但不会在handleToggle等方法中触发循环
  watch(
    () => rvizStore.sceneState.showGrid,
    (newValue) => {
      if (viewerRef.value && gridVisible.value !== newValue) {
        sceneDisplayControl.setGridVisible(newValue)
        gridVisible.value = newValue
      }
    }
  )

  watch(
    () => rvizStore.sceneState.showAxes,
    (newValue) => {
      if (viewerRef.value && axesVisible.value !== newValue) {
        sceneDisplayControl.setAxesVisible(newValue)
        axesVisible.value = newValue
      }
    }
  )

  watch(
    () => rvizStore.sceneState.backgroundColor,
    (newValue) => {
      if (viewerRef.value) {
        backgroundControl.setBackgroundColor(newValue)
      }
    }
  )

  // 重置相机
  function handleResetCamera(): void {
    cameraControl.resetCamera()
  }

  // 切换网格
  function handleToggleGrid(): void {
    const newValue = !rvizStore.sceneState.showGrid
    rvizStore.sceneState.showGrid = newValue
    sceneDisplayControl.setGridVisible(newValue)
    gridVisible.value = newValue
  }

  // 切换坐标轴
  function handleToggleAxes(): void {
    const newValue = !rvizStore.sceneState.showAxes
    rvizStore.sceneState.showAxes = newValue
    sceneDisplayControl.setAxesVisible(newValue)
    axesVisible.value = newValue
  }

  // 更新相机模式
  function handleUpdateCameraMode(mode: string): void {
    rvizStore.sceneState.cameraMode = mode as 'orbit' | 'firstPerson'
    cameraControl.setCameraMode(mode as 'orbit' | 'firstPerson')
  }

  // 更新背景颜色
  function handleUpdateBackgroundColor(color: string): void {
    rvizStore.sceneState.backgroundColor = color
    backgroundControl.setBackgroundColor(color)
  }

  return {
    // 方法
    handleResetCamera,
    handleToggleGrid,
    handleToggleAxes,
    handleUpdateCameraMode,
    handleUpdateBackgroundColor,
    // 子模块（如果需要单独访问）
    cameraControl,
    sceneDisplayControl,
    backgroundControl
  }
}
