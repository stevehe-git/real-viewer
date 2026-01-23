<template>
  <div class="task-execution">
    <div class="page-header">
      <div>
        <h2>{{ taskData.name }}</h2>
        <p class="task-description">{{ taskData.description }}</p>
      </div>
      <el-button @click="goBack">返回列表</el-button>
    </div>

    <div class="execution-content">
      <el-row :gutter="20">
        <!-- 任务信息面板 -->
        <el-col :span="8">
          <el-card class="info-card">
            <template #header>
              <div class="card-header">
                <el-icon><InfoFilled /></el-icon>
                <span>任务信息</span>
              </div>
            </template>

            <div class="info-item">
              <span class="label">任务类型:</span>
              <el-tag :type="getTaskTypeColor(taskData.type)">
                {{ getTaskTypeText(taskData.type) }}
              </el-tag>
            </div>

            <div class="info-item">
              <span class="label">优先级:</span>
              <el-tag :type="getPriorityColor(taskData.priority)">
                {{ getPriorityText(taskData.priority) }}
              </el-tag>
            </div>

            <div class="info-item">
              <span class="label">状态:</span>
              <el-tag :type="getStatusColor(taskData.status)">
                {{ getStatusText(taskData.status) }}
              </el-tag>
            </div>

            <div class="info-item">
              <span class="label">创建时间:</span>
              <span>{{ taskData.createTime }}</span>
            </div>

            <div class="info-item">
              <span class="label">执行时间:</span>
              <span>{{ taskData.scheduledTime }}</span>
            </div>
          </el-card>

          <!-- 执行控制面板 -->
          <el-card class="control-card">
            <template #header>
              <div class="card-header">
                <el-icon><Setting /></el-icon>
                <span>执行控制</span>
              </div>
            </template>

            <div class="control-buttons">
              <el-button
                type="primary"
                :loading="starting"
                @click="startExecution"
                :disabled="!canStart"
                style="width: 100%; margin-bottom: 10px;"
              >
                {{ taskData.status === 'running' ? '继续执行' : '开始执行' }}
              </el-button>

              <el-button
                @click="pauseExecution"
                :disabled="!canPause"
                style="width: 100%; margin-bottom: 10px;"
              >
                暂停执行
              </el-button>

              <el-button
                @click="stopExecution"
                :disabled="!canStop"
                style="width: 100%; margin-bottom: 10px;"
              >
                停止执行
              </el-button>

              <el-button
                type="danger"
                @click="emergencyStop"
                style="width: 100%;"
              >
                紧急停止
              </el-button>
            </div>
          </el-card>
        </el-col>

        <!-- 执行日志和状态面板 -->
        <el-col :span="16">
          <!-- 执行进度 -->
          <el-card class="progress-card">
            <template #header>
              <div class="card-header">
                <el-icon><PieChart /></el-icon>
                <span>执行进度</span>
              </div>
            </template>

            <div class="progress-section">
              <div class="progress-item">
                <span class="progress-label">总体进度:</span>
                <el-progress
                  :percentage="executionProgress.overall"
                  :status="executionProgress.status"
                  :stroke-width="12"
                />
              </div>

              <div class="progress-item">
                <span class="progress-label">当前步骤:</span>
                <span class="current-step">{{ currentStep }}</span>
              </div>

              <div class="progress-item">
                <span class="progress-label">预计完成时间:</span>
                <span>{{ estimatedCompletionTime }}</span>
              </div>
            </div>
          </el-card>

          <!-- 执行日志 -->
          <el-card class="log-card">
            <template #header>
              <div class="card-header">
                <el-icon><DocumentChecked /></el-icon>
                <span>执行日志</span>
                <el-button style="float: right; padding: 3px 0" type="text" @click="clearLogs">
                  清空日志
                </el-button>
              </div>
            </template>

            <div class="log-container" ref="logContainer">
              <div
                v-for="(log, index) in executionLogs"
                :key="index"
                class="log-item"
                :class="log.level"
              >
                <span class="log-time">{{ log.timestamp }}</span>
                <span class="log-level">[{{ log.level.toUpperCase() }}]</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 任务参数详情 -->
    <el-dialog
      v-model="paramsDialogVisible"
      title="任务参数详情"
      width="600px"
    >
      <div class="params-detail">
        <div v-if="taskData.type === 'inspection'">
          <p><strong>巡检区域:</strong> {{ getAreaText(taskData.params.inspectionArea) }}</p>
          <p><strong>巡检周期:</strong> {{ taskData.params.inspectionInterval }} 分钟</p>
        </div>

        <div v-if="taskData.type === 'transport'">
          <p><strong>起始位置:</strong> {{ taskData.params.startLocation }}</p>
          <p><strong>目标位置:</strong> {{ taskData.params.endLocation }}</p>
          <p><strong>货物类型:</strong> {{ getCargoTypeText(taskData.params.cargoType) }}</p>
          <p><strong>重量:</strong> {{ taskData.params.weight }} kg</p>
        </div>

        <div v-if="taskData.type === 'cleaning'">
          <p><strong>清洁区域:</strong> {{ taskData.params.cleaningArea }}</p>
          <p><strong>清洁类型:</strong> {{ getCleaningTypeText(taskData.params.cleaningType) }}</p>
        </div>

        <div v-if="taskData.type === 'maintenance'">
          <p><strong>维护设备:</strong> {{ taskData.params.equipment }}</p>
          <p><strong>维护类型:</strong> {{ getMaintenanceTypeText(taskData.params.maintenanceType) }}</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="paramsDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  InfoFilled,
  Setting,
  PieChart,
  DocumentChecked
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)
const starting = ref(false)
const paramsDialogVisible = ref(false)

