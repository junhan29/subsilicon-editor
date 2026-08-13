import {
  type WebDAVConfig,
  type WebDAVFile,
  deleteFile as webdavDeleteFile,
  ensureDir as webdavEnsureDir,
  getFile as webdavGetFile,
  list as webdavList,
  putFile as webdavPutFile,
} from './webdav-client'

export type { WebDAVConfig, WebDAVFile }
import {
  type StoredWork,
  deleteWork,
  getAllWorks,
  loadWork,
  saveWork,
} from './local-db/work-store'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict'

export interface SyncState {
  status: SyncStatus
  lastSyncTime?: number
  error?: string
  conflicts: string[]
  progress?: number
  currentFile?: string
}

export interface SyncLogEntry {
  timestamp: number
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

const CONFIG_KEY = 'subsilicon_webdav_config'
const STATE_KEY = 'subsilicon_sync_state'
const LOG_KEY = 'subsilicon_sync_log'
const SYNC_DIR = 'SubSilicon/works'

// 同步基线：记录每个作品上次同步成功时的本地 updatedAt 与云端 lastModified，
// 用于判定「本地与云端都在上次同步后被修改」的双向冲突。
const SYNC_MARKERS_KEY = 'subsilicon_sync_markers'

interface SyncMarker {
  localUpdatedAt: number
  remoteModified: number
}

let syncMarkers: Record<string, SyncMarker> = {}

function loadSyncMarkers(): void {
  try {
    const raw = localStorage.getItem(SYNC_MARKERS_KEY)
    if (raw) {
      syncMarkers = JSON.parse(raw)
    }
  } catch {
    syncMarkers = {}
  }
}

function saveSyncMarkers(): void {
  try {
    localStorage.setItem(SYNC_MARKERS_KEY, JSON.stringify(syncMarkers))
  } catch {
    // ignore
  }
}

let syncState: SyncState = {
  status: 'idle',
  conflicts: [],
}

let syncLog: SyncLogEntry[] = []

const stateListeners: Set<(state: SyncState) => void> = new Set()
const logListeners: Set<(logs: SyncLogEntry[]) => void> = new Set()

function loadConfigFromStorage(): WebDAVConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const encoded = JSON.parse(raw)
    return {
      url: encoded.url,
      username: encoded.username,
      password: atob(encoded.password),
    }
  } catch {
    return null
  }
}

function saveConfigToStorage(config: WebDAVConfig): void {
  const encoded = {
    url: config.url,
    username: config.username,
    password: btoa(config.password),
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(encoded))
}

function clearConfigFromStorage(): void {
  localStorage.removeItem(CONFIG_KEY)
}

function loadStateFromStorage(): void {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      syncState = { ...syncState, ...saved, status: 'idle' }
    }
  } catch {
    // ignore
  }
  
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (raw) {
      syncLog = JSON.parse(raw)
    }
  } catch {
    // ignore
  }
}

function saveStateToStorage(): void {
  try {
    const { status, ...stateToSave } = syncState
    localStorage.setItem(STATE_KEY, JSON.stringify(stateToSave))
  } catch {
    // ignore
  }
  
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(syncLog.slice(-100)))
  } catch {
    // ignore
  }
}

function addLog(type: SyncLogEntry['type'], message: string): void {
  const entry: SyncLogEntry = {
    timestamp: Date.now(),
    type,
    message,
  }
  syncLog.push(entry)
  if (syncLog.length > 200) {
    syncLog = syncLog.slice(-200)
  }
  notifyLogListeners()
  saveStateToStorage()
}

function setState(partial: Partial<SyncState>): void {
  syncState = { ...syncState, ...partial }
  notifyStateListeners()
  saveStateToStorage()
}

function notifyStateListeners(): void {
  stateListeners.forEach((listener) => listener(syncState))
}

function notifyLogListeners(): void {
  logListeners.forEach((listener) => listener(syncLog))
}

export function subscribeSyncState(listener: (state: SyncState) => void): () => void {
  stateListeners.add(listener)
  listener(syncState)
  return () => stateListeners.delete(listener)
}

export function subscribeSyncLog(listener: (logs: SyncLogEntry[]) => void): () => void {
  logListeners.add(listener)
  listener(syncLog)
  return () => logListeners.delete(listener)
}

export function getSyncState(): SyncState {
  return { ...syncState }
}

export function getSyncLog(): SyncLogEntry[] {
  return [...syncLog]
}

