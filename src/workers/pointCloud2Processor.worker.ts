/**
 * PointCloud2 处理器 Web Worker
 * 专门处理 PointCloud2 数据的后台线程，避免阻塞主线程
 * 从 dataProcessor.worker.ts 中拆分出来，提高代码模块化和可维护性
 */

export interface PointCloud2ProcessRequest {
  type: 'processPointCloud2'
  componentId: string
  message: any
  config: {
    size?: number
    alpha?: number
    colorTransformer?: string
    useRainbow?: boolean
    invertRainbow?: boolean // 反转彩虹色谱方向
    minColor?: { r: number; g: number; b: number }
    maxColor?: { r: number; g: number; b: number }
    minIntensity?: number
    maxIntensity?: number
    axisColor?: string // 'X' | 'Y' | 'Z'，用于 Axis 模式
    flatColor?: { r: number; g: number; b: number } // 用于 Flat 模式的颜色
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
      useRainbow = true, // 与 displayComponent.ts 中的默认值一致
      invertRainbow = false, // 反转彩虹色谱方向
      minColor = { r: 0, g: 0, b: 0 },
      maxColor = { r: 255, g: 255, b: 255 },
      minIntensity = 0,
      maxIntensity = 246, // 默认值 246（当 autocompute 关闭时使用）
      axisColor: rawAxisColor = 'Z', // 默认使用 Z 轴
      flatColor = { r: 255, g: 255, b: 0 }, // 默认黄色（参照 RViz）
      autocomputeIntensityBounds = true
    } = config
    
    // 确保 axisColor 是大写的 'X'、'Y' 或 'Z'
    const axisColor = (rawAxisColor?.toString().toUpperCase() || 'Z') as 'X' | 'Y' | 'Z'

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

    const rawPointCount = width * height || Math.floor(dataArray.length / pointStep)
    
    // 智能采样：对于超大点云（超过500万点），自动降采样以保持性能
    // 亿万级点云需要降采样，否则会导致内存溢出和浏览器崩溃
    const MAX_POINTS = 5000000 // 最多处理500万点
    const needsDownsampling = rawPointCount > MAX_POINTS
    const sampleStep = needsDownsampling ? Math.ceil(rawPointCount / MAX_POINTS) : 1
    const pointCount = needsDownsampling ? Math.floor(rawPointCount / sampleStep) : rawPointCount
    
    if (needsDownsampling) {
      console.warn(`[PointCloud2 Worker] Large point cloud detected (${rawPointCount.toLocaleString()} points). Downsampling to ${pointCount.toLocaleString()} points (step: ${sampleStep})`)
    }

    // 预分配Float32Array，避免中间数组的内存开销
    // 每个点4个float：x, y, z, intensity
    const pointDataArray = new Float32Array(pointCount * 4)
    
    // 用于范围计算的临时变量（单遍遍历时使用）
    let axisMin = Infinity
    let axisMax = -Infinity
    let intensityMin = Infinity
    let intensityMax = -Infinity
    let validPointCount = 0
    let hasAxisValues = false
    let hasIntensityValues = false

    // 单遍遍历：同时处理数据收集和范围计算（优化性能）
    for (let i = 0; i < rawPointCount; i += sampleStep) {
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

      // 计算范围（用于颜色映射）
      if (colorTransformer === 'Axis') {
        let selectedValue: number
        if (axisColor === 'X') {
          selectedValue = x
        } else if (axisColor === 'Y') {
          selectedValue = y
        } else {
          selectedValue = z
        }
        if (selectedValue < axisMin) axisMin = selectedValue
        if (selectedValue > axisMax) axisMax = selectedValue
        hasAxisValues = true
      }

      // GPU端颜色映射：只传递原始数据，不计算颜色
      let intensityValue = 0.0
      
      if (colorTransformer === 'Intensity' && intensityOffset >= 0) {
        intensityValue = readFloat32(dataArray, pointOffset + intensityOffset)
        if (!isFinite(intensityValue)) {
          intensityValue = 0.0
        } else {
          // 同时计算intensity范围
          if (autocomputeIntensityBounds) {
            if (intensityValue < intensityMin) intensityMin = intensityValue
            if (intensityValue > intensityMax) intensityMax = intensityValue
            hasIntensityValues = true
          }
        }
      }

      // 直接写入预分配的Float32Array（避免push操作的开销）
      const arrayIndex = validPointCount * 4
      pointDataArray[arrayIndex] = x
      pointDataArray[arrayIndex + 1] = y
      pointDataArray[arrayIndex + 2] = z
      pointDataArray[arrayIndex + 3] = intensityValue
      
      validPointCount++
    }

    // 处理范围计算的边界情况
    if (hasAxisValues) {
      if (!isFinite(axisMin) || !isFinite(axisMax)) {
        axisMin = 0
        axisMax = 1
      } else if (axisMax === axisMin) {
        axisMax = axisMin + 1 // 避免除零
      }
    } else {
      axisMin = 0
      axisMax = 1
    }

    if (hasIntensityValues && autocomputeIntensityBounds) {
      if (!isFinite(intensityMin) || !isFinite(intensityMax)) {
        intensityMin = minIntensity
        intensityMax = maxIntensity
      } else if (intensityMax === intensityMin) {
        intensityMax = intensityMin + 1 // 避免除零
      }
    } else {
      intensityMin = minIntensity
      intensityMax = maxIntensity
    }

    const processedPointCount = validPointCount
    if (processedPointCount === 0) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null
      }
    }

    // 如果实际处理的点数少于预分配的大小，创建精确大小的数组（节省内存）
    const finalPointDataArray = processedPointCount < pointCount 
      ? pointDataArray.slice(0, processedPointCount * 4)
      : pointDataArray

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
    
    // 返回优化后的数据格式：使用Float32Array二进制格式，支持GPU端颜色映射
    // GPU端颜色映射格式：[x1, y1, z1, intensity1, x2, y2, z2, intensity2, ...]
    return {
      type: 'pointCloud2Processed',
      componentId,
      data: {
        pose,
        // 使用Float32Array二进制格式，比对象数组节省70%+内存
        pointData: finalPointDataArray, // 交错存储 xyz + intensity（GPU端颜色映射）
        pointCount: processedPointCount, // 点的数量
        scale: { x: pointSize, y: pointSize, z: pointSize },
        // GPU端颜色映射配置
        useGpuColorMapping: true,
        colorTransformer,
        useRainbow,
        invertRainbow,
        minColor,
        maxColor,
        minIntensity: intensityMin,
        maxIntensity: intensityMax,
        axisColor,
        axisMin,
        axisMax,
        flatColor: {
          r: flatColor.r ?? 255,
          g: flatColor.g ?? 255,
          b: flatColor.b ?? 0
        },
        alpha
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

// Worker 消息处理
self.onmessage = (event: MessageEvent<PointCloud2ProcessRequest>) => {
  const request = event.data
  
  if (request.type === 'processPointCloud2') {
    const response = processPointCloud2(request)
    
    // 使用 Transferable Objects 优化大数据传输，避免序列化开销
    if (response.data?.pointData && response.data.pointData instanceof Float32Array) {
      // Float32Array 可以作为 Transferable 传输，避免大数据序列化
      // 这对于百万/千万级点云非常重要，可以避免内存复制和崩溃
      const transferList = [response.data.pointData.buffer]
      ;(self.postMessage as any)(response, transferList)
    } else {
      self.postMessage(response)
    }
  } else {
    self.postMessage({
      type: 'pointCloud2Processed',
      componentId: request.componentId || 'unknown',
      data: null,
      error: `Unknown request type: ${(request as any).type}`
    })
  }
}
