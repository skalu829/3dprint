const express = require('express')
const fs = require('fs')
const path = require('path')
const { sqlite, isUniqueViolation } = require('../database')
const { authMiddleware } = require('../middleware/auth')
const { avatarUpload } = require('../middleware/upload')
const { getModelBaseName, enrichModels } = require('../services/assets')
const { THUMBNAIL_DIR } = require('../config')

const router = express.Router()

// 注意：以下路由注册顺序与原 index.js 保持一致，勿随意调整
// （固定路径路由需先于参数路由注册，如 /me、/favorites、/following）

// 用户信息行 → 响应对象（隐藏密码）
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email || '',
    bio: u.bio || '',
    avatarUrl: u.avatarUrl || '',
    createdAt: u.createdAt
  }
}

// 用户统计数据
function userStats(userId) {
  return {
    followingCount: sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followerId = ?').get(userId).c,
    followersCount: sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followingId = ?').get(userId).c,
    modelsCount: sqlite.prepare('SELECT COUNT(*) AS c FROM models WHERE userId = ?').get(userId).c,
    favoritesCount: sqlite.prepare('SELECT COUNT(*) AS c FROM favorites WHERE userId = ?').get(userId).c
  }
}

// ========== 获取用户公开信息 ==========
router.get('/:id/profile', async (req, res) => {
  try {
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }
    res.json({ ...publicUser(user), ...userStats(user.id) })
  } catch (err) {
    console.error('获取用户资料错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取当前用户信息 ==========
router.get('/me', authMiddleware, async (req, res) => {
  const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json({ ...publicUser(user), ...userStats(user.id) })
})

// ========== 更新当前用户信息 ==========
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { email, bio } = req.body
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }
    let newEmail = user.email
    let newBio = user.bio
    if (email !== undefined) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' })
      }
      if (email && sqlite.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id)) {
        return res.status(409).json({ error: '该邮箱已被注册' })
      }
      newEmail = email
    }
    if (bio !== undefined) {
      if (bio.length > 200) {
        return res.status(400).json({ error: '个人简介不能超过 200 个字符' })
      }
      newBio = bio
    }
    sqlite.prepare('UPDATE users SET email = ?, bio = ? WHERE id = ?').run(newEmail, newBio, user.id)
    res.json({ email: newEmail, bio: newBio })
  } catch (err) {
    console.error('更新用户信息错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 上传头像 ==========
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择头像图片' })
    }
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }
    // 头像 URL（相对路径，dev proxy 转发）
    const ext = path.extname(req.file.filename).toLowerCase()
    const avatarUrl = `/uploads/avatars/avatar_${user.id}${ext}`
    sqlite.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(avatarUrl, user.id)
    res.json({ avatarUrl })
  } catch (err) {
    console.error('上传头像错误:', err)
    if (err.message && err.message.includes('仅支持')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取用户收藏列表 ==========
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT m.*, f.createdAt AS favoritedAt
      FROM favorites f JOIN models m ON m.id = f.modelId
      WHERE f.userId = ?
      ORDER BY f.createdAt DESC
    `).all(req.user.id)

    const models = rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
    const enriched = models.map(m => {
      const baseName = getModelBaseName(m)
      const thumbExists = fs.existsSync(path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`))
      return {
        ...m,
        hasThumbnail: thumbExists,
        thumbnailUrl: thumbExists ? `/api/models/${m.id}/thumbnail` : null
      }
    })
    res.json(enriched)
  } catch (err) {
    console.error('获取收藏列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 查看指定用户的收藏列表（公开） ==========
router.get('/:id/favorites', async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT m.*, f.createdAt AS favoritedAt
      FROM favorites f JOIN models m ON m.id = f.modelId
      WHERE f.userId = ?
      ORDER BY f.createdAt DESC
    `).all(req.params.id)

    const models = rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
    const enriched = models.map(m => {
      const baseName = getModelBaseName(m)
      const thumbExists = fs.existsSync(path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`))
      return {
        ...m,
        hasThumbnail: thumbExists,
        thumbnailUrl: thumbExists ? `/api/models/${m.id}/thumbnail` : null
      }
    })
    res.json(enriched)
  } catch (err) {
    console.error('获取用户收藏列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 关注用户 ==========
router.post('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const followingId = req.params.userId
    const followerId = req.user.id

    if (followingId === followerId) {
      return res.status(400).json({ error: '不能关注自己' })
    }
    if (!sqlite.prepare('SELECT id FROM users WHERE id = ?').get(followingId)) {
      return res.status(404).json({ error: '用户不存在' })
    }

    // UNIQUE 索引兜底：重复关注抛约束冲突 → 409
    try {
      sqlite.prepare('INSERT INTO follows (id, followerId, followingId, createdAt) VALUES (?, ?, ?, ?)')
        .run(Date.now().toString(), followerId, followingId, new Date().toISOString())
    } catch (e) {
      if (isUniqueViolation(e)) {
        return res.status(409).json({ error: '已关注该用户' })
      }
      throw e
    }

    const followersCount = sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followingId = ?').get(followingId).c
    const followingCount = sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followerId = ?').get(followingId).c

    res.status(201).json({ following: true, followersCount, followingCount })
  } catch (err) {
    console.error('关注错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 取消关注 ==========
router.delete('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const followingId = req.params.userId
    const followerId = req.user.id

    const result = sqlite.prepare('DELETE FROM follows WHERE followerId = ? AND followingId = ?').run(followerId, followingId)
    if (result.changes === 0) return res.status(404).json({ error: '未关注该用户' })

    const followersCount = sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followingId = ?').get(followingId).c
    const followingCount = sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followerId = ?').get(followingId).c

    res.json({ following: false, followersCount, followingCount })
  } catch (err) {
    console.error('取消关注错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 查询关注状态 ==========
router.get('/:userId/follow', authMiddleware, async (req, res) => {
  try {
    const followingId = req.params.userId
    const followerId = req.user.id

    const exist = sqlite.prepare('SELECT id FROM follows WHERE followerId = ? AND followingId = ?').get(followerId, followingId)

    const followersCount = sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followingId = ?').get(followingId).c
    const followingCount = sqlite.prepare('SELECT COUNT(*) AS c FROM follows WHERE followerId = ?').get(followingId).c

    res.json({ following: !!exist, followersCount, followingCount })
  } catch (err) {
    console.error('查询关注状态错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 我关注的人 ==========
router.get('/following', authMiddleware, async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT u.id, u.username, f.createdAt AS followedAt
      FROM follows f JOIN users u ON u.id = f.followingId
      WHERE f.followerId = ?
      ORDER BY f.createdAt DESC
    `).all(req.user.id)
    res.json(rows)
  } catch (err) {
    console.error('获取关注列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 关注我的人 ==========
router.get('/followers', authMiddleware, async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT u.id, u.username, f.createdAt AS followedAt
      FROM follows f JOIN users u ON u.id = f.followerId
      WHERE f.followingId = ?
      ORDER BY f.createdAt DESC
    `).all(req.user.id)
    res.json(rows)
  } catch (err) {
    console.error('获取粉丝列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 查看指定用户的关注列表（公开） ==========
router.get('/:id/following', async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT u.id, u.username, u.avatarUrl, f.createdAt AS followedAt
      FROM follows f JOIN users u ON u.id = f.followingId
      WHERE f.followerId = ?
      ORDER BY f.createdAt DESC
    `).all(req.params.id)
    res.json(rows.map(u => ({ ...u, avatarUrl: u.avatarUrl || '' })))
  } catch (err) {
    console.error('获取用户关注列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 查看指定用户的粉丝列表（公开） ==========
router.get('/:id/followers', async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT u.id, u.username, u.avatarUrl, f.createdAt AS followedAt
      FROM follows f JOIN users u ON u.id = f.followerId
      WHERE f.followingId = ?
      ORDER BY f.createdAt DESC
    `).all(req.params.id)
    res.json(rows.map(u => ({ ...u, avatarUrl: u.avatarUrl || '' })))
  } catch (err) {
    console.error('获取用户粉丝列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 关注动态 ==========
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id

    const followingIds = sqlite.prepare('SELECT followingId FROM follows WHERE followerId = ?').all(currentUserId).map(r => r.followingId)
    if (followingIds.length === 0) {
      return res.json({ models: [], authors: {}, total: 0, page: 1, pageSize: 20 })
    }

    // 分页
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 20
    const placeholders = followingIds.map(() => '?').join(',')
    const total = sqlite.prepare(`SELECT COUNT(*) AS c FROM models WHERE userId IN (${placeholders})`).get(...followingIds).c
    const feedModels = sqlite.prepare(`
      SELECT * FROM models WHERE userId IN (${placeholders})
      ORDER BY createdAt DESC LIMIT ? OFFSET ?
    `).all(...followingIds, pageSize, (page - 1) * pageSize)
      .map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))

    // 附带作者信息（避免前端二次请求）
    const authors = {}
    for (const id of [...new Set(feedModels.map(m => m.userId))]) {
      const u = sqlite.prepare('SELECT id, username FROM users WHERE id = ?').get(id)
      if (u) authors[id] = u
    }

    res.json({
      models: enrichModels(feedModels),
      authors,
      total,
      page,
      pageSize
    })
  } catch (err) {
    console.error('获取关注动态错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

module.exports = router
