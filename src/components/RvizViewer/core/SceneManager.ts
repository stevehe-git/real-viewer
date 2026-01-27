/**
 * 场景管理器
 * 基于 regl-worldview 的架构，使用命令系统管理场景对象
 */
import type { Regl, PointCloudData, PathData, RenderOptions } from '../types'
import { grid, lines, makePointsCommand, cylinders, triangles } from '../commands'
import { quat } from 'gl-matrix'

export class SceneManager {
  private reglContext: Regl
  private worldviewContext: any // WorldviewContext
  private gridCommand: any = null
  private pointsCommand: any = null
  private linesCommand: any = null
  private cylindersCommand: any = null
  private trianglesCommand: any = null

  private gridData: any = null
  private axesData: any = null
  private pointCloudData: any = null
  private pathsData: any[] = []
  private mapDataMap = new Map<string, any>() // 支持多个地图，key 为 componentId
  private mapConfigMap = new Map<string, { alpha?: number; colorScheme?: string; drawBehind?: boolean }>() // 每个地图的配置
  private mapRawMessageMap = new Map<string, any>() // 保存每个地图的原始消息
  private laserScanData: any = null
  private laserScanConfig: { 
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
  } = {}

  private options: Required<Omit<RenderOptions, 'gridColor'>> & { gridColor: [number, number, number, number] }
  private gridVisible = true
  private axesVisible = true

  constructor(reglContext: Regl, worldviewContext: any, options?: RenderOptions) {
    this.reglContext = reglContext
    this.worldviewContext = worldviewContext
    this.options = {
      clearColor: options?.clearColor || [0.2, 0.2, 0.2, 1.0],
      enableGrid: options?.enableGrid ?? true,
      enableAxes: options?.enableAxes ?? true,
      gridSize: options?.gridSize || 10,
      gridDivisions: options?.gridDivisions ?? 5,
      gridColor: options?.gridColor || [0.67, 0.67, 0.67, 1.0]
    }

    // 初始化命令
    this.initializeCommands()
    
    // 注册绘制调用
    this.registerDrawCalls()
  }

  private initializeCommands(): void {
    // 初始化 Grid 命令
    if (this.options.enableGrid) {
      this.gridCommand = grid(this.reglContext)
      this.updateGridData()
    }

    // 初始化 Axes 命令（使用 Cylinders）
    if (this.options.enableAxes) {
      this.cylindersCommand = cylinders(this.reglContext)
      this.updateAxesData()
    }

    // 初始化 Points 命令
    this.pointsCommand = makePointsCommand({})(this.reglContext)

    // 初始化 Lines 命令（用于路径）
    this.linesCommand = lines(this.reglContext)

    // 初始化 Triangles 命令（用于地图）
    this.trianglesCommand = triangles(this.reglContext)
  }

  private updateGridData(options?: { 
    planeCellCount?: number
    normalCellCount?: number
    cellSize?: number
    color?: string
    alpha?: number
    plane?: string
    offsetX?: number
    offsetY?: number
    offsetZ?: number
  }): void {
    // 从配置选项或默认值获取参数
    const planeCellCount = options?.planeCellCount ?? this.options.gridDivisions
    const cellSize = options?.cellSize ?? 1.0
    const alpha = options?.alpha ?? 1.0
    const plane = options?.plane || 'XY'
    const offsetX = options?.offsetX ?? 0
    const offsetY = options?.offsetY ?? 0
    const offsetZ = options?.offsetZ ?? 0
    
    // 处理颜色：如果是 hex 字符串，转换为 rgba 数组
    let gridColor: [number, number, number, number] = this.options.gridColor
    if (options?.color) {
      if (typeof options.color === 'string' && options.color.startsWith('#')) {
        const r = parseInt(options.color.slice(1, 3), 16) / 255
        const g = parseInt(options.color.slice(3, 5), 16) / 255
        const b = parseInt(options.color.slice(5, 7), 16) / 255
        gridColor = [r, g, b, alpha]
      } else {
        gridColor = this.options.gridColor
      }
    } else {
      // 使用默认颜色但应用 alpha
      gridColor = [this.options.gridColor[0], this.options.gridColor[1], this.options.gridColor[2], alpha]
    }

    // 计算实际的网格数量（基于 planeCellCount）
    // count 表示网格的格子数（从 -count 到 +count）
    const count = Math.floor(planeCellCount / 2)

    // 根据 plane 计算旋转四元数
    // XY: 默认平面，不需要旋转
    // XZ: 绕 X 轴旋转 90 度
    // YZ: 绕 Y 轴旋转 -90 度
    let orientation = { x: 0, y: 0, z: 0, w: 1 } // 单位四元数
    if (plane === 'XZ') {
      // 绕 X 轴旋转 90 度 (π/2)
      const angle = Math.PI / 2
      orientation = {
        x: Math.sin(angle / 2),
        y: 0,
        z: 0,
        w: Math.cos(angle / 2)
      }
    } else if (plane === 'YZ') {
      // 绕 Y 轴旋转 -90 度 (-π/2)
      const angle = -Math.PI / 2
      orientation = {
        x: 0,
        y: Math.sin(angle / 2),
        z: 0,
        w: Math.cos(angle / 2)
      }
    }

    // Grid 命令需要 count、cellSize、color 和 pose 属性
    this.gridData = {
      count,
      cellSize,
      color: gridColor,
      pose: {
        position: { x: offsetX, y: offsetY, z: offsetZ },
        orientation
      }
    }
  }

