import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { useRvizStore } from './stores/rviz'

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(ElementPlus)
app.use(pinia)

// 在应用启动时初始化store
const rvizStore = useRvizStore()
rvizStore.init()

app.mount('#app')