// 日志容器引用
const logContainer = ref<HTMLElement>()

// 任务数据
const taskData = reactive({
  id: '',
  name: '',
  type: '',
  priority: 'medium',
  description: '',
  status: 'pending',
  createTime: '',
  scheduledTime: '',
  params: {
    inspectionArea: '',
    inspectionInterval: 60,
    startLocation: '',
    endLocation: '',
    cargoType: '',
    weight: 0,
    cleaningArea: '',
    cleaningType: '',
    equipment: '',
    maintenanceType: ''
  }
})

// 执行进度
const executionProgress = reactive({
  overall: 0,
  status: undefined as 'success' | 'exception' | undefined
})

// 执行日志
const executionLogs = ref<Array<{
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
}>>([])

// 当前步骤
const currentStep = ref('准备执行')

// 预计完成时间
const estimatedCompletionTime = ref('--')

// 定时器
let progressTimer: number | null = null
let logTimer: number | null = null

// 计算属性
const canStart = computed(() => {
  return ['pending', 'paused'].includes(taskData.status)
})

const canPause = computed(() => {
  return taskData.status === 'running'
})

const canStop = computed(() => {
  return ['running', 'paused'].includes(taskData.status)
})

// 方法
const goBack = () => {
  router.push('/task-management/task-list')
}

const loadTaskData = async () => {
  try {
    loading.value = true
    const taskId = route.params.id as string

    // 这里应该是API调用获取任务详情
    console.log('加载任务执行数据:', taskId)

    // 模拟数据
    const mockData = {
      id: taskId,
      name: '巡检任务A',
      type: 'inspection',
      priority: 'high',
      description: '对区域A进行常规巡检任务',
      status: 'pending',
      createTime: '2024-01-15 10:30:00',
      scheduledTime: '2024-01-15 14:00:00',
      params: {
        inspectionArea: 'area_a',
        inspectionInterval: 60
      }
    }

    Object.assign(taskData, mockData)

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 500))

  } catch (error) {
    ElMessage.error('加载任务数据失败')
    console.error('加载任务数据失败:', error)
  } finally {
    loading.value = false
  }
}

const startExecution = async () => {
  try {
    starting.value = true

    // 这里应该是API调用开始执行任务
    console.log('开始执行任务:', taskData.id)

    taskData.status = 'running'
    executionProgress.status = undefined

    // 模拟启动延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    ElMessage.success('任务开始执行')

    // 开始模拟进度更新
    startProgressSimulation()
    startLogSimulation()

  } catch (error) {
    ElMessage.error('启动任务失败')
    console.error('启动任务失败:', error)
  } finally {
    starting.value = false
  }
}

