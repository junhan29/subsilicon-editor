/**
 * 视频作品导出器
 *
 * 首版（轻中度剪辑）聚焦「时间线数据 → 产物」：
 * - 付费播放器 HTML：内嵌素材（base64），按时间线顺序播放，
 *   支持试看前 N 秒、整片/片段付费遮罩、解锁码解锁。
 * - B 站互动视频脚本：分 P 配置（每片段一个 P，含起止时间）。
 * - 试看预览 HTML：仅前 N 秒 / 免费片段，无付费遮罩。
 *
 * 素材通过 resolveAsset(hash) 由调用方（编辑器 asset-store）提供 dataURL。
 */

import type { VideoData, VideoClip } from './work-types/video'
import { countVideoDuration, countPaidClips } from './work-types/video'
import { sha256Hex } from './work-monetization'

/** 播放列表片段（素材已解析为可播放 URL） */
export interface PlaylistClip {
  id: string
  type: 'video' | 'image' | 'audio'
  src: string
  /** 片段时长（秒） */
  dur: number
  /** 截取起点（秒） */
  trimStart: number
  subtitle?: string
  transition: string
  paid: boolean
  /** 片段单价（可选，用于付费遮罩价格展示） */
  price?: number
}

export type ResolveAsset = (hash: string) => Promise<string | null>

/** 无素材片段（空场）的占位提示，用于素材缺失兜底 */
const NO_ASSET_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#141414"/><text x="50%" y="50%" fill="#8a8a8a" font-size="36" text-anchor="middle" font-family="sans-serif">素材缺失</text></svg>`
  )

/** 将素材 hash 解析为播放列表（缺素材的片段用占位图兜底） */
export async function buildVideoPlaylist(
  data: VideoData,
  resolveAsset: ResolveAsset
): Promise<PlaylistClip[]> {
  const clips = [...data.clips].sort((a, b) => a.order - b.order)
  const list: PlaylistClip[] = []
  for (const clip of clips) {
    let src = NO_ASSET_PLACEHOLDER
    if (clip.assetHash) {
      const resolved = await resolveAsset(clip.assetHash)
      if (resolved) src = resolved
    }
    list.push({
      id: clip.id,
      type: clip.type,
      src,
      dur: Math.max(0.1, clip.duration || 1),
      trimStart: clip.trimStart || 0,
      subtitle: clip.subtitle,
      transition: clip.transition || 'none',
      paid: clip.paid,
      price: clip.price,
    })
  }
  return list
}

/** 计算免费可看的秒数（previewSeconds 或首个付费片段前的内容） */
export function freePreviewSeconds(data: VideoData): number {
  if ((data.previewSeconds || 0) > 0) return data.previewSeconds
  // 无试看设置时，取第一个付费片段之前的时长
  let t = 0
  for (const clip of [...data.clips].sort((a, b) => a.order - b.order)) {
    if (clip.paid) break
    t += Math.max(0, clip.duration || 0)
  }
  return Math.round(t * 10) / 10
}

/** HTML 转义（内嵌到单文件时防止脚本注入） */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 转义 JS 字符串字面量 */
function escapeJs(value: unknown): string {
  return JSON.stringify(value)
}

