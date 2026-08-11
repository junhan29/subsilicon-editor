/**
 * 作品类型注册表（Work Type Registry）
 *
 * 统一的类型适配器注册入口。核心不感知具体作品类型，
 * 通过 getWorkType(id) 获取对应适配器来分发保存/导出/发布/营利逻辑。
 */

import type { WorkTypeAdapter, WorkTypeId } from '@editor/types/work'

const adapters = new Map<WorkTypeId, WorkTypeAdapter>()

/** 注册作品类型适配器（幂等：重复注册同名类型时忽略并告警） */
export function registerWorkType(adapter: WorkTypeAdapter): void {
  if (adapters.has(adapter.id)) {
    console.warn(`[work-registry] 作品类型「${adapter.id}」已注册，忽略重复注册`)
    return
  }
  adapters.set(adapter.id, adapter)
}

/** 获取指定类型的适配器；未注册时回退到互动叙事（保持向后兼容） */
export function getWorkType(id?: WorkTypeId | null): WorkTypeAdapter {
  if (id && adapters.has(id)) {
    return adapters.get(id)!
  }
  // 回退：互动叙事作为默认类型
  const fallback = adapters.get('interactive-narrative')
  if (!fallback) {
    throw new Error('[work-registry] 未注册任何作品类型，且缺少默认互动叙事类型')
  }
  return fallback
}

/** 列出所有已注册类型（按注册顺序） */
export function listWorkTypes(): WorkTypeAdapter[] {
  return Array.from(adapters.values())
}

/** 是否已注册某类型 */
export function hasWorkType(id: WorkTypeId): boolean {
  return adapters.has(id)
}

/** 判断一个对象是否为 WorkDocument（含 formatVersion 与 workType 字段） */
export function isWorkDocument(value: unknown): value is import('@editor/types/work').WorkDocument {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.formatVersion === 'string' &&
    typeof v.workType === 'string' &&
    v.graph !== null &&
    typeof v.graph === 'object'
  )
}

/**
 * 判断一个对象是否为 v1.x 旧格式 StoryGraph（无 formatVersion / workType）
 */
export function isLegacyStoryGraph(value: unknown): value is import('@editor/types/editor').StoryGraph {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    !('formatVersion' in v) &&
    typeof v.title === 'string' &&
    Array.isArray(v.nodes) &&
    Array.isArray(v.edges)
  )
}
