const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { sqlite, isUniqueViolation } = require('../database')
const { JWT_SECRET, JWT_EXPIRES_IN, SALT_ROUNDS } = require('../config')

const router = express.Router()

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
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }

    if (sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return res.status(409).json({ error: '该用户名已被注册' })
    }
    if (email && sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: '该邮箱已被注册' })
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
    const newUser = {
      id: Date.now().toString(),
      username,
      email: email || '',
      password: hashedPassword,
      bio: '',
      avatarUrl: '',
      createdAt: new Date().toISOString()
    }

    try {
      sqlite.prepare(
        'INSERT INTO users (id, username, email, password, bio, avatarUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(newUser.id, newUser.username, newUser.email, newUser.password, newUser.bio, newUser.avatarUrl, newUser.createdAt)
    } catch (e) {
      // UNIQUE 约束兜底：并发注册同名用户时在此拦截
      if (isUniqueViolation(e)) {
        return res.status(409).json({ error: '该用户名已被注册' })
      }
      throw e
    }

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    res.status(201).json({
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, bio: newUser.bio, avatarUrl: newUser.avatarUrl }
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
      user: { id: user.id, username: user.username }
    })
  } catch (err) {
    console.error('登录错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

module.exports = router
