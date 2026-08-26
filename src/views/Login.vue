<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-header">
        <MaterialIcon :path="ICONS.printer3d" :size="48" color="#409eff" class="login-logo" />
        <h2>3DPrint</h2>
        <p class="login-subtitle">3D 打印模型分享平台</p>
      </div>

      <!-- 模式切换 -->
      <div class="mode-tabs">
        <button
          :class="['mode-tab', { active: mode === 'login' }]"
          @click="switchMode('login')"
        >
          登录
        </button>
        <button
          :class="['mode-tab', { active: mode === 'register' }]"
          @click="switchMode('register')"
        >
          注册
        </button>
      </div>

      <!-- 表单 -->
      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="请输入用户名"
            autocomplete="username"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="用于邮箱验证，例如 example@qq.com"
            :disabled="loading"
          />
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            autocomplete="new-password"
            :disabled="loading"
          />
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <!-- 提交按钮 -->
        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? '处理中...' : (mode === 'login' ? '登 录' : '注 册') }}
        </button>
      </form>

      <!-- 底部提示 -->
      <div class="login-footer">
        <span v-if="mode === 'login'">
          还没有账号？<a href="#" @click.prevent="switchMode('register')">立即注册</a>
        </span>
        <span v-else>
          已有账号？<a href="#" @click.prevent="switchMode('login')">立即登录</a>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginPage'
}
</script>

<script setup>
import MaterialIcon from '@/components/MaterialIcon.vue'
import { ICONS } from '@/utils/icons'
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { login, register, isAuthenticated } from '@/utils/auth'

const router = useRouter()

// 如果已登录，直接跳转首页
if (isAuthenticated()) {
  router.replace('/')
}

const mode = ref('login')
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  email: ''
})

function switchMode(m) {
  mode.value = m
  errorMsg.value = ''
  form.username = ''
  form.password = ''
  form.confirmPassword = ''
}

function validate() {
  if (!form.username.trim()) {
    errorMsg.value = '请输入用户名'
    return false
  }
  if (form.username.trim().length < 3) {
    errorMsg.value = '用户名至少 3 个字符'
    return false
  }
  if (!form.password) {
    errorMsg.value = '请输入密码'
    return false
  }
  if (form.password.length < 6) {
    errorMsg.value = '密码至少 6 个字符'
    return false
  }
  if (mode.value === 'register') {
    if (!form.confirmPassword) {
      errorMsg.value = '请确认密码'
      return false
    }
    if (form.password !== form.confirmPassword) {
      errorMsg.value = '两次输入的密码不一致'
      return false
    }
    if (!form.email.trim()) {
      errorMsg.value = '请输入邮箱（注册后需验证）'
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errorMsg.value = '邮箱格式不正确'
      return false
    }
  }
  return true
}

async function handleSubmit() {
  errorMsg.value = ''
  if (!validate()) return

  loading.value = true
  try {
    if (mode.value === 'login') {
      await login(form.username.trim(), form.password)
      router.replace('/')
    } else {
      const data = await register(form.username.trim(), form.password, form.email.trim())
      // 注册后需邮箱验证，跳验证码页（宽松模式：也可跳过稍后验证）
      if (data && data.needVerify) {
        if (!data.mailSent && data.mailError) {
          sessionStorage.setItem('verify_mail_note', data.mailError)
        }
        router.replace('/verify-email')
      } else {
        router.replace('/')
      }
    }
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  padding: 20px;
}

.login-card {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
  padding: 40px 36px;
}

/* Logo 区域 */
.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-logo {
  font-size: 48px;
  display: block;
  margin-bottom: 8px;
}

.login-header h2 {
  font-size: 24px;
  color: #303133;
  font-weight: 700;
  margin: 0;
}

.login-subtitle {
  font-size: 13px;
  color: #909399;
  margin-top: 6px;
}

/* 模式切换 */
.mode-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 28px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 3px;
}

.mode-tab {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: #909399;
  font-size: 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.25s;
}

.mode-tab.active {
  background: #fff;
  color: #409eff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* 表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.form-group input {
  padding: 10px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-group input:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
}

.form-group input:disabled {
  background: #f5f7fa;
  cursor: not-allowed;
}

/* 错误提示 */
.error-msg {
  padding: 10px 14px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 8px;
  color: #f56c6c;
  font-size: 13px;
}

/* 提交按钮 */
.btn-submit {
  width: 100%;
  padding: 11px 0;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部 */
.login-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 13px;
  color: #909399;
}

.login-footer a {
  color: #409eff;
  text-decoration: none;
  font-weight: 500;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>
