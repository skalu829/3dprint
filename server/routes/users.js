const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { sqlite, isUniqueViolation } = require('../database')
const { authMiddleware, requireVerified } = require('../middleware/auth')
const { avatarUpload } = require('../middleware/upload')
const { getModelBaseName, enrichModels } = require('../services/assets')
const { sendEmailChangeVerification } = require('../services/mailer')
const { THUMBNAIL_DIR } = require('../config')

const router = express.Router()

const EMAIL_CHANGE_TTL_MS = 10 * 60 * 1000
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000
const EMAIL_CHANGE_MAX_ATTEMPTS = 5
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function hashEmailChangeCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}

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
    emailVerified: Number(u.emailVerified) || 0,
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
    const { username, email, bio } = req.body
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    // 用户名：非空、3-20 字符、唯一
    let newUsername = user.username
    if (username !== undefined) {
      const name = String(username || '').trim()
      if (!name) {
        return res.status(400).json({ error: '用户名不能为空' })
      }
      if (name.length < 3 || name.length > 20) {
        return res.status(400).json({ error: '用户名长度应为 3-20 个字符' })
      }
      if (name !== user.username &&
          sqlite.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(name, user.id)) {
        return res.status(409).json({ error: '该用户名已被占用' })
      }
      newUsername = name
    }

    let newEmail = user.email
    if (email !== undefined && String(email).trim().toLowerCase() !== String(user.email || '').toLowerCase()) {
      return res.status(400).json({ error: '修改邮箱需通过新邮箱验证码验证', code: 'EMAIL_VERIFICATION_REQUIRED' })
    }
    let newBio = user.bio
    if (bio !== undefined) {
      if (bio.length > 200) {
        return res.status(400).json({ error: '个人简介不能超过 200 个字符' })
      }
      newBio = bio
    }
    sqlite.prepare('UPDATE users SET username = ?, email = ?, bio = ? WHERE id = ?')
      .run(newUsername, newEmail, newBio, user.id)
    res.json({ username: newUsername, email: newEmail, bio: newBio })
  } catch (err) {
    console.error('更新用户信息错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 发送修改邮箱验证码 ==========
router.post('/email-change/send-code', authMiddleware, async (req, res) => {
  try {
    const newEmail = String(req.body.newEmail || '').trim().toLowerCase()
    if (!EMAIL_PATTERN.test(newEmail)) {
      return res.status(400).json({ error: '请输入正确的新邮箱地址' })
    }

    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    if (newEmail === String(user.email || '').toLowerCase()) {
      return res.status(400).json({ error: '新邮箱不能与当前邮箱相同' })
    }
    if (sqlite.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, user.id)) {
      return res.status(409).json({ error: '该邮箱已被其他账号使用' })
    }

    const now = Date.now()
    const sentAt = Number(user.emailChangeSentAt) || 0
    if (now - sentAt < EMAIL_RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((EMAIL_RESEND_COOLDOWN_MS - (now - sentAt)) / 1000)
      return res.status(429).json({ error: `发送太频繁，请 ${retryAfter} 秒后再试`, retryAfter })
    }

    const code = String(crypto.randomInt(100000, 1000000))
    sqlite.prepare(`UPDATE users SET pendingEmail = ?, emailChangeCode = ?, emailChangeExpires = ?,
      emailChangeSentAt = ?, emailChangeAttempts = 0 WHERE id = ?`)
      .run(newEmail, hashEmailChangeCode(code), now + EMAIL_CHANGE_TTL_MS, now, user.id)

    try {
      await sendEmailChangeVerification(newEmail, code)
    } catch (mailError) {
      // 发送失败不保留有效验证码和冷却时间，用户可立即重试。
      sqlite.prepare(`UPDATE users SET pendingEmail = '', emailChangeCode = '', emailChangeExpires = 0,
        emailChangeSentAt = 0, emailChangeAttempts = 0 WHERE id = ?`).run(user.id)
      console.error(`[邮件] 修改邮箱验证码发送失败 → ${newEmail} | ${mailError.message}`)
      return res.status(500).json({ error: '验证码发送失败，请稍后重试' })
    }

    res.json({ message: '验证码已发送至新邮箱，10 分钟内有效', expiresIn: 600, cooldown: 60 })
  } catch (err) {
    console.error('发送修改邮箱验证码错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 验证新邮箱并完成修改 ==========
router.post('/email-change/confirm', authMiddleware, async (req, res) => {
  try {
    const newEmail = String(req.body.newEmail || '').trim().toLowerCase()
    const code = String(req.body.code || '').trim()
    if (!EMAIL_PATTERN.test(newEmail) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '请输入正确的新邮箱和 6 位数字验证码' })
    }

    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    if (!user.pendingEmail || !user.emailChangeCode) {
      return res.status(400).json({ error: '请先获取新邮箱验证码' })
    }
    if (newEmail !== user.pendingEmail) {
      return res.status(400).json({ error: '新邮箱已变更，请重新获取验证码' })
    }
    if (Date.now() > Number(user.emailChangeExpires)) {
      return res.status(400).json({ error: '验证码已过期，请重新发送', code: 'EMAIL_CODE_EXPIRED' })
    }
    if (Number(user.emailChangeAttempts) >= EMAIL_CHANGE_MAX_ATTEMPTS) {
      return res.status(429).json({ error: '验证码错误次数过多，请重新发送', code: 'EMAIL_CODE_ATTEMPTS_EXCEEDED' })
    }

    const suppliedHash = Buffer.from(hashEmailChangeCode(code))
    const storedHash = Buffer.from(String(user.emailChangeCode))
    if (suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(suppliedHash, storedHash)) {
      const attempts = (Number(user.emailChangeAttempts) || 0) + 1
      sqlite.prepare('UPDATE users SET emailChangeAttempts = ? WHERE id = ?').run(attempts, user.id)
      if (attempts >= EMAIL_CHANGE_MAX_ATTEMPTS) {
        return res.status(429).json({ error: '验证码错误次数过多，请重新发送', code: 'EMAIL_CODE_ATTEMPTS_EXCEEDED' })
      }
      return res.status(400).json({ error: `验证码错误，还可尝试 ${EMAIL_CHANGE_MAX_ATTEMPTS - attempts} 次` })
    }

    if (sqlite.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, user.id)) {
      return res.status(409).json({ error: '该邮箱已被其他账号使用' })
    }

    try {
      sqlite.prepare(`UPDATE users SET email = ?, emailVerified = 1, pendingEmail = '', emailChangeCode = '',
        emailChangeExpires = 0, emailChangeSentAt = 0, emailChangeAttempts = 0,
        verifyCode = '', verifyExpires = 0 WHERE id = ?`).run(newEmail, user.id)
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: '该邮箱已被其他账号使用' })
      throw err
    }

    res.json({ message: '邮箱修改成功', email: newEmail, emailVerified: 1 })
  } catch (err) {
    console.error('确认修改邮箱错误:', err)
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
      SELECT m.*, f.createdAt AS favoritedAt, u.avatarUrl AS authorAvatarUrl
      FROM favorites f
      JOIN models m ON m.id = f.modelId
      LEFT JOIN users u ON u.id = m.userId
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
      SELECT m.*, f.createdAt AS favoritedAt, u.avatarUrl AS authorAvatarUrl
      FROM favorites f
      JOIN models m ON m.id = f.modelId
      LEFT JOIN users u ON u.id = m.userId
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
router.post('/:userId/follow', authMiddleware, requireVerified, async (req, res) => {
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
      SELECT u.id, u.username, u.avatarUrl, f.createdAt AS followedAt
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
      SELECT u.id, u.username, u.avatarUrl, f.createdAt AS followedAt
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
      const u = sqlite.prepare('SELECT id, username, avatarUrl FROM users WHERE id = ?').get(id)
      if (u) authors[id] = { ...u, avatarUrl: u.avatarUrl || '' }
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
