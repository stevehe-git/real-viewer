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

export interface ImageProcessRequest {
  type: 'processImage'
  message: any
  targetWidth: number
  targetHeight: number
}

export interface ImageProcessResult {
  type: 'imageProcessed'
  imageData: ImageData | null
  error?: string
}

export interface PathProcessRequest {
  type: 'processPath'
  data: any
}

export interface PathProcessResult {
  type: 'pathProcessed'
  pathData: any
  error?: string
}

type WorkerRequest = MapProcessRequest | PointCloudProcessRequest | ImageProcessRequest | PathProcessRequest
type WorkerResponse = MapProcessResult | PointCloudProcessResult | ImageProcessResult | PathProcessResult

/**
 * 处理地图数据（OccupancyGrid 转三角形）
 */
function processMap(request: MapProcessRequest): MapProcessResult {
  const { componentId } = request
  try {
    const { message, config } = request
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
      componentId: componentId,
      triangles: triangles.length > 0 ? triangles : null
    }
  } catch (error: any) {
    return {
      type: 'mapProcessed',
      componentId: componentId,
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

    // 优化：使用 for 循环而不是 forEach，性能更好
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
  } catch (error: any) {
    return {
      type: 'pointCloudProcessed',
      data: null,
      error: error?.message || 'Unknown error'
    }
  }
}

/**
 * 处理图像数据（像素转换）
 */
