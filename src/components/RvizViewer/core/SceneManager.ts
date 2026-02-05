/**
 * 场景管理器
 * 基于 regl-worldview 的架构，使用命令系统管理场景对象
 */
import type { Regl, PointCloudData, PathData, RenderOptions } from '../types'
import { grid, lines, makePointsCommand, cylinders, makeArrowsCommand, makeMapTextureCommand } from '../commands'
import { clearMapTextureCache, clearAllMapTextureCache } from '../commands/MapTexture'
import { quat } from 'gl-matrix'
import { tfManager } from '@/services/tfManager'
import { getDataProcessorWorker } from '@/workers/dataProcessorWorker'
import type { TFProcessRequest } from '@/workers/dataProcessor.worker'
import { tfDebugger } from '@/utils/debug'

export class SceneManager {
  private reglContext: Regl
  private worldviewContext: any // WorldviewContext
  private gridCommand: any = null
  private pointsCommandWithWorldSpace: any = null // 带 useWorldSpaceSize 的 Points 命令
  private linesCommand: any = null
  private cylindersCommand: any = null
  private arrowsCommand: any = null
  private arrowsCommandFactory: any = null // Arrows 命令工厂函数（用于 onMount 和 registerDrawCall）

  private gridData: any = null
  private axesData: any = null
  private pointCloudDataMap = new Map<string, any>() // 支持多个 PointCloud，key 为 componentId
  private pointCloudConfigMap = new Map<string, { pointSize?: number }>() // 每个 PointCloud 的配置
  private pointCloud2DataMap = new Map<string, any>() // 支持多个 PointCloud2，key 为 componentId
  private pointCloud2ConfigMap = new Map<string, { 
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
  }>() // 每个 PointCloud2 的配置
  private pathsData: any[] = []
  private mapTextureDataMap = new Map<string, any>() // 地图纹理数据，key 为 componentId
  private mapConfigMap = new Map<string, { alpha?: number; colorScheme?: string; drawBehind?: boolean }>() // 每个地图的配置
  private mapTopicMap = new Map<string, string>() // 每个地图的话题名称，key 为 componentId，用于排序
  private mapRawMessageMap = new Map<string, any>() // 保存每个地图的原始消息
  private mapDataHashMap = new Map<string, string>() // 地图数据哈希，用于检测数据是否变化
  private mapMessageHashMap = new Map<string, string>() // 地图消息完整哈希（包含数据内容），用于精确检测变化
  // Costmap 增量更新相关
  private mapRawDataMap = new Map<string, Int8Array>() // 保存完整的 costmap 原始数据（用于增量更新），key 为 componentId
  private mapMetadataMap = new Map<string, { width: number; height: number; resolution: number; origin: any }>() // 保存 costmap 的元信息
  private costmapUpdatesMap = new Map<string, string>() // key: updates componentId, value: costmap componentId
  private laserScanDataMap = new Map<string, any>() // 支持多个 LaserScan，key 为 componentId
  private laserScanConfigMap = new Map<string, { 
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
  }>() // 每个 LaserScan 的配置
  private laserScanRequestIds = new Map<string, number>() // 每个 LaserScan 的当前请求 ID
  private pointCloud2RequestIds = new Map<string, number>() // 每个 PointCloud2 的当前请求 ID
  private laserScanRequestIdCounter = 0
  private pointCloud2RequestIdCounter = 0

  private options: Required<Omit<RenderOptions, 'gridColor'>> & { gridColor: [number, number, number, number] }
  private gridVisible = true
  private axesVisible = true
  private tfVisible = false
  private tfConfig: {
    showNames?: boolean
    showAxes?: boolean
    showArrows?: boolean
    markerScale?: number
    markerAlpha?: number
    frameTimeout?: number
    filterWhitelist?: string
    filterBlacklist?: string
    frames?: Array<{ name: string; enabled: boolean }>
  } = {}
  private tfData: {
    axes: any[]
    arrows: any[]
  } | null = null
  private tfDataHash: string = '' // 用于检测数据是否变化
  private mapRequestIds = new Map<string, number>() // 每个地图的当前请求 ID，用于取消过时的请求
  private mapRequestIdCounter = 0 // 请求 ID 计数器
  
  
  // 性能优化：复用mapProps对象池（按componentId缓存）
  private _mapPropsCache = new Map<string, any>()

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

    // 初始化带 useWorldSpaceSize 的 Points 命令（用于 LaserScan 和 PointCloud）
    this.pointsCommandWithWorldSpace = makePointsCommand({ useWorldSpaceSize: true })

    // 初始化 Lines 命令（用于路径）
    this.linesCommand = lines(this.reglContext)
    
    // 地图命令现在为每个地图独立创建，不再需要全局工厂函数

    // 初始化 Arrows 命令（用于 TF 箭头）
    this.arrowsCommand = makeArrowsCommand()(this.reglContext)
    // 保存 Arrows 命令工厂函数引用，确保 onMount 和 registerDrawCall 使用同一个引用
    this.arrowsCommandFactory = makeArrowsCommand()
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
  // 彻底重构：参照 RViz，所有地图共享一次 camera.draw 调用，在回调内部依次渲染
  private mapCommands = new Map<string, any>() // 每个地图的独立 regl command 实例
  private mapPropsMap = new Map<string, any>() // 每个地图的渲染 props
  private mapRenderCallback: (() => void) | null = null // 统一的地图渲染回调（所有地图共享）
  private laserScanInstances = new Map<string, any>() // 每个 LaserScan 的实例，key 为 componentId
  private pointCloudInstances = new Map<string, any>() // 每个 PointCloud 的实例，key 为 componentId
  private pointCloud2Instances = new Map<string, any>() // 每个 PointCloud2 的实例，key 为 componentId
  private tfAxesInstance: any = { displayName: 'TF-Axes' }
  private tfArrowsInstance: any = { displayName: 'TF-Arrows' }

