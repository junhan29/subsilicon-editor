/**
 * 文字生成输入分级 + 去 AI 化 + 逻辑约束策略模块。
 *
 * 1. 输入分级：根据输入完整度区分「扩展补全」与「忠实执行」两种生成模式；
 * 2. 去 AI 化：提供注入 prompt 的高频 AI 味词约束，并对输出做轻量词表后处理；
 * 3. 逻辑约束：把作品核心设定 / 已有角色 / 大纲摘要 / 近期输入拼成上下文注入文本。
 */

/** 生成保真模式：expand = 输入简略，AI 主动补全设定；faithful = 输入完整，忠实执行 */
export type InputFidelity = 'expand' | 'faithful'

/** 明显结构化标记：换行分点（- * + 或编号）或大纲类关键词，命中即视为完整输入 */
const STRUCTURED_HINT_REGEX =
  /(?:^|\n)\s*(?:[-*+]|\d+[.、）)])\s|大纲|设定|梗概|剧情|第一幕|第一章|第一场|结局|分集|故事线|情节概要|人物设定|世界观|完整故事/

/** 默认的「琐碎灵感」长度阈值（字符数），低于该值且无结构化标记视为扩展补全 */
const DEFAULT_EXPAND_THRESHOLD = 80

/**
 * 判断输入完整度：
 * - opts.structuredHint 显式传入时直接覆盖启发式判断；
 * - 文本命中结构化标记（换行分点 / 「大纲」「设定」等词）→ faithful；
 * - 字符数小于阈值（默认 80）且无结构化标记 → expand；
 * - 其余情况 → faithful。
 */
export function classifyInput(
  text: string,
  opts?: { expandThresholdChars?: number; structuredHint?: boolean }
): InputFidelity {
  if (opts?.structuredHint !== undefined) {
    return opts.structuredHint ? 'faithful' : 'expand'
  }
  const content = text ?? ''
  if (STRUCTURED_HINT_REGEX.test(content)) {
    return 'faithful'
  }
  const threshold = opts?.expandThresholdChars ?? DEFAULT_EXPAND_THRESHOLD
  return content.trim().length < threshold ? 'expand' : 'faithful'
}

/** 生成保真模式的注入 prompt（扩展补全：主动补全并明确标注可修改） */
export function buildFidelityPrompt(fidelity: InputFidelity): string {
  if (fidelity === 'expand') {
    return `用户给出的创作提示较简略，仅是一个起点（琐碎灵感）。你可以主动补全世界观背景、角色动机与冲突设置，让故事完整成立。
但必须做到：
1. 在回复开头明确标注「以下内容为为你补全的设定，可自行修改」，让用户清楚区分哪些是自动补全的；
2. 补全内容应与用户给出的少量信息自然衔接，不违背用户已表达的任何意图；
3. 不要把补全当成用户原本的设定，语气上保持「建议/补充」而非「既定事实」。`
  }
  return `用户提供了完整的大纲或故事描述，必须严格忠实执行：
1. 不新增任何设定、不改变故事走向、不替换或新增角色，仅补充输入中明确要求的细节；
2. 所有内容必须严格基于输入展开，不得擅自发挥、续写或添加与原输入冲突的内容；
3. 即使存在更好的剧情构想，也不得偏离用户已有的安排。`
}

/** 去 AI 化约束的注入 prompt（中文，面向所有文字生成服务） */
export function buildDeaiPrompt(): string {
  return `写作风格要求（务必遵守）：
1. 语言要具体、口语化，符合角色口吻，像真人写作，避免空泛总结与说教腔；
2. 禁止万能开场白（如「在这个世界上」「曾几何时」）与模板化收尾；
3. 禁止排比堆砌、过度使用副词（如「非常」「十分」「极其」）和空洞的形容词；
4. 避免「然而」「因此」「总而言之」「综上所述」「让我们」「值得一提的是」等 AI 高频表达；
5. 不要对内容做「总结陈词」，直接呈现具体的人物、动作、对话与细节。`
}

