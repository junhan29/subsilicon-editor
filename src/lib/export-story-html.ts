import type { StoryGraph } from '@editor/types/editor'
import { embedAssets } from '@editor/lib/export-html'
import { encryptStoryData, AES_ENC_PREFIX } from '@editor/lib/story-encrypt'
import { generateWorkId } from '@editor/lib/work-monetization'
import { SUBMIT_CONFIG } from '@editor/lib/submit-config'

export type UnlockMode = 'manual' | 'semi_auto' | 'webhook'

export interface StoryExportConfig {
  unlockMode: UnlockMode
  price: number
  freePreview: number
  currency?: string           // 新增：货币代码，默认 'CNY'
  wechatQRCode?: string
  alipayQRCode?: string
  contactInfo?: string
  workId?: string
  creatorEmail?: string
  // Webhook 自动解锁相关
  webhookUrl?: string         // 创作者 webhook 端点（用于请求解锁码）
  webhookProvider?: 'stripe' | 'paypal' | 'patreon' | 'kofi' | 'custom'
  stripeCheckoutUrl?: string  // Stripe 结账链接
  paypalLink?: string         // PayPal 付款链接
  patreonLink?: string        // Patreon 赞助链接
  kofiLink?: string           // Ko-fi 赞助链接
}

export interface StoryExportResult {
  html: string
  keyBase64: string
  ivBase64: string
  workId: string
}

// 解锁 API 地址，从 submit-config.ts 读取
// 默认指向 subsilicon.cn 官方服务器，如需修改请编辑 src/lib/submit-config.ts
const UNLOCK_API_URL = SUBMIT_CONFIG.storyUnlockUrl
const STORY_STORAGE_KEY_PREFIX = 'subsilicon_story_'