function getWorkFilename(work: { id: string; name?: string }): string {
  const safeName = (work.name || 'untitled').replace(/[<>:"/\\|?*]/g, '_')
  return `${work.id}_${safeName}.sstory`
}

function parseWorkFilename(filename: string): { workId: string; name: string } | null {
  if (!filename.endsWith('.sstory')) return null
  
  const baseName = filename.slice(0, -7)
  // workId 形如 proj_<时间戳>_<随机串>（含下划线），须按前缀正则切分，
  // 否则所有作品会被折叠成同一个 workId「proj」，导致换机恢复只下载最新一个
  const prefixMatch = baseName.match(/^(proj_\d+_[a-z0-9]+)_(.*)$/)
  if (prefixMatch) {
    return { workId: prefixMatch[1], name: prefixMatch[2] || prefixMatch[1] }
  }
  
  const underscoreIndex = baseName.indexOf('_')
  if (underscoreIndex === -1) {
    return { workId: baseName, name: baseName }
  }
  
  return {
    workId: baseName.slice(0, underscoreIndex),
    name: baseName.slice(underscoreIndex + 1),
  }
}

export function loadWebDAVConfig(): WebDAVConfig | null {
  return loadConfigFromStorage()
}

export function saveWebDAVConfig(config: WebDAVConfig): void {
  saveConfigToStorage(config)
  addLog('info', 'WebDAV 配置已保存')
}

export function clearWebDAVConfig(): void {
  clearConfigFromStorage()
  addLog('info', 'WebDAV 配置已清除')
}

export async function testConnection(config: WebDAVConfig): Promise<boolean> {
  try {
    await webdavList(config, '/')
    return true
  } catch (error) {
    console.error('WebDAV connection test failed:', error)
    return false
  }
}

export async function uploadWork(workId: string): Promise<void> {
  const config = loadConfigFromStorage()
  if (!config) {
    throw new Error('WebDAV 未配置')
  }
  
  const work = await loadWork(workId)
  if (!work) {
    throw new Error('作品不存在')
  }
  
  await webdavEnsureDir(config, SYNC_DIR)
  
  const filename = getWorkFilename(work)
  const path = `${SYNC_DIR}/${filename}`
  
  const jsonStr = JSON.stringify(work)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  
  addLog('info', `上传作品: ${work.name}`)
  await webdavPutFile(config, path, blob)
  addLog('success', `已上传: ${work.name}`)
}

export async function downloadWork(workId: string): Promise<StoredWork | void> {
  const config = loadConfigFromStorage()
  if (!config) {
    throw new Error('WebDAV 未配置')
  }
  
  const files = await webdavList(config, SYNC_DIR)
  const matchingFiles = files.filter((f) => {
    if (f.isDirectory) return false
    const parsed = parseWorkFilename(f.name)
    return parsed?.workId === workId
  })
  
  if (matchingFiles.length === 0) {
    throw new Error('云端未找到该作品')
  }
  
  const remoteFile = matchingFiles.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))[0]
  const path = `${SYNC_DIR}/${remoteFile.name}`
  
  addLog('info', `下载作品: ${remoteFile.name}`)
  const blob = await webdavGetFile(config, path)
  const text = await blob.text()
  const work = JSON.parse(text) as StoredWork
  
  await saveWork(work)
  addLog('success', `已下载: ${work.name}`)
  return work
}

export async function deleteRemoteWork(workId: string): Promise<void> {
  const config = loadConfigFromStorage()
  if (!config) {
    throw new Error('WebDAV 未配置')
  }
  
  const files = await webdavList(config, SYNC_DIR)
  const matchingFiles = files.filter((f) => {
    if (f.isDirectory) return false
    const parsed = parseWorkFilename(f.name)
    return parsed?.workId === workId
  })
  
  for (const file of matchingFiles) {
    const path = `${SYNC_DIR}/${file.name}`
    await webdavDeleteFile(config, path)
    addLog('info', `已删除云端文件: ${file.name}`)
  }
}