/** 格式化秒数为 mm:ss（模板插值用） */
function fmtTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`
}

/** 渲染付费播放器 HTML（内嵌素材 dataURL） */
export function renderPlayerHTML(opts: {
  title: string
  author?: string
  descriptionHtml?: string
  playlist: PlaylistClip[]
  previewSeconds: number
  wholePrice?: number
  paidClipCount: number
  /** 解锁码的 SHA-256 哈希（仅存哈希，明文解锁码不落导出物） */
  unlockCodeHash?: string
  paymentNote?: string
}): string {
  const { title, author, descriptionHtml, playlist, previewSeconds, wholePrice, paidClipCount, unlockCodeHash, paymentNote } = opts
  const totalDuration = playlist.reduce((s, c) => s + c.dur, 0)
  const hasPaid = paidClipCount > 0

  const clipsJson = escapeJs(playlist.map((c) => ({
    type: c.type,
    src: c.src,
    dur: c.dur,
    trimStart: c.trimStart,
    sub: c.subtitle || '',
    transition: c.transition,
    paid: c.paid,
    price: c.price,
  })))

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #0f0f0f; color: #e5e5e5; min-height: 100vh; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .author { color: #8a8a8a; font-size: 13px; margin-bottom: 12px; }
  .desc { color: #b5b5b5; font-size: 14px; line-height: 1.7; margin-bottom: 20px; background: #1a1a1a; border-radius: 10px; padding: 14px 16px; }
  .stage { position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; }
  .stage video, .stage img { width: 100%; height: 100%; object-fit: contain; display: none; background: #000; }
  .stage img.placeholder { object-fit: contain; }
  .sub { position: absolute; left: 0; right: 0; bottom: 6%; text-align: center; color: #fff; font-size: 20px; text-shadow: 0 1px 4px rgba(0,0,0,.9); padding: 0 16px; display: none; }
  .lock { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,.82); text-align: center; padding: 24px; z-index: 5; }
  .lock .price { font-size: 28px; font-weight: 700; color: #f0c36d; margin-bottom: 8px; }
  .lock .msg { color: #cfcfcf; font-size: 14px; margin-bottom: 14px; line-height: 1.6; }
  .lock input { width: 220px; padding: 10px 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; font-size: 14px; text-align: center; outline: none; }
  .lock input:focus { border-color: #f0c36d; }
  .lock button { margin-top: 10px; padding: 10px 28px; border: none; border-radius: 8px; background: #f0c36d; color: #1a1a1a; font-size: 14px; font-weight: 600; cursor: pointer; }
  .controls { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
  .controls button { padding: 8px 18px; border: none; border-radius: 8px; background: #2a2a2a; color: #fff; font-size: 13px; cursor: pointer; }
  .controls button:hover { background: #3a3a3a; }
  .controls .time { color: #9a9a9a; font-size: 12px; }
  .bar { flex: 1; height: 4px; border-radius: 2px; background: #333; overflow: hidden; cursor: pointer; }
  .bar i { display: block; height: 100%; width: 0; background: #f0c36d; }
  .meta { margin-top: 16px; color: #8a8a8a; font-size: 12px; display: flex; gap: 16px; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 6px; background: #2a2a2a; font-size: 11px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  ${author ? `<div class="author">${escapeHtml(author)}</div>` : ''}
  ${descriptionHtml ? `<div class="desc">${descriptionHtml}</div>` : ''}
  <div class="stage">
    <video id="pv" playsinline></video>
    <img id="pi" alt="" />
    <div class="sub" id="sub"></div>
    ${hasPaid ? `
    <div class="lock" id="lock">
      <div class="price" id="lockPrice"></div>
      <div class="msg" id="lockMsg"></div>
      <input id="lockInput" placeholder="输入解锁码" />
      <button id="lockBtn">解锁完整内容</button>
    </div>` : ''}
  </div>
  <div class="controls">
    <button id="playBtn">▶ 播放</button>
    <span class="time" id="time">00:00 / ${fmtTime(totalDuration)}</span>
    <div class="bar" id="bar"><i id="barFill"></i></div>
  </div>
  <div class="meta">
    <span class="tag">时长 ${fmtTime(totalDuration)}</span>
    <span class="tag">${playlist.length} 个片段</span>
    ${hasPaid ? `<span class="tag">${paidClipCount} 个付费片段</span>` : '<span class="tag">免费观看</span>'}
  </div>
</div>
<script>
var clips = ${clipsJson};
var previewSeconds = ${previewSeconds};
var unlockCodeHash = ${escapeJs(unlockCodeHash || '')};
var paymentNote = ${escapeJs(paymentNote || '')};
var hasPaid = ${hasPaid};
var wholePrice = ${typeof wholePrice === 'number' && wholePrice > 0 ? wholePrice : 0};
var vid = document.getElementById('pv');
var img = document.getElementById('pi');
var sub = document.getElementById('sub');
var lock = document.getElementById('lock');
var lockPrice = document.getElementById('lockPrice');
var lockMsg = document.getElementById('lockMsg');
var lockInput = document.getElementById('lockInput');
var playBtn = document.getElementById('playBtn');
var timeEl = document.getElementById('time');
var barFill = document.getElementById('barFill');
var bar = document.getElementById('bar');
var idx = 0, t = 0, playing = false, unlocked = false, timer = null, audioEl = null;

async function sha256Hex(str) {
  var enc = new TextEncoder().encode(str);
  var buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  var m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
}

function totalDuration() {
  var sum = 0; clips.forEach(function (c) { sum += c.dur; }); return sum;
}

function stopPlay() {
  playing = false;
  if (timer) { clearTimeout(timer); timer = null; }
  if (audioEl) { audioEl.pause(); audioEl = null; }
  vid.pause();
  playBtn.textContent = '▶ 播放';
}

function lockAt(clip) {
  stopPlay();
  if (unlockCodeHash) {
    lockPrice.textContent = '';
    lockMsg.textContent = '本段为付费内容，输入解锁码后即可观看完整内容。';
    lockInput.style.display = 'block';
    lockBtn.textContent = '解锁完整内容';
    lockBtn.onclick = async function () {
      var inputVal = lockInput.value.trim();
      if (!inputVal) { lockMsg.textContent = '请输入解锁码'; return; }
      var hash = await sha256Hex(inputVal);
      if (hash === unlockCodeHash) {
        unlocked = true;
        lock.style.display = 'none';
        play();
      } else {
        lockMsg.textContent = '解锁码不正确，请重试。';
      }
    };
  } else {
    lockInput.style.display = 'none';
    // 价格优先展示整片价，其次片段单价（此前片段价因未透传恒为 undefined，价格永不显示）
    lockPrice.textContent = wholePrice > 0
      ? '¥' + wholePrice
      : (clip.paid && clip.price && clip.price > 0 ? '¥' + clip.price : '');
    lockMsg.textContent = paymentNote || '本段为付费内容，支持创作者解锁完整内容。';
    lockBtn.textContent = '关闭';
    lockBtn.onclick = function () { lock.style.display = 'none'; };
  }
  lock.style.display = 'flex';
}

function playClip(i) {
  idx = i;
  var c = clips[i];
  if (!c) { stopPlay(); return; }
  var timeOffset = 0;
  for (var k = 0; k < i; k++) timeOffset += clips[k].dur;
  if (c.paid && !unlocked && timeOffset >= previewSeconds) {
    lockAt(c);
    return;
  }
  if (c.sub) { sub.textContent = c.sub; sub.style.display = 'block'; }
  else sub.style.display = 'none';
  if (c.type === 'image') {
    vid.pause();
    vid.style.display = 'none';
    img.src = c.src;
    img.style.display = 'block';
    timer = setTimeout(next, c.dur * 1000);
  } else if (c.type === 'audio') {
    vid.pause(); vid.style.display = 'none'; img.style.display = 'none';
    audioEl = new Audio(c.src);
    try { audioEl.currentTime = c.trimStart; } catch (e) {}
    audioEl.play();
    timer = setTimeout(next, c.dur * 1000);
  } else {
    img.style.display = 'none';
    vid.style.display = 'block';
    vid.src = c.src;
    try { vid.currentTime = c.trimStart; } catch (e) {}
    vid.play();
    vid.ontimeupdate = function () {
      if (vid.currentTime - c.trimStart >= c.dur) {
        vid.ontimeupdate = null;
        next();
      }
    };
  }
  playing = true;
  playBtn.textContent = '⏸ 暂停';
  updateProgress();
}

function next() { playClip(idx + 1); }
function prev() { if (idx > 0) playClip(idx - 1); }

function play() {
  if (unlocked || !hasPaid) { playClip(0); return; }
  playClip(0);
}
function toggle() { playing ? pause() : play(); }
function pause() { stopPlay(); }

function updateProgress() {
  var total = totalDuration();
  var done = 0;
  for (var m = 0; m < idx; m++) done += clips[m].dur;
  if (vid.style.display === 'block' && clips[idx] && vid.currentTime) {
    done += Math.max(0, vid.currentTime - (clips[idx].trimStart || 0));
  }
  timeEl.textContent = fmt(done) + ' / ' + fmt(total);
  barFill.style.width = (total > 0 ? Math.min(100, done / total * 100) : 0) + '%';
}
var realTimer = setInterval(function () {
  if (playing) updateProgress();
}, 300);

playBtn.onclick = toggle;
bar.onclick = function (e) {
  var total = totalDuration();
  var rect = bar.getBoundingClientRect();
  var ratio = (e.clientX - rect.left) / rect.width;
  var target = ratio * total;
  var acc = 0;
  for (var k = 0; k < clips.length; k++) {
    if (acc + clips[k].dur >= target) { playClip(k); return; }
    acc += clips[k].dur;
  }
};
</script>
</body>
</html>
`
}

