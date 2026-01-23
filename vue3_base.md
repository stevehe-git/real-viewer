一、基础必练（Vue3 核心语法，重中之重）
这是 Vue3 的底层基础，必须练到 “手写不卡顿” 的程度，是后续所有知识点的前提。
知识点	核心练习内容	实战练习场景
组合式 API (Composition API)	1. setup() 语法（脚本式 / 标签式）
2. ref/reactive 区别与使用场景
3. toRef/toRefs 解构响应式数据
4. computed/watch/watchEffect 监听逻辑
5. onMounted等生命周期钩子（组合式写法）	写一个带计算属性、条件监听的表单组件（如登录页）
Script Setup 语法糖	1. 自动注册组件、无需 return 暴露变量
2. defineProps/defineEmits（TS 类型约束）
3. defineExpose 暴露组件内部方法
4. useSlots/useAttrs 插槽 / 属性获取	封装一个带 Props/Emits 的通用按钮组件（支持 TS 类型）
响应式原理	1. ref/reactive 响应式数据的创建 / 修改 / 解构
2. 浅响应式 (shallowRef/shallowReactive) vs 深响应式
3. 只读响应式 (readonly/shallowReadonly)	实现一个 “深拷贝但保留响应式” 的工具函数
组件通信	1. Props/Emits（父子）
2. v-model 自定义（支持多个 v-model）
3. 依赖注入 (provide/inject)
4. 事件总线（Vue3 推荐用 Pinia 替代）
5. 插槽（默认 / 具名 / 作用域插槽）	开发一个嵌套组件（如表格→行→单元格），覆盖所有通信方式


二、进阶核心（企业级开发必备，高频考点）
这部分是 Vue3 项目的 “骨架”，练会这些才能搭建复杂应用。
1. 路由（Vue Router 4）
练习内容	实战场景
1. 路由配置（TS 类型约束路由表）
2. 动态路由 / 嵌套路由
3. 路由参数（params/query）+ 类型声明
4. 编程式导航（useRouter/useRoute）
5. 路由守卫（全局 / 路由独享 / 组件内）
6. 路由懒加载（按模块拆分）
7. 404 路由 / 重定向 / 别名	搭建后台管理系统的路由体系（含权限控制）
2. 状态管理（Pinia）
练习内容	实战场景
1. Store 定义（TS 类型约束 State/Action）
2. State 修改（直接修改 /$patch）
3. Getters（带缓存 / 依赖其他 Store）
4. Actions（同步 / 异步，支持 await）
5. 多 Store 拆分（按业务模块）
6. Store 持久化（pinia-plugin-persistedstate）	实现用户登录状态 + 购物车的全局管理（带本地缓存）
3. 组件进阶
知识点	核心练习内容	实战场景
异步组件	1. defineAsyncComponent 加载异步组件
2. 加载中 / 错误兜底组件
3. 配合路由懒加载使用	实现大型组件（如富文本编辑器）的懒加载
Teleport 传送门	1. 把组件渲染到指定 DOM 节点（如弹窗 / 提示框）
2. 配合v-if控制显示隐藏	开发一个全局弹窗组件（挂载到 body 下）
Suspense 异步加载	1. 配合异步组件实现 “加载中” 状态
2. 处理异步 setup 的组件	封装接口请求的通用加载骨架屏
自定义指令	1. 自定义指令生命周期（mounted/updated 等）
2. 指令传参 + TS 类型
3. 全局 / 局部指令注册	开发一个 “点击外部关闭弹窗” 的指令（v-click-outside）
4. 表单处理
练习内容	实战场景
1. v-model 自定义修饰符
2. 表单校验（手动 / 使用 VeeValidate/Element Plus 校验）
3. 批量表单数据绑定（reactive）
4. 异步校验（如手机号查重）	开发一个完整的注册表单（含所有校验规则）

三、工程化 / 工具链（提升开发效率，规范代码）
这部分是 “从会写到写好” 的关键，企业项目必练。
知识点	核心练习内容	实战场景
Vite 深度配置	1. 路径别名（@）配置
2. 环境变量（.env.development/.env.production）
3. 插件使用（如 unplugin-auto-import 自动导入 API）
4. 构建优化（分包 / 压缩 / CDN）	优化项目打包体积，实现环境隔离（开发 / 测试 / 生产）
TypeScript 深度集成	1. 组件 Props/Emits/Events 的 TS 类型约束
2. 路由 / Pinia 的 TS 类型扩展
3. 全局类型声明（.d.ts）
4. 泛型组件开发	封装一个支持 TS 的通用下拉选择组件
ESLint + Prettier	1. 配置 Vue3+TS 的 ESLint 规则
2. 自动格式化代码（保存时修复）
3. 禁止 console / 未使用变量等规则	规范项目代码风格，统一团队编码习惯
组件库集成	1. Element Plus/Naive UI 按需导入
2. 自定义主题（覆盖默认样式）
3. 封装二次组件（如带默认样式的按钮）	搭建后台管理系统的基础 UI 框架

