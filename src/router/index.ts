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
    component: () => import('../pages/Navigation/index.vue'),
    children: [
      {
        path: 'overview',
        name: 'NavigationOverview',
        component: () => import('../pages/Navigation/Overview.vue'),
        meta: { title: '导航概览' }
      },
      {
        path: 'route-planning',
        name: 'RoutePlanning',
        component: () => import('../pages/Navigation/RoutePlanning.vue'),
        meta: { title: '路径规划' }
      }
    ]
  },
  {
    path: '/waypoints',
    name: 'Waypoints',
    component: () => import('../pages/Navigation/Waypoints.vue'),
    meta: { title: '航点管理' }
  },
  {
    path: '/map-management',
    name: 'MapManagement',
    component: () => import('../pages/Navigation/MapManagement.vue'),
    meta: { title: '地图管理' }
  },
  {
    path: '/control',
    name: 'Control',
    component: () => import('../pages/Control/index.vue'),
    children: [
      {
        path: 'device-control',
        name: 'DeviceControl',
        component: () => import('../pages/Control/DeviceControl.vue'),
        meta: { title: '设备控制' }
      },
      {
        path: 'remote-control',
        name: 'RemoteControl',
        component: () => import('../pages/Control/RemoteControl.vue'),
        meta: { title: '远程控制' }
      },
      {
        path: 'command-history',
        name: 'CommandHistory',
        component: () => import('../pages/Control/CommandHistory.vue'),
        meta: { title: '指令历史' }
      },
      {
        path: 'status-monitoring',
        name: 'StatusMonitoring',
        component: () => import('../pages/Control/StatusMonitoring.vue'),
        meta: { title: '状态监控' }
      }
    ]
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: () => import('../pages/Analysis/index.vue'),
    children: [
      {
        path: 'data-analysis',
        name: 'DataAnalysis',
        component: () => import('../pages/Analysis/DataAnalysis.vue'),
        meta: { title: '数据分析' }
      },
      {
        path: 'performance-report',
        name: 'PerformanceReport',
        component: () => import('../pages/Analysis/PerformanceReport.vue'),
        meta: { title: '性能报告' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('../pages/Analysis/Statistics.vue'),
        meta: { title: '统计信息' }
      },
      {
        path: 'trend-analysis',
        name: 'TrendAnalysis',
        component: () => import('../pages/Analysis/TrendAnalysis.vue'),
        meta: { title: '趋势分析' }
      }
    ]
  },
  {
    path: '/user-management',
    name: 'UserManagement',
    component: () => import('../pages/UserManagement/index.vue'),
    children: [
      {
        path: 'user-list',
        name: 'UserList',
        component: () => import('../pages/UserManagement/UserList.vue'),
        meta: { title: '用户列表' }
      },
      {
        path: 'user-add',
        name: 'UserAdd',
        component: () => import('../pages/UserManagement/UserAdd.vue'),
        meta: { title: '添加用户' }
      },
      {
        path: 'user-edit/:id',
        name: 'UserEdit',
        component: () => import('../pages/UserManagement/UserEdit.vue'),
        meta: { title: '编辑用户' }
      },
      {
        path: 'user-permissions/:id',
        name: 'UserPermissions',
        component: () => import('../pages/UserManagement/UserPermissions.vue'),
        meta: { title: '用户权限' }
      }
    ]
  },
  {
    path: '/task-management',
    name: 'TaskManagement',
    component: () => import('../pages/TaskManagement/index.vue'),
    children: [
      {
        path: 'task-list',
        name: 'TaskList',
        component: () => import('../pages/TaskManagement/TaskList.vue'),
        meta: { title: '任务列表' }
      },
      {
        path: 'task-create',
        name: 'TaskCreate',
        component: () => import('../pages/TaskManagement/TaskCreate.vue'),
        meta: { title: '创建任务' }
      },
      {
        path: 'task-edit/:id',
        name: 'TaskEdit',
        component: () => import('../pages/TaskManagement/TaskEdit.vue'),
        meta: { title: '编辑任务' }
      },
      {
        path: 'task-execution/:id',
        name: 'TaskExecution',
        component: () => import('../pages/TaskManagement/TaskExecution.vue'),
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
