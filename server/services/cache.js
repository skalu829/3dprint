const redis = require('redis')

// ========== Redis 连接（缓存用） ==========
const redisClient = redis.createClient({
  url: `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD || '')}@${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
})
redisClient.on('error', (err) => {
  // Redis 不可用时只打印日志，不影响主服务运行
  console.warn('Redis 连接失败（缓存降级为直查数据库）:', err.message)
})
redisClient.connect()

module.exports = { redisClient }
