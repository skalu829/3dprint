const path = require('path')
const fs = require('fs')

// 加载 .env 环境变量（server/.env）
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// CMD 的 `set VAR=value && ...` 会把 && 前的空格带进变量值（如 "production "），
// 统一 trim：防止生产模式被静默判成开发模式、纯空格串被当成有效密钥
const NODE_ENV = (process.env.NODE_ENV || 'development').trim()
const JWT_SECRET = (process.env.JWT_SECRET || '').trim()

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

  // JWT 认证 —— 密钥必须从环境变量读取，禁止在代码中硬编码
  JWT_SECRET: JWT_SECRET || (NODE_ENV === 'production'
    ? null  // 生产模式无密钥则直接拒绝启动，避免使用弱密钥
    : '3dprint_jwt_secret_key_2026'), // 仅开发模式留兜底
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
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

  // 邮箱验证 SMTP（QQ邮箱授权码，465/SSL —— 阿里云服务器 25 端口被封）
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.qq.com',
  SMTP_PORT: Number(process.env.SMTP_PORT || 465),
  SMTP_USER: (process.env.SMTP_USER || '').trim(),
  SMTP_PASS: (process.env.SMTP_PASS || '').trim(),
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || '3D打印模型分享平台',

  // 预设标签
  PRESET_TAGS: ['机械零件', '家居用品', '玩具模型', '工具配件', '装饰摆件', '电子外壳']
}
