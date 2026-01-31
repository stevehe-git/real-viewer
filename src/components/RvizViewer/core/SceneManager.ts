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
import { tfDebugger, renderDebugger } from '@/utils/debug'

export class SceneManager {
  private reglContext: Regl
  private worldviewContext: any // WorldviewContext
  private gridCommand: any = null
  private pointsCommand: any = null
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
  private mapTextureCommandFactory: any = null // 缓存地图纹理命令工厂函数，避免重复创建
  private mapRawMessageMap = new Map<string, any>() // 保存每个地图的原始消息
  private mapDataHashMap = new Map<string, string>() // 地图数据哈希，用于检测数据是否变化
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
  private _pendingMapUpdate: number | null = null // 待处理的地图更新 RAF ID
  private mapRequestIds = new Map<string, number>() // 每个地图的当前请求 ID，用于取消过时的请求
  private mapRequestIdCounter = 0 // 请求 ID 计数器

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
    // 初始化带 useWorldSpaceSize 的 Points 命令（用于 LaserScan 和 PointCloud）
    this.pointsCommandWithWorldSpace = makePointsCommand({ useWorldSpaceSize: true })

    // 初始化 Lines 命令（用于路径）
    this.linesCommand = lines(this.reglContext)
    
    // MapTexture 命令不需要预编译，直接使用工厂函数
    // 它会在 registerDrawCall 时由 WorldviewContext 编译
    // 保存 MapTexture 命令工厂函数引用，确保 onMount 和 registerDrawCall 使用同一个引用
    this.mapTextureCommandFactory = makeMapTextureCommand()

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
  private mapInstances = new Map<string, any>() // 每个地图的实例，key 为 componentId
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

    // 注册所有 PointCloud（批量渲染）
    if (this.pointsCommandWithWorldSpace && this.pointCloudDataMap.size > 0) {
      const allPointClouds: any[] = []
      this.pointCloudDataMap.forEach((pointCloudData) => {
        if (pointCloudData) {
          allPointClouds.push(pointCloudData)
        }
      })
      
      if (allPointClouds.length > 0) {
        const batchPointCloudInstance = { 
          displayName: 'BatchPointClouds',
          _isBatch: true
        }
        this.worldviewContext.onMount(batchPointCloudInstance, this.pointsCommandWithWorldSpace)
        this.worldviewContext.registerDrawCall({
          instance: batchPointCloudInstance,
          reglCommand: this.pointsCommandWithWorldSpace,
          children: allPointClouds,
          layerIndex: 2
        })
      }
    }

