/**
 * 探索解谜运行时生成器
 *
 * 为 StoryGraph 中标记为 explore 模板的作品生成探索解谜风格的 HTML 运行时。
 * 包含场景图 + 可点击热点 + 物品栏的交互模式。
 */
import type { StoryGraph } from '@editor/types/editor'
import { embedAssets } from './export-html'

export interface ExploreHotspot {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  action: 'dialogue' | 'item' | 'scene-change'
  targetId: string
  description?: string
}

interface ExploreSceneData {
  sceneImage?: string
  hotspots?: ExploreHotspot[]
  inventoryItems?: string[]
  puzzleSceneId?: string
}

function generateExploreRuntimeCSS(): string {
  return `
    /* 探索解谜运行时样式 */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      overflow: hidden;
      height: 100vh;
      width: 100vw;
    }
    .explore-container {
      position: relative;
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .scene-area {
      flex: 1;
      position: relative;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      overflow: hidden;
    }
    .scene-area .bg-fallback {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      z-index: 0;
    }
    .scene-area .scene-image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      z-index: 1;
    }
    .hotspot {
      position: absolute;
      z-index: 10;
      cursor: pointer;
      transition: transform 0.2s, filter 0.2s;
    }
    .hotspot:hover {
      transform: scale(1.1);
      filter: brightness(1.3);
    }
    .hotspot .pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid rgba(255, 215, 0, 0.6);
      animation: hotspot-pulse 2s infinite;
    }
    .hotspot .dot {
      width: 16px;
      height: 16px;
      background: rgba(255, 215, 0, 0.8);
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    }
    .hotspot .label {
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: #ffd700;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .hotspot:hover .label { opacity: 1; }
    @keyframes hotspot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }
    .inventory-bar {
      height: 80px;
      background: rgba(0,0,0,0.8);
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 12px;
      z-index: 20;
      overflow-x: auto;
    }
    .inventory-item {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      border: 2px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
      position: relative;
    }
    .inventory-item:hover {
      border-color: #ffd700;
      background: rgba(255,215,0,0.1);
    }
    .inventory-item .item-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.9);
      color: #ffd700;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      margin-bottom: 4px;
    }
    .inventory-item:hover .item-tooltip { opacity: 1; }
    .dialogue-overlay {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      background: rgba(0,0,0,0.9);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 20px 24px;
      max-width: 600px;
      width: 90%;
      display: none;
    }
    .dialogue-overlay.active { display: block; }
    .dialogue-overlay .character-name {
      color: #ffd700;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .dialogue-overlay .text {
      color: #e0e0e0;
      font-size: 16px;
      line-height: 1.6;
    }
    .dialogue-overlay .continue-hint {
      color: rgba(255,255,255,0.4);
      font-size: 12px;
      text-align: right;
      margin-top: 12px;
      animation: blink 1.5s infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    .choices-overlay {
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      display: none;
      flex-direction: column;
      gap: 8px;
      max-width: 500px;
      width: 90%;
    }
    .choices-overlay.active { display: flex; }
    .choice-btn {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #e0e0e0;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }
    .choice-btn:hover {
      background: rgba(255,215,0,0.15);
      border-color: #ffd700;
      color: #ffd700;
    }
    .back-btn {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 40;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.2);
      color: #e0e0e0;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .back-btn:hover {
      background: rgba(255,255,255,0.1);
      border-color: #ffd700;
    }
  `
}

