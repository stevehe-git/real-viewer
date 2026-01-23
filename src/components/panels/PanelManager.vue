<template>
  <div>
    <!-- PanelManager 容器 -->
    <div 
      v-if="hasActivePanels || floatingPanels.length > 0" 
      class="panel-manager" 
      :style="{ width: `${rvizStore.panelConfig.panelWidth}px` }"
      @dragover.prevent="handleDragOver" 
      @drop="handleDrop"
    >
      <!-- 选中的面板 -->
      <div class="active-panels">
        <template v-for="(panelItem, index) in allPanelsList" :key="panelItem.id">
          <!-- 插入指示线 -->
          <div
            v-if="dragOverIndex === index"
            class="insert-indicator"
          ></div>
          
          <!-- 面板包装器 -->
          <div
            class="panel-wrapper"
            :class="{ dragging: draggedPanelId === panelItem.id }"
            draggable="true"
            @dragstart="handleDragStart($event, panelItem.id)"
            @dragend="handleDragEnd($event)"
          >
            <!-- 标准面板 -->
            <ViewControlPanel
              v-if="panelItem.id === 'view-control'"
              :camera-mode="rvizStore.sceneState.cameraMode"
              :show-grid="rvizStore.sceneState.showGrid"
              :show-axes="rvizStore.sceneState.showAxes"
              :show-robot="rvizStore.sceneState.showRobot"
              :show-map="rvizStore.sceneState.showMap"
              :show-laser="rvizStore.sceneState.showLaser"
              :background-color="rvizStore.sceneState.backgroundColor"
              :is-fullscreen="props.isFullscreen"
              @reset-camera="$emit('resetCamera')"
              @toggle-grid="$emit('toggleGrid')"
              @toggle-axes="$emit('toggleAxes')"
              @update:camera-mode="$emit('update:cameraMode', $event)"
              @update:show-robot="$emit('update:showRobot', $event)"
              @update:show-map="$emit('update:showMap', $event)"
              @update:show-laser="$emit('update:showLaser', $event)"
              @update:background-color="$emit('update:backgroundColor', $event)"
              @toggle-fullscreen="$emit('toggleFullscreen')"
            />

            <SceneInfoPanel
              v-else-if="panelItem.id === 'scene-info'"
              :fps="rvizStore.sceneState.fps"
              :camera-pos="rvizStore.sceneState.cameraPos"
              :object-count="rvizStore.sceneState.objectCount"
              :memory-usage="rvizStore.sceneState.memoryUsage"
              :texture-count="rvizStore.sceneState.textureCount"
            />

            <ToolPanel
              v-else-if="panelItem.id === 'tools'"
              :is-recording="rvizStore.sceneState.isRecording"
              :performance-mode="rvizStore.sceneState.performanceMode"
              :show-debug-info="rvizStore.sceneState.showDebugInfo"
              @take-screenshot="$emit('takeScreenshot')"
              @export-scene="$emit('exportScene')"
              @reset-scene="$emit('resetScene')"
              @toggle-recording="$emit('toggleRecording', $event)"
              @toggle-performance-mode="$emit('togglePerformanceMode', $event)"
              @toggle-debug-info="$emit('toggleDebugInfo', $event)"
            />

            <DisplayPanel
              v-else-if="panelItem.id === 'display'"
              @update:global-options="handleGlobalOptionsUpdate"
              @update:grid-options="handleGridOptionsUpdate"
              @update:axes-options="handleAxesOptionsUpdate"
              @add-display="handleAddDisplay"
              @duplicate-display="handleDuplicateDisplay"
              @remove-display="handleRemoveDisplay"
              @rename-display="handleRenameDisplay"
            />

            <RobotConnectionPanel
              v-else-if="panelItem.id === 'robot-connection'"
            />

            <!-- 图像面板 -->
            <ImageViewerPanel
              v-else-if="panelItem.type === 'image' && panelItem.componentId && panelItem.name"
              :component-id="panelItem.componentId"
              :component-name="panelItem.name"
              :topic="panelItem.topic"
            />
          </div>
        </template>
        
        <!-- 最后一个插入指示线 -->
        <div
          v-if="dragOverIndex === allPanelsList.length"
          class="insert-indicator"
        ></div>
      </div>
    </div>

    <!-- 悬浮面板 -->
    <FloatingPanel
      v-for="floatingPanel in floatingPanels"
      :key="floatingPanel.panelId"
      :panel-id="floatingPanel.panelId"
      :panel-title="getPanelTitle(floatingPanel.panelId)"
      :visible="true"
      :x="floatingPanel.x"
      :y="floatingPanel.y"
      :width="floatingPanel.width"
      :height="floatingPanel.height"
      :draggable="true"
      @close="handleCloseFloatingPanel(floatingPanel.panelId)"
      @update:position="(x: number, y: number) => handleUpdateFloatingPosition(floatingPanel.panelId, x, y)"
      @drag-start="handleFloatingDragStart(floatingPanel.panelId)"
      @drag-end="handleFloatingDragEnd"
      @drag="handleFloatingDrag"
    >
      <ViewControlPanel
        v-if="floatingPanel.panelId === 'view-control'"
        :camera-mode="rvizStore.sceneState.cameraMode"
        :show-grid="rvizStore.sceneState.showGrid"
        :show-axes="rvizStore.sceneState.showAxes"
        :show-robot="rvizStore.sceneState.showRobot"
        :show-map="rvizStore.sceneState.showMap"
        :show-laser="rvizStore.sceneState.showLaser"
        :background-color="rvizStore.sceneState.backgroundColor"
        :is-fullscreen="props.isFullscreen"
        @reset-camera="$emit('resetCamera')"
        @toggle-grid="$emit('toggleGrid')"
        @toggle-axes="$emit('toggleAxes')"
        @update:camera-mode="$emit('update:cameraMode', $event)"
        @update:show-robot="$emit('update:showRobot', $event)"
        @update:show-map="$emit('update:showMap', $event)"
        @update:show-laser="$emit('update:showLaser', $event)"
        @update:background-color="$emit('update:backgroundColor', $event)"
        @toggle-fullscreen="$emit('toggleFullscreen')"
      />

      <SceneInfoPanel
        v-else-if="floatingPanel.panelId === 'scene-info'"
        :fps="rvizStore.sceneState.fps"
        :camera-pos="rvizStore.sceneState.cameraPos"
        :object-count="rvizStore.sceneState.objectCount"
        :memory-usage="rvizStore.sceneState.memoryUsage"
        :texture-count="rvizStore.sceneState.textureCount"
      />

      <ToolPanel
        v-else-if="floatingPanel.panelId === 'tools'"
        :is-recording="rvizStore.sceneState.isRecording"
        :performance-mode="rvizStore.sceneState.performanceMode"
        :show-debug-info="rvizStore.sceneState.showDebugInfo"
        @take-screenshot="$emit('takeScreenshot')"
        @export-scene="$emit('exportScene')"
        @reset-scene="$emit('resetScene')"
        @toggle-recording="$emit('toggleRecording', $event)"
        @toggle-performance-mode="$emit('togglePerformanceMode', $event)"
        @toggle-debug-info="$emit('toggleDebugInfo', $event)"
      />

      <DisplayPanel
        v-else-if="floatingPanel.panelId === 'display'"
        @update:global-options="handleGlobalOptionsUpdate"
        @update:grid-options="handleGridOptionsUpdate"
        @update:axes-options="handleAxesOptionsUpdate"
        @add-display="handleAddDisplay"
        @duplicate-display="handleDuplicateDisplay"
        @remove-display="handleRemoveDisplay"
        @rename-display="handleRenameDisplay"
      />

      <RobotConnectionPanel
        v-else-if="floatingPanel.panelId === 'robot-connection'"
      />

      <!-- 图像面板 -->
      <ImageViewerPanel
        v-else-if="floatingPanel.panelId.startsWith('image-')"
        :component-id="floatingPanel.panelId.replace('image-', '')"
        :component-name="getPanelTitle(floatingPanel.panelId)"
        :topic="getImageComponentTopic(floatingPanel.panelId.replace('image-', ''))"
      />
    </FloatingPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import ViewControlPanel from './ViewControlPanel.vue'
