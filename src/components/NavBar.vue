<template>
  <header class="navbar">
    <div class="navbar-inner">
      <div class="logo" @click="$router.push('/')">
        <MaterialIcon :path="ICONS.printer3d" :size="28" color="#409eff" class="logo-icon" />
        <span class="logo-text">3DPrint</span>
      </div>
      <nav class="nav-links">
        <router-link to="/" :class="{ active: currentRoute === 'home' }">首页</router-link>
        <router-link to="/model/1" :class="{ active: currentRoute === 'models' }" @click.prevent="goToLastViewed">模型详情</router-link>
        <router-link to="/feed" :class="{ active: currentRoute === 'feed' }">关注动态</router-link>
      </nav>
      <div class="nav-actions">
        <button class="btn-upload" @click="$router.push('/upload')">上传模型</button>
        <template v-if="isLoggedIn">
          <div class="user-dropdown" @click="showDropdown = !showDropdown">
            <span class="user-name" @click.stop="goToProfile">{{ currentUser?.username || '用户' }}</span>
            <MaterialIcon :path="ICONS.chevronDown" :size="16" class="dropdown-arrow" />
            <div v-if="showDropdown" class="dropdown-menu">
              <span class="dropdown-item" @click.stop="goToProfile">个人主页</span>
              <span class="dropdown-divider"></span>
              <span class="dropdown-item" @click.stop="$router.push('/feed')">关注动态</span>
              <span class="dropdown-item" @click.stop="$router.push('/user/me/history')">浏览历史</span>
              <span class="dropdown-divider"></span>
              <span class="dropdown-item" @click.stop="handleLogout">退出登录</span>
            </div>
          </div>
        </template>
        <button v-else class="btn-login" @click="$router.push('/login')">登录</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { isAuthenticated, getUser, logout } from '@/utils/auth'
import { ICONS } from '@/utils/icons'
import MaterialIcon from '@/components/MaterialIcon.vue'

const router = useRouter()
const route = useRoute()

const isLoggedIn = ref(isAuthenticated())
const currentUser = ref(getUser())
const showDropdown = ref(false)

// 资料/头像在其他页面更新后，同步刷新本组件显示
function refreshUser() {
  currentUser.value = getUser()
}
onMounted(() => window.addEventListener('user-updated', refreshUser))
onUnmounted(() => window.removeEventListener('user-updated', refreshUser))

const currentRoute = computed(() => {
  if (route.name === 'Home') return 'home'
  if (route.name === 'ModelDetail') return 'models'
  if (route.name === 'FollowingFeed') return 'feed'
  return ''
})

function handleLogout() {
  logout()
  isLoggedIn.value = false
  currentUser.value = null
  showDropdown.value = false
  router.push('/login')
}

function goToProfile() {
  showDropdown.value = false
  router.push('/user/' + (currentUser.value?.id || 'me'))
}

function goToLastViewed() {
  try {
    const history = JSON.parse(localStorage.getItem('browseHistory') || '[]')
    if (history.length > 0) {
      router.push(`/model/${history[0].id}`)
    } else {
      router.push('/')
    }
  } catch {
    router.push('/')
  }
}
</script>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.navbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 20px;
  color: #303133;
  flex-shrink: 0;
}

.logo-icon {
  font-size: 26px;
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.nav-links {
  display: flex;
  gap: 28px;
  flex: 1;
}

.nav-links a {
  text-decoration: none;
  color: #606266;
  font-size: 14px;
  transition: color 0.2s;
}

.nav-links a:hover,
.nav-links a.active {
  color: #409eff;
}

.nav-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-upload {
  padding: 6px 16px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-login {
  padding: 6px 18px;
  background: transparent;
  color: #409eff;
  border: 1px solid #409eff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-login:hover {
  background: #409eff;
  color: #fff;
}

.user-dropdown {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: #f5f7fa;
  border-radius: 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.user-dropdown:hover {
  background: #e8ecf1;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.dropdown-arrow {
  display: inline-flex;
  align-items: center;
  color: #909399;
  transition: transform 0.2s;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  min-width: 120px;
  z-index: 200;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  padding: 10px 16px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f5f7fa;
  color: #409eff;
}

.dropdown-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 4px 0;
}
</style>