  /**
   * 注册所有绘制调用到 WorldviewContext
   * 这个方法应该在初始化时和每次数据更新时调用
   */
  registerDrawCalls(): void {
    // 清除旧的绘制调用
    this.unregisterAllDrawCalls()

    // 注册 Grid
    // 关键修复：网格使用更高的 layerIndex (5)，确保网格在地图之后渲染，始终可见
    if (this.gridVisible && this.gridCommand && this.gridData) {
      this.worldviewContext.onMount(this.gridInstance, grid)
      this.worldviewContext.registerDrawCall({
        instance: this.gridInstance,
        reglCommand: grid,
        children: this.gridData,
        layerIndex: 5 // 网格在地图之后渲染，确保网格始终可见
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

    // 注册所有 PointCloud（单个实例渲染）
    this.pointCloudDataMap.forEach((pointCloudData, componentId) => {
      if (this.pointsCommandWithWorldSpace && pointCloudData) {
        // 获取或创建单个实例
        if (!this.pointCloudInstances.has(componentId)) {
          this.pointCloudInstances.set(componentId, { displayName: `PointCloud-${componentId}` })
        }
        const instance = this.pointCloudInstances.get(componentId)
        this.worldviewContext.onMount(instance, this.pointsCommandWithWorldSpace)
        this.worldviewContext.registerDrawCall({
          instance: instance,
          reglCommand: this.pointsCommandWithWorldSpace,
          children: pointCloudData,
          layerIndex: 2
        })
      }
    })

    // 注册所有 PointCloud2（单个实例渲染）
    this.pointCloud2DataMap.forEach((pointCloud2Data, componentId) => {
      if (this.pointsCommandWithWorldSpace && pointCloud2Data) {
        // 获取或创建单个实例
        if (!this.pointCloud2Instances.has(componentId)) {
          this.pointCloud2Instances.set(componentId, { displayName: `PointCloud2-${componentId}` })
        }
        const instance = this.pointCloud2Instances.get(componentId)
        this.worldviewContext.onMount(instance, this.pointsCommandWithWorldSpace)
        this.worldviewContext.registerDrawCall({
          instance: instance,
          reglCommand: this.pointsCommandWithWorldSpace,
          children: pointCloud2Data,
          layerIndex: 2.5
        })
      }
    })

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

    // 地图不再在 registerDrawCalls 中统一处理
    // 每个地图独立管理，只在数据变化时更新（参照 RViz 的独立 Display 模式）
    // 这样可以避免静态大地图每帧都重新注册，提升性能

    // 注册所有 LaserScan（单个实例渲染）
    this.laserScanDataMap.forEach((laserScanData, componentId) => {
      if (this.pointsCommandWithWorldSpace && laserScanData) {
        // 获取或创建单个实例
        if (!this.laserScanInstances.has(componentId)) {
          this.laserScanInstances.set(componentId, { displayName: `LaserScan-${componentId}` })
        }
        const instance = this.laserScanInstances.get(componentId)
        this.worldviewContext.onMount(instance, this.pointsCommandWithWorldSpace)
        this.worldviewContext.registerDrawCall({
          instance: instance,
          reglCommand: this.pointsCommandWithWorldSpace,
          children: laserScanData,
          layerIndex: 5
        })
      }
    })

    // 注册 TF Axes（使用 Cylinders）
    if (this.tfVisible && this.cylindersCommand && this.tfData && this.tfData.axes && this.tfData.axes.length > 0) {
      this.worldviewContext.onMount(this.tfAxesInstance, cylinders)
      this.worldviewContext.registerDrawCall({
        instance: this.tfAxesInstance,
        reglCommand: cylinders,
        children: this.tfData.axes,
        layerIndex: 5.5
      })
    }

    // 注册 TF Arrows（使用 Arrows）
    if (this.tfVisible && this.arrowsCommand && this.arrowsCommandFactory && this.tfData && this.tfData.arrows && this.tfData.arrows.length > 0) {
      // 使用同一个命令工厂函数引用，确保编译和注册使用相同的函数
      this.worldviewContext.onMount(this.tfArrowsInstance, this.arrowsCommandFactory)
      this.worldviewContext.registerDrawCall({
        instance: this.tfArrowsInstance,
        reglCommand: this.arrowsCommandFactory,
        children: this.tfData.arrows,
        layerIndex: 5.6
      })
    }
  }

  /**
   * 取消注册指定组件的绘制调用
   * @param componentId 组件ID
   */
  // 已移除：不再使用 WorldviewContext 的 draw calls 系统

  /**
   * 取消注册所有绘制调用
   */
  private unregisterAllDrawCalls(): void {
    // 清除所有实例的绘制调用
    this.worldviewContext.onUnmount(this.gridInstance)
    this.worldviewContext.onUnmount(this.axesInstance)
    this.worldviewContext.onUnmount(this.pointsInstance)
    
    // 地图不再通过 draw calls 系统，已移除相关代码
    // 清除批量渲染实例的逻辑已移除，现在使用单个实例渲染
    
    // 清除 LaserScan、PointCloud、PointCloud2 实例
    this.laserScanInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    this.pointCloudInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    this.pointCloud2Instances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    
    this.pathInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    this.pathInstances = []
    
    // 清除 TF 实例
    this.worldviewContext.onUnmount(this.tfAxesInstance)
    this.worldviewContext.onUnmount(this.tfArrowsInstance)
  }

  /**
   * 更新点云数据
   */
  /**
   * 更新点云数据（使用 Web Worker 处理，支持多实例）
   */
  async updatePointCloud(data: PointCloudData, componentId: string): Promise<void> {
    if (!componentId) {
      console.warn('updatePointCloud: componentId is required')
      return
    }

    if (!data || !data.points || data.points.length === 0) {
      this.pointCloudDataMap.delete(componentId)
      this.pointCloudConfigMap.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      return
    }

    try {
      // 使用 Web Worker 处理点云数据（异步，不阻塞主线程）
      // 序列化点云数据，确保可传递给 Worker（只提取必要的字段）
      const serializedData = {
        points: data.points ? data.points.map((p: any) => ({
          x: p.x || 0,
          y: p.y || 0,
          z: p.z || 0
        })) : [],
        colors: data.colors ? data.colors.map((c: any) => ({
          r: c.r || 1,
          g: c.g || 1,
          b: c.b || 1,
          a: c.a || 1
        })) : undefined,
        pointSize: data.pointSize || 3.0
      }
      
      const { getDataProcessorWorker } = await import('@/workers/dataProcessorWorker')
      const worker = getDataProcessorWorker()
      
      const result = await worker.processPointCloud({
        type: 'processPointCloud',
        data: serializedData
      })

      if (result.error) {
        console.error('Failed to process point cloud:', result.error)
        return
      }

      // 保存处理后的数据
      this.pointCloudDataMap.set(componentId, result.data)
      this.pointCloudConfigMap.set(componentId, { pointSize: data.pointSize || 3.0 })
      
      // 延迟注册绘制调用
      requestAnimationFrame(() => {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      })
    } catch (error) {
      console.error('Failed to process point cloud in worker:', error)
      // Worker 失败时回退到同步处理（已在 worker 内部处理）
    }
  }

  /**
   * 移除 PointCloud 数据
   */
  removePointCloud(componentId: string): void {
    this.pointCloudDataMap.delete(componentId)
    this.pointCloudConfigMap.delete(componentId)
    this.pointCloudInstances.delete(componentId)
    requestAnimationFrame(() => {
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
    })
  }

  /**
   * 清除所有 PointCloud 数据
   */
  clearAllPointClouds(): void {
    this.pointCloudDataMap.clear()
    this.pointCloudConfigMap.clear()
    this.pointCloudInstances.clear()
    this.registerDrawCalls()
  }

  /**
   * 添加路径（使用 Web Worker 处理）
   */
  async addPath(data: PathData): Promise<number> {
    if (!data || !data.waypoints || data.waypoints.length < 2) {
      return -1
    }

    try {
      // 使用 Web Worker 处理路径数据（异步，不阻塞主线程）
      // 序列化路径数据，确保可传递给 Worker（只提取必要的字段）
      const serializedData = {
        waypoints: data.waypoints ? data.waypoints.map((w: any) => ({
          x: w.x || 0,
          y: w.y || 0,
          z: w.z || 0
        })) : [],
        color: data.color ? {
          r: data.color.r || 0,
          g: data.color.g || 1,
          b: data.color.b || 0,
          a: data.color.a || 1
        } : undefined,
        lineWidth: data.lineWidth || 1
      }
      
      const { getDataProcessorWorker } = await import('@/workers/dataProcessorWorker')
      const worker = getDataProcessorWorker()
      
      const result = await worker.processPath({
        type: 'processPath',
        data: serializedData
      })

      if (result.error || !result.pathData) {
        console.error('Failed to process path:', result.error)
        return -1
      }

      // 保存处理后的数据
      this.pathsData.push(result.pathData)
      
      // 延迟注册绘制调用
      requestAnimationFrame(() => {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      })
      
      return this.pathsData.length - 1
    } catch (error) {
      console.error('Failed to process path in worker:', error)
      // Worker 失败时回退到同步处理
      return this.addPathSync(data)
    }
  }

  /**
   * 同步添加路径（主线程回退方案）
   */
  private addPathSync(data: PathData): number {
    if (!data || !data.waypoints || data.waypoints.length < 2) {
      return -1
    }

    const points: any[] = []
    const defaultColor = data.color || { r: 0, g: 1, b: 0, a: 1 }

    // 优化：使用 for 循环而不是 forEach
    const waypoints = data.waypoints
    for (let i = 0; i < waypoints.length; i++) {
      const point = waypoints[i]
      if (point) {
        points.push({ x: point.x, y: point.y, z: point.z })
      }
    }

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
   * 生成地图消息的完整哈希（包含数据内容）
   * 用于精确检测数据是否变化，避免不必要的渲染更新
   */
  private generateMapMessageHash(message: any): string {
    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      return ''
    }

    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05
    const originX = info.origin?.position?.x || 0
    const originY = info.origin?.position?.y || 0
    const data = message.data
    const dataLength = data.length

    // 基础哈希：元数据
    let hash = `${width}_${height}_${resolution}_${originX}_${originY}_${dataLength}`

    // 数据内容哈希：采样检查（对于大地图，只检查关键部分）
    // 检查前100个、中间100个、后100个数据点，以及数据长度
    const sampleSize = Math.min(100, Math.floor(dataLength / 3))
    if (dataLength > 0) {
      // 前100个点
      for (let i = 0; i < sampleSize && i < dataLength; i++) {
        hash += `_${data[i]}`
      }
      // 中间100个点
      if (dataLength > sampleSize * 2) {
        const midStart = Math.floor(dataLength / 2) - Math.floor(sampleSize / 2)
        for (let i = midStart; i < midStart + sampleSize && i < dataLength; i++) {
          hash += `_${data[i]}`
        }
      }
      // 后100个点
      if (dataLength > sampleSize) {
        const endStart = Math.max(0, dataLength - sampleSize)
        for (let i = endStart; i < dataLength; i++) {
          hash += `_${data[i]}`
        }
      }
    }

    return hash
  }

  /**
   * 更新地图数据（从 ROS OccupancyGrid 消息）
   * 使用 Web Worker 进行后台处理，避免阻塞主线程
   * 始终只渲染最新的一帧数据，自动取消过时的请求
   * 优化：只有数据真正变化时才进行更新
   */
  async updateMap(message: any, componentId: string): Promise<void> {
    if (!componentId) {
      console.warn('updateMap: componentId is required')
      return
    }

    // 如果 mapTopicMap 中没有 topic，从 store 获取并设置
    // 解决时序问题：watch 监听消息变化时，setMapOptions 可能还未执行
    if (!this.mapTopicMap.has(componentId)) {
      try {
        const { useRvizStore } = await import('@/stores/rviz')
        const rvizStore = useRvizStore()
        const mapComponent = rvizStore.displayComponents.find(c => c.id === componentId && c.type === 'map')
        if (mapComponent && mapComponent.options?.topic) {
          this.mapTopicMap.set(componentId, mapComponent.options.topic)
        }
      } catch (error) {
        // 忽略错误，可能是循环依赖或其他问题
      }
    }

    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      // 消息无效，清理数据
      const hadData = this.mapTextureDataMap.has(componentId)
      this.mapTextureDataMap.delete(componentId)
      this.mapRawMessageMap.delete(componentId)
      this.mapDataHashMap.delete(componentId)
      this.mapMessageHashMap.delete(componentId)
      this.mapRequestIds.delete(componentId)
      // 只有之前有数据时才触发渲染更新
      if (hadData) {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      }
      return
    }

    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05

    if (width === 0 || height === 0 || resolution === 0) {
      // 数据无效，清理
      const hadData = this.mapTextureDataMap.has(componentId)
      this.mapTextureDataMap.delete(componentId)
      this.mapRawMessageMap.delete(componentId)
      this.mapDataHashMap.delete(componentId)
      this.mapMessageHashMap.delete(componentId)
      this.mapRequestIds.delete(componentId)
      // 只有之前有数据时才触发渲染更新
      if (hadData) {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      }
      return
    }

    // 性能优化：提前检测消息是否真的变化了
    // 生成完整的消息哈希（包含数据内容）
    const messageHash = this.generateMapMessageHash(message)
    const lastMessageHash = this.mapMessageHashMap.get(componentId)

    // 如果消息哈希相同，说明数据完全没有变化，直接返回
    // 这样可以避免不必要的 Worker 处理和渲染更新
    if (lastMessageHash === messageHash && this.mapTextureDataMap.has(componentId)) {
      // 数据未变化，取消请求但不清除现有数据，也不触发渲染
      return
    }

    // 生成新的请求 ID（用于取消过时的请求）
    this.mapRequestIdCounter++
    const requestId = this.mapRequestIdCounter
    this.mapRequestIds.set(componentId, requestId)
    
    // 关键修复：不在 updateMap 中缓存配置，而是在 registerDrawCalls 时从 mapConfigMap 读取最新配置
    // 这样可以确保即使配置在数据更新之后才更新，也能正确应用
    // 注意：Worker 处理时仍然需要配置，但这里只用于 Worker 处理，不影响最终渲染
    const mapConfig = this.mapConfigMap.get(componentId) || {}
    const alpha = mapConfig.alpha ?? 0.7
    const colorScheme = mapConfig.colorScheme || 'map'

    try {
      // 使用 Web Worker 处理地图数据（异步，不阻塞主线程）
      // 序列化消息数据，确保可传递给 Worker（只提取必要的字段）
      const serializedMessage = {
        info: {
          width: message.info?.width || 0,
          height: message.info?.height || 0,
          resolution: message.info?.resolution || 0.05,
          origin: {
            position: {
              x: message.info?.origin?.position?.x || 0,
              y: message.info?.origin?.position?.y || 0,
              z: message.info?.origin?.position?.z || 0
            },
            orientation: {
              x: message.info?.origin?.orientation?.x || 0,
              y: message.info?.origin?.orientation?.y || 0,
              z: message.info?.origin?.orientation?.z || 0,
              w: message.info?.origin?.orientation?.w || 1
            }
          }
        },
        // 性能优化：避免不必要的数组复制
        // 如果已经是普通数组，直接使用；否则才转换
        data: Array.isArray(message.data) && !(message.data instanceof Uint8Array) && !(message.data instanceof Int8Array)
          ? message.data // 已经是普通数组，直接使用
          : (message.data instanceof Uint8Array || message.data instanceof Int8Array)
            ? Array.from(message.data) // TypedArray需要转换
            : []
      }
      
      const { getDataProcessorWorker } = await import('@/workers/dataProcessorWorker')
      const worker = getDataProcessorWorker()
      
      // 使用 componentId 作为 requestId，这样相同 componentId 的新请求会自动取消旧请求
      // 注意：Worker 处理时使用的配置只影响纹理数据的生成，不影响最终渲染时的颜色方案
      // 最终渲染时的颜色方案在 registerDrawCalls 时从 mapConfigMap 读取
      const result = await worker.processMap({
        type: 'processMap',
        componentId,
        message: serializedMessage,
        config: {
          alpha,
          colorScheme, // 这个只用于 Worker 处理，不影响最终渲染
          maxOptimalSize: 200
        }
      })

      // 检查请求是否已被取消（过时的请求）
      const currentRequestId = this.mapRequestIds.get(componentId)
      if (currentRequestId !== requestId) {
        // 请求已被取消，忽略结果
        return
      }

      // 保存处理后的纹理数据
      if (result.textureData) {
        // 生成元数据哈希（用于纹理缓存）
        const dataHash = `${width}_${height}_${resolution}_${message.info?.origin?.position?.x || 0}_${message.info?.origin?.position?.y || 0}`
        
        this.mapTextureDataMap.set(componentId, {
          textureData: result.textureData,
          width: result.width,
          height: result.height,
          resolution: result.resolution,
          origin: result.origin,
          dataHash: result.dataHash || dataHash
        })
        this.mapDataHashMap.set(componentId, dataHash)
        // 保存完整的消息哈希，用于下次变化检测
        this.mapMessageHashMap.set(componentId, messageHash)
        
        // 如果是 costmap topic（支持 global_costmap 和 local_costmap），保存完整数据用于增量更新
        // 例如：/move_base/global_costmap/costmap 或 /move_base/local_costmap/costmap
        const topic = this.mapTopicMap.get(componentId) || ''
        if (topic.endsWith('/costmap')) {
          // 保存完整的原始数据
          const dataArray = Array.isArray(message.data) 
            ? new Int8Array(message.data)
            : (message.data instanceof Int8Array 
              ? message.data 
              : (message.data instanceof Uint8Array
                ? new Int8Array(message.data)
                : new Int8Array(Array.from(message.data || []))))
          this.mapRawDataMap.set(componentId, dataArray)
          
          // 保存元信息
          this.mapMetadataMap.set(componentId, {
            width,
            height,
            resolution,
            origin: message.info?.origin || {}
          })
        }
      }
      
      // 性能优化：检测是否有大地图，用于调整渲染帧率
      // 如果地图面积超过阈值（例如 10000 像素），认为是大地图
      const mapArea = width * height
      const isLargeMap = mapArea > 10000
      if (typeof this.worldviewContext.setHasLargeMap === 'function') {
        // 检查所有地图，如果有任何一个大地图，就标记为有大地图
        let hasAnyLargeMap = isLargeMap
        if (!hasAnyLargeMap) {
          this.mapTextureDataMap.forEach((_, id) => {
            const msg = this.mapRawMessageMap.get(id)
            if (msg?.info) {
              const area = (msg.info.width || 0) * (msg.info.height || 0)
              if (area > 10000) {
                hasAnyLargeMap = true
              }
            }
          })
        }
        this.worldviewContext.setHasLargeMap(hasAnyLargeMap)
      }
      
      // 只在需要重新处理配置时才保存原始消息（用于 updateMapOptions）
      // 这样可以减少内存占用
      if (!this.mapRawMessageMap.has(componentId)) {
        // 只保存消息的元数据，不保存完整的数据数组
        this.mapRawMessageMap.set(componentId, {
          info: message.info,
          // 不保存 data，因为已经处理过了
          _processed: true
        })
      }
      
      // 参照 RViz：每个地图独立更新，只有数据变化的地图才更新 draw call
      // 静态地图保持现有 draw call，不重复注册
      this.updateMapDrawCall(componentId)
    } catch (error: any) {
      // 检查请求是否已被取消
      const currentRequestId = this.mapRequestIds.get(componentId)
      if (currentRequestId !== requestId) {
        // 请求已被取消，忽略错误
        return
      }
      
      // 忽略 "Request cancelled" 错误（这是正常的优化行为）
      if (error?.message !== 'Request cancelled' && error?.message !== 'Processing timeout') {
        console.error('Failed to process map in worker:', error)
      }
      // Worker 失败时回退到同步处理（已在 worker 内部处理）
      // 这里不需要额外处理，因为 worker 会自动回退
    }
  }

  /**
   * 彻底重构：每个地图独立渲染，不通过 WorldviewContext 的 draw calls 系统
   * 为每个地图创建独立的 regl command 实例，直接渲染，避免遍历所有 draw calls
   */
  private updateMapDrawCall(componentId: string): void {
    const textureData = this.mapTextureDataMap.get(componentId)
    if (!textureData || !textureData.textureData) {
      // 没有数据，移除渲染数据
      this.removeMapRenderData(componentId)
      return
    }

    // 为每个地图创建独立的 regl command 实例（关键优化）
    if (!this.mapCommands.has(componentId)) {
      const mapCommand = makeMapTextureCommand()(this.reglContext)
      this.mapCommands.set(componentId, mapCommand)
    }

    // 从 mapConfigMap 读取最新配置
    const currentConfig = this.mapConfigMap.get(componentId) || {}
    const colorScheme = currentConfig.colorScheme || 'map'
    const alpha = currentConfig.alpha ?? 1.0
    const drawBehind = currentConfig.drawBehind || false

    // 参照 RViz：为每个地图分配唯一的 Z 偏移，避免深度冲突和渲染不完全
    // 策略：
    // 1. drawBehind 地图在 Z < 0，按添加顺序分配 -0.01, -0.02, -0.03...
    // 2. 正常地图在 Z >= 0，按添加顺序分配 0.0, 0.001, 0.002...
    // 3. 使用足够大的间隔（0.001）避免浮点精度问题导致的 Z-fighting
    // 4. 确保每个地图有唯一的深度值，避免在不同视角下出现渲染不完全
    const allMapIds = Array.from(this.mapPropsMap.keys())
    
    // 分离 drawBehind 和正常地图
    const drawBehindMaps: string[] = []
    const normalMaps: string[] = []
    
    for (const id of allMapIds) {
      const config = this.mapConfigMap.get(id) || {}
      if (config.drawBehind) {
        drawBehindMaps.push(id)
      } else {
        normalMaps.push(id)
      }
    }
    
    let zOffset: number
    if (drawBehind) {
      // drawBehind 地图：在 Z < 0，按在 drawBehindMaps 中的索引分配
      // 第一个 drawBehind 地图在 -0.01，第二个在 -0.02，以此类推
      const drawBehindIndex = drawBehindMaps.indexOf(componentId)
      zOffset = -0.01 - drawBehindIndex * 0.001
    } else {
      // 正常地图：在 Z >= 0，按在 normalMaps 中的索引分配
      // 第一个正常地图在 0.0，第二个在 0.001，以此类推
      const normalIndex = normalMaps.indexOf(componentId)
      zOffset = normalIndex * 0.001
    }

    // 创建或更新 mapProps
    let mapProps = this._mapPropsCache.get(componentId)
    if (!mapProps || mapProps.dataHash !== textureData.dataHash || 
        mapProps.alpha !== alpha || mapProps.colorScheme !== colorScheme || 
        mapProps.zOffset !== zOffset) {
      mapProps = {
        textureData: textureData.textureData,
        width: textureData.width,
        height: textureData.height,
        resolution: textureData.resolution,
        origin: textureData.origin,
        alpha: alpha,
        colorScheme: colorScheme,
        zOffset: zOffset,
        dataHash: textureData.dataHash
      }
      this._mapPropsCache.set(componentId, mapProps)
    } else {
      mapProps.alpha = alpha
      mapProps.colorScheme = colorScheme
      mapProps.zOffset = zOffset
    }

    // 保存地图的渲染 props
    this.mapPropsMap.set(componentId, mapProps)
    
    // 参照 RViz：所有地图共享一次 camera.draw 调用，在回调内部依次渲染所有地图
    // 关键优化：N 个地图只调用 1 次 camera.draw，而不是 N 次，大幅降低 CPU 使用率
    this.updateMapRenderCallback()
  }

  /**
   * 更新统一的地图渲染回调（参照 RViz：所有地图共享一次 camera.draw）
   */
  private updateMapRenderCallback(): void {
    // 移除旧的回调
    if (this.mapRenderCallback) {
      this.worldviewContext.unregisterPaintCallback(this.mapRenderCallback)
      this.mapRenderCallback = null
    }
    
    // 如果没有地图，不需要注册回调
    if (this.mapPropsMap.size === 0) {
      return
    }
    
    // 创建统一的地图渲染回调：所有地图共享一次 camera.draw 调用
    this.mapRenderCallback = () => {
      if (!this.worldviewContext.initializedData) return
      const { camera } = this.worldviewContext.initializedData
      const cameraState = this.worldviewContext.cameraStore.state
      
      // 关键优化：只调用一次 camera.draw，在回调内部依次渲染所有地图
      // 这样 N 个地图只调用 1 次 camera.draw，而不是 N 次，大幅降低 CPU 使用率
      // 参照 RViz：按 Z 偏移排序，确保正确的渲染顺序（从后到前）
      camera.draw(cameraState, () => {
        // 将地图按 Z 偏移排序：Z 值小的先渲染（在后面），Z 值大的后渲染（在前面）
        // 这确保了正确的深度排序，避免渲染不完全的问题
        const sortedMaps = Array.from(this.mapPropsMap.entries())
          .sort((a, b) => {
            const zA = a[1].zOffset || 0
            const zB = b[1].zOffset || 0
            return zA - zB // 升序：Z 值小的在前（先渲染）
          })
        
        // 依次渲染所有地图（按 Z 偏移从后到前）
        // 参照 RViz：确保每个地图都能完整渲染，不会因为深度冲突导致部分区域不显示
        for (const [componentId, mapProps] of sortedMaps) {
          const mapCommand = this.mapCommands.get(componentId)
          if (mapCommand && mapProps) {
            mapCommand([mapProps], false)
          }
        }
      })
    }
    
    // 注册统一的地图渲染回调
    this.worldviewContext.registerPaintCallback(this.mapRenderCallback)
  }
  
  /**
   * 重新计算所有地图的 Z 偏移（当地图配置变化时调用）
   * 确保所有地图都有唯一的深度值，避免深度冲突和渲染不完全
   */
  private recalculateAllMapZOffsets(): void {
    // 重新计算所有地图的 Z 偏移
    // 当 drawBehind 配置变化时，需要重新计算所有地图的 Z 偏移
    for (const componentId of this.mapPropsMap.keys()) {
      const textureData = this.mapTextureDataMap.get(componentId)
      if (textureData) {
        // 重新调用 updateMapDrawCall 来更新 Z 偏移
        this.updateMapDrawCall(componentId)
      }
    }
  }
  
  /**
   * 移除地图的渲染数据
   */
  private removeMapRenderData(componentId: string): void {
    this.mapPropsMap.delete(componentId)
    this.mapCommands.delete(componentId)
    // 更新统一的地图渲染回调
    this.updateMapRenderCallback()
  }

  /**
   * 移除地图数据
   * @param componentId 组件ID
   */
  /**
   * 处理 Costmap 增量更新
   * @param updateMessage costmap_updates 消息
   * @param updatesComponentId updates 订阅的 componentId
   */
  async updateCostmapIncremental(updateMessage: any, updatesComponentId: string): Promise<void> {
    // 找到对应的 costmap componentId
    // 优先从映射表中查找，如果没有则从 updatesComponentId 推导（去掉 _updates 后缀）
    let costmapComponentId = this.costmapUpdatesMap.get(updatesComponentId)
    if (!costmapComponentId) {
      // 尝试从 updatesComponentId 推导：去掉 _updates 后缀
      if (updatesComponentId.endsWith('_updates')) {
        costmapComponentId = updatesComponentId.slice(0, -8) // 去掉 '_updates' (8个字符)
      }
    }
    
    if (!costmapComponentId) {
      // console.warn(`updateCostmapIncremental: No costmap found for updates componentId: ${updatesComponentId}`)
      return
    }
    
    // 如果映射关系不存在，自动注册（用于后续使用）
    if (!this.costmapUpdatesMap.has(updatesComponentId)) {
      this.costmapUpdatesMap.set(updatesComponentId, costmapComponentId)
    }
    
    // 获取完整的 costmap 数据和元信息
    const costmapData = this.mapRawDataMap.get(costmapComponentId)
    const metadata = this.mapMetadataMap.get(costmapComponentId)
    
    if (!costmapData || !metadata) {
      // console.warn(`updateCostmapIncremental: No costmap data found for componentId: ${costmapComponentId}`)
      return
    }
    
    // 验证更新消息
    // console.log('updateCostmapIncremental: updateMessage', updateMessage)
    const { x, y, width, height, data: updateData } = updateMessage
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      // console.warn('updateCostmapIncremental: Invalid update message format - missing coordinates')
      return
    }
    
    // 转换数据为数组（可能是 TypedArray）
    const data = Array.isArray(updateData) 
      ? updateData 
      : (updateData instanceof Int8Array || updateData instanceof Uint8Array)
        ? Array.from(updateData)
        : []
    
    if (!Array.isArray(data) || data.length === 0) {
      // console.warn('updateCostmapIncremental: Invalid update message format - data is not an array')
      return
    }
    
    // 验证更新区域是否在 costmap 范围内
    if (x < 0 || y < 0 || x + width > metadata.width || y + height > metadata.height) {
      // console.warn(`updateCostmapIncremental: Update region out of bounds. x: ${x}, y: ${y}, width: ${width}, height: ${height}, map size: ${metadata.width}x${metadata.height}`)
      return
    }
    
    // 验证数据长度
    const expectedLength = width * height
    if (data.length !== expectedLength) {
      // console.warn(`updateCostmapIncremental: Data length mismatch. Expected: ${expectedLength}, Got: ${data.length}`)
      return
    }
    
    // console.log(`updateCostmapIncremental: Merging ${expectedLength} cells at (${x}, ${y}) into map ${metadata.width}x${metadata.height}`)
    
    // 合并数据：将 updates 数据覆盖到 costmap 数据中
    let hasChanges = false
    let changedCells = 0
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const updateIndex = dy * width + dx
        const costmapIndex = (y + dy) * metadata.width + (x + dx)
        if (costmapIndex >= 0 && costmapIndex < costmapData.length) {
          const oldValue = costmapData[costmapIndex]
          const newValue = data[updateIndex]
          if (oldValue !== newValue) {
            costmapData[costmapIndex] = newValue
            hasChanges = true
            changedCells++
          }
        }
      }
    }
    
