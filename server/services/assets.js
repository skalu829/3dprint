const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { SERVER_ROOT, THUMBNAIL_DIR, PYTHON_EXE, NEEDS_CONVERSION_EXT } = require('../config')
const { sqlite, rowToModel } = require('../database')

/**
 * 调用 Python 脚本生成缩略图和 STL 导出
 */
function generateModelAssets(filePath, modelId, fileExt) {
  return new Promise((resolve, reject) => {
    const script = path.join(SERVER_ROOT, 'generate_thumbnail.py')

    const proc = spawn(PYTHON_EXE, [
      script,
      filePath,
      THUMBNAIL_DIR,
      '--size', '512'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python 脚本退出码 ${code}: ${stderr}`)
        return reject(new Error(stderr || '缩略图生成失败'))
      }
      console.log(`模型 ${modelId} 缩略图生成成功: ${stdout.trim()}`)
      resolve()
    })

    proc.on('error', (err) => {
      console.error('启动 Python 失败:', err.message)
      reject(err)
    })
  })
}

/**
 * 获取模型的缩略图文件名（不带扩展名的基础名）
 */
function getModelBaseName(model) {
  const ext = model.fileExt
  const base = path.basename(model.filePath, ext)
  return base
}

/**
 * 模型数据增强（缩略图 + STL 状态）
 */
function enrichModels(models) {
  return models.map(m => {
    const baseName = getModelBaseName(m)
    const thumbExists = fs.existsSync(path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`))
    const ext = (m.fileExt || '').toLowerCase()
    const isNativeStl = ext === '.stl'
    const stlExportExists = fs.existsSync(path.join(THUMBNAIL_DIR, `${baseName}_export.stl`))

    return {
      ...m,
      hasThumbnail: thumbExists,
      thumbnailUrl: thumbExists ? `/api/models/${m.id}/thumbnail` : null,
      hasStl: isNativeStl || stlExportExists,
      stlUrl: `/api/models/${m.id}/stl`,
      shares: m.shares || 0
    }
  })
}

/**
 * 启动时扫描并生成缺失的资产
 */
async function generateMissingAssets() {
  const models = sqlite.prepare('SELECT * FROM models').all().map(rowToModel)

  for (const m of models) {
    const baseName = getModelBaseName(m)
    const thumbPath = path.join(THUMBNAIL_DIR, `${baseName}_thumb.png`)
    const stlPath = path.join(THUMBNAIL_DIR, `${baseName}_export.stl`)
    const filePath = path.join(SERVER_ROOT, m.filePath)

    if (!fs.existsSync(filePath)) {
      console.log(`跳过模型 ${m.id}: 源文件不存在 ${filePath}`)
      continue
    }

    const needsThumb = !fs.existsSync(thumbPath)
    const needsStl = !fs.existsSync(stlPath) && NEEDS_CONVERSION_EXT.includes(m.fileExt.toLowerCase())

    if (!needsThumb && !needsStl) continue

    console.log(`为模型 ${m.id} 生成缺失资产...`)
    try {
      await generateModelAssets(filePath, m.id, m.fileExt)
      console.log(`模型 ${m.id} 资产生成完成`)
    } catch (err) {
      console.error(`模型 ${m.id} 资产生成失败:`, err.message)
    }
  }
}

module.exports = { generateModelAssets, getModelBaseName, enrichModels, generateMissingAssets }
