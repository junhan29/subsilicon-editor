/**
 * 内置技能模板库
 *
 * 为每个任务槽（editor / text / image / video / audio）提供预设的技能 prompt，
 * 用户可一键套用，实现"植入技能"效果，无需手写系统提示词。
 *
 * 模板分类：
 * - editor：编辑器对话技能（分支叙事、节奏把控、选项设计等）
 * - text：文本生成技能（角色心理、对话润色、悬念铺设等）
 * - image：图片生成技能（统一风格、构图质量等）
 * - video：视频生成技能（分镜、运镜、转场等）
 * - audio：音频生成技能（氛围配乐、环境音效等）
 */

import type { AiTaskType } from './task-routing'

/** 技能模板 */
export interface SkillTemplate {
  /** 唯一 id */
  id: string
  /** 展示名称 */
  name: string
  /** 一句话描述 */
  desc: string
  /** 适用的任务槽类型 */
  taskTypes: AiTaskType[]
  /** 技能 prompt 内容（注入到 systemPrompt 或媒体 prompt 前） */
  skillPrompt: string
}

// ---------- editor 槽技能 ----------

const EDITOR_SKILLS: SkillTemplate[] = [
  {
    id: 'editor-branch-architect',
    name: '分支叙事架构师',
    desc: '擅长设计多分支故事结构，确保选择有意义、分支间逻辑自洽',
    taskTypes: ['editor'],
    skillPrompt: '你是一位分支叙事架构师。在创作时：1) 每个故事节点至少提供 2-3 个有意义的分支选项；2) 确保不同分支导向截然不同的剧情走向，避免"伪选择"；3) 在关键决策点设置蝴蝶效应，让早期选择影响后续剧情；4) 维护分支间的一致性，记录已发生的事件和角色状态；5) 主动使用 unlock/condition/jump 等高级节点实现复杂分支逻辑。',
  },
  {
    id: 'editor-pace-controller',
    name: '节奏把控师',
    desc: '专注叙事节奏：张弛有度、高潮铺垫、避免流水账',
    taskTypes: ['editor'],
    skillPrompt: '你是一位叙事节奏把控师。在创作时：1) 交替使用"紧张-舒缓"节奏，避免持续高压或持续平淡；2) 每 3-5 个节点设置一个小高潮或悬念钩子；3) 高潮前用日常场景铺垫角色情感，让读者产生共鸣；4) 避免流水账式推进，关键情节用 CG/旁白节点强化；5) 结局前收束所有伏笔，给出满足感的收尾。',
  },
  {
    id: 'editor-choice-designer',
    name: '选项设计专家',
    desc: '设计让玩家纠结的道德困境选择，避免明显的好/坏选项',
    taskTypes: ['editor'],
    skillPrompt: '你是一位选项设计专家。在创作时：1) 每个选择选项应各有利弊，避免明显的"正确答案"；2) 善用道德困境（如牺牲少数救多数、真相与善意的冲突）；3) 选项文本要具体生动，避免抽象描述；4) 隐藏选择的长期后果，让玩家事后才意识到影响；5) 偶尔设置"无选择"节点（强制接受命运），增强戏剧张力。',
  },
]

// ---------- text 槽技能 ----------

const TEXT_SKILLS: SkillTemplate[] = [
  {
    id: 'text-character-psychology',
    name: '角色心理描写',
    desc: '深入角色内心，用行为和细节展现性格而非直白陈述',
    taskTypes: ['text'],
    skillPrompt: '你是一位角色心理描写专家。在生成文本时：1) 用具体行为和微表情展现角色心理，而非直接说"他很难过"；2) 角色对话要符合其性格、年龄、教育背景，避免所有角色说话方式相同；3) 内心独白与外在表现可以矛盾，展现角色的复杂性；4) 通过角色对同一事件的不同反应来凸显性格差异；5) 避免完美角色，给每个角色一个致命弱点或矛盾。',
  },
  {
    id: 'text-dialogue-polish',
    name: '对话润色专家',
    desc: '让对话自然口语化，去除书面腔，保留角色个性',
    taskTypes: ['text'],
    skillPrompt: '你是一位对话润色专家。在润色时：1) 对话要口语化，去除书面语和说明性文字；2) 不同角色的用词习惯、句式长短应有明显区分；3) 对话中穿插动作描写和停顿，增强画面感；4) 避免角色互相"念设定"，信息要自然融入对话；5) 留白和潜台词比直说更有力量，善用"没说完的话"。',
  },
  {
    id: 'text-suspense-builder',
    name: '悬念铺设',
    desc: '在文本中埋设伏笔和悬念，制造读者好奇心',
    taskTypes: ['text'],
    skillPrompt: '你是一位悬念铺设专家。在生成文本时：1) 开头即设置悬念钩子（异常事件、未解之谜、矛盾信息）；2) 每 paragraph 末尾留一个"未回答的问题"驱动读者继续；3) 伏笔要自然融入场景，不能生硬；4) 伏笔与回收之间至少间隔 2-3 个场景；5) 答案揭晓时要有反转或更深层的谜题，维持持续吸引力。',
  },
  {
    id: 'text-scene-painter',
    name: '场景描写大师',
    desc: '用五感描写构建沉浸式场景，避免空洞形容词堆砌',
    taskTypes: ['text'],
    skillPrompt: '你是一位场景描写大师。在生成文本时：1) 调动五感（视觉、听觉、嗅觉、触觉、味觉）构建沉浸感；2) 用具体的细节代替笼统的形容词（"锈迹斑斑的铁门吱呀作响"优于"破旧的门"）；3) 场景描写要服务叙事，不能纯粹堆砌；4) 通过角色与环境的互动来展现场景；5) 天气、光线、温度等环境因素暗示角色情绪。',
  },
]