const pauseExecution = async () => {
  try {
    await ElMessageBox.confirm('确定要暂停任务执行吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    // 这里应该是API调用暂停任务
    taskData.status = 'paused'
    ElMessage.success('任务已暂停')

    // 停止进度更新
    stopProgressSimulation()

  } catch (error) {
    // 用户取消操作
  }
}

const stopExecution = async () => {
  try {
    await ElMessageBox.confirm('确定要停止任务执行吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    // 这里应该是API调用停止任务
    taskData.status = 'cancelled'
    executionProgress.status = 'exception'
    ElMessage.success('任务已停止')

    // 停止所有模拟
    stopProgressSimulation()
    stopLogSimulation()

  } catch (error) {
    // 用户取消操作
  }
}

const emergencyStop = async () => {
  try {
    await ElMessageBox.confirm('确定要紧急停止任务吗？这可能导致设备异常！', '危险', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    })

    // 这里应该是API调用紧急停止任务
    taskData.status = 'cancelled'
    executionProgress.status = 'exception'
    ElMessage.error('任务已紧急停止')

    // 停止所有模拟
    stopProgressSimulation()
    stopLogSimulation()

  } catch (error) {
    // 用户取消操作
  }
}

const startProgressSimulation = () => {
  let progress = 0
  const steps = ['准备执行', '初始化设备', '移动到起始位置', '开始巡检', '巡检中...', '完成巡检']

  progressTimer = setInterval(() => {
    progress += Math.random() * 15
    if (progress > 100) progress = 100

    executionProgress.overall = Math.round(progress)

    // 更新当前步骤
    const stepIndex = Math.floor((progress / 100) * steps.length)
    currentStep.value = steps[Math.min(stepIndex, steps.length - 1)]

    // 模拟完成时间
    const remainingTime = Math.max(0, (100 - progress) / 10)
    estimatedCompletionTime.value = remainingTime > 0 ? `${Math.ceil(remainingTime)}分钟` : '即将完成'

    if (progress >= 100) {
      executionProgress.status = 'success'
      taskData.status = 'completed'
      stopProgressSimulation()
      ElMessage.success('任务执行完成')
    }
  }, 2000)
}

const stopProgressSimulation = () => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

const startLogSimulation = () => {
  const logMessages = [
    { level: 'info', message: '任务开始执行' },
    { level: 'info', message: '初始化机器人系统' },
    { level: 'info', message: '连接设备成功' },
    { level: 'info', message: '开始移动到起始位置' },
    { level: 'success', message: '到达起始位置' },
    { level: 'info', message: '开始巡检流程' },
    { level: 'info', message: '巡检点1检查完成' },
    { level: 'warning', message: '巡检点2发现异常，已记录' },
    { level: 'info', message: '巡检点3检查完成' },
    { level: 'success', message: '巡检流程完成' },
    { level: 'info', message: '返回起始位置' },
    { level: 'success', message: '任务执行完成' }
  ]

  let logIndex = 0

  logTimer = setInterval(() => {
    if (logIndex < logMessages.length) {
      executionLogs.value.push({
        timestamp: new Date().toLocaleTimeString(),
        level: logMessages[logIndex].level as any,
        message: logMessages[logIndex].message
      })

      logIndex++

      // 自动滚动到底部
      nextTick(() => {
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight
        }
      })
    } else {
      stopLogSimulation()
    }
  }, 1500)
}

const stopLogSimulation = () => {
  if (logTimer) {
    clearInterval(logTimer)
    logTimer = null
  }
}

const clearLogs = () => {
  executionLogs.value = []
}

// 工具方法
const getTaskTypeColor = (type: string) => {
  const colors = {
    inspection: 'primary',
    transport: 'success',
    cleaning: 'warning',
    maintenance: 'danger'
  }
  return colors[type] || 'info'
}

const getTaskTypeText = (type: string) => {
  const texts = {
    inspection: '巡检',
    transport: '运输',
    cleaning: '清洁',
    maintenance: '维护'
  }
  return texts[type] || type
}

const getStatusColor = (status: string) => {
  const colors = {
    pending: 'info',
    running: 'primary',
    completed: 'success',
    paused: 'warning',
    cancelled: 'danger'
  }
  return colors[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    paused: '已暂停',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const getPriorityColor = (priority: string) => {
  const colors = {
    low: 'info',
    medium: 'warning',
    high: 'danger'
  }
  return colors[priority] || 'info'
}

const getPriorityText = (priority: string) => {
  const texts = {
    low: '低',
    medium: '中',
    high: '高'
  }
  return texts[priority] || priority
}

const getAreaText = (area: string) => {
  const areas = {
    area_a: '区域A',
    area_b: '区域B',
    area_c: '区域C'
  }
  return areas[area] || area
}

const getCargoTypeText = (type: string) => {
  const types = {
    normal: '普通货物',
    dangerous: '危险品',
    fragile: '易碎品'
  }
  return types[type] || type
}

const getCleaningTypeText = (type: string) => {
  const types = {
    regular: '常规清洁',
    deep: '深度清洁',
    disinfection: '消毒清洁'
  }
  return types[type] || type
}

const getMaintenanceTypeText = (type: string) => {
  const types = {
    routine: '例行维护',
    repair: '故障维修',
    upgrade: '升级维护'
  }
  return types[type] || type
}

onMounted(() => {
  loadTaskData()
})

onUnmounted(() => {
  stopProgressSimulation()
  stopLogSimulation()
})
</script>

<style scoped>
.task-execution {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.task-description {
  color: #606266;
  margin: 0;
  font-size: 14px;
}

.execution-content {
  margin-top: 20px;
}

.info-card,
.control-card,
.progress-card,
.log-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #303133;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.info-item .label {
  font-weight: 500;
  color: #606266;
}

.control-buttons {
  display: flex;
  flex-direction: column;
}

.progress-section {
  padding: 16px 0;
}

.progress-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.progress-item:last-child {
  margin-bottom: 0;
}

.progress-label {
  font-weight: 500;
  color: #606266;
  min-width: 100px;
}

.current-step {
  color: #409eff;
  font-weight: 500;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 12px;
}

.log-item {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 4px;
  padding: 2px 0;
}

.log-item.info {
  color: #409eff;
}

.log-item.warning {
  color: #e6a23c;
}

.log-item.error {
  color: #f56c6c;
}

.log-item.success {
  color: #67c23a;
}

.log-time {
  color: #909399;
  margin-right: 8px;
}

.log-level {
  font-weight: bold;
  margin-right: 8px;
  min-width: 60px;
  display: inline-block;
}

.params-detail p {
  margin: 8px 0;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
}

.params-detail p:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
</style>