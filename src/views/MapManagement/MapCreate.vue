<template>
  <div class="map-create">
    <div class="page-header">
      <h2>创建地图</h2>
      <el-button @click="goBack">返回</el-button>
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      class="map-form"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="地图名称" prop="name">
            <el-input v-model="formData.name" placeholder="请输入地图名称" />
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="地图类型" prop="type">
            <el-select v-model="formData.type" placeholder="请选择地图类型" style="width: 100%">
              <el-option label="建筑地图" value="building" />
              <el-option label="室外地图" value="outdoor" />
              <el-option label="仓库地图" value="warehouse" />
              <el-option label="工厂地图" value="factory" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="宽度" prop="width">
            <el-input-number v-model="formData.width" :min="1" :max="10000" style="width: 100%" />
            <span class="unit">米</span>
          </el-form-item>
        </el-col>

        <el-col :span="8">
          <el-form-item label="高度" prop="height">
            <el-input-number v-model="formData.height" :min="1" :max="10000" style="width: 100%" />
            <span class="unit">米</span>
          </el-form-item>
        </el-col>

        <el-col :span="8">
          <el-form-item label="分辨率" prop="resolution">
            <el-input-number v-model="formData.resolution" :min="0.01" :max="1" :step="0.01" style="width: 100%" />
            <span class="unit">米/像素</span>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="楼层" prop="floor">
            <el-select v-model="formData.floor" placeholder="请选择楼层" style="width: 100%">
              <el-option label="B2" value="B2" />
              <el-option label="B1" value="B1" />
              <el-option label="1F" value="1F" />
              <el-option label="2F" value="2F" />
              <el-option label="3F" value="3F" />
              <el-option label="4F" value="4F" />
              <el-option label="5F" value="5F" />
              <el-option label="地面" value="ground" />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="坐标系" prop="coordinateSystem">
            <el-select v-model="formData.coordinateSystem" placeholder="请选择坐标系" style="width: 100%">
              <el-option label="世界坐标系" value="world" />
              <el-option label="局部坐标系" value="local" />
              <el-option label="地图坐标系" value="map" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="地图描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="请输入地图描述信息"
        />
      </el-form-item>

      <el-form-item label="地图文件" prop="mapFile">
        <el-upload
          ref="uploadRef"
          class="upload-demo"
          drag
          :action="uploadAction"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
          :before-upload="beforeUpload"
          :file-list="fileList"
          accept=".png,.jpg,.jpeg,.yaml,.pgm"
        >
          <el-icon class="el-icon--upload"><Upload /></el-icon>
          <div class="el-upload__text">
            将文件拖到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 PNG、JPG、YAML、PGM 格式的地图文件，单个文件不超过 10MB
            </div>
          </template>
        </el-upload>
      </el-form-item>

      <el-form-item label="地图配置">
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span>高级配置</span>
            </div>
          </template>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="占用阈值">
                <el-slider v-model="formData.config.occupiedThreshold" :min="0" :max="100" />
                <span class="slider-value">{{ formData.config.occupiedThreshold }}</span>
              </el-form-item>
            </el-col>

            <el-col :span="12">
              <el-form-item label="自由阈值">
                <el-slider v-model="formData.config.freeThreshold" :min="0" :max="100" />
                <span class="slider-value">{{ formData.config.freeThreshold }}</span>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="膨胀半径">
                <el-input-number v-model="formData.config.inflationRadius" :min="0" :precision="2" />
                <span class="unit">米</span>
              </el-form-item>
            </el-col>

            <el-col :span="12">
              <el-form-item label="成本缩放">
                <el-input-number v-model="formData.config.costScalingFactor" :min="0" :precision="2" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-card>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          创建地图
        </el-button>
        <el-button @click="resetForm">重置</el-button>
        <el-button @click="previewMap">预览地图</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()

// 表单引用
const formRef = ref()
const uploadRef = ref()

// 表单数据
const formData = reactive({
  name: '',
  type: '',
  width: 50,
  height: 50,
  resolution: 0.05,
  floor: '1F',
  coordinateSystem: 'map',
  description: '',
  mapFile: null,
  config: {
    occupiedThreshold: 65,
    freeThreshold: 25,
    inflationRadius: 0.5,
    costScalingFactor: 10
  }
})

// 文件列表
const fileList = ref([])

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入地图名称', trigger: 'blur' },
    { min: 2, max: 50, message: '地图名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择地图类型', trigger: 'change' }
  ],
  width: [
    { required: true, message: '请输入地图宽度', trigger: 'blur' }
  ],
  height: [
    { required: true, message: '请输入地图高度', trigger: 'blur' }
  ],
  resolution: [
    { required: true, message: '请输入分辨率', trigger: 'blur' }
  ],
  floor: [
    { required: true, message: '请选择楼层', trigger: 'change' }
  ],
  coordinateSystem: [
    { required: true, message: '请选择坐标系', trigger: 'change' }
  ],
  mapFile: [
    { required: true, message: '请上传地图文件', trigger: 'change' }
  ]
}

// 状态
const submitting = ref(false)

// 上传相关
const uploadAction = '/api/upload/map' // 上传接口地址

// 方法
const goBack = () => {
  router.push('/map-management/list')
}

const beforeUpload = (file: File) => {
  const isValidType = ['image/png', 'image/jpeg', 'application/x-yaml', 'application/octet-stream'].includes(file.type)
  const isValidSize = file.size / 1024 / 1024 < 10 // 10MB

  if (!isValidType) {
    ElMessage.error('上传文件格式不正确!')
    return false
  }

  if (!isValidSize) {
    ElMessage.error('上传文件大小不能超过 10MB!')
    return false
  }

  return true
}

const handleUploadSuccess = (response: any, file: any) => {
  formData.mapFile = response.data
  ElMessage.success('文件上传成功')
}

const handleUploadError = (error: any) => {
  ElMessage.error('文件上传失败')
  console.error('上传错误:', error)
}

const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    submitting.value = true

    // 这里应该是API调用
    console.log('创建地图:', formData)

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    ElMessage.success('地图创建成功')
    router.push('/map-management/list')

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

  // 重置配置
  Object.assign(formData.config, {
    occupiedThreshold: 65,
    freeThreshold: 25,
    inflationRadius: 0.5,
    costScalingFactor: 10
  })

  // 清空文件列表
  fileList.value = []
}

const previewMap = () => {
  // 这里可以显示地图预览
  ElMessage.info('地图预览功能开发中')
}
</script>

<style scoped>
.map-create {
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

.map-form {
  max-width: 900px;
}

.upload-demo {
  width: 100%;
}

.config-card {
  margin-top: 10px;
}

.card-header {
  font-weight: 500;
  color: #303133;
}

.slider-value {
  margin-left: 10px;
  font-weight: 500;
  color: #409eff;
}

.unit {
  margin-left: 8px;
  color: #909399;
  font-size: 14px;
}
</style>