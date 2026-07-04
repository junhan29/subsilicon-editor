export type PerformanceMode = 'normal' | 'large' | 'huge'

export function getPerformanceMode(nodeCount: number): PerformanceMode {
  if (nodeCount > 500) return 'huge'
  if (nodeCount > 200) return 'large'
  return 'normal'
}

// 性能配置矩阵
export const PERFORMANCE_CONFIG: Record<PerformanceMode, {
  panOnDrag: number[]
  selectNodesOnDrag: boolean
  elevateEdgesOnSelect: boolean
  elevateNodesOnSelect: boolean
  animationDuration: number
  miniMapVisible: boolean
  miniMapPannable: boolean
  miniMapZoomable: boolean
  autoSaveInterval: number    // 毫秒
  snapshotCount: number
}> = {
  normal: {
    panOnDrag: [1],
    selectNodesOnDrag: true,
    elevateEdgesOnSelect: true,
    elevateNodesOnSelect: true,
    animationDuration: 300,
    miniMapVisible: true,
    miniMapPannable: true,
    miniMapZoomable: true,
    autoSaveInterval: 30000,
    snapshotCount: 3,
  },
  large: {
    panOnDrag: [1, 2],
    selectNodesOnDrag: false,
    elevateEdgesOnSelect: false,
    elevateNodesOnSelect: false,
    animationDuration: 150,
    miniMapVisible: true,
    miniMapPannable: false,
    miniMapZoomable: false,
    autoSaveInterval: 60000,
    snapshotCount: 2,
  },
  huge: {
    panOnDrag: [1, 2],
    selectNodesOnDrag: false,
    elevateEdgesOnSelect: false,
    elevateNodesOnSelect: false,
    animationDuration: 100,
    miniMapVisible: false,      // 500+ 节点时 MiniMap 变成噪点图，关掉
    miniMapPannable: false,
    miniMapZoomable: false,
    autoSaveInterval: 120000,   // 2 分钟自动保存一次
    snapshotCount: 1,
  },
}

// 获取存储空间使用情况
export async function getStorageUsage(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    }
  }
  return { used: 0, quota: 0 }
}
