/** 临时验证：导出物内嵌脚本语法 + 表达式解析器运行时行为（中文变量 / 多参函数 / 逗号 token） */
import { beforeAll, describe, expect, it } from 'vitest'
import { exportToStoryHTML } from '../export-story-html'
import type { StoryGraph, StoryNode } from '@editor/types/editor'
import type { MonetizationConfig } from '../work-monetization'

function makeNode(id: string, type: string = 'dialogue', data: Record<string, unknown> = {}): StoryNode {
  return { id, type: type as any, position: { x: 0, y: 0 }, data }
}

function makeGraph(): StoryGraph {
  return {
    title: '验证故事',
    description: '验证',
    templateId: 'custom',
    characters: [],
    variables: [
      { id: 'v1', name: '好感度', initialValue: '0', defaultValue: '0', type: 'number' },
    ],
    nodes: [
      makeNode('n1', 'dialogue', { text: '开始', characterName: '旁白' }),
      makeNode('n2', 'condition', { expression: '好感度 > 3' }),
      makeNode('n3', 'random', { expression: 'RANDOM(1, 10) > 5' }),
      makeNode('n4', 'ending', { text: '结局', title: '结局', endingType: 'good' }),
      makeNode('n5', 'jump', { targetNodeId: 'n4' }),
      makeNode('n6', 'gather'),
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n5' },
      { id: 'e4', source: 'n5', target: 'n6' },
      { id: 'e5', source: 'n6', target: 'n4' },
    ],
    settings: { title: '验证故事', tags: [] },
    assets: { images: [], audios: [], fonts: [] },
  }
}

const monetization: MonetizationConfig = {
  enabled: true,
  granularity: 'whole',
  paymentMethod: 'wechat_manual',
  paidNodes: ['n3'],
  price: 9.9,
  workId: 'work_validate',
}

describe('导出物脚本完整性（N5 验证）', () => {
  let html = ''

  beforeAll(async () => {
    const result = await exportToStoryHTML(makeGraph(), {
      unlockMode: 'offline',
      price: 9.9,
      freePreview: 0,
      workId: 'work_validate',
      customApiUrl: '',
      offlineCodes: [
        { codeHash: 'a'.repeat(64), maskedKeyBase64: 'masked-key' },
      ],
      keyBase64: undefined,
    })
    html = result.html
  })

  it('导出物包含表达式解析器', () => {
    expect(html).toContain('class ExpressionParser')
  })

  it('解析器正则落盘为单反斜杠（中文变量可匹配）', () => {
    // 若为双反斜杠 \\u00C0，则运行时正则不匹配中文 → 中文变量 tokenize 失败
    expect(html).toContain('/[a-zA-Z_\\u00C0-\\uFFFF]/')
    expect(html).not.toContain('\\\\u00C0')
  })

  it('解析器包含 COMMA token（多参函数 RANDOM(1,10) 可用）', () => {
    expect(html).toContain("type: 'COMMA'")
  })

  it('内嵌脚本可编译（new Function 语法检查）', () => {
    // 提取所有 <script> 内容做语法检查
    const scripts: string[] = []
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const body = m[1]
      if (body.trim().startsWith('import')) continue // module script
      scripts.push(body)
    }
    expect(scripts.length).toBeGreaterThan(0)
    for (const s of scripts) {
      expect(() => new Function(s)).not.toThrow()
    }
  })

  it('导出物不内嵌明文离线码（只含 codeHash）', () => {
    // 明文码格式 SUBSL-UNLOCK- 不应出现
    expect(html).not.toContain('SUBSL-UNLOCK-')
    expect(html).toContain('codeHash')
  })
})

