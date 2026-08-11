/**
 * 漫画作品导出器
 *
 * - 翻页 HTML：单文件内嵌素材，按页翻页，付费画格遮罩 + 解锁码解锁。
 * - 长条 HTML：纵向滚动阅读（webtoon 风格）。
 * - ZIP 包：翻页 HTML + 素材文件（供二次加工与分发）。
 * - 试看预览 HTML：仅前 N 格（免费画格）。
 *
 * 素材通过 resolveAsset(hash) 由调用方（编辑器 asset-store）提供 dataURL。
 */

import JSZip from 'jszip'
import type { ComicData, ComicPanel, ComicDialogue } from './work-types/comic'
import { countPaidPanels } from './work-types/comic'
import { sha256Hex } from './work-monetization'

/** 已解析素材的画格 */
export interface ComicPagePanel {
  id: string
  page: number
  src: string
  dialogues: ComicDialogue[]
  narration?: string
  paid: boolean
  /** 全局画格序号（从 0 开始，用于试读判定） */
  index: number
}

export interface ComicPage {
  page: number
  panels: ComicPagePanel[]
}

export type ResolveAsset = (hash: string) => Promise<string | null>

const NO_ASSET_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" fill="#aaa" font-size="32" text-anchor="middle" font-family="sans-serif">无画面素材</text></svg>`
  )

/** 将漫画数据解析为分页结构（缺素材的画格用占位图兜底） */
export async function buildComicPages(
  data: ComicData,
  resolveAsset: ResolveAsset
): Promise<ComicPage[]> {
  const sorted = [...data.panels].sort((a, b) => a.page - b.page || a.order - b.order)
  const byPage = new Map<number, ComicPanel[]>()
  for (const panel of sorted) {
    const list = byPage.get(panel.page) || []
    list.push(panel)
    byPage.set(panel.page, list)
  }
  const pages: ComicPage[] = []
  let index = 0
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const panels: ComicPagePanel[] = []
    for (const panel of byPage.get(page) || []) {
      let src = NO_ASSET_PLACEHOLDER
      if (panel.assetHash) {
        const resolved = await resolveAsset(panel.assetHash)
        if (resolved) src = resolved
      }
      panels.push({
        id: panel.id,
        page: panel.page,
        src,
        dialogues: panel.dialogues || [],
        narration: panel.narration,
        paid: panel.paid,
        index: index++,
      })
    }
    pages.push({ page, panels })
  }
  return pages
}

/** 免费可看的画格数 */
export function freePreviewPanels(data: ComicData): number {
  if ((data.freePreviewPanels || 0) > 0) return data.freePreviewPanels
  let n = 0
  for (const p of [...data.panels].sort((a, b) => a.page - b.page || a.order - b.order)) {
    if (p.paid) break
    n++
  }
  return n
}

/** HTML 转义 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJs(value: unknown): string {
  return JSON.stringify(value)
}

/** 渲染台词气泡与旁白 */
function renderPanelBody(p: ComicPagePanel): string {
  const parts: string[] = []
  if (p.narration) {
    parts.push(`<div class="narration">${escapeHtml(p.narration)}</div>`)
  }
  for (const d of p.dialogues || []) {
    if (!d.text) continue
    parts.push(
      `<div class="bubble">${d.speaker ? `<span class="speaker">${escapeHtml(d.speaker)}</span>` : ''}<span class="text">${escapeHtml(d.text)}</span></div>`
    )
  }
  return parts.join('\n')
}

