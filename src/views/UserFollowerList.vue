<template>
  <div class="user-page">
    <NavBar />

    <!-- 页面标题 -->
    <section class="page-header">
      <div class="header-inner">
        <h1>{{ pageUsername }} 的粉丝</h1>
        <p>{{ list.length }} 位粉丝</p>
      </div>
    </section>

    <main class="main-content">
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="list.length === 0" class="empty-state">
        <span class="empty-icon">👥</span>
        <p>{{ pageUsername }} 还没有粉丝</p>
      </div>

      <div v-else class="follower-list">
        <div v-for="u in list" :key="u.id" class="follower-card" @click="goToProfile(u.id)">
          <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.username" class="follower-avatar follower-avatar-img" />
          <div v-else class="follower-avatar">{{ u.username[0] }}</div>
          <div class="follower-info">
            <span class="follower-name">{{ u.username }}</span>
            <span class="follower-date">关注于 {{ formatDate(u.followedAt) }}</span>
          </div>
        </div>
      </div>
    </main>

    <footer class="page-footer">
      <p>© 2026 3DPrint 模型分享平台</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { get } from '@/utils/request'

const route = useRoute()
const router = useRouter()

const list = ref([])
const loading = ref(false)
const pageUsername = ref('')

function goToProfile(id) {
  router.push('/user/' + id)
}

async function fetchData() {
  const userId = route.params.id
  loading.value = true
  try {
    const [data, profile] = await Promise.all([
      get(`/api/user/${userId}/followers`),
      get(`/api/user/${userId}/profile`)
    ])
    list.value = data || []
    pageUsername.value = profile.username || '用户'
  } catch (err) {
    console.error('获取粉丝列表失败:', err)
  } finally {
    loading.value = false
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(fetchData)
</script>

<style scoped>
.page-header {
  background: linear-gradient(135deg, #67c23a 0%, #4e8c2a 100%);
  padding: 40px 24px;
  color: #fff;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
}
.page-header h1 {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 6px;
}
.page-header p {
  font-size: 14px;
  opacity: 0.8;
}
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
  min-height: 60vh;
}
.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}
.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}
.empty-state p {
  font-size: 15px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e4e7ed;
  border-top-color: #67c23a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.follower-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.follower-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 14px 18px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.follower-card:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.follower-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #67c23a, #4e8c2a);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.follower-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.follower-name {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}
.follower-date {
  font-size: 12px;
  color: #909399;
}
.page-footer {
  text-align: center;
  padding: 32px;
  color: #909399;
  font-size: 13px;
}
.follower-avatar-img { object-fit: cover; background: #f0f2f5; }

/* ========== 移动端 ========== */
@media (max-width: 768px) {
  .page-header {
    padding: 28px 16px;
  }
  .page-header h1 {
    font-size: 21px;
  }
  .main-content {
    padding: 20px 12px;
  }
}
</style>
