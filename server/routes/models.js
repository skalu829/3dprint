const express = require('express')
const fs = require('fs')
const path = require('path')
const { sqlite, withTransaction, isUniqueViolation, rowToModel, rowToComment } = require('../database')
const { authMiddleware, requireVerified } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
const { generateModelAssets, getModelBaseName, enrichModels } = require('../services/assets')
const { redisClient } = require('../services/cache')
const { SERVER_ROOT, THUMBNAIL_DIR, PORT, PRESET_TAGS } = require('../config')

const router = express.Router()

// 通过 ID 查模型（含 tags 解析）
function getModelById(id) {
  return rowToModel(sqlite.prepare('SELECT * FROM models WHERE id = ?').get(id))
}

// 模型列表缓存失效
async function invalidateModelCache(userId) {
  if (redisClient.isOpen) {
    try {
      await redisClient.del('models:list')
      await redisClient.del(`models:user:${userId}`)
    } catch (e) {
      console.warn('清理 Redis 缓存失败:', e.message)
    }
  }
}

// ========== 上传模型 ==========
router.post('/', authMiddleware, requireVerified, upload.single('file'), async (req, res) => {
  try {
    const { title, description, tags } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '模型标题不能为空' })
    }
    if (!req.file) {
      return res.status(400).json({ error: '请选择模型文件' })
    }

    // 中文文件名转码（multer 底层 Busboy 用 latin1 解码）
    let originalName = req.file.originalname
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8')
    } catch { /* 已经是合法 UTF-8 */ }

    // 获取相对于 server 目录的路径
    const relativePath = path.relative(SERVER_ROOT, req.file.path).replace(/\\/g, '/')
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []

    const model = {
      id: Date.now().toString(),
      title: title.trim(),
      description: description ? description.trim() : '',
      tags: tagList,
      fileName: originalName,
      fileSize: req.file.size,
      fileExt: path.extname(originalName).toLowerCase(),
      filePath: relativePath,
      fileUrl: `/${relativePath}`, // 相对路径，跟随当前域名（勿硬编码 host，公网访问会挂）
      userId: req.user.id,
      username: req.user.username,
      downloads: 0,
      likes: 0,
      comments: 0,
      views: 0,
      shares: 0,
      createdAt: new Date().toISOString()
    }

    sqlite.prepare(`
      INSERT INTO models (id, title, description, tags, fileName, fileSize, fileExt, filePath, fileUrl, userId, username, downloads, likes, comments, views, shares, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      model.id, model.title, model.description, JSON.stringify(model.tags),
      model.fileName, model.fileSize, model.fileExt, model.filePath, model.fileUrl,
      model.userId, model.username, model.downloads, model.likes, model.comments,
      model.views, model.shares, model.createdAt
    )

    // 使模型列表缓存失效（新模型入库，缓存要重新生成）
    await invalidateModelCache(req.user.id)

    // 异步生成缩略图和 STL 导出（不阻塞上传响应）
    const ext = path.extname(originalName).toLowerCase()
    setImmediate(async () => {
      try {
        await generateModelAssets(req.file.path, model.id, ext)
      } catch (err) {
        console.error('生成模型缩略图/STL 失败:', err.message)
      }
    })

    res.status(201).json(model)
  } catch (err) {
    console.error('上传模型错误:', err)
    if (err.message && err.message.startsWith('不支持的文件格式')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取模型缩略图 ==========
router.get('/:id/thumbnail', async (req, res) => {
  try {
    const model = getModelById(req.params.id)
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }

    const baseName = getModelBaseName(model)
    const thumbPath = path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`)

    if (fs.existsSync(thumbPath)) {
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.sendFile(thumbPath)
    }

    // 无缩略图返回 404
    res.status(404).json({ error: '缩略图尚未生成' })
  } catch (err) {
    console.error('获取缩略图错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取模型多零件数据（供前端装配体展示） ==========
router.get('/:id/objects', async (req, res) => {
  try {
    const model = getModelById(req.params.id)
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }

    const baseName = getModelBaseName(model)
    const objectsPath = path.join(THUMBNAIL_DIR, `${baseName}_objects.json`)

    if (fs.existsSync(objectsPath)) {
      const data = JSON.parse(fs.readFileSync(objectsPath, 'utf-8'))
      // _objects.json 可能是数组或对象格式，统一为 { objects: [...] }
      const objects = Array.isArray(data) ? data : (data.objects || [])
      return res.json({ objects })
    }

    // 无多零件数据，返回空列表
    return res.json({ objects: [] })
  } catch (err) {
    console.error('获取零件列表错误:', err)
    res.json({ objects: [] })
  }
})

// ========== 获取模型 STL（供 Three.js 渲染） ==========
router.get('/:id/stl', async (req, res) => {
  try {
    const model = getModelById(req.params.id)
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }

    const ext = model.fileExt.toLowerCase()

    // 原生 STL 直接返回原文件
    if (ext === '.stl') {
      const stlPath = path.join(SERVER_ROOT, model.filePath)
      if (fs.existsSync(stlPath)) {
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        return res.sendFile(stlPath)
      }
      return res.status(404).json({ error: 'STL 文件不存在' })
    }

    // 非 STL 格式：返回转换后的 STL
    const baseName = getModelBaseName(model)
    const exportStlPath = path.join(THUMBNAIL_DIR, `${baseName}_export.stl`)

    if (fs.existsSync(exportStlPath)) {
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.sendFile(exportStlPath)
    }

    // 尝试即时转换
    try {
      await generateModelAssets(
        path.join(SERVER_ROOT, model.filePath),
        model.id,
        model.fileExt
      )
      if (fs.existsSync(exportStlPath)) {
        res.setHeader('Content-Type', 'application/octet-stream')
        return res.sendFile(exportStlPath)
      }
    } catch (e) {
      console.error('即时转换 STL 失败:', e.message)
    }

    res.status(404).json({ error: 'STL 转换尚未完成，请稍后重试' })
  } catch (err) {
    console.error('获取 STL 错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 编辑模型 ==========
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const modelId = req.params.id
    const userId = req.user.id
    const { title, description, tags } = req.body

    const model = getModelById(modelId)
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    if (model.userId !== userId) {
      return res.status(403).json({ error: '无权编辑该模型' })
    }

    const newTitle = title !== undefined ? (String(title).trim() || model.title) : model.title
    const newDesc = description !== undefined ? String(description) : model.description
    const newTags = tags !== undefined
      ? JSON.stringify((Array.isArray(tags) ? tags : []).filter(t => PRESET_TAGS.includes(t)))
      : JSON.stringify(model.tags)

    sqlite.prepare('UPDATE models SET title = ?, description = ?, tags = ? WHERE id = ?')
      .run(newTitle, newDesc, newTags, modelId)

    res.json({ ...model, title: newTitle, description: newDesc, tags: JSON.parse(newTags) })
  } catch (err) {
    console.error('编辑模型错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 添加收藏 ==========
router.post('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const modelId = req.params.id
    const userId = req.user.id

    const model = getModelById(modelId)
    if (!model) return res.status(404).json({ error: '模型不存在' })

    const exist = sqlite.prepare('SELECT id FROM favorites WHERE userId = ? AND modelId = ?').get(userId, modelId)
    if (exist) return res.status(409).json({ error: '已收藏该模型' })

    // 事务：插收藏 + 更新计数，原子化
    const newLikes = withTransaction(() => {
      try {
        sqlite.prepare('INSERT INTO favorites (id, userId, modelId, createdAt) VALUES (?, ?, ?, ?)')
          .run(Date.now().toString(), userId, modelId, new Date().toISOString())
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw Object.assign(new Error('已收藏该模型'), { statusCode: 409 })
        }
        throw e
      }
      const r = sqlite.prepare('UPDATE models SET likes = likes + 1 WHERE id = ?').run(modelId)
      return sqlite.prepare('SELECT likes FROM models WHERE id = ?').get(modelId).likes
    })

    res.status(201).json({ favorited: true, likes: newLikes })
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message })
    console.error('收藏错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 删除模型 ==========
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const modelId = req.params.id
    const userId = req.user.id

    const model = getModelById(modelId)
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }
    if (model.userId !== userId) {
      return res.status(403).json({ error: '无权删除该模型' })
    }

    // 删除物理文件（缩略图、STL导出、上传文件）
    try {
      const baseName = getModelBaseName(model)
      const thumbPath = path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`)
      const stlPath = path.join(THUMBNAIL_DIR, `${baseName}_export.stl`)
      const objectsJsonPath = path.join(THUMBNAIL_DIR, `${baseName}_objects.json`)
      const uploadPath = path.join(SERVER_ROOT, model.filePath || '')
      // 删除缩略图、STL导出、多零件JSON
      for (const p of [thumbPath, stlPath, objectsJsonPath]) {
        if (fs.existsSync(p)) fs.unlinkSync(p)
      }
      // 删除多零件缩略图和STL（3MF格式）
      try {
        const files = fs.readdirSync(THUMBNAIL_DIR)
        for (const f of files) {
          if (f.startsWith(`${baseName}_obj_`)) {
            fs.unlinkSync(path.join(THUMBNAIL_DIR, f))
          }
        }
      } catch {}
      // 删除上传的原始文件
      if (model.filePath && fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath)
    } catch (e) {
      console.warn('删除模型文件警告:', e.message)
    }

    // 事务：删模型 + 收藏 + 评论 + 分享，原子化（不会出现记录删一半）
    withTransaction(() => {
      sqlite.prepare('DELETE FROM models WHERE id = ?').run(modelId)
      sqlite.prepare('DELETE FROM favorites WHERE modelId = ?').run(modelId)
      sqlite.prepare('DELETE FROM comments WHERE modelId = ?').run(modelId)
      sqlite.prepare('DELETE FROM shares WHERE modelId = ?').run(modelId)
    })

    // 使模型列表缓存失效（删除后缓存要更新）
    await invalidateModelCache(userId)

    res.json({ success: true })
  } catch (err) {
    console.error('删除模型错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 取消收藏 ==========
router.delete('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const modelId = req.params.id
    const userId = req.user.id

    // 事务：删收藏 + 更新计数，原子化
    const result = withTransaction(() => {
      const r = sqlite.prepare('DELETE FROM favorites WHERE userId = ? AND modelId = ?').run(userId, modelId)
      if (r.changes === 0) return null
      sqlite.prepare('UPDATE models SET likes = MAX(0, likes - 1) WHERE id = ?').run(modelId)
      return sqlite.prepare('SELECT likes FROM models WHERE id = ?').get(modelId)
    })
    if (!result) return res.status(404).json({ error: '未收藏该模型' })

    res.json({ favorited: false, likes: result ? result.likes : 0 })
  } catch (err) {
    console.error('取消收藏错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 查询收藏状态 ==========
router.get('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const exist = sqlite.prepare('SELECT id FROM favorites WHERE userId = ? AND modelId = ?')
      .get(req.user.id, req.params.id)
    res.json({ favorited: !!exist })
  } catch (err) {
    console.error('查询收藏状态错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 记录分享 ==========
router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const modelId = req.params.id
    const userId = req.user.id
    const { platform = 'link' } = req.body

    const model = getModelById(modelId)
    if (!model) return res.status(404).json({ error: '模型不存在' })

    // 事务：插分享记录 + 更新计数，原子化
    const newShares = withTransaction(() => {
      sqlite.prepare('INSERT INTO shares (id, userId, modelId, platform, createdAt) VALUES (?, ?, ?, ?, ?)')
        .run(Date.now().toString(), userId, modelId, platform, new Date().toISOString())
      sqlite.prepare('UPDATE models SET shares = shares + 1 WHERE id = ?').run(modelId)
      return sqlite.prepare('SELECT shares FROM models WHERE id = ?').get(modelId).shares
    })

    res.status(201).json({
      shared: true,
      shares: newShares,
      shareUrl: `http://localhost:8080/#/model/${modelId}`
    })
  } catch (err) {
    console.error('分享错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取分享统计 ==========
router.get('/:id/shares', async (req, res) => {
  try {
    const model = sqlite.prepare('SELECT shares FROM models WHERE id = ?').get(req.params.id)
    if (!model) return res.status(404).json({ error: '模型不存在' })
    res.json({ shares: model.shares || 0 })
  } catch (err) {
    console.error('获取分享统计错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 发表评论 ==========
router.post('/:id/comments', authMiddleware, requireVerified, async (req, res) => {
  try {
    const modelId = req.params.id
    const userId = req.user.id
    const username = req.user.username
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' })
    }
    if (content.trim().length > 500) {
      return res.status(400).json({ error: '评论内容不能超过 500 个字符' })
    }

    const model = getModelById(modelId)
    if (!model) return res.status(404).json({ error: '模型不存在' })

    const comment = {
      id: Date.now().toString(),
      userId,
      username,
      modelId,
      content: content.trim(),
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString()
    }

    // 事务：插评论 + 更新计数，原子化
    withTransaction(() => {
      sqlite.prepare('INSERT INTO comments (id, userId, username, modelId, content, likes, likedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(comment.id, comment.userId, comment.username, comment.modelId, comment.content, 0, '[]', comment.createdAt)
      sqlite.prepare('UPDATE models SET comments = comments + 1 WHERE id = ?').run(modelId)
    })

    // 附上评论者头像，前端直接插入列表使用
    const author = sqlite.prepare('SELECT avatarUrl FROM users WHERE id = ?').get(userId)
    res.status(201).json({ ...comment, avatarUrl: (author && author.avatarUrl) || '' })
  } catch (err) {
    console.error('发表评论错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取评论列表 ==========
router.get('/:id/comments', async (req, res) => {
  try {
    const rows = sqlite.prepare(`
      SELECT c.*, u.avatarUrl AS authorAvatarUrl
      FROM comments c LEFT JOIN users u ON u.id = c.userId
      WHERE c.modelId = ?
      ORDER BY c.createdAt DESC
    `).all(req.params.id)
    res.json(rows.map(r => ({ ...rowToComment(r), avatarUrl: r.authorAvatarUrl || '' })))
  } catch (err) {
    console.error('获取评论列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 删除评论 ==========
router.delete('/:id/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const modelId = req.params.id
    const commentId = req.params.commentId
    const userId = req.user.id

    const comment = rowToComment(sqlite.prepare('SELECT * FROM comments WHERE id = ? AND modelId = ?').get(commentId, modelId))
    if (!comment) return res.status(404).json({ error: '评论不存在' })
    if (comment.userId !== userId) {
      return res.status(403).json({ error: '只能删除自己的评论' })
    }

    // 事务：删评论 + 更新计数，原子化
    const comments = withTransaction(() => {
      sqlite.prepare('DELETE FROM comments WHERE id = ?').run(commentId)
      sqlite.prepare('UPDATE models SET comments = MAX(0, comments - 1) WHERE id = ?').run(modelId)
      return sqlite.prepare('SELECT comments FROM models WHERE id = ?').get(modelId)
    })

    res.json({ deleted: true, comments: comments ? comments.comments : 0 })
  } catch (err) {
    console.error('删除评论错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 点赞评论 ==========
router.post('/:id/comments/:commentId/like', authMiddleware, requireVerified, async (req, res) => {
  try {
    const commentId = req.params.commentId
    const userId = req.user.id

    const comment = rowToComment(sqlite.prepare('SELECT * FROM comments WHERE id = ?').get(commentId))
    if (!comment) return res.status(404).json({ error: '评论不存在' })

    let likedBy = comment.likedBy || []
    if (likedBy.includes(userId)) {
      // 取消点赞（同步执行，读写间无 await，无竞态）
      likedBy = likedBy.filter(id => id !== userId)
    } else {
      likedBy.push(userId)
    }
    const likes = likedBy.length

    sqlite.prepare('UPDATE comments SET likes = ?, likedBy = ? WHERE id = ?')
      .run(likes, JSON.stringify(likedBy), commentId)

    res.json({ likes, liked: likedBy.includes(userId) })
  } catch (err) {
    console.error('点赞评论错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取模型列表（增强：带缩略图标记 + Redis 缓存） ==========
router.get('/', async (req, res) => {
  try {
    // 缓存键：普通列表用 models:list；带作者过滤用 models:user:<id>
    const cacheKey = req.query.userId ? `models:user:${req.query.userId}` : 'models:list'

    // 1. 尝试从 Redis 读缓存
    if (redisClient.isOpen) {
      try {
        const cached = await redisClient.get(cacheKey)
        if (cached) {
          res.setHeader('X-Cache', 'HIT')
          return res.json(JSON.parse(cached))
        }
      } catch (e) {
        console.warn('读取 Redis 缓存失败:', e.message)
      }
    }

    // 2. 缓存未命中，查数据库
    let models
    if (req.query.userId) {
      models = sqlite.prepare('SELECT * FROM models WHERE userId = ? ORDER BY createdAt DESC')
        .all(req.query.userId).map(rowToModel)
    } else {
      models = sqlite.prepare('SELECT * FROM models ORDER BY createdAt DESC').all().map(rowToModel)
    }

    const result = enrichModels(models)

    // 3. 写入 Redis 缓存（带 TTL 自动过期）
    if (redisClient.isOpen) {
      try {
        const ttl = parseInt(process.env.REDIS_MODEL_LIST_TTL) || 60
        await redisClient.setEx(cacheKey, ttl, JSON.stringify(result))
      } catch (e) {
        console.warn('写入 Redis 缓存失败:', e.message)
      }
    }

    res.setHeader('X-Cache', 'MISS')
    res.json(result)
  } catch (err) {
    console.error('获取模型列表错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ========== 获取单个模型 ==========
router.get('/:id', async (req, res) => {
  try {
    const model = getModelById(req.params.id)
    if (!model) {
      return res.status(404).json({ error: '模型不存在' })
    }

    const baseName = getModelBaseName(model)
    const thumbExists = fs.existsSync(path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`))
    const ext = model.fileExt.toLowerCase()
    const isNativeStl = ext === '.stl'
    const stlExportExists = fs.existsSync(path.join(THUMBNAIL_DIR, `${baseName}_export.stl`))

    // 作者头像（前端作者卡片使用）
    const authorRow = sqlite.prepare('SELECT avatarUrl FROM users WHERE id = ?').get(model.userId)

    res.json({
      ...model,
      baseName,
      authorAvatarUrl: (authorRow && authorRow.avatarUrl) || '',
      hasThumbnail: thumbExists,
      thumbnailUrl: thumbExists ? `/api/models/${model.id}/thumbnail` : null,
      hasStl: isNativeStl || stlExportExists,
      stlUrl: `/api/models/${model.id}/stl`
    })
  } catch (err) {
    console.error('获取模型详情错误:', err)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

module.exports = router