/** 渲染翻页漫画 HTML */
export function renderFlipHTML(opts: {
  title: string
  author?: string
  pages: ComicPage[]
  freePanels: number
  paidPanelCount: number
  /** 解锁码的 SHA-256 哈希（仅存哈希，明文解锁码不落导出物） */
  unlockCodeHash?: string
  paymentNote?: string
}): string {
  const { title, author, pages, freePanels, paidPanelCount, unlockCodeHash, paymentNote } = opts
  const hasPaid = paidPanelCount > 0
  // 计算每个画格的累计序号（用于试读判断）
  const pagesJson = escapeJs(pages.map((pg) => ({
    page: pg.page,
    panels: pg.panels.map((p) => ({
      id: p.id, src: p.src, paid: p.paid, index: p.index, dialogues: p.dialogues, narration: p.narration,
    })),
  })))
  const allPanels = pages.reduce((s, p) => s + p.panels.length, 0)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #1a1a1a; color: #222; min-height: 100vh; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 20px 14px 60px; }
  h1 { text-align: center; font-size: 22px; color: #fff; margin-bottom: 6px; }
  .author { text-align: center; color: #8a8a8a; font-size: 13px; margin-bottom: 16px; }
  .meta { text-align: center; color: #6a6a6a; font-size: 12px; margin-bottom: 18px; display: flex; gap: 12px; justify-content: center; }
  .meta .tag { padding: 2px 10px; border-radius: 20px; background: #2a2a2a; color: #bbb; font-size: 11px; }
  .page { display: none; }
  .page.active { display: block; animation: fadein .25s ease; }
  @keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
  .panel { position: relative; background: #fff; border-radius: 10px; overflow: hidden; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.35); }
  .panel img { display: block; width: 100%; max-height: 72vh; object-fit: contain; background: #fff; }
  .overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 16px 22px; background: linear-gradient(transparent, rgba(0,0,0,.65)); }
  .narration { position: absolute; left: 14px; right: 14px; bottom: 12px; background: rgba(255,248,230,.94); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #5a4a2a; line-height: 1.6; }
  .bubble { display: inline-block; max-width: 78%; background: #fff; border: 2px solid #111; border-radius: 14px; padding: 8px 14px; font-size: 15px; line-height: 1.5; margin: 10px 14px 4px; position: relative; }
  .bubble .speaker { display: block; font-size: 11px; font-weight: 700; color: #8a4a0a; margin-bottom: 2px; }
  .locked-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(20,20,20,.88); color: #fff; }
  .locked-title { font-size: 18px; font-weight: 700; color: #f0c36d; margin-bottom: 8px; }
  .locked-sub { font-size: 12px; color: #bbb; }
  .nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 18px; }
  .nav button { padding: 10px 26px; border: none; border-radius: 10px; background: #f0c36d; color: #1a1a1a; font-size: 14px; font-weight: 600; cursor: pointer; }
  .nav button:disabled { opacity: .35; cursor: default; }
  .nav .pageinfo { color: #bbb; font-size: 13px; }
  .lock { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,.86); z-index: 20; padding: 24px; }
  .lock .msg { color: #ddd; font-size: 15px; margin-bottom: 14px; text-align: center; line-height: 1.6; }
  .lock input { width: 220px; padding: 10px 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; font-size: 14px; text-align: center; outline: none; }
  .lock button { margin-top: 10px; padding: 10px 28px; border: none; border-radius: 8px; background: #f0c36d; color: #1a1a1a; font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  ${author ? `<div class="author">${escapeHtml(author)}</div>` : ''}
  <div class="meta">
    <span class="tag">${pages.length} 页 · ${allPanels} 格</span>
    ${hasPaid ? `<span class="tag">${paidPanelCount} 个付费画格</span>` : '<span class="tag">免费阅读</span>'}
  </div>
  ${pages.map((pg, pi) => `
  <div class="page" data-page="${pi}" ${pi === 0 ? 'style="display:block"' : ''}>
    ${pg.panels.map((p) => `<div class="panel" data-panel-index="${p.index}"><img src="${p.src}" alt="" loading="lazy" />${renderPanelBody(p)}</div>`).join('\n')}
  </div>`).join('\n')}
  <div class="nav">
    <button id="prevBtn">上一页</button>
    <span class="pageinfo" id="pageInfo"></span>
    <button id="nextBtn">下一页</button>
  </div>
</div>
${hasPaid ? `
<div class="lock" id="lock">
  <div class="msg" id="lockMsg"></div>
  <input id="lockInput" placeholder="输入解锁码" />
  <button id="lockBtn">解锁完整内容</button>
</div>` : ''}
<script>
var pages = ${pagesJson};
var freePanels = ${freePanels};
var unlockCodeHash = ${escapeJs(unlockCodeHash || '')};
var hasPaid = ${hasPaid};
var paymentNote = ${escapeJs(paymentNote || '')};
var cur = 0;
var unlocked = false;
var lock = document.getElementById('lock');
var lockMsg = document.getElementById('lockMsg');
var lockInput = document.getElementById('lockInput');
var lockBtn = document.getElementById('lockBtn');

async function sha256Hex(str) {
  var enc = new TextEncoder().encode(str);
  var buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

function panelIndexInPage(pg) {
  var min = 999999;
  pg.panels.forEach(function (p) { if (p.index < min) min = p.index; });
  return min;
}

function isPanelLocked(p) {
  return p.paid && !unlocked && p.index >= freePanels;
}

function renderPage(i) {
  document.querySelectorAll('.page').forEach(function (el, idx) {
    el.style.display = idx === i ? 'block' : 'none';
  });
  // 处理付费画格遮罩（无解锁码场景直接遮罩；有解锁码时输入后全部解锁）
  var pg = pages[i];
  pg.panels.forEach(function (p) {
    var panelEl = document.querySelector('.panel[data-panel-index="' + p.index + '"]');
    if (!panelEl) return;
    var old = panelEl.querySelector('.locked-overlay');
    if (old) old.remove();
    if (isPanelLocked(p)) {
      var div = document.createElement('div');
      div.className = 'locked-overlay';
      div.innerHTML = '<div class="locked-title">付费画格</div><div class="locked-sub">支持创作者，解锁后查看完整画面</div>';
      panelEl.appendChild(div);
      if (unlockCodeHash) {
        showLock();
      }
    }
  });
  var info = document.getElementById('pageInfo');
  info.textContent = (i + 1) + ' / ' + pages.length;
  document.getElementById('prevBtn').disabled = i === 0;
  document.getElementById('nextBtn').disabled = i === pages.length - 1;
}

function showLock() {
  if (!lock) return;
  lockMsg.textContent = paymentNote || '本作为付费内容，输入解锁码后解锁完整阅读。';
  lock.style.display = 'flex';
}

document.getElementById('prevBtn').onclick = function () { if (cur > 0) { cur--; renderPage(cur); } };
document.getElementById('nextBtn').onclick = function () { if (cur < pages.length - 1) { cur++; renderPage(cur); } };
if (lockBtn) {
  lockBtn.onclick = async function () {
    var inputVal = lockInput.value.trim();
    if (!inputVal) { lockMsg.textContent = '请输入解锁码'; return; }
    var hash = await sha256Hex(inputVal);
    if (hash === unlockCodeHash) {
      unlocked = true;
      lock.style.display = 'none';
      renderPage(cur);
    } else {
      lockMsg.textContent = '解锁码不正确，请重试。';
    }
  };
}
renderPage(0);
</script>
</body>
</html>
`
}

/** 渲染长条滚动 HTML */
export function renderScrollHTML(opts: {
  title: string
  author?: string
  pages: ComicPage[]
  freePanels: number
  paidPanelCount: number
  /** 解锁码的 SHA-256 哈希（仅存哈希，明文解锁码不落导出物） */
  unlockCodeHash?: string
}): string {
  const { title, author, pages, freePanels, paidPanelCount, unlockCodeHash } = opts
  const hasPaid = paidPanelCount > 0
  const total = pages.reduce((s, p) => s + p.panels.length, 0)
  // 长条模式：一次性渲染所有画格并滚动阅读
  const allPanelsJson = escapeJs(
    opts.pages.flatMap((pg) =>
      pg.panels.map((p) => ({
        id: p.id, src: p.src, paid: p.paid, index: p.index, dialogues: p.dialogues, narration: p.narration,
      }))
    )
  )
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} · 长条版</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #1a1a1a; color: #222; }
  .wrap { max-width: 620px; margin: 0 auto; padding: 20px 0 60px; }
  h1 { text-align: center; font-size: 22px; color: #fff; margin-bottom: 6px; }
  .author { text-align: center; color: #8a8a8a; font-size: 13px; margin-bottom: 14px; }
  .meta { text-align: center; color: #6a6a6a; font-size: 12px; margin-bottom: 14px; }
  .panel { position: relative; background: #fff; margin-bottom: 4px; }
  .panel img { display: block; width: 100%; }
  .overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 16px 22px; background: linear-gradient(transparent, rgba(0,0,0,.6)); }
  .narration { position: absolute; left: 12px; right: 12px; bottom: 10px; background: rgba(255,248,230,.94); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #5a4a2a; line-height: 1.6; }
  .bubble { display: inline-block; max-width: 78%; background: #fff; border: 2px solid #111; border-radius: 14px; padding: 8px 14px; font-size: 15px; line-height: 1.5; margin: 10px 12px 4px; }
  .bubble .speaker { display: block; font-size: 11px; font-weight: 700; color: #8a4a0a; margin-bottom: 2px; }
  .locked-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(20,20,20,.88); color: #fff; }
  .locked-title { font-size: 18px; font-weight: 700; color: #f0c36d; margin-bottom: 8px; }
  .locked-sub { font-size: 12px; color: #bbb; }
  .lock { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,.86); z-index: 20; padding: 24px; }
  .lock .msg { color: #ddd; font-size: 15px; margin-bottom: 14px; text-align: center; }
  .lock input { width: 220px; padding: 10px 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; font-size: 14px; text-align: center; outline: none; }
  .lock button { margin-top: 10px; padding: 10px 28px; border: none; border-radius: 8px; background: #f0c36d; color: #1a1a1a; font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  ${author ? `<div class="author">${escapeHtml(author)}</div>` : ''}
  <div class="meta">${pages.length} 页 · ${total} 格 ${hasPaid ? `· ${paidPanelCount} 个付费画格` : '· 免费阅读'}</div>
  <div id="list"></div>
</div>
${hasPaid ? `
<div class="lock" id="lock">
  <div class="msg" id="lockMsg">本作为付费内容，输入解锁码后解锁完整阅读。</div>
  <input id="lockInput" placeholder="输入解锁码" />
  <button id="lockBtn">解锁完整内容</button>
</div>` : ''}
<script>
var panels = ${allPanelsJson};
var freePanels = ${freePanels};
var unlockCodeHash = ${escapeJs(unlockCodeHash || '')};
var hasPaid = ${hasPaid};
var unlocked = false;
var lock = document.getElementById('lock');
var lockMsg = document.getElementById('lockMsg');
var lockInput = document.getElementById('lockInput');
var lockBtn = document.getElementById('lockBtn');

async function sha256Hex(str) {
  var enc = new TextEncoder().encode(str);
  var buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

function renderPanel(p) {
  var panel = document.createElement('div');
  panel.className = 'panel';
  var img = document.createElement('img');
  img.src = p.src;
  panel.appendChild(img);
  if (p.paid && !unlocked && p.index >= freePanels) {
    var ov = document.createElement('div');
    ov.className = 'locked-overlay';
    ov.innerHTML = '<div class="locked-title">付费画格</div><div class="locked-sub">支持创作者，解锁后查看完整画面</div>';
    panel.appendChild(ov);
    if (unlockCodeHash) { lock.style.display = 'flex'; }
  } else {
    if (p.narration) {
      var n = document.createElement('div');
      n.className = 'narration';
      n.textContent = p.narration;
      panel.appendChild(n);
    }
    (p.dialogues || []).forEach(function (d) {
      if (!d.text) return;
      var b = document.createElement('div');
      b.className = 'bubble';
      if (d.speaker) { var s = document.createElement('span'); s.className = 'speaker'; s.textContent = d.speaker; b.appendChild(s); }
      var t = document.createElement('span');
      t.textContent = d.text;
      b.appendChild(t);
      panel.appendChild(b);
    });
  }
  document.getElementById('list').appendChild(panel);
}
panels.forEach(renderPanel);
if (lockBtn) {
  lockBtn.onclick = async function () {
    var inputVal = lockInput.value.trim();
    if (!inputVal) { lockMsg.textContent = '请输入解锁码'; return; }
    var hash = await sha256Hex(inputVal);
    if (hash === unlockCodeHash) {
      unlocked = true;
      lock.style.display = 'none';
      document.getElementById('list').innerHTML = '';
      panels.forEach(renderPanel);
    } else {
      lockMsg.textContent = '解锁码不正确，请重试。';
    }
  };
}
</script>
</body>
</html>
`
}

/** 渲染试看预览 HTML（仅前 N 格，无付费遮罩） */
export function renderComicPreviewHTML(opts: {
  title: string
  author?: string
  pages: ComicPage[]
  freePanels: number
}): string {
  const { title, author, pages, freePanels } = opts
  let counter = 0
  const previewPanels: { src: string; dialogues: ComicDialogue[]; narration?: string }[] = []
  for (const pg of pages) {
    for (const p of pg.panels) {
      if (counter >= freePanels) break
      counter++
      previewPanels.push({ src: p.src, dialogues: p.dialogues, narration: p.narration })
    }
    if (counter >= freePanels) break
  }
  const panelsJson = escapeJs(previewPanels)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} · 试看</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #1a1a1a; color: #222; }
  .wrap { max-width: 620px; margin: 0 auto; padding: 20px 0 60px; }
  h1 { text-align: center; font-size: 20px; color: #fff; margin-bottom: 4px; }
  .hint { text-align: center; color: #8a8a8a; font-size: 12px; margin-bottom: 14px; }
  .panel { position: relative; background: #fff; margin-bottom: 4px; }
  .panel img { display: block; width: 100%; }
  .narration { position: absolute; left: 12px; right: 12px; bottom: 10px; background: rgba(255,248,230,.94); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #5a4a2a; line-height: 1.6; }
  .bubble { display: inline-block; max-width: 78%; background: #fff; border: 2px solid #111; border-radius: 14px; padding: 8px 14px; font-size: 15px; line-height: 1.5; margin: 10px 12px 4px; }
  .bubble .speaker { display: block; font-size: 11px; font-weight: 700; color: #8a4a0a; margin-bottom: 2px; }
  .end { text-align: center; color: #c8b47a; font-size: 14px; padding: 30px 0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <div class="hint">试看片段 · 完整内容请支持创作者后阅读</div>
  <div id="list"></div>
  <div class="end">—— 试看结束，完整内容待解锁 ——</div>
</div>
<script>
var panels = ${panelsJson};
var list = document.getElementById('list');
panels.forEach(function (p) {
  var panel = document.createElement('div');
  panel.className = 'panel';
  var img = document.createElement('img');
  img.src = p.src;
  panel.appendChild(img);
  if (p.narration) {
    var n = document.createElement('div');
    n.className = 'narration';
    n.textContent = p.narration;
    panel.appendChild(n);
  }
  (p.dialogues || []).forEach(function (d) {
    if (!d.text) return;
    var b = document.createElement('div');
    b.className = 'bubble';
    if (d.speaker) { var s = document.createElement('span'); s.className = 'speaker'; s.textContent = d.speaker; b.appendChild(s); }
    var t = document.createElement('span');
    t.textContent = d.text;
    b.appendChild(t);
    panel.appendChild(b);
  });
  list.appendChild(panel);
});
</script>
</body>
</html>
`
}

/** dataURL → Uint8Array（JSZip 在 Node/浏览器均支持） */
function dataURLToBytes(dataUrl: string): Uint8Array | null {
  try {
    const [, content] = dataUrl.split(',')
    const binary = atob(content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** 导出翻页漫画 HTML */
export async function exportComicToFlipHTML(
  data: ComicData,
  title: string,
  resolveAsset: ResolveAsset,
  opts?: { author?: string; unlockCode?: string; paymentNote?: string }
): Promise<string> {
  const pages = await buildComicPages(data, resolveAsset)
  // 明文解锁码仅用于计算哈希，不写入导出物
  const unlockCodeHash = opts?.unlockCode ? await sha256Hex(opts.unlockCode) : ''
  return renderFlipHTML({
    title,
    author: opts?.author || data.author,
    pages,
    freePanels: freePreviewPanels(data),
    paidPanelCount: countPaidPanels(data),
    unlockCodeHash,
    paymentNote: opts?.paymentNote,
  })
}

/** 导出长条漫画 HTML */
export async function exportComicToScrollHTML(
  data: ComicData,
  title: string,
  resolveAsset: ResolveAsset,
  opts?: { author?: string; unlockCode?: string }
): Promise<string> {
  const pages = await buildComicPages(data, resolveAsset)
  // 明文解锁码仅用于计算哈希，不写入导出物
  const unlockCodeHash = opts?.unlockCode ? await sha256Hex(opts.unlockCode) : ''
  return renderScrollHTML({
    title,
    author: opts?.author || data.author,
    pages,
    freePanels: freePreviewPanels(data),
    paidPanelCount: countPaidPanels(data),
    unlockCodeHash,
  })
}

/** 导出试看预览 HTML */
export async function exportComicPreviewHTML(
  data: ComicData,
  title: string,
  resolveAsset: ResolveAsset
): Promise<string> {
  const pages = await buildComicPages(data, resolveAsset)
  return renderComicPreviewHTML({
    title,
    author: data.author,
    pages,
    freePanels: freePreviewPanels(data),
  })
}

/** 导出 ZIP 包（翻页 HTML 内嵌素材 + 素材文件） */
export async function exportComicToZip(
  data: ComicData,
  title: string,
  resolveAsset: ResolveAsset,
  opts?: { author?: string; unlockCode?: string }
): Promise<Blob> {
  const zip = new JSZip()
  const html = await exportComicToFlipHTML(data, title, resolveAsset, opts)
  zip.file(`${sanitizeFilename(title)}.html`, html)
  // 素材文件单独打包（排除付费画格：付费素材只随解锁码机制的 HTML 内嵌存在，
  // 不额外散落为独立文件，与互动叙事 ZIP 的「付费素材不打包」策略对齐）
  const seen = new Set<string>()
  for (const panel of data.panels) {
    if (panel.paid) continue
    if (!panel.assetHash || seen.has(panel.assetHash)) continue
    seen.add(panel.assetHash)
    const dataUrl = await resolveAsset(panel.assetHash)
    if (!dataUrl) continue
    const bytes = dataURLToBytes(dataUrl)
    if (!bytes) continue
    const mime = dataUrl.match(/^data:(.*?);/)?.[1] || 'application/octet-stream'
    const ext = (mime.split('/')[1] || 'img').split('+')[0] || 'img'
    zip.file(`media/${panel.assetHash}.${ext}`, bytes)
  }
  return zip.generateAsync({ type: 'blob' })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名漫画'
}
