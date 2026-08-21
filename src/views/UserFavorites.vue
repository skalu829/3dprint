<template>
  <div class="user-page">
    <NavBar />

    <!-- 页面标题 -->
    <section class="page-header">
      <div class="header-inner">
        <h1>我的收藏</h1>
        <p>你收藏的所有模型</p>
      </div>
    </section>

    <main class="main-content">
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="models.length === 0" class="empty-state">
        <span class="empty-icon">🤍</span>
        <p>还没有收藏任何模型</p>
        <button class="btn-primary" @click="$router.push('/')">去发现</button>
      </div>

      <!-- 模型网格 -->
      <div v-else class="model-grid">
        <div
          v-for="m in models"
          :key="m.id"
          class="model-card"
          @click="$router.push(`/model/${m.id}`)"
        >
          <div class="card-preview" :style="{ background: m.previewColor }">
            <img
              v-if="m.thumbnailUrl"
              :src="m.thumbnailUrl"
              :alt="m.title"
              class="preview-thumb"
              loading="lazy"
            />
            <div v-else class="preview-placeholder">
              <span>{{ m.title[0] }}</span>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ m.title }}</h3>
            <p class="card-desc">{{ m.description || '暂无描述' }}</p>
            <div class="card-tags">
              <span v-for="tag in (m.tags || [])" :key="tag" class="card-tag">{{ tag }}</span>
            </div>
          </div>
          <div class="card-footer">
            <div class="card-author">
              <span class="author-initial">{{ (m.username || '?')[0] }}</span>
              <span class="author-name">{{ m.username || '未知' }}</span>
            </div>
            <div class="card-stats">
              <span class="stat">❤ {{ formatNum(m.likes) }}</span>
            </div>
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
import NavBar from '@/components/NavBar.vue'
import { get } from '@/utils/request'
import { isAuthenticated } from '@/utils/auth'

const models = ref([])
const loading = ref(false)

async function fetchFavorites() {
  if (!isAuthenticated()) return
  loading.value = true
  try {
    const data = await get('/api/user/favorites')
    models.value = data || []
  } catch (err) {
    console.error('获取收藏列表失败:', err)
  } finally {
    loading.value = false
  }
}

function formatNum(n) {
  if (!n) return 0
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

onMounted(fetchFavorites)
</script>

<style scoped>
.page-header {
  background: linear-gradient(135deg, #f56c6c 0%, #e03e3e 100%);
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
  margin-bottom: 16px;
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

/* 模型网格 */
.model-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.model-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.model-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 28px rgba(0,0,0,0.1);
}

.card-preview {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  font-weight: 700;
}

.card-body {
  padding: 14px 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.card-footer {
  padding: 10px 16px;
  border-top: 1px solid #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-author {
  display: flex;
  align-items: center;
  gap: 6px;
}
.author-initial {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
.author-name {
  font-size: 12px;
  color: #606266;
}
.card-stats {
  display: flex;
  gap: 10px;
}
.stat {
  font-size: 12px;
  color: #909399;
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

/* 响应式 */
@media (max-width: 900px) {
  .model-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 600px) {
  .model-grid {
    grid-template-columns: 1fr;
  }
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
</style>
