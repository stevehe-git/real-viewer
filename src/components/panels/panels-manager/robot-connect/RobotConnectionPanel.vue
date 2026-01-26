<template>
  <BasePanel title="机器人连接" :icon="Connection">
    <div class="connection-panel">
      <!-- 连接状态指示器 -->
      <div class="status-indicator" :class="{ connected: rvizStore.robotConnection.connected }">
        <el-icon>
          <component :is="rvizStore.robotConnection.connected ? CircleCheck : CircleClose" />
        </el-icon>
        <span>{{ rvizStore.robotConnection.connected ? '已连接' : '未连接' }}</span>
      </div>

      <!-- 协议选择 -->
      <div class="config-row">
        <span class="config-label">协议</span>
        <el-select
          v-model="selectedProtocol"
          @change="handleProtocolChange"
          size="small"
          class="config-value"
          placeholder="选择通信协议"
        >
          <el-option
            v-for="plugin in rvizStore.robotConnection.availablePlugins"
            :key="plugin.id"
            :label="plugin.name"
            :value="plugin.id"
          />
        </el-select>
      </div>

      <!-- 协议描述 -->
      <div v-if="selectedPlugin" class="protocol-description">
        <p><strong>{{ selectedPlugin.name }}</strong>: {{ selectedPlugin.description }}</p>
      </div>

      <!-- 动态参数配置 -->
      <div v-if="selectedPlugin" class="connection-params">
        <div
          v-for="param in selectedPlugin.getConnectionParams()"
          :key="param.key"
          class="config-row"
        >
          <span class="config-label">
            {{ param.label }}
            <el-tooltip v-if="param.description" :content="param.description" placement="right">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </span>

          <!-- 文本输入 -->
          <el-input
            v-if="param.type === 'text'"
            v-model="connectionParams[param.key]"
            :placeholder="param.placeholder"
            size="small"
            class="config-value"
            :disabled="rvizStore.robotConnection.connected"
          />

          <!-- 数字输入 -->
          <el-input-number
            v-else-if="param.type === 'number'"
            v-model="connectionParams[param.key]"
            :placeholder="param.placeholder"
            size="small"
            class="config-value"
            :min="1"
            :max="65535"
            :disabled="rvizStore.robotConnection.connected"
          />

          <!-- 密码输入 -->
          <el-input
            v-else-if="param.type === 'password'"
            v-model="connectionParams[param.key]"
            :placeholder="param.placeholder"
            type="password"
            size="small"
            class="config-value"
            :disabled="rvizStore.robotConnection.connected"
          />

          <!-- 选择器 -->
          <el-select
            v-else-if="param.type === 'select'"
            v-model="connectionParams[param.key]"
            :placeholder="param.placeholder"
            size="small"
            class="config-value"
            :disabled="rvizStore.robotConnection.connected"
          >
            <el-option
              v-for="option in param.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
      </div>

      <!-- 连接操作按钮 -->
      <div class="connection-actions">
        <el-button
          :type="rvizStore.robotConnection.connected ? 'danger' : 'primary'"
          :loading="connecting"
          @click="rvizStore.robotConnection.connected ? disconnect() : connect()"
          size="small"
          class="action-button"
        >
          {{ rvizStore.robotConnection.connected ? '断开连接' : '连接' }}
        </el-button>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import type { ConnectionParams } from '@/stores/types'
import BasePanel from '../../BasePanel.vue'
import { ElMessage } from 'element-plus'
import {
  Connection,
  CircleCheck,
  CircleClose,
  InfoFilled
} from '@element-plus/icons-vue'

// 使用RViz store
const rvizStore = useRvizStore()

// 本地状态
const selectedProtocol = ref('ros')
const connecting = ref(false)
const connectionParams = reactive<Partial<ConnectionParams>>({})

// 当前选中的插件
const selectedPlugin = computed(() => {
  return rvizStore.robotConnection.availablePlugins.find(p => p.id === selectedProtocol.value)
})

// 监听协议变化，更新参数
watch(selectedProtocol, (newProtocol) => {
  const plugin = rvizStore.robotConnection.availablePlugins.find(p => p.id === newProtocol)
  if (plugin) {
    // 重置参数为默认值
    const params = plugin.getConnectionParams()
    params.forEach(param => {
      connectionParams[param.key] = param.defaultValue
    })
  }
}, { immediate: true })

// 监听连接状态变化
watch(() => rvizStore.robotConnection.connected, (connected) => {
  connecting.value = false
  if (connected) {
    ElMessage.success('机器人连接成功！')
  } else {
    ElMessage.info('机器人连接已断开。')
  }
})

// 处理协议变更
const handleProtocolChange = () => {
  if (rvizStore.robotConnection.connected) {
    disconnect() // 切换协议时断开当前连接
  }
}

// 连接机器人
const connect = async () => {
  if (connecting.value || !selectedPlugin.value) return

  connecting.value = true
  try {
    // 构建完整的连接参数对象
    const params: ConnectionParams = {
      host: connectionParams.host || 'localhost',
      port: connectionParams.port || 9090,
      connected: false,
      ...connectionParams
    }

    const success = await rvizStore.connectRobot(selectedProtocol.value, params)
    if (!success) {
      throw new Error('连接失败')
    }
  } catch (error: any) {
    console.error('连接失败:', error)
    ElMessage.error(`连接失败: ${error.message || '未知错误'}`)
  } finally {
    connecting.value = false
  }
}

// 断开连接
const disconnect = () => {
  rvizStore.disconnectRobot()
}

</script>

<style scoped>
.connection-panel {
  padding: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
}

.status-indicator:not(.connected) {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

.status-indicator.connected {
  background-color: #f0f9ff;
  color: #67c23a;
  border: 1px solid #c6e2ff;
}

.config-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.config-label {
  min-width: 100px;
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-value {
  flex: 1;
}

.info-icon {
  font-size: 14px;
  color: #909399;
  cursor: help;
}

.protocol-description {
  margin-bottom: 16px;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
}

.connection-params {
  margin-bottom: 16px;
}

.connection-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.action-button {
  flex: 1;
}

.status-indicator:not(.connected) {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fab1a0;
}

.connection-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-section {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
}

.config-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.config-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-label {
  flex: 1;
  font-size: 12px;
  color: #606266;
  margin-right: 8px;
}

.config-value {
  flex: 2;
}

.connection-controls {
  display: flex;
  gap: 8px;
}


.protocol-description {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #f0f9ff;
  border: 1px solid #c6e2ff;
  border-radius: 4px;
  font-size: 12px;
  color: #409eff;
}

.protocol-description p {
  margin: 0;
  line-height: 1.4;
}
</style>