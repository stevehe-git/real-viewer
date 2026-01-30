/**
 * 高性能点云Buffer管理器
 * 实现一次性GPU上传，后续只更新轻量参数
 * 参照 regl-worldview 和 Foxglove 的主流方案
 */
import type { Regl } from '../types'

/**
 * 二进制紧凑格式的点云数据
 * 使用 Float32Array 最小化内存占用
 * 格式：[x1, y1, z1, r1, g1, b1, a1, x2, y2, z2, r2, g2, b2, a2, ...]
 * 每个点占用 7 个 float（28字节）
 */
export interface CompactPointCloudData {
  /** 二进制数据：交错存储位置(xyz)和颜色(rgba)，每个点7个float */
  data: Float32Array
  /** 点的数量 */
  count: number
  /** 点大小（世界空间单位） */
  pointSize: number
  /** 数据哈希，用于检测数据是否变化 */
  dataHash: string
}

/**
 * 点云实例配置（轻量参数，可频繁更新）
 */
export interface PointCloudInstanceConfig {
  /** 组件ID */
  componentId: string
  /** 位置变换 */
  pose: {
    position: { x: number; y: number; z: number }
    orientation: { x: number; y: number; z: number; w: number }
  }
  /** 点大小覆盖（可选） */
  pointSize?: number
  /** 颜色变换器类型 */
  colorTransformer?: string
  /** 是否使用彩虹色 */
  useRainbow?: boolean
  /** 最小颜色（用于颜色映射） */
  minColor?: { r: number; g: number; b: number }
  /** 最大颜色（用于颜色映射） */
  maxColor?: { r: number; g: number; b: number }
  /** 颜色映射的最小值 */
  minValue?: number
  /** 颜色映射的最大值 */
  maxValue?: number
}

/**
 * GPU Buffer缓存项
 */
interface BufferCacheItem {
  /** 位置buffer（xyz） */
  positionBuffer: any
  /** 颜色buffer（rgba） */
  colorBuffer: any
  /** 点数量 */
  count: number
  /** 数据哈希 */
  dataHash: string
  /** 最后使用时间（用于LRU清理） */
  lastUsed: number
}

/**
 * 点云Buffer管理器
 * 负责管理所有点云的GPU buffer，实现一次性上传和复用
 */
export class PointCloudBufferManager {
  private regl: Regl
  /** Buffer缓存：key为dataHash */
  private bufferCache = new Map<string, BufferCacheItem>()
  /** 点云实例配置：key为componentId */
  private instanceConfigs = new Map<string, PointCloudInstanceConfig>()
  /** 点云数据：key为componentId */
  private pointCloudDataMap = new Map<string, CompactPointCloudData>()
  /** 最大缓存数量 */
  private maxCacheSize = 50
  /** 当前帧时间戳 */
  private currentFrameTime = 0

  constructor(regl: Regl) {
    this.regl = regl
    this.currentFrameTime = performance.now()
  }

  /**
   * 更新点云数据（一次性上传到GPU）
   * @param componentId 组件ID
   * @param data 点云数据
   */
  updatePointCloudData(componentId: string, data: CompactPointCloudData): void {
    this.currentFrameTime = performance.now()
    
    // 检查数据是否变化
    const existingData = this.pointCloudDataMap.get(componentId)
    if (existingData && existingData.dataHash === data.dataHash) {
      // 数据未变化，只更新引用
      this.pointCloudDataMap.set(componentId, data)
      return
    }

    // 数据变化，需要更新buffer
    this.pointCloudDataMap.set(componentId, data)

    // 检查buffer缓存
    let bufferItem = this.bufferCache.get(data.dataHash)
    
    if (!bufferItem) {
      // 缓存未命中，创建新buffer
      bufferItem = this.createBuffers(data)
      this.bufferCache.set(data.dataHash, bufferItem)
      
      // LRU清理：如果缓存超过最大大小，删除最久未使用的
      if (this.bufferCache.size > this.maxCacheSize) {
        this.evictOldestBuffer()
      }
    } else {
      // 更新最后使用时间
      bufferItem.lastUsed = this.currentFrameTime
    }
  }

  /**
   * 创建GPU buffer（一次性上传）
   */
  private createBuffers(data: CompactPointCloudData): BufferCacheItem {
    const { data: floatData, count } = data
    
    // 分离位置和颜色数据
    const positionData = new Float32Array(count * 3)
    const colorData = new Float32Array(count * 4)
    
    // 从交错格式提取数据
    for (let i = 0; i < count; i++) {
      const srcOffset = i * 7
      const posOffset = i * 3
      const colorOffset = i * 4
      
      // 位置：xyz
      positionData[posOffset + 0] = floatData[srcOffset + 0] ?? 0
      positionData[posOffset + 1] = floatData[srcOffset + 1] ?? 0
      positionData[posOffset + 2] = floatData[srcOffset + 2] ?? 0
      
      // 颜色：rgba
      colorData[colorOffset + 0] = floatData[srcOffset + 3] ?? 1
      colorData[colorOffset + 1] = floatData[srcOffset + 4] ?? 1
      colorData[colorOffset + 2] = floatData[srcOffset + 5] ?? 1
      colorData[colorOffset + 3] = floatData[srcOffset + 6] ?? 1
    }

    // 创建regl buffer（一次性上传，使用static usage）
    const positionBuffer = this.regl.buffer({
      type: 'float',
      usage: 'static', // 静态使用，数据不会频繁更新
      data: positionData
    })

    const colorBuffer = this.regl.buffer({
      type: 'float',
      usage: 'static', // 静态使用，数据不会频繁更新
      data: colorData
    })

    return {
      positionBuffer,
      colorBuffer,
      count,
      dataHash: data.dataHash,
      lastUsed: this.currentFrameTime
    }
  }

