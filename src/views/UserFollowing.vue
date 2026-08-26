<template>
  <div class="user-page">
    <NavBar />

    <!-- 页面标题 -->
    <section class="page-header">
      <div class="header-inner">
        <h1>我的关注</h1>
        <p>你关注的设计师</p>
      </div>
    </section>

    <main class="main-content">
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="followingList.length === 0" class="empty-state">
        <span class="empty-icon">👀</span>
        <p>还没有关注任何人</p>
        <p class="empty-hint">去首页发现优秀的设计师吧！</p>
        <button class="btn-primary" @click="$router.push('/')">去首页</button>
      </div>

      <!-- 关注列表 -->
      <div v-else class="follower-list">
        <div
          v-for="u in followingList"
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
            class="btn-unfollow"
            :disabled="u._unfollowing"
            @click.stop="unfollow(u)"
          >
            {{ u._unfollowing ? '取消中...' : '取消关注' }}
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
import { get, del } from '@/utils/request'
import { isAuthenticated } from '@/utils/auth'

const followingList = ref([])
const loading = ref(false)

async function fetchFollowing() {
  if (!isAuthenticated()) return
  loading.value = true
  try {
    const data = await get('/api/user/following')
    followingList.value = (data || []).map(u => ({ ...u, _unfollowing: false }))
  } catch (err) {
    console.error('获取关注列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function unfollow(u) {
  if (!isAuthenticated()) return
  if (!confirm(`确定取消关注「${u.username}」吗？`)) return
  u._unfollowing = true
  try {
    await del(`/api/user/${u.id}/follow`)
    followingList.value = followingList.value.filter(item => item.id !== u.id)
  } catch (err) {
    console.error('取消关注失败:', err)
    u._unfollowing = false
  }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(fetchFollowing)
</script>

<style scoped>
.page-header {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
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
  margin-bottom: 16px !important;
}
.btn-primary {
  padding: 8px 24px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.btn-primary:hover {
  opacity: 0.85;
}

/* 关注列表 */
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
  background: linear-gradient(135deg, #a855f7, #7c3aed);
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

.btn-unfollow {
  padding: 5px 16px;
  border: 1px solid #f56c6c;
  background: transparent;
  color: #f56c6c;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-unfollow:hover {
  background: #f56c6c;
  color: #fff;
}
.btn-unfollow:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  border-top-color: #a855f7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.follower-avatar-img { object-fit: cover; background: #f0f2f5; }
</style>
