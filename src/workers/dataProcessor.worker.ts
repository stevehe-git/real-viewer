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
  requestId?: string // 请求 ID，用于匹配请求和响应
  message: any
  targetWidth: number
  targetHeight: number
}

export interface ImageProcessResult {
  type: 'imageProcessed'
  requestId?: string // 请求 ID，用于匹配请求和响应
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

export interface LaserScanProcessRequest {
  type: 'processLaserScan'
  componentId: string
  message: any
  config: {
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
  }
}

export interface LaserScanProcessResult {
  type: 'laserScanProcessed'
  componentId: string
  data: any
  error?: string
}

export interface PointCloud2ProcessRequest {
  type: 'processPointCloud2'
  componentId: string
  message: any
  config: {
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
  }
}

export interface PointCloud2ProcessResult {
  type: 'pointCloud2Processed'
  componentId: string
  data: any
  error?: string
}

type WorkerRequest = MapProcessRequest | PointCloudProcessRequest | ImageProcessRequest | PathProcessRequest | TFProcessRequest | LaserScanProcessRequest | PointCloud2ProcessRequest
type WorkerResponse = MapProcessResult | PointCloudProcessResult | ImageProcessResult | PathProcessResult | TFProcessResult | LaserScanProcessResult | PointCloud2ProcessResult

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
        
        // 统计采样区域内的单元格值
        // 在 RViz 中：
        // -1: 未知区域（显示浅绿色）
        // 0: 自由空间（浅灰色）
        // 1-100: 占用区域（深灰色，值越大越深）
        let hasCell = false // 是否有单元格需要显示
        let hasUnknown = false // 是否有未知区域（-1）
        let maxOccupancy = -1 // 最大占用值（-1表示未知，0表示自由，1-100表示占用）
        
        // 在采样区域内统计单元格值
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const index = y * width + x
            const occupancy = message.data[index]
            
