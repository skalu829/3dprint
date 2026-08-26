<template>
  <div class="profile-page">
    <NavBar />

    <!-- 页面顶部：头像 + 用户名 + 统计 -->
    <section class="profile-header">
      <div class="header-inner">
        <!-- 头像 -->
        <div class="avatar-wrapper" @click="isMe ? triggerAvatarInput() : null">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.username" class="avatar-img" />
          <div v-else class="avatar-placeholder">{{ (user.username || '?')[0] }}</div>
          <MaterialIcon v-if="isMe" :path="ICONS.camera" :size="16" color="#fff" class="avatar-edit-badge" />
          <input
            v-if="isMe"
            ref="avatarInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style="display:none"
            @change="onAvatarChange"
          />
        </div>

        <!-- 用户信息 -->
        <div class="profile-info">
          <div class="profile-row">
            <h1>{{ user.username }}</h1>
            <button v-if="!isMe" class="btn-follow" :class="{ following: iFollow }" @click="toggleFollow">
              {{ iFollow ? '✓ 已关注' : '+ 关注' }}
            </button>
            <button v-if="isMe" class="btn-edit" @click="showEditModal = true">编辑资料</button>
          </div>

          <!-- 邮箱未验证提示（仅自己可见） -->
          <div v-if="isMe && !user.emailVerified" class="verify-banner">
            <span>邮箱未验证，上传 / 评论 / 关注功能受限</span>
            <a href="#" @click.prevent="$router.push('/verify-email')">去验证 →</a>
          </div>

          <div class="stats-row">
            <span class="stat-item" @click="goTo('/user/' + user.id + '/following')">
              <strong>{{ user.followingCount || 0 }}</strong> 关注
            </span>
            <span class="stat-item" @click="goTo('/user/' + user.id + '/followers')">
              <strong>{{ user.followersCount || 0 }}</strong> 粉丝
            </span>
            <span class="stat-item">
              <strong>{{ user.modelsCount || 0 }}</strong> 模型
            </span>
          </div>

          <p v-if="user.bio" class="bio-text">{{ user.bio }}</p>
          <p v-if="user.email" class="email-text"><MaterialIcon :path="ICONS.email" :size="14" style="vertical-align:middle;margin-right:4px" /> {{ user.email }}</p>
          <p class="join-text">加入于 {{ formatDate(user.createdAt) }}</p>
        </div>
      </div>
    </section>

    <!-- Tab 切换 -->
    <section class="tab-bar">
      <div class="tab-inner">
        <button :class="['tab-btn', { active: activeTab === 'models' }]" @click="activeTab = 'models'">
          模型 ({{ user.modelsCount || 0 }})
        </button>
        <button :class="['tab-btn', { active: activeTab === 'likes' }]" @click="activeTab = 'likes'">
          收藏 ({{ user.favoritesCount || 0 }})
        </button>
      </div>
    </section>

    <!-- 模型列表 -->
    <main class="main-content">
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="activeTab === 'models' && modelList.length === 0" class="empty-state">
        <MaterialIcon :path="ICONS.packageVariant" :size="48" color="#909399" class="empty-icon" />
        <p>{{ isMe ? '你还没有上传模型' : '该用户还没有上传模型' }}</p>
        <button v-if="isMe" class="btn-primary" @click="$router.push('/upload')">去上传</button>
      </div>

      <div v-else-if="activeTab === 'likes' && likesList.length === 0" class="empty-state">
        <MaterialIcon :path="ICONS.heart" :size="48" color="#909399" class="empty-icon" />
        <p>还没有收藏模型</p>
      </div>

      <!-- 模型网格 -->
      <div v-else class="model-grid">
        <div
          v-for="m in (activeTab === 'models' ? modelList : likesList)"
          :key="m.id"
          class="model-card"
        >
          <div class="card-preview" :style="{ background: m.previewColor || '#ccc' }" @click="$router.push(`/model/${m.id}`)">
            <img v-if="m.thumbnailUrl" :src="m.thumbnailUrl" :alt="m.title" class="preview-thumb" loading="lazy" />
            <MaterialIcon v-else :path="m.previewIcon || ICONS.packageVariant" :size="40" color="rgba(255,255,255,0.7)" class="preview-icon" />
            <!-- 删除按钮（仅自己可见） -->
            <button
              v-if="isMe && activeTab === 'models'"
              class="btn-delete-model"
              @click.stop="deleteModel(m)"
              title="删除该模型"
            ><MaterialIcon :path="ICONS.delete" :size="16" /></button>
          </div>
          <div class="card-body" @click="$router.push(`/model/${m.id}`)">
            <h3 class="card-title">{{ m.title }}</h3>
            <div class="card-meta">
              <span><MaterialIcon :path="ICONS.download" :size="12" /> {{ formatNum(m.downloads || 0) }}</span>
              <span><MaterialIcon :path="ICONS.heart" :size="12" color="#f56c6c" /> {{ formatNum(m.likes || 0) }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 编辑资料弹窗 -->
    <div v-if="showEditModal" class="modal-mask" @click.self="showEditModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>编辑个人资料</h3>
          <button class="modal-close" @click="showEditModal = false"><MaterialIcon :path="ICONS.close" :size="18" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户名</label>
            <input v-model="editForm.username" type="text" maxlength="20" placeholder="3-20 个字符" />
          </div>
          <div class="form-group">
            <label>邮箱（可选）</label>
            <input v-model="editForm.email" type="email" placeholder="example@mail.com" />
          </div>
          <div class="form-group">
            <label>个人简介</label>
            <textarea v-model="editForm.bio" placeholder="介绍一下自己吧..." rows="3" maxlength="200"></textarea>
            <span class="char-count">{{ editForm.bio.length }}/200</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showEditModal = false">取消</button>
          <button class="btn-save" :disabled="saveLoading" @click="saveProfile">
            {{ saveLoading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <footer class="page-footer">
      <p>© 2026 3DPrint 模型分享平台</p>
    </footer>
  </div>
</template>

<script setup>
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS, PROFILE_ICONS } from '@/utils/icons'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { get, put, post, del, upload } from '@/utils/request'
import { isAuthenticated, getUser, setUser } from '@/utils/auth'

const route = useRoute()
const router = useRouter()

const avatarInput = ref(null)
const showEditModal = ref(false)
const saveLoading = ref(false)
const activeTab = ref('models')
const loading = ref(false)

const user = reactive({
  id: '',
  username: '',
  email: '',
  bio: '',
  avatarUrl: '',
  emailVerified: 1,
  followingCount: 0,
  followersCount: 0,
  modelsCount: 0,
  createdAt: ''
})

const editForm = reactive({
  username: '',
  email: '',
  bio: ''
})

const modelList = ref([])
const likesList = ref([])
const iFollow = ref(false)

const isMe = computed(() => {
  const me = getUser()
  // String() 容错：防止 id 类型不一致（string/number）导致 === 失败
  return !!(me && user.id && String(me.id) === String(user.id))
})

function goTo(path) {
  router.push(path)
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

// ========== 加载用户信息 ==========
async function fetchUser() {
  const userId = route.params.id
  loading.value = true
  try {
    const [profile, models, favorites] = await Promise.all([
      get(`/api/user/${userId}/profile`),
      get(`/api/models?userId=${userId}`),
      get(`/api/user/${userId}/favorites`)
    ])
    Object.assign(user, profile)
    modelList.value = models.slice(0, 30)
    // 为模型列表附加缩略图和颜色
    modelList.value.forEach((m, i) => {
      m.previewColor = [
        '#667eea','#f5576c','#4facfe','#43e97b','#fa709a',
        '#a18cd1','#96fbc4','#ff9a9e','#a1c4fd'
      ][i % 9]
      m.previewIcon = PROFILE_ICONS[i % 12]
    })
    // 收藏列表
    likesList.value = (favorites || []).slice(0, 30)
    likesList.value.forEach((m, i) => {
      m.previewColor = [
        '#667eea','#f5576c','#4facfe','#43e97b','#fa709a',
        '#a18cd1','#96fbc4','#ff9a9e','#a1c4fd'
      ][i % 9]
      m.previewIcon = ['🔧','📐','🧩','🔌','🐉','🥧','🪵','✏️','🔩','🏠','🎮','📦'][i % 12]
    })
    // 检查关注状态
    if (isAuthenticated() && !isMe.value) {
      try {
        const followData = await get(`/api/user/${userId}/follow`)
        iFollow.value = followData.following
      } catch { /* 未登录时静默跳过 */ }
    }
  } catch (err) {
    console.error('获取用户信息失败:', err)
  } finally {
    loading.value = false
  }
}

// ========== 头像上传 ==========
function triggerAvatarInput() {
  avatarInput.value?.click()
}

async function onAvatarChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('avatar', file)
  try {
    const data = await upload('/api/user/avatar', formData)
    user.avatarUrl = data.avatarUrl
    // 同步 localStorage 缓存 + 通知全局（其他页面显示新头像）
    const me = getUser()
    if (me) {
      setUser({ ...me, avatarUrl: data.avatarUrl })
      window.dispatchEvent(new CustomEvent('user-updated'))
    }
  } catch (err) {
    alert('头像上传失败：' + (err.message || '未知错误'))
  }
  // 清空 input，允许重复选同一文件
  e.target.value = ''
}

// ========== 保存个人资料 ==========
async function saveProfile() {
  // 前端校验：空名字/长度/邮箱格式，给用户明确提示
  const name = (editForm.username || '').trim()
  if (!name) {
    alert('用户名不能为空')
    return
  }
  if (name.length < 3 || name.length > 20) {
    alert('用户名长度应为 3-20 个字符')
    return
  }
  const email = (editForm.email || '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('邮箱格式不正确')
    return
  }

  saveLoading.value = true
  try {
    // 注意：字段直传（不用 || undefined），空字符串表示清空该字段
    const data = await put('/api/user/me', {
      username: name,
      email: email,
      bio: editForm.bio || ''
    })
    // 同步页面显示
    user.username = data.username || user.username
    user.email = data.email || ''
    user.bio = data.bio || ''

    // 同步 localStorage 缓存 + 通知全局（NavBar 等）
    const me = getUser()
    if (me) {
      setUser({ ...me, username: user.username, email: user.email, bio: user.bio })
      window.dispatchEvent(new CustomEvent('user-updated'))
    }

    showEditModal.value = false
    alert('保存成功')
  } catch (err) {
    alert('保存失败：' + (err.message || '未知错误'))
  } finally {
    saveLoading.value = false
  }
}

// ========== 关注/取关 ==========
async function toggleFollow() {
  if (!isAuthenticated()) return
  try {
    if (iFollow.value) {
      await del(`/api/user/${user.id}/follow`)
      iFollow.value = false
      user.followersCount = Math.max(0, user.followersCount - 1)
    } else {
      await post(`/api/user/${user.id}/follow`)
      iFollow.value = true
      user.followersCount += 1
    }
  } catch (err) {
    console.error('关注操作失败:', err)
  }
}

// ========== 删除模型 ==========
async function deleteModel(m) {
  if (!confirm(`确定要删除"${m.title}"吗？此操作不可恢复。`)) return
  try {
    await del(`/api/models/${m.id}`)
    // 从列表中移除
    modelList.value = modelList.value.filter(x => x.id !== m.id)
    user.modelsCount = Math.max(0, user.modelsCount - 1)
  } catch (err) {
    alert('删除失败：' + (err.message || '未知错误'))
  }
}

// 打开编辑弹窗时自动回填
watch(showEditModal, (val) => {
  if (val) {
    editForm.username = user.username || ''
    editForm.email = user.email || ''
    editForm.bio = user.bio || ''
  }
})

// 路由参数变化时重新加载（组件复用场景：从别人主页跳自己主页，否则显示旧数据）
watch(() => route.params.id, () => {
  if (route.params.id) fetchUser()
})

onMounted(() => {
  fetchUser()
})
</script>

<style scoped>
.profile-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 48px 24px 40px;
  color: #fff;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 32px;
}
@media (max-width: 640px) {
  .header-inner { flex-direction: column; text-align: center; }
}

/* 头像 */
.avatar-wrapper {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}
.avatar-img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid rgba(255,255,255,0.3);
}
.avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 700;
  border: 4px solid rgba(255,255,255,0.3);
}
.avatar-edit-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

