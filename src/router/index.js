import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import ModelDetail from '@/views/ModelDetail.vue'
import Login from '@/views/Login.vue'
import Upload from '@/views/Upload.vue'
import { isAuthenticated } from '@/utils/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/model/:id',
    name: 'ModelDetail',
    component: ModelDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/upload',
    name: 'Upload',
    component: Upload,
    meta: { requiresAuth: true }
  },
  {
    path: '/user/:id',
    name: 'UserProfile',
    component: () => import('@/views/UserProfile.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/user/:id/following',
    name: 'UserFollowingList',
    component: () => import('@/views/UserFollowingList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/user/:id/followers',
    name: 'UserFollowerList',
    component: () => import('@/views/UserFollowerList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/feed',
    name: 'FollowingFeed',
    component: () => import('@/views/FollowingFeed.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/user/me/history',
    name: 'BrowseHistory',
    component: () => import('@/views/BrowseHistory.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/verify-email',
    name: 'VerifyEmail',
    component: () => import('@/views/VerifyEmail.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫（Vue Router 4：return 代替 next()）
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return '/login'
  }
  if (to.path === '/login' && isAuthenticated()) {
    return '/'
  }
  return true
})

export default router
