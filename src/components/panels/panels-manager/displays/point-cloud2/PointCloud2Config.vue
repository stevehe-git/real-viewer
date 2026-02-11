<template>
  <div class="config-content">
    <!-- PointCloud2 Status Section -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="togglePointCloud2Status">
        <el-icon class="expand-icon" :class="{ expanded: pointCloud2StatusExpanded }">
          <ArrowRight />
        </el-icon>
        <el-icon class="status-icon" :class="pointCloud2OverallStatus.class">
          <CircleCheck v-if="pointCloud2OverallStatus.isOk" />
          <CircleClose v-else />
        </el-icon>
        <span class="sub-item-name" :class="pointCloud2OverallStatus.class">
          PointCloud2
          <span class="status-text" v-if="!pointCloud2OverallStatus.isOk">
            Status: {{ pointCloud2OverallStatus.text }}
          </span>
        </span>
      </div>
      <div v-show="pointCloud2StatusExpanded" class="sub-item-content">
        <!-- Points Status -->
        <div class="status-item">
          <el-icon class="status-icon status-ok">
            <CircleCheck />
          </el-icon>
          <span class="status-label status-ok">Points</span>
          <span class="status-message status-ok">
            {{ pointCloudSize > 0 ? `${pointCloudSize.toLocaleString()}` : 'OK' }}
          </span>
        </div>
        
        <!-- Transform Status -->
        <div class="status-item" v-if="transformStatus">
          <el-icon class="status-icon" :class="transformStatus.class">
            <CircleCheck v-if="transformStatus.isOk" />
            <CircleClose v-else />
          </el-icon>
          <span class="status-label" :class="transformStatus.class">
            Transform {{ transformStatus.sender ? `[sender=${transformStatus.sender}]` : '' }}
          </span>
          <span class="status-message" :class="transformStatus.class">
            {{ transformStatus.message }}
          </span>
        </div>
      </div>
    </div>

    <!-- Offset Section -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleOffset">
        <el-icon class="expand-icon" :class="{ expanded: offsetExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Offset</span>
        <span class="offset-value">{{ formatOffset() }}</span>
      </div>
      <div v-show="offsetExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">X</span>
          <el-input-number
            :model-value="options.offsetX ?? defaultOptions.offsetX ?? 0"
            @update:model-value="update('offsetX', $event)"
            size="small"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Y</span>
          <el-input-number
            :model-value="options.offsetY ?? defaultOptions.offsetY ?? 0"
            @update:model-value="update('offsetY', $event)"
            size="small"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Z</span>
          <el-input-number
            :model-value="options.offsetZ ?? defaultOptions.offsetZ ?? 0"
            @update:model-value="update('offsetZ', $event)"
            size="small"
            class="config-value"
          />
        </div>
      </div>
    </div>

    <div class="config-row">
      <span class="config-label">Topic</span>
      <TopicSelector
        :model-value="options.topic"
        @update:model-value="update('topic', $event)"
        :component-type="componentType"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Unreliable</span>
      <el-checkbox
        :model-value="options.unreliable"
        @update:model-value="update('unreliable', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Queue Size</span>
      <el-input-number
        :model-value="options.queueSize ?? defaultOptions.queueSize ?? 10"
        @update:model-value="update('queueSize', $event)"
        size="small"
        :min="1"
        :max="100"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Selectable</span>
      <el-checkbox
        :model-value="options.selectable"
        @update:model-value="update('selectable', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row highlight-row">
      <span class="config-label">Style</span>
      <el-select
        :model-value="options.style || defaultOptions.style || 'Points'"
        @update:model-value="update('style', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="Points" value="Points" />
        <el-option label="Squares" value="Squares" />
        <el-option label="Flat Squares" value="Flat Squares" />
        <el-option label="Spheres" value="Spheres" />
        <el-option label="Boxes" value="Boxes" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Size (Pixels)</span>
      <el-input-number
        :model-value="options.size ?? defaultOptions.size ?? 3"
        @update:model-value="update('size', $event)"
        size="small"
        :min="1"
        :max="100"
        :step="1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Alpha</span>
      <el-input-number
        :model-value="options.alpha ?? defaultOptions.alpha ?? 1"
        @update:model-value="update('alpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        :precision="1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Decay Time</span>
      <el-input-number
        :model-value="options.decayTime ?? defaultOptions.decayTime ?? 0"
        @update:model-value="update('decayTime', $event)"
        size="small"
        :min="0"
        :step="0.1"
        class="config-value"
        :precision="1"
        placeholder="无上限"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Position Transformer</span>
      <el-select
        :model-value="options.positionTransformer || defaultOptions.positionTransformer || 'XYZ'"
        @update:model-value="update('positionTransformer', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="XYZ" value="XYZ" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Color Transformer</span>
      <el-select
        :model-value="options.colorTransformer || defaultOptions.colorTransformer || 'Intensity'"
        @update:model-value="update('colorTransformer', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="Intensity" value="Intensity" />
        <el-option label="Axis" value="Axis" />
        <el-option label="Flat" value="Flat" />
      </el-select>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Axis'">
      <span class="config-label">AxisColor</span>
      <el-select
        :model-value="options.axisColor || defaultOptions.axisColor || 'Z'"
        @update:model-value="update('axisColor', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="X" value="X" />
        <el-option label="Y" value="Y" />
        <el-option label="Z" value="Z" />
      </el-select>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Axis'">
      <span class="config-label">Use rainbow</span>
      <el-checkbox
        :model-value="options.useRainbow"
        @update:model-value="update('useRainbow', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Axis' && options.useRainbow">
      <span class="config-label">Invert Rainbow</span>
      <el-checkbox
        :model-value="options.invertRainbow"
        @update:model-value="update('invertRainbow', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Axis' && !options.useRainbow">
      <span class="config-label">Min Color</span>
      <div class="config-value color-config">
        <el-color-picker
          :model-value="getColorString(options.minColor, defaultOptions.minColor)"
          @update:model-value="updateColor('minColor', $event)"
          size="small"
        />
        <span class="color-text">{{ formatColor(getColorString(options.minColor, defaultOptions.minColor)) }}</span>
      </div>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Axis' && !options.useRainbow">
      <span class="config-label">Max Color</span>
      <div class="config-value color-config">
        <el-color-picker
          :model-value="getColorString(options.maxColor, defaultOptions.maxColor)"
          @update:model-value="updateColor('maxColor', $event)"
          size="small"
        />
        <span class="color-text">{{ formatColor(getColorString(options.maxColor, defaultOptions.maxColor)) }}</span>
      </div>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Flat'">
      <span class="config-label">Color</span>
      <div class="config-value color-config">
        <el-color-picker
          :model-value="getColorString(options.flatColor || defaultOptions.flatColor || { r: 255, g: 255, b: 0 })"
          @update:model-value="updateColor('flatColor', $event)"
          size="small"
        />
        <span class="color-text">{{ formatColor(getColorString(options.flatColor || defaultOptions.flatColor || { r: 255, g: 255, b: 0 })) }}</span>
      </div>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity'">
      <span class="config-label">Channel Name</span>
      <el-input
        :model-value="options.channelName || defaultOptions.channelName || 'intensity'"
        @update:model-value="update('channelName', $event)"
        size="small"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity'">
      <span class="config-label">Use rainbow</span>
      <el-checkbox
        :model-value="options.useRainbow"
        @update:model-value="update('useRainbow', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && options.useRainbow">
      <span class="config-label">Invert Rainbow</span>
      <el-checkbox
        :model-value="options.invertRainbow"
        @update:model-value="update('invertRainbow', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.useRainbow">
      <span class="config-label">Min Color</span>
      <div class="config-value color-config">
        <el-color-picker
          :model-value="getColorString(options.minColor, defaultOptions.minColor)"
          @update:model-value="updateColor('minColor', $event)"
          size="small"
        />
        <span class="color-text">{{ formatColor(getColorString(options.minColor, defaultOptions.minColor)) }}</span>
      </div>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.useRainbow">
      <span class="config-label">Max Color</span>
      <div class="config-value color-config">
        <el-color-picker
          :model-value="getColorString(options.maxColor, defaultOptions.maxColor)"
          @update:model-value="updateColor('maxColor', $event)"
          size="small"
        />
        <span class="color-text">{{ formatColor(getColorString(options.maxColor, defaultOptions.maxColor)) }}</span>
      </div>
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity'">
      <span class="config-label">Autocompute Intensity Bounds</span>
      <el-checkbox
        :model-value="options.autocomputeIntensityBounds !== false"
        @update:model-value="update('autocomputeIntensityBounds', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.autocomputeIntensityBounds">
      <span class="config-label">Min Intensity</span>
      <el-input-number
        :model-value="options.minIntensity ?? defaultOptions.minIntensity ?? 0"
        @update:model-value="update('minIntensity', $event)"
        size="small"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.colorTransformer === 'Intensity' && !options.autocomputeIntensityBounds">
      <span class="config-label">Max Intensity</span>
      <el-input-number
        :model-value="options.maxIntensity ?? defaultOptions.maxIntensity ?? 0"
        @update:model-value="update('maxIntensity', $event)"
        size="small"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { tfManager } from '@/services/tfManager'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'
