<template>
  <div class="config-content">
    <!-- Global Status Section -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleGlobalStatus">
        <el-icon class="expand-icon" :class="{ expanded: globalStatusExpanded }">
          <ArrowRight />
        </el-icon>
        <el-icon class="status-icon" :class="globalStatus.class">
          <CircleCheck v-if="globalStatus.isOk" />
          <CircleClose v-else />
        </el-icon>
        <span class="sub-item-name" :class="globalStatus.class">
          Global Status: {{ globalStatus.text }}
        </span>
      </div>
      <div v-show="globalStatusExpanded" class="sub-item-content">
        <div class="status-item">
          <el-icon class="status-icon" :class="fixedFrameStatus.class">
            <CircleCheck v-if="fixedFrameStatus.isOk" />
            <CircleClose v-else />
          </el-icon>
          <span class="status-label" :class="fixedFrameStatus.class">Fixed Frame</span>
          <span class="status-message" :class="fixedFrameStatus.class">
            {{ fixedFrameStatus.message }}
          </span>
        </div>
      </div>
    </div>

    <!-- Global Options Section -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleGlobalOptions">
        <el-icon class="expand-icon" :class="{ expanded: globalOptionsExpanded }">
          <ArrowRight />
        </el-icon>
        <el-icon class="sub-item-icon">
          <Setting />
        </el-icon>
        <span class="sub-item-name">Global Options</span>
      </div>
      <div v-show="globalOptionsExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">Fixed Frame</span>
          <el-select
            :model-value="fixedFrame"
            @update:model-value="updateFixedFrame"
            size="small"
            class="config-value"
            filterable
          >
            <el-option
              v-for="frame in availableFrames"
              :key="frame"
              :label="frame"
              :value="frame"
            />
          </el-select>
        </div>
        <div class="config-row">
          <span class="config-label">Background Color</span>
          <div class="config-value color-config">
            <el-color-picker
              :model-value="backgroundColor"
              @update:model-value="updateBackgroundColor"
              size="small"
            />
            <span class="color-text">{{ formatColor(backgroundColor) }}</span>
          </div>
        </div>
        <div class="config-row">
          <span class="config-label">Frame Rate</span>
          <el-input-number
            :model-value="frameRate"
            @update:model-value="updateFrameRate"
            size="small"
            :min="1"
            :max="120"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Default Light</span>
          <el-switch
            :model-value="defaultLight"
            @update:model-value="updateDefaultLight"
            size="small"
            class="config-value"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { tfManager } from '@/services/tfManager'
import { ArrowRight, CircleClose, CircleCheck, Setting } from '@element-plus/icons-vue'

interface Props {
  componentId?: string
  options?: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const globalOptionsExpanded = ref(true) // 默认展开
const globalStatusExpanded = ref(true) // 默认展开 Global Status

// 获取数据更新触发器（用于响应式追踪）
const dataUpdateTrigger = tfManager.getDataUpdateTrigger()

// 获取固定帧（响应式）
const fixedFrame = computed(() => {
  // 访问触发器以确保响应式追踪
  dataUpdateTrigger.value
  return tfManager.getFixedFrameRef().value || 'map'
})

// 获取可用的 frames 列表
const availableFrames = computed(() => {
  // 访问触发器以确保响应式追踪
  dataUpdateTrigger.value
  return tfManager.getFramesRef().value || []
})

// 检查 Fixed Frame 是否有效
const isFixedFrameValid = computed(() => {
  const currentFixedFrame = fixedFrame.value
  if (!currentFixedFrame) return false
  const frames = availableFrames.value
  return frames.includes(currentFixedFrame)
})

// Fixed Frame 状态
const fixedFrameStatus = computed(() => {
  const isValid = isFixedFrameValid.value
  return {
    isOk: isValid,
    class: isValid ? 'status-ok' : 'status-error',
    message: isValid ? 'OK' : `Unknown frame ${fixedFrame.value}`
  }
})

// 全局状态
const globalStatus = computed(() => {
  const isValid = isFixedFrameValid.value
  return {
    isOk: isValid,
    class: isValid ? 'status-ok' : 'status-error',
    text: isValid ? 'Ok' : 'Error'
  }
})

const toggleGlobalOptions = () => {
  globalOptionsExpanded.value = !globalOptionsExpanded.value
}

const toggleGlobalStatus = () => {
  globalStatusExpanded.value = !globalStatusExpanded.value
}

// 获取背景颜色
const backgroundColor = computed(() => {
  return rvizStore.sceneState.backgroundColor ?? '#808080'
})

// 获取帧率
const frameRate = computed(() => {
  return rvizStore.sceneState.fps ?? 30
})

// 获取默认灯光（从 sceneState 或 options 中获取）
const defaultLight = computed(() => {
  // 如果 options 中有 defaultLight，优先使用
  if (props.options?.defaultLight !== undefined) {
    return props.options.defaultLight
  }
  // 否则从 sceneState 中获取（如果有的话）
  return (rvizStore.sceneState as any).defaultLight ?? true
})

const formatColor = (color: string): string => {
  if (color && color.indexOf('#') === 0) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `${r}; ${g}; ${b}`
  }
  return color
}

const updateFixedFrame = (value: string) => {
  tfManager.setFixedFrame(value)
}

const updateBackgroundColor = (value: string) => {
  rvizStore.sceneState.backgroundColor = value
}

const updateFrameRate = (value: number) => {
  rvizStore.sceneState.fps = value
}

const updateDefaultLight = (value: boolean) => {
  // 如果 componentId 存在，更新组件的 options
  if (props.componentId) {
    rvizStore.updateComponentOptions(props.componentId, { defaultLight: value })
  } else {
    // 否则更新 sceneState（如果支持的话）
    if ((rvizStore.sceneState as any).defaultLight !== undefined) {
      ;(rvizStore.sceneState as any).defaultLight = value
    }
  }
}
</script>

<style scoped>
.config-content {
  padding: 4px 0;
}

.config-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  min-height: 28px;
  font-size: 12px;
}

.config-label {
  flex: 1;
  color: #606266;
}

.config-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
}

.color-config {
  gap: 8px;
}

.color-text {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}

.display-sub-item {
  border-top: 1px solid #ebeef5;
  margin-top: 2px;
}

.sub-item-header {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 16px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  gap: 6px;
}

.sub-item-header:hover {
  background: #f0f2f5;
}

.expand-icon {
  font-size: 12px;
  color: #909399;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.sub-item-icon {
  font-size: 14px;
  flex-shrink: 0;
  color: #409eff;
}

.sub-item-name {
  flex: 1;
}

.sub-item-name.status-error {
  color: #f56c6c;
}

.sub-item-name.status-ok {
  color: #303133;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}

.status-item {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 8px;
  font-size: 12px;
  gap: 8px;
  min-height: 24px;
}

.status-item:hover {
  background: #f0f2f5;
}

.status-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon.status-error {
  color: #f56c6c;
}

.status-icon.status-ok {
  color: #67c23a;
}

.status-label {
  min-width: 100px;
  font-weight: 500;
}

.status-label.status-error {
  color: #f56c6c;
}

.status-label.status-ok {
  color: #303133;
}

.status-message {
  flex: 1;
  font-size: 11px;
}

.status-message.status-error {
  color: #f56c6c;
}

.status-message.status-ok {
  color: #303133;
}
</style>