export async function syncWorks(): Promise<void> {
  const config = loadConfigFromStorage()
  if (!config) {
    throw new Error('WebDAV 未配置')
  }
  
  setState({ status: 'syncing', error: undefined, progress: 0 })
  addLog('info', '开始同步...')
  
  try {
    await webdavEnsureDir(config, SYNC_DIR)
    
    const localWorks = await getAllWorks()
    let remoteFiles: WebDAVFile[] = []
    
    try {
      remoteFiles = await webdavList(config, SYNC_DIR)
    } catch (error) {
      addLog('error', `获取云端文件列表失败: ${error}`)
      setState({ status: 'error', error: '获取云端文件列表失败' })
      return
    }
    
    const remoteWorks = new Map<string, WebDAVFile>()
    for (const file of remoteFiles) {
      if (file.isDirectory) continue
      const parsed = parseWorkFilename(file.name)
      if (parsed) {
        const existing = remoteWorks.get(parsed.workId)
        if (!existing || (file.lastModified || 0) > (existing.lastModified || 0)) {
          remoteWorks.set(parsed.workId, file)
        }
      }
    }
    
    const localWorkMap = new Map(localWorks.map((w) => [w.id, w]))
    const allWorkIds = new Set([...localWorkMap.keys(), ...remoteWorks.keys()])
    
    const conflicts: string[] = []
    let processed = 0
    const total = allWorkIds.size
    
    for (const workId of allWorkIds) {
      const localWork = localWorkMap.get(workId)
      const remoteFile = remoteWorks.get(workId)
      
      processed++
      setState({ 
        progress: Math.round((processed / total) * 100),
        currentFile: localWork?.name || remoteFile?.name || workId,
      })
      
      if (localWork && !remoteFile) {
        try {
          addLog('info', `上传新作品: ${localWork.name}`)
          await uploadWork(workId)
          syncMarkers[workId] = { localUpdatedAt: localWork.updatedAt || Date.now(), remoteModified: Date.now() }
        } catch (error) {
          addLog('error', `上传失败 ${localWork.name}: ${error}`)
        }
      } else if (!localWork && remoteFile) {
        try {
          addLog('info', `下载新作品: ${remoteFile.name}`)
          const downloaded = await downloadWork(workId)
          if (downloaded) {
            syncMarkers[workId] = {
              localUpdatedAt: downloaded.updatedAt || remoteFile.lastModified || Date.now(),
              remoteModified: remoteFile.lastModified || Date.now(),
            }
          }
        } catch (error) {
          addLog('error', `下载失败 ${remoteFile.name}: ${error}`)
        }
      } else if (localWork && remoteFile) {
        const localTime = localWork.updatedAt || 0
        const remoteTime = remoteFile.lastModified || 0
        const marker = syncMarkers[workId]

        // 冲突检测：本地与云端都在上次同步后被修改（双向改动）。
        // 此时不能按 last-write-wins 静默覆盖任意一侧，暂停自动合并交给用户选择。
        // （无基线标记说明是首次同步，仅按 updatedAt 合并，并建立基线）
        if (marker && localTime > marker.localUpdatedAt && remoteTime > marker.remoteModified) {
          conflicts.push(workId)
          addLog('warning', `检测到冲突: ${localWork.name}`)
          continue
        }

        // 不再用时间差窗口静默跳过：若本地与云端更新时间接近但内容不同，
        // 直接跳过会丢更新（本地改动可能被云端旧版本覆盖）。
        // 一律按 updatedAt 决定方向（last-write-wins），相等时视为一致无需操作。
        if (localTime > remoteTime) {
          try {
            addLog('info', `本地更新，上传: ${localWork.name}`)
            await uploadWork(workId)
            // 上传后云端文件 lastModified 由服务器写入，此处用本地上传完成时间近似基线
            syncMarkers[workId] = { localUpdatedAt: localWork.updatedAt || Date.now(), remoteModified: Date.now() }
          } catch (error) {
            addLog('error', `上传失败 ${localWork.name}: ${error}`)
          }
        } else if (remoteTime > localTime) {
          try {
            addLog('info', `云端更新，下载: ${localWork.name}`)
            const downloaded = await downloadWork(workId)
            if (downloaded) {
              syncMarkers[workId] = {
                localUpdatedAt: downloaded.updatedAt || remoteTime,
                remoteModified: remoteTime,
              }
            }
          } catch (error) {
            addLog('error', `下载失败 ${localWork.name}: ${error}`)
          }
        }
      }
    }

    // 清理已删除作品的同步基线，避免无限增长
    for (const workId of Object.keys(syncMarkers)) {
      if (!allWorkIds.has(workId)) {
        delete syncMarkers[workId]
      }
    }
    saveSyncMarkers()
    
    setState({
      status: conflicts.length > 0 ? 'conflict' : 'success',
      lastSyncTime: Date.now(),
      conflicts,
      progress: undefined,
      currentFile: undefined,
    })
    
    if (conflicts.length > 0) {
      addLog('warning', `同步完成，${conflicts.length} 个冲突需要处理`)
    } else {
      addLog('success', '同步完成')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    addLog('error', `同步失败: ${message}`)
    setState({ status: 'error', error: message, progress: undefined, currentFile: undefined })
    throw error
  }
}

export async function resolveConflict(
  workId: string,
  choose: 'local' | 'remote' | 'both'
): Promise<void> {
  const config = loadConfigFromStorage()
  if (!config) {
    throw new Error('WebDAV 未配置')
  }
  
  const localWork = await loadWork(workId)
  
  if (choose === 'local') {
    await uploadWork(workId)
    syncMarkers[workId] = { localUpdatedAt: localWork?.updatedAt || Date.now(), remoteModified: Date.now() }
    addLog('success', `冲突已解决，保留本地版本: ${localWork?.name || workId}`)
  } else if (choose === 'remote') {
    const downloaded = await downloadWork(workId)
    if (downloaded) {
      syncMarkers[workId] = { localUpdatedAt: downloaded.updatedAt || Date.now(), remoteModified: Date.now() }
    }
    addLog('success', `冲突已解决，保留云端版本: ${workId}`)
  } else if (choose === 'both') {
    if (localWork) {
      const newWork: StoredWork = {
        ...localWork,
        id: `${workId}_remote_${Date.now()}`,
        name: `${localWork.name} (云端副本)`,
      }
      await saveWork(newWork)
      await uploadWork(workId)
      syncMarkers[workId] = { localUpdatedAt: localWork.updatedAt || Date.now(), remoteModified: Date.now() }
      addLog('success', `冲突已解决，两个版本都保留`)
    }
  }
  saveSyncMarkers()
  
  const newConflicts = syncState.conflicts.filter((id) => id !== workId)
  setState({
    conflicts: newConflicts,
    status: newConflicts.length > 0 ? 'conflict' : 'idle',
  })
}

loadStateFromStorage()
loadSyncMarkers()
