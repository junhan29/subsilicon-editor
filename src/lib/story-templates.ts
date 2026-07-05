import type { StoryGraph, StoryNode, StoryEdge, StoryCharacter, StoryVariable, CharacterGender } from '@editor/types/editor'

export interface StoryTemplate {
  id: string
  name: string
  description: string
  thumbnail: string
  category: 'beginner' | 'adventure' | 'romance' | 'mystery' | 'horror'
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedTime: string
  features: string[]
  defaultGraph: Omit<StoryGraph, 'settings'>
}

function generateTemplateThumbnail(
  title: string,
  category: StoryTemplate['category'],
  icon: string,
  gradientFrom: string,
  gradientTo: string,
  accentColor: string
): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${gradientFrom};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${gradientTo};stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="400" height="300" fill="url(#bgGradient)"/>
  <circle cx="320" cy="60" r="80" fill="white" opacity="0.08"/>
  <circle cx="80" cy="240" r="100" fill="white" opacity="0.05"/>
  <circle cx="350" cy="250" r="50" fill="white" opacity="0.06"/>
  <g filter="url(#glow)" transform="translate(200, 120)">
    <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="72" style="font-family: system-ui, -apple-system, sans-serif;">${icon}</text>
  </g>
  <rect x="40" y="200" width="320" height="2" rx="1" fill="white" opacity="0.2"/>
  <text x="200" y="240" text-anchor="middle" fill="white" font-size="22" font-weight="bold" style="font-family: system-ui, -apple-system, sans-serif;">${title}</text>
  <text x="200" y="268" text-anchor="middle" fill="white" opacity="0.7" font-size="12" style="font-family: system-ui, -apple-system, sans-serif;">SubSilicon Editor Template</text>
  <rect x="20" y="20" width="60" height="24" rx="12" fill="${accentColor}" opacity="0.9"/>
  <text x="50" y="36" text-anchor="middle" fill="white" font-size="11" font-weight="600" style="font-family: system-ui, -apple-system, sans-serif;">
    ${category === 'beginner' ? '入门' : category === 'romance' ? '恋爱' : category === 'mystery' ? '悬疑' : category === 'horror' ? '恐怖' : '冒险'}
  </text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function createTemplateCharacter(
  id: string,
  name: string,
  color: string,
  options: Partial<StoryCharacter> = {}
): StoryCharacter {
  return {
    id,
    name,
    avatar: '',
    color,
    gender: 'unknown' as CharacterGender,
    age: '',
    occupation: '',
    personality: [],
    appearance: [],
    background: '',
    speech: { tone: '', catchphrases: [] },
    skills: [],
    motivation: '',
    habits: [],
    fears: [],
    relations: [],
    tags: [],
    bio: '',
    ...options,
  }
}