// ---------- image 槽技能 ----------

const IMAGE_SKILLS: SkillTemplate[] = [
  {
    id: 'image-anime-consistent',
    name: '统一日漫风格',
    desc: '所有图片保持一致的日式动漫画风：细线、赛璐璐上色、大眼',
    taskTypes: ['image'],
    skillPrompt: 'anime style, consistent art style, cel shading, clean lineart, vibrant colors, detailed eyes, high quality, masterpiece',
  },
  {
    id: 'image-realistic-cinematic',
    name: '写实电影感',
    desc: '电影级写实风格：自然光影、浅景深、胶片质感',
    taskTypes: ['image'],
    skillPrompt: 'photorealistic, cinematic lighting, shallow depth of field, film grain, 85mm lens, natural color grading, high detail, 8K',
  },
  {
    id: 'image-pixel-art',
    name: '像素艺术统一',
    desc: '复古像素画风格：16-bit 色板、清晰像素、无抗锯齿',
    taskTypes: ['image'],
    skillPrompt: 'pixel art, 16-bit style, limited color palette, crisp pixels, no anti-aliasing, retro game aesthetic, dithering',
  },
  {
    id: 'image-dark-gothic',
    name: '暗黑哥特风',
    desc: '暗色调哥特风格：高对比、冷色调、神秘氛围',
    taskTypes: ['image'],
    skillPrompt: 'dark gothic style, high contrast, cold color palette, moody atmosphere, dramatic shadows, ornate details, mysterious lighting',
  },
  {
    id: 'image-3d-cartoon',
    name: '3D 卡通渲染',
    desc: '皮克斯风格 3D 渲染：柔和光影、圆润造型、温暖色调',
    taskTypes: ['image'],
    skillPrompt: '3D cartoon render, Pixar style, soft global illumination, rounded shapes, warm color palette, subsurface scattering, high quality',
  },
]

// ---------- video 槽技能 ----------

const VIDEO_SKILLS: SkillTemplate[] = [
  {
    id: 'video-cinematic-shots',
    name: '电影分镜师',
    desc: '电影级镜头语言：黄金分割构图、慢推拉、景深过渡',
    taskTypes: ['video'],
    skillPrompt: 'cinematic shot, golden ratio composition, slow dolly push-in, shallow depth of field transition, anamorphic lens flare, 24fps film look, color graded',
  },
  {
    id: 'video-dynamic-camera',
    name: '动态运镜',
    desc: '富有动感的镜头运动：环绕、跟随、快速变焦',
    taskTypes: ['video'],
    skillPrompt: 'dynamic camera movement, orbit shot, follow tracking, fast zoom, handheld feel, motion blur, energetic pacing, action sequence',
  },
  {
    id: 'video-smooth-transition',
    name: '转场设计',
    desc: '自然流畅的镜头转场：溶解、匹配剪辑、视觉延续',
    taskTypes: ['video'],
    skillPrompt: 'smooth transition, cross dissolve, match cut, visual continuity, seamless wipe, professional editing, flowing motion',
  },
]

// ---------- audio 槽技能 ----------

const AUDIO_SKILLS: SkillTemplate[] = [
  {
    id: 'audio-emotional-score',
    name: '情绪氛围配乐',
    desc: '根据场景情绪生成配乐：紧张用低频脉冲、温馨用钢琴弦乐',
    taskTypes: ['audio'],
    skillPrompt: 'emotional orchestral score, matching scene mood, tension uses low frequency pulse, warmth uses piano and strings, dynamic crescendo, cinematic soundtrack',
  },
  {
    id: 'audio-ambient-sfx',
    name: '环境音效设计',
    desc: '沉浸式环境音：风声、雨声、人群低语、机械运转',
    taskTypes: ['audio'],
    skillPrompt: 'ambient sound design, immersive environment audio, wind rustling, rain pattering, crowd murmur, mechanical hum, spatial audio, layered textures',
  },
  {
    id: 'audio-character-theme',
    name: '角色主题音乐',
    desc: '为每个角色设计专属主题旋律，出场时变奏播放',
    taskTypes: ['audio'],
    skillPrompt: 'character leitmotif, distinctive melodic theme, recurring motif with variations, orchestral arrangement, emotional resonance, memorable melody',
  },
]

// ---------- 汇总 ----------

/** 全部内置技能模板 */
export const BUILTIN_SKILL_TEMPLATES: SkillTemplate[] = [
  ...EDITOR_SKILLS,
  ...TEXT_SKILLS,
  ...IMAGE_SKILLS,
  ...VIDEO_SKILLS,
  ...AUDIO_SKILLS,
]

/** 按任务槽类型筛选可用模板 */
export function getSkillTemplatesForTask(task: AiTaskType): SkillTemplate[] {
  return BUILTIN_SKILL_TEMPLATES.filter((t) => t.taskTypes.includes(task))
}

/** 按 id 获取模板 */
export function getSkillTemplate(id: string): SkillTemplate | undefined {
  return BUILTIN_SKILL_TEMPLATES.find((t) => t.id === id)
}