function processImage(request: ImageProcessRequest): ImageProcessResult {
  try {
    const { message, targetWidth, targetHeight } = request
    
    if (!message || !message.data) {
      return {
        type: 'imageProcessed',
        imageData: null
      }
    }

    const originalWidth = message.width ?? 0
    const originalHeight = message.height ?? 0
    const encoding = message.encoding || 'rgb8'
    const step = message.step ?? (originalWidth * 3)
    
    if (originalWidth === 0 || originalHeight === 0) {
      return {
        type: 'imageProcessed',
        imageData: null
      }
    }

    // 处理 data 字段
    let data: Uint8Array
    if (typeof message.data === 'string') {
      // Base64 解码（在 Worker 中处理）
      const binaryString = atob(message.data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      data = bytes
    } else if (message.data instanceof Uint8Array) {
      data = message.data
    } else if (Array.isArray(message.data)) {
      data = new Uint8Array(message.data)
    } else {
      return {
        type: 'imageProcessed',
        imageData: null,
        error: 'Unsupported image data type'
      }
    }

    // 创建 ImageData
    const imageData = new ImageData(targetWidth, targetHeight)
    const dstData = imageData.data
    const scaleX = originalWidth / targetWidth
    const scaleY = originalHeight / targetHeight

    // 优化的像素转换（与主线程版本相同）
    if (encoding === 'rgb8' || encoding === 'bgr8') {
      const isBGR = encoding === 'bgr8'
      const bytesPerPixel = 3
      for (let dstY = 0; dstY < targetHeight; dstY++) {
        const srcY = Math.floor(dstY * scaleY)
        const srcRowStart = srcY * step
        const dstRowStart = dstY * targetWidth * 4
        
        for (let dstX = 0; dstX < targetWidth; dstX++) {
          const srcX = Math.floor(dstX * scaleX)
          const srcIndex = srcRowStart + srcX * bytesPerPixel
          const dstIndex = dstRowStart + dstX * 4
          
          if (srcIndex + 2 < data.length) {
            if (isBGR) {
              dstData[dstIndex] = data[srcIndex + 2] ?? 0
              dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0
              dstData[dstIndex + 2] = data[srcIndex] ?? 0
            } else {
              dstData[dstIndex] = data[srcIndex] ?? 0
              dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0
              dstData[dstIndex + 2] = data[srcIndex + 2] ?? 0
            }
            dstData[dstIndex + 3] = 255
          }
        }
      }
    } else if (encoding === 'rgba8' || encoding === 'bgra8') {
      const isBGRA = encoding === 'bgra8'
      const bytesPerPixel = 4
      for (let dstY = 0; dstY < targetHeight; dstY++) {
        const srcY = Math.floor(dstY * scaleY)
        const srcRowStart = srcY * step
        const dstRowStart = dstY * targetWidth * 4
        
        for (let dstX = 0; dstX < targetWidth; dstX++) {
          const srcX = Math.floor(dstX * scaleX)
          const srcIndex = srcRowStart + srcX * bytesPerPixel
          const dstIndex = dstRowStart + dstX * 4
          
          if (srcIndex + 3 < data.length) {
            if (isBGRA) {
              dstData[dstIndex] = data[srcIndex + 2] ?? 0
              dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0
              dstData[dstIndex + 2] = data[srcIndex] ?? 0
              dstData[dstIndex + 3] = data[srcIndex + 3] ?? 0
            } else {
              dstData[dstIndex] = data[srcIndex] ?? 0
              dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0
              dstData[dstIndex + 2] = data[srcIndex + 2] ?? 0
              dstData[dstIndex + 3] = data[srcIndex + 3] ?? 0
            }
          }
        }
      }
    } else if (encoding === 'mono8') {
      const bytesPerPixel = 1
      for (let dstY = 0; dstY < targetHeight; dstY++) {
        const srcY = Math.floor(dstY * scaleY)
        const srcRowStart = srcY * step
        const dstRowStart = dstY * targetWidth * 4
        
        for (let dstX = 0; dstX < targetWidth; dstX++) {
          const srcX = Math.floor(dstX * scaleX)
          const srcIndex = srcRowStart + srcX * bytesPerPixel
          const dstIndex = dstRowStart + dstX * 4
          
          if (srcIndex < data.length) {
            const gray = data[srcIndex] ?? 0
            dstData[dstIndex] = gray
            dstData[dstIndex + 1] = gray
            dstData[dstIndex + 2] = gray
            dstData[dstIndex + 3] = 255
          }
        }
      }
    }

    return {
      type: 'imageProcessed',
      imageData
    }
  } catch (error: any) {
    return {
      type: 'imageProcessed',
      imageData: null,
      error: error?.message || 'Unknown error'
    }
  }
}

/**
 * 处理路径数据
 */
function processPath(request: PathProcessRequest): PathProcessResult {
  try {
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

    // 优化：使用 for 循环而不是 forEach
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
  } catch (error: any) {
    return {
      type: 'pathProcessed',
      pathData: null,
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
      case 'processImage':
        response = processImage(request)
        break
      case 'processPath':
        response = processPath(request)
        break
      default:
        throw new Error(`Unknown request type: ${(request as any).type}`)
    }

    // 使用 Transferable Objects 优化大数据传输（ImageData 可以传输）
    if (response.type === 'imageProcessed') {
      const imageResult = response as ImageProcessResult
      if (imageResult.imageData) {
        // ImageData.data 是 Uint8ClampedArray，可以作为 Transferable 传输
        // Worker 的 postMessage 支持第二个参数作为 transfer 数组
        // Worker postMessage 的 transfer 参数需要作为第二个参数传递
        // 注意：Worker 的 postMessage 第二个参数是 transfer 数组，不是 options 对象
        const transferList = [imageResult.imageData.data.buffer]
        ;(self.postMessage as any)(response, transferList)
      } else {
        self.postMessage(response)
      }
    } else {
      self.postMessage(response)
    }
  } catch (error: any) {
    const errorResponse: any = {
      error: error?.message || 'Unknown error'
    }
    
    // 根据请求类型返回相应的错误响应
    if (request.type === 'processMap') {
      errorResponse.type = 'mapProcessed'
      errorResponse.componentId = (request as MapProcessRequest).componentId
      errorResponse.triangles = null
    } else if (request.type === 'processPointCloud') {
      errorResponse.type = 'pointCloudProcessed'
      errorResponse.data = null
    } else if (request.type === 'processImage') {
      errorResponse.type = 'imageProcessed'
      errorResponse.imageData = null
    } else if (request.type === 'processPath') {
      errorResponse.type = 'pathProcessed'
      errorResponse.pathData = null
    }
    
    self.postMessage(errorResponse)
  }
})

// 导出类型供主线程使用
export type { WorkerRequest, WorkerResponse }