            // 处理不同的占用值
            if (occupancy === -1) {
              // 未知区域，标记为需要显示
              hasCell = true
              hasUnknown = true
              if (maxOccupancy < -1) {
                maxOccupancy = -1
              }
            } else if (occupancy === 0) {
              // 自由空间
              hasCell = true
              if (maxOccupancy < 0) {
                maxOccupancy = 0
              }
            } else if (occupancy > 0 && occupancy <= 100) {
              // 占用区域
              hasCell = true
              maxOccupancy = Math.max(maxOccupancy, occupancy)
            }
          }
        }
        
        // 如果采样区域没有任何单元格，跳过
        if (!hasCell) {
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

        // 根据占用值和颜色方案计算颜色（参照 RViz）
        let color: { r: number; g: number; b: number; a: number }

        if (colorScheme === 'map') {
          // RViz 的 map 颜色方案（精确复刻）：
          // -1: 未知区域（深青灰色）
          // 0: 自由空间（浅灰色 (0.7, 0.7, 0.7)）
          // 1-100: 占用区域（深灰色，值越大越深）
          if (hasUnknown && maxOccupancy === -1) {
            // 未知区域：深青灰色 (dark teal-gray)
            color = { r: 0.25, g: 0.45, b: 0.45, a: alpha }
          } else if (maxOccupancy === 0) {
            // 自由空间：浅灰色，与 RViz 完全一致
            color = { r: 0.7, g: 0.7, b: 0.7, a: alpha }
          } else if (maxOccupancy > 0 && maxOccupancy <= 100) {
            // 占用区域：深灰色渐变
            // RViz 使用线性映射：gray = 0.5 - (occupancy / 100.0) * 0.5
            // 占用值 1: gray = 0.5 - 0.01 * 0.5 = 0.495
            // 占用值 100: gray = 0.5 - 1.0 * 0.5 = 0.0
            const normalizedOccupancy = maxOccupancy / 100.0
            const gray = Math.max(0.0, 0.5 - normalizedOccupancy * 0.5)
            color = { r: gray, g: gray, b: gray, a: alpha }
          } else {
            // 混合区域：如果同时有未知和已知区域，优先显示已知区域
            if (maxOccupancy === 0) {
              color = { r: 0.7, g: 0.7, b: 0.7, a: alpha }
            } else if (maxOccupancy > 0 && maxOccupancy <= 100) {
              const normalizedOccupancy = maxOccupancy / 100.0
              const gray = Math.max(0.0, 0.5 - normalizedOccupancy * 0.5)
              color = { r: gray, g: gray, b: gray, a: alpha }
            } else {
              // 只有未知区域
              color = { r: 0.25, g: 0.45, b: 0.45, a: alpha }
            }
          }
        } else if (colorScheme === 'costmap') {
          // Costmap 颜色方案：使用渐变色
          if (hasUnknown && maxOccupancy === -1) {
            // 未知区域：深青灰色
            color = { r: 0.25, g: 0.45, b: 0.45, a: alpha }
          } else if (maxOccupancy === 0) {
            // 自由空间：浅绿色
            color = { r: 0.2, g: 0.8, b: 0.2, a: alpha }
          } else if (maxOccupancy > 0 && maxOccupancy <= 100) {
            // 占用区域：从黄色到红色渐变
            const normalizedOccupancy = maxOccupancy / 100.0
            color = {
              r: Math.min(1.0, normalizedOccupancy * 2),
              g: Math.max(0.0, 1.0 - normalizedOccupancy * 0.5),
              b: 0.2,
              a: alpha
            }
          } else {
            // 混合区域：优先显示已知区域
            if (maxOccupancy === 0) {
              color = { r: 0.2, g: 0.8, b: 0.2, a: alpha }
            } else if (maxOccupancy > 0 && maxOccupancy <= 100) {
              const normalizedOccupancy = maxOccupancy / 100.0
              color = {
                r: Math.min(1.0, normalizedOccupancy * 2),
                g: Math.max(0.0, 1.0 - normalizedOccupancy * 0.5),
                b: 0.2,
                a: alpha
              }
            } else {
              color = { r: 0.25, g: 0.45, b: 0.45, a: alpha }
            }
          }
        } else {
          // raw 或其他方案：使用原始值
          if (hasUnknown && maxOccupancy === -1) {
            // 未知区域：深青灰色
            color = { r: 0.25, g: 0.45, b: 0.45, a: alpha }
          } else if (maxOccupancy === 0) {
            color = { r: 1.0, g: 1.0, b: 1.0, a: alpha }
          } else if (maxOccupancy > 0 && maxOccupancy <= 100) {
            const normalizedOccupancy = maxOccupancy / 100.0
            color = { r: normalizedOccupancy, g: normalizedOccupancy, b: normalizedOccupancy, a: alpha }
          } else {
            // 混合区域：优先显示已知区域
            if (maxOccupancy === 0) {
              color = { r: 1.0, g: 1.0, b: 1.0, a: alpha }
            } else if (maxOccupancy > 0 && maxOccupancy <= 100) {
              const normalizedOccupancy = maxOccupancy / 100.0
              color = { r: normalizedOccupancy, g: normalizedOccupancy, b: normalizedOccupancy, a: alpha }
            } else {
              color = { r: 0.25, g: 0.45, b: 0.45, a: alpha }
            }
          }
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
    const { message, targetWidth, targetHeight, requestId } = request
    
    if (!message || !message.data) {
      return {
        type: 'imageProcessed',
        requestId,
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
        requestId,
        imageData: null
      }
    }

    // 处理 data 字段（优化 Base64 解码）
    let data: Uint8Array
    if (typeof message.data === 'string') {
      // Base64 解码（在 Worker 中处理，使用更高效的方法）
      try {
        const binaryString = atob(message.data)
        const len = binaryString.length
        // 使用 TypedArray 直接创建，避免循环
        data = new Uint8Array(len)
        // 使用批量操作优化（如果可能）
        for (let i = 0; i < len; i++) {
          data[i] = binaryString.charCodeAt(i)
        }
      } catch (error) {
        return {
          type: 'imageProcessed',
          requestId,
          imageData: null,
          error: 'Failed to decode base64 data'
        }
      }
    } else if (message.data instanceof Uint8Array) {
      data = message.data
    } else if (Array.isArray(message.data)) {
      data = new Uint8Array(message.data)
    } else {
      return {
        type: 'imageProcessed',
        requestId,
        imageData: null,
        error: 'Unsupported image data type'
      }
    }

    // 创建 ImageData
    const imageData = new ImageData(targetWidth, targetHeight)
    const dstData = imageData.data
    const scaleX = originalWidth / targetWidth
    const scaleY = originalHeight / targetHeight

    // 优化的像素转换（使用更高效的内存操作）
    if (encoding === 'rgb8' || encoding === 'bgr8') {
      const isBGR = encoding === 'bgr8'
      const bytesPerPixel = 3
      const dstDataLength = dstData.length
      
      // 预计算缩放因子，避免重复计算
      const scaleXInv = scaleX
      const scaleYInv = scaleY
      
      for (let dstY = 0; dstY < targetHeight; dstY++) {
        const srcY = Math.floor(dstY * scaleYInv)
        const srcRowStart = srcY * step
        const dstRowStart = dstY * targetWidth * 4
        
        for (let dstX = 0; dstX < targetWidth; dstX++) {
          const srcX = Math.floor(dstX * scaleXInv)
          const srcIndex = srcRowStart + srcX * bytesPerPixel
          const dstIndex = dstRowStart + dstX * 4
          
          // 边界检查优化
          if (srcIndex + 2 < data.length && dstIndex + 3 < dstDataLength) {
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
      const dstDataLength = dstData.length
      
      // 预计算缩放因子
      const scaleXInv = scaleX
      const scaleYInv = scaleY
      
      for (let dstY = 0; dstY < targetHeight; dstY++) {
        const srcY = Math.floor(dstY * scaleYInv)
        const srcRowStart = srcY * step
        const dstRowStart = dstY * targetWidth * 4
        
        for (let dstX = 0; dstX < targetWidth; dstX++) {
          const srcX = Math.floor(dstX * scaleXInv)
          const srcIndex = srcRowStart + srcX * bytesPerPixel
          const dstIndex = dstRowStart + dstX * 4
          
          // 边界检查优化
          if (srcIndex + 3 < data.length && dstIndex + 3 < dstDataLength) {
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
      // mono8 格式优化：灰度图可以使用批量复制
      const bytesPerPixel = 1
      const dstDataLength = dstData.length
      
      // 预计算缩放因子
      const scaleXInv = scaleX
      const scaleYInv = scaleY
      
      for (let dstY = 0; dstY < targetHeight; dstY++) {
        const srcY = Math.floor(dstY * scaleYInv)
        const srcRowStart = srcY * step
        const dstRowStart = dstY * targetWidth * 4
        
        for (let dstX = 0; dstX < targetWidth; dstX++) {
          const srcX = Math.floor(dstX * scaleXInv)
          const srcIndex = srcRowStart + srcX * bytesPerPixel
          const dstIndex = dstRowStart + dstX * 4
          
          // 边界检查优化
          if (srcIndex < data.length && dstIndex + 3 < dstDataLength) {
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
      requestId,
      imageData
    }
  } catch (error: any) {
    return {
      type: 'imageProcessed',
      requestId: request.requestId,
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

/**
 * 处理 LaserScan 数据（2D点云，基于frameid）
 * 将 ROS LaserScan 消息转换为点云数据
 */
function processLaserScan(request: LaserScanProcessRequest): LaserScanProcessResult {
  const { componentId } = request
  try {
    const { message, config } = request
    const {
      style = 'Flat Squares',
      size = 0.01,
      alpha = 1.0,
      colorTransformer = 'Intensity',
      useRainbow = true,
      minColor = { r: 0, g: 0, b: 0 },
      maxColor = { r: 255, g: 255, b: 255 },
      autocomputeIntensityBounds = true,
      minIntensity = 0,
      maxIntensity = 0
    } = config

    if (!message || !message.ranges || !Array.isArray(message.ranges) || message.ranges.length === 0) {
      return {
        type: 'laserScanProcessed',
        componentId,
        data: null
      }
    }

    const ranges = message.ranges
    const intensities = message.intensities || []
    const angleMin = message.angle_min || 0
    const angleMax = message.angle_max || 0
    const angleIncrement = message.angle_increment || 0
    const rangeMin = message.range_min || 0
    const rangeMax = message.range_max || Infinity

    // 计算强度范围（如果需要自动计算）
    let intensityMin = minIntensity
    let intensityMax = maxIntensity
    if (autocomputeIntensityBounds && intensities.length > 0) {
      intensityMin = Infinity
      intensityMax = -Infinity
      for (let i = 0; i < intensities.length; i++) {
        const intensity = intensities[i]
        if (intensity !== undefined && intensity !== null) {
          intensityMin = Math.min(intensityMin, intensity)
          intensityMax = Math.max(intensityMax, intensity)
        }
      }
      if (intensityMin === Infinity) {
        intensityMin = 0
        intensityMax = 1
      }
    }

    const points: any[] = []
    const colors: any[] = []
    const defaultColor = { r: 1, g: 1, b: 1, a: alpha }

    // 转换 ranges 为 3D 点（2D 点云，z=0）
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      
      // 跳过无效范围
      if (range === undefined || range === null || range < rangeMin || range > rangeMax || !isFinite(range)) {
        continue
      }

      // 计算角度
      const angle = angleMin + i * angleIncrement
      
      // 计算 2D 点位置（在激光扫描平面内）
      const x = range * Math.cos(angle)
      const y = range * Math.sin(angle)
      const z = 0 // LaserScan 是 2D 的，z=0

      points.push({ x, y, z })

      // 计算颜色
      let color = defaultColor
      if (colorTransformer === 'Intensity' && intensities.length > i) {
        const intensity = intensities[i]
        if (intensity !== undefined && intensity !== null && isFinite(intensity)) {
          // 归一化强度值
          const normalizedIntensity = intensityMax > intensityMin
            ? (intensity - intensityMin) / (intensityMax - intensityMin)
            : 0

          if (useRainbow) {
            // 彩虹色映射
            const hue = normalizedIntensity * 240 // 0-240 (blue to red)
            const rgb = hslToRgb(hue / 360, 1.0, 0.5)
            color = { ...rgb, a: alpha }
          } else {
            // 线性插值颜色
            color = {
              r: (minColor.r + (maxColor.r - minColor.r) * normalizedIntensity) / 255,
              g: (minColor.g + (maxColor.g - minColor.g) * normalizedIntensity) / 255,
              b: (minColor.b + (maxColor.b - minColor.b) * normalizedIntensity) / 255,
              a: alpha
            }
          }
        } else {
          // 强度数据无效，使用 Flat 颜色
          color = { r: 1, g: 0, b: 0, a: alpha } // 默认红色
        }
      } else if (colorTransformer === 'Flat') {
        // Flat 颜色模式
        color = { r: 1, g: 0, b: 0, a: alpha } // 默认红色
      } else {
        // 其他情况，使用默认颜色（白色）
        color = defaultColor
      }
      
      // 确保 color 有 alpha 属性
      if (!color.a) {
        color.a = alpha
      }

      colors.push(color)
    }

    if (points.length === 0) {
      return {
        type: 'laserScanProcessed',
        componentId,
        data: null
      }
    }

    return {
      type: 'laserScanProcessed',
      componentId,
      data: {
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        },
        points,
        colors: colors.length > 0 ? colors : undefined,
        color: colors.length === 0 ? defaultColor : undefined,
        scale: { x: size, y: size, z: size }
      }
    }
  } catch (error: any) {
    return {
      type: 'laserScanProcessed',
      componentId,
      data: null,
      error: error?.message || 'Unknown error'
    }
  }
}

/**
 * 处理 PointCloud2 数据（3D点云）
 * 将 ROS PointCloud2 消息转换为点云数据
 */
function processPointCloud2(request: PointCloud2ProcessRequest): PointCloud2ProcessResult {
  const { componentId } = request
  try {
    const { message, config } = request
    const {
      size = 0.01,
      alpha = 1.0,
      colorTransformer = 'RGB',
      useRainbow = false,
      minColor = { r: 0, g: 0, b: 0 },
      maxColor = { r: 255, g: 255, b: 255 }
    } = config

    if (!message || !message.data || !Array.isArray(message.data) || message.data.length === 0) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null
      }
    }

    const data = message.data
    const width = message.width || 0
    const height = message.height || 0
    const pointStep = message.point_step || 0
    const rowStep = message.row_step || 0
    const fields = message.fields || []

    if (pointStep === 0 || fields.length === 0) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null
      }
    }

    // 查找字段偏移量
    const findFieldOffset = (fieldName: string): number => {
      const field = fields.find((f: any) => f.name === fieldName)
      return field ? (field.offset || 0) : -1
    }

    const xOffset = findFieldOffset('x')
    const yOffset = findFieldOffset('y')
    const zOffset = findFieldOffset('z')
    const rgbOffset = findFieldOffset('rgb')
    const intensityOffset = findFieldOffset('intensity')

    if (xOffset < 0 || yOffset < 0 || zOffset < 0) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: 'Missing required fields (x, y, z)'
      }
    }

    // 读取浮点数（little-endian）
    const readFloat32 = (buffer: Uint8Array, offset: number): number => {
      const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4)
      return view.getFloat32(0, true) // little-endian
    }

    // 读取 Uint32（用于 RGB）
    const readUint32 = (buffer: Uint8Array, offset: number): number => {
      const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4)
      return view.getUint32(0, true) // little-endian
    }

    const points: any[] = []
    const colors: any[] = []
    const defaultColor = { r: 1, g: 1, b: 1, a: alpha }

    // 转换数据数组为 Uint8Array（如果需要）
    let dataArray: Uint8Array
    if (data instanceof Uint8Array) {
      dataArray = data
    } else if (Array.isArray(data)) {
      dataArray = new Uint8Array(data)
    } else {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: 'Invalid data format'
      }
    }

    const pointCount = width * height || Math.floor(dataArray.length / pointStep)

    for (let i = 0; i < pointCount; i++) {
      const pointOffset = i * pointStep
      
      if (pointOffset + pointStep > dataArray.length) {
        break
      }

      // 读取点坐标
      const x = readFloat32(dataArray, pointOffset + xOffset)
      const y = readFloat32(dataArray, pointOffset + yOffset)
      const z = readFloat32(dataArray, pointOffset + zOffset)

      // 跳过无效点（NaN 或 Infinity）
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        continue
      }

      points.push({ x, y, z })

      // 计算颜色
      let color = defaultColor
      if (colorTransformer === 'RGB' && rgbOffset >= 0) {
        // 从 RGB 字段读取颜色
        const rgb = readUint32(dataArray, pointOffset + rgbOffset)
        color = {
          r: ((rgb >> 16) & 0xFF) / 255,
          g: ((rgb >> 8) & 0xFF) / 255,
          b: (rgb & 0xFF) / 255,
          a: alpha
        }
      } else if (colorTransformer === 'Intensity' && intensityOffset >= 0) {
        // 从强度字段计算颜色
        const intensity = readFloat32(dataArray, pointOffset + intensityOffset)
        const normalizedIntensity = Math.max(0, Math.min(1, intensity))
        
        if (useRainbow) {
            const hue = normalizedIntensity * 240
            const rgb = hslToRgb(hue / 360, 1.0, 0.5)
            color = { ...rgb, a: alpha }
        } else {
          color = {
            r: (minColor.r + (maxColor.r - minColor.r) * normalizedIntensity) / 255,
            g: (minColor.g + (maxColor.g - minColor.g) * normalizedIntensity) / 255,
            b: (minColor.b + (maxColor.b - minColor.b) * normalizedIntensity) / 255,
            a: alpha
          }
        }
      }

      colors.push(color)
    }

    if (points.length === 0) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null
      }
    }

    return {
      type: 'pointCloud2Processed',
      componentId,
      data: {
        pose: {
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 }
        },
        points,
        colors: colors.length > 0 ? colors : undefined,
        color: colors.length === 0 ? defaultColor : undefined,
        scale: { x: size, y: size, z: size }
      }
    }
  } catch (error: any) {
    return {
      type: 'pointCloud2Processed',
      componentId,
      data: null,
      error: error?.message || 'Unknown error'
    }
  }
}

/**
 * HSL 转 RGB（用于彩虹色映射）
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return { r, g, b }
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
      case 'processLaserScan':
        response = processLaserScan(request)
        break
      case 'processPointCloud2':
        response = processPointCloud2(request)
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
      errorResponse.requestId = (request as ImageProcessRequest).requestId
      errorResponse.imageData = null
    } else if (request.type === 'processPath') {
      errorResponse.type = 'pathProcessed'
      errorResponse.pathData = null
    } else if (request.type === 'processTF') {
      errorResponse.type = 'tfProcessed'
      errorResponse.axes = []
      errorResponse.arrows = []
    } else if (request.type === 'processLaserScan') {
      errorResponse.type = 'laserScanProcessed'
      errorResponse.componentId = (request as LaserScanProcessRequest).componentId
      errorResponse.data = null
    } else if (request.type === 'processPointCloud2') {
      errorResponse.type = 'pointCloud2Processed'
      errorResponse.componentId = (request as PointCloud2ProcessRequest).componentId
      errorResponse.data = null
    }
    
    self.postMessage(errorResponse)
  }
})

// 导出类型供主线程使用
export type { WorkerRequest, WorkerResponse }