    // 如果没有实际变化，跳过更新
    if (!hasChanges) {
      // console.log('updateCostmapIncremental: No data changes detected, skipping update')
      return
    }
    
    // console.log(`updateCostmapIncremental: Changed ${changedCells} cells, updating map texture...`)
    
    // 清除消息哈希，强制 updateMap 重新处理
    this.mapMessageHashMap.delete(costmapComponentId)
    
    // 重新生成完整的消息用于更新
    const updatedMessage = {
      info: {
        width: metadata.width,
        height: metadata.height,
        resolution: metadata.resolution,
        origin: metadata.origin
      },
      data: Array.from(costmapData)
    }
    
    // 清除消息哈希，强制 updateMap 重新处理（即使数据看起来相同）
    this.mapMessageHashMap.delete(costmapComponentId)
    
    // 清除纹理缓存，强制重新创建纹理（因为 dataHash 相同但数据已改变）
    const oldTextureData = this.mapTextureDataMap.get(costmapComponentId)
    if (oldTextureData?.dataHash) {
      clearMapTextureCache(costmapComponentId, oldTextureData.dataHash)
      // console.log('updateCostmapIncremental: Cleared texture cache for dataHash:', oldTextureData.dataHash)
    }
    
    // 使用现有的 updateMap 方法重新处理（会重新生成纹理）
    await this.updateMap(updatedMessage, costmapComponentId)
    
