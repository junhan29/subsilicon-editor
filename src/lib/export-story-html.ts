/**
 * 可执行故事 HTML 导出
 *
 * 生成带 DRM 保护的 .story.html 文件：
 * - AES-256-GCM 加密故事数据
 * - 嵌入付款 UI（微信/支付宝收款码）
 * - 模式 A（手动）：付款后联系创作者获取激活码
 * - 模式 B（半自动）：付款后粘贴订单号自动解锁
 */

import type { StoryGraph } from '@editor/types/editor'
import { embedAssets } from '@editor/lib/export-html'
import { encryptStoryData, AES_ENC_PREFIX } from '@editor/lib/story-encrypt'
import { generateWorkId } from '@editor/lib/work-monetization'

export type UnlockMode = 'manual' | 'semi_auto' | 'webhook'

export interface StoryExportConfig {
  unlockMode: UnlockMode
  price: number
  freePreview: number
  wechatQRCode?: string
  alipayQRCode?: string
  contactInfo?: string
  workId?: string
  creatorEmail?: string
  currency?: string
  webhookUrl?: string
  webhookProvider?: string
  stripeCheckoutUrl?: string
  paypalLink?: string
  patreonLink?: string
  kofiLink?: string
}

export interface StoryExportResult {
  html: string
  keyBase64: string
  ivBase64: string
  workId: string
}

const UNLOCK_API_URL = 'https://subsilicon.cn/api/story-unlock'
const STORY_STORAGE_KEY_PREFIX = 'subsilicon_story_'

