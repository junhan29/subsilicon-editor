/**
 * 旧格式迁移器（StoryGraph → WorkDocument）
 *
 * v1.x 项目保存的是裸 StoryGraph；v2.0 起统一为 WorkDocument。
 * 打开旧项目时透明迁移：仅包装，不修改原始数据，可回退。
 */

import type { WorkDocument, WorkTypeId } from '@editor/types/work'
import type { StoryGraph } from '@editor/types/editor'
import { isLegacyStoryGraph, isWorkDocument } from '@editor/lib/work-registry'
import { INTERACTIVE_NARRATIVE_ID, interactiveNarrativeAdapter } from '@editor/lib/work-types/interactive-narrative'

/**
 * 将任意存储数据归一化为 WorkDocument。
 *
 * - 已是 WorkDocument：原样返回
 * - 旧版裸 StoryGraph：包装为互动叙事 WorkDocument（不修改原图）
 * - 其他：返回 null
 */
export function normalizeWorkDocument(value: unknown): WorkDocument | null {
  if (isWorkDocument(value)) {
    return value as WorkDocument
  }
  if (isLegacyStoryGraph(value)) {
    return interactiveNarrativeAdapter.fromGraph(value as StoryGraph)
  }
  return null
}

/**
 * 从 WorkDocument 提取类型化图数据（供编辑/导出使用）。
 * 未知类型时回退为互动叙事（向后兼容）。
 */
export function toTypedGraph(doc: WorkDocument): StoryGraph {
  return doc.graph
}

/**
 * 判断文档是否为指定作品类型
 */
export function isWorkType(doc: WorkDocument | null | undefined, type: WorkTypeId): boolean {
  return !!doc && doc.workType === type
}

/**
 * 迁移工作区的旧版项目（project-manager 入口调用）。
 * 返回标准化后的文档，或 null 表示数据无法识别。
 */
export function migrateLegacyEditorData(
  value: unknown
): { document: WorkDocument } | null {
  const doc = normalizeWorkDocument(value)
  if (!doc) return null
  return { document: doc }
}

/** 默认类型标识（未标注类型的旧项目归为互动叙事） */
export const DEFAULT_WORK_TYPE: WorkTypeId = INTERACTIVE_NARRATIVE_ID
