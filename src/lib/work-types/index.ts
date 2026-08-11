/**
 * 内置作品类型注册入口
 *
 * 应用启动时调用 registerBuiltinWorkTypes() 注册所有内置类型适配器。
 * 社区类型可通过 registerWorkType() 在插件中扩展。
 */

import { registerWorkType } from '@editor/lib/work-registry'
import { interactiveNarrativeAdapter } from '@editor/lib/work-types/interactive-narrative'
import { novelAdapter } from '@editor/lib/work-types/novel-adapter'
import { videoAdapter } from '@editor/lib/work-types/video-adapter'
import { comicAdapter } from '@editor/lib/work-types/comic-adapter'

let registered = false

/** 注册所有内置作品类型（幂等） */
export function registerBuiltinWorkTypes(): void {
  if (registered) return
  registered = true
  registerWorkType(interactiveNarrativeAdapter)
  registerWorkType(novelAdapter)
  registerWorkType(videoAdapter)
  registerWorkType(comicAdapter)
}
