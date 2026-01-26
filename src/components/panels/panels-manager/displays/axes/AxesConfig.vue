<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Reference Frame</span>
      <el-select
        :model-value="options.referenceFrame || fixedFrame"
        @update:model-value="update('referenceFrame', $event)"
        size="small"
        class="config-value"
        placeholder="选择参考坐标系"
        filterable
      >
        <el-option 
          :label="`<Fixed Frame: ${fixedFrame}>`" 
          :value="fixedFrame" 
        />
        <el-option
          v-for="frame in availableFrames"
          :key="frame"
          :label="frame"
          :value="frame"
        />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Length</span>
      <el-input-number
        :model-value="options.length"
        @update:model-value="update('length', $event)"
        size="small"
        :min="0.1"
        :max="10"
        :step="0.1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Radius</span>
      <el-input-number
        :model-value="options.radius"
        @update:model-value="update('radius', $event)"
        size="small"
        :min="0.01"
        :max="0.5"
        :step="0.01"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Show Trail</span>
      <el-checkbox
        :model-value="options.showTrail"
        @update:model-value="update('showTrail', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Alpha</span>
      <el-input-number
        :model-value="options.alpha"
        @update:model-value="update('alpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { tfManager } from '@/services/tfManager'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

// 获取固定帧（使用响应式引用）
const fixedFrame = computed(() => {
  return tfManager.getFixedFrameRef().value || 'map'
})

// 获取所有可用的 frame 列表
const availableFrames = computed(() => {
  const frames = tfManager.getFrames()
  // 过滤掉固定帧（已经在第一个选项中显示）
  return frames.filter(frame => frame !== fixedFrame.value)
})

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}

// 监听固定帧变化，如果当前选择的 referenceFrame 是旧的固定帧，则更新为新的固定帧
watch(fixedFrame, (newFixedFrame, oldFixedFrame) => {
  if (props.options.referenceFrame === oldFixedFrame) {
    update('referenceFrame', newFixedFrame)
  }
})
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
</style>