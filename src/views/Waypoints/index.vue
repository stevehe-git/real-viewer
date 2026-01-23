<template>
  <div class="waypoints">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // 如果直接访问 /waypoints，重定向到航点列表
  if (route.path === '/waypoints') {
    router.push('/waypoints/list')
  }
})
</script>

<style scoped>
.waypoints {
  width: 100%;
  height: 100%;
}
</style>