/* 用户信息 */
.profile-info {
  flex: 1;
  min-width: 0;
}
.profile-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}
.profile-row h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}
.btn-follow {
  padding: 6px 20px;
  border: 1px solid #fff;
  background: transparent;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.btn-follow:hover { background: rgba(255,255,255,0.15); }
.btn-follow.following { background: rgba(255,255,255,0.2); }
.btn-edit {
  padding: 6px 20px;
  border: 1px solid rgba(255,255,255,0.5);
  background: transparent;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

/* 统计行 */
.verify-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 8px 14px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 8px;
  font-size: 13px;
  color: #b88230;
}

.verify-banner a {
  color: #409eff;
  text-decoration: none;
  white-space: nowrap;
}

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  font-size: 15px;
}
.stats-row .stat-item {
  cursor: pointer;
  transition: opacity 0.2s;
}
.stats-row .stat-item:hover { opacity: 0.75; }
.stats-row strong { font-weight: 700; margin-right: 2px; }

.bio-text {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 6px;
  white-space: pre-wrap;
}
.email-text {
  font-size: 13px;
  opacity: 0.75;
  margin-bottom: 4px;
}
.join-text {
  font-size: 12px;
  opacity: 0.6;
}

/* Tab 栏 */
.tab-bar {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  position: sticky;
  top: 60px;
  z-index: 10;
}
.tab-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 0;
}
.tab-btn {
  padding: 14px 24px;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #909399;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab-btn.active {
  color: #409eff;
  border-bottom-color: #409eff;
  font-weight: 600;
}

