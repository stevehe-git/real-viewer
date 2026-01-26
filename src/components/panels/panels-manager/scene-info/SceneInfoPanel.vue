<template>
  <BasePanel title="场景信息" :icon="InfoFilled">
    <div class="info-item">
      <span>FPS:</span>
      <span>{{ fps }}</span>
    </div>
    <div class="info-item">
      <span>相机位置:</span>
      <span>X: {{ cameraPos.x.toFixed(2) }}, Y: {{ cameraPos.y.toFixed(2) }}, Z: {{ cameraPos.z.toFixed(2) }}</span>
    </div>
    <div class="info-item">
      <span>渲染对象:</span>
      <span>{{ objectCount }}</span>
    </div>
    <div class="info-item">
      <span>内存使用:</span>
      <span>{{ memoryUsage }} MB</span>
    </div>
    <div class="info-item">
      <span>纹理数量:</span>
      <span>{{ textureCount }}</span>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import BasePanel from '../../BasePanel.vue'
import { InfoFilled } from '@element-plus/icons-vue'

interface Props {
  fps: number
  cameraPos: { x: number; y: number; z: number }
  objectCount: number
  memoryUsage: number
  textureCount: number
}

defineProps<Props>()
</script>

<style scoped>
.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 12px;
  color: #606266;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item span:first-child {
  font-weight: 500;
  color: #303133;
}
</style>