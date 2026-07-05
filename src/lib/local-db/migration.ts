import { openDB } from './db'
import { saveWork } from './work-store'

const MIGRATION_KEY = 'subsilicon_storage_migrated'

export async function migrateFromLocalStorage(): Promise<number> {
  if (localStorage.getItem(MIGRATION_KEY)) return 0

  let migratedCount = 0

  // 迁移作品数据（subsilicon_editor_work_*）
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('subsilicon_editor_work_')) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const data = JSON.parse(raw)
      // 兼容旧格式：data.work 或 data 直接是作品数据
      const work = data.work || data
      if (work.id) {
        await saveWork({
          id: work.id,
          name: work.name || '未命名故事',
          editorData: work.editorData || work,
          updatedAt: work.updatedAt || Date.now(),
          nodeCount: work.editorData?.nodes?.length || work.nodes?.length || 0,
          edgeCount: work.editorData?.edges?.length || work.edges?.length || 0,
          thumbnail: work.thumbnail,
        })
        localStorage.removeItem(key)
        migratedCount++
      }
    } catch {
      // skip corrupt entries
    }
  }

  // 迁移编辑器设置
  const settingsToMigrate = [
    'subsilicon_ai_settings',
    'subsilicon_editor_onboarded',
  ]
  for (const settingKey of settingsToMigrate) {
    const value = localStorage.getItem(settingKey)
    if (value) {
      const db = await openDB()
      const tx = db.transaction('settings', 'readwrite')
      tx.objectStore('settings').put({ key: settingKey, value })
      localStorage.removeItem(settingKey)
    }
  }

  localStorage.setItem(MIGRATION_KEY, 'true')
  return migratedCount
}