  /**
   * LRU清理：删除最久未使用的buffer
   */
  private evictOldestBuffer(): void {
    let oldestHash: string | null = null
    let oldestTime = Infinity

    for (const [hash, item] of this.bufferCache.entries()) {
      if (item.lastUsed < oldestTime) {
        oldestTime = item.lastUsed
        oldestHash = hash
      }
    }

    if (oldestHash) {
      const item = this.bufferCache.get(oldestHash)
      if (item) {
        // 销毁buffer释放GPU内存
        item.positionBuffer.destroy?.()
        item.colorBuffer.destroy?.()
        this.bufferCache.delete(oldestHash)
      }
    }
  }

  /**
   * 更新点云实例配置（轻量参数，不重传数据）
   */
  updateInstanceConfig(componentId: string, config: PointCloudInstanceConfig): void {
    this.instanceConfigs.set(componentId, config)
  }

  /**
   * 获取点云实例的buffer
   */
  getBuffers(componentId: string): { positionBuffer: any; colorBuffer: any; count: number } | null {
    const data = this.pointCloudDataMap.get(componentId)
    if (!data) {
      return null
    }

    const bufferItem = this.bufferCache.get(data.dataHash)
    if (!bufferItem) {
      return null
    }

    // 更新最后使用时间
    bufferItem.lastUsed = this.currentFrameTime

    return {
      positionBuffer: bufferItem.positionBuffer,
      colorBuffer: bufferItem.colorBuffer,
      count: bufferItem.count
    }
  }

  /**
   * 获取点云实例配置
   */
  getInstanceConfig(componentId: string): PointCloudInstanceConfig | null {
    return this.instanceConfigs.get(componentId) || null
  }

  /**
   * 获取点云数据
   */
  getPointCloudData(componentId: string): CompactPointCloudData | null {
    return this.pointCloudDataMap.get(componentId) || null
  }

  /**
   * 获取所有点云实例的合并数据（用于单次draw call）
   */
  getAllInstances(): Array<{
    componentId: string
    buffers: { positionBuffer: any; colorBuffer: any; count: number }
    config: PointCloudInstanceConfig
    data: CompactPointCloudData
  }> {
    const instances: Array<{
      componentId: string
      buffers: { positionBuffer: any; colorBuffer: any; count: number }
      config: PointCloudInstanceConfig
      data: CompactPointCloudData
    }> = []

    for (const [componentId, data] of this.pointCloudDataMap.entries()) {
      const buffers = this.getBuffers(componentId)
      const config = this.getInstanceConfig(componentId)
      
      if (buffers && config) {
        instances.push({
          componentId,
          buffers,
          config,
          data
        })
      }
    }

    return instances
  }

  /**
   * 移除点云实例
   */
  removeInstance(componentId: string): void {
    this.pointCloudDataMap.delete(componentId)
    this.instanceConfigs.delete(componentId)
  }

  /**
   * 清除所有实例
   */
  clearAll(): void {
    this.pointCloudDataMap.clear()
    this.instanceConfigs.clear()
  }

  /**
   * 销毁所有buffer（释放GPU内存）
   */
  destroy(): void {
    for (const item of this.bufferCache.values()) {
      item.positionBuffer.destroy?.()
      item.colorBuffer.destroy?.()
    }
    this.bufferCache.clear()
    this.pointCloudDataMap.clear()
    this.instanceConfigs.clear()
  }
}

/**
 * 生成数据哈希（用于检测数据是否变化）
 */
export function generateDataHash(data: Float32Array, count: number): string {
  // 使用简单的哈希算法：基于数据的前几个字节和总数
  // 对于大数据，只检查前100个点和后100个点
  const sampleSize = Math.min(100, count)
  let hash = count.toString()
  
  // 前100个点
  for (let i = 0; i < sampleSize * 7 && i < data.length; i += 7) {
    hash += `_${data[i]}_${data[i + 1]}_${data[i + 2]}`
  }
  
  // 后100个点
  if (count > sampleSize) {
    const start = (count - sampleSize) * 7
    for (let i = start; i < data.length && i < start + sampleSize * 7; i += 7) {
      hash += `_${data[i]}_${data[i + 1]}_${data[i + 2]}`
    }
  }
  
  return hash
}

/**
 * 将点云数据转换为紧凑格式
 */
export function convertToCompactFormat(
  points: Array<{ x: number; y: number; z: number }>,
  colors?: Array<{ r: number; g: number; b: number; a?: number }>,
  defaultColor: { r: number; g: number; b: number; a: number } = { r: 1, g: 1, b: 1, a: 1 },
  pointSize: number = 1.0
): CompactPointCloudData {
  const count = points.length
  const data = new Float32Array(count * 7) // 每个点7个float：xyz + rgba

  for (let i = 0; i < count; i++) {
    const point = points[i]
    if (!point) continue
    
    const color = colors?.[i] || defaultColor
    const offset = i * 7

    // 位置：xyz
    data[offset + 0] = point.x ?? 0
    data[offset + 1] = point.y ?? 0
    data[offset + 2] = point.z ?? 0

    // 颜色：rgba
    data[offset + 3] = color.r ?? 1
    data[offset + 4] = color.g ?? 1
    data[offset + 5] = color.b ?? 1
    data[offset + 6] = color.a ?? 1.0
  }

  const dataHash = generateDataHash(data, count)

  return {
    data,
    count,
    pointSize,
    dataHash
  }
}
