import { describe, it, expect } from 'vitest'
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_ICONS,
  ALL_NODE_TYPES,
  GROUP_COLORS,
  ENDING_TYPES,
  EMOTION_TYPES,
  SPRITE_POSITION_TYPES,
  TRANSITION_TYPES,
  TEXT_ANIMATION_TYPES,
  ENTER_ANIMATION_TYPES,
  PERSONALITY_TRAITS,
  APPEARANCE_TAGS,
  SPEECH_TONES,
  STORY_TAGS,
  CHAR_COLORS,
} from '../../constants'

describe('constants - node-types', () => {
  describe('NODE_TYPE_LABELS', () => {
    it('包含所有节点类型', () => {
      expect(NODE_TYPE_LABELS['dialogue']).toBe('对话节点')
      expect(NODE_TYPE_LABELS['choice']).toBe('选择节点')
      expect(NODE_TYPE_LABELS['narration']).toBe('旁白节点')
      expect(NODE_TYPE_LABELS['ending']).toBe('结局节点')
      expect(NODE_TYPE_LABELS['unlock']).toBe('付费节点')
      expect(NODE_TYPE_LABELS['gather']).toBe('汇聚节点')
      expect(NODE_TYPE_LABELS['condition']).toBe('条件节点')
      expect(NODE_TYPE_LABELS['cg']).toBe('CG过场节点')
      expect(NODE_TYPE_LABELS['jump']).toBe('跳转节点')
      expect(NODE_TYPE_LABELS['random']).toBe('随机节点')
    })

    it('所有标签都是非空字符串', () => {
      for (const label of Object.values(NODE_TYPE_LABELS)) {
        expect(label).toBeTypeOf('string')
        expect(label.length).toBeGreaterThan(0)
      }
    })
  })

  describe('NODE_TYPE_ICONS', () => {
    it('所有节点类型都有对应的图标', () => {
      for (const type of Object.keys(NODE_TYPE_LABELS)) {
        expect(NODE_TYPE_ICONS[type]).toBeDefined()
      }
    })
  })

  describe('ALL_NODE_TYPES', () => {
    it('包含所有标准节点类型', () => {
      expect(ALL_NODE_TYPES).toContain('dialogue')
      expect(ALL_NODE_TYPES).toContain('choice')
      expect(ALL_NODE_TYPES).toContain('narration')
      expect(ALL_NODE_TYPES).toContain('ending')
    })

    it('不包含 group 类型', () => {
      expect(ALL_NODE_TYPES).not.toContain('group')
    })
  })

  describe('GROUP_COLORS', () => {
    it('有足够多的颜色', () => {
      expect(GROUP_COLORS.length).toBeGreaterThanOrEqual(6)
    })

    it('每个颜色有 value 和 name', () => {
      for (const color of GROUP_COLORS) {
        expect(color.value).toMatch(/^#[0-9a-fA-F]{6}$/)
        expect(color.name.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('constants - character', () => {
  describe('ENDING_TYPES', () => {
    it('有四种结局类型', () => {
      expect(ENDING_TYPES).toHaveLength(4)
    })

    it('包含好结局', () => {
      expect(ENDING_TYPES.find(t => t.value === 'good')).toBeDefined()
    })

    it('包含坏结局', () => {
      expect(ENDING_TYPES.find(t => t.value === 'bad')).toBeDefined()
    })
  })

  describe('EMOTION_TYPES', () => {
    it('包含所有基本情绪', () => {
      const values = EMOTION_TYPES.map(t => t.value)
      expect(values).toContain('normal')
      expect(values).toContain('happy')
      expect(values).toContain('sad')
      expect(values).toContain('angry')
    })
  })

  describe('SPRITE_POSITION_TYPES', () => {
    it('有三个位置选项', () => {
      expect(SPRITE_POSITION_TYPES).toHaveLength(3)
    })
  })

  describe('PERSONALITY_TRAITS', () => {
    it('有多个性格特点', () => {
      expect(PERSONALITY_TRAITS.length).toBeGreaterThan(10)
    })

    it('每个特点都是非空字符串', () => {
      for (const trait of PERSONALITY_TRAITS) {
        expect(trait).toBeTypeOf('string')
        expect(trait.length).toBeGreaterThan(0)
      }
    })
  })

  describe('APPEARANCE_TAGS', () => {
    it('有多个外貌标签', () => {
      expect(APPEARANCE_TAGS.length).toBeGreaterThan(10)
    })
  })

  describe('SPEECH_TONES', () => {
    it('有多种说话风格', () => {
      expect(SPEECH_TONES.length).toBeGreaterThan(5)
    })
  })

  describe('STORY_TAGS', () => {
    it('有多个故事类型标签', () => {
      expect(STORY_TAGS.length).toBeGreaterThan(5)
    })
  })

  describe('CHAR_COLORS', () => {
    it('有多种角色颜色', () => {
      expect(CHAR_COLORS.length).toBeGreaterThanOrEqual(6)
    })

    it('都是有效的 hex 颜色', () => {
      for (const color of CHAR_COLORS) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })
  })
})

describe('constants - animation', () => {
  describe('TRANSITION_TYPES', () => {
    it('有多种转场类型', () => {
      expect(TRANSITION_TYPES.length).toBeGreaterThan(5)
    })
  })

  describe('TEXT_ANIMATION_TYPES', () => {
    it('包含打字机效果', () => {
      expect(TEXT_ANIMATION_TYPES.find(t => t.value === 'typewriter')).toBeDefined()
    })
  })

  describe('ENTER_ANIMATION_TYPES', () => {
    it('有多种入场动画', () => {
      expect(ENTER_ANIMATION_TYPES.length).toBeGreaterThanOrEqual(4)
    })
  })
})
