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

export interface TFProcessRequest {
  type: 'processTF'
  frames: string[]
  frameInfos: Array<{
    frameName: string
    parent: string | null
    position: { x: number; y: number; z: number } | null
    orientation: { x: number; y: number; z: number; w: number } | null
  }>
  config: {
    showAxes?: boolean
    showArrows?: boolean
    markerScale?: number
    markerAlpha?: number
  }
}

export interface TFProcessResult {
  type: 'tfProcessed'
  axes: any[]
  arrows: any[]
  error?: string
}

type WorkerRequest = MapProcessRequest | PointCloudProcessRequest | ImageProcessRequest | PathProcessRequest | TFProcessRequest
type WorkerResponse = MapProcessResult | PointCloudProcessResult | ImageProcessResult | PathProcessResult | TFProcessResult

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
 * 处理 TF 数据（生成 axes 和 arrows）
 * 注意：Worker 中不能使用 gl-matrix，所以需要主线程先计算好 frameInfo
 */
function processTF(request: TFProcessRequest): TFProcessResult {
  try {
    const { frames, frameInfos, config } = request
    const {
      showAxes = true,
      showArrows = true,
      markerScale = 1.0,
      markerAlpha = 1.0
    } = config

    const axisLength = 0.1 * markerScale
    const axisRadius = 0.01 * markerScale

    // 创建 frameInfo 映射
    const frameInfoMap = new Map<string, typeof frameInfos[0]>()
    frameInfos.forEach(info => {
      frameInfoMap.set(info.frameName, info)
    })

    const axes: any[] = []
    const arrows: any[] = []

    // 简单的四元数乘法（用于旋转）
    const multiplyQuaternions = (q1: { x: number; y: number; z: number; w: number }, q2: { x: number; y: number; z: number; w: number }) => {
      return {
        x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
        y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
        z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
        w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
      }
    }

    // 旋转向量（使用四元数）
    const rotateVector = (v: [number, number, number], q: { x: number; y: number; z: number; w: number }): [number, number, number] => {
      // q * v * q^-1
      const qv = { x: v[0], y: v[1], z: v[2], w: 0 }
      const qConj = { x: -q.x, y: -q.y, z: -q.z, w: q.w }
      const qvq = multiplyQuaternions(multiplyQuaternions(q, qv), qConj)
      return [qvq.x, qvq.y, qvq.z]
    }

    // 创建旋转四元数（绕轴旋转）
    const createRotationQuaternion = (axis: 'x' | 'y' | 'z', angle: number) => {
      const halfAngle = angle / 2
      const s = Math.sin(halfAngle)
      const c = Math.cos(halfAngle)
      switch (axis) {
        case 'x':
          return { x: s, y: 0, z: 0, w: c }
        case 'y':
          return { x: 0, y: s, z: 0, w: c }
        case 'z':
          return { x: 0, y: 0, z: s, w: c }
      }
    }

    // 遍历所有 frames，生成 axes 和 arrows
    for (const frameName of frames) {
      const frameInfo = frameInfoMap.get(frameName)
      if (!frameInfo || !frameInfo.position || !frameInfo.orientation) {
        continue // 跳过无效的 frame
      }

      const position = frameInfo.position
      const orientation = frameInfo.orientation
      const frameQuat = orientation

      if (showAxes) {
        // X轴：红色，沿 frame 的 X 方向
        const xAxisBaseRotation = createRotationQuaternion('y', -Math.PI / 2)
        const xAxisQuat = multiplyQuaternions(frameQuat, xAxisBaseRotation)
        const xAxisDir = rotateVector([1, 0, 0], frameQuat)

        axes.push({
          pose: {
            position: {
              x: position.x + xAxisDir[0] * axisLength / 2,
              y: position.y + xAxisDir[1] * axisLength / 2,
              z: position.z + xAxisDir[2] * axisLength / 2
            },
            orientation: xAxisQuat
          },
          scale: { x: axisRadius, y: axisRadius, z: axisLength },
          color: { r: 1.0, g: 0.0, b: 0.0, a: markerAlpha }
        })

        // Y轴：绿色，沿 frame 的 Y 方向
        const yAxisBaseRotation = createRotationQuaternion('x', -Math.PI / 2)
        const yAxisQuat = multiplyQuaternions(frameQuat, yAxisBaseRotation)
        const yAxisDir = rotateVector([0, 1, 0], frameQuat)

        axes.push({
          pose: {
            position: {
              x: position.x + yAxisDir[0] * axisLength / 2,
              y: position.y + yAxisDir[1] * axisLength / 2,
              z: position.z + yAxisDir[2] * axisLength / 2
            },
            orientation: yAxisQuat
          },
          scale: { x: axisRadius, y: axisRadius, z: axisLength },
          color: { r: 0.0, g: 1.0, b: 0.0, a: markerAlpha }
        })

        // Z轴：蓝色，沿 frame 的 Z 方向
        const zAxisDir = rotateVector([0, 0, 1], frameQuat)

        axes.push({
          pose: {
            position: {
              x: position.x + zAxisDir[0] * axisLength / 2,
              y: position.y + zAxisDir[1] * axisLength / 2,
              z: position.z + zAxisDir[2] * axisLength / 2
            },
            orientation: frameQuat
          },
          scale: { x: axisRadius, y: axisRadius, z: axisLength },
          color: { r: 0.0, g: 0.0, b: 1.0, a: markerAlpha }
        })
      }

      if (showArrows && frameInfo.parent) {
        // 获取父 frame 的位置
        const parentInfo = frameInfoMap.get(frameInfo.parent)
        if (parentInfo && parentInfo.position) {
          arrows.push({
            points: [
              { x: parentInfo.position.x, y: parentInfo.position.y, z: parentInfo.position.z },
              { x: position.x, y: position.y, z: position.z }
            ],
            scale: { x: axisRadius * 2, y: axisRadius * 2, z: axisLength * 0.3 },
            color: { r: 0.5, g: 0.5, b: 0.5, a: markerAlpha }
          })
        }
      }
    }

    return {
      type: 'tfProcessed',
      axes,
      arrows
    }
  } catch (error: any) {
    return {
      type: 'tfProcessed',
      axes: [],
      arrows: [],
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
      case 'processTF':
        response = processTF(request)
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
    } else if (request.type === 'processTF') {
      errorResponse.type = 'tfProcessed'
      errorResponse.axes = []
      errorResponse.arrows = []
    }
    
    self.postMessage(errorResponse)
  }
})

// 导出类型供主线程使用
export type { WorkerRequest, WorkerResponse }