  private updateAxesData(options?: { length?: number; radius?: number; alpha?: number }): void {
    // 根据配置选项动态生成坐标轴数据
    const length = options?.length ?? 1.0
    const radius = options?.radius ?? 0.02
    const alpha = options?.alpha ?? 1.0

    // 创建旋转四元数
    const createRotationQuaternion = (axis: 'x' | 'y' | 'z', angle: number) => {
      const q = quat.create()
      switch (axis) {
        case 'x':
          quat.setAxisAngle(q, [1, 0, 0], angle)
          break
        case 'y':
          quat.setAxisAngle(q, [0, 1, 0], angle)
          break
        case 'z':
          quat.setAxisAngle(q, [0, 0, 1], angle)
          break
      }
      return { x: q[0], y: q[1], z: q[2], w: q[3] }
    }

    const origin = { x: 0, y: 0, z: 0 }
    // X轴：红色，绕Y轴旋转-90度
    const xAxisRotation = createRotationQuaternion('y', -Math.PI / 2)
    const xAxis = {
      pose: {
        position: { x: length / 2, y: 0, z: 0 },
        orientation: xAxisRotation
      },
      points: [origin],
      scale: { x: radius, y: radius, z: length },
      color: { r: 1.0, g: 0.0, b: 0.0, a: alpha }
    }

    // Y轴：绿色，绕X轴旋转-90度
    const yAxisRotation = createRotationQuaternion('x', -Math.PI / 2)
    const yAxis = {
      pose: {
        position: { x: 0, y: length / 2, z: 0 },
        orientation: yAxisRotation
      },
      points: [origin],
      scale: { x: radius, y: radius, z: length },
      color: { r: 0.0, g: 1.0, b: 0.0, a: alpha }
    }

    // Z轴：蓝色，不需要旋转
    const zAxis = {
      pose: {
        position: { x: 0, y: 0, z: length / 2 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      },
      points: [origin],
      scale: { x: radius, y: radius, z: length },
      color: { r: 0.0, g: 0.0, b: 1.0, a: alpha }
    }

    this.axesData = [xAxis, yAxis, zAxis]
  }

  // 保存实例引用以便正确管理
  private gridInstance: any = { displayName: 'Grid' }
  private axesInstance: any = { displayName: 'Axes' }
  private pointsInstance: any = { displayName: 'Points' }
  private pathInstances: any[] = []
  private mapInstances = new Map<string, any>() // 每个地图的实例，key 为 componentId

  /**
   * 注册所有绘制调用到 WorldviewContext
   * 这个方法应该在初始化时和每次数据更新时调用
   */
  registerDrawCalls(): void {
    // 清除旧的绘制调用
    this.unregisterAllDrawCalls()

    // 注册 Grid
    if (this.gridVisible && this.gridCommand && this.gridData) {
      this.worldviewContext.onMount(this.gridInstance, grid)
      this.worldviewContext.registerDrawCall({
        instance: this.gridInstance,
        reglCommand: grid,
        children: this.gridData,
        layerIndex: 0
      })
    }

    // 注册 Axes（使用 Cylinders）
    if (this.axesVisible && this.cylindersCommand && this.axesData) {
      this.worldviewContext.onMount(this.axesInstance, cylinders)
      this.worldviewContext.registerDrawCall({
        instance: this.axesInstance,
        reglCommand: cylinders,
        children: this.axesData,
        layerIndex: 1
      })
    }

    // 注册点云
    if (this.pointsCommand && this.pointCloudData) {
      this.worldviewContext.onMount(this.pointsInstance, makePointsCommand({}))
      this.worldviewContext.registerDrawCall({
        instance: this.pointsInstance,
        reglCommand: makePointsCommand({}),
        children: this.pointCloudData,
        layerIndex: 2
      })
    }

    // 注册路径
    this.pathsData.forEach((pathData, index) => {
      if (this.linesCommand && pathData) {
        if (!this.pathInstances[index]) {
          this.pathInstances[index] = { displayName: `Path-${index}` }
        }
        this.worldviewContext.onMount(this.pathInstances[index], lines)
        this.worldviewContext.registerDrawCall({
          instance: this.pathInstances[index],
          reglCommand: lines,
          children: pathData,
          layerIndex: 3 + index
        })
      }
    })

    // 注册所有地图（使用 Triangles）
    this.mapDataMap.forEach((mapData, componentId) => {
      if (this.trianglesCommand && mapData) {
        let mapInstance = this.mapInstances.get(componentId)
        if (!mapInstance) {
          mapInstance = { displayName: `Map-${componentId}` }
          this.mapInstances.set(componentId, mapInstance)
        }
        const mapConfig = this.mapConfigMap.get(componentId) || {}
        this.worldviewContext.onMount(mapInstance, triangles)
        this.worldviewContext.registerDrawCall({
          instance: mapInstance,
          reglCommand: triangles,
          children: mapData,
          layerIndex: mapConfig.drawBehind ? -1 : 4
        })
      }
    })
  }

  /**
   * 取消注册所有绘制调用
   */
  private unregisterAllDrawCalls(): void {
    // 清除所有实例的绘制调用
    this.worldviewContext.onUnmount(this.gridInstance)
    this.worldviewContext.onUnmount(this.axesInstance)
    this.worldviewContext.onUnmount(this.pointsInstance)
    this.mapInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    this.pathInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    this.pathInstances = []
  }

  /**
   * 更新点云数据
   */
  updatePointCloud(data: PointCloudData): void {
    if (!data || !data.points || data.points.length === 0) {
      this.pointCloudData = null
      return
    }

    const points: any[] = []
    const colors: any[] = []
    const defaultColor = { r: 1, g: 1, b: 1, a: 1 }
    const pointSize = data.pointSize || 3.0

    data.points.forEach((point, index) => {
      points.push({ x: point.x, y: point.y, z: point.z })
      const color = data.colors?.[index] || defaultColor
      colors.push(color)
    })

    this.pointCloudData = {
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      },
      points,
      colors: colors.length > 0 ? colors : undefined,
      color: colors.length === 0 ? defaultColor : undefined,
      scale: { x: pointSize, y: pointSize, z: pointSize }
    }

    // 重新注册绘制调用
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 添加路径
   */
  addPath(data: PathData): number {
    if (!data || !data.waypoints || data.waypoints.length < 2) {
      return -1
    }

    const points: any[] = []
    const defaultColor = data.color || { r: 0, g: 1, b: 0, a: 1 }

    data.waypoints.forEach((point) => {
      points.push({ x: point.x, y: point.y, z: point.z })
    })

    const pathData = {
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      },
      points,
      color: defaultColor,
      scale: { x: data.lineWidth || 1, y: data.lineWidth || 1, z: data.lineWidth || 1 },
      primitive: 'line strip' as const
    }

    this.pathsData.push(pathData)
    // 重新注册绘制调用
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
    return this.pathsData.length - 1
  }

