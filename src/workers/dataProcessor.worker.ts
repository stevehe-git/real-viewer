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
  triangles: any[] | null // 保留向后兼容
  textureData?: Uint8Array | null // 新的纹理数据（RGBA格式）
  width?: number
  height?: number
  resolution?: number
  origin?: any
  dataHash?: string
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
    minIntensity?: number
    maxIntensity?: number
    axisColor?: string // 'X' | 'Y' | 'Z'，用于 Axis 模式
    autocomputeIntensityBounds?: boolean
  }
  // TF 变换信息（从主线程传递，避免 Worker 中访问 tfManager）
  frameInfo?: {
    position: { x: number; y: number; z: number } | null
    orientation: { x: number; y: number; z: number; w: number } | null
  } | null
}

export interface PointCloud2ProcessResult {
  type: 'pointCloud2Processed'
  componentId: string
  data: any
  error?: string
}

export interface OdometryProcessRequest {
  type: 'processOdometry'
  componentId: string
  poseHistory: Array<{
    position: { x: number; y: number; z: number }
    orientation: { x: number; y: number; z: number; w: number }
    timestamp: number
  }>
  config: {
    shape?: string
    axesLength?: number
    axesRadius?: number
    alpha?: number
  }
}

export interface OdometryProcessResult {
  type: 'odometryProcessed'
  componentId: string
  axes: any[]
  error?: string
}

type WorkerRequest = MapProcessRequest | PointCloudProcessRequest | ImageProcessRequest | PathProcessRequest | TFProcessRequest | LaserScanProcessRequest | PointCloud2ProcessRequest | OdometryProcessRequest
type WorkerResponse = MapProcessResult | PointCloudProcessResult | ImageProcessResult | PathProcessResult | TFProcessResult | LaserScanProcessResult | PointCloud2ProcessResult | OdometryProcessResult

/**
 * 处理地图数据（OccupancyGrid 转纹理数据）
 * 工业级优化：使用纹理渲染替代大量三角形，性能提升 100-1000 倍
 */
