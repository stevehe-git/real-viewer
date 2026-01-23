<template>
  <div class="map-management">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // 如果直接访问 /map-management，重定向到地图列表
  if (route.path === '/map-management') {
    router.push('/map-management/list')
  }
})
</script>

<style scoped>
.map-management {
  width: 100%;
  height: 100%;
}
</style>