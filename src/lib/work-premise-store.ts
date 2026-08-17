/**
 * 作品核心设定（世界观/基调/风格禁忌等）——每作品独立存储。
 * 随 AI 聊天上下文 serializeGraphContext 最前端注入，确保每轮对话 AI 都能看到，减少文字前后矛盾。
 */

const KEY_PREFIX = 'subsilicon-work-premise'

function keyFor(workId: string): string {
  return `${KEY_PREFIX}:${workId || 'default'}`
}

export function getWorkPremise(workId?: string): string {
  try {
    return localStorage.getItem(keyFor(workId || 'default')) || ''
  } catch {
    return ''
  }
}

export function saveWorkPremise(workId: string | undefined, premise: string): void {
  try {
    const trimmed = premise.trim()
    if (trimmed) {
      localStorage.setItem(keyFor(workId || 'default'), trimmed)
    } else {
      localStorage.removeItem(keyFor(workId || 'default'))
    }
  } catch {
    // quota 异常或隐私模式：忽略
  }
}