/** 导出付费播放器 HTML */
export async function exportVideoToPlayerHTML(
  data: VideoData,
  title: string,
  resolveAsset: ResolveAsset,
  opts?: { author?: string; unlockCode?: string; paymentNote?: string }
): Promise<string> {
  const playlist = await buildVideoPlaylist(data, resolveAsset)
  // 明文解锁码仅用于计算哈希，不写入导出物
  const unlockCodeHash = opts?.unlockCode ? await sha256Hex(opts.unlockCode) : ''
  return renderPlayerHTML({
    title,
    author: opts?.author || data.author,
    descriptionHtml: data.descriptionHtml,
    playlist,
    previewSeconds: freePreviewSeconds(data),
    wholePrice: data.wholePrice,
    paidClipCount: countPaidClips(data),
    unlockCodeHash,
    paymentNote: opts?.paymentNote,
  })
}

/** 渲染试看预览 HTML（仅前 N 秒，无付费遮罩） */
export function renderPreviewHTML(opts: {
  title: string
  author?: string
  playlist: PlaylistClip[]
  previewSeconds: number
}): string {
  const { title, author, playlist, previewSeconds } = opts
  // 裁剪到试看时长（0 表示无免费试看：不得兜底塞入片段，否则付费片段被免费泄露）
  let remain = previewSeconds > 0 ? previewSeconds : 0
  const previewList: PlaylistClip[] = []
  for (const c of playlist) {
    if (remain <= 0) break
    // 试看文件永不包含付费片段（即使试看秒数覆盖到付费区）
    if (c.paid) continue
    if (c.dur <= remain) {
      previewList.push(c)
      remain -= c.dur
    } else {
      previewList.push({ ...c, dur: remain })
      remain = 0
    }
  }
  const clipsJson = escapeJs(previewList.map((c) => ({
    type: c.type,
    src: c.src,
    dur: c.dur,
    trimStart: c.trimStart,
    sub: c.subtitle || '',
    transition: c.transition,
    paid: false,
  })))
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} · 试看</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #0f0f0f; color: #e5e5e5; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 20px; margin-bottom: 8px; }
  .hint { color: #8a8a8a; font-size: 12px; margin-bottom: 16px; }
  .stage { position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; }
  .stage video, .stage img { width: 100%; height: 100%; object-fit: contain; display: none; }
  .sub { position: absolute; left: 0; right: 0; bottom: 6%; text-align: center; color: #fff; font-size: 20px; text-shadow: 0 1px 4px rgba(0,0,0,.9); display: none; }
  .end { margin-top: 16px; text-align: center; color: #c8b47a; font-size: 14px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  ${author ? `<div class="hint">${escapeHtml(author)}</div>` : ''}
  <div class="hint">试看片段 · 完整内容请支持创作者后观看</div>
  <div class="stage">
    <video id="pv" playsinline></video>
    <img id="pi" alt="" />
    <div class="sub" id="sub"></div>
  </div>
  <div class="end" id="end" style="display:none">—— 试看结束，完整内容待解锁 ——</div>
</div>
<script>
var clips = ${clipsJson};
var vid = document.getElementById('pv');
var img = document.getElementById('pi');
var sub = document.getElementById('sub');
var end = document.getElementById('end');
var idx = 0;
function playClip(i) {
  idx = i;
  var c = clips[i];
  if (!c) { end.style.display = 'block'; return; }
  if (c.sub) { sub.textContent = c.sub; sub.style.display = 'block'; } else sub.style.display = 'none';
  if (c.type === 'image') {
    vid.style.display = 'none'; img.src = c.src; img.style.display = 'block';
    setTimeout(function () { playClip(idx + 1); }, c.dur * 1000);
  } else if (c.type === 'audio') {
    vid.style.display = 'none'; img.style.display = 'none';
    var au = new Audio(c.src);
    try { au.currentTime = c.trimStart; } catch (e) {}
    au.play();
    setTimeout(function () { playClip(idx + 1); }, c.dur * 1000);
  } else {
    img.style.display = 'none'; vid.style.display = 'block';
    vid.src = c.src;
    try { vid.currentTime = c.trimStart; } catch (e) {}
    vid.play();
    vid.ontimeupdate = function () {
      if (vid.currentTime - c.trimStart >= c.dur) { vid.ontimeupdate = null; playClip(idx + 1); }
    };
  }
}
playClip(0);
</script>
</body>
</html>
`
}

/** 导出试看预览 HTML */
export async function exportVideoPreviewHTML(
  data: VideoData,
  title: string,
  resolveAsset: ResolveAsset
): Promise<string> {
  const playlist = await buildVideoPlaylist(data, resolveAsset)
  return renderPreviewHTML({
    title,
    author: data.author,
    playlist,
    previewSeconds: freePreviewSeconds(data),
  })
}

/** 生成 B 站互动视频分 P 脚本（CSV） */
export function exportVideoToBiliScript(data: VideoData, title: string): string {
  const clips = [...data.clips].sort((a, b) => a.order - b.order)
  const rows: string[] = []
  rows.push('分P序号,标题,素材文件,起止(秒),时长(秒),字幕')
  clips.forEach((c, i) => {
    const name = c.assetName || `${c.type}片段${i + 1}`
    const range = `${fmtNum(c.trimStart)}-${c.trimEnd > 0 ? fmtNum(c.trimEnd) : '结尾'}`
    rows.push(`${i + 1},"${escapeCsv(c.subtitle || name)}","${escapeCsv(name)}","${range}",${fmtNum(c.duration)},"${escapeCsv(c.subtitle || '')}"`)
  })
  return rows.join('\n')
}

function fmtNum(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0'
}

function escapeCsv(s: string): string {
  return s.replace(/"/g, '""')
}