    // 注册所有 PointCloud2（批量渲染）
    if (this.pointsCommandWithWorldSpace && this.pointCloud2DataMap.size > 0) {
      const allPointCloud2s: any[] = []
      this.pointCloud2DataMap.forEach((pointCloud2Data) => {
        if (pointCloud2Data) {
          allPointCloud2s.push(pointCloud2Data)
        }
      })
      
      if (allPointCloud2s.length > 0) {
        const batchPointCloud2Instance = { 
          displayName: 'BatchPointCloud2s',
          _isBatch: true
        }
        this.worldviewContext.onMount(batchPointCloud2Instance, this.pointsCommandWithWorldSpace)
        this.worldviewContext.registerDrawCall({
          instance: batchPointCloud2Instance,
          reglCommand: this.pointsCommandWithWorldSpace,
          children: allPointCloud2s,
          layerIndex: 2.5
        })
      }
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

    // 注册所有地图（使用纹理渲染 - 工业级优化）
    // 性能优化：使用纹理渲染替代大量三角形，性能提升 100-1000 倍
    if (this.mapTextureDataMap.size > 0) {
      // 关键修复：按 layerIndex 和 componentId 排序，确保渲染顺序一致
      // 这样可以避免视图角度改变时的显示异常
      const mapsArray = Array.from(this.mapTextureDataMap.entries())
      // 按 layerIndex 排序，相同 layerIndex 的按 componentId 排序（确保顺序稳定）
      mapsArray.sort(([idA], [idB]) => {
        const configA = this.mapConfigMap.get(idA) || {}
        const configB = this.mapConfigMap.get(idB) || {}
        const layerA = configA.drawBehind ? -1 : 4
        const layerB = configB.drawBehind ? -1 : 4
        if (layerA !== layerB) {
          return layerA - layerB
        }
        // 相同 layerIndex 时，按 componentId 排序（确保顺序稳定）
        return idA.localeCompare(idB)
      })
      
      // 关键重构：按顺序渲染地图，确保正确的叠加效果
      // 通过 layerIndex 控制渲染顺序，后渲染的地图会显示在上层
      // 为每个 layerIndex 组单独计算索引，确保 Z 偏移稳定
      const drawBehindMaps: Array<[string, any]> = []
      const normalMaps: Array<[string, any]> = []
      
      mapsArray.forEach(([componentId, textureData]) => {
        const mapConfig = this.mapConfigMap.get(componentId) || {}
        if (mapConfig.drawBehind) {
          drawBehindMaps.push([componentId, textureData])
        } else {
          normalMaps.push([componentId, textureData])
        }
      })
      
      // 先渲染 drawBehind 地图
      drawBehindMaps.forEach(([componentId, textureData], index) => {
        if (textureData && textureData.textureData) {
          const mapConfig = this.mapConfigMap.get(componentId) || {}
          const layerIndex = -1
          
          // 为每个地图创建独立的 draw call（纹理渲染非常高效，不需要批量）
          if (!this.mapInstances.has(componentId)) {
            this.mapInstances.set(componentId, { displayName: `Map-${componentId}` })
          }
          
          const mapInstance = this.mapInstances.get(componentId)!
          
          // 使用缓存的 MapTexture 命令工厂函数，确保复用同一个命令引用
          if (!this.mapTextureCommandFactory) {
            this.mapTextureCommandFactory = makeMapTextureCommand()
          }
          this.worldviewContext.onMount(mapInstance, this.mapTextureCommandFactory)
          
          // 关键修复：总是从 mapConfigMap 读取最新配置，确保配置更新立即生效
          const currentConfig = this.mapConfigMap.get(componentId) || {}
          const colorScheme = currentConfig.colorScheme || 'map'
          const alpha = currentConfig.alpha ?? 1.0
          
          // 关键重构：为每个地图分配 Z 偏移，确保多个地图叠加时正确的渲染顺序
          // drawBehind 地图在 Z < 0（在网格下方，Z = -0.01 - index * 0.001）
          // 网格在 Z = 0.0001，地图在 Z < 0，这样网格会在地图上方可见
          const baseZ = -0.01
          const zOffset = baseZ - index * 0.001
          
          const mapProps = {
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
          
          this.worldviewContext.registerDrawCall({
            instance: mapInstance,
            reglCommand: this.mapTextureCommandFactory,
            children: [mapProps],
            layerIndex
          })
        }
      })
      
      // 再渲染正常地图
      normalMaps.forEach(([componentId, textureData], index) => {
        if (textureData && textureData.textureData) {
          const mapConfig = this.mapConfigMap.get(componentId) || {}
          const layerIndex = 4
          
          // 为每个地图创建独立的 draw call（纹理渲染非常高效，不需要批量）
          if (!this.mapInstances.has(componentId)) {
            this.mapInstances.set(componentId, { displayName: `Map-${componentId}` })
          }
          
          const mapInstance = this.mapInstances.get(componentId)!
          
          // 使用缓存的 MapTexture 命令工厂函数，确保复用同一个命令引用
          if (!this.mapTextureCommandFactory) {
            this.mapTextureCommandFactory = makeMapTextureCommand()
          }
          this.worldviewContext.onMount(mapInstance, this.mapTextureCommandFactory)
          
          // 关键修复：总是从 mapConfigMap 读取最新配置，确保配置更新立即生效
          const currentConfig = this.mapConfigMap.get(componentId) || {}
          const colorScheme = currentConfig.colorScheme || 'map'
          const alpha = currentConfig.alpha ?? 1.0
          
          // 关键重构：为每个地图分配 Z 偏移，确保多个地图叠加时正确的渲染顺序
          // 正常地图在 Z = 0（与网格相同平面），按索引递增（Z = 0 + index * 0.001）
          // 网格在 Z = 0.0001，地图在 Z = 0，这样网格会在地图上方可见
          // 偏移量足够小，视觉上仍然在同一平面，但足以避免多个地图之间的深度冲突
          const baseZ = 0.0
          const zOffset = baseZ + index * 0.001
          
          // 关键修复：创建新的 children 对象，确保 regl 能检测到 props 变化
          // 如果使用相同的对象引用，regl 可能不会重新计算 uniform
          const mapProps = {
            textureData: textureData.textureData,
            width: textureData.width,
            height: textureData.height,
            resolution: textureData.resolution,
            origin: textureData.origin,
            alpha: alpha,
            colorScheme: colorScheme, // 确保传递字符串值
            zOffset: zOffset, // Z 轴偏移，确保正确的渲染顺序
            dataHash: textureData.dataHash
          }
          
          this.worldviewContext.registerDrawCall({
            instance: mapInstance,
            reglCommand: this.mapTextureCommandFactory,
            children: [mapProps],
            layerIndex
          })
        }
      })
    }

    // 注册所有 LaserScan（批量渲染）
    if (this.pointsCommand && this.laserScanDataMap.size > 0) {
      const allLaserScans: any[] = []
      this.laserScanDataMap.forEach((laserScanData) => {
        if (laserScanData) {
          allLaserScans.push(laserScanData)
        }
      })
      
      if (allLaserScans.length > 0) {
        const batchLaserScanInstance = { 
          displayName: 'BatchLaserScans',
          _isBatch: true
        }
        // 使用同一个命令引用（pointsCommandWithWorldSpace）
        this.worldviewContext.onMount(batchLaserScanInstance, this.pointsCommandWithWorldSpace)
        this.worldviewContext.registerDrawCall({
          instance: batchLaserScanInstance,
          reglCommand: this.pointsCommandWithWorldSpace,
          children: allLaserScans,
          layerIndex: 5
        })
        // const totalPoints = allLaserScans.reduce((sum, scan) => sum + (scan.points?.length || 0), 0)
        // console.log(`Registered ${allLaserScans.length} LaserScan(s) for rendering, total points: ${totalPoints}`)
        // allLaserScans.forEach((scan, idx) => {
        //   // 展开 Proxy 对象以查看实际值
        //   const scaleValue = scan.scale ? { x: scan.scale.x, y: scan.scale.y, z: scan.scale.z } : null
        //   const poseValue = scan.pose ? {
        //     position: scan.pose.position ? { x: scan.pose.position.x, y: scan.pose.position.y, z: scan.pose.position.z } : null,
        //     orientation: scan.pose.orientation ? { x: scan.pose.orientation.x, y: scan.pose.orientation.y, z: scan.pose.orientation.z, w: scan.pose.orientation.w } : null
        //   } : null
        //   console.log(`  LaserScan ${idx}:`, {
        //     points: scan.points?.length || 0,
        //     colors: scan.colors?.length || 0,
        //     color: scan.color,
        //     scale: scaleValue,
        //     pose: poseValue,
        //     firstPoint: scan.points?.[0],
        //     firstColor: scan.colors?.[0],
        //     lastPoint: scan.points?.[scan.points.length - 1]
        //   })
        // })
      }
    }

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
  private unregisterDrawCall(componentId: string): void {
    const instance = this.mapInstances.get(componentId)
    if (instance) {
      this.worldviewContext.onUnmount(instance)
    }
  }

  /**
   * 取消注册所有绘制调用
   */
  private unregisterAllDrawCalls(): void {
    // 清除所有实例的绘制调用
    this.worldviewContext.onUnmount(this.gridInstance)
    this.worldviewContext.onUnmount(this.axesInstance)
    this.worldviewContext.onUnmount(this.pointsInstance)
    
    // 清除地图实例（包括批量渲染实例）
    this.mapInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    // 清除批量渲染实例（如果有）
    // 批量实例的 displayName 以 "Batch" 开头
    const allDrawCalls = Array.from(this.worldviewContext._drawCalls?.values() || [])
    allDrawCalls.forEach((drawCall: any) => {
      if (drawCall?.instance?._isBatch || 
          drawCall?.instance?.displayName?.startsWith('BatchMaps-') ||
          drawCall?.instance?.displayName?.startsWith('BatchLaserScans') ||
          drawCall?.instance?.displayName?.startsWith('BatchPointClouds') ||
          drawCall?.instance?.displayName?.startsWith('BatchPointCloud2s')) {
        this.worldviewContext.onUnmount(drawCall.instance)
      }
    })
    
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
   * 更新地图数据（从 ROS OccupancyGrid 消息）
   * 使用 Web Worker 进行后台处理，避免阻塞主线程
   * 始终只渲染最新的一帧数据，自动取消过时的请求
   */
  async updateMap(message: any, componentId: string): Promise<void> {
    if (!componentId) {
      console.warn('updateMap: componentId is required')
      return
    }

    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      this.mapTextureDataMap.delete(componentId)
      this.mapRawMessageMap.delete(componentId)
      this.mapDataHashMap.delete(componentId)
      this.mapRequestIds.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      return
    }

    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05

    if (width === 0 || height === 0 || resolution === 0) {
      this.mapTextureDataMap.delete(componentId)
      this.mapRawMessageMap.delete(componentId)
      this.mapDataHashMap.delete(componentId)
      this.mapRequestIds.delete(componentId)
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
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
        // 确保 data 是可序列化的数组（转换为普通数组）
        data: Array.isArray(message.data) 
          ? Array.from(message.data) 
          : (message.data instanceof Uint8Array || message.data instanceof Int8Array)
            ? Array.from(message.data)
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

      // 性能优化：检查数据是否真的变化了
      // 生成数据哈希（使用消息的宽度、高度、分辨率等关键信息）
      const dataHash = `${width}_${height}_${resolution}_${message.info?.origin?.position?.x || 0}_${message.info?.origin?.position?.y || 0}`
      const lastHash = this.mapDataHashMap.get(componentId)
      
      // 如果数据没有变化，跳过更新（避免不必要的重新渲染）
      if (lastHash === dataHash && this.mapTextureDataMap.has(componentId)) {
        // 数据未变化，取消请求但不清除现有数据
        return
      }
      
      // 保存处理后的纹理数据
      if (result.textureData) {
        this.mapTextureDataMap.set(componentId, {
          textureData: result.textureData,
          width: result.width,
          height: result.height,
          resolution: result.resolution,
          origin: result.origin,
          dataHash: result.dataHash || dataHash
        })
      }
      this.mapDataHashMap.set(componentId, dataHash)
      
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
      
      // 批量更新：延迟注册绘制调用，避免频繁渲染
      // 使用 requestAnimationFrame 确保在下一帧才更新
      // 关键修复：数据更新时，registerDrawCalls 会从 mapConfigMap 读取最新配置
      // 这样即使配置在数据更新之后才更新，也能正确应用
      if (!this._pendingMapUpdate) {
        this._pendingMapUpdate = requestAnimationFrame(() => {
          // 确保使用最新的配置重新注册绘制调用
          // registerDrawCalls 会从 mapConfigMap 读取最新配置
          this.registerDrawCalls()
          this.worldviewContext.onDirty()
          this._pendingMapUpdate = null
        })
      }
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
   * 移除地图数据
   * @param componentId 组件ID
   */
  removeMap(componentId: string): void {
    // 立即注销 draw call，确保渲染不再包含该地图
    this.unregisterDrawCall(componentId)
    
    // 获取数据哈希和纹理数据，用于清理纹理缓存
    const dataHash = this.mapDataHashMap.get(componentId)
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
    this.mapInstances.delete(componentId)
    this.mapRequestIds.delete(componentId) // 清理请求 ID
    
    // 立即重新注册绘制调用，确保移除立即生效
    this.registerDrawCalls()
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
    this.mapInstances.clear()
    this.mapRequestIds.clear() // 清理所有请求 ID
    
    // 注销所有地图的 draw call
    this.mapInstances.forEach((instance) => {
      this.worldviewContext.onUnmount(instance)
    })
    
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
    const newConfig = {
      ...currentConfig,
      ...options
    }
    this.mapConfigMap.set(componentId, newConfig)
    
    
    // 检查地图数据是否存在
    const hasMapData = this.mapTextureDataMap.has(componentId)
    
    // 如果该地图已有处理后的数据，直接重新注册绘制调用以应用新配置
    // 注意：colorScheme 是在 GPU 着色器中计算的，不需要重新处理数据，只需要重新注册绘制调用
    // alpha 也是通过 uniform 传递的，不需要重新处理数据
    if (hasMapData) {
      // 对于纹理渲染方式，colorScheme 和 alpha 都是通过 uniform 传递的
      // 只需要重新注册绘制调用，新的配置会自动应用到着色器中
      // 强制清除旧的绘制调用，确保新的配置被应用
      this.unregisterAllDrawCalls()
      this.registerDrawCalls()
      this.worldviewContext.onDirty()
      
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
    this.pointsCommand = null
    this.linesCommand = null
    this.cylindersCommand = null
    this.axesData = null
    this.gridData = null
    this.mapTextureDataMap.clear()
    this.mapConfigMap.clear()
    this.mapRawMessageMap.clear()
    this.mapInstances.clear()
    this.mapRequestIds.clear() // 清理请求 ID
    
    // 清理 Web Worker（延迟导入避免循环依赖）
    import('@/workers/dataProcessorWorker').then(({ destroyDataProcessorWorker }) => {
      destroyDataProcessorWorker()
    }).catch(() => {
      // Worker 可能未初始化，忽略错误
    })
  }
}
