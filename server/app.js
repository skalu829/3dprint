const express = require('express')
const { UPLOAD_DIR } = require('./config')
const authRouter = require('./routes/auth')
const userRouter = require('./routes/users')
const modelRouter = require('./routes/models')
const searchRouter = require('./routes/search')
const { errorHandler } = require('./middleware/error')

const app = express()

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})
app.use(express.json())

// 静态文件托管 — 上传的模型文件
app.use('/uploads', express.static(UPLOAD_DIR))

// 路由挂载
app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)
app.use('/api/models', modelRouter)
app.use('/api/search', searchRouter)

// 全局错误处理（multer 上传错误等）
app.use(errorHandler)

module.exports = app
