<template>
  <BasePanel title="视图控制" :icon="Setting">
    <div class="control-group">
      <el-button-group>
        <el-button size="small" @click="$emit('resetCamera')">
          <el-icon><Refresh /></el-icon>
          重置视角
        </el-button>
        <el-button size="small" @click="$emit('toggleGrid')">
          <el-icon><Grid /></el-icon>
          {{ showGrid ? '隐藏网格' : '显示网格' }}
        </el-button>
        <el-button size="small" @click="$emit('toggleAxes')">
          <el-icon><Position /></el-icon>
          {{ showAxes ? '隐藏坐标轴' : '显示坐标轴' }}
        </el-button>
      </el-button-group>
    </div>

    <div class="control-group">
      <el-divider />
      <div class="control-item">
        <span>相机模式:</span>
        <el-radio-group v-model="localCameraMode" size="small" @change="$emit('update:cameraMode', $event)">
          <el-radio-button label="orbit">轨道</el-radio-button>
          <el-radio-button label="firstPerson">第一人称</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="control-group">
      <el-divider />
      <div class="control-item">
        <span>显示选项:</span>
        <div class="checkbox-group">
          <el-checkbox v-model="localShowRobot" @change="$emit('update:showRobot', $event)">机器人模型</el-checkbox>
          <el-checkbox v-model="localShowMap" @change="$emit('update:showMap', $event)">地图</el-checkbox>
          <el-checkbox v-model="localShowLaser" @change="$emit('update:showLaser', $event)">激光扫描</el-checkbox>
        </div>
      </div>
    </div>

    <div class="control-group">
      <el-divider />
      <div class="control-item">
        <span>背景颜色:</span>
        <el-color-picker
          v-model="localBackgroundColor"
          size="small"
          @change="$emit('update:backgroundColor', $event)"
        />
      </div>
    </div>

    <div class="control-group">
      <el-divider />
      <div class="control-item">
        <el-button
          type="primary"
          size="small"
          @click="$emit('toggleFullscreen')"
          style="width: 100%"
        >
          <el-icon><FullScreen /></el-icon>
          {{ props.isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BasePanel from '../../BasePanel.vue'
import { Setting, Refresh, Grid, Position, FullScreen } from '@element-plus/icons-vue'

interface Props {
  cameraMode: string
  showGrid: boolean
  showAxes: boolean
  showRobot: boolean
  showMap: boolean
  showLaser: boolean
  backgroundColor: string
  isFullscreen: boolean
}

const props = defineProps<Props>()

// 本地状态
const localCameraMode = ref(props.cameraMode)
const localShowRobot = ref(props.showRobot)
const localShowMap = ref(props.showMap)
const localShowLaser = ref(props.showLaser)
const localBackgroundColor = ref(props.backgroundColor)

// 监听props变化，更新本地状态
watch(() => props.cameraMode, (newVal) => { localCameraMode.value = newVal })
watch(() => props.showRobot, (newVal) => { localShowRobot.value = newVal })
watch(() => props.showMap, (newVal) => { localShowMap.value = newVal })
watch(() => props.showLaser, (newVal) => { localShowLaser.value = newVal })
watch(() => props.backgroundColor, (newVal) => { localBackgroundColor.value = newVal })

defineEmits<{
  resetCamera: []
  toggleGrid: []
  toggleAxes: []
  'update:cameraMode': [value: string]
  'update:showRobot': [value: boolean]
  'update:showMap': [value: boolean]
  'update:showLaser': [value: boolean]
  'update:backgroundColor': [value: string]
  toggleFullscreen: []
}>()
</script>

<style scoped>
.control-group {
  margin-bottom: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-item span {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>