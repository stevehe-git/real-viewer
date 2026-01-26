<template>
  <el-drawer
    v-model="visible"
    title="面板设置"
    :size="400"
  >
    <div class="panel-settings">
      <div class="setting-description">
        <p>选择要在右侧面板中显示的组件：</p>
      </div>

      <div class="setting-item" v-for="panel in availablePanels" :key="panel.id">
        <el-checkbox
          v-model="enabledPanels"
          :value="panel.id"
          @change="handlePanelChange"
        >
          <el-icon class="panel-icon-small">
            <component :is="panel.icon" />
          </el-icon>
          <span class="panel-name">{{ panel.title }}</span>
          <span class="panel-description">{{ panel.description }}</span>
        </el-checkbox>
      </div>

      <div class="settings-actions">
        <el-divider />
        <div class="action-buttons">
          <el-button @click="resetToDefault">重置为默认</el-button>
          <el-button type="primary" @click="applySettings">应用设置</el-button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { Monitor, InfoFilled, Tools, View } from '@element-plus/icons-vue'

// 使用RViz store
const rvizStore = useRvizStore()

interface Panel {
  id: string
  title: string
  description: string
  icon: any
}

interface Props {
  modelValue: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用 computed 来同步 v-model，避免循环更新和初始化问题
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const availablePanels = ref<Panel[]>([
  {
    id: 'view-control',
    title: '视图控制',
    description: '相机控制、显示选项、背景设置',
    icon: Monitor
  },
  {
    id: 'scene-info',
    title: '场景信息',
    description: 'FPS、相机位置、渲染统计',
    icon: InfoFilled
  },
  {
    id: 'tools',
    title: '工具面板',
    description: '截图、导出、录制等工具',
    icon: Tools
  },
  {
    id: 'display',
    title: '显示配置',
    description: 'Grid、Axes等显示项配置',
    icon: View
  },
  {
    id: 'robot-connection',
    title: '机器人连接',
    description: 'ROS、MQTT等协议连接管理',
    icon: Monitor
  }
])

const enabledPanels = ref<string[]>([...rvizStore.panelConfig.enabledPanels])

const handlePanelChange = () => {
  // 可以在这里添加实时更新逻辑
}

const resetToDefault = () => {
  enabledPanels.value = ['view-control', 'scene-info', 'tools']
}

const applySettings = () => {
  rvizStore.updatePanelConfig({ enabledPanels: [...enabledPanels.value] })
  visible.value = false
}

// 移除 handleClose，直接使用 v-model 控制

// 初始化时从localStorage加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('rviz-enabled-panels')
  if (saved) {
    enabledPanels.value = JSON.parse(saved)
  }
}

loadSettings()
</script>

<style scoped>
.panel-settings {
  padding: 20px 0;
}

.setting-description {
  margin-bottom: 20px;
}

.setting-description p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.setting-item {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fafafa;
}

.setting-item:hover {
  background: #f5f7fa;
}

.panel-icon-small {
  font-size: 16px;
  margin-right: 8px;
  color: #409eff;
}

.panel-name {
  font-weight: 500;
  color: #303133;
  margin-right: 8px;
}

.panel-description {
  color: #909399;
  font-size: 12px;
}

.settings-actions {
  margin-top: 30px;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
</style>