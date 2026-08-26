const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')
const { sqlite } = require('../database')

// ========== JWT 认证中间件 ==========
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' })
  }
}

// ========== 邮箱已验证校验（宽松模式：仅拦写操作，登录浏览不受限） ==========
// 用在 authMiddleware 之后：上传 / 评论 / 关注 等社区写操作
function requireVerified(req, res, next) {
  const row = sqlite.prepare('SELECT emailVerified FROM users WHERE id = ?').get(req.user.id)
  if (!row || Number(row.emailVerified) !== 1) {
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      error: '请先完成邮箱验证（登录后访问 /verify-email 页面）再进行此操作'
    })
  }
  next()
}

module.exports = { authMiddleware, requireVerified }