import { ArrowRight, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import TopicSelector from '../common/TopicSelector.vue'
import { getDefaultOptions } from '@/stores/display/displayComponent'

interface Props {
  componentId: string
  options: Record<string, any>
}

const componentType = 'pointcloud2'

const props = defineProps<Props>()
const rvizStore = useRvizStore()
const defaultOptions = getDefaultOptions('pointcloud2')

const pointCloud2StatusExpanded = ref(true) // 默认展开
const offsetExpanded = ref(false) // 默认折叠

// 获取数据更新触发器（用于响应式追踪）
const dataUpdateTrigger = tfManager.getDataUpdateTrigger()

// 获取固定帧
const fixedFrame = computed(() => {
  dataUpdateTrigger.value
  return tfManager.getFixedFrame() || 'map'
})

// 获取最新的 PointCloud2 消息
const latestMessage = computed(() => {
  return topicSubscriptionManager.getLatestMessage(props.componentId)
})

// 获取消息的 frame_id
const messageFrameId = computed(() => {
  const message = latestMessage.value
  return message?.header?.frame_id || null
})

// 计算点云大小（points 数量）
const pointCloudSize = computed(() => {
  const message = latestMessage.value
  if (!message) {
    return 0
  }
  
  // PointCloud2 消息的 points 数量 = width * height
  const width = message.width || 0
  const height = message.height || 0
  
  if (width > 0 && height > 0) {
    return width * height
  }
  
  // 如果没有 width 和 height，尝试从 data 长度和 point_step 计算
  const pointStep = message.point_step || 0
  const dataLength = message.data?.length || 0
  
  if (pointStep > 0 && dataLength > 0) {
    return Math.floor(dataLength / pointStep)
  }
  
  return 0
})

// Transform 状态
const transformStatus = computed(() => {
  const frameId = messageFrameId.value
  if (!frameId) {
    return null
  }
  
  const fixedFrameValue = fixedFrame.value
  const frameInfo = tfManager.getFrameInfo(frameId, fixedFrameValue)
  const isValid = frameInfo.position !== null && frameInfo.orientation !== null
  
  // 获取 sender（从消息中，如果有的话）
  const message = latestMessage.value
  const sender = message?.header?.sender || 'unknown_publisher'
  
  return {
    isOk: isValid,
    class: isValid ? 'status-ok' : 'status-error',
    sender: isValid ? null : sender,
    message: isValid 
      ? 'OK' 
      : `For frame [${frameId}]: No transform to fixed frame [${fixedFrameValue}]. TF error: [Could not find a connection between [${frameId}] and [${fixedFrameValue}]]`
  }
})

// PointCloud2 整体状态
const pointCloud2OverallStatus = computed(() => {
  const transform = transformStatus.value
  const hasError = transform && !transform.isOk
  
  return {
    isOk: !hasError,
    class: hasError ? 'status-error' : 'status-ok',
    text: hasError ? 'Error' : 'Ok'
  }
})

const togglePointCloud2Status = () => {
  pointCloud2StatusExpanded.value = !pointCloud2StatusExpanded.value
}

const toggleOffset = () => {
  offsetExpanded.value = !offsetExpanded.value
}

const formatOffset = () => {
  const x = props.options.offsetX || 0
  const y = props.options.offsetY || 0
  const z = props.options.offsetZ || 0
  return `${x}; ${y}; ${z}`
}

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}

