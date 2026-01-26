<template>
  <el-drawer
    v-model="visible"
    title="Create visualization"
    :size="400"
    :before-close="handleClose"
  >
    <div class="display-type-selector">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="By display type" name="type">
          <div class="category-section">
            <div
              v-for="category in categories"
              :key="category.name"
              class="category-item"
            >
              <div class="category-header" @click="toggleCategory(category.name)">
                <el-icon class="expand-icon" :class="{ expanded: expandedCategories[category.name] }">
                  <ArrowRight />
                </el-icon>
                <span>{{ category.name }}</span>
              </div>
              <div v-show="expandedCategories[category.name]" class="category-content">
                <div
                  v-for="type in category.types"
                  :key="type.id"
                  class="display-type-item"
                  @click="selectType(type)"
                  :class="{ selected: selectedType?.id === type.id }"
                >
                  <el-icon class="type-icon">
                    <component :is="type.icon" />
                  </el-icon>
                  <span class="type-name">{{ type.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="By topic" name="topic">
          <div class="topic-section">
            <el-input
              v-model="topicSearch"
              placeholder="Search topics..."
              size="small"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <div class="topic-list">
              <div
                v-for="topic in filteredTopics"
                :key="topic"
                class="topic-item"
                @click="selectTopic(topic)"
              >
                {{ topic }}
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <div v-if="selectedType" class="type-description">
        <el-divider />
        <div class="description-title">Description:</div>
        <div class="description-content">{{ selectedType.description }}</div>
      </div>

      <div class="selector-actions">
        <el-divider />
        <div class="action-buttons">
          <el-button @click="handleClose">Cancel</el-button>
          <el-button type="primary" :disabled="!selectedType" @click="confirmSelection">
            OK
          </el-button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  ArrowRight,
  Search,
  Grid,
  Position,
  Camera,
  Connection,
  Location,
  Picture,
  DataLine,
  Monitor,
  Files,
  Share,
  Box
} from '@element-plus/icons-vue'

interface DisplayType {
  id: string
  name: string
  icon: any
  description: string
  category: string
}

interface Props {
  modelValue: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
  'select': [type: DisplayType]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = ref(false)
const activeTab = ref('type')
const selectedType = ref<DisplayType | null>(null)
const topicSearch = ref('')

// 监听visible变化
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

const expandedCategories = reactive<Record<string, boolean>>({
  'rviz': true,
  'tf': false,
  'rviz_msgs': false
})

const categories = ref([
  {
    name: 'rviz',
    types: [
      {
        id: 'grid',
        name: 'Grid',
        icon: Grid,
        description: 'Displays a grid in a fixed frame.',
        category: 'rviz'
      },
      {
        id: 'axes',
        name: 'Axes',
        icon: Position,
        description: 'Displays a set of axes.',
        category: 'rviz'
      },
      {
        id: 'camera',
        name: 'Camera',
        icon: Camera,
        description: 'Displays an image from a camera.',
        category: 'rviz'
      },
      {
        id: 'map',
        name: 'Map',
        icon: Files,
        description: 'Displays a map.',
        category: 'rviz'
      },
      {
        id: 'path',
        name: 'Path',
        icon: Connection,
        description: 'Displays a path from a nav_msgs/Path message.',
        category: 'rviz'
      },
      {
        id: 'marker',
        name: 'Marker',
        icon: Location,
        description: 'Displays markers from a visualization_msgs/Marker message.',
        category: 'rviz'
      },
      {
        id: 'image',
        name: 'Image',
        icon: Picture,
        description: 'Displays an image from a sensor_msgs/Image message.',
        category: 'rviz'
      },
      {
        id: 'laserscan',
        name: 'LaserScan',
        icon: DataLine,
        description: 'Displays a sensor_msgs/LaserScan message.',
        category: 'rviz'
      },
      {
        id: 'pointcloud2',
        name: 'PointCloud2',
        icon: Monitor,
        description: 'Displays a sensor_msgs/PointCloud2 message.',
        category: 'rviz'
      },
      {
        id: 'tf',
        name: 'TF',
        icon: Share,
        description: 'Displays the transform tree.',
        category: 'rviz'
      },
      {
        id: 'robotmodel',
        name: 'RobotModel',
        icon: Box,
        description: 'Displays a robot model from a URDF file.',
        category: 'rviz'
      }
    ]
  }
])

const topics = ref<string[]>([
  '/map',
  '/scan',
  '/camera/rgb/image_raw',
  '/odom',
  '/path',
  '/marker',
  '/pointcloud'
])

const filteredTopics = computed(() => {
  if (!topicSearch.value) return topics.value
  return topics.value.filter((topic: string) => 
    topic.toLowerCase().indexOf(topicSearch.value.toLowerCase()) !== -1
  )
})

const toggleCategory = (categoryName: string) => {
  expandedCategories[categoryName] = !expandedCategories[categoryName]
}

const selectType = (type: DisplayType) => {
  selectedType.value = type
}

const selectTopic = (topic: string) => {
  // 根据topic推断显示类型
  if (topic.indexOf('image') !== -1) {
    selectedType.value = categories.value[0].types.find((t: DisplayType) => t.id === 'image') || null
  } else if (topic.indexOf('scan') !== -1) {
    selectedType.value = categories.value[0].types.find((t: DisplayType) => t.id === 'laserscan') || null
  } else if (topic.indexOf('pointcloud') !== -1) {
    selectedType.value = categories.value[0].types.find((t: DisplayType) => t.id === 'pointcloud2') || null
  } else if (topic.indexOf('path') !== -1) {
    selectedType.value = categories.value[0].types.find((t: DisplayType) => t.id === 'path') || null
  } else if (topic.indexOf('map') !== -1) {
    selectedType.value = categories.value[0].types.find((t: DisplayType) => t.id === 'map') || null
  }
}

const confirmSelection = () => {
  if (selectedType.value) {
    emit('select', selectedType.value)
    visible.value = false
    selectedType.value = null
  }
}

const handleClose = (done?: () => void) => {
  selectedType.value = null
  if (done) {
    done()
  } else {
    visible.value = false
  }
}
</script>

<style scoped>
.display-type-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.category-section {
  flex: 1;
  overflow-y: auto;
}

.category-item {
  margin-bottom: 8px;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 500;
  color: #303133;
  user-select: none;
}

.category-header:hover {
  background: #f5f7fa;
}

.expand-icon {
  font-size: 12px;
  margin-right: 8px;
  transition: transform 0.2s;
  color: #909399;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.category-content {
  padding-left: 20px;
}

.display-type-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.display-type-item:hover {
  background: #f0f9ff;
}

.display-type-item.selected {
  background: #e1f3ff;
  border: 1px solid #409eff;
}

.type-icon {
  font-size: 16px;
  margin-right: 8px;
  color: #409eff;
}

.type-name {
  font-size: 13px;
  color: #303133;
}

.topic-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topic-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
}

.topic-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
}

.topic-item:hover {
  background: #f0f9ff;
  color: #409eff;
}

.type-description {
  padding: 12px 0;
}

.description-title {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  margin-bottom: 8px;
}

.description-content {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}

.selector-actions {
  flex-shrink: 0;
  margin-top: auto;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>