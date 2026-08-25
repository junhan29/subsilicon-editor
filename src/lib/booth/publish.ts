/**
 * 摊位级发布（一键摆摊）
 *
 * 复用现有单作品提交协议（publishToPlatform）：按陈列顺序逐件提交，
 * 提交内容带摊位上下文（摊主简介/联系方式/标签），完成后更新摊位同步状态。
 *
 * 说明：DDP 1.1（booth 层元数据 + 类型化 stats）在 Phase C 接入；
 * 本阶段先打通「一次摆摊 = 逐件发布到目标墙」的可用闭环。
 */

import type { Booth } from './types'
import type { BoothExportItem } from './pack'
import { buildBoothDdp } from './pack'
import type { LocalAccount } from '@editor/lib/local-account-store'
import { getAccount } from '@editor/lib/local-account-store'
import { publishToPlatform, validateDownloadLinks, type DownloadLink } from '@editor/lib/creator-service'
import { getWorkType } from '@editor/lib/work-registry'
import { getGraphFromWork } from '@editor/lib/local-db/work-store'
import { saveBooth } from './store'

export interface BoothPublishResult {
  workId: string
  title: string
  success: boolean
  error?: string
}

export interface BoothPublishOutcome {
  success: boolean
  error?: string
  results: BoothPublishResult[]
}

/**
 * 一键摆摊：把摊位陈列的每件作品发布到指定平台墙。
 * 返回每件作品的提交结果，并更新摊位同步状态（已发布墙列表）。
 */
export async function publishBooth(
  booth: Booth,
  items: BoothExportItem[],
  platformConfigId: string,
  account?: Omit<LocalAccount, 'passwordHash'>,
  options?: {
    /** 摊位级 downloadLinks：应用到所有作品（除非 perWorkDownloadLinks 覆盖） */
    downloadLinks?: DownloadLink[];
    /** 每作品级 downloadLinks：workId -> 下载渠道数组 */
    perWorkDownloadLinks?: Record<string, DownloadLink[]>;
  }
): Promise<BoothPublishOutcome> {
  const acc = account || getAccount()
  if (!acc) {
    return { success: false, error: '请先在「创作者中心」登录创作者账号', results: [] }
  }
  if (items.length === 0) {
    return { success: false, error: '摊位上还没有陈列作品', results: [] }
  }

  const results: BoothPublishResult[] = []

  for (const item of items) {
    const doc = item.doc
    const title = doc.meta?.title || item.work.name
    const summary = doc.meta?.description || ''
    const tags = Array.from(
      new Set([...(booth.profile.tags || []), ...(doc.meta?.tags || [])])
    ).slice(0, 5)

    let previewHtml = ''
    try {
      const adapter = getWorkType(item.work.workType)
      previewHtml = await adapter.getPreviewHTML(getGraphFromWork(item.work))
    } catch {
      previewHtml = ''
    }

    const contactInfo = booth.creator.contact?.trim() || ''
    const externalLink = booth.channels.thirdParty[0]?.link?.trim() || ''

    // DDP 1.1：摊位层元数据随每次提交附带（按 creatorEmail 聚合，站点侧 upsert）
    const ddp = buildBoothDdp(booth, items)
    const extraFields: Record<string, string> = { booth: JSON.stringify(ddp) }
    // C3. downloadLinks 合并逻辑：作品级优先，其次摊位级，最后无则不发送空数组（省流量）
    const workLinks = options?.perWorkDownloadLinks?.[item.work.id]
    const boothLinks = options?.downloadLinks
    const rawLinksForWork: DownloadLink[] | undefined =
      Array.isArray(workLinks) && workLinks.length > 0 ? workLinks :
      Array.isArray(boothLinks) && boothLinks.length > 0 ? boothLinks :
      undefined
    if (rawLinksForWork) {
      const v = validateDownloadLinks(rawLinksForWork, { allowEmpty: false })
      if (!v.ok || !v.value) {
        results.push({
          workId: item.work.id,
          title,
          success: false,
          error: '下载渠道校验失败：' + (v.error || 'unknown'),
        })
        continue
      }
      extraFields.downloadLinks = JSON.stringify(v.value)
    }

    const res = await publishToPlatform(
      item.work.id,
      platformConfigId,
      title,
      summary,
      tags,
      null,
      [],
      contactInfo,
      externalLink,
      previewHtml,
      acc,
      extraFields
    )

    results.push({
      workId: item.work.id,
      title,
      success: res.success,
      error: res.error,
    })
  }

  // 更新摊位同步状态
  const now = Date.now()
  const wallId = platformConfigId
  const updated: Booth = {
    ...booth,
    sync: {
      publishedAt: now,
      lastSyncedAt: now,
      walls: booth.sync.walls.includes(wallId)
        ? booth.sync.walls
        : [...booth.sync.walls, wallId],
    },
    updatedAt: now,
  }
  await saveBooth(updated)

  const okCount = results.filter((r) => r.success).length
  return {
    success: okCount === results.length,
    error:
      okCount === results.length
        ? undefined
        : `${results.length - okCount} 件作品提交失败（其余已提交，可在「发布记录」查看详情）`,
    results,
  }
}