const EXPRESSION_PARSER_CODE = `
class ExpressionParser {
  constructor(context) {
    this.context = context
    this.tokens = []
    this.position = 0
  }

  parse(expression) {
    if (!expression || expression.trim() === '') return true
    this.tokens = this.tokenize(expression)
    this.position = 0
    return this.parseExpression()
  }

  tokenize(expression) {
    const tokens = []
    let i = 0
    while (i < expression.length) {
      const char = expression[i]
      if (/\s/.test(char)) { i++; continue }
      if (/\d/.test(char) || (char === '.' && /\\d/.test(expression[i + 1]))) {
        let num = ''
        while (i < expression.length && /[\\d.]/.test(expression[i])) { num += expression[i]; i++ }
        tokens.push({ type: 'NUMBER', value: parseFloat(num), position: i })
        continue
      }
      if (char === '"' || char === "'") {
        const quote = char
        let str = ''
        i++
        while (i < expression.length && expression[i] !== quote) {
          if (expression[i] === '\\\\' && i + 1 < expression.length) { str += expression[i + 1]; i += 2 }
          else { str += expression[i]; i++ }
        }
        i++
        tokens.push({ type: 'STRING', value: str, position: i })
        continue
      }
      if (expression.substring(i, i + 4) === 'true') { tokens.push({ type: 'BOOLEAN', value: true, position: i }); i += 4; continue }
      if (expression.substring(i, i + 5) === 'false') { tokens.push({ type: 'BOOLEAN', value: false, position: i }); i += 5; continue }
      if (/[a-zA-Z_]/.test(char)) {
        let id = ''
        while (i < expression.length && /[a-zA-Z0-9_]/.test(expression[i])) { id += expression[i]; i++ }
        tokens.push({ type: 'IDENTIFIER', value: id, position: i })
        continue
      }
      if (i + 1 < expression.length) {
        const twoChar = expression.substring(i, i + 2)
        if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) { tokens.push({ type: 'OPERATOR', value: twoChar, position: i }); i += 2; continue }
      }
      if ('+-*/%<>=!(),'.includes(char)) { tokens.push({ type: 'OPERATOR', value: char, position: i }); i++; continue }
      i++
    }
    tokens.push({ type: 'EOF', value: '', position: i })
    return tokens
  }

  currentToken() { return this.tokens[this.position] || { type: 'EOF', value: '', position: 0 } }
  eat(type) { const t = this.currentToken(); if (t.type !== type) throw new Error('Expected ' + type); this.position++; return t }
  peek() { return this.tokens[this.position] || { type: 'EOF', value: '', position: 0 } }

  parseExpression() { return this.parseLogicalOr() }
  parseLogicalOr() {
    let left = this.parseLogicalAnd()
    while (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '||') { this.eat('OPERATOR'); left = left || this.parseLogicalAnd() }
    return left
  }
  parseLogicalAnd() {
    let left = this.parseEquality()
    while (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '&&') { this.eat('OPERATOR'); left = left && this.parseEquality() }
    return left
  }
  parseEquality() {
    let left = this.parseComparison()
    while (this.currentToken().type === 'OPERATOR' && ['==', '!='].includes(this.currentToken().value)) {
      const op = this.eat('OPERATOR').value
      left = op === '==' ? left === this.parseComparison() : left !== this.parseComparison()
    }
    return left
  }
  parseComparison() {
    let left = this.parseAdditive()
    while (this.currentToken().type === 'OPERATOR' && ['<', '<=', '>', '>='].includes(this.currentToken().value)) {
      const op = this.eat('OPERATOR').value
      const right = this.parseAdditive()
      switch(op) { case '<': left = left < right; break; case '<=': left = left <= right; break; case '>': left = left > right; break; case '>=': left = left >= right; break }
    }
    return left
  }
  parseAdditive() {
    let left = this.parseMultiplicative()
    while (this.currentToken().type === 'OPERATOR' && ['+', '-'].includes(this.currentToken().value)) {
      const op = this.eat('OPERATOR').value
      left = op === '+' ? left + this.parseMultiplicative() : left - this.parseMultiplicative()
    }
    return left
  }
  parseMultiplicative() {
    let left = this.parseUnary()
    while (this.currentToken().type === 'OPERATOR' && ['*', '/', '%'].includes(this.currentToken().value)) {
      const op = this.eat('OPERATOR').value
      const right = this.parseUnary()
      switch(op) { case '*': left = left * right; break; case '/': left = right !== 0 ? left / right : 0; break; case '%': left = right !== 0 ? left % right : 0; break }
    }
    return left
  }
  parseUnary() {
    if (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '!') { this.eat('OPERATOR'); return !this.parseUnary() }
    if (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '-') { this.eat('OPERATOR'); return -this.parseUnary() }
    return this.parsePrimary()
  }
  parsePrimary() {
    const token = this.currentToken()
    if (token.type === 'OPERATOR' && token.value === '(') { this.eat('OPERATOR'); const r = this.parseExpression(); this.eat('OPERATOR'); return r }
    if (token.type === 'NUMBER') { this.eat('NUMBER'); return token.value }
    if (token.type === 'STRING') { this.eat('STRING'); return token.value }
    if (token.type === 'BOOLEAN') { this.eat('BOOLEAN'); return token.value }
    if (token.type === 'IDENTIFIER') {
      const name = this.eat('IDENTIFIER').value
      if (this.currentToken().type === 'OPERATOR' && this.currentToken().value === '(') {
        this.eat('OPERATOR')
        const args = []
        if (this.currentToken().type !== 'OPERATOR' || this.currentToken().value !== ')') {
          args.push(this.parseExpression())
          while (this.currentToken().type === 'OPERATOR' && this.currentToken().value === ',') { this.eat('COMMA'); args.push(this.parseExpression()) }
        }
        this.eat('OPERATOR')
        return this.callFunction(name, args)
      }
      return this.getVariable(name)
    }
    if (token.type === 'EOF') return undefined
    throw new Error('Unexpected token: ' + token.type)
  }
  getVariable(name) {
    if (name in this.context.variables) return this.context.variables[name]
    if (name in this.context.functions) return this.context.functions[name]
    return undefined
  }
  callFunction(name, args) {
    if (this.context.functions[name]) return this.context.functions[name](...args)
    switch(name.toUpperCase()) {
      case 'RANDOM': return args.length === 2 ? Math.floor(Math.random() * (args[1] - args[0] + 1)) + args[0] : Math.random()
      case 'CHOICE_COUNT': return this.context.choiceCount()
      case 'TURNS_SINCE': return this.context.turnsSince(args[0])
      case 'VISIT_COUNT': return this.context.visitCounts[args[0]] || 0
      case 'HAS': return args[0] in this.context.variables
      case 'SET': if (args.length >= 2) { this.context.variables[args[0]] = args[1]; return args[1] }
      default: throw new Error('Unknown function: ' + name)
    }
  }
}
`

