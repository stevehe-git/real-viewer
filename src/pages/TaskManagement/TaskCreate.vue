<template>
  <div class="task-create">
    <div class="page-header">
      <h2>创建任务</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      class="task-form"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="任务名称" prop="name">
            <el-input v-model="formData.name" placeholder="请输入任务名称" />
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="任务类型" prop="type">
            <el-select v-model="formData.type" placeholder="请选择任务类型" style="width: 100%">
              <el-option label="巡检任务" value="inspection" />
              <el-option label="运输任务" value="transport" />
              <el-option label="清洁任务" value="cleaning" />
              <el-option label="维护任务" value="maintenance" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="优先级" prop="priority">
            <el-select v-model="formData.priority" placeholder="请选择优先级" style="width: 100%">
              <el-option label="低" value="low" />
              <el-option label="中" value="medium" />
              <el-option label="高" value="high" />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="执行时间" prop="scheduledTime">
            <el-date-picker
              v-model="formData.scheduledTime"
              type="datetime"
              placeholder="选择执行时间"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="任务描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="4"
          placeholder="请输入任务描述"
        />
      </el-form-item>

      <el-form-item label="执行参数" v-if="showExecutionParams">
        <el-card class="params-card">
          <template #header>
            <div class="card-header">
              <span>执行参数配置</span>
            </div>
          </template>

          <!-- 巡检任务参数 -->
          <div v-if="formData.type === 'inspection'" class="param-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="巡检区域">
                  <el-select v-model="formData.params.inspectionArea" placeholder="选择巡检区域" style="width: 100%">
                    <el-option label="区域A" value="area_a" />
                    <el-option label="区域B" value="area_b" />
                    <el-option label="区域C" value="area_c" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="巡检周期(分钟)">
                  <el-input-number v-model="formData.params.inspectionInterval" :min="1" :max="1440" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <!-- 运输任务参数 -->
          <div v-if="formData.type === 'transport'" class="param-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="起始位置">
                  <el-input v-model="formData.params.startLocation" placeholder="输入起始位置" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目标位置">
                  <el-input v-model="formData.params.endLocation" placeholder="输入目标位置" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="货物类型">
                  <el-select v-model="formData.params.cargoType" placeholder="选择货物类型" style="width: 100%">
                    <el-option label="普通货物" value="normal" />
                    <el-option label="危险品" value="dangerous" />
                    <el-option label="易碎品" value="fragile" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="重量(kg)">
                  <el-input-number v-model="formData.params.weight" :min="0" :precision="2" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <!-- 清洁任务参数 -->
          <div v-if="formData.type === 'cleaning'" class="param-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="清洁区域">
                  <el-input v-model="formData.params.cleaningArea" placeholder="输入清洁区域" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="清洁类型">
                  <el-select v-model="formData.params.cleaningType" placeholder="选择清洁类型" style="width: 100%">
                    <el-option label="常规清洁" value="regular" />
                    <el-option label="深度清洁" value="deep" />
                    <el-option label="消毒清洁" value="disinfection" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <!-- 维护任务参数 -->
          <div v-if="formData.type === 'maintenance'" class="param-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="维护设备">
                  <el-input v-model="formData.params.equipment" placeholder="输入维护设备" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="维护类型">
                  <el-select v-model="formData.params.maintenanceType" placeholder="选择维护类型" style="width: 100%">
                    <el-option label="例行维护" value="routine" />
                    <el-option label="故障维修" value="repair" />
                    <el-option label="升级维护" value="upgrade" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          创建任务
        </el-button>
        <el-button @click="resetForm">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

// 表单引用
const formRef = ref()

// 表单数据
const formData = reactive({
  name: '',
  type: '',
  priority: 'medium',
  description: '',
  scheduledTime: null,
  params: {
    // 巡检参数
    inspectionArea: '',
    inspectionInterval: 60,

    // 运输参数
    startLocation: '',
    endLocation: '',
    cargoType: '',
    weight: 0,

    // 清洁参数
    cleaningArea: '',
    cleaningType: '',

    // 维护参数
    equipment: '',
    maintenanceType: ''
  }
})

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' },
    { min: 2, max: 50, message: '任务名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择任务类型', trigger: 'change' }
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' }
  ],
  description: [
    { required: true, message: '请输入任务描述', trigger: 'blur' },
    { max: 500, message: '任务描述不能超过500个字符', trigger: 'blur' }
  ],
  scheduledTime: [
    { required: true, message: '请选择执行时间', trigger: 'change' }
  ]
}

// 计算属性
const showExecutionParams = computed(() => {
  return formData.type !== ''
})

// 状态
const submitting = ref(false)

// 方法
const goBack = () => {
  router.push('/task-management/task-list')
}

const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitting.value = true

    // 这里应该是API调用
    console.log('创建任务:', formData)

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    ElMessage.success('任务创建成功')
    router.push('/task-management/task-list')

  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }

  // 重置参数
  Object.assign(formData.params, {
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
  })
}
</script>

<style scoped>
.task-create {
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

.task-form {
  max-width: 800px;
}

.params-card {
  margin-top: 10px;
}

.card-header {
  font-weight: 500;
  color: #303133;
}

.param-section {
  margin-top: 16px;
}

.param-section:first-child {
  margin-top: 0;
}
</style>