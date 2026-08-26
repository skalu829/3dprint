// ============================================================
// 3DPrint API Server 启动入口
// 结构说明：
//   app.js          Express 应用（中间件 + 路由挂载）
//   config/         环境变量与常量配置
//   database/      SQLite 数据库（node:sqlite + WAL + 事务）
//   routes/         路由层（auth / users / models / search）
//   middleware/     中间件（JWT 认证 / 文件上传 / 全局错误）
//   services/       业务服务（资产生成 / AI 搜索 / Redis 缓存）
// ============================================================
const app = require('./app')
const { initDB } = require('./database')
const { generateMissingAssets } = require('./services/assets')
const { PORT, JWT_SECRET } = require('./config')

// 生产环境前置检查：密钥缺失直接拒绝启动
if (!JWT_SECRET) {
  console.error('[FATAL] 生产环境必须设置环境变量 JWT_SECRET（在 server/.env 中配置），拒绝启动。')
  process.exit(1)
}

initDB()

// 异步生成缺失的缩略图和 STL（不阻塞启动）
generateMissingAssets().catch(err => {
  console.error('扫描资产失败:', err.message)
})

const server = app.listen(PORT, () => {
  console.log(`3DPrint API Server running at http://localhost:${PORT}`)
  console.log(`Auth:   POST http://localhost:${PORT}/api/auth/register`)
  console.log(`Auth:   POST http://localhost:${PORT}/api/auth/login`)
  console.log(`Models: POST http://localhost:${PORT}/api/models  (upload)`)
  console.log(`Models: GET  http://localhost:${PORT}/api/models  (list)`)
  console.log(`Favorites: POST/DELETE http://localhost:${PORT}/api/models/:id/favorite`)
  console.log(`Shares:    POST http://localhost:${PORT}/api/models/:id/share`)
  console.log(`Comments:  POST/GET/DELETE http://localhost:${PORT}/api/models/:id/comments`)
  console.log(`Follows:   POST/DELETE http://localhost:${PORT}/api/user/:id/follow`)
  console.log(`Files:       http://localhost:${PORT}/uploads/`)
  console.log(`Frontend:    http://localhost:${PORT}/`)
})

// 优雅关闭：收到信号时先停止接收新请求，等已有请求处理完再退出
function shutdown(signal) {
  console.log(`\n收到 ${signal}，正在优雅关闭...`)
  server.close(() => {
    console.log('服务已关闭')
    process.exit(0)
  })
  // 5 秒兜底，避免卡死
  setTimeout(() => {
    console.warn('强制关闭（等待超时）')
    process.exit(1)
  }, 5000)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