function generateExploreRuntimeJS(): string {
  return `
    // 探索解谜运行时引擎
    const storyData = window.STORY_DATA;
    let currentNode = null;
    let inventory = new Set();
    let history = [];
    let currentScene = null;

    const el = (id) => document.getElementById(id);
    const sceneArea = el('scene-area');
    const sceneBg = el('scene-bg');
    const hotspotsLayer = el('hotspots-layer');
    const dialogueOverlay = el('dialogue-overlay');
    const dialogueText = el('dialogue-text');
    const dialogueChar = el('dialogue-char');
    const choicesOverlay = el('choices-overlay');
    const choicesList = el('choices-list');
    const inventoryBar = el('inventory-bar');
    const backBtn = el('back-btn');

    // 初始化
    function init() {
      const firstNode = storyData.nodes[0];
      if (firstNode) navigateTo(firstNode.id);
      backBtn.addEventListener('click', goBack);
      dialogueOverlay.addEventListener('click', () => {
        hideDialogue();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideDialogue();
        if (e.key === 'Enter' && dialogueOverlay.classList.contains('active')) hideDialogue();
      });
    }

    function navigateTo(nodeId) {
      const node = storyData.nodes.find(n => n.id === nodeId);
      if (!node) return;
      history.push(currentNode ? currentNode.id : null);
      currentNode = node;
      renderNode(node);
    }

    function goBack() {
      if (history.length === 0) return;
      const prevId = history.pop();
      if (prevId) {
        const node = storyData.nodes.find(n => n.id === prevId);
        if (node) {
          currentNode = node;
          renderNode(node);
        }
      }
    }

    function renderNode(node) {
      const data = node.data || {};
      const type = node.type;

      // 更新场景背景
      if (data.sceneImage) {
        sceneBg.style.backgroundImage = 'url(' + data.sceneImage + ')';
      } else if (data.sceneId && storyData.scenes) {
        const scene = storyData.scenes.find(s => s.id === data.sceneId);
        if (scene && scene.puzzleData && scene.puzzleData.layers) {
          const bgLayer = scene.puzzleData.layers.find(l => l.type === 'background');
          if (bgLayer) sceneBg.style.backgroundImage = 'url(' + bgLayer.src + ')';
        }
      }

      // 渲染热点
      renderHotspots(data.hotspots || []);

      switch (type) {
        case 'dialogue':
          showDialogue(data.text || '', data.characterId);
          break;
        case 'narration':
          showDialogue(data.text || '', null);
          break;
        case 'choice':
          showChoices(data.options || []);
          break;
        case 'ending':
          showDialogue(data.text || data.title || '故事结束', null);
          choicesOverlay.classList.remove('active');
          break;
        case 'gather':
          if (data.itemId) {
            inventory.add(data.itemId);
            renderInventory();
            showDialogue('获得了物品：' + (data.itemName || data.itemId), null);
          }
          // 自动进入下一个节点
          autoNext(node);
          break;
        case 'condition':
          const expr = data.expression || '';
          const result = evaluateExpression(expr);
          const edge = storyData.edges.find(e => e.source === node.id && e.label === (result ? 'true' : 'false'));
          if (edge) navigateTo(edge.target);
          else autoNext(node);
          return;
        case 'jump':
          const jumpEdge = storyData.edges.find(e => e.source === node.id);
          if (jumpEdge) navigateTo(jumpEdge.target);
          return;
        default:
          autoNext(node);
          return;
      }
    }

    function autoNext(node) {
      const edge = storyData.edges.find(e => e.source === node.id);
      if (edge) {
        setTimeout(() => navigateTo(edge.target), 1500);
      }
    }

    function showDialogue(text, characterId) {
      choicesOverlay.classList.remove('active');
      dialogueOverlay.classList.add('active');
      dialogueText.textContent = text || '';
      if (characterId) {
        const char = (storyData.characters || []).find(c => c.id === characterId);
        dialogueChar.textContent = char ? char.name : characterId;
        dialogueChar.style.display = 'block';
      } else {
        dialogueChar.style.display = 'none';
      }
    }

    function hideDialogue() {
      dialogueOverlay.classList.remove('active');
      if (currentNode) autoNext(currentNode);
    }

    function showChoices(options) {
      dialogueOverlay.classList.remove('active');
      choicesOverlay.classList.add('active');
      choicesList.innerHTML = '';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = opt.text || opt.id;
        btn.addEventListener('click', () => {
          const edge = storyData.edges.find(e => e.source === currentNode.id && e.label === opt.id);
          if (edge) {
            choicesOverlay.classList.remove('active');
            navigateTo(edge.target);
          } else {
            // 尝试按 option index 匹配
            const edges = storyData.edges.filter(e => e.source === currentNode.id);
            const idx = options.indexOf(opt);
            if (edges[idx]) {
              choicesOverlay.classList.remove('active');
              navigateTo(edges[idx].target);
            }
          }
        });
        choicesList.appendChild(btn);
      });
    }

    function renderHotspots(hotspots) {
      hotspotsLayer.innerHTML = '';
      hotspots.forEach(h => {
        const el = document.createElement('div');
        el.className = 'hotspot';
        el.style.left = h.x + '%';
        el.style.top = h.y + '%';
        el.innerHTML = '<div class="pulse"></div><div class="dot"></div><div class="label">' + (h.label || '') + '</div>';
        el.addEventListener('click', () => {
          if (h.action === 'dialogue' && h.targetId) {
            navigateTo(h.targetId);
          } else if (h.action === 'item' && h.targetId) {
            inventory.add(h.targetId);
            renderInventory();
            showDialogue('发现了 ' + (h.label || h.targetId), null);
          } else if (h.action === 'scene-change' && h.targetId) {
            navigateTo(h.targetId);
          }
        });
        hotspotsLayer.appendChild(el);
      });
    }

    function renderInventory() {
      inventoryBar.innerHTML = '';
      inventory.forEach(itemId => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.innerHTML = '<span style="font-size:24px">📦</span><span class="item-tooltip">' + itemId + '</span>';
        inventoryBar.appendChild(div);
      });
      if (inventory.size === 0) {
        inventoryBar.innerHTML = '<span style="color:rgba(255,255,255,0.3);font-size:13px">物品栏为空</span>';
      }
    }

    function evaluateExpression(expr) {
      if (!expr) return true;
      try {
        // 简单的变量替换
        let evalStr = expr;
        (storyData.variables || []).forEach(v => {
          evalStr = evalStr.replace(new RegExp('\\\\b' + v.name + '\\\\b', 'g'), JSON.stringify(v.initialValue));
        });
        return !!eval(evalStr);
      } catch {
        return true;
      }
    }

    init();
  `
}

export async function exportToExploreHTML(graph: StoryGraph): Promise<string> {
  const embeddedGraph = await embedAssets(graph)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(graph.title || '探索故事')}</title>
  <style>${generateExploreRuntimeCSS()}</style>
</head>
<body>
  <div class="explore-container">
    <button class="back-btn" id="back-btn">◀ 返回</button>
    <div class="scene-area" id="scene-area">
      <div class="bg-fallback"></div>
      <div class="scene-image" id="scene-bg"></div>
      <div id="hotspots-layer"></div>
    </div>
    <div class="inventory-bar" id="inventory-bar">
      <span style="color:rgba(255,255,255,0.3);font-size:13px">物品栏为空</span>
    </div>
  </div>

  <div class="dialogue-overlay" id="dialogue-overlay">
    <div class="character-name" id="dialogue-char"></div>
    <div class="text" id="dialogue-text"></div>
    <div class="continue-hint">点击继续 ▸</div>
  </div>

  <div class="choices-overlay" id="choices-overlay">
    <div id="choices-list"></div>
  </div>

  <script>
    window.STORY_DATA = ${JSON.stringify(embeddedGraph)};
  </script>
  <script>${generateExploreRuntimeJS()}</script>
</body>
</html>`
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