  /**
   * 清除所有路径
   */
  clearPaths(): void {
    this.pathsData = []
    // 只有在 WorldviewContext 已初始化时才重新注册绘制调用
    if (this.worldviewContext.initializedData) {
      this.registerDrawCalls()
      // 不调用 onDirty，由调用者统一处理最终渲染
    }
  }

  /**
   * 清除点云
   */
  clearPointCloud(): void {
    this.pointCloudData = null
    // 不调用 onDirty，由调用者统一处理最终渲染
  }

  /**
   * 设置网格可见性
   */
  setGridVisible(visible: boolean): void {
    this.gridVisible = visible
    
    // 如果设置为可见，确保命令和数据已初始化
    if (visible) {
      // 确保 gridCommand 已初始化
      if (!this.gridCommand) {
        this.gridCommand = grid(this.reglContext)
      }
      // 确保 gridData 已初始化
      if (!this.gridData) {
        this.updateGridData()
      }
    }
    
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 更新网格配置选项
   */
  updateGridOptions(options: { 
    planeCellCount?: number
    normalCellCount?: number
    cellSize?: number
    color?: string
    alpha?: number
    plane?: string
    offsetX?: number
    offsetY?: number
    offsetZ?: number
  }): void {
    // 更新网格数据
    this.updateGridData(options)
    // 重新注册绘制调用
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 设置网格配置选项（别名方法）
   */
  setGridOptions(options: { 
    planeCellCount?: number
    normalCellCount?: number
    cellSize?: number
    color?: string
    alpha?: number
    plane?: string
    offsetX?: number
    offsetY?: number
    offsetZ?: number
  }): void {
    this.updateGridOptions(options)
  }

  /**
   * 设置坐标轴可见性
   */
  setAxesVisible(visible: boolean): void {
    this.axesVisible = visible
    
    // 如果设置为可见，确保命令和数据已初始化
    if (visible) {
      // 确保 cylindersCommand 已初始化（用于渲染坐标轴）
      if (!this.cylindersCommand) {
        this.cylindersCommand = cylinders(this.reglContext)
      }
      // 确保 axesData 已初始化
      if (!this.axesData) {
        this.updateAxesData()
      }
    }
    
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 更新坐标轴配置（长度、半径、透明度等）
   */
  updateAxesOptions(options: { length?: number; radius?: number; alpha?: number }): void {
    // 更新坐标轴数据
    this.updateAxesData(options)
    // 重新注册绘制调用
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 设置坐标轴配置选项（别名方法）
   */
  setAxesOptions(options: { length?: number; radius?: number; alpha?: number }): void {
    this.updateAxesOptions(options)
  }

  /**
   * 更新地图数据（从 ROS OccupancyGrid 消息）
   * 使用 Web Worker 进行后台处理，避免阻塞主线程
   */
  async updateMap(message: any, componentId: string): Promise<void> {
    if (!componentId) {
      console.warn('updateMap: componentId is required')
      return
    }

    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      this.mapDataMap.delete(componentId)
      this.mapRawMessageMap.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      return
    }

    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05

    if (width === 0 || height === 0 || resolution === 0) {
      this.mapDataMap.delete(componentId)
      this.mapRawMessageMap.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      return
    }

    // 保存原始消息
    this.mapRawMessageMap.set(componentId, message)
    
    // 获取该地图的配置
    const mapConfig = this.mapConfigMap.get(componentId) || {}
    const alpha = mapConfig.alpha ?? 0.7
    const colorScheme = mapConfig.colorScheme || 'map'

    try {
      // 使用 Web Worker 处理地图数据（异步，不阻塞主线程）
      const { getDataProcessorWorker } = await import('@/workers/dataProcessorWorker')
      const worker = getDataProcessorWorker()
      
      const result = await worker.processMap({
        type: 'processMap',
        componentId,
        message,
        config: {
          alpha,
          colorScheme,
          maxOptimalSize: 200
        }
      })

      // 保存处理后的数据
      this.mapDataMap.set(componentId, result.triangles)
      
      // 延迟注册绘制调用
      requestAnimationFrame(() => {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      })
    } catch (error) {
      console.error('Failed to process map in worker:', error)
      // Worker 失败时回退到同步处理（已在 worker 内部处理）
      // 这里不需要额外处理，因为 worker 会自动回退
    }
  }

  /**
   * 移除地图数据
   * @param componentId 组件ID
   */
  removeMap(componentId: string): void {
    this.mapDataMap.delete(componentId)
    this.mapConfigMap.delete(componentId)
    this.mapRawMessageMap.delete(componentId)
    this.mapInstances.delete(componentId)
    
    // 延迟注册绘制调用，避免频繁调用
    requestAnimationFrame(() => {
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
    })
  }

  /**
   * 清除所有地图数据（用于断开连接时）
   */
  clearAllMaps(): void {
    this.mapDataMap.clear()
    this.mapConfigMap.clear()
    this.mapRawMessageMap.clear()
    this.mapInstances.clear()
    
    // 立即重新注册绘制调用（清除地图后）
    this.registerDrawCalls()
    // 不调用 onDirty，由调用者统一处理最终渲染
  }

  /**
   * 更新 Map 配置选项（透明度、颜色方案、绘制顺序等）
   * @param options 配置选项
   * @param componentId 组件ID，用于区分不同的地图
   */
  updateMapOptions(options: { 
    alpha?: number
    colorScheme?: string
    drawBehind?: boolean
  }, componentId: string): void {
    if (!componentId) {
      console.warn('updateMapOptions: componentId is required')
      return
    }

    // 更新该地图的配置
    const currentConfig = this.mapConfigMap.get(componentId) || {}
    this.mapConfigMap.set(componentId, {
      ...currentConfig,
      ...options
    })
    
    // 如果该地图的原始消息存在，重新生成地图数据以应用新配置
    const mapRawMessage = this.mapRawMessageMap.get(componentId)
    if (mapRawMessage) {
      // 重新处理地图数据以应用新配置
      this.updateMap(mapRawMessage, componentId)
    }
  }

  /**
   * 设置 Map 配置选项（别名方法）
   * @param options 配置选项
   * @param componentId 组件ID
   */
  setMapOptions(options: { 
    alpha?: number
    colorScheme?: string
    drawBehind?: boolean
  }, componentId: string): void {
    this.updateMapOptions(options, componentId)
  }

  /**
   * 更新 LaserScan 配置选项（样式、大小、透明度、颜色转换器等）
   */
  updateLaserScanOptions(options: { 
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
  }): void {
    // 更新 LaserScan 配置
    this.laserScanConfig = {
      ...this.laserScanConfig,
      ...options
    }
    // 如果 LaserScan 数据存在，应用新配置并重新渲染
    if (this.laserScanData) {
      // TODO: 应用配置到 LaserScan 数据（style、size、alpha、colorTransformer等）
      // 这里需要根据实际的 LaserScan 渲染实现来更新
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
    }
  }

  /**
   * 设置 LaserScan 配置选项（别名方法）
   */
  setLaserScanOptions(options: { 
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
  }): void {
    this.updateLaserScanOptions(options)
  }

  /**
   * 销毁网格
   */
  destroyGrid(): void {
    this.gridVisible = false
    this.gridCommand = null
    this.gridData = null
    this.worldviewContext.onUnmount(this.gridInstance)
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 销毁坐标轴
   */
  destroyAxes(): void {
    this.axesVisible = false
    this.cylindersCommand = null
    this.axesData = null
    this.worldviewContext.onUnmount(this.axesInstance)
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 创建网格
   */
  createGrid(): void {
    if (!this.gridCommand) {
      this.gridCommand = grid(this.reglContext)
    }
    if (!this.gridData) {
      this.updateGridData()
    }
    this.gridVisible = true
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 创建坐标轴
   */
  createAxes(): void {
    if (!this.cylindersCommand) {
      this.cylindersCommand = cylinders(this.reglContext)
    }
    if (!this.axesData) {
      this.updateAxesData()
    }
    this.axesVisible = true
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 销毁场景
   */
  destroy(): void {
    // 先清除所有绘制调用，避免在销毁时触发渲染
    this.unregisterAllDrawCalls()
    // 清除数据，但不触发渲染
    this.pathsData = []
    this.pointCloudData = null
    this.gridCommand = null
    this.pointsCommand = null
    this.linesCommand = null
    this.cylindersCommand = null
    this.axesData = null
    this.gridData = null
    this.mapDataMap.clear()
    this.mapConfigMap.clear()
    this.mapRawMessageMap.clear()
    this.mapInstances.clear()
    
    // 清理 Web Worker（延迟导入避免循环依赖）
    import('@/workers/dataProcessorWorker').then(({ destroyDataProcessorWorker }) => {
      destroyDataProcessorWorker()
    }).catch(() => {
      // Worker 可能未初始化，忽略错误
    })
  }
}