// 将颜色对象转换为十六进制字符串
const getColorString = (color: any, defaultColor?: any): string => {
  const finalColor = color || defaultColor
  if (!finalColor) return '#000000'
  if (typeof finalColor === 'string') return finalColor
  const r = Math.round(finalColor.r || 0).toString(16).padStart(2, '0')
  const g = Math.round(finalColor.g || 0).toString(16).padStart(2, '0')
  const b = Math.round(finalColor.b || 0).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

// 更新颜色（从颜色选择器）
const updateColor = (key: string, hexColor: string) => {
  if (!hexColor) return
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  update(key, { r, g, b })
}

// 格式化颜色显示（RGB 值）
const formatColor = (color: string): string => {
  if (color && color.indexOf('#') === 0) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `${r}; ${g}; ${b}`
  }
  return color
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

.highlight-row {
  background-color: #e6f7ff;
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

.status-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon.status-ok {
  color: #67c23a;
}

.status-icon.status-error {
  color: #f56c6c;
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

.status-text {
  margin-left: 8px;
  font-weight: 500;
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

.status-label {
  min-width: 150px;
  font-weight: 500;
}

.status-label.status-ok {
  color: #303133;
}

.status-label.status-error {
  color: #f56c6c;
}

.status-message {
  flex: 1;
  font-size: 11px;
}

.status-message.status-ok {
  color: #303133;
}

.status-message.status-error {
  color: #f56c6c;
}

.offset-value {
  margin-left: auto;
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}
</style>