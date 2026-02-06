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
  updateCostmapIncremental?: (updateMessage: any, updatesComponentId: string) => void | Promise<void>
  registerCostmapUpdatesMapping?: (costmapComponentId: string, updatesComponentId: string) => void
  removeMap: (componentId: string) => void
  hideMap?: (componentId: string) => void // 隐藏地图（只清除渲染，保留缓存）
  showMap?: (componentId: string) => void // 显示地图（恢复渲染，使用缓存数据）
  clearAllMaps?: () => void
  setMapOptions: (options: { 
    alpha?: number
    colorScheme?: string
    drawBehind?: boolean
    topic?: string
  }, componentId: string) => void
  updateLaserScan: (message: any, componentId: string) => void | Promise<void>
  removeLaserScan: (componentId: string) => void
  hideLaserScan?: (componentId: string) => void // 隐藏 LaserScan（只清除渲染，保留缓存）
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
  hidePointCloud2?: (componentId: string) => void // 隐藏 PointCloud2（只清除渲染，保留缓存）
  clearAllPointCloud2s?: () => void
  setPointCloud2Options: (options: { 
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
    minIntensity?: number
    maxIntensity?: number
    style?: string
  }, componentId: string) => void
  destroyGrid: () => void
  destroyAxes: () => void
  createGrid: () => void
  createAxes: () => void
  clearPaths?: () => void
  updatePath?: (message: any, componentId: string) => void | Promise<void>
  removePath?: (componentId: string) => void
  setPathOptions?: (options: {
    color?: string
    alpha?: number
    lineWidth?: number
    lineStyle?: string
    bufferLength?: number
    offsetX?: number
    offsetY?: number
    offsetZ?: number
    poseStyle?: string
  }, componentId: string) => void
  updateOdometry?: (message: any, componentId: string) => void | Promise<void>
  removeOdometry?: (componentId: string) => void
  setOdometryOptions?: (options: {
    shape?: string
    axesLength?: number
    axesRadius?: number
    color?: string
    alpha?: number
    positionTolerance?: number
    angleTolerance?: number
    keep?: number
  }, componentId: string) => void
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
  function syncMapDisplay(previousMapIds?: Set<string>): Set<string> {
    const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
    const currentMapIds = new Set(mapComponents.map(c => c.id))
    
    // 清理已删除的地图组件数据
    if (previousMapIds) {
      previousMapIds.forEach(componentId => {
        if (!currentMapIds.has(componentId)) {
          context.removeMap(componentId)
          // 清理对应的 costmap_updates 订阅
          const updatesComponentId = `${componentId}_updates`
          rvizStore.unsubscribeComponentTopic(updatesComponentId)
        }
      })
    }
    
    // 处理每个地图组件
    mapComponents.forEach((mapComponent) => {
      if (mapComponent.enabled) {
        const options = mapComponent.options || {}
        const topic = options.topic || ''
        
        // 检测是否为 costmap topic（支持 global_costmap 和 local_costmap），如果是则自动订阅 costmap_updates
        // 例如：/move_base/global_costmap/costmap -> /move_base/global_costmap/costmap_updates
        //      /move_base/local_costmap/costmap -> /move_base/local_costmap/costmap_updates
        if (topic.endsWith('/costmap')) {
          const updatesTopic = topic.replace('/costmap', '/costmap_updates')
          const updatesComponentId = `${mapComponent.id}_updates`
          
          // 自动订阅 costmap_updates（如果已连接）
          if (rvizStore.communicationState.isConnected) {
            rvizStore.subscribeComponentTopic(
              updatesComponentId,
              'map_updates', // 使用特殊的组件类型
              updatesTopic,
              options.queueSize || 10
            )
            
            // 在 SceneManager 中注册映射关系
            if (context.registerCostmapUpdatesMapping) {
              context.registerCostmapUpdatesMapping(mapComponent.id, updatesComponentId)
            }
          }
        }
        
        // 传递 topic 到 setMapOptions，用于检测 topic 改变并清理旧数据
        context.setMapOptions({
          alpha: options.alpha,
          colorScheme: options.colorScheme,
          drawBehind: options.drawBehind,
          topic: options.topic
        }, mapComponent.id)

        // 尝试恢复渲染（如果有缓存数据）
        if (context.showMap) {
          context.showMap(mapComponent.id)
        }

        // 获取地图数据并更新
        // 注意：数据更新不会覆盖配置，因为配置存储在 SceneManager.mapConfigMap 中
        // 数据更新时，registerDrawCalls 会从 mapConfigMap 读取最新配置
        const mapMessage = topicSubscriptionManager.getLatestMessage(mapComponent.id)
        if (mapMessage) {
          context.updateMap(mapMessage, mapComponent.id)
        }
      } else {
        // Map 组件被禁用，只清除画布渲染，保留缓存数据
        if (context.hideMap) {
          context.hideMap(mapComponent.id)
        } else {
          // 如果没有hideMap方法，回退到removeMap（兼容旧代码）
          context.removeMap(mapComponent.id)
        }
        // 注意：不取消订阅 costmap_updates，保持订阅状态以便重新启用时快速恢复
      }
    })
    
    return currentMapIds
  }

  /**
   * 同步 LaserScan 显示状态（支持多个 LaserScan）
   */
  function syncLaserScanDisplay(previousLaserScanIds?: Set<string>): Set<string> {
    const laserScanComponents = rvizStore.displayComponents.filter(c => c.type === 'laserscan')
    const currentLaserScanIds = new Set(laserScanComponents.map(c => c.id))
    
    // 清理已删除的 LaserScan 组件数据
    if (previousLaserScanIds) {
      previousLaserScanIds.forEach(componentId => {
        if (!currentLaserScanIds.has(componentId)) {
          context.removeLaserScan(componentId)
        }
      })
    }
    
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
        // LaserScan 组件被禁用，只清除画布渲染，保留缓存数据
        if (context.hideLaserScan) {
          context.hideLaserScan(laserScanComponent.id)
        } else {
          // 如果没有hideLaserScan方法，回退到removeLaserScan（兼容旧代码）
          context.removeLaserScan(laserScanComponent.id)
        }
      }
    })
    
    return currentLaserScanIds
  }

  /**
   * 同步 PointCloud 显示状态（支持多个 PointCloud）
   */
  function syncPointCloudDisplay(previousPointCloudIds?: Set<string>): Set<string> {
    const pointCloudComponents = rvizStore.displayComponents.filter(c => c.type === 'pointcloud')
    const currentPointCloudIds = new Set(pointCloudComponents.map(c => c.id))
    
    // 清理已删除的 PointCloud 组件数据
    if (previousPointCloudIds) {
      previousPointCloudIds.forEach(componentId => {
        if (!currentPointCloudIds.has(componentId)) {
          context.removePointCloud(componentId)
        }
      })
    }
    
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
    
    return currentPointCloudIds
  }

  /**
   * 同步 PointCloud2 显示状态（支持多个 PointCloud2）
   */
  function syncPointCloud2Display(previousPointCloud2Ids?: Set<string>): Set<string> {
    const pointCloud2Components = rvizStore.displayComponents.filter(c => c.type === 'pointcloud2')
    const currentPointCloud2Ids = new Set(pointCloud2Components.map(c => c.id))
    
    // 清理已删除的 PointCloud2 组件数据
    if (previousPointCloud2Ids) {
      previousPointCloud2Ids.forEach(componentId => {
        if (!currentPointCloud2Ids.has(componentId)) {
          context.removePointCloud2(componentId)
        }
      })
    }
    
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
        // PointCloud2 组件被禁用，只清除画布渲染，保留缓存数据
        if (context.hidePointCloud2) {
          context.hidePointCloud2(pointCloud2Component.id)
        } else {
          // 如果没有hidePointCloud2方法，回退到removePointCloud2（兼容旧代码）
          context.removePointCloud2(pointCloud2Component.id)
        }
      }
    })
    
    return currentPointCloud2Ids
  }

  /**
   * 同步所有显示组件
   */
  /**
   * 同步 Path 显示状态（支持多个 Path）
   */
  function syncPathDisplay(previousPathIds?: Set<string>): Set<string> {
    const pathComponents = rvizStore.displayComponents.filter(c => c.type === 'path')
    const currentPathIds = new Set(pathComponents.map(c => c.id))
    
    // 清理已删除的 Path 组件数据
    if (previousPathIds) {
      previousPathIds.forEach(componentId => {
        if (!currentPathIds.has(componentId)) {
          if (context.removePath) {
            context.removePath(componentId)
          }
        }
      })
    }
    
    // 处理每个 Path 组件
    pathComponents.forEach((pathComponent) => {
      if (pathComponent.enabled) {
        const options = pathComponent.options || {}
        
        // 更新 Path 配置选项
        if (context.setPathOptions) {
          context.setPathOptions({
            color: options.color,
            alpha: options.alpha,
            lineWidth: options.lineWidth,
            lineStyle: options.lineStyle,
            bufferLength: options.bufferLength,
            offsetX: options.offsetX,
            offsetY: options.offsetY,
            offsetZ: options.offsetZ,
            poseStyle: options.poseStyle
          }, pathComponent.id)
        }

        // 获取 Path 数据并更新
        const pathMessage = topicSubscriptionManager.getLatestMessage(pathComponent.id)
        if (pathMessage && context.updatePath) {
          context.updatePath(pathMessage, pathComponent.id)
        }
      } else {
        // Path 组件被禁用，移除数据
        if (context.removePath) {
          context.removePath(pathComponent.id)
        }
      }
    })
    
    return currentPathIds
  }

  /**
   * 同步 Odometry 显示状态（支持多个 Odometry）
   */
  function syncOdometryDisplay(previousOdometryIds?: Set<string>): Set<string> {
    const odometryComponents = rvizStore.displayComponents.filter(c => c.type === 'odometry')
    const currentOdometryIds = new Set(odometryComponents.map(c => c.id))
    
    // 清理已删除的 Odometry 组件数据
    if (previousOdometryIds) {
      previousOdometryIds.forEach(componentId => {
        if (!currentOdometryIds.has(componentId)) {
          if (context.removeOdometry) {
            context.removeOdometry(componentId)
          }
        }
      })
    }
    
    // 处理每个 Odometry 组件
    odometryComponents.forEach((odometryComponent) => {
      if (odometryComponent.enabled) {
        const options = odometryComponent.options || {}
        
        // 更新 Odometry 配置选项
        if (context.setOdometryOptions) {
          context.setOdometryOptions({
            shape: options.shape,
            axesLength: options.axesLength,
            axesRadius: options.axesRadius,
            color: options.color,
            alpha: options.alpha,
            positionTolerance: options.positionTolerance,
            angleTolerance: options.angleTolerance,
            keep: options.keep
          }, odometryComponent.id)
        }

        // 获取 Odometry 数据并更新
        const odometryMessage = topicSubscriptionManager.getLatestMessage(odometryComponent.id)
        if (odometryMessage && context.updateOdometry) {
          context.updateOdometry(odometryMessage, odometryComponent.id)
        }
      } else {
        // Odometry 组件被禁用，移除数据
        if (context.removeOdometry) {
          context.removeOdometry(odometryComponent.id)
        }
      }
    })
    
    return currentOdometryIds
  }

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
  function syncAllDisplays(previousComponentIds?: {
    mapIds?: Set<string>
    laserScanIds?: Set<string>
    pointCloudIds?: Set<string>
    pointCloud2Ids?: Set<string>
    pathIds?: Set<string>
    odometryIds?: Set<string>
  }): {
    mapIds: Set<string>
    laserScanIds: Set<string>
    pointCloudIds: Set<string>
    pointCloud2Ids: Set<string>
    pathIds: Set<string>
    odometryIds: Set<string>
  } {
    syncGridDisplay()
    syncAxesDisplay()
    const currentMapIds = syncMapDisplay(previousComponentIds?.mapIds)
    const currentLaserScanIds = syncLaserScanDisplay(previousComponentIds?.laserScanIds)
    const currentPointCloudIds = syncPointCloudDisplay(previousComponentIds?.pointCloudIds)
    const currentPointCloud2Ids = syncPointCloud2Display(previousComponentIds?.pointCloud2Ids)
    const currentPathIds = syncPathDisplay(previousComponentIds?.pathIds)
    const currentOdometryIds = syncOdometryDisplay(previousComponentIds?.odometryIds)
    syncTFDisplay()
    
    return {
      mapIds: currentMapIds,
      laserScanIds: currentLaserScanIds,
      pointCloudIds: currentPointCloudIds,
      pointCloud2Ids: currentPointCloud2Ids,
      pathIds: currentPathIds,
      odometryIds: currentOdometryIds
    }
  }

  // 保存之前的组件 ID，用于检测删除
  let previousComponentIds: {
    mapIds?: Set<string>
    laserScanIds?: Set<string>
    pointCloudIds?: Set<string>
    pointCloud2Ids?: Set<string>
  } = {}

  // 监听 displayComponents 数组的变化（添加、删除）
  watch(
    () => rvizStore.displayComponents,
    () => {
      const currentIds = syncAllDisplays(previousComponentIds)
      if (currentIds) {
        previousComponentIds = currentIds
      }
    },
    { deep: true, immediate: true }
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
          // 立即更新配置选项，不等待数据同步
          context.setMapOptions({
            alpha: mapConfig.alpha,
            colorScheme: mapConfig.colorScheme,
            drawBehind: mapConfig.drawBehind
          }, mapConfig.id)
        }
      })
      
      // 注意：不需要调用 syncMapDisplay()，因为 setMapOptions 已经会重新注册绘制调用
      // syncMapDisplay() 主要用于数据更新，而配置更新已经通过 setMapOptions 处理
    },
    { deep: true, immediate: false }
  )

  // 生成地图消息的快速哈希（用于初步变化检测）
  // 这个哈希用于在 useDisplaySync 层面快速过滤，详细检测在 SceneManager.updateMap 中进行
  // 改进：增加采样点数量，检查前100个、中间100个、后100个数据点，提高检测准确性
  const generateQuickMessageHash = (message: any): string => {
    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      return ''
    }
    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05
    const originX = info.origin?.position?.x || 0
    const originY = info.origin?.position?.y || 0
    const dataLength = message.data.length
    
    // 基础哈希：元数据 + 数据长度
    let hash = `${width}_${height}_${resolution}_${originX}_${originY}_${dataLength}`
    
    // 改进：采样检查前100个、中间100个、后100个数据点（与 SceneManager.generateMapMessageHash 保持一致）
    // 这样可以更准确地检测地图数据的变化，特别是建图过程中中间部分的变化
    const sampleSize = Math.min(100, Math.floor(dataLength / 3))
    if (dataLength > 0) {
      // 前100个点
      for (let i = 0; i < sampleSize && i < dataLength; i++) {
        hash += `_${message.data[i]}`
      }
      // 中间100个点
      if (dataLength > sampleSize * 2) {
        const midStart = Math.floor(dataLength / 2) - Math.floor(sampleSize / 2)
        for (let i = midStart; i < midStart + sampleSize && i < dataLength; i++) {
          hash += `_${message.data[i]}`
        }
      }
      // 后100个点
      if (dataLength > sampleSize) {
        const endStart = Math.max(0, dataLength - sampleSize)
        for (let i = endStart; i < dataLength; i++) {
          hash += `_${message.data[i]}`
        }
      }
    }
    
    return hash
  }

  // 缓存上次处理的消息哈希，用于精确去重
  const lastProcessedMessageHashes = new Map<string, string>()
  
  // 监听所有地图组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
      // 访问状态更新触发器以确保响应式追踪
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      const triggerValue = trigger.value
      
      // 调试日志：记录 watch 被调用
      // if (mapComponents.length > 0) {
      //   console.log(`[Map Debug] Watch source function called, trigger value: ${triggerValue}`)
      // }
      
      // 关键修复：返回一个包含 messageCount 的字符串键，确保每次新消息时返回值都不同
      // 这样可以确保 watch 能够正确触发，即使对象引用相同
      const keys: string[] = []
      mapComponents.forEach(mapComponent => {
        if (mapComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(mapComponent.id)
          if (message) {
            // 获取消息的时间戳和计数（从状态中获取，确保每次新消息都有不同的值）
            const status = topicSubscriptionManager.getStatus(mapComponent.id)
            const timestamp = status?.lastMessageTime || Date.now()
            const messageCount = status?.messageCount || 0
            // 关键：使用 messageCount 和 timestamp 生成唯一键，确保每次新消息时返回值都不同
            const key = `${mapComponent.id}:${messageCount}:${timestamp}`
            keys.push(key)
            
            // 调试日志：记录每个组件的状态
            // console.log(`[Map Debug] Component ${mapComponent.id} status:`, {
            //   messageCount,
            //   timestamp,
            //   hasMessage: !!message,
            //   key
            // })
          } else {
            // console.log(`[Map Debug] Component ${mapComponent.id} has no message`)
          }
        }
        // enabled为false时，不处理数据更新，也不添加到messages中
      })
      const result = keys.sort().join('|')
      // 调试日志：记录返回值
      // if (mapComponents.length > 0) {
      //   console.log(`[Map Debug] Watch source returning keys: "${result}"`)
      // }
      // 返回排序后的键字符串，确保顺序一致
      return result
    },
    (keysString, oldKeysString) => {
      // 调试日志：记录 watch 回调被触发
      // console.log(`[Map Debug] Watch callback triggered:`, {
      //   oldKeys: oldKeysString,
      //   newKeys: keysString,
      //   changed: oldKeysString !== keysString
      // })
      
      // 解析键字符串，获取所有需要更新的组件
      const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
      
      // 更新所有 enabled 的地图组件
      mapComponents.forEach(mapComponent => {
        if (mapComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(mapComponent.id)
          if (message) {
            // 生成消息哈希用于变化检测
            const messageHash = generateQuickMessageHash(message)
            // 检查消息是否真的变化了（通过消息哈希比较）
            // 这比时间戳更准确，因为即使时间戳不同，如果数据相同也不会触发更新
            const lastHash = lastProcessedMessageHashes.get(mapComponent.id)
            
            // 获取消息的时间戳，用于辅助判断（建图过程中，即使哈希相同，时间戳变化也应该更新）
            const status = topicSubscriptionManager.getStatus(mapComponent.id)
            const currentTimestamp = status?.lastMessageTime || Date.now()
             const lastProcessedTimestamp = Number(lastProcessedMessageHashes.get(`${mapComponent.id}_timestamp`) || 0)
            
            // 调试日志：记录哈希比较（完整哈希值）
            // console.log(`[Map Debug] Component ${mapComponent.id} hash check:`, {
            //   lastHash: lastHash || '(none)',
            //   newHash: messageHash || '(none)',
            //   hashChanged: lastHash !== messageHash,
            //   lastTimestamp: lastProcessedTimestamp,
            //   currentTimestamp: currentTimestamp,
            //   timestampChanged: currentTimestamp !== lastProcessedTimestamp,
            //   willUpdate: lastHash === undefined || lastHash !== messageHash || currentTimestamp !== lastProcessedTimestamp,
            //   hashLength: {
            //     last: lastHash?.length || 0,
            //     new: messageHash?.length || 0
            //   }
            // })
            
            // 关键修复：对于建图场景，即使哈希相同，如果时间戳变化，也应该更新
            // 因为建图过程中，地图数据可能只在非采样区域变化，哈希检测可能漏检
            if (lastHash === undefined || lastHash !== messageHash || currentTimestamp !== lastProcessedTimestamp) {
              // 消息已变化，更新地图
              // console.log(`[Map Debug] Updating map for ${mapComponent.id}`)
              
              // 关键修复：数据更新前，确保配置已同步到 SceneManager
              // 这样 updateMap 调用 registerDrawCalls 时，能读取到最新配置
              const options = mapComponent.options || {}
              // 确保配置已同步（如果还没有同步），包括 topic
              context.setMapOptions({
                alpha: options.alpha,
                colorScheme: options.colorScheme,
                drawBehind: options.drawBehind,
                topic: options.topic
              }, mapComponent.id)
              
              // 保存消息哈希和时间戳
              lastProcessedMessageHashes.set(mapComponent.id, messageHash)
              lastProcessedMessageHashes.set(`${mapComponent.id}_timestamp`, String(currentTimestamp))
              // 调用 updateMap，它内部会进行更详细的检查
              // console.log(`[Map Debug] Calling context.updateMap for ${mapComponent.id}`)
              context.updateMap(message, mapComponent.id)
            } else {
              // 调试日志：记录哈希相同的情况
              // console.log(`[Map Debug] Component ${mapComponent.id} hash unchanged, skipping update`)
            }
            // 如果哈希相同，说明是同一个消息，跳过处理（去重）
          } else {
            // console.log(`[Map Debug] Component ${mapComponent.id} has no message in callback`)
          }
        }
      })
      
      // 移除已禁用或已删除的地图
      // 注意：enabled为false的组件已经在syncMapDisplay中通过hideMap处理，这里只处理真正删除的组件
      const currentMapIds = new Set(
        mapComponents
          .filter(c => c.enabled)
          .map(c => c.id)
      )
      mapComponents.forEach(mapComponent => {
        // 只处理真正删除的组件（不在currentMapIds中），enabled为false的组件不在这里处理
        if (!currentMapIds.has(mapComponent.id)) {
          lastProcessedMessageHashes.delete(mapComponent.id) // 清理缓存
          lastProcessedMessageHashes.delete(`${mapComponent.id}_timestamp`) // 清理时间戳缓存
          context.removeMap(mapComponent.id)
        }
      })
    },
    { immediate: true, deep: false } // 改为 deep: false，因为我们已经在 watch 函数中手动检查变化
  )

  // 监听 costmap_updates 消息（增量更新）
  watch(
    () => {
      const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      // 返回所有 costmap_updates 组件的消息
      const updatesMessages: Record<string, { message: any; costmapComponentId: string }> = {}
      mapComponents.forEach(mapComponent => {
        const topic = mapComponent.options?.topic || ''
        if (topic.endsWith('/costmap') && mapComponent.enabled) {
          const updatesComponentId = `${mapComponent.id}_updates`
          const updateMessage = topicSubscriptionManager.getLatestMessage(updatesComponentId)
          if (updateMessage) {
            updatesMessages[updatesComponentId] = {
              message: updateMessage,
              costmapComponentId: mapComponent.id
            }
          }
        }
      })
      return updatesMessages
    },
    (updatesMessages) => {
      // 处理每个 costmap_updates 消息
      Object.entries(updatesMessages).forEach(([updatesComponentId, { message }]) => {
        if (message && context.updateCostmapIncremental) {
          context.updateCostmapIncremental(message, updatesComponentId)
        }
      })
    },
    { immediate: true, deep: false }
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
      
      // 只处理enabled为true的组件，enabled为false时不处理数据更新
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
        // enabled为false时，不处理数据更新，也不添加到messages中
      })
      return messages
    },
    (laserScanMessages) => {
      Object.entries(laserScanMessages).forEach(([componentId, { message }]) => {
        if (message) {
          context.updateLaserScan(message, componentId)
        }
      })
      
      // 移除已删除的 LaserScan
      // 注意：enabled为false的组件已经在syncLaserScanDisplay中通过hideLaserScan处理，这里只处理真正删除的组件
      const currentLaserScanIds = new Set(Object.keys(laserScanMessages))
      rvizStore.displayComponents
        .filter(c => c.type === 'laserscan')
        .forEach(laserScanComponent => {
          // 只处理真正删除的组件（不在currentLaserScanIds中），enabled为false的组件不在这里处理
          if (!currentLaserScanIds.has(laserScanComponent.id)) {
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
          maxColor: pointCloud2Component.options?.maxColor,
          minIntensity: pointCloud2Component.options?.minIntensity,
          maxIntensity: pointCloud2Component.options?.maxIntensity,
          style: pointCloud2Component.options?.style
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
            maxColor: pointCloud2Config.maxColor,
            minIntensity: pointCloud2Config.minIntensity,
            maxIntensity: pointCloud2Config.maxIntensity,
            style: pointCloud2Config.style
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
      
      // 只处理enabled为true的组件，enabled为false时不处理数据更新
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
        // enabled为false时，不处理数据更新，也不添加到messages中
      })
      return messages
    },
    (pointCloud2Messages) => {
      Object.entries(pointCloud2Messages).forEach(([componentId, { message }]) => {
        if (message) {
          context.updatePointCloud2(message, componentId)
        }
      })
      
      // 移除已删除的 PointCloud2
      // 注意：enabled为false的组件已经在syncPointCloud2Display中通过hidePointCloud2处理，这里只处理真正删除的组件
      const currentPointCloud2Ids = new Set(Object.keys(pointCloud2Messages))
      rvizStore.displayComponents
        .filter(c => c.type === 'pointcloud2')
        .forEach(pointCloud2Component => {
          // 只处理真正删除的组件（不在currentPointCloud2Ids中），enabled为false的组件不在这里处理
          if (!currentPointCloud2Ids.has(pointCloud2Component.id)) {
            context.removePointCloud2(pointCloud2Component.id)
          }
        })
    },
    { immediate: true, deep: false }
  )

  // 监听所有 Path 组件的配置选项变化（颜色、透明度、线宽、线型、缓冲区长度等）
  watch(
    () => {
      return rvizStore.displayComponents
        .filter(c => c.type === 'path')
        .map(pathComponent => ({
          id: pathComponent.id,
          enabled: pathComponent.enabled,
          color: pathComponent.options?.color,
          alpha: pathComponent.options?.alpha,
          lineWidth: pathComponent.options?.lineWidth,
          lineStyle: pathComponent.options?.lineStyle,
          bufferLength: pathComponent.options?.bufferLength,
          offsetX: pathComponent.options?.offsetX,
          offsetY: pathComponent.options?.offsetY,
          offsetZ: pathComponent.options?.offsetZ,
          poseStyle: pathComponent.options?.poseStyle
        }))
    },
    (pathConfigs) => {
      pathConfigs.forEach((pathConfig) => {
        if (pathConfig && pathConfig.enabled) {
          if (context.setPathOptions) {
            context.setPathOptions({
              color: pathConfig.color,
              alpha: pathConfig.alpha,
              lineWidth: pathConfig.lineWidth,
              lineStyle: pathConfig.lineStyle,
              bufferLength: pathConfig.bufferLength,
              offsetX: pathConfig.offsetX,
              offsetY: pathConfig.offsetY,
              offsetZ: pathConfig.offsetZ,
              poseStyle: pathConfig.poseStyle
            }, pathConfig.id)
          }
        }
      })
      // 配置变化后，重新同步 Path 数据以应用新配置
      syncPathDisplay()
    },
    { deep: true }
  )

  // 监听所有 Odometry 组件的配置选项变化（shape、axesLength、axesRadius、keep等）
  watch(
    () => {
      return rvizStore.displayComponents
        .filter(c => c.type === 'odometry')
        .map(odometryComponent => ({
          id: odometryComponent.id,
          enabled: odometryComponent.enabled,
          shape: odometryComponent.options?.shape,
          axesLength: odometryComponent.options?.axesLength,
          axesRadius: odometryComponent.options?.axesRadius,
          color: odometryComponent.options?.color,
          alpha: odometryComponent.options?.alpha,
          positionTolerance: odometryComponent.options?.positionTolerance,
          angleTolerance: odometryComponent.options?.angleTolerance,
          keep: odometryComponent.options?.keep
        }))
    },
    (odometryConfigs) => {
      odometryConfigs.forEach((odometryConfig) => {
        if (odometryConfig && odometryConfig.enabled) {
          if (context.setOdometryOptions) {
            context.setOdometryOptions({
              shape: odometryConfig.shape,
              axesLength: odometryConfig.axesLength,
              axesRadius: odometryConfig.axesRadius,
              color: odometryConfig.color,
              alpha: odometryConfig.alpha,
              positionTolerance: odometryConfig.positionTolerance,
              angleTolerance: odometryConfig.angleTolerance,
              keep: odometryConfig.keep
            }, odometryConfig.id)
          }
        }
      })
      // 配置变化后，重新同步 Odometry 数据以应用新配置
      syncOdometryDisplay()
    },
    { deep: true }
  )

  // 监听所有 Path 组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const pathComponents = rvizStore.displayComponents.filter(c => c.type === 'path')
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      // 只处理enabled为true的组件，enabled为false时不处理数据更新
      const messages: Record<string, { message: any; timestamp: number }> = {}
      pathComponents.forEach(pathComponent => {
        if (pathComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(pathComponent.id)
          if (message) {
            const timestamp = message.header?.stamp?.sec 
              ? message.header.stamp.sec * 1000 + (message.header.stamp.nsec || 0) / 1000000
              : Date.now()
            messages[pathComponent.id] = { message, timestamp }
          }
        }
        // enabled为false时，不处理数据更新，也不添加到messages中
      })
      return messages
    },
    (pathMessages) => {
      Object.entries(pathMessages).forEach(([componentId, { message }]) => {
        if (message && context.updatePath) {
          context.updatePath(message, componentId)
        }
      })
      
      // 移除已删除的 Path
      // 注意：enabled为false的组件已经在syncPathDisplay中通过removePath处理，这里只处理真正删除的组件
      const currentPathIds = new Set(Object.keys(pathMessages))
      rvizStore.displayComponents
        .filter(c => c.type === 'path')
        .forEach(pathComponent => {
          // 只处理真正删除的组件（不在currentPathIds中），enabled为false的组件不在这里处理
          if (!currentPathIds.has(pathComponent.id)) {
            if (context.removePath) {
              context.removePath(pathComponent.id)
            }
          }
        })
    },
    { immediate: true, deep: false }
  )

  // 监听所有 Odometry 组件的数据变化（从 topicSubscriptionManager）
  watch(
    () => {
      const odometryComponents = rvizStore.displayComponents.filter(c => c.type === 'odometry')
      const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
      trigger.value
      
      // 只处理enabled为true的组件，enabled为false时不处理数据更新
      const messages: Record<string, { message: any; timestamp: number }> = {}
      odometryComponents.forEach(odometryComponent => {
        if (odometryComponent.enabled) {
          const message = topicSubscriptionManager.getLatestMessage(odometryComponent.id)
          if (message) {
            const timestamp = message.header?.stamp?.sec 
              ? message.header.stamp.sec * 1000 + (message.header.stamp.nsec || 0) / 1000000
              : Date.now()
            messages[odometryComponent.id] = { message, timestamp }
          }
        }
        // enabled为false时，不处理数据更新，也不添加到messages中
      })
      return messages
    },
    (odometryMessages) => {
      Object.entries(odometryMessages).forEach(([componentId, { message }]) => {
        if (message && context.updateOdometry) {
          context.updateOdometry(message, componentId)
        }
      })
      
      // 移除已删除的 Odometry
      // 注意：enabled为false的组件已经在syncOdometryDisplay中通过removeOdometry处理，这里只处理真正删除的组件
      const currentOdometryIds = new Set(Object.keys(odometryMessages))
      rvizStore.displayComponents
        .filter(c => c.type === 'odometry')
        .forEach(odometryComponent => {
          // 只处理真正删除的组件（不在currentOdometryIds中），enabled为false的组件不在这里处理
          if (!currentOdometryIds.has(odometryComponent.id)) {
            if (context.removeOdometry) {
              context.removeOdometry(odometryComponent.id)
            }
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
