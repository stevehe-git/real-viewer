<template>
  <BasePanel :title="panelTitle" :icon="Picture" :collapsible="true">
    <div ref="containerRef" class="image-viewer-container">
      <div v-if="!imageUrl" class="image-placeholder">
        <el-icon class="placeholder-icon"><Picture /></el-icon>
        <p class="placeholder-text">等待图像数据...</p>
        <p v-if="topic" class="topic-text">Topic: {{ topic }}</p>
      </div>
      <div v-else class="image-display">
        <img 
          :src="imageUrl" 
          alt="Camera/Image View"
          class="image-content"
          @error="handleImageError"
        />
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { Picture } from '@element-plus/icons-vue'
// import { useTopicSubscription } from '@/composables/useTopicSubscription'
// TODO: 实现话题订阅功能
import BasePanel from '../../../BasePanel.vue'

interface Props {
  componentId: string
  componentName: string
  topic?: string
}

const props = defineProps<Props>()

const imageUrl = ref<string>('')
const imageInfo = ref<{ width: number; height: number; encoding?: string } | null>(null)
const containerRef = ref<HTMLElement | null>(null)

const panelTitle = computed(() => {
  return props.componentName || '图像视图'
})

// 使用统一的话题订阅管理器
// 注意：camera 和 image 类型都使用 sensor_msgs/Image 消息类型
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'

// 获取最新消息（响应式）
const getLatestMessage = computed(() => {
  // 访问状态更新触发器以确保响应式追踪
  const trigger = topicSubscriptionManager.getStatusUpdateTrigger()
  trigger.value
  return topicSubscriptionManager.getLatestMessage(props.componentId)
})

// 性能优化配置
const TARGET_FPS = 25 // 目标帧率
const MIN_FRAME_INTERVAL = 1000 / TARGET_FPS // 最小帧间隔（ms）
const MAX_DISPLAY_WIDTH = 1920 // 最大显示宽度
const MAX_DISPLAY_HEIGHT = 1080 // 最大显示高度
const QUALITY_FACTOR = 1.2 // 质量因子（1.0 = 精确匹配，>1.0 = 稍高分辨率以提升质量）

// 重用 canvas 和 context，避免频繁创建 DOM 元素
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let currentBlobUrl: string | null = null
let cachedImageData: ImageData | null = null // 重用 ImageData 对象

// 优化 base64 解码：使用更高效的方法
const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64)
  return Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
}

// 计算目标分辨率（根据显示容器尺寸）
const calculateTargetSize = (originalWidth: number, originalHeight: number): { width: number; height: number; scale: number } => {
  if (!containerRef.value) {
    // 如果容器未准备好，使用默认最大尺寸
    const scale = Math.min(MAX_DISPLAY_WIDTH / originalWidth, MAX_DISPLAY_HEIGHT / originalHeight, 1.0)
    return {
      width: Math.floor(originalWidth * scale * QUALITY_FACTOR),
      height: Math.floor(originalHeight * scale * QUALITY_FACTOR),
      scale
    }
  }
  
  const container = containerRef.value
  const containerWidth = container.clientWidth || MAX_DISPLAY_WIDTH
  const containerHeight = container.clientHeight || MAX_DISPLAY_HEIGHT
  
  // 计算缩放比例，确保图像适合容器
  const scaleX = containerWidth / originalWidth
  const scaleY = containerHeight / originalHeight
  const scale = Math.min(scaleX, scaleY, 1.0) * QUALITY_FACTOR // 乘以质量因子以提升显示质量
  
  // 限制最大分辨率
  const targetWidth = Math.min(Math.floor(originalWidth * scale), MAX_DISPLAY_WIDTH)
  const targetHeight = Math.min(Math.floor(originalHeight * scale), MAX_DISPLAY_HEIGHT)
  
  return { width: targetWidth, height: targetHeight, scale }
}