import SceneInfoPanel from './SceneInfoPanel.vue'
import ToolPanel from './ToolPanel.vue'
import DisplayPanel from './DisplayPanel.vue'
import RobotConnectionPanel from './RobotConnectionPanel.vue'
import FloatingPanel from './FloatingPanel.vue'
import ImageViewerPanel from './ImageViewerPanel.vue'

// 使用RViz store
const rvizStore = useRvizStore()

// 使用store中的数据，减少props依赖
interface Props {
  isFullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullscreen: false
})

const handleGlobalOptionsUpdate = (options: any) => {
  emit('update:globalOptions', options)
}

const handleGridOptionsUpdate = (options: any) => {
  emit('update:gridOptions', options)
}

const handleAxesOptionsUpdate = (options: any) => {
  emit('update:axesOptions', options)
}

const handleAddDisplay = (name: string) => {
  emit('addDisplay', name)
}

const handleDuplicateDisplay = (itemId: string) => {
  emit('duplicateDisplay', itemId)
}

const handleRemoveDisplay = (itemId: string) => {
  emit('removeDisplay', itemId)
}

const handleRenameDisplay = (itemId: string, newName: string) => {
  emit('renameDisplay', itemId, newName)
}

const hasActivePanels = computed(() => {
  return rvizStore.panelConfig.enabledPanels.length > 0 || floatingPanels.value.length > 0 || imageComponents.value.length > 0
})

