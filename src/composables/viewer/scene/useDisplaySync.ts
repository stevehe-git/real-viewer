/**
 * 显示配置同步 Composable
 * 负责将显示配置面板的变更实时同步到渲染器
 */
import { watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'

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
  updateMap: (message: any, componentId: string) => void | Promise<void>
  removeMap: (componentId: string) => void
  clearAllMaps?: () => void
  setMapOptions: (options: { 
    alpha?: number
    colorScheme?: string
    drawBehind?: boolean
  }, componentId: string) => void
  setLaserScanOptions: (options: { 
    style?: string
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
    autocomputeIntensityBounds?: boolean
    minIntensity?: number
    maxIntensity?: number
  }) => void
  destroyGrid: () => void
  destroyAxes: () => void
  createGrid: () => void
  createAxes: () => void
  clearPointCloud?: () => void
  clearPaths?: () => void
  finalPaint?: () => void
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
   * 同步 Map 显示状态（支持多个地图）
   */
  function syncMapDisplay(): void {
    const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
    
    // 处理每个地图组件
    mapComponents.forEach((mapComponent) => {
      if (mapComponent.enabled) {
        const options = mapComponent.options || {}
        context.setMapOptions({
          alpha: options.alpha,
          colorScheme: options.colorScheme,
          drawBehind: options.drawBehind
        }, mapComponent.id)

        // 获取地图数据并更新
        const mapMessage = topicSubscriptionManager.getLatestMessage(mapComponent.id)
        if (mapMessage) {
          context.updateMap(mapMessage, mapComponent.id)
        }
      } else {
        // Map 组件被禁用，移除地图数据
        context.removeMap(mapComponent.id)
      }
    })
  }

  /**
   * 同步 LaserScan 显示状态
   */
  function syncLaserScanDisplay(): void {
    const laserScanComponent = rvizStore.displayComponents.find(c => c.type === 'laserscan')
    
    if (!laserScanComponent) {
      // LaserScan 组件不存在，不处理
      return
    }

    // LaserScan 组件存在，更新配置选项
    if (laserScanComponent.enabled) {
      const options = laserScanComponent.options || {}
      context.setLaserScanOptions({
        style: options.style,
        size: options.size,
        alpha: options.alpha,
        colorTransformer: options.colorTransformer,
        useRainbow: options.useRainbow,
        minColor: options.minColor,
        maxColor: options.maxColor,
        autocomputeIntensityBounds: options.autocomputeIntensityBounds,
        minIntensity: options.minIntensity,
        maxIntensity: options.maxIntensity
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
    syncLaserScanDisplay()
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

  // 监听所有 Map 组件的配置选项变化（透明度、颜色方案、绘制顺序等）
  watch(
    () => {
      return rvizStore.displayComponents
        .filter(c => c.type === 'map')
        .map(mapComponent => ({
          id: mapComponent.id,
          enabled: mapComponent.enabled,
          alpha: mapComponent.options?.alpha,
          colorScheme: mapComponent.options?.colorScheme,
          drawBehind: mapComponent.options?.drawBehind
        }))
    },
    (mapConfigs) => {
      mapConfigs.forEach((mapConfig) => {
        if (mapConfig && mapConfig.enabled) {
          context.setMapOptions({
            alpha: mapConfig.alpha,
            colorScheme: mapConfig.colorScheme,
            drawBehind: mapConfig.drawBehind
          }, mapConfig.id)
        }
      })
      // 配置变化后，重新同步地图数据以应用新配置
      syncMapDisplay()
    },
    { deep: true }
  )

  // 监听所有地图组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
      // 访问状态更新触发器以确保响应式追踪
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      // 返回所有地图组件的消息映射
      const messages: Record<string, any> = {}
      mapComponents.forEach(mapComponent => {
        if (mapComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(mapComponent.id)
          if (message) {
            messages[mapComponent.id] = message
          }
        }
      })
      return messages
    },
    (mapMessages) => {
      // 更新所有地图
      Object.entries(mapMessages).forEach(([componentId, mapMessage]) => {
        if (mapMessage) {
          context.updateMap(mapMessage, componentId)
        }
      })
      
      // 移除已禁用或已删除的地图
      const currentMapIds = new Set(Object.keys(mapMessages))
      rvizStore.displayComponents
        .filter(c => c.type === 'map')
        .forEach(mapComponent => {
          if (!mapComponent.enabled || !currentMapIds.has(mapComponent.id)) {
            context.removeMap(mapComponent.id)
          }
        })
    },
    { immediate: true, deep: true }
  )

  // 监听 LaserScan 组件的配置选项变化（样式、大小、透明度、颜色转换器等）
  watch(
    () => {
      const laserScanComponent = rvizStore.displayComponents.find(c => c.type === 'laserscan')
      return laserScanComponent ? {
        id: laserScanComponent.id,
        enabled: laserScanComponent.enabled,
        style: laserScanComponent.options?.style,
        size: laserScanComponent.options?.size,
        alpha: laserScanComponent.options?.alpha,
        colorTransformer: laserScanComponent.options?.colorTransformer,
        useRainbow: laserScanComponent.options?.useRainbow,
        minColor: laserScanComponent.options?.minColor,
        maxColor: laserScanComponent.options?.maxColor,
        autocomputeIntensityBounds: laserScanComponent.options?.autocomputeIntensityBounds,
        minIntensity: laserScanComponent.options?.minIntensity,
        maxIntensity: laserScanComponent.options?.maxIntensity
      } : null
    },
    (laserScanConfig) => {
      if (laserScanConfig && laserScanConfig.enabled) {
        context.setLaserScanOptions({
          style: laserScanConfig.style,
          size: laserScanConfig.size,
          alpha: laserScanConfig.alpha,
          colorTransformer: laserScanConfig.colorTransformer,
          useRainbow: laserScanConfig.useRainbow,
          minColor: laserScanConfig.minColor,
          maxColor: laserScanConfig.maxColor,
          autocomputeIntensityBounds: laserScanConfig.autocomputeIntensityBounds,
          minIntensity: laserScanConfig.minIntensity,
          maxIntensity: laserScanConfig.maxIntensity
        })
      }
    },
    { deep: true }
  )

  // 监听连接状态，断开连接时清理所有数据
  watch(
    () => rvizStore.communicationState.isConnected,
    (isConnected, wasConnected) => {
      if (!isConnected && wasConnected) {
        // 只在从连接状态变为断开状态时清理（避免初始化时误清理）
        // 使用 requestAnimationFrame 批量清理，减少渲染调用
        requestAnimationFrame(() => {
          // 清理所有地图数据
          if (context.clearAllMaps) {
            context.clearAllMaps()
          } else {
            const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
            mapComponents.forEach(mapComponent => {
              context.removeMap(mapComponent.id)
            })
          }
          
          // 清理点云数据
          if (context.clearPointCloud) {
            context.clearPointCloud()
          }
          
          // 清理路径数据
          if (context.clearPaths) {
            context.clearPaths()
          }
          
          // 清理后触发一次最终渲染，然后停止渲染循环
          if (context.finalPaint) {
            context.finalPaint()
          }
        })
      }
    },
    { immediate: false }
  )

  // 初始同步
  syncAllDisplays()

  return {
    syncGridDisplay,
    syncAxesDisplay,
    syncMapDisplay,
    syncLaserScanDisplay,
    syncAllDisplays
  }
}
