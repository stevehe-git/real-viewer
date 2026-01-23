import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/navigation/overview'
  },
  {
    path: '/navigation',
    name: 'Navigation',
    component: () => import('../views/Navigation/index.vue'),
    children: [
      {
        path: 'overview',
        name: 'NavigationOverview',
        component: () => import('../views/Navigation/Overview.vue'),
        meta: { title: '导航概览' }
      },
      {
        path: 'route-planning',
        name: 'RoutePlanning',
        component: () => import('../views/Navigation/RoutePlanning.vue'),
        meta: { title: '路径规划' }
      }
    ]
  },
  {
    path: '/waypoints',
    name: 'Waypoints',
    component: () => import('../views/Navigation/Waypoints.vue'),
    meta: { title: '航点管理' }
  },
  {
    path: '/map-management',
    name: 'MapManagement',
    component: () => import('../views/Navigation/MapManagement.vue'),
    meta: { title: '地图管理' }
  },
  {
    path: '/control',
    name: 'Control',
    component: () => import('../views/Control/index.vue'),
    children: [
      {
        path: 'device-control',
        name: 'DeviceControl',
        component: () => import('../views/Control/DeviceControl.vue'),
        meta: { title: '设备控制' }
      },
      {
        path: 'remote-control',
        name: 'RemoteControl',
        component: () => import('../views/Control/RemoteControl.vue'),
        meta: { title: '远程控制' }
      },
      {
        path: 'command-history',
        name: 'CommandHistory',
        component: () => import('../views/Control/CommandHistory.vue'),
        meta: { title: '指令历史' }
      },
      {
        path: 'status-monitoring',
        name: 'StatusMonitoring',
        component: () => import('../views/Control/StatusMonitoring.vue'),
        meta: { title: '状态监控' }
      }
    ]
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: () => import('../views/Analysis/index.vue'),
    children: [
      {
        path: 'data-analysis',
        name: 'DataAnalysis',
        component: () => import('../views/Analysis/DataAnalysis.vue'),
        meta: { title: '数据分析' }
      },
      {
        path: 'performance-report',
        name: 'PerformanceReport',
        component: () => import('../views/Analysis/PerformanceReport.vue'),
        meta: { title: '性能报告' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('../views/Analysis/Statistics.vue'),
        meta: { title: '统计信息' }
      },
      {
        path: 'trend-analysis',
        name: 'TrendAnalysis',
        component: () => import('../views/Analysis/TrendAnalysis.vue'),
        meta: { title: '趋势分析' }
      }
    ]
  },
  {
    path: '/user-management',
    name: 'UserManagement',
    component: () => import('../views/UserManagement/index.vue'),
    children: [
      {
        path: 'user-list',
        name: 'UserList',
        component: () => import('../views/UserManagement/UserList.vue'),
        meta: { title: '用户列表' }
      },
      {
        path: 'user-add',
        name: 'UserAdd',
        component: () => import('../views/UserManagement/UserAdd.vue'),
        meta: { title: '添加用户' }
      },
      {
        path: 'user-edit/:id',
        name: 'UserEdit',
        component: () => import('../views/UserManagement/UserEdit.vue'),
        meta: { title: '编辑用户' }
      },
      {
        path: 'user-permissions/:id',
        name: 'UserPermissions',
        component: () => import('../views/UserManagement/UserPermissions.vue'),
        meta: { title: '用户权限' }
      }
    ]
  },
  {
    path: '/task-management',
    name: 'TaskManagement',
    component: () => import('../views/TaskManagement/index.vue'),
    children: [
      {
        path: 'task-list',
        name: 'TaskList',
        component: () => import('../views/TaskManagement/TaskList.vue'),
        meta: { title: '任务列表' }
      },
      {
        path: 'task-create',
        name: 'TaskCreate',
        component: () => import('../views/TaskManagement/TaskCreate.vue'),
        meta: { title: '创建任务' }
      },
      {
        path: 'task-edit/:id',
        name: 'TaskEdit',
        component: () => import('../views/TaskManagement/TaskEdit.vue'),
        meta: { title: '编辑任务' }
      },
      {
        path: 'task-execution/:id',
        name: 'TaskExecution',
        component: () => import('../views/TaskManagement/TaskExecution.vue'),
        meta: { title: '任务执行' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
