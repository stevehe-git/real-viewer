<template>
  <div class="map-list">
    <div class="page-header">
      <h2>地图管理</h2>
      <el-button type="primary" @click="createMap">
        <el-icon><Plus /></el-icon>
        创建地图
      </el-button>
    </div>

    <div class="filters">
      <el-input
        v-model="searchText"
        placeholder="搜索地图名称"
        style="width: 300px"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select v-model="typeFilter" placeholder="地图类型" style="width: 150px">
        <el-option label="全部" value="" />
        <el-option label="建筑地图" value="building" />
        <el-option label="室外地图" value="outdoor" />
        <el-option label="仓库地图" value="warehouse" />
        <el-option label="工厂地图" value="factory" />
      </el-select>

      <el-select v-model="statusFilter" placeholder="状态" style="width: 120px">
        <el-option label="全部" value="" />
        <el-option label="活跃" value="active" />
        <el-option label="草稿" value="draft" />
        <el-option label="归档" value="archived" />
      </el-select>
    </div>

    <div class="map-grid">
      <div
        v-for="map in filteredMaps"
        :key="map.id"
        class="map-card"
        @click="viewMap(map)"
      >
        <div class="map-preview">
          <div class="map-placeholder">
            <el-icon size="48"><MapLocation /></el-icon>
            <span>{{ map.name }}</span>
          </div>
        </div>

        <div class="map-info">
          <h3>{{ map.name }}</h3>
          <p class="map-description">{{ map.description }}</p>

          <div class="map-meta">
            <el-tag :type="getTypeColor(map.type)" size="small">
              {{ getTypeText(map.type) }}
            </el-tag>
            <el-tag :type="getStatusColor(map.status)" size="small">
              {{ getStatusText(map.status) }}
            </el-tag>
          </div>

          <div class="map-stats">
            <span>航点: {{ map.waypointCount }}</span>
            <span>面积: {{ map.area }}m²</span>
            <span>更新: {{ map.updateTime }}</span>
          </div>
        </div>

        <div class="map-actions">
          <el-button size="small" @click.stop="editMap(map)">编辑</el-button>
          <el-button size="small" type="success" @click.stop="exportMap(map)">导出</el-button>
          <el-dropdown @command="handleCommand" @click.stop>
            <el-button size="small">
              更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="{ action: 'duplicate', map: map }">
                  复制地图
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'backup', map: map }">
                  创建备份
                </el-dropdown-item>
                <el-dropdown-item :command="{ action: 'delete', map: map }" divided style="color: #f56c6c;">
                  删除地图
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="[12, 24, 48]"
      :total="totalMaps"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, MapLocation, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

// 数据
const loading = ref(false)
const searchText = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const totalMaps = ref(0)

// 模拟地图数据
const maps = ref([
  {
    id: 1,
    name: '主楼地图',
    type: 'building',
    status: 'active',
    description: '公司主楼1-5层地图，包含办公区域、生产车间和仓储区域',
    waypointCount: 45,
    area: 2500,
    createTime: '2024-01-10 09:00:00',
    updateTime: '2024-01-15 14:30:00'
  },
  {
    id: 2,
    name: '仓库地图',
    type: 'warehouse',
    status: 'active',
    description: '自动化仓库地图，包含货架区域和出入通道',
    waypointCount: 32,
    area: 1200,
    createTime: '2024-01-08 11:20:00',
    updateTime: '2024-01-14 16:45:00'
  },
  {
    id: 3,
    name: '工厂地图',
    type: 'factory',
    status: 'draft',
    description: '生产工厂地图，包含生产流水线和质检区域',
    waypointCount: 28,
    area: 1800,
    createTime: '2024-01-12 13:15:00',
    updateTime: '2024-01-13 10:20:00'
  },
  {
    id: 4,
    name: '室外停车场',
    type: 'outdoor',
    status: 'active',
    description: '室外停车场地图，包含充电桩和停车位标识',
    waypointCount: 18,
    area: 3000,
    createTime: '2024-01-05 15:30:00',
    updateTime: '2024-01-12 09:15:00'
  }
])

// 计算属性
const filteredMaps = computed(() => {
  let filtered = maps.value

  if (searchText.value) {
    filtered = filtered.filter(map =>
      map.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      map.description.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }

  if (typeFilter.value) {
    filtered = filtered.filter(map => map.type === typeFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(map => map.status === statusFilter.value)
  }

  return filtered
})

// 方法
const createMap = () => {
  router.push('/map-management/create')
}

const viewMap = (map: any) => {
  router.push(`/map-management/view/${map.id}`)
}

const editMap = (map: any) => {
  router.push(`/map-management/edit/${map.id}`)
}

const exportMap = (map: any) => {
  ElMessage.success(`正在导出地图: ${map.name}`)
  // 这里应该触发地图导出逻辑
}

const handleCommand = (command: any) => {
  const { action, map } = command

  switch (action) {
    case 'duplicate':
      duplicateMap(map)
      break
    case 'backup':
      backupMap(map)
      break
    case 'delete':
      deleteMap(map)
      break
  }
}

const duplicateMap = async (map: any) => {
  try {
    const newMap = {
      ...map,
      id: Date.now(),
      name: `${map.name}_副本`,
      status: 'draft',
      createTime: new Date().toLocaleString(),
      updateTime: new Date().toLocaleString()
    }
    maps.value.push(newMap)
    ElMessage.success('地图复制成功')
  } catch (error) {
    ElMessage.error('地图复制失败')
  }
}

const backupMap = (map: any) => {
  ElMessage.success(`正在创建地图备份: ${map.name}`)
  // 这里应该触发地图备份逻辑
}

const deleteMap = async (map: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除地图 "${map.name}" 吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const index = maps.value.findIndex(m => m.id === map.id)
    if (index > -1) {
      maps.value.splice(index, 1)
    }
    ElMessage.success(`地图 ${map.name} 已删除`)

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
  const colors: Record<string, string> = {
    building: 'primary',
    outdoor: 'success',
    warehouse: 'warning',
    factory: 'danger'
  }
  return colors[type] || 'info'
}

const getTypeText = (type: string) => {
  const texts: Record<string, string> = {
    building: '建筑',
    outdoor: '室外',
    warehouse: '仓库',
    factory: '工厂'
  }
  return texts[type] || type
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: 'success',
    draft: 'warning',
    archived: 'info'
  }
  return colors[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    active: '活跃',
    draft: '草稿',
    archived: '归档'
  }
  return texts[status] || status
}

onMounted(() => {
  totalMaps.value = maps.value.length
})
</script>

<style scoped>
.map-list {
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

.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.map-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  background: white;
}

.map-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.map-preview {
  height: 160px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.map-placeholder {
  text-align: center;
}

.map-placeholder .el-icon {
  display: block;
  margin-bottom: 8px;
}

.map-placeholder span {
  font-size: 14px;
  opacity: 0.9;
}

.map-info {
  padding: 16px;
}

.map-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.map-description {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.map-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.map-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.map-actions {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.el-pagination {
  text-align: center;
}
</style>