/**
 * 显示配置同步 Composable
 * 负责将显示配置面板的变更实时同步到渲染器
 */
import { watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'

export interface DisplaySyncContext {
  setGridVisible: (visible: boolean) => void
  setAxesVisible: (visible: boolean) => void
  setGridOptions: (options: { 
    planeCellCount?: number
    normalCellCount?: number
    cellSize?: number
    color?: string
    alpha?: number
    plane?: string
    offsetX?: number
    offsetY?: number
    offsetZ?: number
  }) => void
  setAxesOptions: (options: { length?: number; radius?: number; alpha?: number }) => void
  setMapOptions: (options: { 
    alpha?: number
    colorScheme?: string
    drawBehind?: boolean
  }) => void
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
      
      // 更新网格配置选项
      const options = gridComponent.options || {}
      context.setGridOptions({
        planeCellCount: options.planeCellCount,
        normalCellCount: options.normalCellCount,
        cellSize: options.cellSize,
        color: options.color,
        alpha: options.alpha,
        plane: options.plane,
        offsetX: options.offsetX,
        offsetY: options.offsetY,
        offsetZ: options.offsetZ
      })
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
      
      // 更新坐标轴配置选项（长度、半径、透明度等）
      const options = axesComponent.options || {}
      context.setAxesOptions({
        length: options.length,
        radius: options.radius,
        alpha: options.alpha
      })
    } else {
      context.setAxesVisible(false)
    }
  }

  /**
   * 同步 Map 显示状态
   */
  function syncMapDisplay(): void {
    const mapComponent = rvizStore.displayComponents.find(c => c.type === 'map')
    
    if (!mapComponent) {
      // Map 组件不存在，不处理
      return
    }

    // Map 组件存在，更新配置选项
    if (mapComponent.enabled) {
      const options = mapComponent.options || {}
      context.setMapOptions({
        alpha: options.alpha,
        colorScheme: options.colorScheme,
        drawBehind: options.drawBehind
      })
    }
  }

  /**
   * 同步所有显示组件
   */
  function syncAllDisplays(): void {
    syncGridDisplay()
    syncAxesDisplay()
    syncMapDisplay()
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

  // 监听 Grid 组件的配置选项变化
  watch(
    () => {
      const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
      return gridComponent ? {
        id: gridComponent.id,
        enabled: gridComponent.enabled,
        planeCellCount: gridComponent.options?.planeCellCount,
        normalCellCount: gridComponent.options?.normalCellCount,
        cellSize: gridComponent.options?.cellSize,
        color: gridComponent.options?.color,
        alpha: gridComponent.options?.alpha,
        plane: gridComponent.options?.plane,
        offsetX: gridComponent.options?.offsetX,
        offsetY: gridComponent.options?.offsetY,
        offsetZ: gridComponent.options?.offsetZ
      } : null
    },
    (gridConfig) => {
      if (gridConfig && gridConfig.enabled) {
        context.setGridOptions({
          planeCellCount: gridConfig.planeCellCount,
          normalCellCount: gridConfig.normalCellCount,
          cellSize: gridConfig.cellSize,
          color: gridConfig.color,
          alpha: gridConfig.alpha,
          plane: gridConfig.plane,
          offsetX: gridConfig.offsetX,
          offsetY: gridConfig.offsetY,
          offsetZ: gridConfig.offsetZ
        })
      }
    },
    { deep: true }
  )

  // 监听 Axes 组件的配置选项变化（长度、半径、透明度等）
  watch(
    () => {
      const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
      return axesComponent ? {
        id: axesComponent.id,
        enabled: axesComponent.enabled,
        length: axesComponent.options?.length,
        radius: axesComponent.options?.radius,
        alpha: axesComponent.options?.alpha
      } : null
    },
    (axesConfig) => {
      if (axesConfig && axesConfig.enabled) {
        context.setAxesOptions({
          length: axesConfig.length,
          radius: axesConfig.radius,
          alpha: axesConfig.alpha
        })
      }
    },
    { deep: true }
  )

  // 监听 Map 组件的配置选项变化（透明度、颜色方案、绘制顺序等）
  watch(
    () => {
      const mapComponent = rvizStore.displayComponents.find(c => c.type === 'map')
      return mapComponent ? {
        id: mapComponent.id,
        enabled: mapComponent.enabled,
        alpha: mapComponent.options?.alpha,
        colorScheme: mapComponent.options?.colorScheme,
        drawBehind: mapComponent.options?.drawBehind
      } : null
    },
    (mapConfig) => {
      if (mapConfig && mapConfig.enabled) {
        context.setMapOptions({
          alpha: mapConfig.alpha,
          colorScheme: mapConfig.colorScheme,
          drawBehind: mapConfig.drawBehind
        })
      }
    },
    { deep: true }
  )

  // 初始同步
  syncAllDisplays()

  return {
    syncGridDisplay,
    syncAxesDisplay,
    syncMapDisplay,
    syncAllDisplays
  }
}
