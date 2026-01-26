<template>
  <div class="navigation-preview">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
      <el-icon class="menu-icon" @click="toggleMenu">
        <Menu />
      </el-icon>
      <h1 class="page-title">导航预览</h1>
      <div class="top-bar-right">
        <el-button class="panel-settings-btn" @click="panelSettingsVisible = true">
          <el-icon class="btn-icon">
            <Setting />
          </el-icon>
          <span>面板设置</span>
        </el-button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div ref="mainContentRef" class="main-content" :class="{ resizing: isResizing }">
      <!-- 左侧3D视图 -->
      <div 
        class="viewer-container" 
        :style="{ width: hasPanels ? `calc(100% - ${panelWidth}px - 4px)` : '100%' }"
      >
        <RvizViewer
          ref="viewerRef"
          :width="viewerWidth"
          :height="viewerHeight"
          :point-cloud="pointCloudData"
          :paths="pathData"
          :options="viewerOptions"
        />
      </div>

      <!-- 分割条 -->
      <div
        v-if="hasPanels"
        class="splitter"
        @mousedown="startResize"
        :class="{ resizing: isResizing }"
      >
        <div class="splitter-handle"></div>
      </div>

      <!-- 右侧面板管理器 -->
      <PanelManager
        v-if="hasPanels"
        :is-fullscreen="isFullscreen"
        :style="{ width: `${panelWidth}px` }"
        @reset-camera="handleResetCamera"
        @toggle-grid="handleToggleGrid"
        @toggle-axes="handleToggleAxes"
        @update:camera-mode="handleUpdateCameraMode"
        @update:show-robot="handleUpdateShowRobot"
        @update:show-map="handleUpdateShowMap"
        @update:show-laser="handleUpdateShowLaser"
        @update:background-color="handleUpdateBackgroundColor"
        @toggle-fullscreen="handleToggleFullscreen"
        @take-screenshot="handleTakeScreenshot"
        @export-scene="handleExportScene"
        @reset-scene="handleResetScene"
        @toggle-recording="(recording: boolean) => handleToggleRecording(recording)"
        @toggle-performance-mode="handleTogglePerformanceMode"
        @toggle-debug-info="handleToggleDebugInfo"
      />
    </div>

    <!-- 面板设置抽屉 -->
    <PanelSettingsDrawer v-model="panelSettingsVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Menu, Setting } from '@element-plus/icons-vue'
import RvizViewer from '../../components/RvizViewer/RvizViewer.vue'
import PanelManager from '../../components/panels/panels-manager/PanelManager.vue'
import PanelSettingsDrawer from '../../components/panels/panel-setting/PanelSettingsDrawer.vue'
import { useRvizStore } from '../../stores/rviz'
import { useSplitter } from '../../composables/viewer/layout/useSplitter'
import { useViewControl } from '../../composables/viewer/view-control/useViewControl'
import { useFullscreen } from '../../composables/viewer/view-control/useFullscreen'
import { useDisplaySync } from '../../composables/viewer/scene/useDisplaySync'
import type { PointCloudData, PathData } from '../../components/RvizViewer/types'

// 使用RViz store
const rvizStore = useRvizStore()

// 使用分割器
const { panelWidth, isResizing, startResize, cleanup } = useSplitter({ rvizStore })

// RvizViewer引用
const viewerRef = ref<InstanceType<typeof RvizViewer> | null>(null)

// 网格和坐标轴可见性状态（用于同步）
const gridVisible = ref(true)
const axesVisible = ref(true)

// 使用视图控制composable
const viewControl = useViewControl({
  viewerRef,
  gridVisible,
  axesVisible
})

// 显示配置同步（监听 displayComponents 变化，实时同步到渲染器）
let displaySyncInstance: ReturnType<typeof useDisplaySync> | null = null

watch(
  () => viewerRef.value?.getSceneManager(),
  (sceneManager) => {
    if (sceneManager && !displaySyncInstance) {
      const worldview = viewerRef.value?.getWorldview()
      if (worldview) {
        displaySyncInstance = useDisplaySync({
          context: {
            setGridVisible: (visible: boolean) => {
              sceneManager.setGridVisible(visible)
              worldview.markDirty()
              worldview.paint()
            },
            setAxesVisible: (visible: boolean) => {
              sceneManager.setAxesVisible(visible)
              worldview.markDirty()
              worldview.paint()
            },
            setAxesOptions: (options: { length?: number; radius?: number; alpha?: number }) => {
              sceneManager.setAxesOptions(options)
              worldview.markDirty()
              worldview.paint()
            },
            setGridOptions: (options: { 
              planeCellCount?: number
              normalCellCount?: number
              cellSize?: number
              color?: string
              alpha?: number
              plane?: string
              offsetX?: number
              offsetY?: number
              offsetZ?: number
            }) => {
              sceneManager.setGridOptions(options)
              worldview.markDirty()
              worldview.paint()
            },
            destroyGrid: () => {
              sceneManager.destroyGrid()
              worldview.markDirty()
              worldview.paint()
            },
            destroyAxes: () => {
              sceneManager.destroyAxes()
              worldview.markDirty()
              worldview.paint()
            },
            createGrid: () => {
              sceneManager.createGrid()
              worldview.markDirty()
              worldview.paint()
            },
            createAxes: () => {
              sceneManager.createAxes()
              worldview.markDirty()
              worldview.paint()
            }
          }
        })
      }
    }
  },
  { immediate: true }
)

// 面板设置抽屉可见性
const panelSettingsVisible = ref(false)

// 主内容区域引用（用于全屏）
const mainContentRef = ref<HTMLElement | null>(null)

