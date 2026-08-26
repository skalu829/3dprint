const path = require('path')
const fs = require('fs')
const { DatabaseSync } = require('node:sqlite')
const { SERVER_ROOT } = require('../config')

// ============================================================
// SQLite 数据库层（node:sqlite，Node 24 内置，零依赖）
//
// 并发安全设计：
//   1. WAL 模式        —— 读写互不阻塞，读并发不受影响
//   2. busy_timeout    —— 写锁冲突时等待 5s 而非立即报 SQLITE_BUSY
//   3. 同步执行        —— 所有 SQL 同步执行，check-then-write 之间无 await，
//                          天然消除单进程内的竞态（LowDB 的 await db.read() 有竞态窗口）
//   4. UNIQUE 索引     —— 数据库层面兜底防重复收藏/重复关注
//   5. withTransaction —— 多表写入原子化（如删除模型同时删收藏/评论/分享）
// ============================================================

const DB_PATH = path.join(SERVER_ROOT, 'app.db')
const sqlite = new DatabaseSync(DB_PATH)

// 并发相关 PRAGMA
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA busy_timeout = 5000')
sqlite.exec('PRAGMA synchronous = NORMAL')

// ---------- 建表 ----------
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    username  TEXT NOT NULL UNIQUE,
    email     TEXT DEFAULT '',
    password  TEXT NOT NULL,
    bio       TEXT DEFAULT '',
    avatarUrl TEXT DEFAULT '',
    emailVerified INTEGER DEFAULT 0,     -- 新注册用户默认未验证
    verifyCode    TEXT DEFAULT '',       -- 6位邮箱验证码
    verifyExpires INTEGER DEFAULT 0,     -- 验证码过期时间戳(ms)
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS models (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags        TEXT DEFAULT '[]',      -- JSON 数组
    fileName    TEXT DEFAULT '',
    fileSize    INTEGER DEFAULT 0,
    fileExt     TEXT DEFAULT '',
    filePath    TEXT DEFAULT '',
    fileUrl     TEXT DEFAULT '',
    userId      TEXT NOT NULL,
    username    TEXT NOT NULL,
    downloads   INTEGER DEFAULT 0,
    likes       INTEGER DEFAULT 0,
    comments    INTEGER DEFAULT 0,
    views       INTEGER DEFAULT 0,
    shares      INTEGER DEFAULT 0,
    createdAt   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_models_createdAt ON models(createdAt);
  CREATE INDEX IF NOT EXISTS idx_models_userId ON models(userId);

  CREATE TABLE IF NOT EXISTS favorites (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    modelId   TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_favorites ON favorites(userId, modelId);
  CREATE INDEX IF NOT EXISTS idx_favorites_model ON favorites(modelId);

  CREATE TABLE IF NOT EXISTS shares (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    modelId   TEXT NOT NULL,
    platform  TEXT DEFAULT 'link',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shares_model ON shares(modelId);

  CREATE TABLE IF NOT EXISTS comments (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL,
    username  TEXT NOT NULL,
    modelId   TEXT NOT NULL,
    content   TEXT NOT NULL,
    likes     INTEGER DEFAULT 0,
    likedBy   TEXT DEFAULT '[]',        -- JSON 数组
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comments_model ON comments(modelId);

  CREATE TABLE IF NOT EXISTS follows (
    id          TEXT PRIMARY KEY,
    followerId  TEXT NOT NULL,
    followingId TEXT NOT NULL,
    createdAt   TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_follows ON follows(followerId, followingId);
`)

// ---------- 老库升级：为已有 users 表补邮箱验证列 ----------
// ALTER ADD COLUMN 带 DEFAULT 1 时，存量行自动填 1 —— 老用户直接视为已验证；
// 新注册用户在 auth.js 中显式 INSERT emailVerified=0
function ensureColumn(table, column, ddl) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
  if (!cols.includes(column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    console.log(`数据库升级: users 表新增列 ${column}`)
  }
}
ensureColumn('users', 'emailVerified', "emailVerified INTEGER DEFAULT 1")
ensureColumn('users', 'verifyCode', "verifyCode TEXT DEFAULT ''")
ensureColumn('users', 'verifyExpires', "verifyExpires INTEGER DEFAULT 0")

// ---------- 事务包装器：多表写入原子化 ----------
function withTransaction(fn) {
  sqlite.exec('BEGIN IMMEDIATE') // 立即取写锁，避免锁升级失败
  try {
    const result = fn()
    sqlite.exec('COMMIT')
    return result
  } catch (err) {
    try { sqlite.exec('ROLLBACK') } catch {}
    throw err
  }
}

// ---------- UNIQUE 约束冲突判断（node:sqlite 错误码为 ERR_SQLITE_ERROR，需看 message） ----------
function isUniqueViolation(e) {
  return !!e && (String(e.code).startsWith('SQLITE_CONSTRAINT') || /UNIQUE constraint failed/i.test(e.message))
}

// ---------- 行 → 对象转换（tags/likedBy 是 JSON 字符串） ----------
function rowToModel(r) {
  return r ? { ...r, tags: JSON.parse(r.tags || '[]'), fileSize: Number(r.fileSize) } : null
}

function rowToComment(r) {
  return r ? { ...r, likedBy: JSON.parse(r.likedBy || '[]'), likes: Number(r.likes) } : null
}

// ---------- 从旧 LowDB db.json 一次性迁移 ----------
function migrateFromJSON() {
  const jsonPath = path.join(SERVER_ROOT, 'db.json')
  if (!fs.existsSync(jsonPath)) return false

  const count = sqlite.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (count > 0) return false // 已有数据，跳过

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  withTransaction(() => {
    const insUser = sqlite.prepare('INSERT INTO users (id, username, email, password, bio, avatarUrl, emailVerified, createdAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    for (const u of data.users || []) {
      insUser.run(u.id, u.username, u.email || '', u.password, u.bio || '', u.avatarUrl || '', u.createdAt)
    }

    const insModel = sqlite.prepare('INSERT INTO models (id, title, description, tags, fileName, fileSize, fileExt, filePath, fileUrl, userId, username, downloads, likes, comments, views, shares, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const m of data.models || []) {
      insModel.run(m.id, m.title, m.description || '', JSON.stringify(m.tags || []), m.fileName || '', m.fileSize || 0, m.fileExt || '', m.filePath || '', m.fileUrl || '', m.userId, m.username || '', m.downloads || 0, m.likes || 0, m.comments || 0, m.views || 0, m.shares || 0, m.createdAt)
    }

    const insFav = sqlite.prepare('INSERT INTO favorites (id, userId, modelId, createdAt) VALUES (?, ?, ?, ?)')
    for (const f of data.favorites || []) insFav.run(f.id, f.userId, f.modelId, f.createdAt)

    const insShare = sqlite.prepare('INSERT INTO shares (id, userId, modelId, platform, createdAt) VALUES (?, ?, ?, ?, ?)')
    for (const s of data.shares || []) insShare.run(s.id, s.userId, s.modelId, s.platform || 'link', s.createdAt)

    const insComment = sqlite.prepare('INSERT INTO comments (id, userId, username, modelId, content, likes, likedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const c of data.comments || []) insComment.run(c.id, c.userId, c.username, c.modelId, c.content, c.likes || 0, JSON.stringify(c.likedBy || []), c.createdAt)

    const insFollow = sqlite.prepare('INSERT INTO follows (id, followerId, followingId, createdAt) VALUES (?, ?, ?, ?)')
    for (const f of data.follows || []) insFollow.run(f.id, f.followerId, f.followingId, f.createdAt)
  })

  console.log(`已从 db.json 迁移: ${ (data.users || []).length } 用户, ${ (data.models || []).length } 模型, ${ (data.favorites || []).length } 收藏, ${ (data.shares || []).length } 分享, ${ (data.comments || []).length } 评论, ${ (data.follows || []).length } 关注`)
  return true
}

// ---------- 初始化（启动时调用一次） ----------
function initDB() {
  migrateFromJSON()
}

module.exports = { sqlite, withTransaction, isUniqueViolation, rowToModel, rowToComment, initDB }
