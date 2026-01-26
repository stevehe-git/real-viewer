<template>
  <div class="user-management">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // 如果直接访问 /user-management，重定向到用户列表
  if (route.path === '/user-management') {
    router.push('/user-management/user-list')
  }
})
</script>

<style scoped>
.user-management {
  width: 100%;
  height: 100%;
}
</style>