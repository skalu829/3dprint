<template>
  <div class="feed-page">
    <NavBar />

    <!-- 页面标题 -->
    <section class="page-header">
      <div class="header-inner">
        <h1>关注动态</h1>
        <p>你关注的设计师最新发布的作品</p>
      </div>
    </section>

    <main class="main-content">
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 未关注任何人 -->
      <div v-else-if="!loading && total === 0 && page === 1" class="empty-state">
        <MaterialIcon :path="ICONS.inbox" :size="48" color="#909399" class="empty-icon" />
        <p>暂无动态</p>
        <p class="empty-hint">去首页关注一些设计师，他们的新作品会出现在这里</p>
        <button class="btn-primary" @click="$router.push('/')">去首页</button>
      </div>

      <!-- 时间线列表 -->
      <div v-else class="feed-timeline">
        <div
          v-for="model in models"
          :key="model.id"
          class="timeline-card"
          @click="$router.push(`/model/${model.id}`)"
        >
          <!-- 左侧时间线 -->
          <div class="timeline-track">
            <div class="timeline-dot"></div>
          </div>

          <!-- 右侧卡片 -->
          <div class="card-body">
            <div class="card-author-row">
              <img v-if="authors[model.userId]?.avatarUrl" :src="authors[model.userId].avatarUrl" :alt="authors[model.userId].username" class="author-avatar author-avatar-img" />
              <span v-else class="author-avatar">{{ (authors[model.userId]?.username || '?')[0] }}</span>
              <div class="author-meta">
                <span class="author-name">{{ authors[model.userId]?.username || '未知用户' }}</span>
                <span class="publish-time">{{ formatRelativeTime(model.createdAt) }}</span>
              </div>
            </div>

            <h3 class="card-title">{{ model.title }}</h3>
            <p class="card-desc">{{ (model.description || '').slice(0, 80) }}</p>

            <!-- 缩略图或占位图 -->
            <div class="card-cover" :style="{ background: getGradient(model.id) }">
              <img
                v-if="model.thumbnailUrl"
                :src="model.thumbnailUrl"
                :alt="model.title"
                class="cover-img"
                loading="lazy"
              />
              <MaterialIcon v-else :path="getIcon(model.id)" :size="36" color="rgba(255,255,255,0.6)" class="cover-icon" />
            </div>

            <div class="card-footer">
              <div class="card-tags">
                <span v-for="tag in (model.tags || [])" :key="tag" class="card-tag">{{ tag }}</span>
              </div>
              <div class="card-stats">
                <span><MaterialIcon :path="ICONS.download" :size="11" /> {{ formatNum(model.downloads) }}</span>
                <span><MaterialIcon :path="ICONS.heart" :size="11" color="#f56c6c" /> {{ formatNum(model.likes) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="load-more">
          <button @click="loadMore" :disabled="loadingMore">
            {{ loadingMore ? '加载中...' : '加载更多' }}
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
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS, MODEL_ICONS } from '@/utils/icons'
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { get } from '@/utils/request'

const models = ref([])
const authors = ref({})
const loading = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const total = ref(0)
const pageSize = 20

const hasMore = computed(() => models.value.length < total.value)

async function fetchFeed(isLoadMore = false) {
  if (isLoadMore) {
    loadingMore.value = true
  }
  try {
    const data = await get(`/api/user/feed?page=${page.value}&pageSize=${pageSize}`)
    if (isLoadMore) {
      models.value.push(...data.models)
    } else {
      models.value = data.models || []
    }
    // 合并作者信息
    if (data.authors) {
      Object.assign(authors.value, data.authors)
    }
    total.value = data.total || 0
  } catch (err) {
    console.error('获取关注动态失败:', err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  page.value++
  fetchFeed(true)
}

function formatRelativeTime(iso) {
  if (!iso) return ''
  const now = Date.now()
  const date = new Date(iso).getTime()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前'
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNum(n) {
  if (!n) return 0
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

const gradients = ['linear-gradient(135deg, #667eea, #764ba2)', 'linear-gradient(135deg, #f093fb, #f5576c)', 'linear-gradient(135deg, #4facfe, #00f2fe)', 'linear-gradient(135deg, #43e97b, #38f9d7)', 'linear-gradient(135deg, #fa709a, #fee140)', 'linear-gradient(135deg, #a18cd1, #fbc2eb)', 'linear-gradient(135deg, #96fbc4, #f9f586)', 'linear-gradient(135deg, #ff9a9e, #fecfef)', 'linear-gradient(135deg, #a1c4fd, #c2e9fb)']
const icons = MODEL_ICONS

function getGradient(id) {
  let hash = 0
  for (let i = 0; i < (id || '').length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return gradients[Math.abs(hash) % gradients.length]
}

function getIcon(id) {
  let hash = 0
  for (let i = 0; i < (id || '').length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return icons[Math.abs(hash) % icons.length]
}

onMounted(() => fetchFeed())
</script>

<style scoped>
.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

/* 时间线 */
.feed-timeline {
  max-width: 680px;
  margin: 0 auto;
}

.timeline-card {
  display: flex;
  gap: 16px;
  cursor: pointer;
}
.timeline-card:last-child .timeline-track::after {
  display: none;
}

.timeline-track {
  flex-shrink: 0;
  width: 20px;
  position: relative;
}
.timeline-track::after {
  content: '';
  position: absolute;
  top: 18px;
  left: 9px;
  width: 2px;
  height: calc(100% + 24px);
  background: #e8e8e8;
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #667eea;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #667eea;
  position: absolute;
  top: 8px;
  left: 4px;
}

.card-body {
  flex: 1;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 24px;
  transition: box-shadow 0.2s;
}
.card-body:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.card-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.author-avatar-img {
  object-fit: cover;
  background: #f0f2f5;
}
.author-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.author-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}
.publish-time {
  font-size: 12px;
  color: #bbb;
}

.card-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 6px;
  line-height: 1.4;
}

.card-desc {
  font-size: 13px;
  color: #888;
  line-height: 1.6;
  margin-bottom: 12px;
}

.card-cover {
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-icon {
  font-size: 36px;
  opacity: 0.6;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.card-tag {
  padding: 2px 8px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 10px;
  font-size: 11px;
}
.card-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #aaa;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 20px 0;
}
.load-more button {
  padding: 10px 32px;
  border: 1px solid #667eea;
  border-radius: 20px;
  background: #fff;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.load-more button:hover:not(:disabled) {
  background: #667eea;
  color: #fff;
}
.load-more button:disabled {
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
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

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
