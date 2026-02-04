<template>
  <div class="rviz-viewer">
    <div ref="containerRef" class="viewer-container">
      <canvas ref="canvasRef" class="viewer-canvas"></canvas>
      <div class="viewer-info">
        <div class="info-item">
          <span>鼠标左键拖拽：旋转</span>
        </div>
        <div class="info-item">
          <span>鼠标中键拖拽：平移</span>
        </div>
        <div class="info-item">
          <span>滚轮：缩放</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Worldview } from './core/Worldview'
import { SceneManager } from './core/SceneManager'
import { WorldviewCameraController } from './camera/WorldviewCameraController'
import type { PointCloudData, PathData, RenderOptions, Dimensions } from './types'
import { DEFAULT_CAMERA_STATE } from './camera'

interface Props {
  width?: number
  height?: number
  options?: RenderOptions
  pointCloud?: PointCloudData
  paths?: PathData[]
}

const props = withDefaults(defineProps<Props>(), {
  width: 800,
  height: 600,
  options: () => ({}),
  pointCloud: undefined,
  paths: () => []
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const worldview = ref<Worldview | null>(null)
const sceneManager = ref<SceneManager | null>(null)
const cameraController = ref<WorldviewCameraController | null>(null)
const gridVisible = ref(props.options?.enableGrid ?? true)
const axesVisible = ref(props.options?.enableAxes ?? true)
let resizeObserver: ResizeObserver | null = null
// 用于节流滚轮事件的动画帧请求
let wheelFrame: number | null = null

// 初始化
onMounted(async () => {
  await nextTick()
  if (!canvasRef.value) return

  const canvas = canvasRef.value
  const dimension: Dimensions = {
    width: props.width || canvas.clientWidth || 800,
    height: props.height || canvas.clientHeight || 600,
    left: 0,
    top: 0
  }

  // 设置画布尺寸
  canvas.width = dimension.width
  canvas.height = dimension.height

  // 初始化 Worldview（完全基于 regl-worldview）
  worldview.value = new Worldview({
    dimension,
    canvasBackgroundColor: props.options?.clearColor || [0.2, 0.2, 0.2, 1.0],
    defaultCameraState: DEFAULT_CAMERA_STATE,
    contextAttributes: {
      antialias: true,
      depth: true,
      stencil: false,
      alpha: true
    }
  })

  // 初始化 regl 上下文
  worldview.value.initialize(canvas)

  // 初始化场景管理器
  const reglContext = worldview.value.getContext().initializedData?.regl
  if (reglContext) {
    sceneManager.value = new SceneManager(reglContext, worldview.value.getContext(), props.options)
  }

  // 初始化相机控制器（使用 WorldviewContext 的 CameraStore）
  // 注意：WorldviewContext 的 CameraStore 回调会自动触发渲染
  const worldviewCameraStore = worldview.value.getContext().cameraStore
  cameraController.value = new WorldviewCameraController(worldviewCameraStore)
  cameraController.value.setCanvas(canvas)

  // 设置初始数据
  if (props.pointCloud && sceneManager.value) {
    sceneManager.value.updatePointCloud(props.pointCloud, 'default-pointcloud')
  }

  props.paths.forEach((path) => {
    sceneManager.value?.addPath(path)
  })

  // 设置事件监听
  setupEventListeners()

  // 设置容器尺寸监听（需要等待容器 ref 可用）
  await nextTick()
  setupResizeObserver()

  // 初始渲染（通过 markDirty 触发，遵守帧率限制）
  worldview.value.markDirty()
})

// 设置事件监听（基于 regl-worldview 的实现）
function setupEventListeners(): void {
  if (!canvasRef.value || !cameraController.value || !worldview.value) return

  const canvas = canvasRef.value

  // 鼠标按下
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault()
    cameraController.value?.onMouseDown(e)
    canvas.focus()

    // 根据按钮设置光标
    if (e.button === 0) {
      canvas.style.cursor = 'grabbing' // 左键：旋转
    } else if (e.button === 1) {
      canvas.style.cursor = 'move' // 中键：平移
    }
  })

  // 鼠标移动（使用 window 监听，确保在画布外也能响应）
  // 优化：交互模式下直接处理，不使用 requestAnimationFrame 节流，以获得更流畅的体验
  const handleMouseMove = (e: MouseEvent) => {
    if (cameraController.value?.isDragging()) {
      // 标记开始交互（用于性能优化）
      if (worldview.value && !worldview.value.isInteracting()) {
        worldview.value.markInteractionStart()
      }
      
      // 交互模式下直接处理鼠标移动，不等待 requestAnimationFrame
      // 这样可以获得更低的延迟和更流畅的体验
      // 渲染会通过 CameraStore 的回调自动触发，并由 WorldviewContext 的帧率限制控制
      cameraController.value.onMouseMove(e)
    }
  }
  window.addEventListener('mousemove', handleMouseMove)

  // 鼠标释放
  const handleMouseUp = (e: MouseEvent) => {
    if (cameraController.value) {
      cameraController.value.onMouseUp(e)
      canvas.style.cursor = 'default'
      
      // 标记交互结束（用于性能优化）
      if (worldview.value && worldview.value.isInteracting()) {
        worldview.value.markInteractionEnd()
      }
      
      // 相机状态变化会通过 WorldviewContext 的回调自动触发渲染
    }
  }
  window.addEventListener('mouseup', handleMouseUp)
  canvas.addEventListener('mouseleave', () => {
    if (cameraController.value) {
      cameraController.value.clearButtons()
      canvas.style.cursor = 'default'
      
      // 标记交互结束（鼠标离开画布）
      if (worldview.value && worldview.value.isInteracting()) {
        worldview.value.markInteractionEnd()
      }
    }
  })

  // 滚轮缩放
  // 注意：必须使用 { passive: false } 以便调用 preventDefault() 阻止默认滚动行为
  // 浏览器可能会显示警告，但这是必要的，因为我们需要阻止页面滚动来实现相机缩放
  // 优化：使用 requestAnimationFrame 节流滚轮事件
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (cameraController.value) {
        // 取消之前的帧请求，只处理最新的滚轮事件
        if (wheelFrame !== null) {
          cancelAnimationFrame(wheelFrame)
        }
        
        // 标记开始交互（滚轮缩放）
      if (worldview.value && !worldview.value.isInteracting()) {
        worldview.value.markInteractionStart()
      }
      
      // 使用 requestAnimationFrame 节流
        wheelFrame = requestAnimationFrame(() => {
          cameraController.value?.onWheel(e)
          // 相机状态变化会通过 WorldviewContext 的回调自动触发渲染（已优化为使用 onDirty）
          wheelFrame = null
          
          // 延迟标记交互结束（滚轮操作后）
          setTimeout(() => {
            if (worldview.value && worldview.value.isInteracting()) {
              worldview.value.markInteractionEnd()
            }
          }, 200)
        })
      }
    },
    { passive: false } as AddEventListenerOptions
  )

  // 防止右键菜单
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  // 窗口失焦时清理状态
  window.addEventListener('blur', () => {
    if (cameraController.value) {
      cameraController.value.clearButtons()
    }
  })

  // 窗口大小变化
  const handleResize = () => {
    updateDimensions()
  }
  window.addEventListener('resize', handleResize)
}

