<template>
  <div class="config-content">
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { tfManager } from '@/services/tfManager'

interface Props {
  componentId?: string
  options?: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

// 获取固定帧（响应式）
const fixedFrame = computed(() => {
  return tfManager.getFixedFrameRef().value || 'map'
})

// 获取可用的 frames 列表
const availableFrames = computed(() => {
  return tfManager.getFramesRef().value || []
})

// 获取背景颜色
const backgroundColor = computed(() => {
  return rvizStore.sceneState.backgroundColor || '#808080'
})

// 获取帧率
const frameRate = computed(() => {
  return rvizStore.sceneState.fps || 60
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
</style>
