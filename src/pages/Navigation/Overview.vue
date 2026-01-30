<template>
  <div class="navigation-preview" :style="{ left: sidebarLeft }">
    <!-- 顶部标题栏 -->
    <div class="top-bar">
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
import { Setting } from '@element-plus/icons-vue'
import RvizViewer from '../../components/RvizViewer/RvizViewer.vue'
import PanelManager from '../../components/panels/panels-manager/PanelManager.vue'
import PanelSettingsDrawer from '../../components/panels/panel-setting/PanelSettingsDrawer.vue'
import { useRvizStore } from '../../stores/rviz'
import { useSplitter } from '../../composables/viewer/layout/useSplitter'
import { useViewControl } from '../../composables/viewer/view-control/useViewControl'
import { useFullscreen } from '../../composables/viewer/view-control/useFullscreen'
import { useDisplaySync } from '../../composables/viewer/scene/useDisplaySync'
import type { PointCloudData, PathData } from '../../components/RvizViewer/types'

// 类型定义
type ColorRGB = { r: number; g: number; b: number }
type LaserScanOptions = {
  style?: string
  size?: number
  alpha?: number
  colorTransformer?: string
  useRainbow?: boolean
  minColor?: ColorRGB
  maxColor?: ColorRGB
  autocomputeIntensityBounds?: boolean
  minIntensity?: number
  maxIntensity?: number
}
type TFOptions = {
  showNames?: boolean
  showAxes?: boolean
  showArrows?: boolean
  markerScale?: number
  markerAlpha?: number
  frameTimeout?: number
  filterWhitelist?: string
  filterBlacklist?: string
  frames?: Array<{ name: string; enabled: boolean }>
}

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

// 监听帧率设置变化
watch(
  () => rvizStore.sceneState.fps,
  (fps) => {
    const worldview = viewerRef.value?.getWorldview()
    if (worldview && fps) {
      worldview.setTargetFPS(fps)
      // 交互模式帧率设为正常模式的 50%
      worldview.setInteractionFPS(Math.max(1, Math.floor(fps * 0.5)))
      // 大地图交互模式帧率设为正常模式的 33%
      worldview.setLargeMapInteractionFPS(Math.max(1, Math.floor(fps * 0.33)))
    }
  },
  { immediate: true }
)

