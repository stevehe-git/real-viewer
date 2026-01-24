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
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Refresh, Grid, Location } from '@element-plus/icons-vue'
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
const worldview = ref<Worldview | null>(null)
const sceneManager = ref<SceneManager | null>(null)
const cameraController = ref<WorldviewCameraController | null>(null)
const gridVisible = ref(true)
const axesVisible = ref(true)

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
    sceneManager.value.updatePointCloud(props.pointCloud)
  }

  props.paths.forEach((path) => {
    sceneManager.value?.addPath(path)
  })

  // 设置事件监听
  setupEventListeners()

  // 初始渲染
  worldview.value.paint()
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
  const handleMouseMove = (e: MouseEvent) => {
    if (cameraController.value?.isDragging()) {
      cameraController.value.onMouseMove(e)
      // 相机状态已通过共享的 CameraStore 自动更新
      // WorldviewContext 的回调会自动触发渲染
    }
  }
  window.addEventListener('mousemove', handleMouseMove)

  // 鼠标释放
  const handleMouseUp = (e: MouseEvent) => {
    if (cameraController.value) {
      cameraController.value.onMouseUp(e)
      canvas.style.cursor = 'default'
      // 相机状态变化会通过 WorldviewContext 的回调自动触发渲染
    }
  }
  window.addEventListener('mouseup', handleMouseUp)
  canvas.addEventListener('mouseleave', () => {
    if (cameraController.value) {
      cameraController.value.clearButtons()
      canvas.style.cursor = 'default'
    }
  })

  // 滚轮缩放
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (cameraController.value) {
        cameraController.value.onWheel(e)
        // 相机状态变化会通过 WorldviewContext 的回调自动触发渲染
      }
    },
    { passive: false }
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
    if (!canvasRef.value || !worldview.value) return
    const rect = canvasRef.value.getBoundingClientRect()
    worldview.value.setDimension({
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top
    })
  }
  window.addEventListener('resize', handleResize)
}

// 重置相机
function resetCamera(): void {
  if (!worldview.value) return
  worldview.value.setCameraState(DEFAULT_CAMERA_STATE)
  worldview.value.markDirty()
  worldview.value.paint()
}

// 切换网格显示
function toggleGrid(): void {
  gridVisible.value = !gridVisible.value
  sceneManager.value?.setGridVisible(gridVisible.value)
  worldview.value?.markDirty()
  worldview.value?.paint()
}

// 切换坐标轴显示
function toggleAxes(): void {
  axesVisible.value = !axesVisible.value
  sceneManager.value?.setAxesVisible(axesVisible.value)
  worldview.value?.markDirty()
  worldview.value?.paint()
}

// 监听属性变化
watch(
  () => props.pointCloud,
  (newData) => {
    if (newData && sceneManager.value) {
      sceneManager.value.updatePointCloud(newData)
      worldview.value?.markDirty()
      worldview.value?.paint()
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
      worldview.value?.paint()
    }
  },
  { deep: true }
)

// 清理
onUnmounted(() => {
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
