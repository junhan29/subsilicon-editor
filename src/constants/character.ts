export const ENDING_TYPES = [
  { value: 'good', label: '好结局' },
  { value: 'bad', label: '坏结局' },
  { value: 'neutral', label: '普通结局' },
  { value: 'secret', label: '隐藏结局' },
] as const

export type EndingType = typeof ENDING_TYPES[number]['value']

export const EMOTION_TYPES = [
  { value: 'normal', label: '普通' },
  { value: 'happy', label: '开心' },
  { value: 'sad', label: '悲伤' },
  { value: 'angry', label: '愤怒' },
  { value: 'surprised', label: '惊讶' },
  { value: 'embarrassed', label: '尴尬' },
  { value: 'thinking', label: '思考' },
  { value: 'scared', label: '害怕' },
  { value: 'crying', label: '哭泣' },
  { value: 'laughing', label: '大笑' },
] as const

export type EmotionType = typeof EMOTION_TYPES[number]['value']

export const SPRITE_POSITION_TYPES = [
  { value: 'left', label: '左侧' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右侧' },
] as const

export type SpritePosition = typeof SPRITE_POSITION_TYPES[number]['value']

export const PERSONALITY_TRAITS = [
  '勇敢', '冷静', '热血', '高傲', '温柔', '腹黑', '傲娇', '天然呆',
  '正义', '邪恶', '乐观', '悲观', '开朗', '内向', '活泼', '稳重',
]

export const APPEARANCE_TAGS = [
  '长发', '短发', '卷发', '大眼', '小眼', '高挑', '娇小', '肌肉',
  '眼镜', '帽子', '纹身', '伤疤', '马尾', '双马尾', '麻花辫',
]

export const SPEECH_TONES = [
  '热血激昂', '冷淡简洁', '软萌可爱', '成熟稳重', '痞气十足',
  '文绉绉', '网络用语', '地方口音', '娃娃音', '御姐音',
]

export const SPEECH_RHYTHMS = ['快节奏', '慢条斯理', '跳跃', '顿挫', '流畅']

export const SPEECH_VOCABULARY = ['直接', '委婉', '正式', '口语化', '文艺', '网络']

export const SKILL_TAGS = [
  '格斗', '射击', '魔法', '烹饪', '黑客', '驾驶', '医术', '演技',
  '管理', '谈判', '潜行', '跑酷', '乐器', '舞蹈', '绘画',
]

export const HABIT_TAGS = [
  '吃零食', '喝咖啡', '熬夜', '早起', '健身', '阅读', '发呆', '自言自语',
  '整理东西', '迟到',
]

export const FEAR_TAGS = [
  '黑暗', '打雷', '虫子', '高处', '深海', '孤独', '失败', '背叛',
  '鬼魂', '蛇', '蜘蛛', '密闭空间', '公开演讲',
]

export const CHARACTER_CUSTOM_TAGS = [
  '学生', '老师', '警察', '医生', '商人', '运动员', '艺术家', '程序员',
  '热血', '御姐', '萝莉', '正太', '大叔', '女神', '男神', '萌新',
]

export const STORY_TAGS = [
  '古风', '玄幻', '悬疑', '恋爱', '现代', '科幻', '恐怖', '校园', '都市', '穿越',
]

export const CHAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e',
]
