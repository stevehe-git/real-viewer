<template>
  <BasePanel title="工具面板" :icon="Tools">
    <div class="tool-group">
      <el-button-group>
        <el-button size="small" @click="$emit('takeScreenshot')" title="截图">
          <el-icon><Camera /></el-icon>
        </el-button>
        <el-button size="small" @click="$emit('exportScene')" title="导出场景">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" @click="$emit('resetScene')" title="重置场景">
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </el-button-group>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-subtitle">配置管理</div>
      <el-button-group>
        <el-button size="small" @click="saveConfig" title="保存当前配置">
          <el-icon><DocumentCopy /></el-icon>
          保存
        </el-button>
        <el-button size="small" @click="exportConfig" title="导出配置">
          <el-icon><Upload /></el-icon>
          导出
        </el-button>
        <el-button size="small" @click="importConfig" title="导入配置">
          <el-icon><Download /></el-icon>
          导入
        </el-button>
      </el-button-group>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-item">
        <span>录制状态:</span>
        <el-switch
          v-model="localIsRecording"
          @change="$emit('toggleRecording', $event)"
          size="small"
        />
      </div>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-item">
        <span>性能模式:</span>
        <el-switch
          v-model="localPerformanceMode"
          @change="$emit('togglePerformanceMode', $event)"
          size="small"
        />
      </div>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-item">
        <span>调试信息:</span>
        <el-switch
          v-model="localShowDebugInfo"
          @change="$emit('toggleDebugInfo', $event)"
          size="small"
        />
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { ElMessage } from 'element-plus'
import BasePanel from './BasePanel.vue'
import { Tools, Camera, Download, RefreshRight, DocumentCopy, Upload } from '@element-plus/icons-vue'

// 使用RViz store
const rvizStore = useRvizStore()

interface Props {
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
}

const props = defineProps<Props>()

// 本地状态
const localIsRecording = ref(props.isRecording)
const localPerformanceMode = ref(props.performanceMode)
const localShowDebugInfo = ref(props.showDebugInfo)

// 监听props变化，更新本地状态
watch(() => props.isRecording, (newVal) => { localIsRecording.value = newVal })
watch(() => props.performanceMode, (newVal) => { localPerformanceMode.value = newVal })
watch(() => props.showDebugInfo, (newVal) => { localShowDebugInfo.value = newVal })

// 配置管理方法
const saveConfig = () => {
  rvizStore.saveCurrentConfig()
  ElMessage.success('配置已保存')
}

const exportConfig = () => {
  rvizStore.exportConfig()
  ElMessage.success('配置已导出')
}

const importConfig = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const configData = JSON.parse(e.target?.result as string)
          const success = rvizStore.importConfig(configData)
          if (success) {
            ElMessage.success('配置已导入，请刷新页面以应用')
          } else {
            ElMessage.error('配置导入失败')
          }
        } catch (error) {
          ElMessage.error('配置文件格式错误')
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

defineEmits<{
  takeScreenshot: []
  exportScene: []
  resetScene: []
  toggleRecording: [value: boolean]
  togglePerformanceMode: [value: boolean]
  toggleDebugInfo: [value: boolean]
}>()
</script>

<style scoped>
.tool-group {
  margin-bottom: 12px;
}

.tool-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.tool-item span {
  font-size: 12px;
  color: #606266;
}
</style>