// 更新画布和世界观尺寸（优化：使用防抖减少频繁更新）
let resizeTimeout: number | null = null
function updateDimensions(): void {
  if (!canvasRef.value || !worldview.value || !containerRef.value) return
  
  // 清除之前的延迟调用
  if (resizeTimeout !== null) {
    cancelAnimationFrame(resizeTimeout)
  }
  
  // 使用 requestAnimationFrame 延迟执行，避免频繁更新
  resizeTimeout = requestAnimationFrame(() => {
    const rect = containerRef.value!.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    
    // 检查尺寸是否真的改变了
    if (canvasRef.value!.width === width && canvasRef.value!.height === height) {
      return
    }
    
    // 更新画布尺寸
    canvasRef.value!.width = width
    canvasRef.value!.height = height
    
    // 更新世界观尺寸
    worldview.value!.setDimension({
      width,
      height,
      left: rect.left,
      top: rect.top
    })
    
    // 触发重新渲染（仅在尺寸真正改变时）
    worldview.value!.markDirty()
    // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
    
    resizeTimeout = null
  })
}

// 设置容器尺寸监听（使用 ResizeObserver 监听容器尺寸变化）
function setupResizeObserver(): void {
  if (!containerRef.value) {
    console.warn('Container ref is not available for ResizeObserver')
    return
  }
  
  if (!window.ResizeObserver) {
    console.warn('ResizeObserver is not supported in this browser')
    return
  }

  resizeObserver = new ResizeObserver((entries) => {
    // 直接调用 updateDimensions，它内部已经有防抖处理
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        updateDimensions()
      }
    }
  })
  
  resizeObserver.observe(containerRef.value)
}