watch(
  () => viewerRef.value?.getSceneManager(),
  (sceneManager) => {
    if (sceneManager) {
      const worldview = viewerRef.value?.getWorldview()
      if (worldview) {
        // 初始化时设置帧率
        const fps = rvizStore.sceneState.fps || 60
        worldview.setTargetFPS(fps)
        worldview.setInteractionFPS(Math.max(1, Math.floor(fps * 0.5)))
        worldview.setLargeMapInteractionFPS(Math.max(1, Math.floor(fps * 0.33)))
        // 检查 sceneManager 是否有 setTFVisible 方法
        // 如果没有，说明是旧版本，需要重新创建 displaySyncInstance
        const needsUpdate = !displaySyncInstance || typeof (sceneManager as any).setTFVisible !== 'function'
        
        if (needsUpdate) {
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
              updateMap: async (message: any, componentId: string) => {
                // 异步处理地图数据（在 Web Worker 中），不阻塞主线程
                await sceneManager.updateMap(message, componentId)
                worldview.markDirty()
                worldview.paint()
              },
              removeMap: (componentId: string) => {
                sceneManager.removeMap(componentId)
                worldview.markDirty()
                worldview.paint()
              },
              clearAllMaps: () => {
                sceneManager.clearAllMaps()
                worldview.markDirty()
                worldview.paint()
              },
              setMapOptions: (options: { 
                alpha?: number
                colorScheme?: string
                drawBehind?: boolean
              }, componentId: string) => {
                sceneManager.setMapOptions(options, componentId)
                worldview.markDirty()
                worldview.paint()
              },
              clearPaths: () => {
                sceneManager.clearPaths()
                worldview.markDirty()
                worldview.paint()
              },
              finalPaint: () => {
                // 最终渲染，清理后只渲染一次
                worldview.markDirty()
                worldview.paint()
              },
              updateLaserScan: async (message: any, componentId: string) => {
                await sceneManager.updateLaserScan(message, componentId)
                worldview.markDirty()
                worldview.paint()
              },
              removeLaserScan: (componentId: string) => {
                sceneManager.removeLaserScan(componentId)
                worldview.markDirty()
                worldview.paint()
              },
              clearAllLaserScans: () => {
                sceneManager.clearAllLaserScans()
                worldview.markDirty()
                worldview.paint()
              },
              setLaserScanOptions: (options: LaserScanOptions, componentId: string) => {
                sceneManager.setLaserScanOptions(options, componentId)
                worldview.markDirty()
                worldview.paint()
              },
              updatePointCloud: async (data: any, componentId: string) => {
                await sceneManager.updatePointCloud(data, componentId)
                worldview.markDirty()
                worldview.paint()
              },
              removePointCloud: (componentId: string) => {
                sceneManager.removePointCloud(componentId)
                worldview.markDirty()
                worldview.paint()
              },
              clearAllPointClouds: () => {
                sceneManager.clearAllPointClouds()
                worldview.markDirty()
                worldview.paint()
              },
              updatePointCloud2: async (message: any, componentId: string) => {
                await sceneManager.updatePointCloud2(message, componentId)
                worldview.markDirty()
                worldview.paint()
              },
              removePointCloud2: (componentId: string) => {
                sceneManager.removePointCloud2(componentId)
                worldview.markDirty()
                worldview.paint()
              },
              clearAllPointCloud2s: () => {
                sceneManager.clearAllPointCloud2s()
                worldview.markDirty()
                worldview.paint()
              },
              setPointCloud2Options: (options: { 
                size?: number
                alpha?: number
                colorTransformer?: string
                useRainbow?: boolean
                minColor?: { r: number; g: number; b: number }
                maxColor?: { r: number; g: number; b: number }
              }, componentId: string) => {
                sceneManager.setPointCloud2Options(options, componentId)
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
              },
              setTFVisible: (visible: boolean) => {
                sceneManager.setTFVisible(visible)
                worldview.markDirty()
                worldview.paint()
              },
              setTFOptions: (options: TFOptions) => {
                sceneManager.setTFOptions(options)
                worldview.markDirty()
                worldview.paint()
              }
            }
          })
        }
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

// 侧边栏宽度（动态计算）
const sidebarLeft = ref('240px')
const sidebarWidth = ref(240) // 默认宽度

// 更新侧边栏宽度
function updateSidebarWidth() {
  const sidebar = document.querySelector('.sidebar') as HTMLElement
  if (sidebar) {
    const width = sidebar.offsetWidth
    sidebarWidth.value = width
    sidebarLeft.value = `${width}px`
    updateViewportSize()
  }
}

// MutationObserver 用于监听侧边栏宽度变化
let sidebarObserver: MutationObserver | null = null

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
      viewerWidth.value = window.innerWidth - sidebarWidth.value - panelWidth
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
  // 监听侧边栏宽度变化
  const sidebar = document.querySelector('.sidebar') as HTMLElement
  if (sidebar) {
    // 初始设置
    updateSidebarWidth()
    
    // 监听侧边栏类名变化（折叠/展开）
    sidebarObserver = new MutationObserver(() => {
      updateSidebarWidth()
    })
    sidebarObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    // 监听侧边栏宽度变化（CSS transition）
    const resizeObserver = new ResizeObserver(() => {
      updateSidebarWidth()
    })
    resizeObserver.observe(sidebar)
    
    // 清理函数
    onUnmounted(() => {
      resizeObserver.disconnect()
    })
  }
  
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
})

onUnmounted(() => {
  if (sidebarObserver) {
    sidebarObserver.disconnect()
    sidebarObserver = null
  }
  window.removeEventListener('resize', updateViewportSize)
  cleanup()
})
</script>

<style scoped>
.navigation-preview {
  position: fixed;
  top: 60px; /* Header高度 */
  /* left 值通过 :style 动态设置 */
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

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: left;
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
