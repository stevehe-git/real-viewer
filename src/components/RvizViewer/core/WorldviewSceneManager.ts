/**
 * 基于 regl-worldview 命令系统的场景管理器
 * 使用 regl-worldview 的优化渲染逻辑
 */
import type regl from 'regl'
import { createGridCommand, createAxesCommand, createPointsCommand, createLinesCommand } from '../adapters/WorldviewAdapter'
import type { PointCloudData, PathData, RenderOptions } from '../types'

export class WorldviewSceneManager {
  private reglContext: regl.Regl
  private gridCommand: regl.DrawCommand | null = null
  private axesCommand: regl.DrawCommand | null = null
  private pointsCommand: regl.DrawCommand | null = null
  private linesCommand: regl.DrawCommand | null = null
  
  private gridData: any = null
  private axesData: any = null // 缓存坐标轴数据
  private pointCloudData: any = null
  private pathsData: any[] = []
  
  private options: Required<Omit<RenderOptions, 'gridColor'>> & { gridColor: [number, number, number, number] }

  constructor(reglContext: regl.Regl, options?: RenderOptions) {
    this.reglContext = reglContext
    this.options = {
      clearColor: options?.clearColor || [0.2, 0.2, 0.2, 1.0],
      enableGrid: options?.enableGrid ?? true,
      enableAxes: options?.enableAxes ?? true,
      gridSize: options?.gridSize || 10,
      gridDivisions: options?.gridDivisions ?? 5, // 默认5个格子（从-5到5，共10个格子）
      gridColor: options?.gridColor || [0.67, 0.67, 0.67, 1.0] // 浅灰色网格
    }

    // 初始化命令（使用 regl-worldview 的优化命令）
    if (this.options.enableGrid) {
      this.gridCommand = createGridCommand(reglContext)
      this.updateGridData()
    }

    if (this.options.enableAxes) {
      this.axesCommand = createAxesCommand(reglContext)
      this.updateAxesData()
    }

    this.pointsCommand = createPointsCommand(reglContext)
    this.linesCommand = createLinesCommand(reglContext)
  }

  private updateGridData(): void {
    const count = this.options.gridDivisions
    const points: number[] = []
    const colors: number[] = []
    const gridColor = this.options.gridColor
    
    for (let i = -count; i <= count; i++) {
      // 垂直线
      points.push(-count, i, 0)
      points.push(count, i, 0)
      colors.push(...gridColor, ...gridColor)
      
      // 水平线
      points.push(i, -count, 0)
      points.push(i, count, 0)
      colors.push(...gridColor, ...gridColor)
    }

    this.gridData = {
      points: this.reglContext.buffer(points),
      colors: this.reglContext.buffer(colors),
      count: points.length / 3
    }
  }

  private updateAxesData(): void {
    // 坐标轴数据是固定的，只需要创建一次
    if (this.axesData) return

    const length = 1
    const positions = [
      0, 0, 0, length, 0, 0,  // X轴 - 红色
      0, 0, 0, 0, length, 0,  // Y轴 - 绿色
      0, 0, 0, 0, 0, length   // Z轴 - 蓝色
    ]

    const colors = [
      1, 0, 0, 1, 1, 0, 0, 1,  // X轴 - 红色
      0, 1, 0, 1, 0, 1, 0, 1,  // Y轴 - 绿色
      0, 0, 1, 1, 0, 0, 1, 1   // Z轴 - 蓝色
    ]

    this.axesData = {
      points: this.reglContext.buffer(positions),
      colors: this.reglContext.buffer(colors),
      count: 6
    }
  }

  /**
   * 渲染整个场景（使用 regl-worldview 的优化渲染）
   */
  render(projection: regl.Mat4, view: regl.Mat4, _viewport: { width: number; height: number }): void {
    // 渲染网格（使用 regl-worldview 的 Grid 命令）
    if (this.gridCommand && this.gridData) {
      this.gridCommand({
        projection,
        view,
        points: this.gridData.points,
        colors: this.gridData.colors,
        count: this.gridData.count
      })
    }

    // 渲染坐标轴（使用 regl-worldview 的 Axes 命令）
    if (this.axesCommand && this.axesData) {
      this.axesCommand({
        projection,
        view,
        points: this.axesData.points,
        colors: this.axesData.colors,
        count: this.axesData.count
      })
    }

    // 渲染点云（使用 regl-worldview 的 Points 命令）
    if (this.pointsCommand && this.pointCloudData) {
      this.pointsCommand({
        projection,
        view,
        points: this.pointCloudData.points,
        colors: this.pointCloudData.colors,
        pointSize: this.pointCloudData.pointSize || 3.0,
        count: this.pointCloudData.count
      })
    }

    // 渲染路径（使用 regl-worldview 的 Lines 命令）
    this.pathsData.forEach(pathData => {
      if (this.linesCommand && pathData) {
        this.linesCommand({
          projection,
          view,
          points: pathData.points,
          colors: pathData.colors,
          count: pathData.count
        })
      }
    })
  }

  /**
   * 更新点云数据
   */
  updatePointCloud(data: PointCloudData): void {
    if (!data || !data.points || data.points.length === 0) {
      this.pointCloudData = null
      return
    }

    const positions: number[] = []
    const colors: number[] = []
    const defaultColor = { r: 1, g: 1, b: 1, a: 1 }
    const pointSize = data.pointSize || 3.0

    data.points.forEach((point, index) => {
      positions.push(point.x, point.y, point.z)
      const color = data.colors?.[index] || defaultColor
      colors.push(color.r, color.g, color.b, color.a || 1.0)
    })

    this.pointCloudData = {
      points: this.reglContext.buffer(positions),
      colors: this.reglContext.buffer(colors),
      pointSize,
      count: data.points.length
    }
  }

  /**
   * 添加路径
   */
  addPath(data: PathData): number {
    if (!data || !data.waypoints || data.waypoints.length < 2) {
      return -1
    }

    const positions: number[] = []
    const colors: number[] = []
    const defaultColor = data.color || { r: 0, g: 1, b: 0, a: 1 }

    data.waypoints.forEach(point => {
      positions.push(point.x, point.y, point.z)
      colors.push(defaultColor.r, defaultColor.g, defaultColor.b, defaultColor.a || 1.0)
    })

    this.pathsData.push({
      points: this.reglContext.buffer(positions),
      colors: this.reglContext.buffer(colors),
      count: data.waypoints.length
    })

    return this.pathsData.length - 1
  }

  /**
   * 清除所有路径
   */
  clearPaths(): void {
    this.pathsData = []
  }

  /**
   * 清除点云
   */
  clearPointCloud(): void {
    this.pointCloudData = null
  }

  /**
   * 设置网格可见性
   */
  setGridVisible(visible: boolean): void {
    this.options.enableGrid = visible
    if (visible && !this.gridCommand) {
      this.gridCommand = createGridCommand(this.reglContext)
      this.updateGridData()
    }
  }

  /**
   * 设置坐标轴可见性
   */
  setAxesVisible(visible: boolean): void {
    this.options.enableAxes = visible
    if (visible && !this.axesCommand) {
      this.axesCommand = createAxesCommand(this.reglContext)
      this.updateAxesData()
    }
  }

  /**
   * 销毁场景
   */
  destroy(): void {
    this.clearPaths()
    this.clearPointCloud()
    this.gridCommand = null
    this.axesCommand = null
    this.axesData = null // 清理坐标轴数据
    this.pointsCommand = null
    this.linesCommand = null
  }
}
