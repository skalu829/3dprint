const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { sqlite, isUniqueViolation } = require('../database')
const { JWT_SECRET, JWT_EXPIRES_IN, SALT_ROUNDS } = require('../config')
const { authMiddleware } = require('../middleware/auth')
const { isSmtpConfigured, sendVerificationEmail } = require('../services/mailer')

const router = express.Router()

// 验证码有效期 10 分钟，重发冷却 60 秒
const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

// 生成并发送验证码（供注册、重发共用）
// 返回 { sent: bool, reason?: string }
async function issueAndSendVerification(user) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expires = Date.now() + CODE_TTL_MS

  sqlite.prepare('UPDATE users SET verifyCode = ?, verifyExpires = ? WHERE id = ?')
    .run(code, expires, user.id)

  try {
    await sendVerificationEmail(user.email, code)
    return { sent: true }
  } catch (err) {
    console.error('验证码邮件发送失败:', err.message)
    return { sent: false, reason: err.message }
  }
}

// ========== 注册 ==========
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度应为 3-20 个字符' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于 6 个字符' })
    }
    // 邮箱改为必填（邮箱验证功能依赖）
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请输入正确的邮箱地址' })
    }

    if (sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return res.status(409).json({ error: '该用户名已被注册' })
    }
    if (sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: '该邮箱已被注册' })
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      bio: '',
      avatarUrl: '',
      emailVerified: 0, // 新用户未验证
      createdAt: new Date().toISOString()
    }

    try {
      sqlite.prepare(
        'INSERT INTO users (id, username, email, password, bio, avatarUrl, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(newUser.id, newUser.username, newUser.email, newUser.password, newUser.bio, newUser.avatarUrl, newUser.emailVerified, newUser.createdAt)
    } catch (e) {
      // UNIQUE 约束兜底：并发注册同名用户时在此拦截
      if (isUniqueViolation(e)) {
        return res.status(409).json({ error: '该用户名或邮箱已被注册' })
      }
      throw e
    }

    // 注册成功即发验证码（SMTP 未配置或发送失败不阻断注册，可在验证页重发）
    const mail = isSmtpConfigured()
      ? await issueAndSendVerification(newUser)
      : { sent: false, reason: '服务器未配置 SMTP' }

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(201).json({
      token,
      user: {
        id: newUser.id, username: newUser.username, email: newUser.email,
        bio: newUser.bio, avatarUrl: newUser.avatarUrl, emailVerified: 0
      },
      needVerify: true,
      mailSent: mail.sent,
      mailError: mail.sent ? undefined : (mail.reason || '邮件发送失败')
    })
  } catch (err) {
    console.error('注册错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 登录 ==========
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    const user = sqlite.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.json({
      token,
      user: {
        id: user.id, username: user.username, email: user.email || '',
        bio: user.bio || '', avatarUrl: user.avatarUrl || '',
        emailVerified: Number(user.emailVerified) || 0
      }
    })
  } catch (err) {
    console.error('登录错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 邮箱验证 ==========
router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }
    if (Number(user.emailVerified) === 1) {
      return res.json({ message: '邮箱已验证' })
    }
    if (!code || !/^\d{6}$/.test(String(code).trim())) {
      return res.status(400).json({ error: '请输入 6 位数字验证码' })
    }
    if (Date.now() > Number(user.verifyExpires)) {
      return res.status(400).json({ error: '验证码已过期，请重新发送' })
    }
    if (String(user.verifyCode) !== String(code).trim()) {
      return res.status(400).json({ error: '验证码错误' })
    }

    sqlite.prepare("UPDATE users SET emailVerified = 1, verifyCode = '', verifyExpires = 0 WHERE id = ?")
      .run(user.id)

    res.json({ message: '邮箱验证成功' })
  } catch (err) {
    console.error('邮箱验证错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 重发验证码（60 秒冷却） ==========
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }
    if (Number(user.emailVerified) === 1) {
      return res.status(400).json({ error: '邮箱已验证，无需重发' })
    }
    if (!user.email) {
      return res.status(400).json({ error: '账号未绑定邮箱' })
    }

    // 上次发送时间 = verifyExpires - 10min 有效期，反推实现 60s 冷却
    const lastSentAt = Number(user.verifyExpires) - CODE_TTL_MS
    if (lastSentAt > 0 && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000)
      return res.status(429).json({ error: `发送太频繁，请 ${wait} 秒后再试` })
    }

    const mail = await issueAndSendVerification(user)
    if (!mail.sent) {
      return res.status(500).json({ error: '邮件发送失败：' + (mail.reason || '未知错误') })
    }
    res.json({ message: '验证码已发送' })
  } catch (err) {
    console.error('重发验证码错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 查询当前用户验证状态（验证页进入时用） ==========
router.get('/verification-status', authMiddleware, async (req, res) => {
  try {
    const user = sqlite.prepare('SELECT email, emailVerified FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }
    res.json({
      email: user.email || '',
      emailVerified: Number(user.emailVerified) || 0
    })
  } catch (err) {
    console.error('查询验证状态错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

module.exports = router
