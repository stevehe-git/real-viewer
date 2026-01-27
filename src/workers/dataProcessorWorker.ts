/**
 * 数据处理器 Worker 管理器
 * 管理 Web Worker 的创建、消息发送和结果接收
 */
import type { 
  MapProcessRequest, 
  MapProcessResult, 
  PointCloudProcessRequest, 
  PointCloudProcessResult,
  ImageProcessRequest,
  ImageProcessResult,
  PathProcessRequest,
  PathProcessResult
} from './dataProcessor.worker'

export class DataProcessorWorker {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, {
    resolve: (result: any) => void
    reject: (error: Error) => void
    timeout: number
  }>()
  private requestIdCounter = 0

  constructor() {
    this.initWorker()
  }

  private initWorker(): void {
    try {
      // 创建 Worker（使用 Vite 的 worker 导入方式）
      // Vite 会自动处理 worker 的打包和加载
      this.worker = new Worker(
        new URL('./dataProcessor.worker.ts', import.meta.url),
        { 
          type: 'module',
          name: 'dataProcessor'
        }
      )

      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data)
      }

      this.worker.onerror = (error) => {
        console.error('DataProcessorWorker error:', error)
        // 处理所有待处理的请求
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('Worker error'))
        })
        this.pendingRequests.clear()
      }
    } catch (error) {
      console.warn('Failed to create DataProcessorWorker, falling back to main thread:', error)
      this.worker = null
    }
  }

  private handleMessage(data: MapProcessResult | PointCloudProcessResult | ImageProcessResult | PathProcessResult): void {
    if (data.type === 'mapProcessed') {
      const result = data as MapProcessResult
      const requestId = result.componentId // 使用 componentId 作为请求ID
      const pending = this.pendingRequests.get(requestId)
      
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(requestId)
        
        if (result.error) {
          pending.reject(new Error(result.error))
        } else {
          pending.resolve(result)
        }
      }
    } else {
      // 对于其他类型（pointCloudProcessed, imageProcessed, pathProcessed），使用 FIFO 方式匹配
      // 这是简化实现，实际应该使用 requestId
      const firstPending = this.pendingRequests.entries().next().value
      if (firstPending) {
        const [requestId, pending] = firstPending
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(requestId)
        
        if ((data as any).error) {
          pending.reject(new Error((data as any).error))
        } else {
          pending.resolve(data)
        }
      }
    }
  }

  /**
   * 处理地图数据（异步）
   */
  async processMap(request: MapProcessRequest): Promise<MapProcessResult> {
    // 如果没有 Worker，回退到主线程处理
    if (!this.worker) {
      return this.processMapSync(request)
    }

    return this.sendRequest(request.componentId, request, 10000)
  }

  /**
   * 处理点云数据（异步）
   */
  async processPointCloud(request: PointCloudProcessRequest): Promise<PointCloudProcessResult> {
    if (!this.worker) {
      return this.processPointCloudSync(request)
    }

    const requestId = `pointcloud_${this.requestIdCounter++}`
    return this.sendRequest(requestId, request, 10000)
  }

  /**
   * 处理图像数据（异步）
   */
  async processImage(request: ImageProcessRequest): Promise<ImageProcessResult> {
    if (!this.worker) {
      return this.processImageSync(request)
    }

    const requestId = `image_${this.requestIdCounter++}`
    return this.sendRequest(requestId, request, 10000)
  }

  /**
   * 处理路径数据（异步）
   */
  async processPath(request: PathProcessRequest): Promise<PathProcessResult> {
    if (!this.worker) {
      return this.processPathSync(request)
    }

    const requestId = `path_${this.requestIdCounter++}`
    return this.sendRequest(requestId, request, 5000)
  }

  /**
   * 发送请求到 Worker（通用方法）
   */
  private sendRequest(requestId: string, request: any, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      // 如果已有相同 requestId 的请求，静默取消之前的（不记录错误）
      // 这是优化：只处理最新的数据，避免处理过时的数据
      const existing = this.pendingRequests.get(requestId)
      if (existing) {
        clearTimeout(existing.timeout)
        // 静默取消，不调用 reject，避免错误日志
        // 旧请求的 Promise 将永远不会 resolve/reject，但会被垃圾回收
      }

      // 设置超时
      const timeout = window.setTimeout(() => {
        const pending = this.pendingRequests.get(requestId)
        if (pending) {
          this.pendingRequests.delete(requestId)
          pending.reject(new Error('Processing timeout'))
        }
      }, timeoutMs)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      })

      try {
        this.worker!.postMessage(request)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(requestId)
        reject(error)
      }
    })
  }

  /**
   * 同步处理地图数据（主线程回退方案）
   */
  private processMapSync(request: MapProcessRequest): MapProcessResult {
    // 直接调用处理逻辑（与 Worker 中相同）
    const { componentId, message, config } = request
    const { alpha = 0.7, colorScheme = 'map', maxOptimalSize = 200 } = config

    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      return {
        type: 'mapProcessed',
        componentId,
        triangles: null
      }
    }

    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05
    const origin = info.origin || {}
    const originPos = origin.position || { x: 0, y: 0, z: 0 }

    if (width === 0 || height === 0 || resolution === 0) {
      return {
        type: 'mapProcessed',
        componentId,
        triangles: null
      }
    }

    const downscaleFactor = Math.max(1, Math.ceil(Math.max(width, height) / maxOptimalSize))
    const sampledWidth = Math.ceil(width / downscaleFactor)
    const sampledHeight = Math.ceil(height / downscaleFactor)
    const sampledResolution = resolution * downscaleFactor

    const allPoints: any[] = []
    const allColors: any[] = []
    
    for (let sy = 0; sy < sampledHeight; sy++) {
      for (let sx = 0; sx < sampledWidth; sx++) {
        const startX = sx * downscaleFactor
        const startY = sy * downscaleFactor
        const endX = Math.min(startX + downscaleFactor, width)
        const endY = Math.min(startY + downscaleFactor, height)
        
        let hasOccupied = false
        let maxOccupancy = 0
        
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const index = y * width + x
            const occupancy = message.data[index]
            if (occupancy > 0) {
              hasOccupied = true
              maxOccupancy = Math.max(maxOccupancy, occupancy)
            }
          }
        }
        
        if (!hasOccupied) {
          continue
        }

        const worldX = originPos.x + (sx + 0.5) * sampledResolution
        const worldY = originPos.y + (sy + 0.5) * sampledResolution
        const worldZ = originPos.z

        const halfRes = sampledResolution * 0.5
        const p1 = { x: worldX - halfRes, y: worldY - halfRes, z: worldZ }
        const p2 = { x: worldX + halfRes, y: worldY - halfRes, z: worldZ }
        const p3 = { x: worldX + halfRes, y: worldY + halfRes, z: worldZ }
        const p4 = { x: worldX - halfRes, y: worldY + halfRes, z: worldZ }

        const occupancyValue = maxOccupancy / 100.0
        let color: { r: number; g: number; b: number; a: number }

        if (colorScheme === 'map') {
          const gray = 0.5 + occupancyValue * 0.3
          color = { r: gray, g: gray, b: gray, a: alpha }
        } else if (colorScheme === 'costmap') {
          color = {
            r: occupancyValue,
            g: 1.0 - occupancyValue * 0.5,
            b: 0.2,
            a: alpha
          }
        } else {
          color = { r: 1.0, g: 1.0, b: 1.0, a: alpha }
        }

        allPoints.push(p1, p2, p3)
        allColors.push(color, color, color)
        allPoints.push(p1, p3, p4)
        allColors.push(color, color, color)
      }
    }

    const triangles: any[] = []
    if (allPoints.length > 0) {
      triangles.push({
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        },
        points: allPoints,
        colors: allColors,
        color: undefined
      })
    }

    return {
      type: 'mapProcessed',
      componentId,
      triangles: triangles.length > 0 ? triangles : null
    }
  }

  /**
   * 同步处理点云数据（主线程回退方案）
   */
  private processPointCloudSync(request: PointCloudProcessRequest): PointCloudProcessResult {
    const { data } = request
    if (!data || !data.points || data.points.length === 0) {
      return {
        type: 'pointCloudProcessed',
        data: null
      }
    }

    const points: any[] = []
    const colors: any[] = []
    const defaultColor = { r: 1, g: 1, b: 1, a: 1 }
    const pointSize = data.pointSize || 3.0

    const pointsArray = data.points
    const colorsArray = data.colors
    for (let i = 0; i < pointsArray.length; i++) {
      const point = pointsArray[i]
      points.push({ x: point.x, y: point.y, z: point.z })
      const color = colorsArray?.[i] || defaultColor
      colors.push(color)
    }

    return {
      type: 'pointCloudProcessed',
      data: {
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        },
        points,
        colors: colors.length > 0 ? colors : undefined,
        color: colors.length === 0 ? defaultColor : undefined,
        scale: { x: pointSize, y: pointSize, z: pointSize }
      }
    }
  }

  /**
   * 同步处理图像数据（主线程回退方案）
   */
  private processImageSync(_request: ImageProcessRequest): ImageProcessResult {
    // 图像处理在主线程需要 Canvas，回退时返回 null，让主线程处理
    return {
      type: 'imageProcessed',
      imageData: null,
      error: 'Image processing requires Worker'
    }
  }

  /**
   * 同步处理路径数据（主线程回退方案）
   */
  private processPathSync(request: PathProcessRequest): PathProcessResult {
    const { data } = request
    if (!data || !data.waypoints || data.waypoints.length < 2) {
      return {
        type: 'pathProcessed',
        pathData: null,
        error: 'Invalid path data'
      }
    }

    const points: any[] = []
    const defaultColor = data.color || { r: 0, g: 1, b: 0, a: 1 }

    const waypoints = data.waypoints
    for (let i = 0; i < waypoints.length; i++) {
      const point = waypoints[i]
      if (point) {
        points.push({ x: point.x, y: point.y, z: point.z })
      }
    }

    return {
      type: 'pathProcessed',
      pathData: {
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        },
        points,
        color: defaultColor,
        scale: { x: data.lineWidth || 1, y: data.lineWidth || 1, z: data.lineWidth || 1 },
        primitive: 'line strip' as const
      }
    }
  }

  /**
   * 销毁 Worker
   */
  destroy(): void {
    // 取消所有待处理的请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout)
      reject(new Error('Worker destroyed'))
    })
    this.pendingRequests.clear()

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

// 单例实例
let workerInstance: DataProcessorWorker | null = null

export function getDataProcessorWorker(): DataProcessorWorker {
  if (!workerInstance) {
    workerInstance = new DataProcessorWorker()
  }
  return workerInstance
}

export function destroyDataProcessorWorker(): void {
  if (workerInstance) {
    workerInstance.destroy()
    workerInstance = null
  }
}
