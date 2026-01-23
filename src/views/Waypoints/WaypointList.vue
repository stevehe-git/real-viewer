<template>
  <div class="waypoint-list">
    <div class="page-header">
      <h2>航点管理</h2>
      <el-button type="primary" @click="createWaypoint">
        <el-icon><Plus /></el-icon>
        添加航点
      </el-button>
    </div>

    <div class="filters">
      <el-input
        v-model="searchText"
        placeholder="搜索航点名称"
        style="width: 300px"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select v-model="typeFilter" placeholder="航点类型" style="width: 150px">
        <el-option label="全部" value="" />
        <el-option label="导航点" value="navigation" />
        <el-option label="充电点" value="charging" />
        <el-option label="工作点" value="work" />
        <el-option label="停车点" value="parking" />
      </el-select>
    </div>

    <el-table
      :data="filteredWaypoints"
      style="width: 100%"
      v-loading="loading"
      height="600"
    >
      <el-table-column prop="name" label="航点名称" min-width="150" />
      <el-table-column prop="type" label="类型" width="120">
        <template #default="scope">
          <el-tag :type="getTypeColor(scope.row.type)">
            {{ getTypeText(scope.row.type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="坐标" min-width="200">
        <template #default="scope">
          <span>X: {{ scope.row.x.toFixed(2) }}, Y: {{ scope.row.y.toFixed(2) }}</span>
          <br>
          <small class="text-muted">角度: {{ scope.row.angle }}°</small>
        </template>
      </el-table-column>
      <el-table-column prop="floor" label="楼层" width="100" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="createTime" label="创建时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="scope">
          <el-button size="small" @click="editWaypoint(scope.row)">编辑</el-button>
          <el-button size="small" type="warning" @click="viewOnMap(scope.row)">地图查看</el-button>
          <el-dropdown @command="handleCommand">
            <el-button size="small">
              更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="{ action: 'duplicate', waypoint: scope.row }">
                  复制航点
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'export', waypoint: scope.row }">
                  导出数据
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'delete', waypoint: scope.row }" divided style="color: #f56c6c;">
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
      :total="totalWaypoints"
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
const typeFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalWaypoints = ref(0)

// 模拟航点数据
const waypoints = ref([
  {
    id: 1,
    name: '入口导航点',
    type: 'navigation',
    x: 10.5,
    y: 25.8,
    angle: 90,
    floor: '1F',
    description: '主入口导航点，用于机器人进出引导',
    createTime: '2024-01-15 09:30:00'
  },
  {
    id: 2,
    name: '充电站A',
    type: 'charging',
    x: 45.2,
    y: 12.3,
    angle: 0,
    floor: '1F',
    description: 'A区充电站，容量2个机器人同时充电',
    createTime: '2024-01-14 16:45:00'
  },
  {
    id: 3,
    name: '工作台1',
    type: 'work',
    x: 78.9,
    y: 56.7,
    angle: 45,
    floor: '2F',
    description: '生产工作台，用于装配任务',
    createTime: '2024-01-13 11:20:00'
  },
  {
    id: 4,
    name: '停车区B',
    type: 'parking',
    x: 23.4,
    y: 89.1,
    angle: 180,
    floor: '1F',
    description: '临时停车区域，可容纳5个机器人',
    createTime: '2024-01-12 14:15:00'
  }
])

// 计算属性
const filteredWaypoints = computed(() => {
  let filtered = waypoints.value

  if (searchText.value) {
    filtered = filtered.filter(waypoint =>
      waypoint.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      waypoint.description.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }

  if (typeFilter.value) {
    filtered = filtered.filter(waypoint => waypoint.type === typeFilter.value)
  }

  return filtered
})

// 方法
const createWaypoint = () => {
  router.push('/waypoints/create')
}

const editWaypoint = (waypoint: any) => {
  router.push(`/waypoints/edit/${waypoint.id}`)
}

const viewOnMap = (waypoint: any) => {
  router.push(`/map-management/view?waypoint=${waypoint.id}`)
}

const handleCommand = (command: any) => {
  const { action, waypoint } = command

  switch (action) {
    case 'duplicate':
      duplicateWaypoint(waypoint)
      break
    case 'export':
      exportWaypoint(waypoint)
      break
    case 'delete':
      deleteWaypoint(waypoint)
      break
  }
}

const duplicateWaypoint = async (waypoint: any) => {
  try {
    const newWaypoint = {
      ...waypoint,
      id: Date.now(),
      name: `${waypoint.name}_副本`,
      createTime: new Date().toLocaleString()
    }
    waypoints.value.push(newWaypoint)
    ElMessage.success('航点复制成功')
  } catch (error) {
    ElMessage.error('航点复制失败')
  }
}

const exportWaypoint = (waypoint: any) => {
  const dataStr = JSON.stringify(waypoint, null, 2)
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

  const exportFileDefaultName = `${waypoint.name}_航点数据.json`

  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', dataUri)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()

  ElMessage.success('航点数据导出成功')
}

const deleteWaypoint = async (waypoint: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除航点 "${waypoint.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const index = waypoints.value.findIndex(w => w.id === waypoint.id)
    if (index > -1) {
      waypoints.value.splice(index, 1)
    }
    ElMessage.success(`航点 ${waypoint.name} 已删除`)

  } catch (error) {
    // 用户取消操作
  }
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

// 工具方法
const getTypeColor = (type: string) => {
  const colors = {
    navigation: 'primary',
    charging: 'success',
    work: 'warning',
    parking: 'info'
  }
  return colors[type] || 'info'
}

const getTypeText = (type: string) => {
  const texts = {
    navigation: '导航点',
    charging: '充电点',
    work: '工作点',
    parking: '停车点'
  }
  return texts[type] || type
}

onMounted(() => {
  totalWaypoints.value = waypoints.value.length
})
</script>

<style scoped>
.waypoint-list {
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

.text-muted {
  color: #909399;
  font-size: 12px;
}

.el-pagination {
  margin-top: 20px;
  text-align: center;
}
</style>