四、实战进阶（解决复杂业务场景）
这部分是区分 “初级” 和 “中高级” 的关键，练会可应对 90% 的企业场景。
知识点	核心练习内容	实战场景
接口请求封装	1. Axios 封装（请求 / 响应拦截器）
2. 请求取消（防止重复提交）
3. 统一错误处理 / 状态码
4. TypeScript 约束接口返回值	封装一个企业级的请求工具（支持拦截、取消、重试）
性能优化	1. v-memo 缓存组件
2. 列表渲染优化（key/ 虚拟列表）
3. 组件缓存（keep-alive）
4. 按需加载 / 懒加载	优化大数据列表（1000 + 条数据）的渲染性能
全局工具 / 插件	1. 自定义 Vue 插件（如全局弹窗 / 请求工具）
2. 全局注册组件 / 指令 / 过滤器
3. TS 类型扩展（如 Window 全局变量）	开发一个全局的消息提示插件（this.$message）
跨端 / 扩展	1. Vue3 + TSX/JSX 开发组件
2. Vue3 + Electron 桌面应用
3. Vue3 + Unocss 原子化 CSS	用 TSX 开发一个复杂的可视化组件（如 echarts 封装）

总结
    核心基础：组合式 API、Script Setup、响应式原理是所有练习的前提，必须吃透；
    骨架能力：Vue Router 4 和 Pinia 是构建应用的核心，重点练 “TS 类型约束” 和 “业务拆分”；
    工程化：Vite 配置、TS 集成、ESLint 是企业项目的标配，练会能大幅提升开发效率；
    实战落地：接口封装、性能优化、组件封装是区分开发水平的关键，需结合实际业务反复练。