// 获取启用的面板列表
const enabledPanelsList = computed(() => {
  return rvizStore.panelConfig.enabledPanels
})

// 获取悬浮面板列表
const floatingPanels = computed(() => {
  return rvizStore.getFloatingPanels()
})

// 获取需要显示图像面板的组件（camera 和 image 类型）
const imageComponents = computed(() => {
  const allImageComponents = rvizStore.displayComponents.filter(
    component => (component.type === 'camera' || component.type === 'image') && component.enabled
  )
  
  // 如果有顺序配置，按照顺序排序
  const order = rvizStore.panelConfig.imagePanelOrder || []
  if (order.length > 0) {
    // 按照 order 数组排序，不在 order 中的组件放在最后
    const ordered = order
      .map(id => allImageComponents.find(c => c.id === id))
      .filter(c => c !== undefined) as typeof allImageComponents
    
    const unordered = allImageComponents.filter(c => !order.includes(c.id))
    return [...ordered, ...unordered]
  }
  
  return allImageComponents
})

// 获取可见的图像面板（排除已悬浮的）
const visibleImageComponents = computed(() => {
  const floatingPanelIds = new Set(floatingPanels.value.map(p => p.panelId))
  return imageComponents.value.filter(
    component => !floatingPanelIds.has(`image-${component.id}`)
  )
})

