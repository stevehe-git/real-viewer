<template>
  <BasePanel :title="panelTitle" :icon="Picture" :collapsible="true">
    <div class="image-viewer-container">
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
        <div v-if="imageInfo" class="image-info">
          <span>尺寸: {{ imageInfo.width }} × {{ imageInfo.height }}</span>
          <span v-if="imageInfo.encoding">编码: {{ imageInfo.encoding }}</span>
        </div>
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

const panelTitle = computed(() => {
  return props.componentName || '图像视图'
})

// 使用统一的话题订阅管理器
// 注意：camera 和 image 类型都使用 sensor_msgs/Image 消息类型
// TODO: 实现话题订阅功能
// const {
//   getLatestMessage
// } = useTopicSubscription(
//   props.componentId,
//   'camera', // 组件类型（camera 和 image 都使用相同的消息类型）
//   props.topic,
//   1 // 只保留最新的一帧
// )

// 临时实现
const getLatestMessage = () => null

// 重用 canvas 和 context，避免频繁创建 DOM 元素
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let currentBlobUrl: string | null = null

// 优化 base64 解码：使用更高效的方法
const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64)
  return Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
}

// 使用批量操作优化像素转换（避免双重循环）
const convertImageMessageToBlobURL = async (message: any): Promise<string> => {
  try {
    if (!message || !message.data) {
      return Promise.resolve('')
    }

    // 获取图像尺寸
    const width = message.width ?? 0
    const height = message.height ?? 0
    const encoding = message.encoding || 'rgb8'
    const step = message.step ?? (width * 3) // 默认每行字节数
    
    if (width === 0 || height === 0) {
      return Promise.resolve('')
    }

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
    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      ctx = canvas.getContext('2d', { willReadFrequently: false })
      if (!ctx) {
        return Promise.resolve('')
      }
    }

    // 确保 ctx 不为 null（TypeScript 类型检查）
    if (!ctx) {
      return Promise.resolve('')
    }

    // 重用 ImageData 对象
    const imageData = ctx.createImageData(width, height)
    const dstData = imageData.data
    const pixelCount = width * height
    
    // 优化：使用单层循环和批量操作，减少数组访问次数
    if (encoding === 'rgb8' || encoding === 'bgr8') {
      // RGB/BGR 格式，每像素 3 字节
      const isBGR = encoding === 'bgr8'
      for (let i = 0; i < pixelCount; i++) {
        const y = Math.floor(i / width)
        const x = i % width
        const srcIndex = y * step + x * 3
        
        if (srcIndex + 2 < data.length) {
          const dstIndex = i * 4
          if (isBGR) {
            dstData[dstIndex] = data[srcIndex + 2] ?? 0     // R
            dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = data[srcIndex] ?? 0     // B
          } else {
            dstData[dstIndex] = data[srcIndex] ?? 0         // R
            dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = data[srcIndex + 2] ?? 0 // B
          }
          dstData[dstIndex + 3] = 255 // Alpha
        }
      }
    } else if (encoding === 'rgba8' || encoding === 'bgra8') {
      // RGBA/BGRA 格式，每像素 4 字节
      const isBGRA = encoding === 'bgra8'
      for (let i = 0; i < pixelCount; i++) {
        const y = Math.floor(i / width)
        const x = i % width
        const srcIndex = y * step + x * 4
        
        if (srcIndex + 3 < data.length) {
          const dstIndex = i * 4
          if (isBGRA) {
            dstData[dstIndex] = data[srcIndex + 2] ?? 0     // R
            dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = data[srcIndex] ?? 0     // B
            dstData[dstIndex + 3] = data[srcIndex + 3] ?? 0 // A
          } else {
            dstData[dstIndex] = data[srcIndex] ?? 0         // R
            dstData[dstIndex + 1] = data[srcIndex + 1] ?? 0 // G
            dstData[dstIndex + 2] = data[srcIndex + 2] ?? 0 // B
            dstData[dstIndex + 3] = data[srcIndex + 3] ?? 0 // A
          }
        }
      }
    } else if (encoding === 'mono8') {
      // 灰度图像，每像素 1 字节 - 优化：批量复制
      for (let i = 0; i < pixelCount; i++) {
        const y = Math.floor(i / width)
        const x = i % width
        const srcIndex = y * step + x
        
        if (srcIndex < data.length) {
          const dstIndex = i * 4
          const gray = data[srcIndex] ?? 0
          dstData[dstIndex] = gray
          dstData[dstIndex + 1] = gray
          dstData[dstIndex + 2] = gray
          dstData[dstIndex + 3] = 255
        }
      }
    } else {
      console.warn(`Unsupported image encoding: ${encoding}`)
      return Promise.resolve('')
    }

    ctx.putImageData(imageData, 0, 0)
    imageInfo.value = { width, height, encoding }
    
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

// 节流更新图像（使用 requestAnimationFrame 优化，避免CPU过高）
let rafId: number | null = null
let pendingMessage: any = null
let isProcessing = false

// 监听最新消息，转换为图像URL（使用节流和 requestAnimationFrame）
watch(() => getLatestMessage(), (message) => {
  // 保存最新消息
  pendingMessage = message
  
  // 如果正在处理或已有待处理的更新，跳过
  if (isProcessing || rafId !== null) {
    return
  }
  
  // 使用 requestAnimationFrame 优化更新时机，与浏览器渲染同步
  rafId = requestAnimationFrame(async () => {
    const msg = pendingMessage
    rafId = null
    
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
  
  // 清理 canvas 引用
  canvas = null
  ctx = null
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

.image-info {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
</style>