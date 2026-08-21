<template>
  <div class="upload-page">
    <NavBar />

    <main class="upload-main">
      <div class="upload-card">
        <h1 class="page-title">上传 3D 模型</h1>
        <p class="page-desc">分享你的创意，让更多人打印你的设计</p>

        <form class="upload-form" @submit.prevent="handleSubmit">
          <!-- 标题 -->
          <div class="form-group">
            <label class="form-label">模型标题 <span class="required">*</span></label>
            <input
              v-model="form.title"
              type="text"
              class="form-input"
              placeholder="给你的模型起个名字"
              maxlength="60"
            />
            <span class="char-count">{{ form.title.length }}/60</span>
          </div>

          <!-- 描述 -->
          <div class="form-group">
            <label class="form-label">模型描述</label>
            <textarea
              v-model="form.description"
              class="form-textarea"
              placeholder="描述你的模型，包括尺寸、材质建议、打印参数等"
              rows="4"
              maxlength="500"
            ></textarea>
            <span class="char-count">{{ form.description.length }}/500</span>
          </div>

          <!-- 标签 -->
          <div class="form-group">
            <label class="form-label">标签 <span class="tag-hint">（可选多个）</span></label>
            <div class="preset-tags">
              <button
                v-for="tag in PRESET_TAGS"
                :key="tag"
                type="button"
                :class="['preset-tag-btn', { selected: form.tags.includes(tag) }]"
                @click="toggleTag(tag)"
              >{{ tag }}</button>
            </div>
          </div>

          <!-- 文件上传 -->
          <div class="form-group">
            <label class="form-label">模型文件 <span class="required">*</span></label>
            <div
              class="file-dropzone"
              :class="{ dragover: isDragover, 'has-file': selectedFile }"
              @dragover.prevent="isDragover = true"
              @dragleave.prevent="isDragover = false"
              @drop.prevent="onFileDrop"
              @click="triggerFileInput"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".3mf,.stl,.obj,.step,.stp,.iges,.igs,.amf"
                @change="onFileSelect"
                style="display: none"
              />
              <template v-if="!selectedFile">
                <MaterialIcon :path="ICONS.fileDocument" :size="42" color="#c0c4cc" class="dropzone-icon" />
                <p class="dropzone-text">点击选择文件或将文件拖拽到这里</p>
                <p class="dropzone-hint">支持 .3mf .stl .obj .step .stp .iges .igs .amf，最大 50MB</p>
              </template>
              <template v-else>
                <div class="file-info">
                  <span class="file-ext-badge">{{ fileExt }}</span>
                  <div class="file-meta">
                    <span class="file-name-display">{{ selectedFile.name }}</span>
                    <span class="file-size-display">{{ formatSize(selectedFile.size) }}</span>
                  </div>
                  <button type="button" class="file-remove" @click.stop="removeFile">移除</button>
                </div>
              </template>
            </div>
          </div>

          <!-- 错误提示 -->
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

          <!-- 提交 -->
          <button type="submit" class="btn-submit" :disabled="submitting">
            {{ submitting ? '上传中...' : '发布模型' }}
          </button>
        </form>
      </div>
    </main>

    <footer class="page-footer">
      <p>© 2026 3DPrint 模型分享平台 · 基于增材制造技术的内容共享社区</p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'UploadPage'
}
</script>

<script setup>
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS } from '@/utils/icons'
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { upload } from '@/utils/request'

const PRESET_TAGS = ['机械零件', '家居用品', '玩具模型', '工具配件', '装饰摆件', '电子外壳']

const router = useRouter()

// ========== 表单数据 ==========
const form = reactive({
  title: '',
  description: '',
  tags: []
})

const selectedFile = ref(null)
const fileInput = ref(null)
const isDragover = ref(false)
const errorMsg = ref('')
const submitting = ref(false)

const fileExt = computed(() => {
  if (!selectedFile.value) return ''
  const name = selectedFile.value.name
  const idx = name.lastIndexOf('.')
  return idx > -1 ? name.slice(idx).toUpperCase() : ''
})

// ========== 标签操作 ==========
function toggleTag(tag) {
  const idx = form.tags.indexOf(tag)
  if (idx > -1) {
    form.tags.splice(idx, 1)
  } else {
    form.tags.push(tag)
  }
}

// ========== 文件操作 ==========
function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelect(e) {
  const file = e.target.files[0]
  if (file) validateAndSetFile(file)
}

function onFileDrop(e) {
  isDragover.value = false
  const file = e.dataTransfer.files[0]
  if (file) validateAndSetFile(file)
}

