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
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { Picture } from '@element-plus/icons-vue'
// import { useTopicSubscription } from '@/composables/useTopicSubscription'
// TODO: 实现话题订阅功能
import BasePanel from '../../../BasePanel.vue'
import { getDataProcessorWorker } from '@/workers/dataProcessorWorker'
import type { ImageProcessRequest } from '@/workers/dataProcessor.worker'

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

// 重用 ImageBitmap，避免频繁创建 DOM 元素
let currentBlobUrl: string | null = null
let currentImageBitmap: ImageBitmap | null = null

// 当前处理的请求 ID（用于取消过时的请求）
let currentRequestId = 0

// 可见性检测
let isVisible = true
let intersectionObserver: IntersectionObserver | null = null

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

// 将 ImageData 转换为 Blob URL（使用 ImageBitmap 优化性能）
const imageDataToBlobURL = async (imageData: ImageData): Promise<string> => {
  try {
    // 使用 ImageBitmap API（更高效，GPU 加速）
    if (typeof createImageBitmap !== 'undefined') {
      // 释放旧的 ImageBitmap
      if (currentImageBitmap) {
        currentImageBitmap.close()
        currentImageBitmap = null
      }
      
      const imageBitmap = await createImageBitmap(imageData)
      currentImageBitmap = imageBitmap
      
      // 创建 canvas 用于转换为 Blob
      const canvas = new OffscreenCanvas(imageData.width, imageData.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        imageBitmap.close()
        return ''
      }
      
      ctx.drawImage(imageBitmap, 0, 0)
      
      // 转换为 Blob URL
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      
      // 释放旧的 Blob URL
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
      
      const blobUrl = URL.createObjectURL(blob)
      currentBlobUrl = blobUrl
      return blobUrl
    } else {
      // 回退到 Canvas API（兼容性方案）
      const canvas = document.createElement('canvas')
      canvas.width = imageData.width
      canvas.height = imageData.height
      const ctx = canvas.getContext('2d', { willReadFrequently: false })
      if (!ctx) {
        return ''
      }
      
      ctx.putImageData(imageData, 0, 0)
      
      return new Promise<string>((resolve) => {
        canvas.toBlob((blob) => {
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
    }
  } catch (error) {
    console.error('Error converting ImageData to Blob URL:', error)
    return ''
  }
}

// 使用 Web Worker 处理图像转换（耗时操作在 Worker 中完成）
const convertImageMessageToBlobURL = async (message: any, requestId: number): Promise<string> => {
  try {
    if (!message || !message.data) {
      return Promise.resolve('')
    }

    // 获取原始图像尺寸
    const originalWidth = message.width ?? 0
    const originalHeight = message.height ?? 0
    const encoding = message.encoding || 'rgb8'
    
    if (originalWidth === 0 || originalHeight === 0) {
      return Promise.resolve('')
    }

    // 计算目标分辨率（降采样）
    const { width: targetWidth, height: targetHeight } = calculateTargetSize(originalWidth, originalHeight)

    // 使用 Web Worker 处理图像（耗时操作：base64 解码和像素转换）
    const worker = getDataProcessorWorker()
    const request: ImageProcessRequest = {
      type: 'processImage',
      message,
      targetWidth,
      targetHeight
    }

    // 传递 requestId，用于取消过时的请求
    const requestIdStr = `image_${props.componentId}_${requestId}`
    const result = await worker.processImage(request, requestIdStr)

    // 检查请求是否已被取消（过时的请求）
    if (requestId !== currentRequestId) {
      return Promise.resolve('')
    }

    if (result.error || !result.imageData) {
      console.error('Failed to process image in worker:', result.error)
      return Promise.resolve('')
    }

    // 更新图像信息
    imageInfo.value = { width: targetWidth, height: targetHeight, encoding }

    // 在主线程中将 ImageData 转换为 Blob URL（快速操作）
    return await imageDataToBlobURL(result.imageData)
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
  // 如果面板不可见，跳过处理
  if (!isVisible) {
    pendingMessage = message // 保存最新消息，但暂不处理
    return
  }
  
  // 保存最新消息（总是保存最新的，实现跳帧策略）
  pendingMessage = message
  
  // 如果正在处理，跳过（跳帧策略：只处理最新消息）
  if (isProcessing) {
    return
  }
  
  const now = performance.now()
  
  // 改进的帧率限制：检查是否达到最小帧间隔
  const timeSinceLastFrame = now - lastProcessTime
  if (timeSinceLastFrame < MIN_FRAME_INTERVAL) {
    // 如果已有待处理的更新，取消它（跳帧策略）
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    
    // 延迟调度，确保帧率限制
    rafId = requestAnimationFrame(() => {
      // 再次检查时间间隔
      const currentTime = performance.now()
      if (currentTime - lastProcessTime >= MIN_FRAME_INTERVAL) {
        scheduleImageProcessing()
      } else {
        // 如果还不够时间，再次延迟
        const remainingDelay = MIN_FRAME_INTERVAL - (currentTime - lastProcessTime)
        rafId = window.setTimeout(() => {
          scheduleImageProcessing()
        }, remainingDelay) as unknown as number
      }
    })
    return
  }
  
  // 如果已有待处理的更新，取消它（跳帧策略）
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 立即调度处理
  scheduleImageProcessing()
}, { immediate: true })

// 调度图像处理（统一入口）
function scheduleImageProcessing() {
  if (!isVisible || isProcessing) {
    return
  }
  
  const msg = pendingMessage
  if (!msg) {
    return
  }
  
  // 生成新的请求 ID（用于取消过时的请求）
  currentRequestId++
  const requestId = currentRequestId
  
  // 使用 requestAnimationFrame 优化更新时机，与浏览器渲染同步
  rafId = requestAnimationFrame(async () => {
    rafId = null
    lastProcessTime = performance.now()
    
    if (!isVisible) {
      return // 如果变为不可见，跳过处理
    }
    
    if (msg !== pendingMessage) {
      // 如果消息已更新，跳过这个过时的消息
      scheduleImageProcessing() // 重新调度处理最新消息
      return
    }
    
    isProcessing = true
    try {
      // 使用 Web Worker 处理图像（耗时操作在 Worker 中完成）
      const blobUrl = await convertImageMessageToBlobURL(msg, requestId)
      
      // 检查请求是否已被取消（过时的请求）且面板仍然可见
      if (requestId === currentRequestId && blobUrl && isVisible) {
        imageUrl.value = blobUrl
      } else if (requestId === currentRequestId) {
        imageUrl.value = ''
        imageInfo.value = null
      }
    } catch (error) {
      console.error('Error processing image:', error)
      if (requestId === currentRequestId) {
        imageUrl.value = ''
        imageInfo.value = null
      }
    } finally {
      isProcessing = false
      pendingMessage = null
    }
  })
}

const handleImageError = () => {
  console.error('Failed to load image')
  imageUrl.value = ''
}

// 设置可见性检测
const setupVisibilityObserver = () => {
  if (!containerRef.value || typeof IntersectionObserver === 'undefined') {
    return
  }
  
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting && entry.intersectionRatio > 0
        // 如果变为可见且有待处理的消息，立即处理
        if (isVisible && pendingMessage && !isProcessing) {
          scheduleImageProcessing()
        }
      })
    },
    {
      threshold: 0.01 // 至少 1% 可见才认为可见
    }
  )
  
  intersectionObserver.observe(containerRef.value)
}

// 清理资源
onUnmounted(() => {
  // 取消可见性观察器
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
  
  // 取消待处理的动画帧
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 释放 ImageBitmap
  if (currentImageBitmap) {
    currentImageBitmap.close()
    currentImageBitmap = null
  }
  
  // 释放 Blob URL
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }
})

// 在组件挂载后设置可见性检测
onMounted(() => {
  nextTick(() => {
    setupVisibilityObserver()
  })
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