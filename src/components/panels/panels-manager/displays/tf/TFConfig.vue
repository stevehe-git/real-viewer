<template>
  <div class="config-content">
    <!-- Show Names -->
    <div class="config-row">
      <span class="config-label">Show Names</span>
      <el-checkbox
        :model-value="options.showNames"
        @update:model-value="update('showNames', $event)"
        class="config-value"
      />
    </div>

    <!-- Show Axes -->
    <div class="config-row">
      <span class="config-label">Show Axes</span>
      <el-checkbox
        :model-value="options.showAxes"
        @update:model-value="update('showAxes', $event)"
        class="config-value"
      />
    </div>

    <!-- Show Arrows -->
    <div class="config-row">
      <span class="config-label">Show Arrows</span>
      <el-checkbox
        :model-value="options.showArrows"
        @update:model-value="update('showArrows', $event)"
        class="config-value"
      />
    </div>

    <!-- Marker Scale -->
    <div class="config-row">
      <span class="config-label">Marker Scale</span>
      <el-input-number
        :model-value="options.markerScale"
        @update:model-value="update('markerScale', $event)"
        size="small"
        :min="0.1"
        :max="10"
        :step="0.1"
        class="config-value"
      />
    </div>

    <!-- Marker Alpha -->
    <div class="config-row">
      <span class="config-label">Marker Alpha</span>
      <el-input-number
        :model-value="options.markerAlpha"
        @update:model-value="update('markerAlpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        class="config-value"
      />
    </div>

    <!-- Update Interval -->
    <div class="config-row">
      <span class="config-label">Update Interval</span>
      <el-input-number
        :model-value="options.updateInterval"
        @update:model-value="update('updateInterval', $event)"
        size="small"
        :min="0"
        :max="100"
        :step="0.1"
        class="config-value"
      />
    </div>

    <!-- Frame Timeout -->
    <div class="config-row">
      <span class="config-label">Frame Timeout</span>
      <el-input-number
        :model-value="options.frameTimeout"
        @update:model-value="update('frameTimeout', $event)"
        size="small"
        :min="0"
        :max="1000"
        :step="1"
        class="config-value"
      />
    </div>

    <!-- Filter (whitelist) -->
    <div class="config-row">
      <span class="config-label">Filter (whitelist)</span>
      <el-input
        :model-value="options.filterWhitelist"
        @update:model-value="update('filterWhitelist', $event)"
        size="small"
        class="config-value"
        placeholder=""
      />
    </div>

    <!-- Filter (blacklist) -->
    <div class="config-row">
      <span class="config-label">Filter (blacklist)</span>
      <el-input
        :model-value="options.filterBlacklist"
        @update:model-value="update('filterBlacklist', $event)"
        size="small"
        class="config-value"
        placeholder=""
      />
    </div>

    <!-- Frames Section -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleFrames">
        <el-icon class="expand-icon" :class="{ expanded: framesExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Frames</span>
      </div>
      <div v-show="framesExpanded" class="sub-item-content">
        <!-- All Enabled checkbox -->
        <div class="config-row">
          <span class="config-label">All Enabled</span>
          <el-checkbox
            :model-value="allFramesEnabled"
            @update:model-value="handleAllEnabledChange"
            class="config-value"
          />
        </div>

        <!-- Individual Frames List -->
        <div class="frames-list">
          <div
            v-for="frame in frames"
            :key="frame.name"
            class="frame-item"
          >
            <div class="frame-header" @click="toggleFrameExpanded(frame.name)">
              <el-icon class="frame-expand-icon" :class="{ expanded: expandedFrames.has(frame.name) }">
                <ArrowRight />
              </el-icon>
              <span class="frame-name">{{ frame.name }}</span>
              <el-checkbox
                :model-value="frame.enabled"
                @update:model-value="handleFrameEnabledChange(frame.name, $event)"
                @click.stop
                class="frame-checkbox"
              />
            </div>
            <!-- Frame Details (展开时显示) -->
            <div v-show="expandedFrames.has(frame.name)" class="frame-details">
              <!-- Parent -->
              <div class="frame-detail-row">
                <span class="frame-detail-label">Parent:</span>
                <span class="frame-detail-value">{{ frameInfo(frame.name).parent || 'None' }}</span>
              </div>
              
              <!-- Position -->
              <div class="frame-detail-section">
                <div class="frame-detail-header" @click="toggleDetailSection('position', frame.name)">
                  <el-icon class="detail-expand-icon" :class="{ expanded: expandedDetails.has(`position-${frame.name}`) }">
                    <ArrowRight />
                  </el-icon>
                  <span class="frame-detail-label">Position:</span>
                </div>
                <div v-show="expandedDetails.has(`position-${frame.name}`)" class="frame-detail-content">
                  <span class="frame-detail-value">
                    {{ formatPosition(frameInfo(frame.name).position) }}
                  </span>
                </div>
              </div>
              
              <!-- Orientation -->
              <div class="frame-detail-section">
                <div class="frame-detail-header" @click="toggleDetailSection('orientation', frame.name)">
                  <el-icon class="detail-expand-icon" :class="{ expanded: expandedDetails.has(`orientation-${frame.name}`) }">
                    <ArrowRight />
                  </el-icon>
                  <span class="frame-detail-label">Orientation:</span>
                </div>
                <div v-show="expandedDetails.has(`orientation-${frame.name}`)" class="frame-detail-content">
                  <span class="frame-detail-value">
                    {{ formatOrientation(frameInfo(frame.name).orientation) }}
                  </span>
                </div>
              </div>
              
              <!-- Relative Position -->
              <div class="frame-detail-section">
                <div class="frame-detail-header" @click="toggleDetailSection('relativePosition', frame.name)">
                  <el-icon class="detail-expand-icon" :class="{ expanded: expandedDetails.has(`relativePosition-${frame.name}`) }">
                    <ArrowRight />
                  </el-icon>
                  <span class="frame-detail-label">Relative Position:</span>
                </div>
                <div v-show="expandedDetails.has(`relativePosition-${frame.name}`)" class="frame-detail-content">
                  <span class="frame-detail-value">
                    {{ formatPosition(frameInfo(frame.name).relativePosition) }}
                  </span>
                </div>
              </div>
              
              <!-- Relative Orientation -->
              <div class="frame-detail-section">
                <div class="frame-detail-header" @click="toggleDetailSection('relativeOrientation', frame.name)">
                  <el-icon class="detail-expand-icon" :class="{ expanded: expandedDetails.has(`relativeOrientation-${frame.name}`) }">
                    <ArrowRight />
                  </el-icon>
                  <span class="frame-detail-label">Relative Orientation:</span>
                </div>
                <div v-show="expandedDetails.has(`relativeOrientation-${frame.name}`)" class="frame-detail-content">
                  <span class="frame-detail-value">
                    {{ formatOrientation(frameInfo(frame.name).relativeOrientation) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { ArrowRight } from '@element-plus/icons-vue'
import { tfManager } from '@/services/tfManager'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const framesExpanded = ref(false)
const expandedFrames = ref<Set<string>>(new Set())
const expandedDetails = ref<Set<string>>(new Set())

// 从options中获取frames列表，如果没有则从tfManager获取
const frames = computed(() => {
  if (props.options.frames && Array.isArray(props.options.frames) && props.options.frames.length > 0) {
    return props.options.frames
  }
  
  // 从tfManager获取frames列表
  const frameNames = tfManager.getFrames()
  
  return frameNames.map(name => ({
    name,
    enabled: props.options.frames?.find((f: any) => f.name === name)?.enabled ?? true
  }))
})

// 计算所有frames是否都启用
const allFramesEnabled = computed(() => {
  return frames.value.length > 0 && frames.value.every(frame => frame.enabled)
})

const toggleFrames = () => {
  framesExpanded.value = !framesExpanded.value
}

const handleAllEnabledChange = (value: boolean) => {
  const updatedFrames = frames.value.map(frame => ({
    ...frame,
    enabled: value
  }))
  update('frames', updatedFrames)
}

const handleFrameEnabledChange = (frameName: string, enabled: boolean) => {
  const updatedFrames = frames.value.map(frame =>
    frame.name === frameName ? { ...frame, enabled } : frame
  )
  update('frames', updatedFrames)
}

const toggleFrameExpanded = (frameName: string) => {
  if (expandedFrames.value.has(frameName)) {
    expandedFrames.value.delete(frameName)
  } else {
    expandedFrames.value.add(frameName)
  }
}

const toggleDetailSection = (section: string, frameName: string) => {
  const key = `${section}-${frameName}`
  if (expandedDetails.value.has(key)) {
    expandedDetails.value.delete(key)
  } else {
    expandedDetails.value.add(key)
  }
}

// 获取数据更新触发器（用于响应式追踪）
const dataUpdateTrigger = tfManager.getDataUpdateTrigger()

// 所有 frames 的详细信息（响应式）
const allFramesInfo = computed(() => {
  // 访问触发器以确保响应式追踪
  dataUpdateTrigger.value
  const fixedFrame = rvizStore.globalOptions.fixedFrame || 'map'
  
  const infoMap = new Map<string, ReturnType<typeof tfManager.getFrameInfo>>()
  frames.value.forEach(frame => {
    infoMap.set(frame.name, tfManager.getFrameInfo(frame.name, fixedFrame))
  })
  return infoMap
})

// 获取 frame 的详细信息（响应式）
const frameInfo = (frameName: string) => {
  return allFramesInfo.value.get(frameName) || {
    parent: null,
    position: null,
    orientation: null,
    relativePosition: null,
    relativeOrientation: null
  }
}

// 格式化位置显示
const formatPosition = (pos: { x: number; y: number; z: number } | null): string => {
  if (!pos) return 'N/A'
  return `${pos.x.toFixed(5)}; ${pos.y.toFixed(5)}; ${pos.z.toFixed(5)}`
}

// 格式化方向显示
const formatOrientation = (orient: { x: number; y: number; z: number; w: number } | null): string => {
  if (!orient) return 'N/A'
  return `${orient.x.toFixed(5)}; ${orient.y.toFixed(5)}; ${orient.z.toFixed(5)}; ${orient.w.toFixed(5)}`
}

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}

// 监听 frameTimeout 变化，更新 tfManager
watch(() => props.options.frameTimeout, (timeout) => {
  if (timeout !== undefined) {
    tfManager.setFrameTimeout(timeout)
  }
}, { immediate: true })
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

.sub-item-name {
  flex: 1;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}

.frames-list {
  max-height: 300px;
  overflow-y: auto;
}

.frame-item {
  font-size: 12px;
  color: #606266;
}

.frame-header {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 16px;
  gap: 6px;
  cursor: pointer;
}

.frame-header:hover {
  background: #f0f2f5;
}

.frame-expand-icon {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.frame-expand-icon.expanded {
  transform: rotate(90deg);
}

.frame-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frame-checkbox {
  flex-shrink: 0;
}

.frame-details {
  padding-left: 32px;
  background: #fafafa;
  border-top: 1px solid #ebeef5;
}

.frame-detail-row {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 8px;
  font-size: 11px;
  gap: 8px;
}

.frame-detail-section {
  border-top: 1px solid #ebeef5;
}

.frame-detail-header {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 8px;
  font-size: 11px;
  gap: 6px;
  cursor: pointer;
}

.frame-detail-header:hover {
  background: #f0f2f5;
}

.detail-expand-icon {
  font-size: 10px;
  color: #909399;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.detail-expand-icon.expanded {
  transform: rotate(90deg);
}

.frame-detail-label {
  color: #909399;
  min-width: 120px;
}

.frame-detail-value {
  color: #606266;
  font-family: monospace;
  font-size: 11px;
}

.frame-detail-content {
  padding: 4px 8px 4px 24px;
  font-size: 11px;
}
</style>