// 重置相机
function resetCamera(): void {
  if (!worldview.value) return
  worldview.value.setCameraState(DEFAULT_CAMERA_STATE)
  worldview.value.markDirty()
  // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
}

// 切换网格显示
function toggleGrid(): void {
  gridVisible.value = !gridVisible.value
  sceneManager.value?.setGridVisible(gridVisible.value)
  worldview.value?.markDirty()
  // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
}

// 切换坐标轴显示
function toggleAxes(): void {
  axesVisible.value = !axesVisible.value
  sceneManager.value?.setAxesVisible(axesVisible.value)
  worldview.value?.markDirty()
  // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
}

// 设置网格可见性
function setGridVisible(visible: boolean): void {
  gridVisible.value = visible
  sceneManager.value?.setGridVisible(visible)
  worldview.value?.markDirty()
  // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
}

// 设置坐标轴可见性
function setAxesVisible(visible: boolean): void {
  axesVisible.value = visible
  sceneManager.value?.setAxesVisible(visible)
  worldview.value?.markDirty()
  // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
}

// 设置背景颜色
function setBackgroundColor(color: string): void {
  if (!worldview.value) return
  // 将hex颜色转换为rgba数组
  const hexToRgba = (hex: string): [number, number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return [r, g, b, 1.0]
  }
  worldview.value.setCanvasBackgroundColor(hexToRgba(color))
  worldview.value.markDirty()
  // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
}

// 暴露方法供父组件调用
defineExpose({
  resetCamera,
  toggleGrid,
  toggleAxes,
  setGridVisible,
  setAxesVisible,
  setBackgroundColor,
  getSceneManager: () => sceneManager.value,
  getWorldview: () => worldview.value
})

// 监听属性变化（向后兼容，使用默认 componentId）
watch(
  () => props.pointCloud,
  (newData) => {
    if (newData && sceneManager.value) {
      // 使用默认的 componentId 用于向后兼容
      sceneManager.value.updatePointCloud(newData, 'default-pointcloud')
      worldview.value?.markDirty()
      // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
    }
  },
  { deep: true }
)

watch(
  () => props.paths,
  (newPaths) => {
    if (sceneManager.value) {
      sceneManager.value.clearPaths()
      newPaths.forEach((path) => {
        sceneManager.value?.addPath(path)
      })
      worldview.value?.markDirty()
      // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
    }
  },
  { deep: true }
)

// 监听options变化，同步网格和坐标轴状态
watch(
  () => props.options?.enableGrid,
  (newValue) => {
    if (newValue !== undefined && newValue !== gridVisible.value) {
      setGridVisible(newValue)
    }
  }
)

watch(
  () => props.options?.enableAxes,
  (newValue) => {
    if (newValue !== undefined && newValue !== axesVisible.value) {
      setAxesVisible(newValue)
    }
  }
)

// 监听背景颜色变化
watch(
  () => props.options?.clearColor,
  (newColor) => {
    if (newColor && worldview.value) {
      worldview.value.setCanvasBackgroundColor(newColor)
      worldview.value.markDirty()
      // 移除直接调用 paint()，让 markDirty() 通过帧率限制机制安排渲染
    }
  }
)

// 清理
onUnmounted(() => {
  // 清理待处理的动画帧请求
  if (wheelFrame !== null) {
    cancelAnimationFrame(wheelFrame)
    wheelFrame = null
  }
  if (resizeTimeout !== null) {
    cancelAnimationFrame(resizeTimeout)
    resizeTimeout = null
  }
  
  // 清理 ResizeObserver
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value)
    resizeObserver.disconnect()
    resizeObserver = null
  }
  
  if (worldview.value) {
    worldview.value.destroy()
  }
  if (sceneManager.value) {
    sceneManager.value.destroy()
  }
})
</script>

<style scoped>
.rviz-viewer {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #333333; /* rviz 深灰色背景 */
  overflow: hidden;
}

.viewer-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

.viewer-canvas:active {
  cursor: grabbing;
}

.viewer-info {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 12px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
}

.info-item {
  margin: 4px 0;
}
</style>
