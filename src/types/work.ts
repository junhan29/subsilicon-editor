/**
 * 通用作品模型（Work Document）
 *
 * 编辑器 v2.0 核心抽象：所有作品类型（互动叙事/小说/视频/漫画…）统一
 * 以 WorkDocument 描述，图数据（graph）由对应 WorkTypeAdapter 解释。
 *
 * 设计原则（Phase 1）：
 * - 编辑/导出等既有业务层仍以类型化 graph（如 StoryGraph）工作；
 *   存储/加载层统一为 WorkDocument。
 * - 旧版本（v1.x）数据通过迁移器兼容读取，保存后升级为新格式。
 */

import type { StoryGraph } from '@editor/types/editor'
import type { MonetizationConfig } from '@editor/lib/work-monetization'

/** 作品类型标识（可扩展，插件可注册新类型） */
export type WorkTypeId =
  | 'interactive-narrative'
  | 'novel'
  | 'video'
  | 'comic'
  | (string & {})

/** 文档格式版本 */
export const WORK_FORMAT_VERSION = '2.0'

export interface WorkMeta {
  title: string
  description?: string
  tags?: string[]
  coverImage?: string
  language?: string
  /** 创作者展示名（发布/导出时使用） */
  creatorName?: string
  createdAt?: number
  updatedAt?: number
}

/** 作品资源引用清单 */
export interface WorkResources {
  images: string[]
  audios: string[]
  videos: string[]
  fonts: string[]
  /** 其他二进制资源 */
  others: string[]
}

export interface WorkDocument {
  /** 文档格式版本，如 '2.0' */
  formatVersion: string
  /** 作品类型 */
  workType: WorkTypeId
  /** 作品元信息 */
  meta: WorkMeta
  /** 类型化图数据（由 adapter 解释；互动叙事为 StoryGraph） */
  graph: StoryGraph
  /** 资源引用清单 */
  resources: WorkResources
  /** 营利配置（复用 work-monetization） */
  monetization?: MonetizationConfig
  /** 类型自定义数据（如视频时间线、小说章节元数据） */
  extra?: Record<string, unknown>
}

/** 导出格式描述（由 adapter 提供，驱动导出面板） */
export interface ExportFormatDescriptor {
  id: string
  name: string
  description: string
  icon: string
  ext: string
  /** 是否支持主题皮肤 */
  themeable?: boolean
  /** 是否支持资源打包选项 */
  assetsApplicable?: boolean
  /** 是否支持调试信息 */
  debugApplicable?: boolean
}

/** 作品类型适配器接口 */
export interface WorkTypeAdapter {
  /** 类型唯一标识 */
  id: WorkTypeId
  /** 展示名：小说 / 视频 / … */
  name: string
  /** 图标（lucide 图标名或 emoji） */
  icon: string
  /** 一句话描述 */
  description: string

  /** 新建空白图数据 */
  createEmptyGraph(): StoryGraph
  /** 校验图数据是否合法（用于打开/迁移时检测） */
  validateGraph(graph: unknown): boolean
  /** 从 WorkDocument 提取类型化图（一般直接返回 doc.graph） */
  toGraph(doc: WorkDocument): StoryGraph
  /** 从类型化图构建 WorkDocument（meta/resources 自动提取） */
  fromGraph(graph: StoryGraph, extra?: Record<string, unknown>): WorkDocument

  /** 该类型支持的导出格式列表 */
  getExportFormats(): ExportFormatDescriptor[]
  /** 生成发布预览 HTML（多墙发布使用；互动叙事 = exportPreviewHTML） */
  getPreviewHTML(graph: StoryGraph): Promise<string> | string
  /** DDP work.json 类型化统计字段 */
  getDdpStats(graph: StoryGraph): Record<string, unknown>
  /** 该类型支持的付费粒度（供营利面板展示） */
  getMonetizationGranularity(): ('whole' | 'chapter' | 'segment' | 'node' | 'panel')[]
}
