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
const { PORT } = require('./config')

initDB()

// 异步生成缺失的缩略图和 STL（不阻塞启动）
generateMissingAssets().catch(err => {
  console.error('扫描资产失败:', err.message)
})

app.listen(PORT, () => {
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
})
