<template>
  <div class="topic-selector-wrapper">
    <el-select
      :model-value="modelValue || ''"
      @update:model-value="$emit('update:modelValue', $event || '')"
      size="small"
      class="config-value topic-select"
      filterable
      allow-create
      default-first-option
      :placeholder="placeholder"
      :loading="loadingTopics"
      @visible-change="handleVisibleChange"
    >
      <el-option
        v-for="topic in filteredTopics"
        :key="topic"
        :label="topic"
        :value="topic"
      />
      <el-option
        v-if="filteredTopics.length === 0 && !loadingTopics && !hasError"
        label="暂无可用话题"
        value=""
        disabled
      />
      <el-option
        v-if="hasError && filteredTopics.length === 0"
        label="rosapi 服务不可用（可手动输入话题）"
        value=""
        disabled
      />
      <el-option
        v-if="!hasError && filteredTopics.length === 0 && !loadingTopics && availableTopics.length === 0"
        label="暂无话题（可手动输入）"
        value=""
        disabled
      />
    </el-select>
    <el-button
      v-if="rvizStore.communicationState.isConnected"
      size="small"
      link
      class="refresh-btn"
      :loading="loadingTopics"
      @click="loadTopics"
      title="刷新话题列表"
    >
      <el-icon><Refresh /></el-icon>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { useRvizStore } from '@/stores/rviz'

