const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { UPLOAD_DIR, AVATAR_DIR, MODEL_ALLOWED_EXT, AVATAR_ALLOWED_EXT } = require('../config')

// ========== 头像上传 multer 配置（存到固定目录 avatars/） ==========
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const fileName = `avatar_${req.user.id}${ext}`
    cb(null, fileName)
  }
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (AVATAR_ALLOWED_EXT.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('头像仅支持 JPG/PNG/GIF/WEBP 格式'))
    }
  }
})

// ========== 模型上传 multer 配置（按日期分目录） ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateDir = path.join(UPLOAD_DIR, new Date().toISOString().slice(0, 10))
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true })
    }
    cb(null, dateDir)
  },
  filename: (req, file, cb) => {
    // multer 底层 Busboy 用 latin1 解码 Content-Disposition，中文会变乱码
    // 手动转码：latin1 → utf8
    let originalName = file.originalname
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8')
    } catch {
      // 如果已经是合法 UTF-8 则保持原样
    }
    const ext = path.extname(originalName)
    const name = path.basename(originalName, ext)
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    const uniqueName = `${Date.now()}_${safeName}${ext}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (MODEL_ALLOWED_EXT.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件格式: ${ext}。支持: ${MODEL_ALLOWED_EXT.join(', ')}`))
    }
  }
})

module.exports = { upload, avatarUpload }
