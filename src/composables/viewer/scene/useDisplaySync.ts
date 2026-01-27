/**
 * 显示配置同步 Composable
 * 负责将显示配置面板的变更实时同步到渲染器
 */
import { watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'
import { tfManager } from '@/services/tfManager'

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
  updateLaserScan: (message: any, componentId: string) => void | Promise<void>
  removeLaserScan: (componentId: string) => void
  clearAllLaserScans?: () => void
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
  }, componentId: string) => void
  updatePointCloud: (data: any, componentId: string) => void | Promise<void>
  removePointCloud: (componentId: string) => void
  clearAllPointClouds?: () => void
  updatePointCloud2: (message: any, componentId: string) => void | Promise<void>
  removePointCloud2: (componentId: string) => void
  clearAllPointCloud2s?: () => void
  setPointCloud2Options: (options: { 
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
  }, componentId: string) => void
  destroyGrid: () => void
  destroyAxes: () => void
  createGrid: () => void
  createAxes: () => void
  clearPaths?: () => void
  finalPaint?: () => void
  setTFVisible?: (visible: boolean) => void
  setTFOptions?: (options: {
    showNames?: boolean
    showAxes?: boolean
    showArrows?: boolean
    markerScale?: number
    markerAlpha?: number
    frameTimeout?: number
    filterWhitelist?: string
    filterBlacklist?: string
    frames?: Array<{ name: string; enabled: boolean }>
  }) => void
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
   * 同步 LaserScan 显示状态（支持多个 LaserScan）
   */
  function syncLaserScanDisplay(): void {
    const laserScanComponents = rvizStore.displayComponents.filter(c => c.type === 'laserscan')
    
    // 处理每个 LaserScan 组件
    laserScanComponents.forEach((laserScanComponent) => {
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
        }, laserScanComponent.id)

        // 获取 LaserScan 数据并更新
        const laserScanMessage = topicSubscriptionManager.getLatestMessage(laserScanComponent.id)
        if (laserScanMessage) {
          context.updateLaserScan(laserScanMessage, laserScanComponent.id)
        }
      } else {
        // LaserScan 组件被禁用，移除数据
        context.removeLaserScan(laserScanComponent.id)
      }
    })
  }

  /**
   * 同步 PointCloud 显示状态（支持多个 PointCloud）
   */
  function syncPointCloudDisplay(): void {
    const pointCloudComponents = rvizStore.displayComponents.filter(c => c.type === 'pointcloud')
    
    // 处理每个 PointCloud 组件
    pointCloudComponents.forEach((pointCloudComponent) => {
      if (pointCloudComponent.enabled) {
        // 获取 PointCloud 数据并更新
        const pointCloudMessage = topicSubscriptionManager.getLatestMessage(pointCloudComponent.id)
        if (pointCloudMessage) {
          // 转换消息格式为 PointCloudData
          const pointCloudData = {
            points: pointCloudMessage.points || [],
            colors: pointCloudMessage.colors,
            pointSize: pointCloudComponent.options?.pointSize || 3.0
          }
          context.updatePointCloud(pointCloudData, pointCloudComponent.id)
        }
      } else {
        // PointCloud 组件被禁用，移除数据
        context.removePointCloud(pointCloudComponent.id)
      }
    })
  }

  /**
   * 同步 PointCloud2 显示状态（支持多个 PointCloud2）
   */
  function syncPointCloud2Display(): void {
    const pointCloud2Components = rvizStore.displayComponents.filter(c => c.type === 'pointcloud2')
    
    // 处理每个 PointCloud2 组件
    pointCloud2Components.forEach((pointCloud2Component) => {
      if (pointCloud2Component.enabled) {
        const options = pointCloud2Component.options || {}
        context.setPointCloud2Options({
          size: options.size,
          alpha: options.alpha,
          colorTransformer: options.colorTransformer,
          useRainbow: options.useRainbow,
          minColor: options.minColor,
          maxColor: options.maxColor
        }, pointCloud2Component.id)

        // 获取 PointCloud2 数据并更新
        const pointCloud2Message = topicSubscriptionManager.getLatestMessage(pointCloud2Component.id)
        if (pointCloud2Message) {
          context.updatePointCloud2(pointCloud2Message, pointCloud2Component.id)
        }
      } else {
        // PointCloud2 组件被禁用，移除数据
        context.removePointCloud2(pointCloud2Component.id)
      }
    })
  }

  /**
   * 同步所有显示组件
   */
  /**
   * 同步 TF 显示状态
   */
  function syncTFDisplay(): void {
    const tfComponent = rvizStore.displayComponents.find(c => c.type === 'tf')
    
    if (!tfComponent) {
      // TF 组件不存在，隐藏 TF
      if (context.setTFVisible) {
        context.setTFVisible(false)
      }
      return
    }

    // TF 组件存在，根据 enabled 状态显示/隐藏
    if (tfComponent.enabled) {
      if (context.setTFVisible) {
        context.setTFVisible(true)
      }
      
      // 更新 TF 配置选项
      const options = tfComponent.options || {}
      if (context.setTFOptions) {
        context.setTFOptions({
          showNames: options.showNames,
          showAxes: options.showAxes,
          showArrows: options.showArrows,
          markerScale: options.markerScale,
          markerAlpha: options.markerAlpha,
          frameTimeout: options.frameTimeout,
          filterWhitelist: options.filterWhitelist,
          filterBlacklist: options.filterBlacklist,
          frames: options.frames
        })
      }
    } else {
      // TF 组件被禁用，隐藏 TF
      if (context.setTFVisible) {
        context.setTFVisible(false)
      }
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
    syncPointCloudDisplay()
    syncPointCloud2Display()
    syncTFDisplay()
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

  // 缓存上次处理的消息时间戳，用于去重
  const lastProcessedMessageTimes = new Map<string, number>()
  
  // 监听所有地图组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
      // 访问状态更新触发器以确保响应式追踪
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      // 返回所有地图组件的消息映射（包含时间戳用于去重）
      const messages: Record<string, { message: any; timestamp: number }> = {}
      mapComponents.forEach(mapComponent => {
        if (mapComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(mapComponent.id)
          if (message) {
            // 获取消息的时间戳（如果有）
            const timestamp = message.header?.stamp?.sec 
              ? message.header.stamp.sec * 1000 + (message.header.stamp.nsec || 0) / 1000000
              : Date.now()
            
            messages[mapComponent.id] = { message, timestamp }
          }
        }
      })
      return messages
    },
    (mapMessages) => {
      // 更新所有地图（只处理真正变化的消息）
      Object.entries(mapMessages).forEach(([componentId, { message, timestamp }]) => {
        if (message) {
          // 检查消息是否真的变化了（通过时间戳比较）
          const lastTimestamp = lastProcessedMessageTimes.get(componentId)
          if (lastTimestamp === undefined || lastTimestamp !== timestamp) {
            // 消息已变化，更新地图
            lastProcessedMessageTimes.set(componentId, timestamp)
            context.updateMap(message, componentId)
          }
          // 如果时间戳相同，说明是同一个消息，跳过处理（去重）
        }
      })
      
      // 移除已禁用或已删除的地图
      const currentMapIds = new Set(Object.keys(mapMessages))
      rvizStore.displayComponents
        .filter(c => c.type === 'map')
        .forEach(mapComponent => {
          if (!mapComponent.enabled || !currentMapIds.has(mapComponent.id)) {
            lastProcessedMessageTimes.delete(mapComponent.id) // 清理缓存
            context.removeMap(mapComponent.id)
          }
        })
    },
    { immediate: true, deep: false } // 改为 deep: false，因为我们已经在 watch 函数中手动检查变化
  )

  // 监听所有 LaserScan 组件的配置选项变化（样式、大小、透明度、颜色转换器等）
  watch(
    () => {
      return rvizStore.displayComponents
        .filter(c => c.type === 'laserscan')
        .map(laserScanComponent => ({
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
        }))
    },
    (laserScanConfigs) => {
      laserScanConfigs.forEach((laserScanConfig) => {
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
          }, laserScanConfig.id)
        }
      })
      // 配置变化后，重新同步 LaserScan 数据以应用新配置
      syncLaserScanDisplay()
    },
    { deep: true }
  )

  // 监听所有 LaserScan 组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const laserScanComponents = rvizStore.displayComponents.filter(c => c.type === 'laserscan')
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      const messages: Record<string, { message: any; timestamp: number }> = {}
      laserScanComponents.forEach(laserScanComponent => {
        if (laserScanComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(laserScanComponent.id)
          if (message) {
            const timestamp = message.header?.stamp?.sec 
              ? message.header.stamp.sec * 1000 + (message.header.stamp.nsec || 0) / 1000000
              : Date.now()
            messages[laserScanComponent.id] = { message, timestamp }
          }
        }
      })
      return messages
    },
    (laserScanMessages) => {
      Object.entries(laserScanMessages).forEach(([componentId, { message }]) => {
        if (message) {
          context.updateLaserScan(message, componentId)
        }
      })
      
      // 移除已禁用或已删除的 LaserScan
      const currentLaserScanIds = new Set(Object.keys(laserScanMessages))
      rvizStore.displayComponents
        .filter(c => c.type === 'laserscan')
        .forEach(laserScanComponent => {
          if (!laserScanComponent.enabled || !currentLaserScanIds.has(laserScanComponent.id)) {
            context.removeLaserScan(laserScanComponent.id)
          }
        })
    },
    { immediate: true, deep: false }
  )

  // 监听所有 PointCloud2 组件的配置选项变化
  watch(
    () => {
      return rvizStore.displayComponents
        .filter(c => c.type === 'pointcloud2')
        .map(pointCloud2Component => ({
          id: pointCloud2Component.id,
          enabled: pointCloud2Component.enabled,
          size: pointCloud2Component.options?.size,
          alpha: pointCloud2Component.options?.alpha,
          colorTransformer: pointCloud2Component.options?.colorTransformer,
          useRainbow: pointCloud2Component.options?.useRainbow,
          minColor: pointCloud2Component.options?.minColor,
          maxColor: pointCloud2Component.options?.maxColor
        }))
    },
    (pointCloud2Configs) => {
      pointCloud2Configs.forEach((pointCloud2Config) => {
        if (pointCloud2Config && pointCloud2Config.enabled) {
          context.setPointCloud2Options({
            size: pointCloud2Config.size,
            alpha: pointCloud2Config.alpha,
            colorTransformer: pointCloud2Config.colorTransformer,
            useRainbow: pointCloud2Config.useRainbow,
            minColor: pointCloud2Config.minColor,
            maxColor: pointCloud2Config.maxColor
          }, pointCloud2Config.id)
        }
      })
      // 配置变化后，重新同步 PointCloud2 数据以应用新配置
      syncPointCloud2Display()
    },
    { deep: true }
  )

  // 监听所有 PointCloud2 组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const pointCloud2Components = rvizStore.displayComponents.filter(c => c.type === 'pointcloud2')
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      const messages: Record<string, { message: any; timestamp: number }> = {}
      pointCloud2Components.forEach(pointCloud2Component => {
        if (pointCloud2Component.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(pointCloud2Component.id)
          if (message) {
            const timestamp = message.header?.stamp?.sec 
              ? message.header.stamp.sec * 1000 + (message.header.stamp.nsec || 0) / 1000000
              : Date.now()
            messages[pointCloud2Component.id] = { message, timestamp }
          }
        }
      })
      return messages
    },
    (pointCloud2Messages) => {
      Object.entries(pointCloud2Messages).forEach(([componentId, { message }]) => {
        if (message) {
          context.updatePointCloud2(message, componentId)
        }
      })
      
      // 移除已禁用或已删除的 PointCloud2
      const currentPointCloud2Ids = new Set(Object.keys(pointCloud2Messages))
      rvizStore.displayComponents
        .filter(c => c.type === 'pointcloud2')
        .forEach(pointCloud2Component => {
          if (!pointCloud2Component.enabled || !currentPointCloud2Ids.has(pointCloud2Component.id)) {
            context.removePointCloud2(pointCloud2Component.id)
          }
        })
    },
    { immediate: true, deep: false }
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
          if (context.clearAllPointClouds) {
            context.clearAllPointClouds()
          }
          if (context.clearAllPointCloud2s) {
            context.clearAllPointCloud2s()
          }
          if (context.clearAllLaserScans) {
            context.clearAllLaserScans()
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

  // 监听 TF 数据变化（自动更新渲染）
  const tfDataUpdateTrigger = tfManager.getDataUpdateTrigger()
  watch(
    () => tfDataUpdateTrigger.value,
    () => {
      // TF 数据更新时，如果 TF 显示已启用，则强制更新渲染
      // 即使配置没变，frame 的位置可能已经变化，需要重新渲染
      const tfComponent = rvizStore.displayComponents.find(c => c.type === 'tf')
      if (tfComponent && tfComponent.enabled && context.setTFOptions) {
        const options = tfComponent.options || {}
        // 强制更新：先清除数据哈希，然后重新设置选项
        // 这样即使配置相同，也会重新处理数据
        context.setTFOptions({
          showNames: options.showNames,
          showAxes: options.showAxes,
          showArrows: options.showArrows,
          markerScale: options.markerScale,
          markerAlpha: options.markerAlpha,
          frameTimeout: options.frameTimeout,
          filterWhitelist: options.filterWhitelist,
          filterBlacklist: options.filterBlacklist,
          frames: options.frames
        })
      }
    },
    { immediate: false }
  )

  // 监听 TF 组件配置变化
  watch(
    () => {
      const tfComponent = rvizStore.displayComponents.find(c => c.type === 'tf')
      return tfComponent ? {
        id: tfComponent.id,
        enabled: tfComponent.enabled,
        showNames: tfComponent.options?.showNames,
        showAxes: tfComponent.options?.showAxes,
        showArrows: tfComponent.options?.showArrows,
        markerScale: tfComponent.options?.markerScale,
        markerAlpha: tfComponent.options?.markerAlpha,
        frameTimeout: tfComponent.options?.frameTimeout,
        filterWhitelist: tfComponent.options?.filterWhitelist,
        filterBlacklist: tfComponent.options?.filterBlacklist,
        frames: tfComponent.options?.frames
      } : null
    },
    (tfConfig) => {
      if (tfConfig && tfConfig.enabled && context.setTFOptions) {
        context.setTFOptions({
          showNames: tfConfig.showNames,
          showAxes: tfConfig.showAxes,
          showArrows: tfConfig.showArrows,
          markerScale: tfConfig.markerScale,
          markerAlpha: tfConfig.markerAlpha,
          frameTimeout: tfConfig.frameTimeout,
          filterWhitelist: tfConfig.filterWhitelist,
          filterBlacklist: tfConfig.filterBlacklist,
          frames: tfConfig.frames
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
    syncLaserScanDisplay,
    syncPointCloudDisplay,
    syncPointCloud2Display,
    syncAllDisplays
  }
}