function buildStoryHTML(encryptedData: string, config: StoryExportConfig): string {
  const priceStr = config.price.toFixed(2)
  const hasQR = !!(config.wechatQRCode || config.alipayQRCode)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="subsilicon-watermark" content="ss-2026-07-03">
  <title>SubSilicon 互动故事</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      -webkit-user-select: none;
      user-select: none;
    }
    #app { max-width: 800px; margin: 0 auto; padding: 20px; min-height: 100vh; }

    /* 故事节点样式 */
    .node { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #334155; }
    .node-dialogue { border-left: 3px solid #3b82f6; }
    .node-choice { border-left: 3px solid #f59e0b; }
    .node-ending { border-left: 3px solid #22c55e; }
    .node-cg { border-left: 3px solid #a855f7; }
    .node-narration { border-left: 3px solid #6366f1; }
    .node-title { font-size: 11px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .node-text { font-size: 16px; line-height: 1.8; }
    .choices { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .choice-btn { background: #334155; border: 1px solid #475569; border-radius: 8px; padding: 12px 16px; color: #e2e8f0; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s; }
    .choice-btn:hover { background: #475569; border-color: #6366f1; }
    .ending-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 8px; font-weight: 600; }
    .ending-good { background: #166534; color: #4ade80; }
    .ending-bad { background: #7f1d1d; color: #fca5a5; }
    .ending-neutral { background: #334155; color: #94a3b8; }
    .ending-secret { background: #4c1d95; color: #c084fc; }
    .scene-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; opacity: 0.25; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.4s ease-out; }

    /* 付费锁屏样式 */
    #paywall {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15,23,42,0.97); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    #paywall.hidden { display: none; }
    .pw-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 20px;
      padding: 36px 28px; max-width: 440px; width: 92%;
      text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.6);
    }
    .pw-icon { font-size: 48px; margin-bottom: 8px; }
    .pw-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #f1f5f9; }
    .pw-subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 20px; line-height: 1.6; }
    .pw-price { font-size: 38px; font-weight: 800; color: #f59e0b; margin-bottom: 20px; }
    .pw-price-unit { font-size: 16px; font-weight: 500; color: #94a3b8; }
    .pw-divider { height: 1px; background: #334155; margin: 24px 0; }
    .pw-section-title { font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 14px; letter-spacing: 0.3px; }
    .pw-qr-container { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px; }
    .pw-qr-item { text-align: center; }
    .pw-qr-item img { width: 140px; border-radius: 12px; border: 2px solid #334155; }
    .pw-qr-item .pw-qr-label { font-size: 11px; color: #64748b; margin-top: 6px; }
    .pw-input {
      width: 100%; padding: 12px 14px; background: #0f172a;
      border: 1px solid #334155; border-radius: 10px; color: #e2e8f0;
      font-size: 14px; margin-bottom: 10px; transition: border-color 0.2s;
    }
    .pw-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
    .pw-input::placeholder { color: #475569; }
    .pw-btn {
      width: 100%; padding: 13px; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;
      margin-bottom: 10px;
    }
    .pw-btn-primary { background: #f59e0b; color: #0f172a; }
    .pw-btn-primary:hover { background: #fbbf24; }
    .pw-btn-primary:disabled { background: #475569; color: #94a3b8; cursor: not-allowed; }
    .pw-btn-secondary { background: #334155; color: #e2e8f0; }
    .pw-btn-secondary:hover { background: #475569; }
    .pw-btn-stripe { background: #635bff; color: white; }
    .pw-btn-stripe:hover { background: #7b75ff; }
    .pw-btn-paypal { background: #003087; color: white; }
    .pw-btn-paypal:hover { background: #0044aa; }
    .pw-btn-patreon { background: #ff424d; color: white; }
    .pw-btn-patreon:hover { background: #ff5a63; }
    .pw-btn-kofi { background: #ff5e5b; color: white; }
    .pw-btn-kofi:hover { background: #ff7774; }
    .pw-msg { font-size: 13px; margin-top: 8px; padding: 10px; border-radius: 8px; display: none; }
    .pw-msg.success { display: block; background: #16653440; color: #4ade80; border: 1px solid #16653460; }
    .pw-msg.error { display: block; background: #7f1d1d40; color: #fca5a5; border: 1px solid #7f1d1d60; }
    .pw-msg.info { display: block; background: #1e3a5f40; color: #93c5fd; border: 1px solid #1e3a5f60; }
    .pw-tabs { display: flex; gap: 6px; margin-bottom: 18px; }
    .pw-tab { flex: 1; padding: 10px; border-radius: 8px; font-size: 13px; cursor: pointer; text-align: center; transition: all 0.2s; background: #334155; border: 1px solid #475569; color: #94a3b8; }
    .pw-tab.active { background: #1e3a5f; border-color: #3b82f6; color: #e2e8f0; }
    .pw-footnote { font-size: 11px; color: #475569; margin-top: 20px; line-height: 1.5; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="paywall" class="hidden"></div>
  <script>
    window.__STORY_CONFIG__ = {
      workId: '${config.workId}',
      unlockMode: '${config.unlockMode}',
      price: ${config.price},
      currency: ${config.currency ? JSON.stringify(config.currency) : "'CNY'"},
      freePreview: ${config.freePreview},
      wechatQRCode: ${config.wechatQRCode ? JSON.stringify(config.wechatQRCode) : 'null'},
      alipayQRCode: ${config.alipayQRCode ? JSON.stringify(config.alipayQRCode) : 'null'},
      contactInfo: ${config.contactInfo ? JSON.stringify(config.contactInfo) : 'null'},
      creatorEmail: ${config.creatorEmail ? JSON.stringify(config.creatorEmail) : 'null'},
      webhookUrl: ${config.webhookUrl ? JSON.stringify(config.webhookUrl) : 'null'},
      webhookProvider: ${config.webhookProvider ? JSON.stringify(config.webhookProvider) : 'null'},
      stripeCheckoutUrl: ${config.stripeCheckoutUrl ? JSON.stringify(config.stripeCheckoutUrl) : 'null'},
      paypalLink: ${config.paypalLink ? JSON.stringify(config.paypalLink) : 'null'},
      patreonLink: ${config.patreonLink ? JSON.stringify(config.patreonLink) : 'null'},
      kofiLink: ${config.kofiLink ? JSON.stringify(config.kofiLink) : 'null'},
      encryptedData: ${JSON.stringify(encryptedData)},
      apiUrl: '${UNLOCK_API_URL}',
      storageKey: '${STORY_STORAGE_KEY_PREFIX}${config.workId}',
    };
  </script>
  <script>
    (function() {
      var C = window.__STORY_CONFIG__;
      if (!C) { document.getElementById('app').innerHTML = '<div class="node"><p class="node-text">无法加载故事数据</p></div>'; return; }

      var app = document.getElementById('app');
      var paywall = document.getElementById('paywall');
      var graph = null;
      var currentNodeId = null;
      var decodedData = null;

      function saveProgress(nodeId) {
        try {
          localStorage.setItem(C.storageKey + '_progress', JSON.stringify({ nodeId: nodeId, time: Date.now() }));
        } catch(e) {}
      }

      function loadProgress() {
        try {
          var data = localStorage.getItem(C.storageKey + '_progress');
          return data ? JSON.parse(data) : null;
        } catch(e) { return null; }
      }

      function isUnlocked() {
        try { return localStorage.getItem(C.storageKey + '_unlocked') === '1'; }
        catch(e) { return false; }
      }

      function setUnlocked(keyBase64, ivBase64) {
        try {
          localStorage.setItem(C.storageKey + '_unlocked', '1');
          localStorage.setItem(C.storageKey + '_key', keyBase64);
          localStorage.setItem(C.storageKey + '_iv', ivBase64);
        } catch(e) {}
      }

      async function decryptData(keyBase64, ivBase64) {
        var encData = C.encryptedData;
        var prefix = '${AES_ENC_PREFIX}';
        if (encData.indexOf(prefix) !== 0) throw new Error('数据格式错误');
        var cipherBase64 = encData.slice(prefix.length);

        var keyBytes = Uint8Array.from(atob(keyBase64), function(c) { return c.charCodeAt(0); });
        var ivBytes = Uint8Array.from(atob(ivBase64), function(c) { return c.charCodeAt(0); });
        var cipherBytes = Uint8Array.from(atob(cipherBase64), function(c) { return c.charCodeAt(0); });

        var cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
        var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, cipherBytes);
        return new TextDecoder().decode(decrypted);
      }

      async function sha256(text) {
        var data = new TextEncoder().encode(text);
        var hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
      }

      async function init() {
        if (isUnlocked()) {
          try {
            var k = localStorage.getItem(C.storageKey + '_key');
            var i = localStorage.getItem(C.storageKey + '_iv');
            decodedData = await decryptData(k, i);
            graph = JSON.parse(decodedData);
            startStory();
            return;
          } catch(e) {
            localStorage.removeItem(C.storageKey + '_unlocked');
          }
        }
        showPaywall();
      }

      function showPaywall() {
        var mode = C.unlockMode;
        var price = C.price;
        var hasQR = !!(C.wechatQRCode || C.alipayQRCode);

        var html = '<div class="pw-card">';
        html += '<div class="pw-icon">' + (price > 0 ? '🔒' : '📖') + '</div>';
        html += '<div class="pw-title">SubSilicon 互动故事</div>';
        html += '<div class="pw-subtitle">' + (C.freePreview > 0 ? '前 ' + C.freePreview + ' 页可免费试读，之后的精彩内容需要支持创作者' : '需要支持创作者后解锁完整故事') + '</div>';

        if (price > 0) {
          var currencySymbol = (C.currency === 'USD') ? '$' : '¥';
          html += '<div class="pw-price">' + currencySymbol + price + '<span class="pw-price-unit"> ' + (C.currency === 'USD' ? 'USD' : '元') + '</span></div>';

          if (mode === 'webhook') {
            // 海外渠道付款按钮
            html += '<div class="pw-divider"></div>';
            html += '<div class="pw-section-title">选择付款方式 · 钱直接到创作者账户</div>';
            html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">';
            if (C.stripeCheckoutUrl) {
              html += '<a href="' + C.stripeCheckoutUrl + '" target="_blank" class="pw-btn pw-btn-stripe" style="text-decoration:none;display:inline-block;text-align:center;">Stripe 付款</a>';
            }
            if (C.paypalLink) {
              html += '<a href="' + C.paypalLink + '" target="_blank" class="pw-btn pw-btn-paypal" style="text-decoration:none;display:inline-block;text-align:center;">PayPal 付款</a>';
            }
            if (C.patreonLink) {
              html += '<a href="' + C.patreonLink + '" target="_blank" class="pw-btn pw-btn-patreon" style="text-decoration:none;display:inline-block;text-align:center;">Patreon 赞助</a>';
            }
            if (C.kofiLink) {
              html += '<a href="' + C.kofiLink + '" target="_blank" class="pw-btn pw-btn-kofi" style="text-decoration:none;display:inline-block;text-align:center;">Ko-fi 赞助</a>';
            }
            html += '</div>';

            // 解锁码请求
            html += '<div class="pw-divider"></div>';
            html += '<div class="pw-section-title">付款后 · 获取解锁码</div>';
            html += '<input type="email" class="pw-input" id="webhook-email-input" placeholder="输入你的邮箱，解锁码将发送至此">';
            html += '<button class="pw-btn pw-btn-primary" id="webhook-unlock-btn" onclick="doWebhookUnlock()">发送解锁码到邮箱</button>';
            html += '<div class="pw-msg" id="webhook-msg"></div>';

            // 解锁码输入区域（初始隐藏）
            html += '<div id="webhook-code-section" style="display:none;margin-top:16px;">';
            html += '<input type="text" class="pw-input" id="webhook-code-input" placeholder="输入收到的解锁码">';
            html += '<button class="pw-btn pw-btn-secondary" onclick="doWebhookCodeUnlock()">解锁</button>';
            html += '<div class="pw-msg" id="webhook-code-msg"></div>';
            html += '</div>';
          } else {
            if (hasQR) {
              html += '<div class="pw-divider"></div>';
              html += '<div class="pw-section-title">扫码支付 · 钱直接到创作者账户</div>';
              html += '<div class="pw-qr-container">';
              if (C.wechatQRCode) {
                html += '<div class="pw-qr-item"><img src="' + C.wechatQRCode + '" alt="微信收款码"><div class="pw-qr-label">微信支付</div></div>';
              }
              if (C.alipayQRCode) {
                html += '<div class="pw-qr-item"><img src="' + C.alipayQRCode + '" alt="支付宝收款码"><div class="pw-qr-label">支付宝</div></div>';
              }
              html += '</div>';
            }

            if (C.contactInfo) {
              html += '<div class="pw-footnote">如有问题，联系创作者：' + C.contactInfo + '</div>';
            }

            html += '<div class="pw-divider"></div>';

            if (mode === 'semi_auto') {
              html += '<div class="pw-section-title">付款后 · 粘贴交易单号自动解锁</div>';
              html += '<input type="text" class="pw-input" id="order-input" placeholder="从微信/支付宝账单复制完整的交易单号" autocomplete="off">';
              html += '<p class="pw-footnote" style="margin-top:-4px;margin-bottom:8px;">微信单号以 420000 开头 · 在微信支付 → 账单详情中可找到</p>';
              html += '<button class="pw-btn pw-btn-primary" id="unlock-btn" onclick="doUnlock()">解锁完整故事</button>';
              html += '<div class="pw-msg" id="unlock-msg"></div>';
            } else {
              html += '<div class="pw-section-title">付款后 · 联系创作者获取激活码</div>';
              if (C.contactInfo) {
                html += '<p style="color:#94a3b8;font-size:13px;margin-bottom:12px;">将支付截图发给创作者：' + C.contactInfo + '</p>';
              }
              html += '<input type="text" class="pw-input" id="activation-input" placeholder="粘贴创作者给你的激活码">';
              html += '<button class="pw-btn pw-btn-primary" onclick="doManualUnlock()">输入激活码解锁</button>';
              html += '<div class="pw-msg" id="manual-msg"></div>';
            }
          }
        } else {
          html += '<div class="pw-btn pw-btn-primary" onclick="doUnlock()" style="margin-top:20px;">免费阅读</div>';
        }

        html += '<div class="pw-footnote">数据仅保存在你的浏览器中 · 创作者直接收款<br>平台不参与交易 · 不碰钱</div>';
        html += '</div>';

        paywall.innerHTML = html;
        paywall.classList.remove('hidden');
      }

      // ============ 解锁处理 ============
      window.doUnlock = async function() {
        var btn = document.getElementById('unlock-btn');
        var msg = document.getElementById('unlock-msg');
        if (!btn) return;

        var orderNo = '';
        if (C.price > 0 && C.unlockMode === 'semi_auto') {
          orderNo = (document.getElementById('order-input') || {}).value.trim();
          if (!orderNo) {
            msg.className = 'pw-msg error';
            msg.textContent = '请先粘贴完整的交易单号';
            return;
          }
        }

        btn.disabled = true;
        btn.textContent = '处理中...';
        msg.className = 'pw-msg info';
        msg.textContent = '正在验证...';

        try {
          var fingerprint = await sha256(navigator.userAgent + screen.width + 'x' + screen.height);

          var resp = await fetch(C.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'unlock',
              workId: C.workId,
              orderNo: orderNo || 'FREE',
              deviceFingerprint: fingerprint,
            }),
          });

          var result = await resp.json();

          if (result.success) {
            setUnlocked(result.keyBase64, result.ivBase64);
            decodedData = await decryptData(result.keyBase64, result.ivBase64);
            graph = JSON.parse(decodedData);
            msg.className = 'pw-msg success';
            msg.textContent = '解锁成功！即将开始阅读...';
            setTimeout(function() { paywall.classList.add('hidden'); startStory(); }, 1200);
          } else {
            msg.className = 'pw-msg error';
            msg.textContent = result.hint || result.error || '验证失败';
            btn.disabled = false;
            btn.textContent = '重试解锁';
          }
        } catch(e) {
          msg.className = 'pw-msg error';
          msg.textContent = '网络错误，请检查网络后重试';
          btn.disabled = false;
          btn.textContent = '重试解锁';
        }
      };

      window.doManualUnlock = async function() {
        var input = document.getElementById('activation-input');
        var msg = document.getElementById('manual-msg');
        var code = (input || {}).value.trim();

        if (!code) {
          msg.className = 'pw-msg error';
          msg.textContent = '请输入创作者给你的激活码';
          return;
        }

        msg.className = 'pw-msg info';
        msg.textContent = '验证中...';

        try {
          var fingerprint = await sha256(navigator.userAgent + screen.width + 'x' + screen.height);
          var resp = await fetch(C.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'unlock',
              workId: C.workId,
              orderNo: code,
              deviceFingerprint: fingerprint,
            }),
          });

          var result = await resp.json();
          if (result.success) {
            setUnlocked(result.keyBase64, result.ivBase64);
            decodedData = await decryptData(result.keyBase64, result.ivBase64);
            graph = JSON.parse(decodedData);
            msg.className = 'pw-msg success';
            msg.textContent = '解锁成功！';
            setTimeout(function() { paywall.classList.add('hidden'); startStory(); }, 1200);
          } else {
            msg.className = 'pw-msg error';
            msg.textContent = result.error || '激活码无效';
          }
        } catch(e) {
          msg.className = 'pw-msg error';
          msg.textContent = '网络错误';
        }
      };

      window.doWebhookUnlock = async function() {
        var emailInput = document.getElementById('webhook-email-input');
        var msg = document.getElementById('webhook-msg');
        var btn = document.getElementById('webhook-unlock-btn');
        var email = (emailInput || {}).value.trim();

        if (!email || !email.includes('@')) {
          msg.className = 'pw-msg error';
          msg.textContent = '请输入有效的邮箱地址';
          return;
        }

        btn.disabled = true;
        btn.textContent = '发送中...';
        msg.className = 'pw-msg info';
        msg.textContent = '正在发送解锁码，请稍候...';

        try {
          var resp = await fetch(C.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'request_unlock',
              workId: C.workId,
              email: email,
              deviceFingerprint: await sha256(navigator.userAgent + screen.width + 'x' + screen.height),
            }),
          });

          var result = await resp.json();
          if (result.success) {
            msg.className = 'pw-msg success';
            msg.textContent = '解锁码已发送到 ' + email + '，请查收邮件后输入解锁码';
            document.getElementById('webhook-code-section').style.display = 'block';
          } else {
            msg.className = 'pw-msg error';
            msg.textContent = result.error || '发送失败，请稍后重试';
            btn.disabled = false;
            btn.textContent = '发送解锁码';
          }
        } catch(e) {
          msg.className = 'pw-msg error';
          msg.textContent = '网络错误，请检查网络连接';
          btn.disabled = false;
          btn.textContent = '发送解锁码';
        }
      };

      window.doWebhookCodeUnlock = async function() {
        var input = document.getElementById('webhook-code-input');
        var msg = document.getElementById('webhook-code-msg');
        var code = (input || {}).value.trim();

        if (!code) {
          msg.className = 'pw-msg error';
          msg.textContent = '请输入解锁码';
          return;
        }

        msg.className = 'pw-msg info';
        msg.textContent = '验证中...';

        try {
          var fingerprint = await sha256(navigator.userAgent + screen.width + 'x' + screen.height);
          var resp = await fetch(C.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'unlock',
              workId: C.workId,
              orderNo: code,
              deviceFingerprint: fingerprint,
            }),
          });

          var result = await resp.json();
          if (result.success) {
            setUnlocked(result.keyBase64, result.ivBase64);
            decodedData = await decryptData(result.keyBase64, result.ivBase64);
            graph = JSON.parse(decodedData);
            msg.className = 'pw-msg success';
            msg.textContent = '解锁成功！';
            setTimeout(function() { paywall.classList.add('hidden'); startStory(); }, 1200);
          } else {
            msg.className = 'pw-msg error';
            msg.textContent = result.error || '解锁码无效';
          }
        } catch(e) {
          msg.className = 'pw-msg error';
          msg.textContent = '网络错误';
        }
      };

      // ============ 防右键/F12 ============
      document.addEventListener('contextmenu', function(e) {
        var tag = (e.target || {}).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
      });

      window.__SUBSILICON__ = 'ss-2026-07-03';

      function startStory() {
        if (!graph || !graph.nodes) { app.innerHTML = '<div class="node"><p class="node-text">故事数据加载失败</p></div>'; return; }

        var progress = loadProgress();
        var startId = progress ? progress.nodeId : null;
        if (!startId) {
          startId = (graph.nodes.find(function(n) { return n.type === 'dialogue' || n.type === 'narration'; }) || graph.nodes[0] || {}).id;
        }
        if (startId) renderNode(findNode(startId));
      }

      function findNode(id) { return (graph.nodes || []).find(function(n) { return n.id === id; }); }
      function getEdges(nodeId) { return (graph.edges || []).filter(function(e) { return e.source === nodeId; }); }

      function renderNode(node) {
        if (!node) { app.innerHTML = '<div class="node"><p class="node-text" style="text-align:center;color:#64748b;">— 故事到此结束 —</p></div>'; return; }
        currentNodeId = node.id;
        saveProgress(node.id);
        var data = node.data || {};

        switch (node.type) {
          case 'dialogue': renderDialogue(data); break;
          case 'narration': renderNarration(data); break;
          case 'choice': renderChoice(data); break;
          case 'ending': renderEnding(data); break;
          case 'cg': renderCG(data); break;
          case 'jump': renderJump(data); break;
          case 'gather': renderGather(); break;
          case 'condition': renderCondition(data); break;
          case 'random': renderRandom(data); break;
          default: app.innerHTML = '<div class="node"><p class="node-text">继续阅读...</p></div>';
        }
      }

      function renderDialogue(data) {
        var name = data.characterId || data.characterName || '???';
        var text = data.text || '';
        var html = '';
        if (data.backgroundImage) html += '<img class="scene-bg" src="' + data.backgroundImage + '" alt="">';
        html += '<div class="node node-dialogue fade-in"><div class="node-title">' + name + '</div><div class="node-text">' + text + '</div></div>';
        autoAdvance(html);
      }

      function renderNarration(data) {
        var html = '<div class="node node-narration fade-in"><div class="node-text" style="font-style:italic;color:#94a3b8;">' + (data.text || '') + '</div></div>';
        autoAdvance(html);
      }

      function renderChoice(data) {
        var options = data.options || [];
        var prompt = data.prompt || '你的选择是？';
        var html = '<div class="node node-choice fade-in"><div class="node-title">选择</div><div class="node-text">' + prompt + '</div><div class="choices">';
        options.forEach(function(opt, i) {
          html += '<button class="choice-btn" onclick="window.__selectChoice(' + i + ')">' + (opt.text || '选项') + '</button>';
        });
        html += '</div></div>';
        app.innerHTML = html;

        window.__selectChoice = function(index) {
          var edges = getEdges(currentNodeId);
          var optId = (options[index] || {}).id || 'opt-' + index;
          var edge = edges.find(function(e) { return e.sourceHandle === optId; });
          var targetId = edge ? edge.target : (edges[index] || {}).target;
          if (targetId) renderNode(findNode(targetId));
        };
      }

      function renderEnding(data) {
        var typeLabels = { good: '好结局', bad: '坏结局', neutral: '普通结局', secret: '隐藏结局' };
        var type = data.endingType || 'neutral';
        var html = '<div class="node node-ending fade-in">';
        html += '<span class="ending-badge ending-' + type + '">' + (typeLabels[type] || type) + '</span>';
        html += '<div class="node-title" style="font-size:14px;color:#f1f5f9;">' + (data.title || '结局') + '</div>';
        html += '<div class="node-text">' + (data.text || '') + '</div>';
        html += '</div>';
        app.innerHTML = html;
      }

      function renderCG(data) {
        var html = '<div class="node node-cg fade-in"><div class="node-title">' + (data.title || '场景') + '</div>';
        if (data.url) html += '<img src="' + data.url + '" style="width:100%;border-radius:8px;margin-bottom:8px;" alt="">';
        html += '<div class="node-text">' + (data.subtitle || '') + '</div></div>';
        autoAdvance(html);
      }

      function renderJump(data) {
        if (data.targetNodeId) renderNode(findNode(data.targetNodeId));
      }

      function renderGather() {
        app.innerHTML = '<div class="node" style="text-align:center;opacity:0.4;"><p class="node-text">—</p></div>';
      }

      function renderCondition(data) {
        try {
          var expr = data.expression || 'true';
          var result = new Function('return ' + expr)();
          var edges = getEdges(currentNodeId);
          var edge = edges.find(function(e) { return e.sourceHandle === (result ? 'true' : 'false'); });
          if (edge) renderNode(findNode(edge.target));
        } catch(e) { app.innerHTML = '<div class="node"><p class="node-text">条件解析错误</p></div>'; }
      }

      function renderRandom(data) {
        var options = data.options || [];
        var total = options.reduce(function(s, o) { return s + (o.weight || 1); }, 0) || 1;
        var r = Math.random() * total, idx = 0;
        for (var i = 0; i < options.length; i++) { r -= (options[i].weight || 1); if (r <= 0) { idx = i; break; } }
        var edges = getEdges(currentNodeId);
        if (edges[idx]) renderNode(findNode(edges[idx].target));
      }

      function autoAdvance(html) {
        app.innerHTML = html;
        var edges = getEdges(currentNodeId);
        if (edges.length > 0) {
          window.__continue = function() { renderNode(findNode(edges[0].target)); };
          setTimeout(function() {
            var existing = document.getElementById('continue-btn');
            if (!existing) {
              var btn = document.createElement('button');
              btn.id = 'continue-btn';
              btn.className = 'choice-btn';
              btn.textContent = '继续 ▸';
              btn.onclick = window.__continue;
              btn.style.marginTop = '12px';
              btn.style.width = '100%';
              app.appendChild(btn);
            }
          }, 300);
        }
      }

      // 全局继续事件
      document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'continue-btn') {
          if (window.__continue) window.__continue();
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if (window.__continue) window.__continue();
        }
      });

      // 启动
      init();
    })();
  </script>
</body>
</html>`
}

export async function exportToStoryHTML(
  graph: StoryGraph,
  config: StoryExportConfig
): Promise<StoryExportResult> {
  const workId = config.workId || generateWorkId()

  // 素材内嵌
  const processedGraph = await embedAssets(graph)

  // 序列化故事数据
  const graphJSON = JSON.stringify(processedGraph)

  // AES-256-GCM 加密
  const { encryptedData, keyBase64, ivBase64 } = await encryptStoryData(graphJSON)

  // 构建 HTML
  const html = buildStoryHTML(encryptedData, { ...config, workId })

  return { html, keyBase64, ivBase64, workId }
}
