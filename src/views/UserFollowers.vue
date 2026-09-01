<template>
  <div class="user-page">
    <NavBar />

    <!-- 页面标题 -->
    <section class="page-header">
      <div class="header-inner">
        <h1>我的粉丝</h1>
        <p>关注了你的用户</p>
      </div>
    </section>

    <main class="main-content">
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="followers.length === 0" class="empty-state">
        <span class="empty-icon">👥</span>
        <p>还没有粉丝</p>
        <p class="empty-hint">上传优质模型，吸引更多人关注你！</p>
      </div>

      <!-- 粉丝列表 -->
      <div v-else class="follower-list">
        <div
          v-for="u in followers"
          :key="u.id"
          class="follower-card"
        >
          <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.username" class="follower-avatar follower-avatar-img" />
          <div v-else class="follower-avatar">{{ u.username[0] }}</div>
          <div class="follower-info">
            <span class="follower-name">{{ u.username }}</span>
            <span class="follower-date">关注于 {{ formatDate(u.followedAt) }}</span>
          </div>
          <button
            class="btn-follow"
            :class="{ following: u.isFollowing }"
            @click="toggleFollow(u)"
          >
            {{ u.isFollowing ? '✓ 已关注' : '+ 关注' }}
          </button>
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
import NavBar from '@/components/NavBar.vue'
import { get, post, del } from '@/utils/request'
import { isAuthenticated} from '@/utils/auth'

const followers = ref([])
const loading = ref(false)

async function fetchFollowers() {
  if (!isAuthenticated()) return
  loading.value = true
  try {
    const data = await get('/api/user/followers')
    // 检查当前用户是否已关注这些粉丝（用于"互相关注"状态）
    // const me = getUser()
    const followingList = await get('/api/user/following').catch(() => [])
    const followingIds = new Set((followingList || []).map(u => u.id))
    followers.value = (data || []).map(u => ({
      ...u,
      isFollowing: followingIds.has(u.id)
    }))
  } catch (err) {
    console.error('获取粉丝列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function toggleFollow(u) {
  if (!isAuthenticated()) return
  try {
    if (u.isFollowing) {
      await del(`/api/user/${u.id}/follow`)
      u.isFollowing = false
    } else {
      await post(`/api/user/${u.id}/follow`)
      u.isFollowing = true
    }
  } catch (err) {
    console.error('关注操作失败:', err)
  }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(fetchFollowers)
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

/* 空状态 */
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
  margin-bottom: 4px;
}
.empty-hint {
  font-size: 13px !important;
  color: #bbb !important;
}

/* 粉丝列表 */
.follower-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
}

.follower-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  transition: box-shadow 0.2s;
}
.follower-card:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.follower-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.follower-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.follower-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.follower-date {
  font-size: 12px;
  color: #909399;
}

.btn-follow {
  padding: 5px 16px;
  border: 1px solid #409eff;
  background: transparent;
  color: #409eff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-follow:hover {
  background: #409eff;
  color: #fff;
}
.btn-follow.following {
  background: #ecf5ff;
  color: #409eff;
  border-color: #b3d8ff;
}

/* 页脚 */
.page-footer {
  text-align: center;
  padding: 30px 0;
  color: #ccc;
  font-size: 13px;
  border-top: 1px solid #f0f0f0;
  margin-top: 40px;
}

/* 加载动画 */
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #dcdfe6;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
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
