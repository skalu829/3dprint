const multer = require('multer')

// ========== 全局错误处理（multer 上传错误等） ==========
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小不能超过 50MB' })
    }
    return res.status(400).json({ error: `文件上传错误: ${err.message}` })
  }
  if (err.message && err.message.startsWith('不支持的文件格式')) {
    return res.status(400).json({ error: err.message })
  }
  console.error('服务器错误:', err)
  res.status(500).json({ error: '服务器内部错误' })
}

module.exports = { errorHandler }