// 模板0：新手教程 - 最简引导式模板（仅 3 个节点，演示对话→选择→结局的最小闭环）
const tutorialTemplate: StoryTemplate = {
  id: 'beginner-tutorial',
  name: '新手教程',
  description: '最小可运行示例：1 个对话 + 1 个选择 + 1 个结局，演示节点与连线的关系。完成它即掌握 SubSilicon Editor 的基本用法。',
  thumbnail: generateTemplateThumbnail('新手教程', 'beginner', '🎯', '#10B981', '#059669', '#047857'),
  category: 'beginner',
  difficulty: 'easy',
  estimatedTime: '3分钟',
  features: ['基础对话', '分支选择', '预连接示例'],
  defaultGraph: {
    templateId: 'beginner-tutorial' as any,
    title: '新手教程',
    description: '一个最小可运行的 SubSilicon 故事，演示对话 → 选择 → 结局 的完整闭环',
    characters: [
      createTemplateCharacter('char-narrator', '叙述者', '#F59E0B', {
        occupation: '向导',
        personality: ['热情', '耐心'],
        bio: 'SubSilicon 新手教程的引导者',
      }),
    ],
    variables: [],
    nodes: [
      {
        id: 'start',
        type: 'dialogue',
        position: { x: 250, y: 50 },
        data: {
          characterId: 'char-narrator',
          text: '欢迎来到 SubSilicon！这是你的第一个对话节点。',
          emotion: '微笑',
          sceneId: 'scene-default',
          backgroundImage: 'https://picsum.photos/seed/subsilicon-welcome/800/600',
        },
      },
      {
        id: 'choice-1',
        type: 'choice',
        position: { x: 250, y: 200 },
        data: {
          prompt: '接下来你想怎么做？',
          options: [
            { id: 'opt-explore', text: '继续探索' },
            { id: 'opt-start', text: '直接开始创作' },
          ],
        },
      },
      {
        id: 'ending-tutorial',
        type: 'ending',
        position: { x: 250, y: 360 },
        data: {
          title: '教程完成',
          text: '恭喜你完成了新手教程！现在你可以开始创作属于自己的 AI NPC 群像互动叙事了。',
          endingType: 'good',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'choice-1' },
      { id: 'e2', source: 'choice-1', sourceHandle: 'opt-explore', target: 'ending-tutorial' },
      { id: 'e3', source: 'choice-1', sourceHandle: 'opt-start', target: 'ending-tutorial' },
    ],
    assets: { images: [], audios: [], fonts: [] },
    scenes: [
      { id: 'scene-default', name: '默认场景', backgroundImage: 'https://picsum.photos/seed/subsilicon-welcome/800/600' },
    ],
    audios: [],
  },
}

// 模板1：新手入门 - 简单的选择分支故事
const beginnerTemplate: StoryTemplate = {
  id: 'beginner-choice',
  name: '选择冒险',
  description: '最基础的分支选择故事，适合新手入门。包含起始节点、两个选择分支和两个结局。',
  thumbnail: generateTemplateThumbnail('选择冒险', 'beginner', '🚀', '#3B82F6', '#1D4ED8', '#1E40AF'),
  category: 'beginner',
  difficulty: 'easy',
  estimatedTime: '10分钟',
  features: ['分支选择', '多结局', '基础对话'],
  defaultGraph: {
    templateId: 'beginner-choice' as any,
    title: '我的第一个故事',
    description: '这是一个使用"选择冒险"模板创建的示例故事',
    characters: [
      createTemplateCharacter('char-guide', '向导', '#4F46E5', {
        occupation: '故事向导',
        personality: ['温柔', '耐心'],
        bio: '故事的向导角色',
      }),
    ],
    variables: [],
    nodes: [
      {
        id: 'start',
        type: 'dialogue',
        position: { x: 250, y: 50 },
        data: {
          characterId: 'char-guide',
          text: '欢迎来到你的第一个互动故事！这是一个简单的选择冒险。',
          emotion: '微笑',
          sceneId: 'scene-default',
          backgroundImage: 'https://picsum.photos/seed/forest/800/600',
        },
      },
      {
        id: 'choice-1',
        type: 'choice',
        position: { x: 250, y: 180 },
        data: {
          prompt: '你会怎么做？',
          options: [
            { id: 'opt-a', text: '勇敢地走进森林' },
            { id: 'opt-b', text: '在原地等待观察' },
          ],
        },
      },
      {
        id: 'ending-good',
        type: 'ending',
        position: { x: 100, y: 350 },
        data: {
          title: '勇敢者的结局',
          text: '你勇敢地走进森林，发现了一个隐藏的宝藏！',
          endingType: 'good',
        },
      },
      {
        id: 'ending-neutral',
        type: 'ending',
        position: { x: 400, y: 350 },
        data: {
          title: '谨慎者的结局',
          text: '你选择等待观察，最终安全地完成了任务。',
          endingType: 'neutral',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'choice-1' },
      { id: 'e2', source: 'choice-1', sourceHandle: 'opt-a', target: 'ending-good' },
      { id: 'e3', source: 'choice-1', sourceHandle: 'opt-b', target: 'ending-neutral' },
    ],
    assets: { images: [], audios: [], fonts: [] },
    scenes: [
      { id: 'scene-default', name: '默认场景', backgroundImage: 'https://picsum.photos/seed/forest/800/600' },
    ],
    audios: [],
  },
}

// 模板2：恋爱故事 - 角色好感度系统
const romanceTemplate: StoryTemplate = {
  id: 'romance-hearts',
  name: '心动瞬间',
  description: '包含角色好感度变量的恋爱故事。玩家的选择会影响与角色的关系走向。',
  thumbnail: generateTemplateThumbnail('心动瞬间', 'romance', '💕', '#EC4899', '#DB2777', '#BE185D'),
  category: 'romance',
  difficulty: 'medium',
  estimatedTime: '30分钟',
  features: ['好感度变量', '条件分支', '多角色', '好感度结局'],
  defaultGraph: {
    templateId: 'romance-hearts' as any,
    title: '心动瞬间',
    description: '一个关于选择与心动的恋爱故事',
    characters: [
      createTemplateCharacter('char-heroine', '小雅', '#EC4899', {
        gender: 'female',
        occupation: '学生',
        personality: ['温柔', '害羞'],
        bio: '温柔的女主角',
      }),
      createTemplateCharacter('char-rival', '小雪', '#8B5CF6', {
        gender: 'female',
        occupation: '学生',
        personality: ['高冷', '骄傲'],
        bio: '竞争对手',
      }),
    ],
    variables: [
      { id: 'var-affinity', name: '好感度', type: 'number', initialValue: 0, min: 0, max: 100, description: '与小雅的好感度' } as any,
      { id: 'var-day', name: '天数', type: 'number', initialValue: 1, min: 1, max: 7, description: '故事进行到的天数' } as any,
    ],
    nodes: [
      {
        id: 'start',
        type: 'dialogue',
        position: { x: 250, y: 50 },
        data: {
          characterId: 'char-heroine',
          text: '嗨，我是小雅。今天是我们第一次见面呢。',
          emotion: '害羞',
          sceneId: 'scene-default',
          backgroundImage: 'https://picsum.photos/seed/romance/800/600',
        },
      },
      {
        id: 'choice-intro',
        type: 'choice',
        position: { x: 250, y: 180 },
        data: {
          prompt: '你会怎么回应？',
          options: [
            { id: 'opt-nice', text: '你好，很高兴认识你！', variableEffect: { variableName: '好感度', operation: 'add', value: 10 } },
            { id: 'opt-normal', text: '嗯，你好。', variableEffect: { variableName: '好感度', operation: 'add', value: 5 } },
          ],
        },
      },
      {
        id: 'ending-good',
        type: 'ending',
        position: { x: 100, y: 350 },
        data: {
          title: '甜蜜结局',
          text: '经过几天的相处，你和小雅的心越来越近...最终，你们在一起了！',
          endingType: 'good',
        },
      },
      {
        id: 'ending-bad',
        type: 'ending',
        position: { x: 400, y: 350 },
        data: {
          title: '擦肩而过',
          text: '虽然你们有过美好的回忆，但因为种种原因，最终还是错过了...',
          endingType: 'bad',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'choice-intro' },
      { id: 'e2', source: 'choice-intro', sourceHandle: 'opt-nice', target: 'ending-good' },
      { id: 'e3', source: 'choice-intro', sourceHandle: 'opt-normal', target: 'ending-bad' },
    ],
    assets: { images: [], audios: [], fonts: [] },
    scenes: [
      { id: 'scene-default', name: '默认场景', backgroundImage: 'https://picsum.photos/seed/romance/800/600' },
    ],
    audios: [],
  },
}

// 模板3：悬疑推理 - 线索收集系统
const mysteryTemplate: StoryTemplate = {
  id: 'mystery-detective',
  name: '迷雾真相',
  description: '收集线索、解开谜题的悬疑推理故事。玩家需要找到关键线索才能揭露真相。',
  thumbnail: generateTemplateThumbnail('迷雾真相', 'mystery', '🔍', '#6366F1', '#4F46E5', '#4338CA'),
  category: 'mystery',
  difficulty: 'medium',
  estimatedTime: '45分钟',
  features: ['线索收集', '条件解锁', '线索回顾', '推理结局'],
  defaultGraph: {
    templateId: 'mystery-detective' as any,
    title: '迷雾真相',
    description: '一起发生在古宅中的神秘事件...',
    characters: [
      createTemplateCharacter('char-detective', '侦探', '#1E3A5F', {
        gender: 'male',
        occupation: '侦探',
        personality: ['冷静', '机智'],
        bio: '玩家扮演的侦探',
      }),
      createTemplateCharacter('char-witness', '管家', '#6B7280', {
        gender: 'male',
        occupation: '管家',
        personality: ['谨慎', '忠诚'],
        bio: '案件的关键证人',
      }),
    ],
    variables: [
      { id: 'var-clues', name: '线索数', type: 'number', initialValue: 0, min: 0, max: 5, description: '收集到的线索数量' } as any,
      { id: 'var-truth', name: '真相', type: 'boolean', initialValue: false, description: '是否发现真相' } as any,
    ],
    nodes: [
      {
        id: 'start',
        type: 'dialogue',
        position: { x: 250, y: 50 },
        data: {
          characterId: 'char-detective',
          text: '这座古宅里一定藏着什么秘密。我需要仔细调查每一个角落...',
          emotion: '思考',
          sceneId: 'scene-default',
          backgroundImage: 'https://picsum.photos/seed/mansion/800/600',
        },
      },
      {
        id: 'choice-investigate',
        type: 'choice',
        position: { x: 250, y: 180 },
        data: {
          prompt: '首先调查哪里？',
          options: [
            { id: 'opt-study', text: '去书房调查', variableEffect: { variableName: '线索数', operation: 'add', value: 1 } },
            { id: 'opt-kitchen', text: '去厨房调查', variableEffect: { variableName: '线索数', operation: 'add', value: 1 } },
          ],
        },
      },
      {
        id: 'ending-truth',
        type: 'ending',
        position: { x: 100, y: 350 },
        data: {
          title: '真相大白',
          text: '你收集了足够的线索，终于揭开了案件的真相！凶手就是...',
          endingType: 'good',
        },
      },
      {
        id: 'ending-miss',
        type: 'ending',
        position: { x: 400, y: 350 },
        data: {
          title: '线索不足',
          text: '你没能找到足够的线索，案件陷入了僵局...',
          endingType: 'bad',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'choice-investigate' },
      { id: 'e2', source: 'choice-investigate', sourceHandle: 'opt-study', target: 'ending-truth' },
      { id: 'e3', source: 'choice-investigate', sourceHandle: 'opt-kitchen', target: 'ending-miss' },
    ],
    assets: { images: [], audios: [], fonts: [] },
    scenes: [
      { id: 'scene-default', name: '古宅大门', backgroundImage: 'https://picsum.photos/seed/mansion/800/600' },
    ],
    audios: [],
  },
}

// 模板4：恐怖故事 - 氛围营造
const horrorTemplate: StoryTemplate = {
  id: 'horror-night',
  name: '深夜来访',
  description: '营造恐怖氛围的惊悚故事。包含音效、环境变化和紧张的心理描写。',
  thumbnail: generateTemplateThumbnail('深夜来访', 'horror', '👻', '#1F2937', '#111827', '#0F172A'),
  category: 'horror',
  difficulty: 'medium',
  estimatedTime: '20分钟',
  features: ['恐怖氛围', '环境音效', '心跳特效', '恐怖结局'],
  defaultGraph: {
    templateId: 'horror-night' as any,
    title: '深夜来访',
    description: '深夜，一阵敲门声打破了寂静...',
    characters: [
      createTemplateCharacter('char-protagonist', '主角', '#991B1B', {
        occupation: '普通人',
        personality: ['勇敢', '好奇'],
        bio: '故事的主角',
      }),
    ],
    variables: [],
    nodes: [
      {
        id: 'start',
        type: 'dialogue',
        position: { x: 250, y: 50 },
        data: {
          characterId: 'char-protagonist',
          text: '（深夜，独自一人在家。叮咚——）是谁在这个时候来敲门？',
          emotion: '紧张',
          sceneId: 'scene-default',
          backgroundImage: 'https://picsum.photos/seed/livingroom/800/600',
        },
      },
      {
        id: 'choice-door',
        type: 'choice',
        position: { x: 250, y: 180 },
        data: {
          prompt: '你会怎么做？',
          options: [
            { id: 'opt-open', text: '去开门看看' },
            { id: 'opt-hide', text: '躲在屋里不要出声' },
          ],
        },
      },
      {
        id: 'ending-bad',
        type: 'ending',
        position: { x: 100, y: 350 },
        data: {
          title: '无法逃离',
          text: '门开了，门外站着一个模糊的身影...你永远也无法知道那是什么了。',
          endingType: 'bad',
        },
      },
      {
        id: 'ending-good',
        type: 'ending',
        position: { x: 400, y: 350 },
        data: {
          title: '虚惊一场',
          text: '原来只是送错地址的快递员。你长舒一口气，庆幸自己保持了冷静。',
          endingType: 'good',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'choice-door' },
      { id: 'e2', source: 'choice-door', sourceHandle: 'opt-open', target: 'ending-bad' },
      { id: 'e3', source: 'choice-door', sourceHandle: 'opt-hide', target: 'ending-good' },
    ],
    assets: { images: [], audios: [], fonts: [] },
    scenes: [
      { id: 'scene-default', name: '深夜客厅', backgroundImage: 'https://picsum.photos/seed/livingroom/800/600' },
    ],
    audios: [],
  },
}

// 模板5：冒险故事 - CG过场
const adventureTemplate: StoryTemplate = {
  id: 'adventure-quest',
  name: '勇者传说',
  description: '包含CG过场动画的冒险故事。玩家将经历史诗般的冒险旅程。',
  thumbnail: generateTemplateThumbnail('勇者传说', 'adventure', '⚔️', '#F59E0B', '#D97706', '#B45309'),
  category: 'adventure',
  difficulty: 'hard',
  estimatedTime: '60分钟',
  features: ['CG过场', '战斗场景', '装备系统', '史诗剧情'],
  defaultGraph: {
    templateId: 'adventure-quest' as any,
    title: '勇者传说',
    description: '在剑与魔法的世界里，成为传说中的勇者！',
    characters: [
      createTemplateCharacter('char-hero', '勇者', '#2563EB', {
        gender: 'male',
        occupation: '勇者',
        personality: ['勇敢', '正义'],
        bio: '玩家扮演的勇者',
      }),
      createTemplateCharacter('char-dragon', '恶龙', '#DC2626', {
        gender: 'male',
        occupation: '最终Boss',
        personality: ['残暴', '狡猾'],
        bio: '盘踞在龙之山巅的恶龙',
      }),
    ],
    variables: [
      { id: 'var-hp', name: '生命值', type: 'number', initialValue: 100, min: 0, max: 100, description: '勇者的生命值' } as any,
      { id: 'var-power', name: '力量', type: 'number', initialValue: 10, min: 0, max: 100, description: '勇者的攻击力' } as any,
    ],
    nodes: [
      {
        id: 'start',
        type: 'dialogue',
        position: { x: 250, y: 50 },
        data: {
          characterId: 'char-hero',
          text: '我踏上了讨伐恶龙的旅程。传说中，恶龙盘踞在遥远的龙之山巅...',
          emotion: '坚定',
          sceneId: 'scene-default',
          backgroundImage: 'https://picsum.photos/seed/mountain/800/600',
        },
      },
      {
        id: 'cg-battle',
        type: 'cg',
        position: { x: 250, y: 180 },
        data: {
          mediaType: 'image',
          url: 'https://picsum.photos/seed/dragon/800/600',
          title: '决战时刻',
          subtitle: '勇者 vs 恶龙',
          canSkip: true,
          letterbox: true,
        },
      },
      {
        id: 'choice-final',
        type: 'choice',
        position: { x: 250, y: 310 },
        data: {
          prompt: '最终决战！使用什么技能？',
          options: [
            { id: 'opt-sword', text: '勇者之剑斩击', variableEffect: { variableName: '力量', operation: 'add', value: 20 } },
            { id: 'opt-magic', text: '究极魔法', variableEffect: { variableName: '力量', operation: 'add', value: 15 } },
          ],
        },
      },
      {
        id: 'ending-heroic',
        type: 'ending',
        position: { x: 100, y: 480 },
        data: {
          title: '传说诞生',
          text: '在你的带领下，恶龙被击败了！和平重新降临这片大陆，你的名字被铭刻在了传说之中。',
          endingType: 'good',
        },
      },
      {
        id: 'ending-fall',
        type: 'ending',
        position: { x: 400, y: 480 },
        data: {
          title: '壮烈牺牲',
          text: '虽然你展现出了非凡的勇气，但最终还是倒在了恶龙的火焰之下...但你的勇气将永远被铭记。',
          endingType: 'neutral',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'cg-battle' },
      { id: 'e2', source: 'cg-battle', target: 'choice-final' },
      { id: 'e3', source: 'choice-final', sourceHandle: 'opt-sword', target: 'ending-heroic' },
      { id: 'e4', source: 'choice-final', sourceHandle: 'opt-magic', target: 'ending-fall' },
    ],
    assets: { images: [], audios: [], fonts: [] },
    scenes: [
      { id: 'scene-default', name: '龙之山巅', backgroundImage: 'https://picsum.photos/seed/mountain/800/600' },
    ],
    audios: [],
  },
}

export const storyTemplates: StoryTemplate[] = [
  tutorialTemplate,
  beginnerTemplate,
  romanceTemplate,
  mysteryTemplate,
  horrorTemplate,
  adventureTemplate,
]

export function getTemplateById(id: string): StoryTemplate | undefined {
  return storyTemplates.find(t => t.id === id)
}

export function getTemplatesByCategory(category: StoryTemplate['category']): StoryTemplate[] {
  return storyTemplates.filter(t => t.category === category)
}

export const templateCategories = [
  { id: 'beginner', name: '新手入门', icon: '🎯' },
  { id: 'romance', name: '恋爱故事', icon: '💕' },
  { id: 'mystery', name: '悬疑推理', icon: '🔍' },
  { id: 'horror', name: '恐怖惊悚', icon: '👻' },
  { id: 'adventure', name: '冒险奇幻', icon: '⚔️' },
] as const
