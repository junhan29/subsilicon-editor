import type { StoryGraph } from '@editor/types/editor'
import type { MonetizationConfig, HTMLMonetizationConfig } from '@editor/lib/work-monetization'
import {
  hashSeedKey,
  UNLOCK_STATE_KEY_PREFIX,
  UNLOCK_CODE_PREFIX,
  UNLOCK_REQUEST_PREFIX,
} from '@editor/lib/work-monetization'
import { getAsset } from '@editor/lib/local-db'

const ENC_PREFIX = '__ENC__:'

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function extractHashFromBlobURL(url: string): string | null {
  const match = url.match(/^blob:[^/]+\/\/[^/]+\/(.+)$/)
  if (match) return match[1]
  const lastSlash = url.lastIndexOf('/')
  if (lastSlash !== -1) return url.slice(lastSlash + 1)
  return null
}

async function fetchBlobFromURL(url: string): Promise<Blob | null> {
  // 尝试从 IndexedDB 通过 hash 获取
  const hash = extractHashFromBlobURL(url)
  if (hash) {
    try {
      const asset = await getAsset(hash)
      if (asset) return asset.blob
    } catch {
    }
  }
  // 回退：直接 fetch blob URL（适用于 URL.createObjectURL 生成的标准 blob URL）
  try {
    const response = await fetch(url)
    if (response.ok) return await response.blob()
  } catch {
  }
  return null
}

function collectBlobURLs(obj: unknown, urls: Set<string>): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'string' && item.startsWith('blob:')) {
        urls.add(item)
      } else {
        collectBlobURLs(item, urls)
      }
    }
  } else {
    const record = obj as Record<string, unknown>
    for (const key in record) {
      const value = record[key]
      if (typeof value === 'string' && value.startsWith('blob:')) {
        urls.add(value)
      } else {
        collectBlobURLs(value, urls)
      }
    }
  }
}

function replaceBlobURLs(obj: unknown, urlMap: Map<string, string>): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string' && obj[i].startsWith('blob:')) {
        obj[i] = urlMap.get(obj[i]) || obj[i]
      } else {
        replaceBlobURLs(obj[i], urlMap)
      }
    }
  } else {
    const record = obj as Record<string, unknown>
    for (const key in record) {
      const value = record[key]
      if (typeof value === 'string' && value.startsWith('blob:')) {
        record[key] = urlMap.get(value) || value
      } else {
        replaceBlobURLs(value, urlMap)
      }
    }
  }
}

export async function embedAssets(graph: StoryGraph): Promise<StoryGraph> {
  // 深拷贝，避免修改原始 graph
  const newGraph: StoryGraph = JSON.parse(JSON.stringify(graph))

  // 递归收集所有 blob: URL
  const blobURLs = new Set<string>()
  collectBlobURLs(newGraph, blobURLs)

  if (blobURLs.size === 0) return newGraph

  // 批量获取 Blob 并转为 data URL（控制并发避免内存峰值）
  const urlMap = new Map<string, string>()
  const batchSize = 5
  const blobURLArray = Array.from(blobURLs)

  for (let i = 0; i < blobURLArray.length; i += batchSize) {
    const batch = blobURLArray.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (url) => {
        const blob = await fetchBlobFromURL(url)
        if (blob) {
          try {
            const dataURL = await blobToDataURL(blob)
            urlMap.set(url, dataURL)
          } catch {
            // 转换失败，跳过该素材
          }
        }
      })
    )
    // 让出主线程，避免长时间阻塞 UI
    if (i + batchSize < blobURLArray.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // 递归替换所有 blob: URL
  replaceBlobURLs(newGraph, urlMap)

  return newGraph
}

function encodeBase64UTF8(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
}

export function encryptPaidContent(
  graph: StoryGraph,
  monetization: MonetizationConfig
): StoryGraph {
  const newGraph: StoryGraph = JSON.parse(JSON.stringify(graph))

  if (!monetization.enabled || !monetization.paidNodes || monetization.paidNodes.length === 0) {
    return newGraph
  }

  const freePreviewNodes = monetization.freePreviewNodes || []
  const sensitiveFields = ['text', 'title', 'description', 'prompt', 'subtitle']

  for (const node of newGraph.nodes) {
    // 只加密付费节点（排除免费预览节点）
    if (!monetization.paidNodes.includes(node.id)) continue
    if (freePreviewNodes.includes(node.id)) continue

    const data = node.data
    if (!data) continue

    // 加密敏感文本字段
    for (const field of sensitiveFields) {
      const value = data[field]
      if (typeof value === 'string' && value && !value.startsWith(ENC_PREFIX)) {
        data[field] = ENC_PREFIX + encodeBase64UTF8(value)
      }
    }

    // 加密 options 数组中的 text 字段
    const options = data.options
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (opt && typeof opt === 'object') {
          const optRecord = opt as Record<string, unknown>
          const textValue = optRecord.text
          if (typeof textValue === 'string' && textValue && !textValue.startsWith(ENC_PREFIX)) {
            optRecord.text = ENC_PREFIX + encodeBase64UTF8(textValue)
          }
        }
      }
    }
  }

  return newGraph
}