// 优化的像素转换函数（使用双层循环，减少计算）
const convertPixelsOptimized = (
  srcData: Uint8Array,
  dstData: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  encoding: string,
  step: number
): void => {
  const scaleX = srcWidth / dstWidth
  const scaleY = srcHeight / dstHeight
  
  // 优化：使用双层循环，避免重复计算 Math.floor(i / width) 和 i % width
  if (encoding === 'rgb8' || encoding === 'bgr8') {
    const isBGR = encoding === 'bgr8'
    const bytesPerPixel = 3
    for (let dstY = 0; dstY < dstHeight; dstY++) {
      const srcY = Math.floor(dstY * scaleY)
      const srcRowStart = srcY * step
      const dstRowStart = dstY * dstWidth * 4
      
      for (let dstX = 0; dstX < dstWidth; dstX++) {
        const srcX = Math.floor(dstX * scaleX)
        const srcIndex = srcRowStart + srcX * bytesPerPixel
        const dstIndex = dstRowStart + dstX * 4
        
        if (srcIndex + 2 < srcData.length) {
          if (isBGR) {
            dstData[dstIndex] = srcData[srcIndex + 2] ?? 0     // R
            dstData[dstIndex + 1] = srcData[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = srcData[srcIndex] ?? 0     // B
          } else {
            dstData[dstIndex] = srcData[srcIndex] ?? 0         // R
            dstData[dstIndex + 1] = srcData[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = srcData[srcIndex + 2] ?? 0 // B
          }
          dstData[dstIndex + 3] = 255 // Alpha
        }
      }
    }
  } else if (encoding === 'rgba8' || encoding === 'bgra8') {
    const isBGRA = encoding === 'bgra8'
    const bytesPerPixel = 4
    for (let dstY = 0; dstY < dstHeight; dstY++) {
      const srcY = Math.floor(dstY * scaleY)
      const srcRowStart = srcY * step
      const dstRowStart = dstY * dstWidth * 4
      
      for (let dstX = 0; dstX < dstWidth; dstX++) {
        const srcX = Math.floor(dstX * scaleX)
        const srcIndex = srcRowStart + srcX * bytesPerPixel
        const dstIndex = dstRowStart + dstX * 4
        
        if (srcIndex + 3 < srcData.length) {
          if (isBGRA) {
            dstData[dstIndex] = srcData[srcIndex + 2] ?? 0     // R
            dstData[dstIndex + 1] = srcData[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = srcData[srcIndex] ?? 0     // B
            dstData[dstIndex + 3] = srcData[srcIndex + 3] ?? 0 // A
          } else {
            dstData[dstIndex] = srcData[srcIndex] ?? 0         // R
            dstData[dstIndex + 1] = srcData[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = srcData[srcIndex + 2] ?? 0 // B
            dstData[dstIndex + 3] = srcData[srcIndex + 3] ?? 0 // A
          }
        }
      }
    }
  } else if (encoding === 'mono8') {
    const bytesPerPixel = 1
    for (let dstY = 0; dstY < dstHeight; dstY++) {
      const srcY = Math.floor(dstY * scaleY)
      const srcRowStart = srcY * step
      const dstRowStart = dstY * dstWidth * 4
      
      for (let dstX = 0; dstX < dstWidth; dstX++) {
        const srcX = Math.floor(dstX * scaleX)
        const srcIndex = srcRowStart + srcX * bytesPerPixel
        const dstIndex = dstRowStart + dstX * 4
        
        if (srcIndex < srcData.length) {
          const gray = srcData[srcIndex] ?? 0
          dstData[dstIndex] = gray
          dstData[dstIndex + 1] = gray
          dstData[dstIndex + 2] = gray
          dstData[dstIndex + 3] = 255
        }
      }
    }
  }
}

// 使用批量操作优化像素转换（支持降采样）
const convertImageMessageToBlobURL = async (message: any): Promise<string> => {
  try {
    if (!message || !message.data) {
      return Promise.resolve('')
    }

    // 获取原始图像尺寸
    const originalWidth = message.width ?? 0
    const originalHeight = message.height ?? 0
    const encoding = message.encoding || 'rgb8'
    const step = message.step ?? (originalWidth * 3) // 默认每行字节数
    
    if (originalWidth === 0 || originalHeight === 0) {
      return Promise.resolve('')
    }

    // 计算目标分辨率（降采样）
    const { width: targetWidth, height: targetHeight } = calculateTargetSize(originalWidth, originalHeight)

    // 处理 data 字段（可能是 Uint8Array 或 base64 字符串）
    let data: Uint8Array
    if (typeof message.data === 'string') {
      // 优化：使用更高效的 base64 解码
      try {
        data = decodeBase64ToUint8Array(message.data)
      } catch (e) {
        console.error('Failed to decode base64 image data:', e)
        return Promise.resolve('')
      }
    } else if (message.data instanceof Uint8Array) {
      data = message.data
    } else if (Array.isArray(message.data)) {
      data = new Uint8Array(message.data)
    } else {
      console.error('Unsupported image data type:', typeof message.data)
      return Promise.resolve('')
    }

    if (data.length === 0) {
      return Promise.resolve('')
    }

    // 重用 canvas 和 context，避免频繁创建
    if (!canvas || canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      ctx = canvas.getContext('2d', { willReadFrequently: false })
      if (!ctx) {
        return Promise.resolve('')
      }
      // 重置缓存的 ImageData
      cachedImageData = null
    }

    // 确保 ctx 不为 null（TypeScript 类型检查）
    if (!ctx) {
      return Promise.resolve('')
    }

    // 重用或创建 ImageData 对象
    if (!cachedImageData || cachedImageData.width !== targetWidth || cachedImageData.height !== targetHeight) {
      cachedImageData = ctx.createImageData(targetWidth, targetHeight)
    }
    
    const dstData = cachedImageData.data
    
    // 使用优化的像素转换函数（支持降采样）
    // 降采样：从原始图像采样到目标尺寸
    convertPixelsOptimized(data, dstData, originalWidth, originalHeight, targetWidth, targetHeight, encoding, step)

    ctx.putImageData(cachedImageData, 0, 0)
    imageInfo.value = { width: targetWidth, height: targetHeight, encoding }
    
    // 使用 Blob URL 替代 Data URL，性能更好
    return new Promise<string>((resolve) => {
      canvas!.toBlob((blob) => {
        if (blob) {
          // 释放旧的 Blob URL
          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
          }
          const blobUrl = URL.createObjectURL(blob)
          currentBlobUrl = blobUrl
          resolve(blobUrl)
        } else {
          resolve('')
        }
      }, 'image/png')
    })
  } catch (error) {
    console.error('Error converting image message:', error)
    return Promise.resolve('')
  }
}

// 帧率限制和节流更新图像（使用 requestAnimationFrame 优化，避免CPU过高）
let rafId: number | null = null
let pendingMessage: any = null
let isProcessing = false
let lastProcessTime = 0 // 上次处理时间戳

// 监听最新消息，转换为图像URL（使用帧率限制和 requestAnimationFrame）
watch(() => getLatestMessage.value, (message) => {
  // 保存最新消息（总是保存最新的，实现跳帧策略）
  pendingMessage = message
  
  // 如果正在处理，跳过（跳帧策略：只处理最新消息）
  if (isProcessing) {
    return
  }
  
  // 帧率限制：检查是否达到最小帧间隔
  const now = performance.now()
  const timeSinceLastFrame = now - lastProcessTime
  if (timeSinceLastFrame < MIN_FRAME_INTERVAL && rafId !== null) {
    return // 跳过此帧，保持目标帧率
  }
  
  // 如果已有待处理的更新，取消它（跳帧策略）
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 使用 requestAnimationFrame 优化更新时机，与浏览器渲染同步
  rafId = requestAnimationFrame(async () => {
    const msg = pendingMessage
    rafId = null
    lastProcessTime = performance.now()
    
    if (msg) {
      isProcessing = true
      try {
        const blobUrl = await convertImageMessageToBlobURL(msg)
        if (blobUrl) {
          imageUrl.value = blobUrl
        } else {
          imageUrl.value = ''
          imageInfo.value = null
        }
      } catch (error) {
        console.error('Error processing image:', error)
        imageUrl.value = ''
        imageInfo.value = null
      } finally {
        isProcessing = false
        pendingMessage = null
      }
    } else {
      imageUrl.value = ''
      imageInfo.value = null
      pendingMessage = null
    }
  })
}, { immediate: true })

const handleImageError = () => {
  console.error('Failed to load image')
  imageUrl.value = ''
}

// 清理资源
onUnmounted(() => {
  // 取消待处理的动画帧
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 释放 Blob URL
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }
  
  // 清理 canvas 和 ImageData 引用
  canvas = null
  ctx = null
  cachedImageData = null
})
</script>

<style scoped>
.image-viewer-container {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  padding: 20px;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.placeholder-text {
  margin: 8px 0;
  font-size: 14px;
}

.topic-text {
  margin: 4px 0;
  font-size: 12px;
  color: #606266;
}

.image-display {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.image-content {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

</style>