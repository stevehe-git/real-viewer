<template>
  <div class="user-add">
    <div class="header">
      <h2>添加用户</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <el-form
      ref="userFormRef"
      :model="userForm"
      :rules="rules"
      label-width="120px"
      class="user-form"
    >
      <el-form-item label="用户名" prop="username">
        <el-input
          v-model="userForm.username"
          placeholder="请输入用户名"
          :disabled="loading"
        />
      </el-form-item>

      <el-form-item label="邮箱" prop="email">
        <el-input
          v-model="userForm.email"
          placeholder="请输入邮箱地址"
          :disabled="loading"
        />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input
          v-model="userForm.password"
          type="password"
          placeholder="请输入密码"
          :disabled="loading"
          show-password
        />
      </el-form-item>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="userForm.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          :disabled="loading"
          show-password
        />
      </el-form-item>

      <el-form-item label="角色" prop="role">
        <el-select
          v-model="userForm.role"
          placeholder="请选择角色"
          :disabled="loading"
        >
          <el-option label="管理员" value="admin" />
          <el-option label="管理员" value="manager" />
          <el-option label="普通用户" value="user" />
        </el-select>
      </el-form-item>

      <el-form-item label="状态">
        <el-radio-group v-model="userForm.status" :disabled="loading">
          <el-radio label="active">激活</el-radio>
          <el-radio label="inactive">禁用</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          @click="submitForm"
          :loading="loading"
        >
          添加用户
        </el-button>
        <el-button @click="resetForm">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'

const router = useRouter()
const loading = ref(false)

const userFormRef = ref<FormInstance>()

const userForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'user',
  status: 'active'
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: any) => {
        if (value !== userForm.password) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ]
}

const submitForm = async () => {
  if (!userFormRef.value) return

  try {
    await userFormRef.value.validate()

    loading.value = true

    // 模拟API调用
    setTimeout(() => {
      loading.value = false
      ElMessage.success('用户添加成功')
      router.push('/user-management/user-list')
    }, 2000)
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const resetForm = () => {
  if (!userFormRef.value) return
  userFormRef.value.resetFields()
}

const goBack = () => {
  router.push('/user-management/user-list')
}
</script>

<style scoped>
.user-add {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.user-form {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
</style>