// 获取所有面板的统一列表（标准面板 + 图像面板）
const allPanelsList = computed(() => {
  type PanelItem = { id: string; type: 'standard' | 'image'; componentId?: string; name?: string; topic?: string }
  
  // 获取所有可见的标准面板
  const visibleStandardPanels = enabledPanelsList.value
  
  // 获取所有可见的图像面板（visibleImageComponents 已经过滤了悬浮的面板）
  const visibleImagePanels: PanelItem[] = visibleImageComponents.value.map(c => ({
    id: `image-${c.id}`,
    type: 'image' as const,
    componentId: c.id,
    name: c.name,
    topic: c.options?.topic
  }))
  
  // 获取统一顺序配置
  const order = rvizStore.panelConfig.allPanelsOrder || []
  
  if (order.length > 0) {
    // 按照顺序配置排序
    const orderedPanels: PanelItem[] = []
    const processedIds = new Set<string>()
    
    // 先添加顺序配置中的面板
    for (const panelId of order) {
      if (processedIds.has(panelId)) continue
      
      // 检查是否是标准面板
      if (visibleStandardPanels.includes(panelId)) {
        orderedPanels.push({ id: panelId, type: 'standard' })
        processedIds.add(panelId)
      }
      // 检查是否是图像面板
      else if (panelId.startsWith('image-')) {
        const componentId = panelId.replace('image-', '')
        const imagePanel = visibleImagePanels.find(p => p.componentId === componentId)
        if (imagePanel) {
          orderedPanels.push(imagePanel)
          processedIds.add(panelId)
        }
      }
    }
    
    // 添加未在顺序配置中的标准面板
    for (const panelId of visibleStandardPanels) {
      if (!processedIds.has(panelId)) {
        orderedPanels.push({ id: panelId, type: 'standard' })
      }
    }
    
    // 添加未在顺序配置中的图像面板
    for (const imagePanel of visibleImagePanels) {
      if (!processedIds.has(imagePanel.id)) {
        orderedPanels.push(imagePanel)
      }
    }
    
    return orderedPanels
  }
  
  // 如果没有顺序配置，先显示标准面板，再显示图像面板
  const standardPanels: PanelItem[] = visibleStandardPanels.map(id => ({ id, type: 'standard' as const }))
  return [...standardPanels, ...visibleImagePanels]
})

// 获取图像组件的 topic
const getImageComponentTopic = (componentId: string): string => {
  const component = rvizStore.displayComponents.find(c => c.id === componentId)
  return component?.options?.topic || ''
}

// 拖拽相关状态
const draggedPanelId = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)
const isDraggingFromFloating = ref(false)

// 获取面板标题
const getPanelTitle = (panelId: string): string => {
  // 处理图像面板 ID（格式：image-${componentId}）
  if (panelId.startsWith('image-')) {
    const componentId = panelId.replace('image-', '')
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    return component ? component.name : panelId
  }
  
  const titles: Record<string, string> = {
    'view-control': '视图控制',
    'scene-info': '场景信息',
    'tools': '工具面板',
    'display': '显示',
    'robot-connection': '机器人连接'
  }
  return titles[panelId] || panelId
}

// 拖拽开始（从 PanelManager）
const handleDragStart = (e: DragEvent, panelId: string) => {
  draggedPanelId.value = panelId
  isDraggingFromFloating.value = false
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', panelId)
  }
}

// 拖拽结束
const handleDragEnd = (e: DragEvent) => {
  if (!draggedPanelId.value) {
    draggedPanelId.value = null
    dragOverIndex.value = null
    isDraggingFromFloating.value = false
    return
  }
  
  // 如果拖拽到 PanelManager 外部（任意非 panel manager 区域），创建悬浮窗口
  if (!isDraggingFromFloating.value) {
    // 检查是否在 PanelManager 区域内
    const panelManager = document.querySelector('.panel-manager') as HTMLElement
    const isOverPanelManager = panelManager && 
      e.clientX >= panelManager.getBoundingClientRect().left &&
      e.clientX <= panelManager.getBoundingClientRect().right &&
      e.clientY >= panelManager.getBoundingClientRect().top &&
      e.clientY <= panelManager.getBoundingClientRect().bottom
    
    // 如果在 PanelManager 内部且有效插入位置，重新排序
    if (isOverPanelManager && dragOverIndex.value !== null && dragOverIndex.value >= 0) {
      const currentIndex = allPanelsList.value.findIndex(p => p.id === draggedPanelId.value)
      if (currentIndex >= 0 && currentIndex !== dragOverIndex.value) {
        rvizStore.reorderAllPanels(currentIndex, dragOverIndex.value)
      }
    }
    // 如果不在 PanelManager 区域内，创建悬浮窗口
    else if (!isOverPanelManager || dragOverIndex.value === null) {
      const panelManagerRect = panelManager?.getBoundingClientRect()
      // 使用鼠标位置作为初始位置（任意非 panel manager 区域）
      const x = Math.max(0, e.clientX - 50)
      const y = Math.max(0, e.clientY - 50)
      
      // 获取 PanelManager 的宽度作为悬浮面板的宽度（保持一致）
      const panelManagerWidth = panelManagerRect ? panelManagerRect.width - 32 : 268
      rvizStore.floatPanel(draggedPanelId.value, x, y, panelManagerWidth)
    }
  }
  
  draggedPanelId.value = null
  dragOverIndex.value = null
  isDraggingFromFloating.value = false
}