interface Props {
  modelValue?: string | null
  componentType?: string
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  componentType: '',
  placeholder: '选择或输入话题'
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const rvizStore = useRvizStore()
const loadingTopics = ref(false)
const hasError = ref(false)
const availableTopics = ref<Array<{ topic: string; type: string }>>([])

// 组件类型到消息类型的映射
const COMPONENT_MESSAGE_TYPES: Record<string, string> = {
  image: 'sensor_msgs/Image',
  camera: 'sensor_msgs/Image',
  map: 'nav_msgs/OccupancyGrid',
  path: 'nav_msgs/Path',
  laserscan: 'sensor_msgs/LaserScan',
  pointcloud2: 'sensor_msgs/PointCloud2',
  marker: 'visualization_msgs/Marker'
}

// 根据组件类型过滤话题
const filteredTopics = computed(() => {
  const expectedType = props.componentType ? COMPONENT_MESSAGE_TYPES[props.componentType] : ''
  
  // 如果没有可用话题，返回空数组
  if (availableTopics.value.length === 0) {
    return []
  }
  
  // 如果没有指定组件类型，返回所有话题
  if (!expectedType) {
    return availableTopics.value.map(t => t.topic)
  }
  
  // 检查是否有任何话题有类型信息
  const topicsWithType = availableTopics.value.filter(t => t.type && t.type !== '')
  const hasTypeInfo = topicsWithType.length > 0
  
  // 过滤出匹配类型的话题
  let matchingTopics: string[] = []
  
  if (hasTypeInfo) {
    // 如果有类型信息，只显示匹配类型的话题（严格过滤）
    matchingTopics = availableTopics.value
      .filter(t => {
        // 必须有类型信息且完全匹配
        if (!t.type || t.type === '') {
          return false
        }
        // 只显示完全匹配类型的话题
        const matches = t.type === expectedType
        return matches
      })
      .map(t => t.topic)
  } else {
    // 如果没有任何话题有类型信息，显示所有话题（允许用户手动选择）
    matchingTopics = availableTopics.value.map(t => t.topic)
  }
  
  // 如果当前选择的话题不在过滤列表中，也包含它（允许手动输入）
  const currentTopic = props.modelValue || ''
  if (currentTopic && !matchingTopics.includes(currentTopic)) {
    matchingTopics.unshift(currentTopic)
  }
  
  return matchingTopics
})

// 获取话题列表
async function loadTopics() {
  const plugin = rvizStore.communicationState.currentPlugin
  const isConnected = rvizStore.communicationState.isConnected
  
  if (!plugin || !isConnected) {
    availableTopics.value = []
    return
  }

  loadingTopics.value = true
  hasError.value = false
  try {
    // 尝试获取话题和类型（如果插件支持）
    if (plugin.id === 'ros' && typeof (plugin as any).getTopicsAndTypes === 'function') {
      const topicsAndTypes = await (plugin as any).getTopicsAndTypes()
      if (Array.isArray(topicsAndTypes) && topicsAndTypes.length > 0) {
        // 验证数据格式
        const validTopics = topicsAndTypes.filter((t: any) => t && typeof t === 'object' && t.topic)
        if (validTopics.length > 0) {
          availableTopics.value = validTopics
          // 调试：检查类型信息
          const topicsWithType = validTopics.filter((t: any) => t.type && t.type !== '')
          console.log(`[TopicSelector] Loaded ${validTopics.length} topics, ${topicsWithType.length} with type info`)
          if (props.componentType) {
            const expectedType = COMPONENT_MESSAGE_TYPES[props.componentType]
            const matching = validTopics.filter((t: any) => t.type === expectedType)
            console.log(`[TopicSelector] Component type: ${props.componentType}, Expected: ${expectedType}, Matching: ${matching.length}`)
          }
        } else {
          availableTopics.value = []
        }
        hasError.value = false
      } else if (Array.isArray(topicsAndTypes)) {
        // 空数组不算错误，可能是真的没有话题
        availableTopics.value = []
        hasError.value = false
      } else {
        // 非数组结果可能是错误
        availableTopics.value = []
        hasError.value = false // 不标记为错误，允许手动输入
      }
    } else {
      // 回退到只获取话题列表
      if (typeof (plugin as any).getTopics === 'function') {
        const topics = await (plugin as any).getTopics()
        if (Array.isArray(topics)) {
          availableTopics.value = topics.length > 0
            ? topics.map((topic: string) => ({ topic, type: '' }))
            : []
          hasError.value = false
        } else {
          availableTopics.value = []
          hasError.value = true
        }
      } else {
        availableTopics.value = []
        hasError.value = false
      }
    }
  } catch (error) {
    console.error('[TopicSelector] Failed to load topics:', error)
    availableTopics.value = []
    hasError.value = true
  } finally {
    loadingTopics.value = false
  }
}

// 监听连接状态和插件变化
watch(
  () => [
    rvizStore.communicationState.isConnected,
    rvizStore.communicationState.currentPlugin
  ],
  ([isConnected, plugin]) => {
    if (isConnected && plugin) {
      // 延迟一下，确保连接完全建立
      setTimeout(() => {
        loadTopics()
      }, 500)
    } else {
      availableTopics.value = []
    }
  },
  { immediate: true, deep: true }
)

// 当下拉框打开时，刷新话题列表（避免频繁刷新）
let lastRefreshTime = 0
const REFRESH_INTERVAL = 2000 // 2秒内最多刷新一次

function handleVisibleChange(visible: boolean) {
  if (visible && rvizStore.communicationState.isConnected && rvizStore.communicationState.currentPlugin) {
    const now = Date.now()
    // 如果距离上次刷新时间超过间隔，才刷新
    if (now - lastRefreshTime > REFRESH_INTERVAL) {
      lastRefreshTime = now
      loadTopics()
    }
  }
}

// 组件挂载时加载话题
onMounted(() => {
  if (rvizStore.communicationState.isConnected && rvizStore.communicationState.currentPlugin) {
    // 延迟一下，确保连接完全建立
    setTimeout(() => {
      loadTopics()
    }, 500)
  }
})
</script>

<style scoped>
.topic-selector-wrapper {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
  gap: 4px;
}

.topic-select {
  flex: 1;
}

.refresh-btn {
  padding: 4px;
  min-width: auto;
  flex-shrink: 0;
}

.config-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
}
</style>