    // 检查纹理数据是否已更新
    const textureData = this.mapTextureDataMap.get(costmapComponentId)
    if (!textureData || !textureData.textureData) {
      // console.warn('updateCostmapIncremental: Texture data not found after updateMap')
      return
    }
    
    // console.log('updateCostmapIncremental: Texture data updated, textureData size:', textureData.textureData.length)
    
    // 强制更新 mapProps，清除缓存的纹理引用，强制重新创建纹理
    const mapProps = this.mapPropsMap.get(costmapComponentId)
    if (mapProps) {
      // 清除缓存的纹理引用，强制 regl 命令重新创建纹理
      if ((mapProps as any)._cachedTexture) {
        delete (mapProps as any)._cachedTexture
        // console.log('updateCostmapIncremental: Cleared _cachedTexture in mapProps')
      }
      // 更新纹理数据引用
      mapProps.textureData = textureData.textureData
      // console.log('updateCostmapIncremental: Updated textureData reference in mapProps')
    } else {
      // 如果没有 mapProps，重新调用 updateMapDrawCall 创建
      // console.log('updateCostmapIncremental: No mapProps found, calling updateMapDrawCall')
      this._mapPropsCache.delete(costmapComponentId)
      this.updateMapDrawCall(costmapComponentId)
    }
    
