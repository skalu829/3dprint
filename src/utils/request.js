// API 基础地址。默认空 = 同源（前后端同端口部署 / 开发代理）。
// 前后端分端口部署时（如 nginx 托管前端、API 在 3001），
// 在 .env.production 里设置 VUE_APP_API_BASE=http://host:3001
const BASE_URL = (process.env.VUE_APP_API_BASE || '').replace(/\/+$/, '')

/**
 * 把后端返回的资源路径补全为绝对地址。
 * 后端 URL 字段（thumbnailUrl / avatarUrl / stlUrl / fileUrl）存在两种形态：
 *   1. 相对路径 /api/... 、/uploads/...（当前版本，跟随访问域名）
 *   2. 早期版本硬编码的 http://localhost:3001/... （历史数据）
 * 前后端不同源时浏览器会按前端 host 解析相对路径而 404；
 * 历史数据里的 localhost 更会导致公网用户指向自己的机器。
 * 统一在请求出口处改写，避免在 20 多个模板里逐个拼接前缀。
 */
function absolutize(value) {
  if (value == null) return value

  if (typeof value === 'string') {
    // 历史遗留：硬编码 localhost / 127.0.0.1 的绝对地址，只保留路径部分重新拼接
    const legacy = value.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/(?:api|uploads)\/.*)$/i)
    if (legacy) return `${BASE_URL}${legacy[1]}`

    if (!BASE_URL) return value
    return /^\/(api|uploads)\//.test(value) ? `${BASE_URL}${value}` : value
  }

  if (Array.isArray(value)) return value.map(absolutize)

  if (typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value)) result[key] = absolutize(value[key])
    return result
  }

  return value
}

async function request(url, options = {}) {
  const token = localStorage.getItem('token')

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  const response = await fetch(`${BASE_URL}${url}`, config)
  const data = await response.json()

  if (!response.ok) {
    // 401 时清除 token
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    // 把状态码与响应体挂到 error 上，调用方才能针对 429 等做差异化处理
    const err = new Error(data.error || '请求失败')
    err.status = response.status
    err.data = data
    if (data && data.retryAfter != null) err.retryAfter = data.retryAfter
    throw err
  }

  return absolutize(data)
}

export function get(url) {
  return request(url, { method: 'GET' })
}

export function post(url, body) {
  return request(url, { method: 'POST', body })
}

export function put(url, body) {
  return request(url, { method: 'PUT', body })
}

export function del(url) {
  return request(url, { method: 'DELETE' })
}

export function upload(url, formData) {
  const token = localStorage.getItem('token')

  return fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  }).then(response => {
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      return response.json().then(data => {
        throw new Error(data.error || '上传失败')
      })
    }
    return response.json().then(absolutize)
  })
}

export default request
