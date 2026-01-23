/**
 * 场景管理器
 * 负责管理所有可视化组件的生命周期和渲染
 */
import type regl from 'regl'
import { Grid } from './visualizations/Grid'
import { Axes } from './visualizations/Axes'
import { PointCloud, type PointCloudData } from './visualizations/PointCloud'
import { Path, type PathData } from './visualizations/Path'
import type { RenderOptions } from './types'

export class SceneManager {
  private grid: Grid | null = null
  private axes: Axes | null = null
  private pointCloud: PointCloud
  private paths: Path[] = []
  private options: Required<Omit<RenderOptions, 'gridColor'>>
  private reglContext: regl.Regl

  constructor(reglContext: regl.Regl, options?: RenderOptions) {
    this.reglContext = reglContext
    this.options = {
      clearColor: options?.clearColor || [0.2, 0.2, 0.2, 1.0], // rviz 深灰色背景
      enableGrid: options?.enableGrid ?? true,
      enableAxes: options?.enableAxes ?? true,
      gridSize: options?.gridSize || 10,
      gridDivisions: options?.gridDivisions || 10
    }

    // 初始化可视化组件
    if (this.options.enableGrid) {
      this.grid = new Grid(reglContext, this.options.gridSize, this.options.gridDivisions)
    }

    if (this.options.enableAxes) {
      this.axes = new Axes(reglContext, 1)
    }

    this.pointCloud = new PointCloud(reglContext)
  }

  /**
   * 渲染整个场景
   */
  render(projection: regl.Mat4, view: regl.Mat4): void {
    const identityMatrix: regl.Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

    // 渲染网格
    if (this.grid) {
      this.grid.render(projection, view, identityMatrix)
    }

    // 渲染坐标轴
    if (this.axes) {
      this.axes.render(projection, view, identityMatrix)
    }

    // 渲染点云
    this.pointCloud.render(projection, view, identityMatrix)

    // 渲染所有路径
    this.paths.forEach(path => {
      path.render(projection, view, identityMatrix)
    })
  }

  /**
   * 更新点云数据
   */
  updatePointCloud(data: PointCloudData): void {
    this.pointCloud.updateData(data)
  }

  /**
   * 添加路径
   */
  addPath(data: PathData): number {
    const path = new Path(this.reglContext)
    path.updateData(data)
    this.paths.push(path)
    return this.paths.length - 1
  }

  /**
   * 更新路径
   */
  updatePath(index: number, data: PathData): void {
    const path = this.paths[index]
    if (path && index >= 0 && index < this.paths.length) {
      path.updateData(data)
    }
  }

  /**
   * 移除路径
   */
  removePath(index: number): void {
    if (index >= 0 && index < this.paths.length) {
      this.paths.splice(index, 1)
    }
  }

  /**
   * 清除所有路径
   */
  clearPaths(): void {
    this.paths = []
  }

  /**
   * 清除点云
   */
  clearPointCloud(): void {
    this.pointCloud.clear()
  }

  /**
   * 设置网格可见性
   */
  setGridVisible(visible: boolean): void {
    this.options.enableGrid = visible
    // 注意：实际应用中可能需要重新创建组件
  }

  /**
   * 设置坐标轴可见性
   */
  setAxesVisible(visible: boolean): void {
    this.options.enableAxes = visible
    // 注意：实际应用中可能需要重新创建组件
  }

  /**
   * 销毁场景
   */
  destroy(): void {
    this.clearPaths()
    this.clearPointCloud()
    this.grid = null
    this.axes = null
  }
}
