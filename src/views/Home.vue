<template>
  <div class="home-page">
    <NavBar />

    <!-- Hero 搜索区 -->
    <section class="hero">
      <div class="hero-inner">
        <h1>发现精彩 3D 打印模型</h1>
        <p class="hero-desc">浏览来自全球创客的优质可打印模型，找到你的下一个项目</p>
        <div class="search-box">
          <MaterialIcon :path="ICONS.magnify" :size="20" color="#909399" class="search-icon" />
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索模型名称、标签、作者...或者试试「我想打印一个手机支架」"
            @input="onSearchInput"
            @keyup.enter="onSearchEnter"
          />
          <button v-if="searchKeyword" class="btn-clear" @click="clearSearch"><MaterialIcon :path="ICONS.close" :size="16" /></button>
        </div>
      </div>
    </section>

    <!-- 分类筛选 -->
    <section class="category-bar">
      <div class="category-inner">
        <button
          v-for="cat in categories"
          :key="cat"
          :class="['cat-btn', { active: activeCategory === cat }]"
          @click="activeCategory = activeCategory === cat ? '' : cat"
        >
          {{ cat }}
        </button>
      </div>
    </section>

    <!-- 模型网格 -->
    <main class="model-grid-section">
      <div v-if="filteredModels.length === 0" class="empty-state">
        <MaterialIcon :path="ICONS.inbox" :size="48" color="#909399" class="empty-icon" />
        <p>没有找到匹配的模型</p>
      </div>
      <div v-else class="model-grid">
        <div
          v-for="m in filteredModels"
          :key="m.id"
          class="model-card"
          @click="$router.push(`/model/${m.id}`)"
        >
          <!-- 预览图 -->
          <div class="card-preview" :style="{ background: m.previewColor }">
            <!-- 有真实缩略图时显示缩略图 -->
            <img
              v-if="m.thumbnailUrl"
              :src="apiBase + m.thumbnailUrl"
              :alt="m.title"
              class="preview-thumb"
              loading="lazy"
            />
            <!-- 否则显示 emoji 占位 -->
            <div v-else class="preview-geo">
              <MaterialIcon v-if="!m.thumbnailUrl" :path="m.previewIcon" :size="48" color="rgba(255,255,255,0.8)" class="preview-icon" />
            </div>
          </div>
          <!-- 信息 -->
          <div class="card-body">
            <h3 class="card-title">{{ m.title }}</h3>
            <p class="card-desc">{{ m.description }}</p>
            <div class="card-tags">
              <span v-for="tag in m.tags" :key="tag" class="card-tag">{{ tag }}</span>
            </div>
          </div>
          <!-- 底部 -->
          <div class="card-footer">
            <div class="card-author">
              <img v-if="m.authorAvatarUrl" :src="apiBase + m.authorAvatarUrl" :alt="m.author" class="author-avatar-img" />
              <span v-else class="author-initial">{{ m.author[0] }}</span>
              <span class="author-name">{{ m.author }}</span>
            </div>
            <div class="card-stats">
              <span class="stat"><MaterialIcon :path="ICONS.download" :size="12" /> {{ formatNum(m.downloads) }}</span>
              <span class="stat"><MaterialIcon :path="ICONS.heart" :size="12" color="#f56c6c" /> {{ formatNum(m.likes) }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="page-footer">
      <p>© 2026 3DPrint 模型分享平台 · 基于增材制造技术的内容共享社区</p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'HomePage'
}
</script>

<script setup>
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS, MODEL_ICONS } from '@/utils/icons'
import { ref, computed, onMounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { get } from '@/utils/request'

// API 基础地址（用于图片等静态资源）
const apiBase = process.env.VUE_APP_API_BASE || ''

// ========== 搜索与筛选 ==========
const searchKeyword = ref('')
const activeCategory = ref('')

const categories = ['机械零件', '家居用品', '玩具模型', '工具配件', '装饰摆件', '电子外壳']

// ========== 模拟模型数据 ==========
const seedModels = [

]

const colors = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'
]
const icons = MODEL_ICONS

function remoteToCard(m, idx) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    author: m.username,
    authorAvatarUrl: m.authorAvatarUrl || '',
    tags: m.tags,
    downloads: m.downloads,
    likes: m.likes,
    // 封面：优先真实缩略图，否则 emoji 占位
    thumbnailUrl: m.thumbnailUrl,
    previewColor: colors[idx % colors.length],
    previewIcon: icons[idx % icons.length]
  }
}

