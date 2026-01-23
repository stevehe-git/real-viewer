<template>
  <div class="user-permissions">
    <div class="header">
      <h2>用户权限管理 - {{ username }}</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <div class="permissions-content">
      <el-card class="permission-card">
        <template #header>
          <div class="card-header">
            <span>系统权限</span>
          </div>
        </template>

        <el-checkbox-group v-model="selectedPermissions" @change="handlePermissionChange">
          <el-row :gutter="20">
            <el-col :span="8" v-for="permission in systemPermissions" :key="permission.key">
              <el-checkbox :label="permission.key" :disabled="loading">
                {{ permission.label }}
              </el-checkbox>
              <div class="permission-desc">{{ permission.description }}</div>
            </el-col>
          </el-row>
        </el-checkbox-group>
      </el-card>

      <el-card class="permission-card">
        <template #header>
          <div class="card-header">
            <span>模块权限</span>
          </div>
        </template>

        <div class="module-permissions">
          <div v-for="module in modulePermissions" :key="module.key" class="module-item">
            <div class="module-header">
              <el-checkbox
                :model-value="isModuleFullySelected(module.key)"
                @change="toggleModulePermission(module.key, $event)"
                :disabled="loading"
              >
                {{ module.label }}
              </el-checkbox>
            </div>

            <div class="module-sub-permissions">
              <el-checkbox-group
                v-model="selectedPermissions"
                @change="handlePermissionChange"
              >
                <el-row :gutter="20">
                  <el-col :span="8" v-for="subPerm in module.subPermissions" :key="subPerm.key">
                    <el-checkbox :label="subPerm.key" :disabled="loading">
                      {{ subPerm.label }}
                    </el-checkbox>
                  </el-col>
                </el-row>
              </el-checkbox-group>
            </div>
          </div>
        </div>
      </el-card>

      <div class="action-buttons">
        <el-button
          type="primary"
          @click="savePermissions"
          :loading="loading"
        >
          保存权限
        </el-button>
        <el-button @click="resetPermissions">重置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const username = ref('')

const selectedPermissions = ref<string[]>([])

const systemPermissions = [
  {
    key: 'user_manage',
    label: '用户管理',
    description: '可以管理其他用户账号'
  },
  {
    key: 'system_config',
    label: '系统配置',
    description: '可以修改系统配置'
  },
  {
    key: 'data_export',
    label: '数据导出',
    description: '可以导出系统数据'
  },
  {
    key: 'logs_view',
    label: '日志查看',
    description: '可以查看系统日志'
  }
]

const modulePermissions = [
  {
    key: 'navigation',
    label: '导航模块',
    subPermissions: [
      { key: 'nav_view', label: '查看导航' },
      { key: 'nav_edit', label: '编辑导航' },
      { key: 'route_plan', label: '路径规划' },
      { key: 'waypoint_manage', label: '航点管理' }
    ]
  },
  {
    key: 'control',
    label: '控制模块',
    subPermissions: [
      { key: 'device_control', label: '设备控制' },
      { key: 'remote_control', label: '远程控制' },
      { key: 'cmd_history', label: '指令历史' },
      { key: 'status_monitor', label: '状态监控' }
    ]
  },
  {
    key: 'analysis',
    label: '分析模块',
    subPermissions: [
      { key: 'data_analysis', label: '数据分析' },
      { key: 'performance_report', label: '性能报告' },
      { key: 'statistics', label: '统计信息' },
      { key: 'trend_analysis', label: '趋势分析' }
    ]
  }
]

const isModuleFullySelected = (moduleKey: string) => {
  const module = modulePermissions.find(m => m.key === moduleKey)
  if (!module) return false

  return module.subPermissions.every(subPerm =>
    selectedPermissions.value.includes(subPerm.key)
  )
}

const toggleModulePermission = (moduleKey: string, checked: boolean) => {
  const module = modulePermissions.find(m => m.key === moduleKey)
  if (!module) return

  if (checked) {
    // 选中所有子权限
    module.subPermissions.forEach(subPerm => {
      if (!selectedPermissions.value.includes(subPerm.key)) {
        selectedPermissions.value.push(subPerm.key)
      }
    })
  } else {
    // 取消选中所有子权限
    module.subPermissions.forEach(subPerm => {
      const index = selectedPermissions.value.indexOf(subPerm.key)
      if (index > -1) {
        selectedPermissions.value.splice(index, 1)
      }
    })
  }
}

const handlePermissionChange = () => {
  // 处理权限变更逻辑
}

const savePermissions = async () => {
  loading.value = true

  // 模拟API调用
  setTimeout(() => {
    loading.value = false
    ElMessage.success('权限保存成功')
    router.push('/user-management/user-list')
  }, 1500)
}

const resetPermissions = () => {
  loadUserPermissions()
}

const loadUserPermissions = () => {
  const userId = route.params.id as string

  // 模拟获取用户权限数据
  loading.value = true
  setTimeout(() => {
    username.value = `user${userId}`

    // 模拟用户权限数据
    selectedPermissions.value = [
      'nav_view',
      'device_control',
      'data_analysis',
      'statistics'
    ]

    loading.value = false
  }, 1000)
}

const goBack = () => {
  router.push('/user-management/user-list')
}

onMounted(() => {
  loadUserPermissions()
})
</script>

<style scoped>
.user-permissions {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.permissions-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.permission-card {
  margin-bottom: 20px;
}

.card-header {
  font-weight: bold;
}

.permission-desc {
  font-size: 12px;
  color: #666;
  margin-left: 24px;
  margin-top: 4px;
}

.module-item {
  margin-bottom: 20px;
}

.module-header {
  margin-bottom: 15px;
  font-weight: bold;
}

.module-sub-permissions {
  margin-left: 24px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 30px;
}
</style>