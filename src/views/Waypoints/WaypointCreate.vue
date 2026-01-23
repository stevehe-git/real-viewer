<template>
  <div class="waypoint-create">
    <div class="page-header">
      <h2>创建航点</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      class="waypoint-form"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="航点名称" prop="name">
            <el-input v-model="formData.name" placeholder="请输入航点名称" />
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="航点类型" prop="type">
            <el-select v-model="formData.type" placeholder="请选择航点类型" style="width: 100%">
              <el-option label="导航点" value="navigation" />
              <el-option label="充电点" value="charging" />
              <el-option label="工作点" value="work" />
              <el-option label="停车点" value="parking" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="X坐标" prop="x">
            <el-input-number v-model="formData.x" :precision="2" :min="-1000" :max="1000" style="width: 100%" />
          </el-form-item>
        </el-col>

        <el-col :span="8">
          <el-form-item label="Y坐标" prop="y">
            <el-input-number v-model="formData.y" :precision="2" :min="-1000" :max="1000" style="width: 100%" />
          </el-form-item>
        </el-col>

        <el-col :span="8">
          <el-form-item label="角度" prop="angle">
            <el-input-number v-model="formData.angle" :min="0" :max="360" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="楼层" prop="floor">
            <el-select v-model="formData.floor" placeholder="请选择楼层" style="width: 100%">
              <el-option label="B1" value="B1" />
              <el-option label="1F" value="1F" />
              <el-option label="2F" value="2F" />
              <el-option label="3F" value="3F" />
              <el-option label="4F" value="4F" />
              <el-option label="5F" value="5F" />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="地图ID" prop="mapId">
            <el-select v-model="formData.mapId" placeholder="请选择所属地图" style="width: 100%">
              <el-option label="主楼地图" value="main_building" />
              <el-option label="仓库地图" value="warehouse" />
              <el-option label="办公区地图" value="office" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="航点描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="请输入航点描述信息"
        />
      </el-form-item>

      <el-form-item label="扩展属性">
        <el-card class="properties-card">
          <template #header>
            <div class="card-header">
              <span>扩展属性配置</span>
            </div>
          </template>

          <div v-if="formData.type === 'charging'" class="property-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="充电功率">
                  <el-input-number v-model="formData.properties.power" :min="0" :precision="1" />
                  <span class="unit">kW</span>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="同时充电数">
                  <el-input-number v-model="formData.properties.capacity" :min="1" :max="10" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <div v-if="formData.type === 'work'" class="property-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="工作台类型">
                  <el-select v-model="formData.properties.workbenchType" placeholder="选择工作台类型" style="width: 100%">
                    <el-option label="装配台" value="assembly" />
                    <el-option label="检测台" value="inspection" />
                    <el-option label="包装台" value="packaging" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="工作时间">
                  <el-input-number v-model="formData.properties.workTime" :min="1" :precision="1" />
                  <span class="unit">分钟</span>
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <div v-if="formData.type === 'parking'" class="property-section">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="停车容量">
                  <el-input-number v-model="formData.properties.parkingCapacity" :min="1" :max="20" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="临时停车">
                  <el-switch v-model="formData.properties.isTemporary" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          创建航点
        </el-button>
        <el-button @click="resetForm">重置</el-button>
        <el-button @click="previewOnMap">地图预览</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

// 表单引用
const formRef = ref()

// 表单数据
const formData = reactive({
  name: '',
  type: '',
  x: 0,
  y: 0,
  angle: 0,
  floor: '1F',
  mapId: '',
  description: '',
  properties: {
    // 充电点属性
    power: 0,
    capacity: 1,

    // 工作点属性
    workbenchType: '',
    workTime: 0,

    // 停车点属性
    parkingCapacity: 1,
    isTemporary: false
  }
})

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入航点名称', trigger: 'blur' },
    { min: 2, max: 50, message: '航点名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择航点类型', trigger: 'change' }
  ],
  x: [
    { required: true, message: '请输入X坐标', trigger: 'blur' }
  ],
  y: [
    { required: true, message: '请输入Y坐标', trigger: 'blur' }
  ],
  angle: [
    { required: true, message: '请输入角度', trigger: 'blur' }
  ],
  floor: [
    { required: true, message: '请选择楼层', trigger: 'change' }
  ],
  mapId: [
    { required: true, message: '请选择所属地图', trigger: 'change' }
  ],
  description: [
    { max: 200, message: '航点描述不能超过200个字符', trigger: 'blur' }
  ]
}

// 状态
const submitting = ref(false)

// 方法
const goBack = () => {
  router.push('/waypoints/list')
}

const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitting.value = true

    // 这里应该是API调用
    console.log('创建航点:', formData)

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    ElMessage.success('航点创建成功')
    router.push('/waypoints/list')

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

  // 重置扩展属性
  Object.assign(formData.properties, {
    power: 0,
    capacity: 1,
    workbenchType: '',
    workTime: 0,
    parkingCapacity: 1,
    isTemporary: false
  })
}

const previewOnMap = () => {
  // 这里可以跳转到地图预览页面，显示当前航点的预览
  ElMessage.info('地图预览功能开发中')
}
</script>

<style scoped>
.waypoint-create {
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

.waypoint-form {
  max-width: 900px;
}

.properties-card {
  margin-top: 10px;
}

.card-header {
  font-weight: 500;
  color: #303133;
}

.property-section {
  margin-top: 16px;
}

.property-section:first-child {
  margin-top: 0;
}

.unit {
  margin-left: 8px;
  color: #909399;
  font-size: 14px;
}
</style>