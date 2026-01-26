<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="floating-panel"
      :style="panelStyle"
      :draggable="draggable"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @drag="handleDrag"
      @mousedown="handleMouseDown"
    >
      <!-- 标题栏 -->
      <div 
        class="floating-panel-header" 
        :draggable="draggable"
      >
        <span class="panel-title">{{ panelTitle }}</span>
        <div class="panel-actions">
          <el-button
            size="small"
            type="text"
            @click="handleClose"
            class="close-btn"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
      
      <!-- 面板内容 -->
      <div class="floating-panel-content">
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

interface Props {
  panelId: string
  panelTitle: string
  visible: boolean
  x?: number
  y?: number
  width?: number
  height?: number
  draggable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  x: 100,
  y: 100,
  width: 268,
  height: 300,
  draggable: false
})

const emit = defineEmits<{
  close: []
  'update:position': [x: number, y: number]
  'drag-start': []
  'drag-end': []
  'drag': [e: DragEvent]
}>()

const currentPos = ref({ x: props.x, y: props.y })
const currentSize = ref({ width: props.width, height: props.height })

const panelStyle = computed(() => ({
  left: `${currentPos.value.x}px`,
  top: `${currentPos.value.y}px`,
  width: `${currentSize.value.width}px`,
  height: `${currentSize.value.height}px`
}))

// HTML5 拖拽API处理（用于拖回PanelManager）
const handleDragStart = (e: DragEvent) => {
  if (!props.draggable) return
  
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', props.panelId)
  }
  emit('drag-start')
}

const handleDrag = (e: DragEvent) => {
  if (!props.draggable) return
  emit('drag', e)
}

const handleDragEnd = () => {
  if (props.draggable) {
    emit('drag-end')
  }
}

const handleMouseDown = (e: MouseEvent) => {
  // 点击面板内容区域时，将面板置于最前
  const panel = e.currentTarget as HTMLElement
  if (panel) {
    panel.style.zIndex = `${Date.now()}`
  }
}

const handleClose = () => {
  emit('close')
}

onMounted(() => {
  currentPos.value = { x: props.x, y: props.y }
  currentSize.value = { width: props.width, height: props.height }
})

// 监听位置变化
watch(() => props.x, (newX) => {
  currentPos.value.x = newX
})

watch(() => props.y, (newY) => {
  currentPos.value.y = newY
})

watch(() => props.width, (newWidth) => {
  currentSize.value.width = newWidth
})

watch(() => props.height, (newHeight) => {
  currentSize.value.height = newHeight
})
</script>

<style scoped>
.floating-panel {
  position: fixed;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 200px;
  min-height: 200px;
}

.floating-panel :deep(.base-panel) {
  width: 100%;
  margin-bottom: 0;
  border: none;
  box-shadow: none;
}

.floating-panel :deep(.el-card) {
  width: 100%;
  margin-bottom: 0;
  border: none;
  box-shadow: none;
}

/* 隐藏 BasePanel 的标题栏（在 FloatingPanel 中） */
.floating-panel :deep(.el-card__header) {
  display: none;
}

.floating-panel :deep(.el-card__body) {
  padding: 0;
}

.floating-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  cursor: grab;
  user-select: none;
}

.floating-panel[draggable="true"] .floating-panel-header {
  cursor: grab;
}

.floating-panel[draggable="true"] .floating-panel-header:active {
  cursor: grabbing;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.close-btn {
  padding: 4px;
  color: #909399;
}

.close-btn:hover {
  color: #303133;
}

.floating-panel-content {
  flex: 1;
  overflow: auto;
  padding: 12px;
}
</style>