Vue3+TypeScript 核心知识点练习总结（详细版）
一、基础语法层（Vue3 核心，入门必练）
1. 组合式 API（Composition API）
核心考点	练习标准	落地验证场景
setup () 两种写法	1. 能区分「选项式 setup」和「script setup 语法糖」
2. 理解 script setup 的 “自动暴露变量 / 组件” 特性
3. 知道 setup 的执行时机（创建组件实例→挂载 DOM 前）	用两种写法分别实现 “计数器组件”，对比差异
ref/reactive 响应式	1. 能说清 ref（值类型）和 reactive（引用类型）的底层区别
2. 掌握 ref 对象的.value规则（模板中省略、脚本中必须写）
3. 会用isRef/isReactive判断响应式类型
4. 掌握浅响应式（shallowRef/shallowReactive）的使用场景	实现 “用户信息表单”：
- 用 ref 管理单个表单字段（如 name/age）
- 用 reactive 管理整个表单对象
- 用浅响应式优化大对象（如 100 个字段的表单）
响应式解构（toRef/toRefs）	1. 知道直接解构 reactive 会丢失响应式
2. 能区分 toRef（单个属性）和 toRefs（所有属性）的用法
3. 掌握 toRef 的 “空值兼容” 特性（原属性不存在也不报错）	解构用户信息对象的 name/age 属性，保证解构后仍能双向绑定
计算属性（computed）	1. 能写「只读计算属性」和「可写计算属性」
2. 理解 computed 的缓存机制（依赖不变则不重新计算）
3. TS 约束：给 computed 指定返回值类型	实现 “购物车总价计算”：
- 只读：根据商品列表自动算总价
- 可写：修改总价时反向拆分到各商品数量
监听器（watch/watchEffect）	1. 区分 watch（显式指定依赖）和 watchEffect（自动收集依赖）
2. 掌握 watch 的配置项：immediate（立即执行）、deep（深度监听）、flush（执行时机）
3. 会手动停止监听（watch 返回的停止函数）
4. TS 约束：给 watch 指定监听值和回调参数类型	实现 “搜索框防抖”：
- 用 watch 监听搜索关键词，延迟 1 秒请求接口
- 用 watchEffect 自动监听输入框值，实现实时提示
- 组件卸载时停止监听
生命周期钩子（组合式）	1. 能默写 Vue3 组合式钩子与 Vue2 选项式的对应关系（如 mounted→onMounted）
2. 知道 setup 中没有 beforeCreate/created（直接写在 setup 中）
3. 掌握 onUnmounted 的使用（清理定时器 / 取消接口请求）	实现 “数据请求组件”：
- onMounted 中请求接口
- onUnmounted 中取消未完成的请求
- onUpdated 中记录 DOM 更新次数
2. Script Setup 语法糖（Vue3 推荐写法）
核心考点	练习标准	落地验证场景
组件自动注册	1. 知道 import 的组件无需手动注册（Vue2 需要 components 选项）
2. 掌握组件命名规则（PascalCase 导入，模板中可 kebab-case）	导入 Button/Input 组件，直接在模板中使用<Button>/<button>
Props/Emits 类型约束	1. 用 defineProps 定义 Props，支持 TS 接口 / 类型别名
2. 用 defineEmits 定义自定义事件，指定事件参数类型
3. 掌握 Props 的默认值（withDefaults）和必填项（required）	封装 “通用按钮组件”：
- Props：type（primary/success）、size（small/medium）、disabled（布尔）
- Emits：click（传递鼠标事件对象）、custom（传递自定义参数）
组件暴露（defineExpose）	1. 知道 script setup 的组件默认封闭（父组件无法访问内部属性）
2. 会用 defineExpose 暴露内部方法 / 变量
3. 父组件用 ref 获取子组件实例，TS 约束实例类型	父组件调用子组件的 “重置表单” 方法：
- 子组件用 defineExpose 暴露 reset 方法
- 父组件通过 ref 调用子组件.reset ()
插槽 / 属性（useSlots/useAttrs）	1. 区分 slots（插槽内容）和 attrs（非 Props 属性）
2. 会用 useSlots 判断插槽是否存在
3. 会用 useAttrs 获取透传的属性（如 class/style）	封装 “卡片组件”：
- 用 useSlots 判断是否有 header/footer 插槽
- 用 useAttrs 把 class/style 透传到卡片根元素
3. 组件通信（高频实战）
通信方式	练习标准	落地验证场景
父子通信（Props/Emits）	1. Props：单向数据流（父传子，子不直接修改）
2. Emits：子传父，支持自定义事件参数
3. TS：给 Props/Emits 加完整类型约束	父组件传 “商品列表” 给子组件，子组件点击商品时通过 Emits 通知父组件
自定义 v-model	1. 掌握 Vue3 的 v-model 参数（如 v-model:name），支持多个 v-model
2. 知道默认 v-model 对应 modelValue 属性和 update:modelValue 事件
3. TS：约束 v-model 绑定值的类型	实现 “用户信息编辑组件”：
- 用 v-model:name 绑定用户名
- 用 v-model:age 绑定年龄
- 用 v-model:gender 绑定性别
依赖注入（provide/inject）	1. 掌握 provide（父组件提供数据）和 inject（子组件注入数据）
2. 知道 inject 的默认值和 “必传校验”（default/required）
3. TS：给 provide/inject 指定类型
4. 掌握 “响应式注入”（传递 ref/reactive，保持双向更新）	实现 “主题切换”：
- 根组件 provide 主题状态（dark/light）
- 任意层级子组件 inject 主题，修改后全局生效
插槽通信（作用域插槽）	1. 区分默认插槽、具名插槽、作用域插槽
2. 会用作用域插槽实现 “子传父插槽数据”
3. TS：约束插槽传递的参数类型	实现 “表格组件”：
- 父组件通过作用域插槽自定义表格单元格内容
- 子组件把行数据传递给父组件的插槽
二、核心框架层（企业级开发必备）
1. Vue Router 4（路由管理）
核心考点	练习标准	落地验证场景
路由配置（TS 约束）	1. 用 TS 定义路由类型（RouteRecordRaw）
2. 配置基础路由、嵌套路由、动态路由（:id）
3. 掌握路由元信息（meta）的用法（如 title/requiresAuth）	搭建后台管理系统路由：
- 嵌套路由：/dashboard → /dashboard/overview
- 动态路由：/user/:id → 匹配用户详情页
- meta：给需要登录的路由加 requiresAuth: true
路由导航	1. 区分声明式导航（<router-link>）和编程式导航（useRouter/useRoute）
2. 掌握编程式导航的两种写法：push/replace（路径 / 命名路由）
3. TS：给 useRoute 的 params/query 指定类型	实现 “用户列表→用户详情” 跳转：
- 声明式：<router-link :to="{ name: 'UserDetail', params: { id: 1 } }">
- 编程式：router.push ({name: 'UserDetail', params: { id: 1} })
路由守卫	1. 掌握 3 类守卫：全局守卫（beforeEach）、路由独享守卫（beforeEnter）、组件内守卫（onBeforeRouteEnter）
2. 实现 “登录权限控制”（未登录跳登录页）
3. 掌握守卫的 next 函数规则（Vue3 中可返回路由对象替代 next）	全局守卫：判断用户是否登录，未登录则拦截需要权限的路由
组件内守卫：进入用户详情页前校验用户 ID 是否合法
路由优化	1. 掌握路由懒加载（import () 动态导入）
2. 配置 404 兜底路由
3. 掌握路由别名（alias）和重定向（redirect）	按模块拆分路由：
- 懒加载：const Dashboard = () => import ('@/views/Dashboard.vue')
- 404 路由：path: '*' → 跳 404 页面
2. Pinia（状态管理，替代 Vuex）
核心考点	练习标准	落地验证场景
Store 定义（TS 约束）	1. 用 defineStore 定义 Store，指定 ID、State、Getters、Actions
2. TS：给 State 定义接口，约束 State 类型
3. 掌握 Store 的创建时机（首次使用时初始化）	定义两个 Store：
- UserStore：管理用户登录状态（token/name/avatar）
- CartStore：管理购物车（商品列表 / 总价 / 数量）
State 操作	1. 直接修改 State（Pinia 允许，无需 mutation）
2. 批量修改 State（
对象函数）重置
（
reset）
4. 替换整个 State（$state = newState）	购物车操作：
- 直接修改：cartStore.count += 1
- 批量修改：cartStore.
重置：
reset()
Getters	1. 理解 Getters 的缓存机制（依赖不变则不重新计算）
2. 访问其他 Store 的 Getters（在 Getters 中导入其他 Store）
3. TS：给 Getters 指定返回值类型	购物车 Getters：
- totalPrice：计算所有商品总价
- hasDiscount：判断是否满足满减条件（依赖 UserStore 的会员等级）
Actions	1. 支持同步 / 异步操作（async/await）
2. 访问 State/Getters（this.xxx）
3. 调用其他 Store 的 Actions
4. TS：给 Actions 的参数 / 返回值指定类型	购物车 Actions：
- addGoods：异步请求添加商品到购物车
- syncCart：同步本地购物车到服务器（调用 UserStore 的 token）
Store 持久化	1. 安装 pinia-plugin-persistedstate 插件
2. 配置 Store 持久化（指定存储位置：localStorage/sessionStorage）
3. 自定义持久化规则（只持久化部分 State）	持久化 UserStore 的 token（localStorage）、CartStore 的 list（sessionStorage）
三、工程化层（企业项目规范）
1. Vite 深度配置
核心考点	练习标准	落地验证场景
基础配置	1. 配置开发服务器（port/open/proxy）
2. 配置路径别名（@ → src）
3. 配置构建选项（outDir/assetsDir/minify）
4. TS：给 vite.config.ts 指定类型（defineConfig）	项目配置：
- 端口：5173，启动自动打开浏览器
- 别名：import 组件时用 @/components/Button.vue
- 代理：/api → http://localhost:3000
- 构建：输出到 dist 目录，assets 目录存放静态资源
环境变量	1. 区分.env.development/.env.production/.env.test
2. 掌握环境变量前缀（VITE_），非前缀变量不暴露
3. TS：扩展 ImportMetaEnv 类型，约束环境变量	配置 3 套环境：
- 开发：VITE_API_BASE_URL = '/api'
- 测试：VITE_API_BASE_URL = 'https://test-api.com'
- 生产：VITE_API_BASE_URL = 'https://prod-api.com'
Vite 插件	1. 自动导入 API（unplugin-auto-import）：无需 import 即可用 ref/reactive
2. 自动导入组件（unplugin-vue-components）：无需 import 即可用 UI 组件
3. 压缩插件（vite-plugin-compression）：构建时生成 gzip 包	配置插件：
- 自动导入 Vue 的 ref/computed 等 API
- 自动导入 Element Plus 组件
- 构建时压缩 JS/CSS 文件
2. TypeScript 深度集成
核心考点	练习标准	落地验证场景
组件类型约束	1. Props/Emits 的 TS 类型（接口 / 类型别名）
2. 组件实例类型（InstanceType）
3. 全局组件类型扩展	封装通用组件时，给所有 Props/Emits 加完整 TS 约束，父组件调用时能获得类型提示
全局类型声明	1. 编写.d.ts 文件扩展全局类型（如 Window、Vue 组件）
2. 配置 tsconfig.json 的 typeRoots/include
3. 扩展 Vue 的全局属性（如 this.$message）	扩展 Window 对象：添加 window.$api 属性，约束其类型为 API 实例
泛型组件	1. 用泛型定义组件的 Props / 返回值
2. 实现 “通用列表组件”，支持任意类型的列表数据	封装 Table 组件，支持泛型 T，根据传入的列表类型自动推导列的类型
3. 代码规范
核心考点	练习标准	落地验证场景
ESLint + Prettier	1. 配置 Vue3+TS 的 ESLint 规则（eslint-plugin-vue）
2. 集成 Prettier，解决 ESLint 和 Prettier 的规则冲突
3. 配置保存时自动格式化（VSCode settings）	项目中配置：
- 禁止 console.log（生产环境）
- 强制使用单引号
- 自动格式化代码（保存时修复）
组件规范	1. 遵循 Vue 官方组件规范（PascalCase 命名、单文件组件结构）
2. 拆分组件（原子组件 / 业务组件 / 页面组件）
3. 组件注释（JSDoc），TS 类型提示	按规范拆分后台管理系统组件：
- 原子组件：Button/Input/Table
- 业务组件：UserForm/GoodsList
- 页面组件：Dashboard/User/Order
四、实战进阶层（中高级开发必备）
1. 高级组件
核心考点	练习标准	落地验证场景
异步组件（defineAsyncComponent）	1. 定义异步组件，指定加载中 / 错误兜底组件
2. 配合路由懒加载使用
3. TS：给异步组件指定类型	异步加载 “富文本编辑器组件”，加载中显示骨架屏，加载失败显示重试按钮
Teleport（传送门）	1. 把组件渲染到指定 DOM 节点（如 body）
2. 掌握 disabled 属性（禁用传送）
3. 配合 v-if 控制组件显示隐藏	开发全局弹窗组件：
- 用 Teleport 挂载到 body 下，避免父组件样式影响
- 实现弹窗的显示 / 隐藏 / 关闭
Suspense	1. 配合异步组件实现 “加载中” 状态
2. 处理异步 setup 的组件（setup 返回 Promise）
3. 掌握 fallback 插槽（加载中）和 default 插槽（加载完成）	实现 “数据列表页面”：
- Suspense 包裹异步组件，fallback 显示加载动画
- 异步组件的 setup 中请求接口，返回数据后渲染列表
自定义指令	1. 定义全局 / 局部自定义指令，掌握指令钩子（mounted/updated/unmounted）
2. 指令传参，TS 约束参数类型
3. 常用指令封装：v-click-outside（点击外部关闭）、v-copy（复制文本）	封装两个指令：
- v-click-outside：点击弹窗外部关闭弹窗
- v-copy：点击元素复制指定文本，支持传参（复制成功提示）
2. 接口请求与数据处理
核心考点	练习标准	落地验证场景
Axios 封装	1. 创建 Axios 实例，配置基础 URL / 超时时间 / 请求头
2. 实现请求 / 响应拦截器：
- 请求拦截：添加 token、统一参数格式
- 响应拦截：统一错误处理、解析返回数据
3. TS：约束请求参数和响应数据类型
4. 实现请求取消（AbortController）	封装企业级请求工具：
- 拦截 401 错误（token 过期）跳登录页
- 拦截 500 错误显示全局提示
- 取消重复请求（如连续点击提交按钮）
数据缓存	1. 实现接口数据缓存（localStorage/sessionStorage）
2. 缓存失效策略（过期时间 / 手动刷新）
3. 配合 Pinia 管理缓存状态	缓存 “商品列表” 接口数据，30 分钟过期，支持手动刷新
3. 性能优化
核心考点	练习标准	落地验证场景
组件缓存（keep-alive）	1. 掌握 keep-alive 的用法（include/exclude/max）
2. 配合路由使用，缓存页面组件
3. 掌握 activated/deactivated 钩子（缓存组件的生命周期）	缓存后台管理系统的 “数据列表页”，切换路由时保留列表滚动位置和筛选条件
列表渲染优化	1. 给 v-for 加唯一 key（避免用 index）
2. 实现虚拟列表（vue-virtual-scroller），渲染 10000 + 条数据
3. 用 v-memo 缓存列表项，减少 DOM 更新	渲染 10000 条商品数据，用虚拟列表优化，保证滚动流畅
按需加载	1. 路由懒加载（按模块拆分）
2. 组件懒加载（defineAsyncComponent）
3. UI 组件库按需导入（如 Element Plus）	项目中所有非首屏组件均实现懒加载，首屏加载时间控制在 2 秒内