/** 高频 AI 味词表：命中后在输出后处理中替换为更自然的表达或删除 */
export const DEAI_WORDS: string[] = [
  '然而',
  '因此',
  '总的来说',
  '总而言之',
  '综上所述',
  '让我们',
  '值得一提的是',
  '与此同时',
  '由此可见',
  '众所周知',
  '不难发现',
  '事实上',
  '毫无疑问',
  '归根结底',
  '换言之',
  '换句话说',
]

/** 每个 AI 味词对应的自然替代（空串 = 删除，保留语义的前提下尽量口语化） */
const DEAI_REPLACEMENTS: Record<string, string> = {
  '然而': '可',
  '因此': '所以',
  '总的来说': '',
  '总而言之': '',
  '综上所述': '',
  '让我们': '',
  '值得一提的是': '',
  '与此同时': '同时',
  '由此可见': '',
  '众所周知': '',
  '不难发现': '',
  '事实上': '其实',
  '毫无疑问': '',
  '归根结底': '说到底',
  '换言之': '也就是说',
  '换句话说': '也就是说',
}

/** 对输出文本做轻量去 AI 化后处理：命中词表则替换/删除，并清理遗留标点与多余空白 */
export function deaiStyle(text: string): string {
  if (!text) return text
  let result = text
  for (const word of DEAI_WORDS) {
    if (result.includes(word)) {
      result = result.split(word).join(DEAI_REPLACEMENTS[word] ?? '')
    }
  }
  // 清理替换删除后遗留的重复标点、行首标点与多余空格（不影响语义）
  return result
    .replace(/[，,]{2,}/g, '，')
    .replace(/[。.]{2,}/g, '。')
    .replace(/ {2,}/g, ' ')
    .replace(/^[，、；;：:]+/, '')
    .trim()
}

/** 作品既有设定上下文：生成前注入，约束生成内容不与既有设定冲突 */
export interface GenerationContext {
  /** 作品核心设定（work-premise） */
  workPremise?: string
  /** 已有角色列表 */
  characters?: string[]
  /** 已有大纲摘要 */
  outlineSummary?: string
  /** 用户近期创作输入 */
  creatorInputs?: string[]
}

/**
 * 组装生成策略注入段：保真分级（按核心输入文本分类）+ 去 AI 化 + 作品上下文。
 * 返回可直接拼接到 systemPrompt 末尾的段落（非空时以两个换行开头）；
 * context 为空时对应的上下文段自动跳过。
 */
export function buildGenerationPolicyPrompt(
  coreInput: string,
  context?: GenerationContext
): string {
  const parts = [
    buildFidelityPrompt(classifyInput(coreInput)),
    buildDeaiPrompt(),
    buildContextPrompt(context ?? {}),
  ].filter(Boolean)
  return parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''
}

/** 把作品既有设定拼成一段「不得冲突」的注入文本；所有字段为空时返回空串 */
export function buildContextPrompt(ctx: GenerationContext): string {
  const sections: string[] = []

  if (ctx.workPremise?.trim()) {
    sections.push(`【作品核心设定】\n${ctx.workPremise.trim()}`)
  }
  if (ctx.characters && ctx.characters.length > 0) {
    sections.push(`【已有角色】\n${ctx.characters.map((c) => `- ${c}`).join('\n')}`)
  }
  if (ctx.outlineSummary?.trim()) {
    sections.push(`【大纲摘要】\n${ctx.outlineSummary.trim()}`)
  }
  if (ctx.creatorInputs && ctx.creatorInputs.length > 0) {
    sections.push(`【近期创作输入】\n${ctx.creatorInputs.map((c) => `- ${c}`).join('\n')}`)
  }

  if (sections.length === 0) return ''

  return `以下为作品既有设定，生成内容必须与之一致，不得与之冲突；若用户输入与既有设定矛盾，以既有设定为准，也不要擅自修改这些设定：\n\n${sections.join('\n\n')}`
}