// ========== 加载模型 ==========
const models = ref([...seedModels])
const loading = ref(false)
const aiSearching = ref(false)

async function fetchModels() {
  loading.value = true
  try {
    const remote = await get('/api/models')
    const remoteCards = remote.map((m, i) => remoteToCard(m, seedModels.length + i))
    models.value = [...remoteCards, ...seedModels]
  } catch (err) {
    console.error('获取模型列表失败:', err)
  } finally {
    loading.value = false
  }
}

// AI 搜索
let searchTimer = null

function onSearch() {
  clearTimeout(searchTimer)
  const q = searchKeyword.value.trim()
  if (!q) {
    // 空搜索：恢复全部模型
    fetchModels()
    return
  }
  // 防抖 500ms 后触发搜索
  searchTimer = setTimeout(() => doSearch(q), 500)
}

function onSearchEnter() {
  clearTimeout(searchTimer)
  const q = searchKeyword.value.trim()
  if (!q) {
    fetchModels()
    return
  }
  doSearch(q)
}

async function doSearch(q) {
  aiSearching.value = true
  try {
    const results = await get(`/api/search?q=${encodeURIComponent(q)}`)
    models.value = results.map((m, i) => remoteToCard(m, i))
  } catch (err) {
    console.error('搜索失败:', err)
    // 降级为本地过滤
  } finally {
    aiSearching.value = false
  }
}

onMounted(() => {
  fetchModels()
})

// ========== 计算属性 ==========
const filteredModels = computed(() => {
  let list = models.value

  // 分类筛选（本地过滤，与 AI 搜索结果叠加）
  if (activeCategory.value) {
    list = list.filter(m => m.tags.includes(activeCategory.value))
  }

  return list
})

// ========== 方法 ==========
function onSearchInput() {
  onSearch()
}

function clearSearch() {
  searchKeyword.value = ''
  fetchModels()
}

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}
</script>

<style scoped>
/* ====== Hero 搜索区 ====== */
.hero {
  background: linear-gradient(135deg, #409eff 0%, #2d6cbf 100%);
  padding: 60px 24px;
  text-align: center;
}

.hero-inner {
  max-width: 640px;
  margin: 0 auto;
}

.hero h1 {
  font-size: 32px;
  color: #fff;
  font-weight: 700;
  margin-bottom: 12px;
}

.hero-desc {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 32px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.search-icon {
  padding: 0 14px;
  font-size: 18px;
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  padding: 14px 0;
  border: none;
  outline: none;
  font-size: 15px;
  color: #303133;
  font-family: inherit;
}

.search-box input::placeholder {
  color: #c0c4cc;
}

.btn-clear {
  padding: 0 14px;
  border: none;
  background: none;
  color: #909399;
  font-size: 16px;
  cursor: pointer;
}

.btn-clear:hover {
  color: #606266;
}

/* ====== 分类筛选 ====== */
.category-bar {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.category-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cat-btn {
  padding: 6px 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.cat-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.cat-btn.active {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

/* ====== 模型网格 ====== */
.model-grid-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
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

/* 卡片 */
.model-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  /* 纵向 flex：footer 固定贴底，标签有无/描述长短不再影响其位置 */
  display: flex;
  flex-direction: column;
}

.model-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
}

.card-preview {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-geo {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-icon {
  font-size: 56px;
  opacity: 0.9;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.card-body {
  padding: 16px;
  /* 占满剩余高度，把 footer 推到卡片最底部 */
  flex: 1;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-desc {
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  padding: 12px 16px;
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

.author-avatar-img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.author-name {
  font-size: 12px;
  color: #606266;
}

.card-stats {
  display: flex;
  gap: 12px;
}

.stat {
  font-size: 12px;
  color: #909399;
}

/* ====== 页脚 ====== */
.page-footer {
  text-align: center;
  padding: 30px 0;
  color: #bbb;
  font-size: 13px;
  border-top: 1px solid #f0f0f0;
}

/* ====== 响应式 ====== */
@media (max-width: 900px) {
  .model-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .model-grid {
    grid-template-columns: 1fr;
  }

  .hero h1 {
    font-size: 24px;
  }
}
</style>