// 拖拽悬停（在 PanelManager 上）
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  
  if (!draggedPanelId.value) return
  
  // 计算插入位置
  const panelManager = e.currentTarget as HTMLElement
  const rect = panelManager.getBoundingClientRect()
  const y = e.clientY - rect.top
  
  // 找到应该插入的位置
  const panels = panelManager.querySelectorAll('.panel-wrapper')
  let insertIndex = panels.length
  
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i]
    if (panel instanceof HTMLElement) {
      const panelRect = panel.getBoundingClientRect()
      if (y < panelRect.top + panelRect.height / 2) {
        insertIndex = i
        break
      }
    }
  }
  
  dragOverIndex.value = insertIndex
}

// 放置（拖回 PanelManager）
const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  
  if (!draggedPanelId.value) return
  
  // 计算插入位置
  const panelManager = e.currentTarget as HTMLElement
  const rect = panelManager.getBoundingClientRect()
  const y = e.clientY - rect.top
  
  // 找到应该插入的位置
  const panels = panelManager.querySelectorAll('.panel-wrapper')
  let insertIndex = panels.length
  
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i]
    if (panel instanceof HTMLElement) {
      const panelRect = panel.getBoundingClientRect()
      if (y < panelRect.top + panelRect.height / 2) {
        insertIndex = i
        break
      }
    }
  }
  
  // 将面板从悬浮窗口移回
  if (isDraggingFromFloating.value) {
    // 图像面板通过关闭悬浮状态来回到 PanelManager，并指定插入位置
    if (draggedPanelId.value.startsWith('image-')) {
      rvizStore.closeFloatingPanel(draggedPanelId.value, insertIndex)
    } else {
      rvizStore.dockPanel(draggedPanelId.value, insertIndex)
    }
  }
  
  draggedPanelId.value = null
  dragOverIndex.value = null
  isDraggingFromFloating.value = false
}

// 悬浮面板拖拽开始
const handleFloatingDragStart = (panelId: string) => {
  draggedPanelId.value = panelId
  isDraggingFromFloating.value = true
}

// 悬浮面板拖拽中
const handleFloatingDrag = (e: DragEvent) => {
  if (!isDraggingFromFloating.value || !draggedPanelId.value) return
  
  const panelManager = document.querySelector('.panel-manager') as HTMLElement
  if (!panelManager) return
  
  const rect = panelManager.getBoundingClientRect()
  const isOverPanelManager = 
    e.clientX >= rect.left && 
    e.clientX <= rect.right && 
    e.clientY >= rect.top && 
    e.clientY <= rect.bottom
  
  if (isOverPanelManager) {
    const y = e.clientY - rect.top
    const panels = panelManager.querySelectorAll('.panel-wrapper')
    let index = panels.length
    
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]
      if (panel instanceof HTMLElement) {
        const panelRect = panel.getBoundingClientRect()
        if (y < panelRect.top + panelRect.height / 2) {
          index = i
          break
        }
      }
    }
    
    dragOverIndex.value = index
  } else {
    dragOverIndex.value = null
  }
}

// 悬浮面板拖拽结束
const handleFloatingDragEnd = () => {
  // 检查是否拖到了 PanelManager
  if (draggedPanelId.value && dragOverIndex.value !== null) {
    // 图像面板通过关闭悬浮状态来回到 PanelManager，并指定插入位置
    if (draggedPanelId.value.startsWith('image-')) {
      rvizStore.closeFloatingPanel(draggedPanelId.value, dragOverIndex.value)
    } else {
      rvizStore.dockPanel(draggedPanelId.value, dragOverIndex.value)
    }
  }
  
  draggedPanelId.value = null
  dragOverIndex.value = null
  isDraggingFromFloating.value = false
}

