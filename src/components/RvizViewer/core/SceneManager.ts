/**
 * 场景管理器
 * 基于 regl-worldview 的架构，使用命令系统管理场景对象
 */
import type { Regl, PointCloudData, PathData, RenderOptions } from '../types'
import { grid, defaultAxes, lines, makePointsCommand, cylinders } from '../commands'

export class SceneManager {
  private reglContext: Regl
  private worldviewContext: any // WorldviewContext
  private gridCommand: any = null
  private pointsCommand: any = null
  private linesCommand: any = null
  private cylindersCommand: any = null

  private gridData: any = null
  private axesData: any = null
  private pointCloudData: any = null
  private pathsData: any[] = []

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
  }

  private updateGridData(): void {
    const count = this.options.gridDivisions
    const gridColor = this.options.gridColor

    // Grid 命令需要 count 属性
    this.gridData = {
      count,
      color: gridColor
    }
  }

  private updateAxesData(): void {
    if (this.axesData) return

    // 使用 defaultAxes 数据
    this.axesData = defaultAxes
  }

  // 保存实例引用以便正确管理
  private gridInstance: any = { displayName: 'Grid' }
  private axesInstance: any = { displayName: 'Axes' }
  private pointsInstance: any = { displayName: 'Points' }
  private pathInstances: any[] = []

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
  }

  /**
   * 取消注册所有绘制调用
   */
  private unregisterAllDrawCalls(): void {
    // 清除所有实例的绘制调用
    this.worldviewContext.onUnmount(this.gridInstance)
    this.worldviewContext.onUnmount(this.axesInstance)
    this.worldviewContext.onUnmount(this.pointsInstance)
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
      this.worldviewContext.onDirty()
    }
  }

  /**
   * 清除点云
   */
  clearPointCloud(): void {
    this.pointCloudData = null
    this.worldviewContext.onDirty()
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
  }
}
