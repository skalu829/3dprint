<template>
  <div class="model-detail-page">
    <NavBar />

    <!-- 面包屑 -->
    <div class="breadcrumb">
      <div class="breadcrumb-inner">
        <span @click="$router.push('/')" style="cursor:pointer">首页</span> &gt;
        <span>模型详情</span> &gt;
        <span>{{ model.title }}</span>
      </div>
    </div>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 加载中 -->
      <div v-if="loading" class="status-box">
        <MaterialIcon :path="ICONS.clock" :size="48" color="#909399" class="status-icon" />
        <p>加载模型中...</p>
      </div>

      <!-- 模型不存在 -->
      <div v-else-if="notFound" class="status-box">
        <MaterialIcon :path="ICONS.inbox" :size="48" color="#909399" class="status-icon" />
        <p>模型不存在或已被删除</p>
        <button class="btn-back" @click="$router.push('/')">返回首页</button>
      </div>

      <template v-else>
      <div class="detail-layout">

        <!-- 左侧: 3D预览 -->
        <section class="preview-section">
          <!-- 多零件切换标签 -->
          <div v-if="model.hasMultiObjects" class="object-tabs">
            <button
              v-for="(obj, idx) in objects"
              :key="obj.index"
              class="obj-tab"
              :class="{ active: currentObjIdx === idx }"
              @click="switchObject(idx)"
            >{{ obj.name || ('零件 ' + (obj.index + 1)) }}</button>
          </div>

          <ModelViewer
            :key="currentStlUrl()"
            :url="currentStlUrl()"
            format="stl"
            @loaded="onModelLoaded"
            @error="onModelError"
          />
        </section>

        <!-- 右侧: 模型信息 -->
        <section class="info-section">
          <!-- 标题区 -->
          <div class="title-block">
            <div class="title-row">
              <h1>{{ model.title }}</h1>
              <button
                v-if="isOwner"
                class="btn-edit-title"
                @click="openEditModal"
              ><MaterialIcon :path="ICONS.pencil" :size="14" style="vertical-align:middle;margin-right:3px" /> 编辑</button>
            </div>
            <div class="badge-row">
              <span v-for="tag in model.tags" :key="tag" class="tag">{{ tag }}</span>
              <span class="license-badge">{{ model.license }}</span>
            </div>
          </div>

          <!-- 作者信息卡片 -->
          <div class="author-card">
            <img v-if="model.author.avatarUrl" :src="model.author.avatarUrl" :alt="model.author.name" class="author-avatar author-avatar-img" />
            <div v-else class="author-avatar">{{ model.author.name[0] }}</div>
            <div class="author-info">
              <span class="author-name">{{ model.author.name }}</span>
              <span class="author-meta">{{ model.author.followers }} 位关注者 · {{ model.author.models }} 个模型</span>
            </div>
            <button
              v-if="!isOwnModel"
              class="btn-follow"
              :class="{ following: following }"
              :disabled="followLoading || (model.author.id === 'seed')"
              @click="toggleFollow"
            >
              {{ followLoading ? '...' : (following ? '✓ 已关注' : '+ 关注') }}
            </button>
          </div>

          <!-- 数据统计 -->
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ (model.stats.downloads || 0).toLocaleString() }}</span>
              <span class="stat-label">下载量</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ (model.stats.likes || 0).toLocaleString() }}</span>
              <span class="stat-label">收藏数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ model.stats.comments || 0 }}</span>
              <span class="stat-label">评论数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ (model.stats.views || 0).toLocaleString() }}</span>
              <span class="stat-label">浏览量</span>
            </div>
          </div>

          <!-- 文件信息 -->
          <div class="file-info-card">
            <h3><MaterialIcon :path="ICONS.fileDocument" :size="18" style="vertical-align:middle;margin-right:4px" /> 模型文件</h3>
            <div class="file-list">
              <div
                v-for="(file, idx) in model.files"
                :key="idx"
                class="file-item"
              >
                <div class="file-icon">{{ file.ext.toUpperCase() }}</div>
                <div class="file-details">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-size">{{ file.size }}</span>
                </div>
                <a
                  v-if="file.url"
                  :href="file.url"
                  class="btn-download-sm"
                  download
                >下载</a>
                <button v-else class="btn-download-sm">下载</button>
              </div>
            </div>
          </div>

          <!-- 操作按钮组 -->
          <div class="action-bar">
            <button
              class="btn-outline btn-like"
              :class="{ favorited: favorited }"
              :disabled="favoriteLoading"
              @click="toggleFavorite"
            >
              <MaterialIcon :path="favorited ? ICONS.heart : ICONS.heartOutline" :size="16" :color="favorited ? '#f56c6c' : '#606266'" style="vertical-align:middle;margin-right:4px" /> 收藏
            </button>
            <div class="share-wrapper">
              <button class="btn-outline btn-share" @click="toggleSharePanel">
                <MaterialIcon :path="ICONS.share" :size="16" style="vertical-align:middle;margin-right:4px" /> 分享
              </button>
              <!-- 分享面板 -->
              <div v-if="showSharePanel" class="share-panel">
                <div class="share-panel-header">
                  <span>分享到</span>
                  <button class="share-panel-close" @click="showSharePanel = false"><MaterialIcon :path="ICONS.close" :size="16" /></button>
                </div>
                <div class="share-options">
                  <button class="share-option" @click="doShare('link')">
                    <MaterialIcon :path="ICONS.link" :size="24" class="share-icon" />
                    <span>复制链接</span>
                  </button>
                  <button class="share-option" @click="doShare('wechat')">
                    <MaterialIcon :path="ICONS.wechat" :size="24" color="#07c160" class="share-icon" />
                    <span>微信</span>
                  </button>
                  <button class="share-option" @click="doShare('weibo')">
                    <MaterialIcon :path="ICONS.bullhorn" :size="24" color="#e6162d" class="share-icon" />
                    <span>微博</span>
                  </button>
                  <button class="share-option" @click="doShare('qq')">
                    <MaterialIcon :path="ICONS.qq" :size="24" color="#12b7f5" class="share-icon" />
                    <span>QQ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 打印参数建议 -->
          <div class="print-params-card" v-if="model.printParams">
            <h3><MaterialIcon :path="ICONS.cog" :size="18" style="vertical-align:middle;margin-right:4px" /> 打印参数建议</h3>
            <table class="params-table">
              <tr v-if="model.printParams.layerHeight">
                <td>层高</td>
                <td><strong>{{ model.printParams.layerHeight }}</strong></td>
              </tr>
              <tr v-if="model.printParams.infill">
                <td>填充率</td>
                <td><strong>{{ model.printParams.infill }}</strong></td>
              </tr>
              <tr v-if="model.printParams.temperature">
                <td>打印温度</td>
                <td><strong>{{ model.printParams.temperature }}</strong></td>
              </tr>
              <tr v-if="model.printParams.support !== undefined">
                <td>是否需要支撑</td>
                <td><strong>{{ model.printParams.support ? '是' : '否' }}</strong></td>
              </tr>
              <tr v-if="model.printParams.estimatedTime">
                <td>预计耗时</td>
                <td><strong>{{ model.printParams.estimatedTime }}</strong></td>
              </tr>
            </table>
          </div>
        </section>
      </div>

      <!-- 底部: 描述、作者作品、浏览历史与评论区 -->
      <section class="bottom-section">
        <!-- 左侧列 -->
        <div class="bottom-left">
          <!-- 模型描述 -->
          <div class="description-block">
            <h3><MaterialIcon :path="ICONS.pencil" :size="18" style="vertical-align:middle;margin-right:4px" /> 模型说明</h3>
            <p class="desc-text" style="white-space: pre-wrap;">{{ model.description }}</p>
          </div>

          <!-- 作者其他作品 -->
          <div v-if="authorModels.length > 0" class="related-block">
            <h3><MaterialIcon :path="ICONS.account" :size="18" style="vertical-align:middle;margin-right:4px" /> {{ model.author.name }} 的其他作品</h3>
            <div class="related-grid">
              <div
                v-for="am in authorModels"
                :key="am.id"
                class="related-card"
                @click="$router.push(`/model/${am.id}`)"
              >
                <div class="related-thumb" :style="{ background: getGradient(am.id) }">
                  <img v-if="am.thumbnailUrl" :src="am.thumbnailUrl" :alt="am.title" class="related-img" />
                  <MaterialIcon v-else :path="getIcon(am.id)" :size="28" color="rgba(255,255,255,0.7)" class="related-icon" />
                </div>
                <div class="related-info">
                  <span class="related-title">{{ am.title }}</span>
                  <span class="related-meta"><MaterialIcon :path="ICONS.download" :size="10" /> {{ formatNum(am.downloads || 0) }} · <MaterialIcon :path="ICONS.heart" :size="10" color="#f56c6c" /> {{ formatNum(am.likes || 0) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 浏览历史 -->
          <div v-if="browseHistoryList.length > 0" class="related-block">
            <h3><MaterialIcon :path="ICONS.clock" :size="18" style="vertical-align:middle;margin-right:4px" /> 最近浏览</h3>
            <div class="related-grid">
              <div
                v-for="bh in browseHistoryList"
                :key="bh.id"
                class="related-card"
                @click="goToModel(bh.id)"
              >
                <div class="related-thumb" :style="{ background: bh.previewColor || '#ccc' }">
                  <img v-if="bh.thumbnailUrl" :src="bh.thumbnailUrl" :alt="bh.title" class="related-img" />
                  <MaterialIcon v-else :path="bh.previewIcon || ICONS.packageVariant" :size="28" color="rgba(255,255,255,0.7)" class="related-icon" />
                </div>
                <div class="related-info">
                  <span class="related-title">{{ bh.title }}</span>
                  <span class="related-meta">{{ bh.author }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧列：评论区 -->
        <div class="comments-block">
          <h3><MaterialIcon :path="ICONS.comment" :size="18" style="vertical-align:middle;margin-right:4px" /> 评论区（{{ comments.length }}）</h3>
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="comment-item"
          >
            <img v-if="comment.avatarUrl" :src="comment.avatarUrl" :alt="comment.username" class="comment-avatar comment-avatar-img" />
            <div v-else class="comment-avatar">{{ comment.username[0] }}</div>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-user">{{ comment.username }}</span>
                <span class="comment-time">{{ formatTime(comment.createdAt) }}</span>
              </div>
              <p class="comment-content">{{ comment.content }}</p>
              <div class="comment-actions">
                <span @click="toggleCommentLike(comment)">
                  <MaterialIcon :path="(comment.likedBy || []).includes(getUser()?.id) ? ICONS.heart : ICONS.heartOutline" :size="14" :color="(comment.likedBy || []).includes(getUser()?.id) ? '#f56c6c' : '#aaa'" style="vertical-align:middle" />
                  赞 {{ comment.likes || 0 }}
                </span>
                <span
                  v-if="comment.userId === getUser()?.id"
                  class="comment-delete"
                  @click="deleteComment(comment.id)"
                >删除</span>
              </div>
            </div>
          </div>
          <div v-if="comments.length === 0 && !commentsLoading" class="empty-comments">
            <p>还没有评论，来第一个留言吧！</p>
          </div>
          <div v-if="commentsLoading" class="empty-comments">
            <p>加载评论中...</p>
          </div>
          <div class="comment-input-area" v-if="isAuthenticated()">
            <textarea
              v-model="commentContent"
              placeholder="写下你的评论..."
              rows="2"
              maxlength="500"
            ></textarea>
            <button
              class="btn-comment-submit"
              :disabled="commentSubmitting || !commentContent.trim()"
              @click="submitComment"
            >{{ commentSubmitting ? '发表中...' : '发表评论' }}</button>
          </div>
          <div v-else class="empty-comments">
            <p>请先登录后再发表评论</p>
          </div>
        </div>
      </section>
      </template>
    </main>

    <!-- 底部页脚 -->
    <footer class="page-footer">
      <p>© 2026 3DPrint 模型分享平台 · 基于增材制造技术的内容共享社区</p>
    </footer>

    <!-- 编辑模型弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="cancelEdit">
      <div class="edit-modal">
        <div class="edit-modal-header">
          <h3>编辑模型</h3>
          <button class="modal-close" @click="cancelEdit"><MaterialIcon :path="ICONS.close" :size="18" /></button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-field">
            <label>标题</label>
            <input v-model="editForm.title" type="text" class="edit-input" placeholder="模型标题" />
          </div>
          <div class="edit-field">
            <label>描述</label>
            <textarea v-model="editForm.description" class="edit-textarea" rows="4" placeholder="模型描述"></textarea>
          </div>
          <div class="edit-field">
            <label>标签</label>
            <div class="edit-tags">
              <button
                v-for="tag in PRESET_TAGS"
                :key="tag"
                type="button"
                :class="['edit-tag-btn', { selected: editForm.tags.includes(tag) }]"
                @click="toggleEditTag(tag)"
              >{{ tag }}</button>
            </div>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn-cancel" @click="cancelEdit">取消</button>
          <button class="btn-save" :disabled="editSubmitting" @click="saveEdit">
            {{ editSubmitting ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS, MODEL_ICONS } from '@/utils/icons'
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ModelViewer from '@/components/ModelViewer.vue'
import NavBar from '@/components/NavBar.vue'
import { get, post, put, del } from '@/utils/request'
import { isAuthenticated, getUser } from '@/utils/auth'

const PRESET_TAGS = ['机械零件', '家居用品', '玩具模型', '工具配件', '装饰摆件', '电子外壳']

const route = useRoute()
const router = useRouter()

// ========== 多零件支持 ==========
const objects = ref([])       // 零件列表（从 _objects.json 加载）
const currentObjIdx = ref(0) // 当前预览的零件索引（0~N-1）

function buildObjectUrl(fileName, suffix) {
  // fileName: 如 "1781401819044_________________3mf"
  // suffix:  如 "_obj_0_thumb.png" 或 "_obj_0_export.stl"
  return `/uploads/thumbnails/${fileName}${suffix}`
}

// 当前预览使用的 STL URL（供 ModelViewer :key 和 :url 使用）
function currentStlUrl() {
  // 有多零件数据时，使用当前选中零件的 STL（相对路径，dev proxy 转发到后端）
  if (model.hasMultiObjects && objects.value.length > 0) {
    const obj = objects.value[currentObjIdx.value]
    if (obj && model.baseFileName) {
      return buildObjectUrl(model.baseFileName, `_obj_${obj.index}_export.stl`)
    }
  }
  // 无多零件或单零件模式：使用后端提供的整体 STL URL（相对路径）
  return model.modelUrl || ''
}

// ========== 模型数据 ==========
const model = reactive({
  title: '',
  tags: [],
  license: 'CC BY-SA 4.0',
  format: 'stl',
  modelUrl: '',
  printParams: null,
  author: { id: '', name: '', followers: 0, models: 0 },
  stats: { downloads: 0, likes: 0, comments: 0, views: 0, shares: 0 },
  files: [],
  description: '',
  baseFileName: '',
  hasMultiObjects: false
})
const loading = ref(true)
const notFound = ref(false)
const modelId = ref('')
const modelUserId = ref('')

// ========== 是否模型所有者 ==========
const isOwner = computed(() => {
  if (!isAuthenticated()) return false
  const user = getUser()
  return user && (user.id === modelUserId.value)
})

// ========== 是否自己的模型（隐藏"关注自己"按钮） ==========
const isOwnModel = computed(() => {
  const me = getUser()
  return !!(me && model.author.id && String(me.id) === String(model.author.id))
})

// ========== 编辑弹窗 ==========
const showEditModal = ref(false)
const editSubmitting = ref(false)
const editForm = reactive({
  title: '',
  description: '',
  tags: []
})

function openEditModal() {
  editForm.title = model.title
  editForm.description = model.description
  editForm.tags = [...model.tags.filter(t => PRESET_TAGS.includes(t))]
  showEditModal.value = true
}

function cancelEdit() {
  showEditModal.value = false
}

function toggleEditTag(tag) {
  const idx = editForm.tags.indexOf(tag)
  if (idx > -1) {
    editForm.tags.splice(idx, 1)
  } else {
    editForm.tags.push(tag)
  }
}

async function saveEdit() {
  if (!editForm.title.trim()) return
  editSubmitting.value = true
  try {
    const updated = await put(`/api/models/${modelId.value}`, {
      title: editForm.title.trim(),
      description: editForm.description,
      tags: editForm.tags
    })
    // 同步更新 model 数据
    model.title = updated.title
    model.description = updated.description
    model.tags = [...updated.tags, model.tags.find(t => !PRESET_TAGS.includes(t)) || ''].filter(Boolean)
    showEditModal.value = false
  } catch (err) {
    console.error('编辑模型失败:', err)
    alert('编辑失败：' + (err.message || '未知错误'))
  } finally {
    editSubmitting.value = false
  }
}

// ========== 收藏状态 ==========
const favorited = ref(false)
const favoriteLoading = ref(false)

async function checkFavoriteStatus() {
  if (!isAuthenticated() || !modelId.value) return
  try {
    const data = await get(`/api/models/${modelId.value}/favorite`)
    favorited.value = data.favorited
  } catch (err) {
    // 种子模型静默失败
  }
}

async function toggleFavorite() {
  if (!isAuthenticated()) return
  if (!modelId.value || /^[1-9]$/.test(modelId.value)) return // 种子模型跳过
  favoriteLoading.value = true
  try {
    if (favorited.value) {
      const data = await del(`/api/models/${modelId.value}/favorite`)
      favorited.value = false
      model.stats.likes = data.likes
    } else {
      const data = await post(`/api/models/${modelId.value}/favorite`)
      favorited.value = true
      model.stats.likes = data.likes
    }
  } catch (err) {
    console.error('收藏操作失败:', err)
  } finally {
    favoriteLoading.value = false
  }
}

// ========== 分享状态 ==========
const showSharePanel = ref(false)
const shareLoading = ref(false)

function toggleSharePanel() {
  showSharePanel.value = !showSharePanel.value
}

async function doShare(platform) {
  if (!isAuthenticated()) return
  if (!modelId.value || /^[1-9]$/.test(modelId.value)) return
  shareLoading.value = true
  try {
    const data = await post(`/api/models/${modelId.value}/share`, { platform })
    model.stats.shares = data.shares
    // 复制链接到剪贴板
    if (platform === 'link') {
      try {
        await navigator.clipboard.writeText(data.shareUrl)
        alert('链接已复制到剪贴板！')
      } catch {
        // fallback
      }
    }
    showSharePanel.value = false
  } catch (err) {
    console.error('分享失败:', err)
  } finally {
    shareLoading.value = false
  }
}

// ========== 评论 ==========
const comments = ref([])
const commentContent = ref('')
const commentSubmitting = ref(false)
const commentsLoading = ref(false)

async function fetchComments() {
  if (!modelId.value) return
  commentsLoading.value = true
  try {
    comments.value = await get(`/api/models/${modelId.value}/comments`)
  } catch (err) {
    console.error('获取评论失败:', err)
  } finally {
    commentsLoading.value = false
  }
}

async function submitComment() {
  if (!commentContent.value.trim()) return
  if (!isAuthenticated()) return
  commentSubmitting.value = true
  try {
    const comment = await post(`/api/models/${modelId.value}/comments`, {
      content: commentContent.value.trim()
    })
    comments.value.unshift(comment)
    commentContent.value = ''
    model.stats.comments = (model.stats.comments || 0) + 1
  } catch (err) {
    console.error('发表评论失败:', err)
  } finally {
    commentSubmitting.value = false
  }
}

async function deleteComment(commentId) {
  if (!confirm('确定删除这条评论吗？')) return
  try {
    const data = await del(`/api/models/${modelId.value}/comments/${commentId}`)
    comments.value = comments.value.filter(c => c.id !== commentId)
    model.stats.comments = data.comments
  } catch (err) {
    console.error('删除评论失败:', err)
  }
}

async function toggleCommentLike(comment) {
  if (!isAuthenticated()) return
  try {
    const data = await post(`/api/models/${modelId.value}/comments/${comment.id}/like`)
    comment.likes = data.likes
    comment.likedBy = data.liked ? [...(comment.likedBy || []), getUser()?.id] : (comment.likedBy || []).filter(id => id !== getUser()?.id)
  } catch (err) {
    console.error('点赞评论失败:', err)
  }
}

// ========== 关注状态 ==========
const following = ref(false)
const followLoading = ref(false)
const authorFollowers = ref(0)

async function checkFollowStatus() {
  if (!isAuthenticated() || !model.author.id || model.author.id === 'seed') return
  try {
    const data = await get(`/api/user/${model.author.id}/follow`)
    following.value = data.following
    authorFollowers.value = data.followersCount
    model.author.followers = data.followersCount
  } catch (err) {
    // 静默失败
  }
}

async function toggleFollow() {
  if (!isAuthenticated()) return
  if (!model.author.id || model.author.id === 'seed' || model.author.id === getUser()?.id) return
  followLoading.value = true
  try {
    if (following.value) {
      const data = await del(`/api/user/${model.author.id}/follow`)
      following.value = false
      authorFollowers.value = data.followersCount
      model.author.followers = data.followersCount
    } else {
      const data = await post(`/api/user/${model.author.id}/follow`)
      following.value = true
      authorFollowers.value = data.followersCount
      model.author.followers = data.followersCount
    }
  } catch (err) {
    console.error('关注操作失败:', err)
  } finally {
    followLoading.value = false
  }
}

// ========== 从后端加载模型 ==========
function formatFileSize(bytes) {
  if (!bytes) return '未知'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前'
  return d.toLocaleDateString('zh-CN')
}

async function fetchModel() {
  modelId.value = route.params.id
  loading.value = true
  notFound.value = false

  try {
    const data = await get(`/api/models/${modelId.value}`)
    modelUserId.value = data.userId
    model.title = data.title
    model.tags = data.tags && data.tags.length
      ? [...data.tags, data.fileExt.replace('.', '').toUpperCase()]
      : [data.fileExt.replace('.', '').toUpperCase()]
    model.license = 'CC BY-SA 4.0'

    // 基础文件信息
    model.author = { id: data.userId, name: data.username, followers: 0, models: 1, avatarUrl: data.authorAvatarUrl || '' }
    model.stats = {
      downloads: data.downloads || 0,
      likes: data.likes || 0,
      comments: data.comments || 0,
      views: data.views || 0,
      shares: data.shares || 0
    }
    // fileUrl 兜底：历史数据存的是 http://localhost:3001/...，剥掉 host 改为相对路径跟随当前域名
    model.files = [{
      name: data.fileName,
      ext: data.fileExt.replace('.', ''),
      size: formatFileSize(data.fileSize),
      url: (data.fileUrl || '').replace(/^https?:\/\/[^/]+/, '')
    }]
    model.description = data.description || '暂无描述'
    model.printParams = null

    // ===== 多零件支持 =====
    model.baseFileName = (data.baseName || '').replace(/\.3mf$/i, '')
    model.hasMultiObjects = false
    objects.value = []
    currentObjIdx.value = 0

    if ((data.fileExt || '').toLowerCase() === '.3mf') {
      try {
        const objData = await get(`/api/models/${modelId.value}/objects`)
        if (objData && objData.objects && objData.objects.length > 0) {
          objects.value = objData.objects
          model.hasMultiObjects = objData.objects.length > 1
        }
      } catch (e) {
        console.log('无多零件数据，使用整体模型')
      }
    }

    // 设置 3D 预览 URL
    model.format = 'stl'
    model.modelUrl = data.stlUrl || ''

    // 写入浏览历史
    saveBrowseHistory(data)

    // 加载关联数据
    await Promise.all([
      checkFavoriteStatus(),
      checkFollowStatus(),
      fetchComments(),
      fetchAuthorModels()
    ])
  } catch (err) {
    console.error('获取模型详情失败:', err)
    notFound.value = true
  } finally {
    loading.value = false
  }
}

// ========== 浏览历史 ==========
function saveBrowseHistory(data) {
  try {
    const key = 'browseHistory'
    let history = JSON.parse(localStorage.getItem(key) || '[]')
    // 去重：移除同一模型 ID 的旧记录
    history = history.filter(h => h.id !== data.id)
    // 插入到最前面
    history.unshift({
      id: data.id,
      title: data.title,
      description: (data.description || '').slice(0, 60),
      author: data.username,
      tags: data.tags || [],
      thumbnailUrl: data.thumbnailUrl,
      previewColor: ['#667eea','#f5576c','#4facfe','#43e97b','#fa709a','#a18cd1','#96fbc4','#ff9a9e','#a1c4fd'][history.length % 9],
      previewIcon: MODEL_ICONS[history.length % 12],
      viewedAt: new Date().toISOString()
    })
    // 最多保留 30 条
    if (history.length > 30) history = history.slice(0, 30)
    localStorage.setItem(key, JSON.stringify(history))
  } catch { /* localStorage 不可用时静默跳过 */ }
}

// ========== 作者其他作品 ==========
const authorModels = ref([])
const authorModelsLoading = ref(false)

async function fetchAuthorModels() {
  if (!model.author.id) return
  authorModelsLoading.value = true
  try {
    const remote = await get(`/api/models?userId=${model.author.id}`)
    // 过滤掉当前模型本身
    authorModels.value = remote
      .filter(m => m.id !== modelId.value)
      .slice(0, 6)
  } catch (err) {
    console.error('获取作者作品失败:', err)
  } finally {
    authorModelsLoading.value = false
  }
}

// ========== 浏览历史列表 ==========
const browseHistoryList = ref([])

function loadBrowseHistory() {
  try {
    browseHistoryList.value = JSON.parse(localStorage.getItem('browseHistory') || '[]')
      .filter(h => h.id !== modelId.value)
      .slice(0, 6)
  } catch {
    browseHistoryList.value = []
  }
}

function goToModel(id) {
  router.push('/model/' + id)
}

onMounted(() => {
  fetchModel()
  loadBrowseHistory()
})

// 监听路由参数变化：从 /model/1 跳转到 /model/2 时重新加载
watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchModel()
    loadBrowseHistory()
  }
})

// ========== 辅助函数 ==========
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

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// ========== 零件切换 ==========
function switchObject(idx) {
  currentObjIdx.value = idx
  // ModelViewer 通过 :key="currentStlUrl()" 重新加载
}

// ========== 事件处理 ==========
function onModelLoaded() {
  console.log('模型加载完成')
}

function onModelError(e) {
  console.error('模型加载错误:', e)
}
</script>

<style scoped>
/* ====== 面包屑 ====== */
.breadcrumb {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.breadcrumb-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 24px;
  font-size: 13px;
  color: #909399;
}

/* ====== 主内容 ====== */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.detail-layout {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 24px;
}

/* ====== 左侧预览区 ====== */
.preview-section {
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

/* 零件切换标签 */
.object-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.obj-tab {
  padding: 6px 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  font-family: inherit;
}

.obj-tab:hover {
  border-color: #409eff;
  color: #409eff;
}

.obj-tab.active {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

/* ====== 右侧信息区 ====== */
.info-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title-block h1 {
  font-size: 22px;
  line-height: 1.4;
  color: #303133;
  font-weight: 600;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.tag {
  padding: 3px 10px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 12px;
  font-size: 12px;
}

.license-badge {
  padding: 3px 10px;
  background: #f0f9eb;
  color: #67c23a;
  border-radius: 12px;
  font-size: 12px;
  font-family: monospace;
}

/* 作者卡片 */
.author-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #fafafa;
  border-radius: 10px;
  border: 1px solid #ebeef5;
}

.author-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}
.author-avatar-img {
  object-fit: cover;
  background: #f0f2f5;
}

.author-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.author-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.author-meta {
  font-size: 12px;
  color: #909399;
}

.btn-follow {
  padding: 5px 14px;
  border: 1px solid #409eff;
  background: transparent;
  color: #409eff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
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

.btn-follow:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 统计数据 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  overflow: hidden;
}

.stat-item {
  padding: 14px 8px;
  text-align: center;
  background: #fff;
  border-right: 1px solid #f0f0f0;
}

.stat-item:last-child {
  border-right: none;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

/* 文件信息 */
.file-info-card {
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 14px 16px;
}

.file-info-card h3 {
  font-size: 14px;
  margin-bottom: 10px;
  color: #303133;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #eee;
}

.file-icon {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background: #ecf5ff;
  color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.file-name {
  font-size: 13px;
  color: #303133;
}

.file-size {
  font-size: 11px;
  color: #aaa;
}

.btn-download-sm {
  padding: 5px 12px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  text-decoration: none;
  display: inline-block;
}

.btn-download-sm:hover {
  border-color: #409eff;
  color: #409eff;
}

/* 操作按钮 */
.action-bar {
  display: flex;
  gap: 10px;
}

.btn-primary {
  flex: 1;
  padding: 11px 0;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.88;
}

.btn-outline {
  padding: 11px 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: #606266;
  transition: all 0.2s;
}

.btn-outline:hover {
  border-color: #409eff;
  color: #409eff;
}

.btn-like:hover {
  border-color: #f56c6c;
  color: #f56c6c;
}

.btn-like.favorited {
  border-color: #f56c6c;
  color: #f56c6c;
  background: #fef0f0;
}

.btn-like:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 分享面板 */
.share-wrapper {
  position: relative;
}

.share-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 50;
  overflow: hidden;
}

.share-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #f0f0f0;
}

.share-panel-close {
  border: none;
  background: none;
  font-size: 16px;
  color: #909399;
  cursor: pointer;
  padding: 0;
}

.share-panel-close:hover {
  color: #606266;
}

.share-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: #f5f5f5;
}

.share-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border: none;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  transition: background 0.15s;
  font-family: inherit;
}

