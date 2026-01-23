<template>
  <div class="rviz-viewer">
    <div class="viewer-container">
      <canvas ref="canvasRef" class="viewer-canvas"></canvas>
      <div class="viewer-controls">
        <el-button-group>
          <el-button size="small" @click="resetCamera">
            <el-icon><Refresh /></el-icon>
            重置视角
          </el-button>
          <el-button size="small" @click="toggleGrid">
            <el-icon><Grid /></el-icon>
            {{ gridVisible ? '隐藏' : '显示' }}网格
          </el-button>
          <el-button size="small" @click="toggleAxes">
            <el-icon><Location /></el-icon>
            {{ axesVisible ? '隐藏' : '显示' }}坐标轴
          </el-button>
        </el-button-group>
      </div>
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Refresh, Grid, Location } from '@element-plus/icons-vue'
import { Renderer } from './core/Renderer'
import { WorldviewCameraController } from './camera/WorldviewCameraController'
import { WorldviewSceneManager } from './core/WorldviewSceneManager'
import type { CameraState, Viewport, RenderOptions } from './types'
import type { PointCloudData } from './visualizations/PointCloud'
import type { PathData } from './visualizations/Path'

interface Props {
  width?: number
  height?: number
  camera?: Partial<CameraState>
  options?: RenderOptions
  pointCloud?: PointCloudData
  paths?: PathData[]
}

const props = withDefaults(defineProps<Props>(), {
  width: 800,
  height: 600,
  camera: () => ({}),
  options: () => ({}),
  pointCloud: undefined,
  paths: () => []
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderer = ref<Renderer | null>(null)
const cameraController = ref<WorldviewCameraController | null>(null)
const sceneManager = ref<WorldviewSceneManager | null>(null)
const gridVisible = ref(true)
const axesVisible = ref(true)

// 默认相机配置（rviz 风格：等轴测视角）
const defaultCamera: CameraState = {
  position: [8, 8, 6], // 稍微高一点的视角
  target: [0, 0, 0],
  up: [0, 0, 1],
  fov: Math.PI / 4,
  near: 0.1,
  far: 1000
}

// 初始化
onMounted(() => {
  if (!canvasRef.value) return

  const canvas = canvasRef.value
  const viewport: Viewport = {
    width: props.width || canvas.clientWidth || 800,
    height: props.height || canvas.clientHeight || 600
  }

  // 设置画布尺寸
  canvas.width = viewport.width
  canvas.height = viewport.height

  // 合并相机配置
  const camera: CameraState = {
    ...defaultCamera,
    ...props.camera
  }

  // 初始化渲染器
  renderer.value = new Renderer(canvas, viewport, camera, props.options)

  // 初始化相机控制器（基于 regl-worldview）
  cameraController.value = new WorldviewCameraController({
    distance: 10,
    phi: Math.PI / 4,
    target: camera.target,
    fovy: camera.fov
  })
  cameraController.value.setCanvas(canvas)

  // 初始化场景管理器（使用 regl-worldview 优化版本）
  sceneManager.value = new WorldviewSceneManager(renderer.value.getContext(), props.options)

  // 设置初始数据
  if (props.pointCloud) {
    sceneManager.value.updatePointCloud(props.pointCloud)
  }

  props.paths.forEach(path => {
    sceneManager.value?.addPath(path)
  })

  // 设置事件监听
  setupEventListeners()

  // 初始渲染一次
  renderer.value.markDirty()
  
  // 开始渲染循环
  startRenderLoop()
})

// 设置事件监听（基于 regl-worldview 的实现）
function setupEventListeners(): void {
  if (!canvasRef.value || !cameraController.value) return

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
  const handleMouseMove = (e: MouseEvent) => {
    if (cameraController.value?.isDragging()) {
      cameraController.value.onMouseMove(e)
      renderer.value?.markDirty()
      startRenderLoop() // 确保渲染循环在运行
    }
  }
  window.addEventListener('mousemove', handleMouseMove)

  // 鼠标释放
  const handleMouseUp = (e: MouseEvent) => {
    if (cameraController.value) {
      cameraController.value.onMouseUp(e)
      canvas.style.cursor = 'default'
      renderer.value?.markDirty()
    }
  }
  window.addEventListener('mouseup', handleMouseUp)
  canvas.addEventListener('mouseleave', () => {
    if (cameraController.value) {
      // 清除所有按钮状态
      cameraController.value.clearButtons()
      canvas.style.cursor = 'default'
    }
  })

  // 滚轮缩放
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    if (cameraController.value) {
      cameraController.value.onWheel(e)
      renderer.value?.markDirty()
      startRenderLoop() // 确保渲染循环在运行
    }
  }, { passive: false })

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
}

