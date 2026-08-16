import { describe, expect, it } from 'vitest'
import {
  BUILTIN_SKILL_TEMPLATES,
  getSkillTemplate,
  getSkillTemplatesForTask,
} from '../ai/skill-templates'

describe('BUILTIN_SKILL_TEMPLATES', () => {
  it('包含全部 5 类任务的模板', () => {
    const taskTypes = new Set(BUILTIN_SKILL_TEMPLATES.flatMap((t) => t.taskTypes))
    expect(taskTypes.has('editor')).toBe(true)
    expect(taskTypes.has('text')).toBe(true)
    expect(taskTypes.has('image')).toBe(true)
    expect(taskTypes.has('video')).toBe(true)
    expect(taskTypes.has('audio')).toBe(true)
  })

  it('每个模板有非空 id / name / desc / skillPrompt', () => {
    for (const t of BUILTIN_SKILL_TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0)
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.desc.length).toBeGreaterThan(0)
      expect(t.skillPrompt.length).toBeGreaterThan(0)
      expect(t.taskTypes.length).toBeGreaterThan(0)
    }
  })

  it('id 唯一', () => {
    const ids = BUILTIN_SKILL_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getSkillTemplatesForTask', () => {
  it('editor 槽返回 editor 模板', () => {
    const list = getSkillTemplatesForTask('editor')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((t) => t.taskTypes.includes('editor'))).toBe(true)
  })

  it('text 槽返回 text 模板', () => {
    const list = getSkillTemplatesForTask('text')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((t) => t.taskTypes.includes('text'))).toBe(true)
  })

  it('image 槽返回 image 模板', () => {
    const list = getSkillTemplatesForTask('image')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((t) => t.taskTypes.includes('image'))).toBe(true)
  })

  it('video 槽返回 video 模板', () => {
    const list = getSkillTemplatesForTask('video')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((t) => t.taskTypes.includes('video'))).toBe(true)
  })

  it('audio 槽返回 audio 模板', () => {
    const list = getSkillTemplatesForTask('audio')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((t) => t.taskTypes.includes('audio'))).toBe(true)
  })

  it('不返回其他任务槽的模板', () => {
    const list = getSkillTemplatesForTask('editor')
    // editor 模板不应包含 image/video/audio 专属模板
    expect(list.some((t) => t.id.startsWith('image-'))).toBe(false)
    expect(list.some((t) => t.id.startsWith('video-'))).toBe(false)
    expect(list.some((t) => t.id.startsWith('audio-'))).toBe(false)
  })
})

describe('getSkillTemplate', () => {
  it('按 id 获取模板', () => {
    const t = getSkillTemplate('editor-branch-architect')
    expect(t).toBeDefined()
    expect(t?.name).toBe('分支叙事架构师')
  })

  it('不存在返回 undefined', () => {
    expect(getSkillTemplate('nonexistent-id')).toBeUndefined()
  })
})
