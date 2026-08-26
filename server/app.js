const express = require('express')
const path = require('path')
const { UPLOAD_DIR, SERVER_ROOT } = require('./config')
const authRouter = require('./routes/auth')
const userRouter = require('./routes/users')
const modelRouter = require('./routes/models')
const searchRouter = require('./routes/search')
const { errorHandler } = require('./middleware/error')

const app = express()

// 信任代理（部署在 Nginx 反代后时，req.ip / req.protocol 才能取真实值）
app.set('trust proxy', 1)

// CORS —— 生产环境同源时由静态托管处理，这里为独立部署/调试留兜底
app.use((req, res, next) => {
  const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim())
  const origin = req.headers.origin
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})
app.use(express.json({ limit: '60mb' })) // 模型文件可能较大，与 multer 50MB 对齐

// 静态文件托管 — 上传的模型文件
app.use('/uploads', express.static(UPLOAD_DIR))

// 路由挂载
app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)
app.use('/api/models', modelRouter)
app.use('/api/search', searchRouter)

// ---------- 前端 SPA 托管（生产模式） ----------
// dist 目录位于项目根目录，server/ 的上一层
const DIST_DIR = path.join(SERVER_ROOT, '..', 'dist')
app.use(express.static(DIST_DIR))
// 所有非 /api、/uploads 的路由回退到 index.html（vue-router hash 模式天然兼容）
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) next(err) // dist 未构建时返回 500，避免卡住
  })
})

// 全局错误处理（multer 上传错误等）
app.use(errorHandler)

module.exports = app