.share-option:hover {
  background: #f5f7fa;
}

.share-icon {
  font-size: 24px;
}

/* 评论删除按钮 */
.comment-delete {
  color: #f56c6c !important;
}

.comment-delete:hover {
  color: #f56c6c !important;
  opacity: 0.8;
}

/* 打印参数 */
.print-params-card {
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 14px 16px;
}

.print-params-card h3 {
  font-size: 14px;
  margin-bottom: 10px;
  color: #303133;
}

.params-table {
  width: 100%;
  border-collapse: collapse;
}

.params-table td {
  padding: 7px 0;
  font-size: 13px;
  color: #555;
  border-bottom: 1px dashed #eee;
}

.params-table td:first-child {
  width: 110px;
  color: #888;
  white-space: nowrap;
}

.params-table td strong {
  color: #303133;
}

/* ====== 底部区域 ====== */
.bottom-section {
  margin-top: 28px;
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 24px;
}

.bottom-left {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.description-block {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 20px 24px;
}

.description-block h3,
.comments-block h3 {
  font-size: 16px;
  margin-bottom: 14px;
  color: #303133;
}

.desc-text {
  font-size: 14px;
  line-height: 1.85;
  color: #50535a;
  white-space: pre-line;
}

/* 评论区 */
.comments-block {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 20px 24px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f5f5f5;
}

.comment-item:last-of-type {
  border-bottom: none;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ecf5ff;
  color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.comment-avatar-img {
  object-fit: cover;
  background: #f0f2f5;
}

.comment-body {
  flex: 1;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.comment-user {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.comment-time {
  font-size: 12px;
  color: #bbb;
}

.comment-content {
  font-size: 13px;
  line-height: 1.65;
  color: #555;
  margin: 6px 0;
}

.comment-actions {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #aaa;
  cursor: pointer;
}

.comment-actions span:hover {
  color: #409eff;
}

.comment-input-area {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-input-area textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  resize: vertical;
  font-size: 13px;
  outline-color: #409eff;
  font-family: inherit;
}

.btn-comment-submit {
  align-self: flex-end;
  padding: 6px 20px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

/* 空评论提示 */
.empty-comments {
  text-align: center;
  padding: 24px 0;
  color: #bbb;
  font-size: 13px;
}

/* 状态提示（加载中/模型不存在） */
.status-box {
  text-align: center;
  padding: 80px 0;
  color: #909399;
}

.status-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.status-box p {
  font-size: 15px;
  margin-bottom: 16px;
}

.btn-back {
  padding: 8px 20px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  transition: all 0.2s;
}

.btn-back:hover {
  border-color: #409eff;
  color: #409eff;
}

/* 相关作品 / 浏览历史 */
.related-block {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 20px 24px;
}

.related-block h3 {
  font-size: 16px;
  margin-bottom: 14px;
  color: #303133;
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.related-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.related-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.related-thumb {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.related-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.related-icon {
  font-size: 28px;
  opacity: 0.8;
}

.related-info {
  padding: 8px 10px;
}

.related-title {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.related-meta {
  font-size: 11px;
  color: #aaa;
  margin-top: 2px;
}

/* ====== 页脚 ====== */
.page-footer {
  text-align: center;
  padding: 30px 0;
  color: #bbb;
  font-size: 13px;
  border-top: 1px solid #f0f0f0;
  margin-top: 40px;
}

/* ====== 编辑按钮 ====== */
.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-row h1 {
  flex: 1;
  margin: 0;
}

.btn-edit-title {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-edit-title:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}

/* ====== 编辑弹窗 ====== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.edit-modal {
  background: #fff;
  border-radius: 12px;
  width: 520px;
  max-width: 90vw;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

.edit-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.edit-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.modal-close {
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: #909399;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #303133;
}

.edit-modal-body {
  padding: 20px 24px;
}

.edit-field {
  margin-bottom: 18px;
}

.edit-field:last-child {
  margin-bottom: 0;
}

.edit-field label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
}

.edit-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 14px;
  color: #303133;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.edit-input:focus {
  border-color: #409eff;
}

.edit-textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 14px;
  color: #303133;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.edit-textarea:focus {
  border-color: #409eff;
}

.edit-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.edit-tag-btn {
  padding: 5px 14px;
  border: 1.5px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s;
  font-family: inherit;
}

.edit-tag-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.edit-tag-btn.selected {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

.edit-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid #f0f0f0;
}

.btn-cancel {
  padding: 8px 20px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-cancel:hover {
  border-color: #409eff;
  color: #409eff;
}

.btn-save {
  padding: 8px 24px;
  border: none;
  background: #409eff;
  color: #fff;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}

.btn-save:hover {
  background: #337ecc;
}

.btn-save:disabled {
  background: #a0cfff;
  cursor: not-allowed;
}

/* ========== 移动端适配 ========== */
/* 平板：双栏 → 单栏（420px 侧栏放不下） */
@media (max-width: 1024px) {
  .detail-layout,
  .bottom-section {
    grid-template-columns: 1fr;
  }
}

/* 手机 */
@media (max-width: 768px) {
  .breadcrumb-inner {
    padding: 8px 12px;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .main-content {
    padding: 12px;
  }

  .preview-section {
    /* 手机上预览区过高会占满首屏，压缩高度 */
    min-height: 340px;
  }

  .title-block h1 {
    font-size: 18px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .related-grid {
    grid-template-columns: 1fr;
  }

  .comment-input-area textarea {
    font-size: 16px; /* 防止 iOS 聚焦自动放大 */
  }
}
</style>
