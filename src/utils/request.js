const BASE_URL = ''

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
    throw new Error(data.error || '请求失败')
  }

  return data
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
    return response.json()
  })
}

export default request
