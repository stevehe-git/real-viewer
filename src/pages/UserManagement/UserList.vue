<template>
  <div class="user-list">
    <div class="header">
      <h2>用户列表</h2>
      <el-button type="primary" @click="goToAddUser">
        <el-icon><Plus /></el-icon>
        添加用户
      </el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名或邮箱"
        style="width: 300px"
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <el-table
      :data="filteredUsers"
      style="width: 100%"
      v-loading="loading"
    >
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="email" label="邮箱" width="200" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="scope">
          <el-tag :type="getRoleTagType(scope.row.role)">
            {{ getRoleName(scope.row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
            {{ scope.row.status === 'active' ? '激活' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="scope">
          {{ formatDate(scope.row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="200">
        <template #default="scope">
          <el-button
            size="small"
            @click="editUser(scope.row)"
          >
            编辑
          </el-button>
          <el-button
            size="small"
            type="warning"
            @click="editPermissions(scope.row)"
          >
            权限
          </el-button>
          <el-button
            size="small"
            :type="scope.row.status === 'active' ? 'danger' : 'success'"
            @click="toggleUserStatus(scope.row)"
          >
            {{ scope.row.status === 'active' ? '禁用' : '激活' }}
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="deleteUser(scope.row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="totalUsers"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'

// 模拟用户数据接口
interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'manager' | 'user'
  status: 'active' | 'inactive'
  createdAt: string
}

const router = useRouter()
const loading = ref(false)
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalUsers = ref(0)

// 模拟用户数据
const users = ref<User[]>([
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-01 10:00:00'
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@example.com',
    role: 'manager',
    status: 'active',
    createdAt: '2024-01-02 14:30:00'
  },
  {
    id: 3,
    username: 'user1',
    email: 'user1@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2024-01-03 09:15:00'
  }
])

const filteredUsers = computed(() => {
  if (!searchKeyword.value) {
    return users.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
  }
  const filtered = users.value.filter(user =>
    user.username.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    user.email.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
  return filtered.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
})

const getRoleTagType = (role: string) => {
  switch (role) {
    case 'admin': return 'danger'
    case 'manager': return 'warning'
    case 'user': return 'success'
    default: return ''
  }
}

const getRoleName = (role: string) => {
  switch (role) {
    case 'admin': return '管理员'
    case 'manager': return '管理员'
    case 'user': return '普通用户'
    default: return role
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const goToAddUser = () => {
  router.push('/user-management/user-add')
}

const editUser = (user: User) => {
  router.push(`/user-management/user-edit/${user.id}`)
}

const editPermissions = (user: User) => {
  router.push(`/user-management/user-permissions/${user.id}`)
}

const toggleUserStatus = async (user: User) => {
  try {
    const action = user.status === 'active' ? '禁用' : '激活'
    await ElMessageBox.confirm(
      `确定要${action}用户 ${user.username} 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    // 模拟API调用
    loading.value = true
    setTimeout(() => {
      user.status = user.status === 'active' ? 'inactive' : 'active'
      loading.value = false
      ElMessage.success(`${action}成功`)
    }, 1000)
  } catch {
    // 用户取消操作
  }
}

const deleteUser = async (user: User) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 ${user.username} 吗？此操作不可恢复。`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    // 模拟API调用
    loading.value = true
    setTimeout(() => {
      const index = users.value.findIndex(u => u.id === user.id)
      if (index > -1) {
        users.value.splice(index, 1)
        totalUsers.value = users.value.length
      }
      loading.value = false
      ElMessage.success('删除成功')
    }, 1000)
  } catch {
    // 用户取消操作
  }
}

const handleSearch = () => {
  currentPage.value = 1
  totalUsers.value = filteredUsers.value.length
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

onMounted(() => {
  totalUsers.value = users.value.length
})
</script>

<style scoped>
.user-list {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-bar {
  margin-bottom: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>