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
    // const rowStep = message.row_step || 0 // 未使用，注释掉以避免 lint 警告
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

    // 性能优化：直接使用 DataView 读取，减少函数调用开销
    // 创建一次 DataView，在整个解析过程中复用（CPU 优化）
    let dataView: DataView | null = null

    // 转换数据数组为 Uint8Array（如果需要）
    // 支持 Uint8Array、Array、字符串（base64编码）
    // 内存优化：及时清理不需要的临时变量
    let dataArray: Uint8Array | null = null
    let base64Decoded: Uint8Array | null = null // 用于 base64 解码的临时变量
    
    try {
      if (data instanceof ArrayBuffer) {
        // ArrayBuffer：转换为 Uint8Array
        dataArray = new Uint8Array(data)
      } else if (data instanceof Uint8Array) {
        dataArray = data
      } else if (Array.isArray(data)) {
        dataArray = new Uint8Array(data)
      } else if (typeof data === 'string') {
        // Base64 解码（ROS 消息通过 JSON 序列化时，二进制数据会被编码为 base64 字符串）
        // 性能优化：使用更高效的 base64 解码方法
        try {
          const binaryString = atob(data)
          const len = binaryString.length
          base64Decoded = new Uint8Array(len)
          // 性能优化：批量处理，减少循环开销
          for (let i = 0; i < len; i++) {
            base64Decoded[i] = binaryString.charCodeAt(i)
          }
          dataArray = base64Decoded
          // 清理原始字符串引用（帮助 GC）
          // 注意：binaryString 会在作用域结束时自动清理，但显式清理可以更快
        } catch (error) {
          // 清理临时变量
          base64Decoded = null
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
      
      // 确保 dataArray 已成功创建
      if (!dataArray) {
        return {
          type: 'pointCloud2Processed',
          componentId,
          data: null,
          error: 'Failed to create data array'
        }
      }
      
      // 性能优化：创建 DataView 一次，在整个解析过程中复用
      // 使用 DataView 直接读取比手动拼接字节更快，减少计算量
      dataView = new DataView(dataArray.buffer, dataArray.byteOffset, dataArray.byteLength)
    } catch (error: any) {
      // 清理临时变量
      base64Decoded = null
      dataArray = null
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: `Error processing data: ${error?.message || 'Unknown error'}`
      }
    }

    const rawPointCount = width * height || Math.floor(dataArray.length / pointStep)
    const pointCount = rawPointCount
    
    // 预分配Float32Array，避免中间数组的内存开销
    // 每个点4个float：x, y, z, intensity
    // 内存优化：使用精确大小，避免浪费
    const pointDataArray = new Float32Array(pointCount * 4)
    
    // 用于范围计算的临时变量（单遍遍历时使用）
    let axisMin = Infinity
    let axisMax = -Infinity
    let intensityMin = Infinity
    let intensityMax = -Infinity
    let validPointCount = 0
    let hasAxisValues = false
    let hasIntensityValues = false

    // CPU 优化：预计算常用偏移量，避免重复计算
    const xOffsetFinal = xOffset
    const yOffsetFinal = yOffset
    const zOffsetFinal = zOffset
    const intensityOffsetFinal = intensityOffset
    const isAxisMode = colorTransformer === 'Axis'
    const isIntensityMode = colorTransformer === 'Intensity' && intensityOffsetFinal >= 0
    const needsIntensityBounds = autocomputeIntensityBounds && isIntensityMode

    // 单遍遍历：同时处理数据收集和范围计算（优化性能）
    // CPU 优化：减少条件判断，使用提前退出和批量处理
    const dataArrayLength = dataArray.length
    const maxOffset = dataArrayLength - pointStep
    
    // CPU 优化：批量处理，减少循环开销
    // 对于百万点云，循环本身的开销很大，需要优化循环体
    // 性能优化：使用 DataView 直接读取，比函数调用更快，减少计算量
    if (!dataView) {
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: 'DataView not initialized'
      }
    }
    
    let i = 0
    while (i < rawPointCount) {
      const pointOffset = i * pointStep
      
      // 提前检查边界，避免无效读取
      if (pointOffset > maxOffset) {
        break
      }

      // CPU 优化：使用 DataView 直接读取，减少函数调用开销和计算量
      // DataView.getFloat32 比手动拼接字节更快，浏览器优化过的函数
      const actualOffset = dataArray.byteOffset + pointOffset
      const x = dataView.getFloat32(actualOffset + xOffsetFinal, true) // true = little-endian
      const y = dataView.getFloat32(actualOffset + yOffsetFinal, true)
      const z = dataView.getFloat32(actualOffset + zOffsetFinal, true)

      // 跳过无效点（NaN 或 Infinity）
      // CPU 优化：使用 isFinite 检查（浏览器优化过的函数，比手动检查更快）
      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        // 计算范围（用于颜色映射）- 优化条件判断
        if (isAxisMode) {
          const selectedValue = axisColor === 'X' ? x : (axisColor === 'Y' ? y : z)
          if (selectedValue < axisMin) axisMin = selectedValue
          if (selectedValue > axisMax) axisMax = selectedValue
          hasAxisValues = true
        }

        // GPU端颜色映射：只传递原始数据，不计算颜色
        let intensityValue = 0.0
        
        if (isIntensityMode) {
          // CPU 优化：使用 DataView 直接读取
          intensityValue = dataView.getFloat32(actualOffset + intensityOffsetFinal, true)
          // CPU 优化：使用 isFinite 检查（浏览器优化过的函数）
          if (isFinite(intensityValue)) {
            // 同时计算intensity范围
            if (needsIntensityBounds) {
              if (intensityValue < intensityMin) intensityMin = intensityValue
              if (intensityValue > intensityMax) intensityMax = intensityValue
              hasIntensityValues = true
            }
          } else {
            intensityValue = 0.0
          }
        }

        // CPU 优化：直接写入预分配的Float32Array，批量写入减少数组访问次数
        const arrayIndex = validPointCount * 4
        pointDataArray[arrayIndex] = x
        pointDataArray[arrayIndex + 1] = y
        pointDataArray[arrayIndex + 2] = z
        pointDataArray[arrayIndex + 3] = intensityValue
        
        validPointCount++
      }
      
      i++
    }
    
    // 内存优化：清理临时变量引用（帮助 GC）
    // 注意：dataArray 和 dataView 在函数结束时会被清理，但显式清理可以更快
    dataView = null

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
    // 注意：slice 会创建新数组，原数组会被 GC 回收
    // 内存优化：及时清理不需要的大数组
    let finalPointDataArray: Float32Array
    if (processedPointCount < pointCount) {
      // 创建精确大小的新数组，原数组会被 GC 回收
      finalPointDataArray = pointDataArray.slice(0, processedPointCount * 4)
      // 显式清理原数组引用（虽然会在函数结束时自动清理，但显式清理可以更快）
      // 注意：不能直接设置为 null，因为 TypeScript 不允许，但可以确保不再使用
      // 通过创建新数组，原数组的引用计数会减少，帮助 GC 更快回收
    } else {
      finalPointDataArray = pointDataArray
    }
    
    // 内存优化：清理不再使用的临时变量引用
    // 这些变量在函数结束时会被自动清理，但显式清理可以更快触发 GC
    // 注意：base64Decoded 已经在前面清理，这里只清理其他引用

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
      // 清理临时数组引用
      return {
        type: 'pointCloud2Processed',
        componentId,
        data: null,
        error: 'Transform invalid: no valid transform from frame to fixed frame'
      }
    }
    
    // 构建返回对象
    const result: PointCloud2ProcessResult = {
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
    
    // 内存优化：清理不再使用的临时变量引用（在返回前清理，帮助 GC）
    // 这些变量在函数结束时会被自动清理，但显式清理可以更快触发 GC
    // 注意：finalPointDataArray 会被包含在 result 中，所以不能清理
    // 但可以清理其他不再使用的变量
    dataArray = null
    base64Decoded = null
    
    // 返回结果（临时变量会在函数结束时自动清理）
    return result
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
// 使用函数作用域确保每次处理都是独立的，避免闭包持有大量数据
self.onmessage = (event: MessageEvent<PointCloud2ProcessRequest>) => {
  // 立即提取 request，避免闭包持有 event 对象
  const request = event.data
  
  // 立即处理，避免持有 event 引用
  handlePointCloud2Request(request)
}

/**
 * 处理 PointCloud2 请求（独立函数，避免闭包内存泄漏）
 * 参照 rviz 和工业级优化方案：彻底清理所有引用，防止内存泄漏
 * 
 * 内存优化策略：
 * 1. 使用 Transferable Objects 传输大数据，避免序列化开销
 * 2. 传输后立即清理所有引用，帮助 GC 快速回收内存
 * 3. 在 finally 块中确保所有引用都被释放
 * 4. 避免在闭包中持有大量数据
 */
function handlePointCloud2Request(request: PointCloud2ProcessRequest): void {
  let response: PointCloud2ProcessResult | null = null
  let pointDataArray: Float32Array | null = null
  let arrayBuffer: ArrayBuffer | null = null
  
  try {
    if (request.type === 'processPointCloud2') {
      response = processPointCloud2(request)
      
      // 使用 Transferable Objects 优化大数据传输，避免序列化开销
      if (response.data?.pointData && response.data.pointData instanceof Float32Array) {
        // 保存 pointData 和 buffer 引用（在传输前）
        pointDataArray = response.data.pointData
        // 类型断言：pointDataArray 在这里已经被赋值，不会是 null
        const bufferLike = pointDataArray!.buffer
        
        // 确保 buffer 是 ArrayBuffer（不是 SharedArrayBuffer）
        // 类型检查：ArrayBufferLike 可能是 ArrayBuffer 或 SharedArrayBuffer
        if (bufferLike instanceof ArrayBuffer) {
          arrayBuffer = bufferLike
          // 创建 transferList（只包含 buffer）
          const transferList = [arrayBuffer]
          
          // 发送消息（buffer 会被传输到主线程，Worker 中的 buffer 会被清空）
          // 注意：传输后 pointDataArray.buffer 会被清空，但 pointDataArray 对象仍存在
          // CPU 优化：使用 postMessage 的 transferList 参数，避免数据复制
          ;(self.postMessage as any)(response, transferList)
          
          // 重要：传输后立即清理所有引用，帮助 GC 快速回收内存
          // 参照 rviz 实现：彻底清理所有引用，防止内存泄漏
          // 1. 清理 response 中的 pointData 引用（虽然 buffer 已被传输，但对象引用仍存在）
          if (response.data) {
            // 内存优化：显式清理大对象引用
            response.data.pointData = null as any
            // 注意：不需要删除 pointCount，它是一个小数字，不会造成内存泄漏
          }
          
          // 2. 清理局部变量引用（在传输后立即清理）
          pointDataArray = null
          arrayBuffer = null
          
          // 3. 清理整个 response 引用
          response = null
        } else {
          // 如果不是 ArrayBuffer（如 SharedArrayBuffer），使用普通序列化
          // 注意：这种情况很少见，但需要处理
          self.postMessage(response)
          response = null
          pointDataArray = null
          arrayBuffer = null
        }
      } else if (pointDataArray) {
        // pointDataArray 存在但不是 Float32Array，或 buffer 不是 ArrayBuffer
        // 使用普通序列化
        self.postMessage(response)
        response = null
        pointDataArray = null
        arrayBuffer = null
      } else {
        // 没有 pointData 或不是 Float32Array，直接发送
        self.postMessage(response)
        response = null
      }
    } else {
      // 未知请求类型
      const errorResponse: PointCloud2ProcessResult = {
        type: 'pointCloud2Processed',
        componentId: request.componentId || 'unknown',
        data: null,
        error: `Unknown request type: ${(request as any).type}`
      }
      self.postMessage(errorResponse)
    }
  } catch (error: any) {
    // 错误处理：确保即使出错也能发送响应并清理内存
    // 内存优化：在错误情况下也要清理所有引用
    const errorResponse: PointCloud2ProcessResult = {
      type: 'pointCloud2Processed',
      componentId: request?.componentId || 'unknown',
      data: null,
      error: error?.message || 'Unknown error in worker message handler'
    }
    self.postMessage(errorResponse)
    
    // 清理错误处理中的引用
    response = null
    pointDataArray = null
    arrayBuffer = null
  } finally {
    // 最终清理：确保所有引用都被释放（参照 rviz 的内存管理策略）
    // 这是防止内存泄漏的关键步骤
    // 内存优化：在 finally 块中清理，确保即使出错也能清理
    response = null
    pointDataArray = null
    arrayBuffer = null
    
    // 注意：不强制触发 GC，因为：
    // 1. gc() 不是标准 API，只在某些浏览器（如 Chrome with --js-flags=--expose-gc）中可用
    // 2. 现代浏览器的 GC 已经足够智能，不需要手动触发
    // 3. 手动触发 GC 可能会影响性能
  }
}