// 使用全屏控制
const fullscreen = useFullscreen({ target: null })
const isFullscreen = fullscreen.isFullscreen

// 视口尺寸
const viewerWidth = ref(1200)
const viewerHeight = ref(800)

// 点云数据
const pointCloudData = ref<PointCloudData | undefined>(undefined)

// 路径数据
const pathData = ref<PathData[]>([])

// 是否有活动面板
const hasPanels = computed(() => {
  return rvizStore.panelConfig.enabledPanels.length > 0
})

// 查看器选项（根据store状态）
const viewerOptions = computed(() => {
  const bgColor = rvizStore.sceneState.backgroundColor
  // 将hex颜色转换为rgba数组
  const hexToRgba = (hex: string): [number, number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return [r, g, b, 1.0]
  }
  
  return {
    clearColor: hexToRgba(bgColor),
    enableGrid: rvizStore.sceneState.showGrid,
    enableAxes: rvizStore.sceneState.showAxes,
    gridSize: 10,
    gridDivisions: 5,
    gridColor: [0.67, 0.67, 0.67, 1.0] as [number, number, number, number]
  }
})

// 切换菜单
function toggleMenu() {
  console.log('Toggle menu')
}

// 事件处理函数（使用viewControl composable）
function handleResetCamera() {
  viewControl.handleResetCamera()
}

function handleToggleGrid() {
  viewControl.handleToggleGrid()
}

function handleToggleAxes() {
  viewControl.handleToggleAxes()
}

function handleUpdateCameraMode(mode: string) {
  viewControl.handleUpdateCameraMode(mode)
}

function handleUpdateShowRobot(show: boolean) {
  rvizStore.sceneState.showRobot = show
}

function handleUpdateShowMap(show: boolean) {
  rvizStore.sceneState.showMap = show
}

function handleUpdateShowLaser(show: boolean) {
  rvizStore.sceneState.showLaser = show
}

function handleUpdateBackgroundColor(color: string) {
  viewControl.handleUpdateBackgroundColor(color)
}

function handleToggleFullscreen() {
  // 使用主内容区域作为全屏目标，如果没有则使用整个页面
  const targetElement = mainContentRef.value || document.documentElement
  fullscreen.toggleFullscreen(targetElement)
}

function handleTakeScreenshot() {
  console.log('Take screenshot')
}

function handleExportScene() {
  console.log('Export scene')
}

function handleResetScene() {
  console.log('Reset scene')
}

function handleToggleRecording(recording: boolean) {
  rvizStore.sceneState.isRecording = recording
}

function handleTogglePerformanceMode(enabled: boolean) {
  rvizStore.sceneState.performanceMode = enabled
}

function handleToggleDebugInfo(show: boolean) {
  rvizStore.sceneState.showDebugInfo = show
}

// 更新视口尺寸
function updateViewportSize(): void {
  nextTick(() => {
    const container = document.querySelector('.viewer-container') as HTMLElement
    if (container) {
      viewerWidth.value = container.clientWidth
      viewerHeight.value = container.clientHeight
    } else {
      const panelWidth = hasPanels.value ? rvizStore.panelConfig.panelWidth : 0
      viewerWidth.value = window.innerWidth - 240 - panelWidth
      viewerHeight.value = window.innerHeight - 60 - 60
    }
  })
}

// 监听面板配置变化
watch(
  () => rvizStore.panelConfig.enabledPanels,
  () => {
    updateViewportSize()
  }
)

// 监听面板宽度变化
watch(
  () => rvizStore.panelConfig.panelWidth,
  (newWidth) => {
    panelWidth.value = newWidth
    updateViewportSize()
  },
  { immediate: true }
)

// 初始化面板宽度
panelWidth.value = rvizStore.panelConfig.panelWidth

onMounted(() => {
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportSize)
  cleanup()
})
</script>

<style scoped>
.navigation-preview {
  position: fixed;
  top: 60px; /* Header高度 */
  left: 240px; /* 侧边栏宽度 */
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
  z-index: 1;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  z-index: 10;
}

.top-bar-right {
  display: flex;
  align-items: center;
}

.panel-settings-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 6px 12px;
  background: white;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.panel-settings-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.btn-icon {
  font-size: 16px;
}

.menu-icon {
  font-size: 20px;
  cursor: pointer;
  color: #666;
  transition: color 0.2s;
}

.menu-icon:hover {
  color: #333;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.main-content {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

/* 全屏时的样式 */
.main-content:fullscreen,
.main-content:-webkit-full-screen,
.main-content:-moz-full-screen,
.main-content:-ms-fullscreen {
  width: 100vw;
  height: 100vh;
  background: #333333;
}

.main-content.resizing {
  user-select: none;
}

.main-content.resizing * {
  pointer-events: none;
}

.viewer-container {
  flex: 1;
  height: 100%;
  position: relative;
  min-width: 300px;
  transition: width 0.1s ease;
}

.main-content.resizing .viewer-container {
  transition: none;
}

/* 确保RvizViewer占满容器 */
.viewer-container :deep(.rviz-viewer) {
  width: 100%;
  height: 100%;
}

/* 分割条样式 */
.splitter {
  width: 4px;
  height: 100%;
  background: #e0e0e0;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  z-index: 10;
  transition: background 0.2s;
}

.splitter:hover,
.splitter.resizing {
  background: #409eff;
}

.splitter-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: #909399;
  border-radius: 1px;
  transition: background 0.2s;
}

.splitter:hover .splitter-handle,
.splitter.resizing .splitter-handle {
  background: #fff;
}
</style>
