/**
 * 场景显示控制 Composable
 * 负责场景元素的显示/隐藏控制（网格、坐标轴、机器人、地图、激光等）
 */
import { type Ref } from 'vue'

export interface SceneDisplayControlMethods {
  setGridVisible: (visible: boolean) => void
  setAxesVisible: (visible: boolean) => void
  toggleGrid: () => void
  toggleAxes: () => void
}

export interface UseSceneDisplayControlOptions {
  viewerRef: Ref<{
    setGridVisible: (visible: boolean) => void
    setAxesVisible: (visible: boolean) => void
  } | null>
  gridVisible: Ref<boolean>
  axesVisible: Ref<boolean>
}

export function useSceneDisplayControl(options: UseSceneDisplayControlOptions) {
  const { viewerRef, gridVisible, axesVisible } = options

  /**
   * 设置网格可见性
   */
  function setGridVisible(visible: boolean): void {
    if (viewerRef.value) {
      viewerRef.value.setGridVisible(visible)
    }
  }

  /**
   * 设置坐标轴可见性
   */
  function setAxesVisible(visible: boolean): void {
    if (viewerRef.value) {
      viewerRef.value.setAxesVisible(visible)
    }
  }

  /**
   * 切换网格显示
   */
  function toggleGrid(): void {
    const newVisible = !gridVisible.value
    setGridVisible(newVisible)
  }

  /**
   * 切换坐标轴显示
   */
  function toggleAxes(): void {
    const newVisible = !axesVisible.value
    setAxesVisible(newVisible)
  }

  return {
    setGridVisible,
    setAxesVisible,
    toggleGrid,
    toggleAxes
  }
}
