<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">URDF Parameter</span>
      <el-input
        :model-value="options.urdfParameter || ''"
        @update:model-value="update('urdfParameter', $event)"
        size="small"
        placeholder="robot_description"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">URDF File URL</span>
      <el-input
        :model-value="options.urdfFileUrl || ''"
        @update:model-value="update('urdfFileUrl', $event)"
        size="small"
        placeholder="http://example.com/robot.urdf"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Visual Enabled</span>
      <el-checkbox
        :model-value="options.visualEnabled ?? true"
        @update:model-value="update('visualEnabled', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Collision Enabled</span>
      <el-checkbox
        :model-value="options.collisionEnabled ?? true"
        @update:model-value="update('collisionEnabled', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Alpha</span>
      <el-input-number
        :model-value="options.alpha ?? 1"
        @update:model-value="update('alpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        :precision="1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">TF Prefix</span>
      <el-input
        :model-value="options.tfPrefix || ''"
        @update:model-value="update('tfPrefix', $event)"
        size="small"
        placeholder=""
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Update Interval</span>
      <el-input-number
        :model-value="options.updateInterval ?? 0"
        @update:model-value="update('updateInterval', $event)"
        size="small"
        :min="0"
        :max="1000"
        :step="10"
        class="config-value"
      />
    </div>
    <div class="config-row" v-if="options.packages && Object.keys(options.packages).length > 0">
      <span class="config-label">Packages</span>
      <div class="config-value packages-list">
        <div
          v-for="(path, name) in options.packages"
          :key="name"
          class="package-item"
        >
          <span class="package-name">{{ name }}:</span>
          <el-input
            :model-value="path"
            @update:model-value="updatePackage(name, $event)"
            size="small"
            style="flex: 1; margin-left: 8px;"
          />
        </div>
      </div>
    </div>
    <div class="config-row">
      <el-button
        size="small"
        type="primary"
        @click="addPackage"
        style="width: 100%;"
      >
        Add Package Mapping
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRvizStore } from '@/stores/rviz'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}

const updatePackage = (packageName: string, path: string) => {
  const packages = { ...(props.options.packages || {}) }
  packages[packageName] = path
  update('packages', packages)
}

const addPackage = () => {
  const packageName = prompt('Enter package name:')
  if (packageName) {
    const path = prompt('Enter package path (URL):')
    if (path) {
      const packages = { ...(props.options.packages || {}) }
      packages[packageName] = path
      update('packages', packages)
    }
  }
}
</script>

<style scoped>
.config-content {
  padding: 4px 0;
}

.config-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  min-height: 28px;
  font-size: 12px;
}

.config-label {
  flex: 1;
  color: #606266;
}

.config-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
}

.packages-list {
  flex-direction: column;
  align-items: stretch;
}

.package-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.package-name {
  min-width: 100px;
  font-weight: 500;
  color: #303133;
}
</style>