describe('导出物离线解锁端到端（N1 验证）', () => {
  it('生成端 codeHash 与导出物内嵌值一致，且运行端可匹配', async () => {
    // 生成真实离线码（与导出对话框同路径）
    const { generateOfflineUnlockCodes, buildOfflineCodesForExport } = await import('../work-monetization')
    const fakeKey = btoa('fakekey-0123456789abcdef'.padEnd(32, 'x'))
    const codes = await generateOfflineUnlockCodes(3, fakeKey)
    const exportEntries = await buildOfflineCodesForExport(codes)

    // 用真实码导出
    const result = await exportToStoryHTML(makeGraph(), {
      unlockMode: 'offline',
      price: 9.9,
      freePreview: 0,
      workId: 'work_validate',
      customApiUrl: '',
      offlineCodes: exportEntries,
      keyBase64: undefined,
    })
    const html = result.html

    // 导出物内嵌的 codeHash 必须等于生成端 buildOfflineCodesForExport 的输出
    for (const entry of exportEntries) {
      expect(html).toContain(entry.codeHash)
    }

    // 运行端 tryOfflineUnlock 的哈希逻辑（sha256 + hex）应与生成端一致
    const sha256hex = async (s: string) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
    // buildOfflineCodesForExport 按顺序处理 codes，逐项比对 codeHash = SHA256(原始码)
    for (let i = 0; i < codes.length; i++) {
      expect(await sha256hex(codes[i].code)).toBe(exportEntries[i].codeHash)
    }
  })
})

describe('解锁通路注入（N2/N4 验证）', () => {
  it('semi_auto 模式默认注入平台解锁端点 apiUrl', async () => {
    const result = await exportToStoryHTML(makeGraph(), {
      unlockMode: 'semi_auto',
      price: 9.9,
      freePreview: 0,
      workId: 'work_validate',
      customApiUrl: '',
      offlineCodes: [],
      keyBase64: undefined,
    })
    // 默认平台端点注入（此前从未注入，半自动解锁无通路）
    expect(result.html).toContain('https://subsilicon.cn/api/story-unlock')
  })

  it('配置自建端点时注入自建 apiUrl（密钥不上传平台）', async () => {
    const result = await exportToStoryHTML(makeGraph(), {
      unlockMode: 'webhook',
      price: 9.9,
      freePreview: 0,
      workId: 'work_validate',
      customApiUrl: 'https://creator.example.com/unlock',
      offlineCodes: [],
      keyBase64: undefined,
    })
    expect(result.html).toContain('https://creator.example.com/unlock')
  })

  it('免费导出内嵌 freeKey（免费阅读可解密直启）', async () => {
    const result = await exportToStoryHTML(makeGraph(), {
      unlockMode: 'manual',
      price: 0,
      freePreview: 0,
      workId: 'work_validate',
      customApiUrl: '',
      offlineCodes: [],
      keyBase64: undefined,
    })
    expect(result.html).toContain('freeKey')
    expect(result.keyBase64).toBeTruthy()
  })
})

describe('导出物 XSS 防护（</script> 注入转义）', () => {
  it('wechatQRCode 含 </script> 时字段被转义为 \\u003c，全部 script 块仍可编译', async () => {
    const payload = 'https://x.test/q</script><script>alert(1)</script>'
    const result = await exportToStoryHTML(makeGraph(), {
      unlockMode: 'manual',
      price: 9.9,
      freePreview: 0,
      workId: 'work_validate',
      customApiUrl: '',
      offlineCodes: [],
      keyBase64: undefined,
      wechatQRCode: payload,
      alipayQRCode: payload,
      contactInfo: '<b>联系我</b>',
    })
    const html = result.html
    // 注入字段经 safeJSON 转义为 \u003c，产物中不含裸 </script> 注入载荷
    expect(html).toContain('\\u003c/script')
    expect(html).not.toContain('</script><script>alert(1)')
    // 全部 script 块语法检查仍通过
    const scripts: string[] = []
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const body = m[1]
      if (body.trim().startsWith('import')) continue
      scripts.push(body)
    }
    expect(scripts.length).toBeGreaterThan(0)
    for (const s of scripts) {
      expect(() => new Function(s)).not.toThrow()
    }
  })
})
