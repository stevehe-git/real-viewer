import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { useRvizStore } from './stores/rviz'
// 初始化全局调试 API（暴露到 window.debug）
import '@/utils/debug/globalDebug'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 初始化RViz store
const rvizStore = useRvizStore()
rvizStore.initialize()

app.mount('#app')
