<template>
  <div class="history-page">
    <NavBar />

    <!-- 页面标题 -->
    <section class="page-header">
      <div class="header-inner">
        <div class="header-row">
          <div>
            <h1>浏览历史</h1>
            <p>你最近浏览过的模型</p>
          </div>
          <button
            v-if="history.length > 0"
            class="btn-clear"
            @click="clearAll"
          >清空记录</button>
        </div>
      </div>
    </section>

    <main class="main-content">
      <!-- 空状态 -->
      <div v-if="history.length === 0" class="empty-state">
        <MaterialIcon :path="ICONS.clock" :size="48" color="#909399" class="empty-icon" />
        <p>还没有浏览记录</p>
        <p class="empty-hint">去首页浏览模型，记录会出现在这里</p>
        <button class="btn-primary" @click="$router.push('/')">去首页</button>
      </div>

      <!-- 卡片网格 -->
      <div v-else class="model-grid">
        <div
          v-for="item in history"
          :key="item.id"
          class="model-card"
          @click="$router.push(`/model/${item.id}`)"
        >
          <div class="card-preview" :style="{ background: item.previewColor || '#ccc' }">
            <img
              v-if="item.thumbnailUrl"
              :src="item.thumbnailUrl"
              :alt="item.title"
              class="preview-thumb"
              loading="lazy"
            />
            <div v-else class="preview-placeholder">
              <MaterialIcon v-if="item.previewIcon" :path="item.previewIcon" :size="28" color="rgba(255,255,255,0.7)" /><MaterialIcon v-else :path="ICONS.packageVariant" :size="28" color="rgba(255,255,255,0.7)" />
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ item.title }}</h3>
            <p class="card-desc">{{ item.description || '暂无描述' }}</p>
            <div class="card-tags" v-if="item.tags && item.tags.length > 0">
              <span v-for="tag in item.tags" :key="tag" class="card-tag">{{ tag }}</span>
            </div>
          </div>
          <div class="card-footer">
            <div class="card-author">
              <span class="author-initial">{{ (item.author || '?')[0] }}</span>
              <span class="author-name">{{ item.author || '未知' }}</span>
            </div>
            <span class="view-time">{{ formatRelativeTime(item.viewedAt) }}</span>
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
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS } from '@/utils/icons'
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'

const BROWSE_HISTORY_KEY = 'browseHistory'

const history = ref(
  JSON.parse(localStorage.getItem(BROWSE_HISTORY_KEY) || '[]')
)

function clearAll() {
  if (!confirm('确定要清空所有浏览记录吗？此操作不可撤销。')) return
  localStorage.removeItem(BROWSE_HISTORY_KEY)
  history.value = []
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
</script>

<style scoped>
.page-header {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  padding: 40px 24px;
  color: #fff;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.btn-clear {
  padding: 8px 20px;
  border: 1px solid rgba(255,255,255,0.5);
  background: transparent;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.btn-clear:hover {
  background: rgba(255,255,255,0.2);
  border-color: #fff;
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

/* 卡片网格 */
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
  background: linear-gradient(135deg, #4facfe, #00f2fe);
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
.view-time {
  font-size: 11px;
  color: #bbb;
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

/* ========== 移动端 ========== */
@media (max-width: 768px) {
  .main-content {
    padding: 20px 12px;
  }
}
</style>
