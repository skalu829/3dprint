const path = require('path')
const fs = require('fs')

// 加载 .env 环境变量（server/.env）
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// 服务根目录（server/）
const SERVER_ROOT = path.join(__dirname, '..')

// 上传相关目录
const UPLOAD_DIR = path.join(SERVER_ROOT, 'uploads')
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails')
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars')

// 确保上传相关目录存在
for (const dir of [UPLOAD_DIR, THUMBNAIL_DIR, AVATAR_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

module.exports = {
  SERVER_ROOT,
  UPLOAD_DIR,
  THUMBNAIL_DIR,
  AVATAR_DIR,

  // 服务端口
  PORT: process.env.PORT || 3001,

  // JWT 认证
  JWT_SECRET: '3dprint_jwt_secret_key_2026',
  JWT_EXPIRES_IN: '7d',
  SALT_ROUNDS: 10,

  // Windows 上 Git Bash 的 python 指向 MS Store stub，需要用完整路径
  PYTHON_EXE: process.env.PYTHON_PATH
    || (process.platform === 'win32' ? 'C:/Users/skalu/AppData/Local/Programs/Python/Python311/python.exe' : 'python3'),

  // 需要转换格式的文件类型（非 STL/OBJ）
  NEEDS_CONVERSION_EXT: ['.3mf', '.step', '.stp', '.iges', '.igs', '.amf'],

  // 模型上传允许的格式
  MODEL_ALLOWED_EXT: ['.3mf', '.stl', '.obj', '.step', '.stp', '.iges', '.igs', '.amf'],

  // 头像上传允许的格式
  AVATAR_ALLOWED_EXT: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],

  // AI 搜索（阿里云百炼 DashScope）
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || '',
  DASHSCOPE_BASE: 'https://dashscope.aliyuncs.com/compatible-mode/v1',

  // 预设标签
  PRESET_TAGS: ['机械零件', '家居用品', '玩具模型', '工具配件', '装饰摆件', '电子外壳']
}