// 关闭悬浮面板
const handleCloseFloatingPanel = (panelId: string) => {
  rvizStore.closeFloatingPanel(panelId)
}

// 更新悬浮面板位置
const handleUpdateFloatingPosition = (panelId: string, x: number, y: number) => {
  rvizStore.updateFloatingPanelPosition(panelId, x, y)
}

// 监听全局拖拽事件
onMounted(() => {
  const handleGlobalDragOver = (e: DragEvent) => {
    const panelManager = document.querySelector('.panel-manager') as HTMLElement
    if (!panelManager) return
    
    const rect = panelManager.getBoundingClientRect()
    const isOverPanelManager = 
      e.clientX >= rect.left && 
      e.clientX <= rect.right && 
      e.clientY >= rect.top && 
      e.clientY <= rect.bottom
    
    // 从悬浮面板拖回
    if (isDraggingFromFloating.value && draggedPanelId.value) {
      if (isOverPanelManager) {
        const y = e.clientY - rect.top
        const panels = panelManager.querySelectorAll('.panel-wrapper')
        let index = panels.length
        
        for (let i = 0; i < panels.length; i++) {
          const panel = panels[i]
          if (panel instanceof HTMLElement) {
            const panelRect = panel.getBoundingClientRect()
            if (y < panelRect.top + panelRect.height / 2) {
              index = i
              break
            }
          }
        }
        
        dragOverIndex.value = index
      } else {
        dragOverIndex.value = null
      }
    }
    // 从 PanelManager 拖出
    else if (draggedPanelId.value && !isDraggingFromFloating.value) {
      if (!isOverPanelManager) {
        dragOverIndex.value = null
      }
    }
  }
  
  document.addEventListener('dragover', handleGlobalDragOver)
  
  onUnmounted(() => {
    document.removeEventListener('dragover', handleGlobalDragOver)
  })
})

const emit = defineEmits<{
  resetCamera: []
  toggleGrid: []
  toggleAxes: []
  'update:cameraMode': [value: string]
  'update:showRobot': [value: boolean]
  'update:showMap': [value: boolean]
  'update:showLaser': [value: boolean]
  'update:backgroundColor': [value: string]
  takeScreenshot: []
  exportScene: []
  resetScene: []
  toggleRecording: [value: boolean]
  togglePerformanceMode: [value: boolean]
  toggleDebugInfo: [value: boolean]
  toggleFullscreen: []
  'update:globalOptions': [options: any]
  'update:gridOptions': [options: any]
  'update:axesOptions': [options: any]
  addDisplay: [name: string]
  duplicateDisplay: [itemId: string]
  removeDisplay: [itemId: string]
  renameDisplay: [itemId: string, newName: string]
}>()
</script>

<style scoped>
.panel-manager {
  min-width: 200px;
  max-width: 600px;
  padding: 16px;
  background: #f5f7fa;
  overflow-y: auto;
  height: 100%;
  flex-shrink: 0;
  transition: width 0.2s ease;
  box-sizing: border-box;
}

.rviz-viewer.resizing .panel-manager {
  transition: none;
}

.panel-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  padding: 8px 0;
}

.panel-icon-small {
  font-size: 14px;
  margin-right: 6px;
}

.active-panels {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.panel-wrapper {
  position: relative;
  width: 100%;
  margin-bottom: 0;
  cursor: grab;
  transition: opacity 0.2s;
}

.panel-wrapper :deep(.base-panel) {
  width: 100%;
  margin-bottom: 0;
}

.panel-wrapper :deep(.el-card) {
  width: 100%;
  margin-bottom: 0;
}

.panel-wrapper.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.panel-wrapper[draggable="true"]:hover {
  outline: 2px dashed #409eff;
  outline-offset: 2px;
}

.insert-indicator {
  height: 2px;
  background: #409eff;
  margin: 4px 0;
  border-radius: 1px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>