/* 主内容 */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
  min-height: 50vh;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.empty-state p { font-size: 15px; margin-bottom: 4px; }
.btn-primary {
  padding: 8px 24px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 12px;
}

/* 模型网格 */
.model-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
@media (max-width: 1200px) { .model-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .model-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .model-grid { grid-template-columns: 1fr; } }

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
  position: relative;
}
.preview-thumb { width: 100%; height: 100%; object-fit: cover; }
.preview-icon { font-size: 40px; }
.btn-delete-model {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(4px);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.btn-delete-model:hover {
  background: #f56c6c;
  color: #fff;
}
.card-body { padding: 14px 16px; }
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta { font-size: 12px; color: #909399; display: flex; gap: 10px; }

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-box {
  background: #fff;
  border-radius: 16px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 12px 48px rgba(0,0,0,0.15);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}
.modal-header h3 { font-size: 18px; font-weight: 700; margin: 0; }
.modal-close {
  width: 32px; height: 32px;
  border: none; background: transparent;
  font-size: 18px; cursor: pointer; border-radius: 8px;
}
.modal-close:hover { background: #f5f5f5; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
.modal-body .form-group { display: flex; flex-direction: column; gap: 6px; }
.modal-body label { font-size: 13px; font-weight: 600; color: #606266; }
.modal-body input,
.modal-body textarea {
  padding: 10px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}
.modal-body input:focus,
.modal-body textarea:focus { border-color: #409eff; }
.modal-body textarea { resize: vertical; }
.char-count { font-size: 12px; color: #909399; text-align: right; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}
.btn-cancel {
  padding: 8px 20px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.btn-save {
  padding: 8px 24px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

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
  width: 36px; height: 36px;
  border: 3px solid #dcdfe6;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