function buildStoryHTML(encryptedData: string, config: StoryExportConfig): string {
  const priceStr = config.price.toFixed(2)

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
      overflow-x: hidden;
    }
    #app-container { max-width: 800px; margin: 0 auto; position: relative; }
    #scene-layer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
    #scene-layer > div { position: absolute; }
    #scene-layer .layer-bg { width: 100%; height: 100%; object-fit: cover; }
    #scene-layer .layer-image { object-fit: contain; }
    #scene-layer .layer-character { object-fit: contain; }
    #scene-layer .layer-text { font-size: 18px; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
    #scene-layer .layer-effect { pointer-events: none; }
    #story-content { position: relative; z-index: 10; padding: 20px; min-height: 100vh; background: linear-gradient(transparent 0%, rgba(15,23,42,0.9) 30%, rgba(15,23,42,0.98) 70%); }

    .node { background: rgba(30,41,59,0.95); border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #334155; backdrop-filter: blur(12px); }
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
    .choice-btn.disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
    .ending-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 8px; font-weight: 600; }
    .ending-good { background: #166534; color: #4ade80; }
    .ending-bad { background: #7f1d1d; color: #fca5a5; }
    .ending-neutral { background: #334155; color: #94a3b8; }
    .ending-secret { background: #4c1d95; color: #c084fc; }
    .character-name { font-size: 14px; font-weight: 600; color: #93c5fd; margin-bottom: 4px; }
    .character-sprite { float: left; margin-right: 16px; margin-bottom: 8px; max-width: 120px; border-radius: 8px; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes zoomOut { from { opacity: 0; transform: scale(1.05); } to { opacity: 1; transform: scale(1); } }
    @keyframes wipeLeft { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    @keyframes wipeRight { from { clip-path: inset(0 0 0 100%); } to { clip-path: inset(0 0 0 0); } }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    .fade-out { animation: fadeOut 0.3s ease-out; }
    .slide-left { animation: slideLeft 0.4s ease-out; }
    .slide-right { animation: slideRight 0.4s ease-out; }
    .slide-up { animation: slideUp 0.4s ease-out; }
    .slide-down { animation: slideDown 0.4s ease-out; }
    .zoom-in { animation: zoomIn 0.4s ease-out; }
    .zoom-out { animation: zoomOut 0.4s ease-out; }
    .wipe-left { animation: wipeLeft 0.4s ease-out; }
    .wipe-right { animation: wipeRight 0.4s ease-out; }

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
    .pw-msg { font-size: 13px; margin-top: 8px; padding: 10px; border-radius: 8px; display: none; }
    .pw-msg.success { display: block; background: #16653440; color: #4ade80; border: 1px solid #16653460; }
    .pw-msg.error { display: block; background: #7f1d1d40; color: #fca5a5; border: 1px solid #7f1d1d60; }
    .pw-msg.info { display: block; background: #1e3a5f40; color: #93c5fd; border: 1px solid #1e3a5f60; }
    .pw-footnote { font-size: 11px; color: #475569; margin-top: 20px; line-height: 1.5; }

    #controls {
      position: fixed; bottom: 20px; right: 20px; z-index: 100;
      display: flex; gap: 8px;
    }
    .ctrl-btn {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(30,41,59,0.9); border: 1px solid #475569;
      color: #e2e8f0; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      font-size: 18px; transition: all 0.2s;
    }
    .ctrl-btn:hover { background: #475569; border-color: #6366f1; }
    .ctrl-btn.disabled { opacity: 0.4; cursor: not-allowed; }

    #save-slot-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      padding: 24px; min-width: 320px; z-index: 200;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6);
    }
    #save-slot-panel.hidden { display: none; }
    .slot-header { font-size: 18px; font-weight: 600; margin-bottom: 16px; text-align: center; }
    .save-slots { display: flex; flex-direction: column; gap: 8px; }
    .save-slot {
      padding: 12px; background: #0f172a; border: 1px solid #334155;
      border-radius: 8px; cursor: pointer; transition: all 0.2s;
    }
    .save-slot:hover { background: #334155; border-color: #6366f1; }
    .save-slot.empty { opacity: 0.5; }
    .slot-info { display: flex; justify-content: space-between; align-items: center; }
    .slot-name { font-size: 14px; }
    .slot-time { font-size: 11px; color: #64748b; }
    .slot-actions { display: flex; gap: 8px; margin-top: 8px; }
    .slot-action-btn {
      flex: 1; padding: 6px; font-size: 12px; border-radius: 4px;
      border: none; cursor: pointer; background: #334155; color: #e2e8f0;
    }
    .slot-action-btn:hover { background: #475569; }
    .slot-action-btn.save { background: #22c55e; color: #fff; }
    .slot-action-btn.save:hover { background: #16a34a; }
    .close-panel {
      margin-top: 16px; width: 100%; padding: 10px; border: none;
      border-radius: 8px; background: #334155; color: #e2e8f0; cursor: pointer;
    }

    .transition-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #0f172a; z-index: 50; pointer-events: none;
    }
    .transition-overlay.fade-in { animation: fadeIn 0.4s ease-out forwards; }
    .transition-overlay.fade-out { animation: fadeOut 0.4s ease-out forwards; }
  </style>
</head>
<body>
  <div id="scene-layer"></div>
  <div id="app-container">
    <div id="story-content"></div>
  </div>
  <div id="paywall" class="hidden"></div>
  <div id="controls">
    <button class="ctrl-btn" id="rollback-btn" title="回滚到上一个选择" onclick="window.__rollback()">&#x2190;</button>
    <button class="ctrl-btn" id="save-btn" title="存档" onclick="window.__showSavePanel()">&#x1F4BE;</button>
    <button class="ctrl-btn" id="load-btn" title="读档" onclick="window.__showLoadPanel()">&#x1F4D1;</button>
  </div>
  <div id="save-slot-panel" class="hidden"></div>
  <script>
    window.__STORY_CONFIG__ = {
      workId: '${config.workId}',
      unlockMode: '${config.unlockMode}',
      price: ${config.price},
      freePreview: ${config.freePreview},
      wechatQRCode: ${config.wechatQRCode ? JSON.stringify(config.wechatQRCode) : 'null'},
      alipayQRCode: ${config.alipayQRCode ? JSON.stringify(config.alipayQRCode) : 'null'},
      contactInfo: ${config.contactInfo ? JSON.stringify(config.contactInfo) : 'null'},
      encryptedData: ${JSON.stringify(encryptedData)},
      apiUrl: '${UNLOCK_API_URL}',
      storageKey: '${STORY_STORAGE_KEY_PREFIX}${config.workId}',
    };
  </script>
  <script>
    ${EXPRESSION_PARSER_CODE}
  </script>
  <script>
    (function() {
      var C = window.__STORY_CONFIG__;
      if (!C) { document.getElementById('story-content').innerHTML = '<div class="node"><p class="node-text">无法加载故事数据</p></div>'; return; }

      var app = document.getElementById('story-content');
      var sceneLayer = document.getElementById('scene-layer');
      var paywall = document.getElementById('paywall');
      var savePanel = document.getElementById('save-slot-panel');
      var graph = null;
      var currentNodeId = null;
      var decodedData = null;

      var variables = {};
      var historyStack = [];
      var visitCounts = {};
      var choiceCount = 0;
      var turnsSinceLabels = {};
      var currentTurn = 0;

      var audioContext = null;
      var bgmSource = null;
      var bgsSource = null;
      var bgmVolume = 0.5;
      var bgsVolume = 0.5;
      var seVolume = 0.7;
      var voiceVolume = 1.0;

      function initAudio() {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
      }

      function playAudio(url, type, volume, loop) {
        if (!url) return;
        initAudio();
        var source = audioContext.createBufferSource();
        var gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.loop = !!loop;
        fetch(url).then(function(r) { return r.arrayBuffer(); })
          .then(function(buf) { return audioContext.decodeAudioData(buf); })
          .then(function(audioBuf) { source.buffer = audioBuf; source.start(0); })
          .catch(function() {});
        return source;
      }

      function stopAudio(source) {
        if (source) { try { source.stop(); } catch(e) {} }
      }

      function fadeAudio(source, targetVolume, duration) {
        if (!source || !source.gain) return;
        var startVolume = source.gain.value;
        var startTime = audioContext.currentTime;
        source.gain.setValueAtTime(startVolume, startTime);
        source.gain.linearRampToValueAtTime(targetVolume, startTime + duration);
      }

      function setBGM(url, volume) {
        stopAudio(bgmSource);
        if (url) {
          bgmVolume = volume != null ? volume : 0.5;
          bgmSource = playAudio(url, 'bgm', bgmVolume, true);
        }
      }

      function setBGS(url, volume) {
        stopAudio(bgsSource);
        if (url) {
          bgsVolume = volume != null ? volume : 0.5;
          bgsSource = playAudio(url, 'bgs', bgsVolume, true);
        }
      }

      function playSE(url, volume) {
        if (url) playAudio(url, 'se', volume != null ? volume : seVolume, false);
      }

      function playVoice(url, volume) {
        if (url) playAudio(url, 'voice', volume != null ? volume : voiceVolume, false);
      }

      function evaluateExpression(expr) {
        var ctx = {
          variables: variables,
          functions: {},
          visitCounts: visitCounts,
          choiceCount: function() { return choiceCount; },
          turnsSince: function(label) { return currentTurn - (turnsSinceLabels[label] || currentTurn); },
          currentTurn: currentTurn,
        };
        var parser = new ExpressionParser(ctx);
        return parser.parse(expr);
      }

      function applyVariableEffect(effect) {
        if (!effect || !effect.variableName) return;
        var name = effect.variableName;
        var op = effect.operation || 'set';
        var value = effect.value;
        var current = variables[name];

        if (typeof value === 'string') {
          if (!isNaN(value)) value = parseFloat(value);
          else if (value === 'true') value = true;
          else if (value === 'false') value = false;
        }

        switch(op) {
          case 'set': variables[name] = value; break;
          case 'add': variables[name] = (current || 0) + value; break;
          case 'subtract': variables[name] = (current || 0) - value; break;
          case 'multiply': variables[name] = (current || 1) * value; break;
        }
      }

      function saveState() {
        return {
          nodeId: currentNodeId,
          variables: JSON.parse(JSON.stringify(variables)),
          visitCounts: JSON.parse(JSON.stringify(visitCounts)),
          choiceCount: choiceCount,
          turnsSinceLabels: JSON.parse(JSON.stringify(turnsSinceLabels)),
          currentTurn: currentTurn,
        };
      }

      function restoreState(state) {
        if (!state) return;
        currentNodeId = state.nodeId;
        variables = state.variables || {};
        visitCounts = state.visitCounts || {};
        choiceCount = state.choiceCount || 0;
        turnsSinceLabels = state.turnsSinceLabels || {};
        currentTurn = state.currentTurn || 0;
      }

      function saveProgress(nodeId) {
        try {
          var state = saveState();
          state.nodeId = nodeId;
          localStorage.setItem(C.storageKey + '_progress', JSON.stringify({ state: state, time: Date.now() }));
        } catch(e) {}
      }

      function loadProgress() {
        try {
          var data = localStorage.getItem(C.storageKey + '_progress');
          return data ? JSON.parse(data) : null;
        } catch(e) { return null; }
      }

      function saveToSlot(slotId) {
        try {
          var state = saveState();
          localStorage.setItem(C.storageKey + '_slot_' + slotId, JSON.stringify({
            state: state,
            time: Date.now(),
            workId: C.workId,
          }));
          renderSavePanel();
        } catch(e) {}
      }

      function loadFromSlot(slotId) {
        try {
          var data = localStorage.getItem(C.storageKey + '_slot_' + slotId);
          if (data) {
            var slot = JSON.parse(data);
            restoreState(slot.state);
            savePanel.classList.add('hidden');
            renderNode(findNode(currentNodeId));
          }
        } catch(e) {}
      }

      function deleteSlot(slotId) {
        localStorage.removeItem(C.storageKey + '_slot_' + slotId);
        renderSavePanel();
      }

      function renderSavePanel(mode) {
        var html = '<div class="slot-header">' + (mode === 'save' ? '保存进度' : '读取进度') + '</div>';
        html += '<div class="save-slots">';
        for (var i = 1; i <= 6; i++) {
          var slotData = null;
          try { slotData = localStorage.getItem(C.storageKey + '_slot_' + i); } catch(e) {}
          var isEmpty = !slotData;
          var slot = isEmpty ? null : JSON.parse(slotData);
          var timeStr = isEmpty ? '空存档位' : new Date(slot.time).toLocaleString('zh-CN');
          html += '<div class="save-slot' + (isEmpty ? ' empty' : '') + '">';
          html += '<div class="slot-info"><span class="slot-name">存档 ' + i + '</span><span class="slot-time">' + timeStr + '</span></div>';
          html += '<div class="slot-actions">';
          html += '<button class="slot-action-btn save" onclick="window.__saveToSlot(' + i + ')">保存</button>';
          html += '<button class="slot-action-btn" onclick="window.__loadFromSlot(' + i + ')">读取</button>';
          if (!isEmpty) html += '<button class="slot-action-btn" onclick="window.__deleteSlot(' + i + ')">删除</button>';
          html += '</div></div>';
        }
        html += '</div><button class="close-panel" onclick="document.getElementById(\'save-slot-panel\').classList.add(\'hidden\')">关闭</button>';
        savePanel.innerHTML = html;
      }

      window.__showSavePanel = function() { renderSavePanel('save'); savePanel.classList.remove('hidden'); };
      window.__showLoadPanel = function() { renderSavePanel('load'); savePanel.classList.remove('hidden'); };
      window.__saveToSlot = saveToSlot;
      window.__loadFromSlot = loadFromSlot;
      window.__deleteSlot = deleteSlot;

      window.__rollback = function() {
        if (historyStack.length === 0) return;
        var lastState = historyStack.pop();
        restoreState(lastState);
        renderNode(findNode(currentNodeId));
      };

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

      function initVariables() {
        variables = {};
        var graphVars = graph.variables || [];
        for (var i = 0; i < graphVars.length; i++) {
          var v = graphVars[i];
          variables[v.name] = v.initialValue;
        }
      }

      async function init() {
        if (isUnlocked()) {
          try {
            var k = localStorage.getItem(C.storageKey + '_key');
            var i = localStorage.getItem(C.storageKey + '_iv');
            decodedData = await decryptData(k, i);
            graph = JSON.parse(decodedData);
            initVariables();
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
          html += '<div class="pw-price">¥' + price + '<span class="pw-price-unit"> 元</span></div>';
          if (hasQR) {
            html += '<div class="pw-divider"></div>';
            html += '<div class="pw-section-title">扫码支付 · 钱直接到创作者账户</div>';
            html += '<div class="pw-qr-container">';
            if (C.wechatQRCode) html += '<div class="pw-qr-item"><img src="' + C.wechatQRCode + '" alt="微信收款码"><div class="pw-qr-label">微信支付</div></div>';
            if (C.alipayQRCode) html += '<div class="pw-qr-item"><img src="' + C.alipayQRCode + '" alt="支付宝收款码"><div class="pw-qr-label">支付宝</div></div>';
            html += '</div>';
          }
          if (C.contactInfo) html += '<div class="pw-footnote">如有问题，联系创作者：' + C.contactInfo + '</div>';
          html += '<div class="pw-divider"></div>';
          if (mode === 'semi_auto') {
            html += '<div class="pw-section-title">付款后 · 粘贴交易单号自动解锁</div>';
            html += '<input type="text" class="pw-input" id="order-input" placeholder="从微信/支付宝账单复制完整的交易单号" autocomplete="off">';
            html += '<p class="pw-footnote" style="margin-top:-4px;margin-bottom:8px;">微信单号以 420000 开头 · 在微信支付 → 账单详情中可找到</p>';
            html += '<button class="pw-btn pw-btn-primary" id="unlock-btn" onclick="doUnlock()">解锁完整故事</button>';
            html += '<div class="pw-msg" id="unlock-msg"></div>';
          } else {
            html += '<div class="pw-section-title">付款后 · 联系创作者获取激活码</div>';
            if (C.contactInfo) html += '<p style="color:#94a3b8;font-size:13px;margin-bottom:12px;">将支付截图发给创作者：' + C.contactInfo + '</p>';
            html += '<input type="text" class="pw-input" id="activation-input" placeholder="粘贴创作者给你的激活码">';
            html += '<button class="pw-btn pw-btn-primary" onclick="doManualUnlock()">输入激活码解锁</button>';
            html += '<div class="pw-msg" id="manual-msg"></div>';
          }
        } else {
          html += '<div class="pw-btn pw-btn-primary" onclick="doUnlock()" style="margin-top:20px;">免费阅读</div>';
        }
        html += '<div class="pw-footnote">数据仅保存在你的浏览器中 · 创作者直接收款<br>平台不参与交易 · 不碰钱</div>';
        html += '</div>';
        paywall.innerHTML = html;
        paywall.classList.remove('hidden');
      }

      window.doUnlock = async function() {
        var btn = document.getElementById('unlock-btn');
        var msg = document.getElementById('unlock-msg');
        if (!btn) return;
        var orderNo = '';
        if (C.price > 0 && C.unlockMode === 'semi_auto') {
          orderNo = (document.getElementById('order-input') || {}).value.trim();
          if (!orderNo) { msg.className = 'pw-msg error'; msg.textContent = '请先粘贴完整的交易单号'; return; }
        }
        btn.disabled = true; btn.textContent = '处理中...';
        msg.className = 'pw-msg info'; msg.textContent = '正在验证...';
        try {
          var fingerprint = await sha256(navigator.userAgent + screen.width + 'x' + screen.height);
          var resp = await fetch(C.apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock', workId: C.workId, orderNo: orderNo || 'FREE', deviceFingerprint: fingerprint }),
          });
          var result = await resp.json();
          if (result.success) {
            setUnlocked(result.keyBase64, result.ivBase64);
            decodedData = await decryptData(result.keyBase64, result.ivBase64);
            graph = JSON.parse(decodedData);
            initVariables();
            msg.className = 'pw-msg success'; msg.textContent = '解锁成功！即将开始阅读...';
            setTimeout(function() { paywall.classList.add('hidden'); startStory(); }, 1200);
          } else {
            msg.className = 'pw-msg error'; msg.textContent = result.hint || result.error || '验证失败';
            btn.disabled = false; btn.textContent = '重试解锁';
          }
        } catch(e) {
          msg.className = 'pw-msg error'; msg.textContent = '网络错误，请检查网络后重试';
          btn.disabled = false; btn.textContent = '重试解锁';
        }
      };

      window.doManualUnlock = async function() {
        var input = document.getElementById('activation-input');
        var msg = document.getElementById('manual-msg');
        var code = (input || {}).value.trim();
        if (!code) { msg.className = 'pw-msg error'; msg.textContent = '请输入创作者给你的激活码'; return; }
        msg.className = 'pw-msg info'; msg.textContent = '验证中...';
        try {
          var fingerprint = await sha256(navigator.userAgent + screen.width + 'x' + screen.height);
          var resp = await fetch(C.apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock', workId: C.workId, orderNo: code, deviceFingerprint: fingerprint }),
          });
          var result = await resp.json();
          if (result.success) {
            setUnlocked(result.keyBase64, result.ivBase64);
            decodedData = await decryptData(result.keyBase64, result.ivBase64);
            graph = JSON.parse(decodedData);
            initVariables();
            msg.className = 'pw-msg success'; msg.textContent = '解锁成功！';
            setTimeout(function() { paywall.classList.add('hidden'); startStory(); }, 1200);
          } else {
            msg.className = 'pw-msg error'; msg.textContent = result.error || '激活码无效';
          }
        } catch(e) {
          msg.className = 'pw-msg error'; msg.textContent = '网络错误';
        }
      };

      document.addEventListener('contextmenu', function(e) {
        var tag = (e.target || {}).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
      });

      window.__SUBSILICON__ = 'ss-2026-07-03';

      function renderSceneLayers(puzzleData) {
        if (!puzzleData || !puzzleData.layers) { sceneLayer.innerHTML = ''; return; }
        var html = '';
        var layers = puzzleData.layers.filter(function(l) { return l.visible; }).sort(function(a, b) { return (a.zIndex || 0) - (b.zIndex || 0); });
        for (var i = 0; i < layers.length; i++) {
          var l = layers[i];
          var style = 'left:' + l.x + '%; top:' + l.y + '%; width:' + l.width + '%; height:' + l.height + '%;';
          style += 'opacity:' + (l.opacity || 1) + ';';
          if (l.rotation) style += 'transform:rotate(' + l.rotation + 'deg);';
          var anim = l.animation && l.animation.type !== 'none' ? l.animation.type : 'fade-in';
          if (l.type === 'background') {
            html += '<div class="layer-bg" style="' + style + '"><img src="' + l.url + '" style="width:100%;height:100%;object-fit:cover;"></div>';
          } else if (l.type === 'image') {
            html += '<div class="' + anim + '" style="' + style + '"><img src="' + l.url + '" class="layer-image" style="width:100%;height:100%;"></div>';
          } else if (l.type === 'character') {
            html += '<div class="' + anim + '" style="' + style + '"><img src="' + l.url + '" class="layer-character" style="width:100%;height:100%;"></div>';
          } else if (l.type === 'text') {
            var textStyle = '';
            if (l.fontSize) textStyle += 'font-size:' + l.fontSize + 'px;';
            if (l.fontColor) textStyle += 'color:' + l.fontColor + ';';
            html += '<div class="layer-text ' + anim + '" style="' + style + textStyle + '">' + (l.textContent || '') + '</div>';
          } else if (l.type === 'effect') {
            html += '<div class="layer-effect ' + anim + '" style="' + style + '"><img src="' + l.url + '" style="width:100%;height:100%;"></div>';
          }
        }
        sceneLayer.innerHTML = html;
      }

      function startStory() {
        if (!graph || !graph.nodes) { app.innerHTML = '<div class="node"><p class="node-text">故事数据加载失败</p></div>'; return; }
        var progress = loadProgress();
        var startId = null;
        if (progress && progress.state) {
          restoreState(progress.state);
          startId = progress.state.nodeId;
        }
        if (!startId) {
          startId = (graph.nodes.find(function(n) { return n.type === 'dialogue' || n.type === 'narration'; }) || graph.nodes[0] || {}).id;
        }
        if (startId) renderNode(findNode(startId));
      }

      function findNode(id) { return (graph.nodes || []).find(function(n) { return n.id === id; }); }
      function getEdges(nodeId) { return (graph.edges || []).filter(function(e) { return e.source === nodeId; }); }
      function findCharacter(id) { return (graph.characters || []).find(function(c) { return c.id === id; }); }

      function renderNode(node) {
        if (!node) { app.innerHTML = '<div class="node"><p class="node-text" style="text-align:center;color:#64748b;">— 故事到此结束 —</p></div>'; return; }
        currentNodeId = node.id;
        currentTurn++;
        visitCounts[node.id] = (visitCounts[node.id] || 0) + 1;
        saveProgress(node.id);

        var data = node.data || {};
        if (data.backgroundImage) {
          sceneLayer.innerHTML = '<div class="layer-bg"><img src="' + data.backgroundImage + '" style="width:100%;height:100%;object-fit:cover;"></div>';
        }

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
          case 'scene': renderScene(data); break;
          default: app.innerHTML = '<div class="node"><p class="node-text">继续阅读...</p></div>';
        }
      }

      function renderDialogue(data) {
        var charId = data.characterId || '';
        var char = charId ? findCharacter(charId) : null;
        var name = data.characterName || char?.name || '???';
        var text = data.text || '';

        if (data.bgm) setBGM(data.bgm, data.bgmVolume);
        if (data.bgs) setBGS(data.bgs, data.bgsVolume);
        if (data.seUrl) playSE(data.seUrl, data.seVolume);
        if (data.voiceUrl) playVoice(data.voiceUrl);

        var html = '<div class="node node-dialogue fade-in">';
        if (char && char.sprites && data.spriteEmotion) {
          var sprite = char.sprites.find(function(s) { return s.emotion === data.spriteEmotion; }) || char.sprites[0];
          if (sprite && (sprite.url || sprite.image)) {
            var pos = data.spritePosition || sprite.position || 'left';
            html += '<img src="' + (sprite.url || sprite.image) + '" class="character-sprite" style="float:' + pos + ';">';
          }
        }
        html += '<div class="character-name">' + name + '</div>';
        html += '<div class="node-text">' + text + '</div>';
        html += '</div>';
        autoAdvance(html);
      }

      function renderNarration(data) {
        var html = '<div class="node node-narration fade-in"><div class="node-text" style="font-style:italic;color:#94a3b8;">' + (data.text || '') + '</div></div>';
        autoAdvance(html);
      }

      function renderChoice(data) {
        var options = data.options || [];
        var prompt = data.prompt || '你的选择是？';

        var validOptions = options.filter(function(opt) {
          if (!opt.condition) return true;
          try { return evaluateExpression(opt.condition); } catch(e) { return true; }
        });

        var html = '<div class="node node-choice fade-in"><div class="node-title">选择</div><div class="node-text">' + prompt + '</div><div class="choices">';
        validOptions.forEach(function(opt, i) {
          html += '<button class="choice-btn" onclick="window.__selectChoice(' + i + ')">' + (opt.text || '选项') + '</button>';
        });
        html += '</div></div>';
        app.innerHTML = html;

        window.__selectChoice = function(index) {
          var opt = validOptions[index];
          if (!opt) return;

          historyStack.push(saveState());
          choiceCount++;

          if (opt.effects) {
            for (var j = 0; j < opt.effects.length; j++) applyVariableEffect(opt.effects[j]);
          }
          if (opt.variableEffect) applyVariableEffect(opt.variableEffect);

          var edges = getEdges(currentNodeId);
          var optId = opt.id || 'opt-' + index;
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
        if (data.coverImage) html += '<img src="' + data.coverImage + '" style="width:100%;border-radius:8px;margin-top:12px;" alt="">';
        html += '</div>';
        app.innerHTML = html;
        stopAudio(bgmSource);
        stopAudio(bgsSource);
      }

      function renderCG(data) {
        if (data.bgm) setBGM(data.bgm);
        if (data.soundEffect) playSE(data.soundEffect);

        var html = '<div class="node node-cg fade-in"><div class="node-title">' + (data.title || '场景') + '</div>';
        if (data.url) {
          var mediaClass = data.mediaType === 'video' ? '' : '';
          html += '<img src="' + data.url + '" style="width:100%;border-radius:8px;margin-bottom:8px;" alt="">';
        }
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
          var result = evaluateExpression(expr);
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

      function renderScene(data) {
        if (data.sceneId && graph.scenes) {
          var scene = graph.scenes.find(function(s) { return s.id === data.sceneId; });
          if (scene && scene.puzzleData) {
            renderSceneLayers(scene.puzzleData);
          } else if (scene && scene.backgroundImage) {
            sceneLayer.innerHTML = '<div class="layer-bg"><img src="' + scene.backgroundImage + '" style="width:100%;height:100%;object-fit:cover;"></div>';
          }
        }
        autoAdvance('<div class="node node-narration fade-in" style="opacity:0.6;"><div class="node-text"></div></div>');
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

      document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'continue-btn') {
          if (window.__continue) window.__continue();
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if (window.__continue) window.__continue();
        }
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          window.__rollback();
        }
      });

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

  const processedGraph = await embedAssets(graph)
  const graphJSON = JSON.stringify(processedGraph)
  const { encryptedData, keyBase64, ivBase64 } = await encryptStoryData(graphJSON)
  const html = buildStoryHTML(encryptedData, { ...config, workId })

  return { html, keyBase64, ivBase64, workId }
}