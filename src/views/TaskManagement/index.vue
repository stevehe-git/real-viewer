<template>
  <div class="task-management">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // 如果直接访问 /task-management，重定向到任务列表
  if (route.path === '/task-management') {
    router.push('/task-management/task-list')
  }
})
</script>

<style scoped>
.task-management {
  width: 100%;
  height: 100%;
}
</style>