import { post, get } from './request'

// ========== Token 管理 ==========
export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function removeToken() {
  localStorage.removeItem('token')
}

// ========== 用户信息缓存 ==========
export function getUser() {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}

export function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user))
}

export function removeUser() {
  localStorage.removeItem('user')
}

// ========== 认证状态 ==========
export function isAuthenticated() {
  return !!getToken()
}

// ========== 注册 ==========
export async function register(username, password, email) {
  const body = { username, password }
  if (email) body.email = email
  const data = await post('/api/auth/register', body)
  setToken(data.token)
  setUser(data.user)
  return data.user
}

// ========== 登录 ==========
export async function login(username, password) {
  const data = await post('/api/auth/login', { username, password })
  setToken(data.token)
  setUser(data.user)
  return data.user
}

// ========== 登出 ==========
export function logout() {
  removeToken()
  removeUser()
}

// ========== 获取当前用户 ==========
export async function fetchCurrentUser() {
  const data = await get('/api/user/me')
  setUser(data)
  return data
}
