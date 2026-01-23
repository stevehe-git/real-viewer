<template>
  <div class="task-list">
    <div class="page-header">
      <h2>任务列表</h2>
      <el-button type="primary" @click="goToCreate">
        <el-icon><Plus /></el-icon>
        创建任务
      </el-button>
    </div>

    <div class="filters">
      <el-input
        v-model="searchText"
        placeholder="搜索任务名称"
        style="width: 300px"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select v-model="statusFilter" placeholder="任务状态" style="width: 150px">
        <el-option label="全部" value="" />
        <el-option label="待执行" value="pending" />
        <el-option label="执行中" value="running" />
        <el-option label="已完成" value="completed" />
        <el-option label="已暂停" value="paused" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
    </div>

    <el-table
      :data="filteredTasks"
      style="width: 100%"
      v-loading="loading"
    >
      <el-table-column prop="name" label="任务名称" min-width="200" />
      <el-table-column prop="type" label="任务类型" width="120">
        <template #default="scope">
          <el-tag :type="getTaskTypeColor(scope.row.type)">
            {{ getTaskTypeText(scope.row.type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="getStatusColor(scope.row.status)">
            {{ getStatusText(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="100">
        <template #default="scope">
          <el-tag :type="getPriorityColor(scope.row.priority)">
            {{ getPriorityText(scope.row.priority) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="180" />
      <el-table-column prop="updateTime" label="更新时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="scope">
          <el-button
            size="small"
            @click="executeTask(scope.row)"
            :disabled="!canExecute(scope.row.status)"
          >
            执行
          </el-button>
          <el-button size="small" @click="editTask(scope.row)">编辑</el-button>
          <el-dropdown @command="handleCommand">
            <el-button size="small">
              更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="{ action: 'view', task: scope.row }">
                  查看详情
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'pause', task: scope.row }" :disabled="!canPause(scope.row.status)">
                  暂停
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'resume', task: scope.row }" :disabled="!canResume(scope.row.status)">
                  恢复
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'cancel', task: scope.row }" :disabled="!canCancel(scope.row.status)">
                  取消
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'delete', task: scope.row }" divided style="color: #f56c6c;">
                  删除
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="totalTasks"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

// 数据
const loading = ref(false)
const searchText = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalTasks = ref(0)

// 模拟任务数据
const tasks = ref([
  {
    id: 1,
    name: '巡检任务A',
    type: 'inspection',
    status: 'pending',
    priority: 'high',
    createTime: '2024-01-15 10:30:00',
    updateTime: '2024-01-15 10:30:00'
  },
  {
    id: 2,
    name: '运输任务B',
    type: 'transport',
    status: 'running',
    priority: 'medium',
    createTime: '2024-01-14 14:20:00',
    updateTime: '2024-01-15 09:15:00'
  },
  {
    id: 3,
    name: '清洁任务C',
    type: 'cleaning',
    status: 'completed',
    priority: 'low',
    createTime: '2024-01-13 16:45:00',
    updateTime: '2024-01-14 11:30:00'
  }
])

// 计算属性
const filteredTasks = computed(() => {
  let filtered = tasks.value

  if (searchText.value) {
    filtered = filtered.filter(task =>
      task.name.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }

  if (statusFilter.value) {
    filtered = filtered.filter(task => task.status === statusFilter.value)
  }

  return filtered
})

// 方法
const goToCreate = () => {
  router.push('/task-management/task-create')
}

const editTask = (task: any) => {
  router.push(`/task-management/task-edit/${task.id}`)
}

const executeTask = (task: any) => {
  router.push(`/task-management/task-execution/${task.id}`)
}

const handleCommand = (command: any) => {
  const { action, task } = command

  switch (action) {
    case 'view':
      ElMessage.info(`查看任务: ${task.name}`)
      break
    case 'pause':
      handlePauseTask(task)
      break
    case 'resume':
      handleResumeTask(task)
      break
    case 'cancel':
      handleCancelTask(task)
      break
    case 'delete':
      handleDeleteTask(task)
      break
  }
}

const handlePauseTask = async (task: any) => {
  try {
    // 这里应该是API调用
    task.status = 'paused'
    ElMessage.success(`任务 ${task.name} 已暂停`)
  } catch (error) {
    ElMessage.error('暂停任务失败')
  }
}

const handleResumeTask = async (task: any) => {
  try {
    // 这里应该是API调用
    task.status = 'running'
    ElMessage.success(`任务 ${task.name} 已恢复`)
  } catch (error) {
    ElMessage.error('恢复任务失败')
  }
}

const handleCancelTask = async (task: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消任务 "${task.name}" 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    // 这里应该是API调用
    task.status = 'cancelled'
    ElMessage.success(`任务 ${task.name} 已取消`)
  } catch (error) {
    // 用户取消操作
  }
}

const handleDeleteTask = async (task: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除任务 "${task.name}" 吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    // 这里应该是API调用
    const index = tasks.value.findIndex(t => t.id === task.id)
    if (index > -1) {
      tasks.value.splice(index, 1)
    }
    ElMessage.success(`任务 ${task.name} 已删除`)
  } catch (error) {
    // 用户取消操作
  }
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  // 这里应该重新获取数据
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
  // 这里应该重新获取数据
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

const canExecute = (status: string) => {
  return ['pending', 'paused'].includes(status)
}

const canPause = (status: string) => {
  return status === 'running'
}

const canResume = (status: string) => {
  return status === 'paused'
}

const canCancel = (status: string) => {
  return ['pending', 'running', 'paused'].includes(status)
}

onMounted(() => {
  // 这里应该获取任务列表数据
  totalTasks.value = tasks.value.length
})
</script>

<style scoped>
.task-list {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  color: #303133;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  align-items: center;
}

.el-pagination {
  margin-top: 20px;
  text-align: center;
}
</style>