function buildHTMLTemplate(params: {
  title: string
  graphJSON: string
  monetization?: HTMLMonetizationConfig
}): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
    #root { max-width: 800px; margin: 0 auto; padding: 20px; min-height: 100vh; }
    .node { background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #334155; }
    .node-dialogue { border-left: 3px solid #3b82f6; }
    .node-choice { border-left: 3px solid #f59e0b; }
    .node-ending { border-left: 3px solid #22c55e; }
    .node-cg { border-left: 3px solid #a855f7; }
    .node-unlock { border-left: 3px solid #ef4444; }
    .node-title { font-size: 12px; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; }
    .node-text { font-size: 16px; line-height: 1.6; }
    .choices { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .choice-btn { background: #334155; border: 1px solid #475569; border-radius: 8px; padding: 10px 16px; color: #e2e8f0; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s; }
    .choice-btn:hover { background: #475569; border-color: #6366f1; }
    .cg-container { position: relative; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
    .cg-container img, .cg-container video { width: 100%; display: block; }
    .ending-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 8px; }
    .ending-good { background: #166534; color: #4ade80; }
    .ending-bad { background: #7f1d1d; color: #fca5a5; }
    .ending-neutral { background: #334155; color: #94a3b8; }
    .ending-secret { background: #4c1d95; color: #c084fc; }
    .unlock-box { background: #451a03; border: 1px solid #92400e; border-radius: 12px; padding: 16px; text-align: center; }
    .unlock-price { font-size: 24px; font-weight: bold; color: #f59e0b; }
    .scene-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; opacity: 0.3; }
    .character-sprite { position: fixed; bottom: 0; z-index: 1; max-height: 60vh; }
    .character-sprite.left { left: 10%; }
    .character-sprite.center { left: 50%; transform: translateX(-50%; }
    .character-sprite.right { right: 10%; }
    @keyframes typewriter { from { width: 0; } to { width: 100%; } }
    .typewriter { overflow: hidden; white-space: nowrap; animation: typewriter 2s steps(40) forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .fade-in { animation: fadeIn 0.5s ease-in; }

    /* 付费锁屏样式 */
    #paywall-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.95); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .paywall-card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .paywall-icon { width: 48px; height: 48px; margin: 0 auto 16px; color: #f59e0b; }
    .paywall-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .paywall-desc { font-size: 14px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5; }
    .paywall-price { font-size: 32px; font-weight: 700; color: #f59e0b; margin-bottom: 24px; }
    .paywall-divider { height: 1px; background: #334155; margin: 24px 0; }
    .paywall-section-title { font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 12px; }
    .paywall-qr-container { margin-bottom: 16px; }
    .paywall-qr-container img { max-width: 200px; border-radius: 12px; border: 2px solid #334155; }
    .paywall-contact { font-size: 12px; color: #94a3b8; margin-top: 8px; }
    .paywall-platform-btn { display: inline-block; margin: 8px 8px 8px 0; padding: 10px 20px; background: #3b82f6; color: #fff; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; transition: background 0.2s; }
    .paywall-platform-btn:hover { background: #2563eb; }
    .paywall-input { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; margin-bottom: 12px; }
    .paywall-input:focus { outline: none; border-color: #3b82f6; }
    .paywall-btn { width: 100%; padding: 12px; background: #f59e0b; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-bottom: 12px; }
    .paywall-btn:hover { background: #d97706; }
    .paywall-btn:disabled { background: #475569; cursor: not-allowed; }
    .paywall-btn-secondary { background: #334155; color: #e2e8f0; }
    .paywall-btn-secondary:hover { background: #475569; }
    .paywall-code-display { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 16px; color: #10b981; margin-bottom: 12px; word-break: break-all; }
    .paywall-success-msg { color: #10b981; font-size: 14px; margin-top: 12px; display: none; }
    .paywall-error-msg { color: #ef4444; font-size: 14px; margin-top: 12px; }
    .paywall-hidden { display: none; }
    .paywall-opvp-desc { font-size: 12px; color: #94a3b8; margin-bottom: 12px; line-height: 1.5; }
    .paywall-opvp-note { font-size: 11px; color: #64748b; margin-top: 8px; text-align: center; }
    .paywall-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .paywall-tab { flex: 1; padding: 10px; background: #334155; border: 1px solid #475569; border-radius: 8px; color: #94a3b8; font-size: 13px; cursor: pointer; transition: all 0.2s; }
    .paywall-tab.active { background: #1e293b; border-color: #3b82f6; color: #e2e8f0; }
  </style>
</head>
<body>
  <div id="root"></div>
  ${params.monetization ? '<div id="paywall-overlay" class="paywall-hidden"></div>' : ''}
  <script>
    window.__STORY_GRAPH__ = ${params.graphJSON};
    ${params.monetization ? `window.__MONETIZATION__ = ${JSON.stringify(params.monetization)};` : ''}
  </script>
  <script>
    // 简易故事运行时
    (function() {
      var graph = window.__STORY_GRAPH__;
      var monetization = window.__MONETIZATION__;
      if (!graph || !graph.nodes) {
        document.getElementById('root').innerHTML = '<p style="text-align:center;padding:40px;">无法加载故事数据</p>';
        return;
      }

      var root = document.getElementById('root');
      var currentNodeId = graph.nodes.find(function(n) { return n.type === 'dialogue' || n.type === 'choice'; })?.id || graph.nodes[0]?.id;

      var UNLOCK_PREFIX = '${UNLOCK_CODE_PREFIX}';
      var REQ_PREFIX = '${UNLOCK_REQUEST_PREFIX}';

      function decryptField(value) {
        if (typeof value !== 'string') return value;
        if (value.indexOf('${ENC_PREFIX}') !== 0) return value;
        try {
          var encoded = value.slice(${ENC_PREFIX.length});
          return decodeURIComponent(escape(atob(encoded)));
        } catch (e) {
          return '[内容已加密]';
        }
      }

      function decryptNodeData(data) {
        if (!data) return {};
        var result = {};
        for (var key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            result[key] = decryptField(data[key]);
          }
        }
        // 解密 options 数组中每个选项的字段
        if (Array.isArray(result.options)) {
          result.options = result.options.map(function(opt) {
            if (opt && typeof opt === 'object') {
              var newOpt = {};
              for (var k in opt) {
                if (Object.prototype.hasOwnProperty.call(opt, k)) {
                  newOpt[k] = decryptField(opt[k]);
                }
              }
              return newOpt;
            }
            return opt;
          });
        }
        return result;
      }

      function getUnlockState() {
        if (!monetization) return { unlockedNodes: [], unlockedChapters: [] };
        try {
          var key = '${UNLOCK_STATE_KEY_PREFIX}' + monetization.workId;
          var data = localStorage.getItem(key);
          return data ? JSON.parse(data) : { unlockedNodes: [], unlockedChapters: [] };
        } catch (e) {
          return { unlockedNodes: [], unlockedChapters: [] };
        }
      }

      function saveUnlockState(nodeId, chapterId) {
        if (!monetization) return;
        var key = '${UNLOCK_STATE_KEY_PREFIX}' + monetization.workId;
        var state = getUnlockState();
        if (nodeId && !state.unlockedNodes.includes(nodeId)) {
          state.unlockedNodes.push(nodeId);
        }
        if (chapterId && !state.unlockedChapters.includes(chapterId)) {
          state.unlockedChapters.push(chapterId);
        }
        localStorage.setItem(key, JSON.stringify(state));
      }

      function isNodeUnlocked(nodeId) {
        if (!monetization) return true;
        var state = getUnlockState();

        // 检查是否在免费预览列表
        if (monetization.freePreviewNodes && monetization.freePreviewNodes.includes(nodeId)) {
          return true;
        }

        // 检查是否已解锁
        if (state.unlockedNodes.includes(nodeId)) {
          return true;
        }

        // 检查所属章节是否已解锁
        if (monetization.paidChapters) {
          var chapter = monetization.paidChapters.find(function(ch) { return ch.nodeIds.includes(nodeId); });
          if (chapter && state.unlockedChapters.includes(chapter.id)) {
            return true;
          }
        }

        // 检查是否在付费节点列表
        return !monetization.paidNodes.includes(nodeId);
      }

      function getNodeChapter(nodeId) {
        if (!monetization || !monetization.paidChapters) return null;
        return monetization.paidChapters.find(function(ch) { return ch.nodeIds.includes(nodeId); });
      }

      function showPaywall(nodeId) {
        if (!monetization) return;

        var chapter = getNodeChapter(nodeId);
        var price = chapter ? chapter.price : monetization.price;
        var title = chapter ? chapter.name : '解锁完整内容';

        var overlay = document.getElementById('paywall-overlay');
        if (!overlay) return;

        var paywallHTML = '<div class="paywall-card">';
        paywallHTML += '<svg class="paywall-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        paywallHTML += '<h2 class="paywall-title">' + title + '</h2>';
        paywallHTML += '<p class="paywall-desc">' + (monetization.freePreviewText || '后续内容需要付费解锁，感谢您的支持！') + '</p>';
        paywallHTML += '<div class="paywall-price">¥' + price.toFixed(2) + '</div>';

        // 支付方式切换
        if (monetization.paymentMethod === 'both') {
          paywallHTML += '<div class="paywall-tabs">';
          paywallHTML += '<button class="paywall-tab active" onclick="switchPaywallTab(\\'wechat\\')">微信收款</button>';
          paywallHTML += '<button class="paywall-tab" onclick="switchPaywallTab(\\'platform\\')">第三方平台</button>';
          paywallHTML += '</div>';
        }

        // 微信收款
        if (monetization.paymentMethod === 'wechat_manual' || monetization.paymentMethod === 'both') {
          paywallHTML += '<div id="paywall-wechat">';
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">扫码支付</p>';
          if (monetization.wechatQRCode) {
            paywallHTML += '<div class="paywall-qr-container"><img src="' + monetization.wechatQRCode + '" alt="收款码" /></div>';
          }
          if (monetization.wechatContact) {
            paywallHTML += '<p class="paywall-contact">微信号：' + monetization.wechatContact + '</p>';
          }
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">支付凭证</p>';
          paywallHTML += '<input type="text" class="paywall-input" id="payment-proof" placeholder="支付单号后 6 位" maxlength="6" />';
          paywallHTML += '<button class="paywall-btn" onclick="generateRequestCode()">生成解锁凭证</button>';
          paywallHTML += '<div id="request-code-display" class="paywall-hidden"><div class="paywall-code-display" id="request-code-value"></div><button class="paywall-btn paywall-btn-secondary" onclick="copyRequestCode()">复制凭证</button></div>';
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">解锁码</p>';
          paywallHTML += '<input type="text" class="paywall-input" id="unlock-code-input" placeholder="粘贴收到的解锁码" />';
          paywallHTML += '<button class="paywall-btn" onclick="verifyUnlock()">解锁</button>';
          paywallHTML += '<p id="unlock-result" class="paywall-hidden"></p>';
          paywallHTML += '</div>';
        }

        // 第三方平台
        if (monetization.paymentMethod === 'third_party' || monetization.paymentMethod === 'both') {
          var displayStyle = monetization.paymentMethod === 'both' ? 'display:none;' : '';
          paywallHTML += '<div id="paywall-platform" style="' + displayStyle + '">';
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">前往平台购买</p>';
          if (monetization.thirdParty) {
            paywallHTML += '<a href="' + monetization.thirdParty.link + '" target="_blank" class="paywall-platform-btn">';
            paywallHTML += monetization.thirdParty.platform === 'afdian' ? '前往爱发电' :
                           monetization.thirdParty.platform === 'mianbaoduo' ? '前往面包多' : '前往购买';
            paywallHTML += '</a>';
            if (monetization.thirdParty.creatorName) {
              paywallHTML += '<p class="paywall-contact">创作者：' + monetization.thirdParty.creatorName + '</p>';
            }
          }
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">支付凭证</p>';
          paywallHTML += '<input type="text" class="paywall-input" id="platform-proof" placeholder="平台订单号后 6 位" maxlength="6" />';
          paywallHTML += '<button class="paywall-btn" onclick="generateRequestCodePlatform()">生成解锁凭证</button>';
          paywallHTML += '<div id="request-code-display-platform" class="paywall-hidden"><div class="paywall-code-display" id="request-code-value-platform"></div><button class="paywall-btn paywall-btn-secondary" onclick="copyRequestCodePlatform()">复制凭证</button></div>';
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">解锁码</p>';
          paywallHTML += '<input type="text" class="paywall-input" id="unlock-code-input-platform" placeholder="粘贴收到的解锁码" />';
          paywallHTML += '<button class="paywall-btn" onclick="verifyUnlockPlatform()">解锁</button>';
          paywallHTML += '<p id="unlock-result-platform" class="paywall-hidden"></p>';
          paywallHTML += '</div>';
        }

        // OPVP 自动验证（开放支付验证协议）
        if (monetization.opvp && monetization.opvp.enabled) {
          var opvpDisplay = (monetization.paymentMethod !== 'third_party' && monetization.paymentMethod !== 'wechat_manual') ? '' : 'display:none;';
          paywallHTML += '<div id="paywall-opvp" style="' + opvpDisplay + '">';
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">自动验证解锁</p>';
          paywallHTML += '<p class="paywall-opvp-desc">使用 ' + (monetization.opvp.platformName || 'OPVP 协议') + ' 订单号自动验证，验证成功立即解锁</p>';
          if (monetization.opvp.purchaseLink) {
            paywallHTML += '<a href="' + monetization.opvp.purchaseLink + '" target="_blank" class="paywall-platform-btn">前往购买</a>';
          }
          paywallHTML += '<div class="paywall-divider"></div>';
          paywallHTML += '<p class="paywall-section-title">订单号</p>';
          paywallHTML += '<input type="text" class="paywall-input" id="opvp-order-id" placeholder="输入完整订单号" />';
          paywallHTML += '<button class="paywall-btn" id="opvp-verify-btn" onclick="verifyWithOPVP()">立即验证解锁</button>';
          paywallHTML += '<div id="opvp-result" class="paywall-hidden"></div>';
          paywallHTML += '<p class="paywall-opvp-note">基于 OPVP 开放协议，安全可靠</p>';
          paywallHTML += '</div>';
        }

        paywallHTML += '</div>';
        overlay.innerHTML = paywallHTML;
        overlay.classList.remove('paywall-hidden');

        // 暂存当前节点 ID
        window.__currentPaidNodeId = nodeId;
        window.__currentChapterId = chapter ? chapter.id : null;
      }

      function hidePaywall() {
        var overlay = document.getElementById('paywall-overlay');
        if (overlay) {
          overlay.classList.add('paywall-hidden');
        }
      }

      // 切换支付方式 Tab
      window.switchPaywallTab = function(tab) {
        var wechatDiv = document.getElementById('paywall-wechat');
        var platformDiv = document.getElementById('paywall-platform');
        var opvpDiv = document.getElementById('paywall-opvp');
        var tabs = document.querySelectorAll('.paywall-tab');

        tabs.forEach(function(t) { t.classList.remove('active'); });

        if (wechatDiv) wechatDiv.style.display = 'none';
        if (platformDiv) platformDiv.style.display = 'none';
        if (opvpDiv) opvpDiv.style.display = 'none';

        if (tab === 'wechat' || tab === 'direct') {
          if (wechatDiv) wechatDiv.style.display = 'block';
          if (tabs[0]) tabs[0].classList.add('active');
        } else if (tab === 'platform') {
          if (platformDiv) platformDiv.style.display = 'block';
          var platformTabIndex = Array.from(tabs).findIndex(function(t) { return t.textContent.includes('平台'); });
          if (platformTabIndex >= 0 && tabs[platformTabIndex]) tabs[platformTabIndex].classList.add('active');
        } else if (tab === 'opvp') {
          if (opvpDiv) opvpDiv.style.display = 'block';
          var opvpTabIndex = Array.from(tabs).findIndex(function(t) { return t.textContent.includes('自动'); });
          if (opvpTabIndex >= 0 && tabs[opvpTabIndex]) tabs[opvpTabIndex].classList.add('active');
        }
      };

      // 生成解锁请求凭证（微信）
      window.generateRequestCode = async function() {
        var proofInput = document.getElementById('payment-proof');
        var proof = proofInput.value.trim();

        if (!proof || proof.length < 6) {
          alert('请输入支付单号后 6 位');
          return;
        }

        try {
          var fingerprint = await generateFingerprint();
          var timestamp = Math.floor(Date.now() / 60000) * 60000;
          var message = monetization.workId + '|' + proof + '|' + fingerprint + '|' + timestamp;
          var signature = await simpleHash(message);
          var requestCode = REQ_PREFIX + signature.slice(0, 8).toUpperCase();

          var display = document.getElementById('request-code-display');
          var valueEl = document.getElementById('request-code-value');
          valueEl.textContent = requestCode;
          display.classList.remove('paywall-hidden');

          window.__lastRequestCode = requestCode;
        } catch (e) {
          alert('生成失败：' + e.message);
        }
      };

      // 生成解锁请求凭证（平台）
      window.generateRequestCodePlatform = async function() {
        var proofInput = document.getElementById('platform-proof');
        var proof = proofInput.value.trim();

        if (!proof || proof.length < 6) {
          alert('请输入平台订单号后 6 位');
          return;
        }

        try {
          var fingerprint = await generateFingerprint();
          var timestamp = Math.floor(Date.now() / 60000) * 60000;
          var message = monetization.workId + '|' + proof + '|' + fingerprint + '|' + timestamp;
          var signature = await simpleHash(message);
          var requestCode = REQ_PREFIX + signature.slice(0, 8).toUpperCase();

          var display = document.getElementById('request-code-display-platform');
          var valueEl = document.getElementById('request-code-value-platform');
          valueEl.textContent = requestCode;
          display.classList.remove('paywall-hidden');

          window.__lastRequestCodePlatform = requestCode;
        } catch (e) {
          alert('生成失败：' + e.message);
        }
      };

      // 设备指纹生成（简化）
      async function generateFingerprint() {
        var parts = [
          navigator.userAgent,
          navigator.language,
          screen.width + 'x' + screen.height,
          new Date().getTimezoneOffset().toString()
        ];
        var combined = parts.join('|');
        var hash = await simpleHash(combined);
        return hash.slice(0, 16).toUpperCase();
      }

      // SHA-256 哈希（浏览器原生 SubtleCrypto）
      async function simpleHash(message) {
        var encoder = new TextEncoder();
        var data = encoder.encode(message);
        var hashBuffer = await crypto.subtle.digest('SHA-256', data);
        var hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      }

      /**
       * 验证解锁码与请求凭证的绑定关系
       * 解锁码前 8 位 = SHA256(requestCode + '|' + workId) 前 8 位
       * 这是公开可验证的，无需种子密钥
       */
      async function verifyUnlockCodeBinding(unlockCode, requestCode, workId) {
        if (!unlockCode.startsWith(UNLOCK_PREFIX)) return false;
        var hmacPart = unlockCode.slice(UNLOCK_PREFIX.length);
        if (!/^[A-F0-9]{16}$/i.test(hmacPart)) return false;

        if (!requestCode || !requestCode.startsWith(REQ_PREFIX)) return false;

        // 解锁码前 8 位 = SHA256(requestCode + '|' + workId) 前 8 位
        var expectedPrefix = await simpleHash(requestCode + '|' + workId);
        return hmacPart.slice(0, 8).toUpperCase() === expectedPrefix.slice(0, 8).toUpperCase();
      }

      // 复制解锁凭证
      window.copyRequestCode = function() {
        var code = document.getElementById('request-code-value').textContent;
        navigator.clipboard.writeText(code).then(function() {
          alert('已复制到剪贴板');
        }).catch(function() {
          var textarea = document.createElement('textarea');
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          alert('已复制到剪贴板');
        });
      };

      window.copyRequestCodePlatform = function() {
        var code = document.getElementById('request-code-value-platform').textContent;
        navigator.clipboard.writeText(code).then(function() {
          alert('已复制到剪贴板');
        }).catch(function() {
          var textarea = document.createElement('textarea');
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          alert('已复制到剪贴板');
        });
      };

      // 验证解锁码（微信）
      window.verifyUnlock = async function() {
        var codeInput = document.getElementById('unlock-code-input');
        var code = codeInput.value.trim();
        var resultEl = document.getElementById('unlock-result');

        // 检查是否已生成请求凭证
        var requestCode = window.__lastRequestCode;
        if (!requestCode) {
          resultEl.textContent = '请先生成解锁凭证';
          resultEl.className = 'paywall-error-msg';
          resultEl.style.display = 'block';
          return;
        }

        // 验证解锁码与请求凭证的绑定关系
        var valid = await verifyUnlockCodeBinding(code, requestCode, monetization.workId);

        if (valid) {
          saveUnlockState(window.__currentPaidNodeId, window.__currentChapterId);
          resultEl.textContent = '解锁成功！';
          resultEl.className = 'paywall-success-msg';
          resultEl.style.display = 'block';

          setTimeout(function() {
            hidePaywall();
            renderNode(findNode(window.__currentPaidNodeId));
          }, 1000);
        } else {
          resultEl.textContent = '解锁码无效或与凭证不匹配';
          resultEl.className = 'paywall-error-msg';
          resultEl.style.display = 'block';
        }
      };

      // 验证解锁码（平台）
      window.verifyUnlockPlatform = async function() {
        var codeInput = document.getElementById('unlock-code-input-platform');
        var code = codeInput.value.trim();
        var resultEl = document.getElementById('unlock-result-platform');

        // 检查是否已生成请求凭证
        var requestCode = window.__lastRequestCodePlatform;
        if (!requestCode) {
          resultEl.textContent = '请先生成解锁凭证';
          resultEl.className = 'paywall-error-msg';
          resultEl.style.display = 'block';
          return;
        }

        // 验证解锁码与请求凭证的绑定关系
        var valid = await verifyUnlockCodeBinding(code, requestCode, monetization.workId);

        if (valid) {
          saveUnlockState(window.__currentPaidNodeId, window.__currentChapterId);
          resultEl.textContent = '解锁成功！';
          resultEl.className = 'paywall-success-msg';
          resultEl.style.display = 'block';

          setTimeout(function() {
            hidePaywall();
            renderNode(findNode(window.__currentPaidNodeId));
          }, 1000);
        } else {
          resultEl.textContent = '解锁码无效或与凭证不匹配';
          resultEl.className = 'paywall-error-msg';
          resultEl.style.display = 'block';
        }
      };

      // OPVP 自动验证解锁
      window.verifyWithOPVP = async function() {
        if (!monetization.opvp || !monetization.opvp.enabled) return;

        var orderInput = document.getElementById('opvp-order-id');
        var orderId = orderInput.value.trim();
        var resultEl = document.getElementById('opvp-result');
        var verifyBtn = document.getElementById('opvp-verify-btn');

        if (!orderId) {
          resultEl.textContent = '请输入订单号';
          resultEl.className = 'paywall-error-msg';
          resultEl.style.display = 'block';
          return;
        }

        // 禁用按钮，显示加载状态
        verifyBtn.disabled = true;
        verifyBtn.textContent = '验证中...';
        resultEl.style.display = 'none';

        try {
          var timestamp = Date.now();
          var signatureBase = orderId + '|' + monetization.opvp.workId + '|' + timestamp;
          var signature = await simpleHash(signatureBase);

          var response = await fetch(monetization.opvp.verifierUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              protocolVersion: '1.0',
              orderId: orderId,
              workId: monetization.opvp.workId,
              creatorId: monetization.opvp.creatorId || '',
              amount: monetization.price,
              currency: 'CNY',
              timestamp: timestamp,
              signature: signature.slice(0, 32),
            }),
          });

          var data = await response.json();

          if (data.verified) {
            // 验证成功，直接解锁
            saveUnlockState(window.__currentPaidNodeId, window.__currentChapterId);
            resultEl.textContent = '验证成功！正在解锁...';
            resultEl.className = 'paywall-success-msg';
            resultEl.style.display = 'block';

            setTimeout(function() {
              hidePaywall();
              renderNode(findNode(window.__currentPaidNodeId));
            }, 1000);
          } else {
            resultEl.textContent = data.message || '验证失败，请检查订单号是否正确';
            resultEl.className = 'paywall-error-msg';
            resultEl.style.display = 'block';
          }
        } catch (e) {
          resultEl.textContent = '验证服务连接失败，请稍后重试';
          resultEl.className = 'paywall-error-msg';
          resultEl.style.display = 'block';
        } finally {
          verifyBtn.disabled = false;
          verifyBtn.textContent = '立即验证解锁';
        }
      };

      function findNode(id) {
        return graph.nodes.find(function(n) { return n.id === id; });
      }

      function getEdgesFrom(nodeId) {
        return (graph.edges || []).filter(function(e) { return e.source === nodeId; });
      }

      function renderNode(node) {
        if (!node) {
          root.innerHTML = '<div class="node"><p class="node-text">故事结束</p></div>';
          return;
        }

        // 检查付费状态
        if (!isNodeUnlocked(node.id)) {
          currentNodeId = node.id;
          showPaywall(node.id);
          return;
        }

        currentNodeId = node.id;
        // 解密节点数据（付费内容在导出时被 Base64 编码，解锁后才能看到明文）
        var data = decryptNodeData(node.data || {});

        switch (node.type) {
          case 'dialogue':
            renderDialogue(node, data);
            break;
          case 'choice':
            renderChoice(node, data);
            break;
          case 'ending':
            renderEnding(node, data);
            break;
          case 'cg':
            renderCG(node, data);
            break;
          case 'unlock':
            renderUnlock(node, data);
            break;
          case 'jump':
            renderJump(node, data);
            break;
          case 'gather':
            renderGather(node, data);
            break;
          case 'condition':
            renderCondition(node, data);
            break;
          case 'random':
            renderRandom(node, data);
            break;
          default:
            root.innerHTML = '<div class="node"><p class="node-text">未知节点类型</p></div>';
        }
      }

      function renderDialogue(node, data) {
        var characterName = data.characterName || data.characterId || '???';
        var text = data.text || '';
        var bgImage = data.backgroundImage || '';
        var textAnim = data.textAnimation || 'fade-in';

        var html = '';
        if (bgImage) html += '<img class="scene-bg" src="' + bgImage + '" alt="" />';
        if (data.characterSprite) {
          var pos = data.spritePosition || 'center';
          html += '<img class="character-sprite ' + pos + '" src="' + data.characterSprite + '" alt="" />';
        }
        html += '<div class="node node-dialogue ' + textAnim + '">';
        html += '<div class="node-title">' + characterName + '</div>';
        html += '<div class="node-text">' + text + '</div>';
        html += '</div>';

        var edges = getEdgesFrom(node.id);
        if (edges.length > 0) {
          html += '<div class="choices"><button class="choice-btn" onclick="continueStory()">继续</button></div>';
        }

        root.innerHTML = html;
        window.continueStory = function() {
          var nextEdges = getEdgesFrom(currentNodeId);
          if (nextEdges.length > 0) {
            renderNode(findNode(nextEdges[0].target));
          }
        };
      }

      function renderChoice(node, data) {
        var options = data.options || [];
        var prompt = data.prompt || '你的选择是？';

        var html = '<div class="node node-choice">';
        html += '<div class="node-title">选择</div>';
        html += '<div class="node-text">' + prompt + '</div>';
        html += '<div class="choices">';
        options.forEach(function(opt, i) {
          html += '<button class="choice-btn" onclick="selectChoice(' + i + ')">' + (opt.text || '选项 ' + (i + 1)) + '</button>';
        });
        html += '</div></div>';

        root.innerHTML = html;
        window.selectChoice = function(index) {
          var edges = getEdgesFrom(currentNodeId);
          var sourceHandle = edges.find(function(e) { return e.sourceHandle === (options[index]?.id || 'opt-' + index); });
          var targetId = sourceHandle ? sourceHandle.target : edges[index]?.target;
          if (targetId) renderNode(findNode(targetId));
        };
      }

      function renderEnding(node, data) {
        var type = data.endingType || 'neutral';
        var typeClass = 'ending-' + type;
        var typeLabels = { good: '好结局', bad: '坏结局', neutral: '普通结局', secret: '隐藏结局' };

        var html = '<div class="node node-ending">';
        html += '<span class="ending-badge ' + typeClass + '">' + (typeLabels[type] || type) + '</span>';
        html += '<div class="node-title">' + (data.title || '结局') + '</div>';
        html += '<div class="node-text">' + (data.text || '') + '</div>';
        html += '</div>';

        root.innerHTML = html;
      }

      function renderCG(node, data) {
        var isVideo = data.mediaType === 'video';
        var url = data.url || data.localFile || '';

        var html = '<div class="node node-cg">';
        html += '<div class="node-title">CG 过场</div>';
        if (url) {
          html += '<div class="cg-container">';
          if (isVideo) {
            html += '<video src="' + url + '" controls autoplay></video>';
          } else {
            html += '<img src="' + url + '" alt="" />';
          }
          html += '</div>';
        }
        html += '<div class="node-text">' + (data.title || '') + '</div>';
        html += '</div>';

        var edges = getEdgesFrom(node.id);
        if (edges.length > 0) {
          html += '<div class="choices"><button class="choice-btn" onclick="continueStory()">继续</button></div>';
        }

        root.innerHTML = html;
        window.continueStory = function() {
          var nextEdges = getEdgesFrom(currentNodeId);
          if (nextEdges.length > 0) {
            renderNode(findNode(nextEdges[0].target));
          }
        };
      }

      function renderUnlock(node, data) {
        var price = data.price || data.amount || 0;
        var title = data.title || '付费解锁内容';
        var desc = data.description || '';

        var html = '<div class="node node-unlock">';
        html += '<div class="node-title">付费解锁</div>';
        html += '<div class="unlock-box">';
        html += '<div class="unlock-price">¥' + price + '</div>';
        html += '<p style="margin-top:8px;font-size:14px;">' + title + '</p>';
        if (desc) html += '<p style="margin-top:4px;font-size:12px;color:#94a3b8;">' + desc + '</p>';
        if (data.qrCodeUrl) {
          html += '<img src="' + data.qrCodeUrl + '" alt="付款码" style="max-width:200px;margin-top:12px;border-radius:8px;" />';
        }
        if (data.contactInfo) {
          html += '<p style="margin-top:8px;font-size:12px;color:#94a3b8;">联系创作者：' + data.contactInfo + '</p>';
        }
        html += '</div></div>';

        root.innerHTML = html;
      }

      function renderJump(node, data) {
        var targetId = data.targetNodeId;
        if (targetId) {
          renderNode(findNode(targetId));
        } else {
          root.innerHTML = '<div class="node"><p class="node-text">跳转目标不存在</p></div>';
        }
      }

      function renderGather(node, data) {
        var label = data.label || '汇聚';
        root.innerHTML = '<div class="node" style="text-align:center;opacity:0.5;"><p class="node-text">[' + label + ']</p></div>';
      }

      function renderCondition(node, data) {
        var expression = data.expression || 'true';
        var result = false;
        try {
          result = new Function('return ' + expression)();
        } catch(e) { result = false; }

        var edges = getEdgesFrom(node.id);
        var targetEdge = edges.find(function(e) { return e.sourceHandle === (result ? 'true' : 'false'); });
        if (targetEdge) {
          renderNode(findNode(targetEdge.target));
        }
      }

      function renderRandom(node, data) {
        var options = data.options || [];
        var totalWeight = options.reduce(function(sum, o) { return sum + (o.weight || 0); }, 0);
        var rand = Math.random() * totalWeight;
        var selectedIndex = 0;
        for (var i = 0; i < options.length; i++) {
          rand -= options[i].weight || 0;
          if (rand <= 0) { selectedIndex = i; break; }
        }
        var edges = getEdgesFrom(node.id);
        var targetEdge = edges[selectedIndex];
        if (targetEdge) {
          renderNode(findNode(targetEdge.target));
        }
      }

      // Start
      if (currentNodeId) {
        renderNode(findNode(currentNodeId));
      } else {
        root.innerHTML = '<div class="node"><p class="node-text">空故事</p></div>';
      }
    })();
  </script>
</body>
</html>`
}

export async function exportToHTML(
  graph: StoryGraph,
  monetization?: MonetizationConfig
): Promise<string> {
  // 素材内嵌：将 blob: URL 转为 data URL
  let processedGraph = await embedAssets(graph)

  // 付费内容加密：将付费节点文本 Base64 编码
  if (monetization && monetization.enabled && monetization.seedKey) {
    processedGraph = encryptPaidContent(processedGraph, monetization)
  }

  // 安全转义 JSON（防止 </script> 注入）
  const graphJSON = JSON.stringify(processedGraph)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

  let htmlMonetization: HTMLMonetizationConfig | undefined = undefined
  if (monetization && monetization.enabled && monetization.seedKey) {
    const seedKeyHash = await hashSeedKey(monetization.seedKey)
    htmlMonetization = {
      workId: monetization.workId,
      seedKeyHash,
      paidNodes: monetization.paidNodes,
      paidChapters: monetization.paidChapters,
      price: monetization.price,
      freePreviewNodes: monetization.freePreviewNodes,
      freePreviewText: monetization.freePreviewText,
      paymentMethod: monetization.paymentMethod,
      wechatQRCode: monetization.wechatQRCode,
      wechatContact: monetization.wechatContact,
      alipayQRCode: monetization.alipayQRCode,
      alipayContact: monetization.alipayContact,
      thirdParty: monetization.thirdParty,
      multiChannel: monetization.multiChannel,
      granularity: monetization.granularity,
      opvp: (monetization as MonetizationConfig & { opvp?: HTMLMonetizationConfig['opvp'] }).opvp,
    }
  }

  return buildHTMLTemplate({
    title: graph.title || '未命名故事',
    graphJSON,
    monetization: htmlMonetization,
  })
}
