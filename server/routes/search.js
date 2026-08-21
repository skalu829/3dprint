const express = require('express')
const { sqlite, rowToModel } = require('../database')
const { PRESET_TAGS } = require('../config')
const { needAISearch, callAISearch, scoreModel } = require('../services/aiSearch')
const { enrichModels } = require('../services/assets')

const router = express.Router()

/**
 * AI 智能搜索接口
 * GET /api/search?q=我想打印一个三体中的自然选择号
 *
 * 逻辑：
 * 1. 短输入（≤8字且无自然语言词）→ 直接关键词模糊匹配
 * 2. 长/自然语言输入 → 调用 AI 提取 keywords + tags
 *    - 标签匹配 OR 关键词匹配，取并集
 *    - 按相关度得分降序排列，同分按时间降序
 *    - AI 失败自动降级为原始输入关键词匹配
 */
router.get('/', async (req, res) => {
  try {
    const q = req.query.q?.trim()
    const allModels = sqlite.prepare('SELECT * FROM models ORDER BY createdAt DESC').all().map(rowToModel)

    if (!q) {
      return res.json(enrichModels(allModels))
    }

    let aiKeywords = []
    let aiTags = []

    // AI 语义理解
    if (needAISearch(q)) {
      try {
        const aiResult = await callAISearch(q)
        aiKeywords = (aiResult.keywords || []).filter(k => k && k.trim())
        aiTags = (aiResult.tags || []).filter(t => PRESET_TAGS.includes(t))
        console.log(`AI 搜索 "${q}" → keywords:${JSON.stringify(aiKeywords)} tags:${JSON.stringify(aiTags)}`)
      } catch (aiErr) {
        console.error('AI 搜索失败，降级为关键词搜索:', aiErr.message)
        // 降级：把原始输入切词作为关键词
        aiKeywords = [q]
      }
    } else {
      // 短输入直接当关键词
      aiKeywords = [q]
    }

    // ---- 匹配：标签 OR 关键词，取并集 ----
    const matched = allModels.filter(m => {
      // 标签命中
      const tagHit = aiTags.length > 0 && (m.tags || []).some(t => aiTags.includes(t))
      // 关键词命中（标题 / 描述 / 作者名 任一包含即可）
      const kwHit = aiKeywords.length > 0 && aiKeywords.some(kw => {
        const k = kw.toLowerCase()
        return (m.title || '').toLowerCase().includes(k) ||
          (m.description || '').toLowerCase().includes(k) ||
          (m.username || '').toLowerCase().includes(k) ||
          (m.tags || []).some(t => t.toLowerCase().includes(k))
      })
      return tagHit || kwHit
    })

    // ---- 按相关度打分排序 ----
    const scored = matched.map(m => ({
      model: m,
      score: scoreModel(m, aiKeywords, aiTags)
    }))
    scored.sort((a, b) => b.score - a.score || b.model.createdAt.localeCompare(a.model.createdAt))

    res.json(enrichModels(scored.map(s => s.model)))
  } catch (err) {
    console.error('搜索错误:', err)
    res.status(500).json({ error: '搜索失败，请稍后重试' })
  }
})

module.exports = router