function processMap(request: MapProcessRequest): MapProcessResult {
  const { componentId } = request
  try {
    const { message, config } = request
    const { alpha = 1.0, colorScheme = 'map' } = config

    if (!message || !message.info || !message.data || !Array.isArray(message.data)) {
      return {
        type: 'mapProcessed',
        componentId,
        triangles: null,
        textureData: null
      }
    }

    const info = message.info
    const width = info.width || 0
    const height = info.height || 0
    const resolution = info.resolution || 0.05
    const origin = info.origin || {}

    if (width === 0 || height === 0 || resolution === 0) {
      return {
        type: 'mapProcessed',
        componentId,
        triangles: null,
        textureData: null
      }
    }

    // 生成数据哈希用于缓存检测
    const dataHash = `${width}_${height}_${resolution}_${origin.position?.x || 0}_${origin.position?.y || 0}`

    // 创建 RGBA 纹理数据（每个像素 4 字节）
    // R 通道：存储占用值（归一化到 0-1）
    //   -1 (未知) -> 0.0
    //   0 (自由) -> 0.5
    //   1-100 (占用) -> 0.5 + (occupancy/100.0) * 0.5
    // G, B, A 通道：保留用于未来扩展或颜色预计算
    const textureData = new Uint8Array(width * height * 4)
    
    // 一次性遍历所有像素，转换为纹理数据
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const occupancy = message.data[index]
        const texIndex = index * 4
        
        // 将占用值转换为归一化的纹理值（存储在 R 通道）
        let normalizedOccupancy: number
        if (occupancy === -1) {
          // 未知区域：0.0
          normalizedOccupancy = 0.0
        } else if (occupancy === 0) {
          // 自由空间：0.5
          normalizedOccupancy = 0.5
        } else if (occupancy > 0 && occupancy <= 100) {
          // 占用区域：0.5 + (occupancy/100.0) * 0.5，范围 [0.5, 1.0]
          normalizedOccupancy = 0.5 + (occupancy / 100.0) * 0.5
        } else {
          // 无效值：当作未知处理
          normalizedOccupancy = 0.0
        }
        
        // 存储到纹理数据（R 通道，0-255 范围）
        textureData[texIndex] = Math.floor(normalizedOccupancy * 255) // R
        textureData[texIndex + 1] = 0 // G (保留)
        textureData[texIndex + 2] = 0 // B (保留)
        textureData[texIndex + 3] = Math.floor(alpha * 255) // A
      }
    }

    return {
      type: 'mapProcessed',
      componentId: componentId,
      triangles: null, // 不再使用三角形
      textureData: textureData,
      width: width,
      height: height,
      resolution: resolution,
      origin: origin,
      dataHash: dataHash
    }
  } catch (error: any) {
    return {
      type: 'mapProcessed',
      componentId: componentId,
      triangles: null,
      textureData: null,
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
          // 计算箭头长度
          const dx = position.x - parentInfo.position.x
          const dy = position.y - parentInfo.position.y
          const dz = position.z - parentInfo.position.z
          const arrowLength = Math.sqrt(dx * dx + dy * dy + dz * dz)

          // 箭头默认长度是0.1，如果小于0.1，则不显示
          if (arrowLength < 0.1) {
            continue
          }
          
          // 箭头尺寸：根据长度动态调整，但保持最小和最大限制
          // 箭头头部宽度：基于 axisRadius，但稍微大一些以更清晰
          const arrowShaftRadius = axisRadius * 0.2
          // 箭头头部长度：基于箭头总长度的比例，但至少是 shaft 宽度的 2 倍
          const arrowHeadLength = 0.1
          // 箭头头部宽度：是 shaft 宽度的 2 倍
          const arrowHeadRadius = arrowShaftRadius * 10
          
          arrows.push({
            points: [
              { x: position.x, y: position.y, z: position.z },
              { x: parentInfo.position.x, y: parentInfo.position.y, z: parentInfo.position.z }
            ],
            // scale: x 和 y 是箭头 shaft 的半径，z 是箭头头部的长度
            // Arrows.ts 会根据 points 计算总长度，然后使用 scale.z 作为头部长度
            scale: { 
              x: arrowShaftRadius,  // shaft 半径
              y: arrowHeadRadius,   // head 半径（在 Arrows.ts 中会被用作 headWidth）
              z: arrowHeadLength    // head 长度
            },
            // shaft 使用黄色/橙色系，更符合 RViz 的 TF 箭头显示效果
            color: { r: 1.0, g: 0.8, b: 0.0, a: markerAlpha },
            // 头部使用粉色，区别于 shaft 的黄色
            headColor: { r: 1.0, g: 0.4, b: 0.8, a: markerAlpha }
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
 * 处理 Odometry 数据（生成 axes）
 */
function processOdometry(request: OdometryProcessRequest): OdometryProcessResult {
  try {
    const { componentId, poseHistory, config } = request
    const shape = config.shape || 'Axes'
    const axesLength = config.axesLength ?? 1.0
    const axesRadius = config.axesRadius ?? 0.1
    const alpha = config.alpha ?? 1.0

    // 四元数运算辅助函数（不使用 gl-matrix，纯 JavaScript 实现）
    const quatMultiply = (q1: { x: number; y: number; z: number; w: number }, q2: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number; w: number } => {
      return {
        x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
        y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
        z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
        w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
      }
    }

    const quatConjugate = (q: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number; w: number } => {
      return { x: -q.x, y: -q.y, z: -q.z, w: q.w }
    }

    const rotateVector = (v: [number, number, number], q: { x: number; y: number; z: number; w: number }): [number, number, number] => {
      // q * v * q^-1，其中 v 是纯四元数 (x, y, z, 0)
      const qv = { x: v[0], y: v[1], z: v[2], w: 0 }
      const qConj = quatConjugate(q)
      const qvq = quatMultiply(quatMultiply(q, qv), qConj)
      return [qvq.x, qvq.y, qvq.z]
    }

    const createRotationQuaternion = (axis: 'x' | 'y' | 'z', angle: number): { x: number; y: number; z: number; w: number } => {
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

    const allAxes: any[] = []

    // 遍历历史位姿列表，为每个位姿生成 axes
    for (let i = 0; i < poseHistory.length; i++) {
      const poseItem = poseHistory[i]
      if (!poseItem) continue
      const posePosition = poseItem.position
      const poseOrientation = poseItem.orientation
      const frameQuat = { x: poseOrientation.x, y: poseOrientation.y, z: poseOrientation.z, w: poseOrientation.w }

      if (shape === 'Axes') {
        // X轴：红色，沿 frame 的 X 方向
        const xAxisBaseRotation = createRotationQuaternion('y', -Math.PI / 2)
        const xAxisQuat = quatMultiply(frameQuat, xAxisBaseRotation)
        const xAxisDir = rotateVector([1, 0, 0], frameQuat)

        allAxes.push({
          pose: {
            position: {
              x: posePosition.x + xAxisDir[0] * axesLength / 2,
              y: posePosition.y + xAxisDir[1] * axesLength / 2,
              z: posePosition.z + xAxisDir[2] * axesLength / 2
            },
            orientation: xAxisQuat
          },
          points: [{ x: 0, y: 0, z: 0 }],
          scale: { x: axesRadius, y: axesRadius, z: axesLength },
          color: { r: 1.0, g: 0.0, b: 0.0, a: alpha }
        })

        // Y轴：绿色，沿 frame 的 Y 方向
        const yAxisBaseRotation = createRotationQuaternion('x', -Math.PI / 2)
        const yAxisQuat = quatMultiply(frameQuat, yAxisBaseRotation)
        const yAxisDir = rotateVector([0, 1, 0], frameQuat)

        allAxes.push({
          pose: {
            position: {
              x: posePosition.x + yAxisDir[0] * axesLength / 2,
              y: posePosition.y + yAxisDir[1] * axesLength / 2,
              z: posePosition.z + yAxisDir[2] * axesLength / 2
            },
            orientation: yAxisQuat
          },
          points: [{ x: 0, y: 0, z: 0 }],
          scale: { x: axesRadius, y: axesRadius, z: axesLength },
          color: { r: 0.0, g: 1.0, b: 0.0, a: alpha }
        })

        // Z轴：蓝色，沿 frame 的 Z 方向
        const zAxisDir = rotateVector([0, 0, 1], frameQuat)

        allAxes.push({
          pose: {
            position: {
              x: posePosition.x + zAxisDir[0] * axesLength / 2,
              y: posePosition.y + zAxisDir[1] * axesLength / 2,
              z: posePosition.z + zAxisDir[2] * axesLength / 2
            },
            orientation: { x: poseOrientation.x, y: poseOrientation.y, z: poseOrientation.z, w: poseOrientation.w }
          },
          points: [{ x: 0, y: 0, z: 0 }],
          scale: { x: axesRadius, y: axesRadius, z: axesLength },
          color: { r: 0.0, g: 0.0, b: 1.0, a: alpha }
        })
      }
    }

    return {
      type: 'odometryProcessed',
      componentId,
      axes: allAxes
    }
  } catch (error: any) {
    return {
      type: 'odometryProcessed',
      componentId: request.componentId,
      axes: [],
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
    const { message, config, componentId } = request
    const {
      size = 3, // 点大小（像素或世界空间单位）
      alpha = 1.0,
      colorTransformer = 'Intensity',
      useRainbow = false,
      minColor = { r: 0, g: 0, b: 0 },
      maxColor = { r: 255, g: 255, b: 255 },
      minIntensity = 0,
      maxIntensity = 1,
      axisColor = 'Z', // 默认使用 Z 轴
      autocomputeIntensityBounds = true
    } = config

    // PointCloud2 消息的 data 字段是 Uint8Array 或 Array
    // 不能只检查 Array.isArray，因为 Uint8Array 也是数组类型
    if (!message || !message.data || message.data.length === 0) {
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

    // 查找字段偏移量（支持精确匹配）
    const findFieldOffset = (fieldName: string): number => {
      const field = fields.find((f: any) => f.name === fieldName)
      return field ? (field.offset || 0) : -1
    }

    // 查找字段偏移量（支持多个可能的字段名称）
    const findFieldOffsetVariants = (fieldNames: string[]): number => {
      for (const name of fieldNames) {
        const offset = findFieldOffset(name)
        if (offset >= 0) {
          return offset
        }
      }
      return -1
    }

    const xOffset = findFieldOffset('x')
    const yOffset = findFieldOffset('y')
    const zOffset = findFieldOffset('z')
    
    // 查找 Intensity 字段（支持多种字段名称变体）
    const intensityOffset = findFieldOffsetVariants(['intensity', 'i', 'I'])
    
    // 调试：输出所有字段信息（仅在开发环境）
    if (import.meta.env.DEV) {
      const fieldNames = fields.map((f: any) => f.name).join(', ')
      console.log(`[PointCloud2 Worker] Fields for ${componentId}:`, fields.map((f: any) => ({
        name: f.name,
        offset: f.offset,
        datatype: f.datatype,
        count: f.count
      })))
      console.log(`[PointCloud2 Worker] Field names: [${fieldNames}]`)
      console.log(`[PointCloud2 Worker] Field offsets:`, {
        x: xOffset,
        y: yOffset,
        z: zOffset,
        intensity: intensityOffset
      })
    }

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

    const points: any[] = []
    const colors: any[] = []
    const defaultColor = { r: 1, g: 1, b: 1, a: alpha }

    // 转换数据数组为 Uint8Array（如果需要）
    // 支持 Uint8Array、Array、字符串（base64编码）
    let dataArray: Uint8Array
    if (data instanceof ArrayBuffer) {
      // ArrayBuffer：转换为 Uint8Array
      dataArray = new Uint8Array(data)
    } else if (data instanceof Uint8Array) {
      dataArray = data
    } else if (Array.isArray(data)) {
      dataArray = new Uint8Array(data)
    } else if (typeof data === 'string') {
      // Base64 解码（ROS 消息通过 JSON 序列化时，二进制数据会被编码为 base64 字符串）
      try {
        const binaryString = atob(data)
        const len = binaryString.length
        dataArray = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          dataArray[i] = binaryString.charCodeAt(i)
        }
      } catch (error) {
        return {
          type: 'pointCloud2Processed',
          componentId,
          data: null,
          error: `Failed to decode base64 data: ${error}`
        }
      }
    } else {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: `Invalid data format: expected ArrayBuffer, Uint8Array, Array, or string (base64), got ${typeof data}`
      }
    }

    const pointCount = width * height || Math.floor(dataArray.length / pointStep)

    // 第一遍遍历：收集所有点的坐标值和 Intensity 值（用于 Axis 和 Intensity 颜色映射的范围计算）
    const axisValues: number[] = [] // 用于 Axis 模式的坐标值
    const intensityValues: number[] = []
    
    for (let i = 0; i < pointCount; i++) {
      const pointOffset = i * pointStep
      if (pointOffset + pointStep > dataArray.length) {
        break
      }

      const x = readFloat32(dataArray, pointOffset + xOffset)
      const y = readFloat32(dataArray, pointOffset + yOffset)
      const z = readFloat32(dataArray, pointOffset + zOffset)

      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        if (colorTransformer === 'Axis') {
          // 根据 axisColor 选择对应的坐标值
          if (axisColor === 'X') {
            axisValues.push(x)
          } else if (axisColor === 'Y') {
            axisValues.push(y)
          } else {
            axisValues.push(z) // 默认 Z
          }
        } else if (colorTransformer === 'Intensity' && intensityOffset >= 0 && autocomputeIntensityBounds) {
          const intensity = readFloat32(dataArray, pointOffset + intensityOffset)
          if (isFinite(intensity)) {
            intensityValues.push(intensity)
          }
        }
      }
    }

    // 计算轴坐标值的范围（用于 Axis 颜色映射）
    let axisMin = 0
    let axisMax = 1
    if (axisValues.length > 0) {
      axisMin = Math.min(...axisValues)
      axisMax = Math.max(...axisValues)
      if (axisMax === axisMin) {
        axisMax = axisMin + 1 // 避免除零
      }
    }

    // 计算 Intensity 值的范围（如果使用自动计算）
    let intensityMin = minIntensity
    let intensityMax = maxIntensity
    if (intensityValues.length > 0 && colorTransformer === 'Intensity') {
      if (minIntensity === 0 && maxIntensity === 1) {
        // 自动计算范围
        intensityMin = Math.min(...intensityValues)
        intensityMax = Math.max(...intensityValues)
        if (intensityMax === intensityMin) {
          intensityMax = intensityMin + 1 // 避免除零
        }
      }
    }

    // 第二遍遍历：处理所有点并计算颜色
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

      // 计算颜色（参照 RViz 实现）
      // PointCloud2 支持三种颜色转换模式：Intensity、Axis、Flat
      let color = defaultColor
      
      if (colorTransformer === 'Intensity' && intensityOffset >= 0) {
        // Intensity 模式：根据点的强度值（intensity 字段）映射颜色（常用于激光雷达）
        const intensity = readFloat32(dataArray, pointOffset + intensityOffset)
        // 归一化强度值到 [0, 1] 范围
        const normalizedIntensity = (intensity - intensityMin) / (intensityMax - intensityMin)
        const clampedIntensity = Math.max(0, Math.min(1, normalizedIntensity))
        
        if (useRainbow) {
          // Rainbow 模式：使用 HSV 颜色空间（0=blue, 1=red）
          const hue = (1.0 - clampedIntensity) * 240.0 / 360.0 // 反转：高值=红色，低值=蓝色
          const rgb = hslToRgb(hue, 1.0, 0.5)
          color = { ...rgb, a: alpha }
        } else {
          // 线性插值模式
          color = {
            r: (minColor.r + (maxColor.r - minColor.r) * clampedIntensity) / 255,
            g: (minColor.g + (maxColor.g - minColor.g) * clampedIntensity) / 255,
            b: (minColor.b + (maxColor.b - minColor.b) * clampedIntensity) / 255,
            a: alpha
          }
        }
      } else if (colorTransformer === 'Axis') {
        // Axis 模式：基于选定轴（X、Y 或 Z）的坐标值计算颜色（参照 RViz 实现）
        // 始终使用 rainbow 模式，产生红色→黄色→绿色的渐变效果
        let axisValue: number
        if (axisColor === 'X') {
          axisValue = x
        } else if (axisColor === 'Y') {
          axisValue = y
        } else {
          axisValue = z // 默认 Z
        }
        
        const normalizedAxis = (axisValue - axisMin) / (axisMax - axisMin)
        const clampedAxis = Math.max(0, Math.min(1, normalizedAxis))
        
        // 始终使用 Rainbow 模式：使用 HSV 颜色空间（参照 RViz：红色→黄色→绿色）
        // 低值=红色 (hue=0°), 高值=绿色 (hue=120°)
        // 这样会产生红色→黄色→绿色的渐变效果
        const hue = clampedAxis * 120.0 / 360.0 // 0.0 → 1/3 (红色到绿色)
        const rgb = hslToRgb(hue, 1.0, 0.5)
        color = { ...rgb, a: alpha }
      } else if (colorTransformer === 'Flat') {
        // Flat 模式：使用单一颜色（使用 defaultColor 或配置的颜色）
        color = defaultColor
      }
      // 如果 colorTransformer 不是上述任何一种，使用 defaultColor

      colors.push(color)
    }

    if (points.length === 0) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null
      }
    }

    // 点大小：直接使用配置值
    // 当 useWorldSpaceSize=true 时，size 应该是世界空间单位（米）
    // 当 useWorldSpaceSize=false 时，size 是像素值
    // 这里直接使用 size，由渲染层根据 useWorldSpaceSize 决定如何解释
    const pointSize = size
    
    // 应用 TF 变换（如果有 frameInfo）
    let pose = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    }
    
    // 检查 Transform 是否有效
    const frameInfo = request.frameInfo
    if (frameInfo && frameInfo.position && frameInfo.orientation) {
      // Transform 有效，应用 TF 变换
      pose = {
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
    } else if (frameInfo === null || (frameInfo && (!frameInfo.position || !frameInfo.orientation))) {
      // Transform 无效，返回 null 表示不应该渲染
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: 'Transform invalid: no valid transform from frame to fixed frame'
      }
    }
    
    return {
      type: 'pointCloud2Processed',
      componentId,
      data: {
        pose,
        points,
        colors: colors.length > 0 ? colors : undefined,
        color: colors.length === 0 ? defaultColor : undefined,
        scale: { x: pointSize, y: pointSize, z: pointSize }
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
      case 'processOdometry':
        response = processOdometry(request)
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