    // 触发渲染更新
    this.worldviewContext.onDirty()
    
    // console.log('updateCostmapIncremental: Map update completed')
  }

  removeMap(componentId: string): void {
    // 移除渲染数据
    this.removeMapRenderData(componentId)
    
    // 获取数据哈希和纹理数据，用于清理纹理缓存
    const dataHash = this.mapDataHashMap.get(componentId)
    // 清理消息哈希
    this.mapMessageHashMap.delete(componentId)
    const textureData = this.mapTextureDataMap.get(componentId)
    
    // 清理纹理缓存（在清理数据之前）
    if (dataHash && textureData?.dataHash) {
      clearMapTextureCache(componentId, textureData.dataHash)
    } else if (dataHash) {
      clearMapTextureCache(componentId, dataHash)
    } else {
      clearMapTextureCache(componentId)
    }
    
    // 清理所有相关数据
    this.mapTextureDataMap.delete(componentId)
    this.mapConfigMap.delete(componentId)
    this.mapRawMessageMap.delete(componentId)
    this.mapDataHashMap.delete(componentId)
    this.mapMessageHashMap.delete(componentId)
    this.mapRequestIds.delete(componentId)
    this.mapTopicMap.delete(componentId)
    this._mapPropsCache.delete(componentId)
    
    // 清理 costmap 增量更新相关数据
    this.mapRawDataMap.delete(componentId)
    this.mapMetadataMap.delete(componentId)
    // 清理 updates 映射（反向查找）
    for (const [updatesId, costmapId] of this.costmapUpdatesMap.entries()) {
      if (costmapId === componentId) {
        this.costmapUpdatesMap.delete(updatesId)
        break
      }
    }
    
    // 触发渲染更新
    this.worldviewContext.onDirty()
  }

  /**
   * 清除所有地图数据（用于断开连接时）
   */
  clearAllMaps(): void {
    // 清理所有纹理缓存
    clearAllMapTextureCache()
    
    // 清理所有相关数据
    this.mapTextureDataMap.clear()
    this.mapConfigMap.clear()
    this.mapRawMessageMap.clear()
    this.mapDataHashMap.clear()
    this.mapMessageHashMap.clear() // 清理所有消息哈希
    this.mapRequestIds.clear() // 清理所有请求 ID
    this.mapTopicMap.clear() // 清理所有话题映射
    this._mapPropsCache.clear() // 性能优化：清理所有mapProps缓存
    
    // 清理 costmap 增量更新相关数据
    this.mapRawDataMap.clear()
    this.mapMetadataMap.clear()
    this.costmapUpdatesMap.clear()
    
    // 移除统一的地图渲染回调
    if (this.mapRenderCallback) {
      this.worldviewContext.unregisterPaintCallback(this.mapRenderCallback)
      this.mapRenderCallback = null
    }
    this.mapPropsMap.clear()
    this.mapCommands.clear()
    
    // 触发渲染更新
    this.worldviewContext.onDirty()
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
    topic?: string // 添加 topic 选项，用于排序
  }, componentId: string): void {
    if (!componentId) {
      console.warn('updateMapOptions: componentId is required')
      return
    }

    // 更新该地图的配置
    const currentConfig = this.mapConfigMap.get(componentId) || {}
    const oldDrawBehind = currentConfig.drawBehind || false
    const newConfig = {
      ...currentConfig,
      ...options
    }
    const newDrawBehind = newConfig.drawBehind || false
    this.mapConfigMap.set(componentId, newConfig)
    
    // 如果提供了 topic，保存到 mapTopicMap 中，用于排序
    if (options.topic !== undefined) {
      const oldTopic = this.mapTopicMap.get(componentId)
      const newTopic = options.topic
      
      // 如果 topic 改变，清理旧的地图数据和纹理缓存
      // 参照 rviz/webviz：topic 改变时必须清理旧数据，避免显示错误的地图
      if (oldTopic && oldTopic !== newTopic) {
        const textureData = this.mapTextureDataMap.get(componentId)
        
        // 清理纹理缓存（必须传递 dataHash，因为 cacheKey 不包含 componentId）
        if (textureData?.dataHash) {
          clearMapTextureCache(componentId, textureData.dataHash)
        } else {
          const dataHash = this.mapDataHashMap.get(componentId)
          if (dataHash) {
            clearMapTextureCache(componentId, dataHash)
          }
        }
        
        // 清理该 componentId 的所有地图数据
        this.mapTextureDataMap.delete(componentId)
        this.mapRawMessageMap.delete(componentId)
        this.mapDataHashMap.delete(componentId)
        this.mapMessageHashMap.delete(componentId)
        this.mapRequestIds.delete(componentId)
        this._mapPropsCache.delete(componentId)
        this.removeMapRenderData(componentId)
        this.worldviewContext.onDirty()
      }
      
      this.mapTopicMap.set(componentId, newTopic)
    }
    
    // 检查地图数据是否存在
    const hasMapData = this.mapTextureDataMap.has(componentId)
    
    // 如果 drawBehind 配置变化，需要重新计算所有地图的 Z 偏移
    // 因为 Z 偏移是基于所有地图的 drawBehind 状态计算的
    if (oldDrawBehind !== newDrawBehind && hasMapData) {
      // 重新计算所有地图的 Z 偏移
      this.recalculateAllMapZOffsets()
    } else if (hasMapData) {
      // 其他配置变化（alpha、colorScheme），只更新该地图的 draw call
      // 注意：colorScheme 和 alpha 都是通过 uniform 传递的，不需要重新处理数据
      this.updateMapDrawCall(componentId)
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
    topic?: string // 添加 topic 选项，用于排序
  }, componentId: string): void {
    this.updateMapOptions(options, componentId)
  }

  /**
   * 注册 costmap 到 updates 的映射关系
   * @param costmapComponentId costmap 组件的 componentId
   * @param updatesComponentId updates 订阅的 componentId
   */
  registerCostmapUpdatesMapping(costmapComponentId: string, updatesComponentId: string): void {
    this.costmapUpdatesMap.set(updatesComponentId, costmapComponentId)
  }

  /**
   * 更新 LaserScan 数据（使用 Web Worker 处理，支持多实例）
   */
  async updateLaserScan(message: any, componentId: string): Promise<void> {
    if (!componentId) {
      console.warn('updateLaserScan: componentId is required')
      return
    }

    if (!message || !message.ranges || !Array.isArray(message.ranges) || message.ranges.length === 0) {
      this.laserScanDataMap.delete(componentId)
      this.laserScanConfigMap.delete(componentId)
      this.laserScanRequestIds.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      return
    }

    // 生成新的请求 ID
    this.laserScanRequestIdCounter++
    const requestId = this.laserScanRequestIdCounter
    this.laserScanRequestIds.set(componentId, requestId)

    // 获取该 LaserScan 的配置
    const config = this.laserScanConfigMap.get(componentId) || {}

    try {
      const { getDataProcessorWorker } = await import('@/workers/dataProcessorWorker')
      const worker = getDataProcessorWorker()

      const result = await worker.processLaserScan({
        type: 'processLaserScan',
        componentId,
        message,
        config: {
          style: config.style,
          size: config.size,
          alpha: config.alpha,
          colorTransformer: config.colorTransformer,
          useRainbow: config.useRainbow,
          minColor: config.minColor,
          maxColor: config.maxColor,
          autocomputeIntensityBounds: config.autocomputeIntensityBounds,
          minIntensity: config.minIntensity,
          maxIntensity: config.maxIntensity
        }
      })

      // 检查请求是否已被取消
      const currentRequestId = this.laserScanRequestIds.get(componentId)
      if (currentRequestId !== requestId) {
        return
      }

      if (result.error) {
        console.error('Failed to process laser scan:', result.error)
        return
      }

      if (!result.data) {
        console.warn('LaserScan data is null, skipping')
        return
      }

      // 应用 TF 变换（如果有 frame_id）
      let transformedData = result.data
      if (message.header?.frame_id) {
        const frameId = message.header.frame_id
        const fixedFrame = tfManager.getFixedFrame()
        const frameInfo = tfManager.getFrameInfo(frameId, fixedFrame)
        
        if (frameInfo && frameInfo.position && frameInfo.orientation) {
          // 应用 TF 变换到 pose
          transformedData = {
            ...result.data,
            pose: {
              position: {
                x: frameInfo.position.x,
                y: frameInfo.position.y,
                z: frameInfo.position.z
              },
              orientation: {
                x: frameInfo.orientation.x,
                y: frameInfo.orientation.y,
                z: frameInfo.orientation.z,
                w: frameInfo.orientation.w
              }
            }
          }
        } else {
          // 如果没有 TF 信息，使用默认 pose（原点）
          console.warn(`No TF transform found for frame_id: ${frameId}, using default pose`)
        }
      }

      // 确保点的大小足够大（至少 0.05 米，这样在屏幕上可见）
      const minSize = 0.05 // 最小点大小（米）
      const currentSize = transformedData.scale?.x || config.size || 0.01
      const finalSize = Math.max(minSize, currentSize)
      
      if (transformedData.scale && transformedData.scale.x < minSize) {
        transformedData = {
          ...transformedData,
          scale: {
            x: finalSize,
            y: finalSize,
            z: finalSize
          }
        }
        // console.log(`LaserScan ${componentId}: Increased point size from ${currentSize} to ${finalSize}`)
      }

      // 调试日志
      // if (transformedData.points && transformedData.points.length > 0) {
      //   const firstPoint = transformedData.points[0]
      //   const firstColor = transformedData.colors?.[0] || transformedData.color
      //   const scaleValue = transformedData.scale ? { x: transformedData.scale.x, y: transformedData.scale.y, z: transformedData.scale.z } : null
      //   const poseValue = transformedData.pose ? {
      //     position: transformedData.pose.position ? { x: transformedData.pose.position.x, y: transformedData.pose.position.y, z: transformedData.pose.position.z } : null,
      //     orientation: transformedData.pose.orientation ? { x: transformedData.pose.orientation.x, y: transformedData.pose.orientation.y, z: transformedData.pose.orientation.z, w: transformedData.pose.orientation.w } : null
      //   } : null
      //   console.log(`LaserScan ${componentId}: ${transformedData.points.length} points processed`, {
      //     size: config.size || 0.01,
      //     finalSize: finalSize,
      //     alpha: config.alpha || 1.0,
      //     scale: scaleValue,
      //     pose: poseValue,
      //     firstPoint,
      //     firstColor,
      //     hasColors: !!transformedData.colors,
      //     hasColor: !!transformedData.color,
      //     pointsRange: transformedData.points.length > 0 ? {
      //       minX: Math.min(...transformedData.points.map((p: any) => p.x)),
      //       maxX: Math.max(...transformedData.points.map((p: any) => p.x)),
      //       minY: Math.min(...transformedData.points.map((p: any) => p.y)),
      //       maxY: Math.max(...transformedData.points.map((p: any) => p.y)),
      //       minZ: Math.min(...transformedData.points.map((p: any) => p.z)),
      //       maxZ: Math.max(...transformedData.points.map((p: any) => p.z))
      //     } : null
      //   })
      // } else {
      //   console.warn(`LaserScan ${componentId}: No points in processed data`)
      // }

      // 保存处理后的数据
      this.laserScanDataMap.set(componentId, transformedData)

      // 延迟注册绘制调用
      requestAnimationFrame(() => {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      })
    } catch (error: any) {
      const currentRequestId = this.laserScanRequestIds.get(componentId)
      if (currentRequestId !== requestId) {
        return
      }
      if (error?.message !== 'Request cancelled' && error?.message !== 'Processing timeout') {
        console.error('Failed to process laser scan in worker:', error)
      }
    }
  }

  /**
   * 移除 LaserScan 数据
   */
  removeLaserScan(componentId: string): void {
    this.laserScanDataMap.delete(componentId)
    this.laserScanConfigMap.delete(componentId)
    this.laserScanInstances.delete(componentId)
    this.laserScanRequestIds.delete(componentId)
    requestAnimationFrame(() => {
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
    })
  }

  /**
   * 清除所有 LaserScan 数据
   */
  clearAllLaserScans(): void {
    this.laserScanDataMap.clear()
    this.laserScanConfigMap.clear()
    this.laserScanInstances.clear()
    this.laserScanRequestIds.clear()
    this.registerDrawCalls()
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
  }, componentId: string): void {
    if (!componentId) {
      console.warn('updateLaserScanOptions: componentId is required')
      return
    }

    // 更新该 LaserScan 的配置
    const currentConfig = this.laserScanConfigMap.get(componentId) || {}
    this.laserScanConfigMap.set(componentId, {
      ...currentConfig,
      ...options
    })

    // 如果该 LaserScan 已有数据，需要重新处理以应用新配置
    // 这里只更新绘制调用，让外部调用者负责重新获取消息
    if (this.laserScanDataMap.has(componentId)) {
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
  }, componentId: string): void {
    this.updateLaserScanOptions(options, componentId)
  }

  /**
   * 更新 PointCloud2 数据（使用 Web Worker 处理，支持多实例）
   */
  async updatePointCloud2(message: any, componentId: string): Promise<void> {
    if (!componentId) {
      console.warn('updatePointCloud2: componentId is required')
      return
    }

    if (!message || !message.data || !Array.isArray(message.data) || message.data.length === 0) {
      this.pointCloud2DataMap.delete(componentId)
      this.pointCloud2ConfigMap.delete(componentId)
      this.pointCloud2RequestIds.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      return
    }

    // 生成新的请求 ID
    this.pointCloud2RequestIdCounter++
    const requestId = this.pointCloud2RequestIdCounter
    this.pointCloud2RequestIds.set(componentId, requestId)

    // 获取该 PointCloud2 的配置
    const config = this.pointCloud2ConfigMap.get(componentId) || {}

    try {
      const { getDataProcessorWorker } = await import('@/workers/dataProcessorWorker')
      const worker = getDataProcessorWorker()

      const result = await worker.processPointCloud2({
        type: 'processPointCloud2',
        componentId,
        message,
        config: {
          size: config.size,
          alpha: config.alpha,
          colorTransformer: config.colorTransformer,
          useRainbow: config.useRainbow,
          minColor: config.minColor,
          maxColor: config.maxColor
        }
      })

      // 检查请求是否已被取消
      const currentRequestId = this.pointCloud2RequestIds.get(componentId)
      if (currentRequestId !== requestId) {
        return
      }

      if (result.error) {
        console.error('Failed to process point cloud2:', result.error)
        return
      }

      // 保存处理后的数据
      this.pointCloud2DataMap.set(componentId, result.data)

      // 延迟注册绘制调用
      requestAnimationFrame(() => {
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
      })
    } catch (error: any) {
      const currentRequestId = this.pointCloud2RequestIds.get(componentId)
      if (currentRequestId !== requestId) {
        return
      }
      if (error?.message !== 'Request cancelled' && error?.message !== 'Processing timeout') {
        console.error('Failed to process point cloud2 in worker:', error)
      }
    }
  }

  /**
   * 移除 PointCloud2 数据
   */
  removePointCloud2(componentId: string): void {
    this.pointCloud2DataMap.delete(componentId)
    this.pointCloud2ConfigMap.delete(componentId)
    this.pointCloud2Instances.delete(componentId)
    this.pointCloud2RequestIds.delete(componentId)
    requestAnimationFrame(() => {
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
    })
  }

  /**
   * 清除所有 PointCloud2 数据
   */
  clearAllPointCloud2s(): void {
    this.pointCloud2DataMap.clear()
    this.pointCloud2ConfigMap.clear()
    this.pointCloud2Instances.clear()
    this.pointCloud2RequestIds.clear()
    this.registerDrawCalls()
  }

  /**
   * 更新 PointCloud2 配置选项
   */
  updatePointCloud2Options(options: { 
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
  }, componentId: string): void {
    if (!componentId) {
      console.warn('updatePointCloud2Options: componentId is required')
      return
    }

    // 更新该 PointCloud2 的配置
    const currentConfig = this.pointCloud2ConfigMap.get(componentId) || {}
    this.pointCloud2ConfigMap.set(componentId, {
      ...currentConfig,
      ...options
    })

    // 如果该 PointCloud2 已有数据，需要重新处理以应用新配置
    if (this.pointCloud2DataMap.has(componentId)) {
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
    }
  }

  /**
   * 设置 PointCloud2 配置选项（别名方法）
   */
  setPointCloud2Options(options: { 
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
  }, componentId: string): void {
    this.updatePointCloud2Options(options, componentId)
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
   * 设置 TF 可见性
   */
  setTFVisible(visible: boolean): void {
    this.tfVisible = visible
    
    if (visible) {
      // 确保命令已初始化
      if (!this.cylindersCommand) {
        this.cylindersCommand = cylinders(this.reglContext)
      }
      if (!this.arrowsCommand) {
        this.arrowsCommand = makeArrowsCommand()(this.reglContext)
        // 保存 Arrows 命令工厂函数引用，确保 onMount 和 registerDrawCall 使用同一个引用
        this.arrowsCommandFactory = makeArrowsCommand()
      }
      // 更新 TF 数据
      this.updateTFData().catch(err => console.error('Failed to update TF data:', err))
    }
    
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 设置 TF 配置选项
   */
  setTFOptions(options: {
    showNames?: boolean
    showAxes?: boolean
    showArrows?: boolean
    markerScale?: number
    markerAlpha?: number
    frameTimeout?: number
    filterWhitelist?: string
    filterBlacklist?: string
    frames?: Array<{ name: string; enabled: boolean }>
  }): void {
    this.tfConfig = {
      ...this.tfConfig,
      ...options
    }
    
    // 如果设置了 frameTimeout，更新 tfManager
    if (options.frameTimeout !== undefined) {
      tfManager.setFrameTimeout(options.frameTimeout)
    }
    
    // 更新 TF 数据
    if (this.tfVisible) {
      this.updateTFData().catch(err => console.error('Failed to update TF data:', err))
    }
    
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 清除 TF 数据
   */
  clearTFData(): void {
    this.tfData = null
    this.tfDataHash = ''
    this.registerDrawCalls()
    this.worldviewContext.onDirty()
  }

  /**
   * 更新 TF 数据（从 tfManager 获取）
   * 参照 RViz 和 regl-worldview 的主流方案
   * 使用 Web Worker 处理耗时计算，避免阻塞主线程
   */
  private async updateTFData(): Promise<void> {
    const processStartTime = tfDebugger.recordProcessStart()
    
    const showAxes = this.tfConfig.showAxes !== false // 默认显示
    const showArrows = this.tfConfig.showArrows !== false // 默认显示
    const markerScale = this.tfConfig.markerScale !== undefined ? this.tfConfig.markerScale : 2.0
    const markerAlpha = this.tfConfig.markerAlpha !== undefined ? this.tfConfig.markerAlpha : 1.0
    
    // 获取固定帧
    const fixedFrame = tfManager.getFixedFrame()
    
    // 获取所有 frames
    const allFrames = tfManager.getFrames()
    
    tfDebugger.log(`Processing TF data: ${allFrames.length} total frames, fixed frame: ${fixedFrame}`, 'debug')
    
    // 过滤 frames（根据 filterWhitelist 和 filterBlacklist）
    let filteredFrames = allFrames
    if (this.tfConfig.filterWhitelist) {
      const whitelist = this.tfConfig.filterWhitelist.split(',').map(f => f.trim())
      filteredFrames = filteredFrames.filter(f => whitelist.includes(f))
    }
    if (this.tfConfig.filterBlacklist) {
      const blacklist = this.tfConfig.filterBlacklist.split(',').map(f => f.trim())
      filteredFrames = filteredFrames.filter(f => !blacklist.includes(f))
    }
    
    // 如果配置了 frames，进一步过滤
    if (this.tfConfig.frames && this.tfConfig.frames.length > 0) {
      const enabledFrames = this.tfConfig.frames.filter(f => f.enabled).map(f => f.name)
      filteredFrames = filteredFrames.filter(f => enabledFrames.includes(f))
    }
    
    tfDebugger.log(`Filtered to ${filteredFrames.length} frames`, 'debug')
    
    // 生成数据哈希，用于检测是否需要重新处理
    // 注意：这里只检查配置和 frames 列表，不检查 frame 的位置变化
    // 因为 frame 位置变化时，需要重新渲染
    // 为了支持动态渲染，我们移除哈希检查，每次都重新处理
    // Worker 处理很快，不会造成性能问题
    const framesHash = filteredFrames.join(',')
    const configHash = `${showAxes}_${showArrows}_${markerScale}_${markerAlpha}_${framesHash}`
    
    // 只有当配置或 frames 列表变化时才更新哈希
    // 但即使哈希相同，也继续处理（因为 frame 位置可能变化了）
    if (this.tfDataHash !== configHash) {
      this.tfDataHash = configHash
      tfDebugger.log(`TF config hash changed: ${configHash}`, 'debug')
    }
    
    // 收集所有 frame 的 frameInfo（在主线程中计算，因为需要访问 tfManager）
    // 确保数据完全可序列化（只包含基本类型和普通对象）
    const frameInfos = filteredFrames.map(frameName => {
      const frameInfo = tfManager.getFrameInfo(frameName, fixedFrame)
      return {
        frameName: String(frameName),
        parent: frameInfo.parent ? String(frameInfo.parent) : null,
        position: frameInfo.position ? {
          x: Number(frameInfo.position.x),
          y: Number(frameInfo.position.y),
          z: Number(frameInfo.position.z)
        } : null,
        orientation: frameInfo.orientation ? {
          x: Number(frameInfo.orientation.x),
          y: Number(frameInfo.orientation.y),
          z: Number(frameInfo.orientation.z),
          w: Number(frameInfo.orientation.w)
        } : null
      }
    })
    
    // 使用 Web Worker 处理 axes 和 arrows 的生成（耗时计算）
    try {
      const worker = getDataProcessorWorker()
      const workerStartTime = tfDebugger.recordWorkerProcessStart()
      
      // 使用 JSON 序列化/反序列化确保数据完全可克隆
      const serializableRequest: TFProcessRequest = JSON.parse(JSON.stringify({
        type: 'processTF',
        frames: filteredFrames.map(f => String(f)),
        frameInfos,
        config: {
          showAxes: Boolean(showAxes),
          showArrows: Boolean(showArrows),
          markerScale: Number(markerScale),
          markerAlpha: Number(markerAlpha)
        }
      }))
      
      const request: TFProcessRequest = serializableRequest
      
      const result = await worker.processTF(request)
      
      tfDebugger.recordWorkerProcessEnd(workerStartTime)
      
      if (result.error) {
        tfDebugger.log(`TF processing error: ${result.error}`, 'error')
        console.error('TF processing error:', result.error)
        this.tfData = { axes: [], arrows: [] }
        this.registerDrawCalls()
        this.worldviewContext.onDirty()
        tfDebugger.recordProcessEnd(processStartTime)
        return
      }
      
      this.tfData = {
        axes: result.axes,
        arrows: result.arrows
      }
      
      tfDebugger.log(`TF data updated: ${result.axes?.length || 0} axes, ${result.arrows?.length || 0} arrows`, 'debug')
      
      // 更新完成后，重新注册绘制调用并触发渲染
      const renderStartTime = tfDebugger.recordRenderStart()
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      tfDebugger.recordRenderEnd(renderStartTime)
      
      tfDebugger.recordProcessEnd(processStartTime)
    } catch (error) {
      tfDebugger.log(`Failed to process TF data in Worker: ${error}`, 'error')
      console.error('Failed to process TF data in Worker:', error)
      // 回退到空数据
      this.tfData = { axes: [], arrows: [] }
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      tfDebugger.recordProcessEnd(processStartTime)
    }
  }

  /**
   * 销毁场景
   */
  destroy(): void {
    // 先清除所有绘制调用，避免在销毁时触发渲染
    this.unregisterAllDrawCalls()
    // 清除数据，但不触发渲染
    this.pathsData = []
    this.pointCloudDataMap.clear()
    this.pointCloudConfigMap.clear()
    this.pointCloud2DataMap.clear()
    this.pointCloud2ConfigMap.clear()
    this.laserScanDataMap.clear()
    this.laserScanConfigMap.clear()
    this.laserScanRequestIds.clear()
    this.pointCloud2RequestIds.clear()
    this.gridCommand = null
    this.linesCommand = null
    this.cylindersCommand = null
    this.axesData = null
    this.gridData = null
    this.mapTextureDataMap.clear()
    this.mapConfigMap.clear()
    this.mapRawMessageMap.clear()
    this.mapRequestIds.clear() // 清理请求 ID
    // 清理地图渲染回调和命令
    // 移除统一的地图渲染回调
    if (this.mapRenderCallback) {
      this.worldviewContext.unregisterPaintCallback(this.mapRenderCallback)
      this.mapRenderCallback = null
    }
    this.mapPropsMap.clear()
    this.mapCommands.clear()
    
    // 清理 Web Worker（延迟导入避免循环依赖）
    import('@/workers/dataProcessorWorker').then(({ destroyDataProcessorWorker }) => {
      destroyDataProcessorWorker()
    }).catch(() => {
      // Worker 可能未初始化，忽略错误
    })
  }
}