function validateAndSetFile(file) {
  errorMsg.value = ''

  const allowed = ['.3mf', '.stl', '.obj', '.step', '.stp', '.iges', '.igs', '.amf']
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!allowed.includes(ext)) {
    errorMsg.value = `不支持的文件格式 ${ext}。支持: ${allowed.join(', ')}`
    return
  }

  if (file.size > 50 * 1024 * 1024) {
    errorMsg.value = '文件大小不能超过 50MB'
    return
  }

  selectedFile.value = file
}

function removeFile() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ========== 提交 ==========
async function handleSubmit() {
  errorMsg.value = ''

  // 校验
  if (!form.title.trim()) {
    errorMsg.value = '请输入模型标题'
    return
  }
  if (!selectedFile.value) {
    errorMsg.value = '请选择模型文件'
    return
  }

  submitting.value = true

  try {
    const fd = new FormData()
    fd.append('title', form.title.trim())
    fd.append('description', form.description.trim())
    fd.append('tags', form.tags.join(','))
    fd.append('file', selectedFile.value)

    const model = await upload('/api/models', fd)
    router.push(`/model/${model.id}`)
  } catch (err) {
    errorMsg.value = err.message || '上传失败，请重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* ====== 页面布局 ====== */
.upload-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.upload-main {
  max-width: 640px;
  margin: 0 auto;
  padding: 36px 24px;
}

.upload-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  padding: 36px 40px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
}

.page-desc {
  font-size: 14px;
  color: #909399;
  margin-bottom: 32px;
}

/* ====== 表单 ====== */
.upload-form {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.form-group {
  position: relative;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.required {
  color: #f56c6c;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 14px;
  color: #303133;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 14px;
  color: #303133;
  outline: none;
  resize: vertical;
  min-height: 90px;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-textarea:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.char-count {
  position: absolute;
  right: 2px;
  bottom: -18px;
  font-size: 11px;
  color: #c0c4cc;
}

/* ====== 预设标签选择 ====== */
.tag-hint {
  font-weight: 400;
  font-size: 12px;
  color: #909399;
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 4px 0;
}

.preset-tag-btn {
  padding: 7px 18px;
  border: 1.5px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s;
  font-family: inherit;
}

.preset-tag-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.preset-tag-btn.selected {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

/* ====== 标签输入（旧，保留兼容） ====== */
.tags-input-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  min-height: 42px;
  align-items: center;
  transition: border-color 0.2s;
  cursor: text;
}

.tags-input-area:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 10px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 12px;
  font-size: 12px;
}

.tag-remove {
  border: none;
  background: none;
  color: #409eff;
  font-size: 15px;
  cursor: pointer;
  padding: 0 0 0 2px;
  line-height: 1;
}

.tag-input {
  flex: 1;
  min-width: 100px;
  border: none;
  outline: none;
  font-size: 13px;
  padding: 4px 0;
  color: #303133;
  font-family: inherit;
}

/* ====== 文件拖拽区 ====== */
.file-dropzone {
  border: 2px dashed #dcdfe6;
  border-radius: 10px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.file-dropzone:hover {
  border-color: #409eff;
  background: #f5f9ff;
}

.file-dropzone.dragover {
  border-color: #409eff;
  background: #ecf5ff;
}

.file-dropzone.has-file {
  padding: 20px;
  border-style: solid;
  border-color: #67c23a;
  background: #f0f9eb;
}

.dropzone-icon {
  font-size: 42px;
  display: block;
  margin-bottom: 12px;
}

.dropzone-text {
  font-size: 15px;
  color: #606266;
  margin-bottom: 6px;
}

.dropzone-hint {
  font-size: 12px;
  color: #c0c4cc;
}

/* 已选文件 */
.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-ext-badge {
  padding: 6px 12px;
  background: #67c23a;
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.file-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  text-align: left;
}

.file-name-display {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}

.file-size-display {
  font-size: 12px;
  color: #909399;
}

.file-remove {
  padding: 4px 12px;
  border: 1px solid #f56c6c;
  background: #fff;
  color: #f56c6c;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.file-remove:hover {
  background: #f56c6c;
  color: #fff;
}

/* ====== 错误提示 ====== */
.error-msg {
  padding: 10px 14px;
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
  border-radius: 8px;
  font-size: 13px;
}

/* ====== 提交按钮 ====== */
.btn-submit {
  padding: 12px 0;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  font-family: inherit;
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ====== 页脚 ====== */
.page-footer {
  text-align: center;
  padding: 30px 0;
  color: #bbb;
  font-size: 13px;
  border-top: 1px solid #f0f0f0;
}

@media (max-width: 600px) {
  .upload-card {
    padding: 24px 20px;
  }
}
</style>
