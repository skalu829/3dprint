const redis = require('redis')

// ========== Redis 连接（缓存用） ==========
// 缓存是可选能力：Redis 不可用时必须快速降级为直查数据库，
// 绝不能拖慢主流程。因此这里显式限制连接超时与重连次数——
// 否则 node-redis 会无限重连，期间 isOpen 仍为 true，
// 业务代码里的 await redisClient.get() 会一直排队等待，接口被卡死数十秒。
const RETRY_LIMIT = parseInt(process.env.REDIS_RETRY_LIMIT, 10) || 3

const redisClient = redis.createClient({
  url: `redis://:${encodeURIComponent(process.env.REDIS_PASSWORD || '')}@${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    // 单次连接超时（毫秒），避免不可达地址长时间挂起
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 3000,
    // 重连策略：有限次退避，超过上限后停止重连并标记为不可用
    reconnectStrategy: (retries) => {
      if (retries > RETRY_LIMIT) {
        console.warn(`Redis 重连 ${RETRY_LIMIT} 次仍失败，缓存已降级为直查数据库`)
        return false // 返回 false 停止重连，客户端转为 closed 状态
      }
      return Math.min(retries * 300, 1000)
    }
  }
})

redisClient.on('error', (err) => {
  // Redis 不可用时只打印日志，不影响主服务运行
  console.warn('Redis 连接失败（缓存降级为直查数据库）:', err.message)
})

redisClient.connect().catch((err) => {
  console.warn('Redis 首次连接失败（缓存降级为直查数据库）:', err.message)
})

module.exports = { redisClient }
