/**
 * 摊位（Booth）数据模型 —— 创作者的一级容器
 *
 * 范式：漫展卖本子。摊主（创作者）在本地布置摊位（资料/陈列/试阅/价目/收款），
 * 作品（WorkDocument）是摊位上陈列的本子。摊位可整体打包、跨墙摆摊。
 *
 * 版本：Booth v1.0（v2.0 编辑器新增，不涉及旧数据迁移）
 */

import type { WorkTypeId } from '@editor/types/work'
import type { MonetizationConfig } from '@editor/lib/work-monetization'

export const BOOTH_VERSION = '1.0'

/** 主摊位固定 ID：单摊位模型（一个创作者一个摊位） */
export const PRIMARY_BOOTH_ID = 'booth-primary'

/** 摊主资料 */
export interface BoothCreator {
  /** 摊位名/作者笔名 */
  handle: string
  /** 头像（本地资源引用或 URL） */
  avatar: string | null
  /** 摊位简介 */
  bio: string
  /** 联系方式（站外交易入口，如微信/邮箱） */
  contact: string
}

/** 摊位宣传资料 */
export interface BoothProfile {
  /** 摊位横幅（宣传物料） */
  banner: string | null
  /** 摊位标语 */
  slogan: string
  /** 摊位标签（题材/风格） */
  tags: string[]
}

/** 陈列配置 */
export interface BoothDisplay {
  /** 陈列顺序（作品 id 列表，主推在前） */
  order: string[]
  /** 主推作品 id */
  featuredId: string | null
}

/** 试阅片段类型（按作品类型约定） */
export type BoothPreviewType = 'chapters' | 'seconds' | 'nodes' | 'panels'

/** 试阅配置（该作品的宣传片段） */
export interface BoothPreviewConfig {
  type: BoothPreviewType
  /** 前 N 章 / 前 N 秒 / 前 N 个节点 / 前 N 格 */
  value: number
}

/** 该作品价目（可覆盖作品默认价目） */
export interface BoothPricing {
  /** 是否覆盖作品默认价目 */
  override: boolean
  /** 整本价（0 表示不按整本卖） */
  whole?: number
  /** 章节价 */
  chapter?: number
  /** 片段/节点价 */
  segment?: number
}

/** 陈列的作品条目（引用 WorkDocument） */
export interface BoothWorkEntry {
  workId: string
  workType: WorkTypeId
  preview: BoothPreviewConfig
  pricing: BoothPricing
  /** 入摊时间 */
  addedAt: number
}

/** 摊位级收款方式（复用现有营利配置结构，聚合多收款渠道） */
export interface BoothChannels {
  /** 手动收款码（微信/支付宝等） */
  manual: Array<{
    id: string
    kind: 'wechat' | 'alipay' | 'stripe' | 'paypal' | 'other'
    label: string
    /** 收款码（dataURL/URL）或账号信息 */
    value: string
  }>
  /** 第三方平台链接（爱发电/面包多/Ko-fi 等） */
  thirdParty: Array<{
    id: string
    kind: 'afdian' | 'mianbaoduo' | 'patreon' | 'ko-fi' | 'other'
    label: string
    link: string
  }>
}

/** 摊位发布/同步状态（跨墙） */
export interface BoothSyncState {
  /** 最近一次摆摊时间 */
  publishedAt: number | null
  /** 最近一次同步时间 */
  lastSyncedAt: number | null
  /** 已发布到的墙（平台 id 列表） */
  walls: string[]
}

/** 摊位容器 */
export interface Booth {
  boothVersion: string
  id: string
  /** 摊位名（摊主 handle 的展示别名） */
  name: string
  creator: BoothCreator
  profile: BoothProfile
  display: BoothDisplay
  works: BoothWorkEntry[]
  /** 摊位级收款配置（复用营利配置；未启用时 null） */
  monetization: MonetizationConfig | null
  /** 收款渠道聚合（轻量结构，摊位预览使用） */
  channels: BoothChannels
  /** 合规声明（默认文案，可被摊主自定义） */
  complianceNote: string
  sync: BoothSyncState
  createdAt: number
  updatedAt: number
}

/** 默认合规声明（平台不参与交易） */
export const DEFAULT_COMPLIANCE_NOTE =
  '本站仅发布作品宣传信息，不提供作品本体的在线浏览、试读或试玩；完整内容获取与交易请通过创作者提供的渠道直接联系。'

/** 创建空摊位 */
export function createEmptyBooth(name = '我的摊位'): Booth {
  const now = Date.now()
  return {
    boothVersion: BOOTH_VERSION,
    id: PRIMARY_BOOTH_ID,
    name,
    creator: {
      handle: name,
      avatar: null,
      bio: '',
      contact: '',
    },
    profile: {
      banner: null,
      slogan: '',
      tags: [],
    },
    display: {
      order: [],
      featuredId: null,
    },
    works: [],
    monetization: null,
    channels: {
      manual: [],
      thirdParty: [],
    },
    complianceNote: DEFAULT_COMPLIANCE_NOTE,
    sync: {
      publishedAt: null,
      lastSyncedAt: null,
      walls: [],
    },
    createdAt: now,
    updatedAt: now,
  }
}

/** 默认试阅配置（按作品类型给出合理初值） */
export function defaultPreviewForType(workType: WorkTypeId): BoothPreviewConfig {
  switch (workType) {
    case 'novel':
      return { type: 'chapters', value: 2 }
    case 'video':
      return { type: 'seconds', value: 30 }
    case 'comic':
      return { type: 'panels', value: 6 }
    default:
      return { type: 'nodes', value: 3 }
  }
}