// 渲染循环（优化版本：只在有变化时渲染）
let animationFrameId: number | null = null
let lastCameraState: CameraState | null = null
let isRendering = false
let lastRenderTime = 0
const TARGET_FPS = 30
const FRAME_INTERVAL = 1000 / TARGET_FPS // 约 33.33ms

function startRenderLoop(): void {
  if (!renderer.value || !cameraController.value || !sceneManager.value) return
  if (isRendering) return // 已经在渲染中

  isRendering = true

  const loop = (currentTime: number) => {
    if (!renderer.value || !cameraController.value || !sceneManager.value) {
      animationFrameId = null
      isRendering = false
      return
    }

    // 检查是否有交互（拖拽中）
    const isDragging = cameraController.value.isDragging()
    
    // 获取当前相机状态
    const camera = cameraController.value.getCamera()
    
    // 检查相机是否有变化
    const cameraChanged = !lastCameraState || 
      lastCameraState.position[0] !== camera.position[0] ||
      lastCameraState.position[1] !== camera.position[1] ||
      lastCameraState.position[2] !== camera.position[2] ||
      lastCameraState.target[0] !== camera.target[0] ||
      lastCameraState.target[1] !== camera.target[1] ||
      lastCameraState.target[2] !== camera.target[2] ||
      lastCameraState.fov !== camera.fov

    // 检查是否到了渲染时间（30 FPS）
    const timeSinceLastRender = currentTime - lastRenderTime
    const shouldRenderByTime = timeSinceLastRender >= FRAME_INTERVAL

    // 只在有变化或正在交互或到了渲染时间时才渲染
    if ((cameraChanged || isDragging || renderer.value.shouldRender()) && shouldRenderByTime) {
      // 更新相机
      renderer.value.updateCamera(camera)
      lastCameraState = { ...camera }
      lastRenderTime = currentTime

      // 获取投影和视图矩阵（带缓存）
      const projection = renderer.value.getProjectionMatrix()
      const view = renderer.value.getViewMatrix()
      const viewport = renderer.value.getViewport()

      // 渲染场景（使用 regl-worldview 优化版本）
      renderer.value.render(() => {
        sceneManager.value?.render(projection, view, viewport)
      })
    }

    // 如果没有交互且没有变化，停止渲染循环
    if (!isDragging && !cameraChanged && !renderer.value.shouldRender()) {
      animationFrameId = null
      isRendering = false
      return
    }

    // 继续循环
    animationFrameId = requestAnimationFrame(loop)
  }

  lastRenderTime = performance.now()
  animationFrameId = requestAnimationFrame(loop)
}

function stopRenderLoop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  isRendering = false
}

// 重置相机
function resetCamera(): void {
  cameraController.value?.reset()
  lastCameraState = null // 重置相机状态缓存，强制重新渲染
  renderer.value?.markDirty() // 标记需要重新渲染
  startRenderLoop() // 重新启动渲染循环
}

// 切换网格显示
function toggleGrid(): void {
  gridVisible.value = !gridVisible.value
  sceneManager.value?.setGridVisible(gridVisible.value)
  renderer.value?.markDirty() // 标记需要重新渲染
  startRenderLoop() // 重新启动渲染循环
}

// 切换坐标轴显示
function toggleAxes(): void {
  axesVisible.value = !axesVisible.value
  sceneManager.value?.setAxesVisible(axesVisible.value)
  renderer.value?.markDirty() // 标记需要重新渲染
  startRenderLoop() // 重新启动渲染循环
}

// 监听属性变化
watch(() => props.pointCloud, (newData) => {
  if (newData && sceneManager.value) {
    sceneManager.value.updatePointCloud(newData)
    renderer.value?.markDirty() // 标记需要重新渲染
    startRenderLoop() // 重新启动渲染循环
  }
}, { deep: true })

watch(() => props.paths, (newPaths) => {
  if (sceneManager.value) {
    sceneManager.value.clearPaths()
    newPaths.forEach(path => {
      sceneManager.value?.addPath(path)
    })
    renderer.value?.markDirty() // 标记需要重新渲染
    startRenderLoop() // 重新启动渲染循环
  }
}, { deep: true })

// 清理
onUnmounted(() => {
  stopRenderLoop()
  if (renderer.value) {
    renderer.value.destroy()
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

.viewer-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px;
  border-radius: 4px;
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
