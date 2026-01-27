/**
 * 数据处理器 Web Worker
 * 负责在后台线程处理耗时的数据转换操作，避免阻塞主线程
 * 参照 regl-worldview 的优化方案
 */

export interface MapProcessRequest {
  type: 'processMap'
  componentId: string
  message: any
  config: {
    alpha?: number
    colorScheme?: string
    maxOptimalSize?: number
  }
}

export interface MapProcessResult {
  type: 'mapProcessed'
  componentId: string
  triangles: any[] | null
  error?: string
}

export interface PointCloudProcessRequest {
  type: 'processPointCloud'
  data: any
}

export interface PointCloudProcessResult {
  type: 'pointCloudProcessed'
  data: any
  error?: string
}

type WorkerRequest = MapProcessRequest | PointCloudProcessRequest
type WorkerResponse = MapProcessResult | PointCloudProcessResult

/**
 * 处理地图数据（OccupancyGrid 转三角形）
 */
function processMap(request: MapProcessRequest): MapProcessResult {
  try {
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

    // 性能优化：根据地图大小决定降采样因子
    const downscaleFactor = Math.max(1, Math.ceil(Math.max(width, height) / maxOptimalSize))
    const sampledWidth = Math.ceil(width / downscaleFactor)
    const sampledHeight = Math.ceil(height / downscaleFactor)
    const sampledResolution = resolution * downscaleFactor

    // 使用类型化数组提升性能
    const allPoints: any[] = []
    const allColors: any[] = []
    
    // 遍历降采样后的单元格
    for (let sy = 0; sy < sampledHeight; sy++) {
      for (let sx = 0; sx < sampledWidth; sx++) {
        // 计算原始坐标范围
        const startX = sx * downscaleFactor
        const startY = sy * downscaleFactor
        const endX = Math.min(startX + downscaleFactor, width)
        const endY = Math.min(startY + downscaleFactor, height)
        
        // 检查采样区域是否包含占用单元格
        let hasOccupied = false
        let maxOccupancy = 0
        
        // 在采样区域内查找占用单元格
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
        
        // 如果采样区域没有占用单元格，跳过
        if (!hasOccupied) {
          continue
        }

        // 计算采样单元格的世界坐标
        const worldX = originPos.x + (sx + 0.5) * sampledResolution
        const worldY = originPos.y + (sy + 0.5) * sampledResolution
        const worldZ = originPos.z

        // 计算单元格的四个角点
        const halfRes = sampledResolution * 0.5
        const p1 = { x: worldX - halfRes, y: worldY - halfRes, z: worldZ }
        const p2 = { x: worldX + halfRes, y: worldY - halfRes, z: worldZ }
        const p3 = { x: worldX + halfRes, y: worldY + halfRes, z: worldZ }
        const p4 = { x: worldX - halfRes, y: worldY + halfRes, z: worldZ }

        // 根据占用值和颜色方案计算颜色
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

        // 添加两个三角形（组成矩形）
        allPoints.push(p1, p2, p3)
        allColors.push(color, color, color)
        allPoints.push(p1, p3, p4)
        allColors.push(color, color, color)
      }
    }

    // 创建单个合并的三角形列表
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
  } catch (error: any) {
    return {
      type: 'mapProcessed',
      componentId,
      triangles: null,
      error: error?.message || 'Unknown error'
    }
  }
}

/**
 * 处理点云数据
 */
function processPointCloud(request: PointCloudProcessRequest): PointCloudProcessResult {
  try {
    // TODO: 实现点云数据处理
    return {
      type: 'pointCloudProcessed',
      data: request.data
    }
  } catch (error: any) {
    return {
      type: 'pointCloudProcessed',
      data: null,
      error: error?.message || 'Unknown error'
    }
  }
}

// Worker 消息处理
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  let response: WorkerResponse

  try {
    switch (request.type) {
      case 'processMap':
        response = processMap(request)
        break
      case 'processPointCloud':
        response = processPointCloud(request)
        break
      default:
        throw new Error(`Unknown request type: ${(request as any).type}`)
    }

    // 使用 Transferable Objects 优化大数据传输（如果可能）
    self.postMessage(response)
  } catch (error: any) {
    self.postMessage({
      type: request.type === 'processMap' ? 'mapProcessed' : 'pointCloudProcessed',
      componentId: request.type === 'processMap' ? (request as MapProcessRequest).componentId : '',
      triangles: null,
      data: null,
      error: error?.message || 'Unknown error'
    } as any)
  }
})

// 导出类型供主线程使用
export type { WorkerRequest, WorkerResponse }
