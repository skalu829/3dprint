const { DASHSCOPE_API_KEY, DASHSCOPE_BASE, PRESET_TAGS } = require('../config')

/**
 * 判断用户输入是否需要走 AI 语义理解
 */
function needAISearch(query) {
  return query.length > 8 && /的|一个|适合|想要|有没有|帮我|推荐|打印|什么/.test(query)
}

/**
 * 调用阿里云百炼 DashScope API 进行搜索意图理解
 * 返回 { keywords: string[], tags: string[] }
 * - keywords: 拆解出的多个具体搜索词（可命中标题/描述）
 * - tags: 匹配的预设标签
 */
async function callAISearch(query) {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('未配置 DASHSCOPE_API_KEY 环境变量')
  }

  const response = await fetch(`${DASHSCOPE_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      messages: [
        {
          role: 'system',
          content: `你是一个3D打印模型搜索助手。预设标签: ${PRESET_TAGS.join('、')}。

根据用户描述，完成两件事：
1. 提取所有可能的搜索关键词（包括：具体名称、型号、IP名、专有名词、功能描述词等），拆成多个短词
2. 判断最匹配的预设标签（0到多个）

严格返回纯JSON，不要其他任何内容：
{"keywords":["关键词1","关键词2"],"tags":["匹配标签"]}

示例：
- 用户说"三体中的自然选择号飞船" → {"keywords":["自然选择号","三体","飞船","宇宙飞船"],"tags":["玩具模型","装饰摆件"]}
- 用户说"我想打印一个手机支架" → {"keywords":["手机支架","支架"],"tags":["电子外壳","家居用品"]}`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.1,
      max_tokens: 150
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AI API 调用失败 (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'

  // 清理可能的 markdown 代码块包裹
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(jsonStr)

  // 兼容 keywords 为字符串的旧格式
  if (typeof parsed.keywords === 'string') {
    parsed.keywords = parsed.keywords ? [parsed.keywords] : []
  }
  return parsed
}

/**
 * 计算模型与搜索词的相关度得分（0~100）
 * - 标题命中：40分/词
 * - 描述命中：20分/词
 * - 标签命中：30分/标签
 * - 作者名命中：10分/词
 */
function scoreModel(m, keywords, tags) {
  let score = 0
  const title = (m.title || '').toLowerCase()
  const desc = (m.description || '').toLowerCase()
  const author = (m.username || '').toLowerCase()
  const modelTags = m.tags || []

  for (const kw of keywords) {
    const k = kw.toLowerCase()
    if (title.includes(k)) score += 40
    if (desc.includes(k)) score += 20
    if (author.includes(k)) score += 10
  }

  for (const tag of tags) {
    if (modelTags.includes(tag)) score += 30
  }

  return score
}

module.exports = { needAISearch, callAISearch, scoreModel }
