/**
 * 显示配置同步 Composable
 * 负责将显示配置面板的变更实时同步到渲染器
 */
import { watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'

export interface DisplaySyncContext {
  setGridVisible: (visible: boolean) => void
  setAxesVisible: (visible: boolean) => void
  destroyGrid: () => void
  destroyAxes: () => void
  createGrid: () => void
  createAxes: () => void
}

export interface UseDisplaySyncOptions {
  context: DisplaySyncContext
}

export function useDisplaySync(options: UseDisplaySyncOptions) {
  const { context } = options
  const rvizStore = useRvizStore()

  /**
   * 同步网格显示状态
   */
  function syncGridDisplay(): void {
    const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
    
    if (!gridComponent) {
      // 网格组件不存在，销毁网格
      context.destroyGrid()
      return
    }

    // 网格组件存在，根据 enabled 状态显示/隐藏
    if (gridComponent.enabled) {
      context.createGrid()
      context.setGridVisible(true)
    } else {
      context.setGridVisible(false)
    }
  }

  /**
   * 同步坐标轴显示状态
   */
  function syncAxesDisplay(): void {
    const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
    
    if (!axesComponent) {
      // 坐标轴组件不存在，销毁坐标轴
      context.destroyAxes()
      return
    }

    // 坐标轴组件存在，根据 enabled 状态显示/隐藏
    if (axesComponent.enabled) {
      context.createAxes()
      context.setAxesVisible(true)
    } else {
      context.setAxesVisible(false)
    }
  }

  /**
   * 同步所有显示组件
   */
  function syncAllDisplays(): void {
    syncGridDisplay()
    syncAxesDisplay()
  }

  // 监听 displayComponents 数组的变化（添加、删除）
  watch(
    () => rvizStore.displayComponents,
    () => {
      syncAllDisplays()
    },
    { deep: true }
  )

  // 监听每个组件的 enabled 状态变化
  watch(
    () => rvizStore.displayComponents.map(c => ({ id: c.id, type: c.type, enabled: c.enabled })),
    () => {
      syncAllDisplays()
    },
    { deep: true }
  )

  // 初始同步
  syncAllDisplays()

  return {
    syncGridDisplay,
    syncAxesDisplay,
    syncAllDisplays
  }
}
