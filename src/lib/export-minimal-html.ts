/**
 * 极简文字运行时生成器
 *
 * 为 StoryGraph 生成纯文字流风格的 HTML 运行时。
 * 无角色立绘、无场景图，仅保留文字和选择按钮。
 */
import type { StoryGraph } from '@editor/types/editor'
import { embedAssets } from './export-html'

function generateMinimalRuntimeCSS(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Noto Serif SC", Georgia, "Times New Roman", serif;
      background: #0d0d0d;
      color: #d4d4d4;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      line-height: 1.8;
    }
    .story-container {
      max-width: 640px;
      width: 100%;
      padding: 60px 24px 120px;
      position: relative;
    }
    .story-header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 32px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .story-header .title {
      font-size: 28px;
      font-weight: 700;
      color: #f0f0f0;
      letter-spacing: 2px;
    }
    .story-header .subtitle {
      font-size: 14px;
      color: rgba(255,255,255,0.4);
      margin-top: 8px;
    }
    .text-flow {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .paragraph {
      font-size: 17px;
      line-height: 2;
      color: #c4c4c4;
      opacity: 0;
      transform: translateY(12px);
      animation: fadeInUp 0.6s ease-out forwards;
      margin-bottom: 8px;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dialogue-line {
      padding: 12px 0;
      border-left: 2px solid rgba(255,255,255,0.1);
      padding-left: 16px;
      margin: 8px 0;
    }
    .dialogue-line .speaker {
      font-size: 13px;
      color: #a0a0a0;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .dialogue-line .content {
      font-size: 16px;
      color: #d0d0d0;
    }
    .choices-section {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(13,13,13,0.95) 30%, rgba(13,13,13,1));
      padding: 40px 24px 32px;
      display: none;
      flex-direction: column;
      gap: 10px;
      z-index: 10;
    }
    .choices-section.active { display: flex; }
    .choices-section .choices-inner {
      max-width: 640px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .choice-btn {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #c4c4c4;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      text-align: left;
      transition: all 0.25s;
      font-family: inherit;
    }
    .choice-btn:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.25);
      color: #f0f0f0;
      transform: translateX(4px);
    }
    .ending-section {
      text-align: center;
      padding: 60px 0;
    }
    .ending-section .ending-title {
      font-size: 24px;
      font-weight: 700;
      color: #f0f0f0;
      margin-bottom: 12px;
    }
    .ending-section .ending-text {
      font-size: 16px;
      color: rgba(255,255,255,0.5);
      line-height: 1.8;
    }
    .restart-btn {
      display: inline-block;
      margin-top: 32px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #a0a0a0;
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .restart-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #f0f0f0;
    }
    .back-btn {
      position: fixed;
      top: 16px;
      left: 16px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      z-index: 20;
      transition: all 0.2s;
    }
    .back-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #c4c4c4;
    }
  `
}

function generateMinimalRuntimeJS(): string {
  return `
    const storyData = window.STORY_DATA;
    let currentNode = null;
    let history = [];
    let renderedNodes = new Set();

    const el = (id) => document.getElementById(id);
    const textFlow = el('text-flow');
    const choicesSection = el('choices-section');
    const choicesInner = el('choices-inner');
    const backBtn = el('back-btn');

    function init() {
      const firstNode = storyData.nodes[0];
      if (firstNode) navigateTo(firstNode.id);
      backBtn.addEventListener('click', goBack);
    }

    function navigateTo(nodeId) {
      const node = storyData.nodes.find(n => n.id === nodeId);
      if (!node) return;

      if (currentNode && currentNode.type !== 'choice') {
        history.push(currentNode.id);
      }
      currentNode = node;
      choicesSection.classList.remove('active');
      renderNode(node);
    }

    function goBack() {
      if (history.length === 0) return;
      const prevId = history.pop();
      if (prevId) {
        const node = storyData.nodes.find(n => n.id === prevId);
        if (node) {
          currentNode = node;
          choicesSection.classList.remove('active');
          // 清除当前节点的渲染并重新渲染
          renderNode(node);
        }
      }
    }

    function renderNode(node) {
      const data = node.data || {};

      switch (node.type) {
        case 'narration':
          appendText(data.text || '', 'narration');
          autoNext(node);
          break;
        case 'dialogue':
          appendDialogue(data.text || '', data.characterId);
          autoNext(node);
          break;
        case 'choice':
          showChoices(data.options || []);
          break;
        case 'ending':
          appendEnding(data.title || '终', data.text || '');
          break;
        case 'gather':
        case 'condition':
        case 'jump':
        case 'random':
          autoNext(node);
          break;
        default:
          autoNext(node);
      }
    }

    function appendText(text, type) {
      const p = document.createElement('div');
      p.className = 'paragraph';
      p.textContent = text;
      p.style.animationDelay = '0.1s';
      textFlow.appendChild(p);
      scrollToBottom();
    }

    function appendDialogue(text, characterId) {
      const div = document.createElement('div');
      div.className = 'dialogue-line';
      let speakerName = '';
      if (characterId && storyData.characters) {
        const char = storyData.characters.find(c => c.id === characterId);
        speakerName = char ? char.name : characterId;
      }
      div.innerHTML = '<div class="speaker">' + escapeHTML(speakerName) + '</div><div class="content">' + escapeHTML(text) + '</div>';
      textFlow.appendChild(div);
      scrollToBottom();
    }

    function showChoices(options) {
      choicesSection.classList.add('active');
      choicesInner.innerHTML = '';
      options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = opt.text || opt.label || ('选项 ' + (i + 1));
        btn.addEventListener('click', () => {
          const edges = storyData.edges.filter(e => e.source === currentNode.id);
          const matched = edges.find(e => e.label === opt.id) || edges[i];
          if (matched) {
            // 在文字流中追加选择结果
            appendText('> ' + (opt.text || opt.label || ''), 'choice-result');
            navigateTo(matched.target);
          }
        });
        choicesInner.appendChild(btn);
      });
      scrollToBottom();
    }

    function appendEnding(title, text) {
      const div = document.createElement('div');
      div.className = 'ending-section';
      div.innerHTML = '<div class="ending-title">' + escapeHTML(title) + '</div><div class="ending-text">' + escapeHTML(text) + '</div>';
      const restartBtn = document.createElement('button');
      restartBtn.className = 'restart-btn';
      restartBtn.textContent = '重新开始';
      restartBtn.addEventListener('click', () => {
        textFlow.innerHTML = '';
        history = [];
        renderedNodes.clear();
        const firstNode = storyData.nodes[0];
        if (firstNode) navigateTo(firstNode.id);
      });
      div.appendChild(restartBtn);
      textFlow.appendChild(div);
      scrollToBottom();
    }

    function autoNext(node) {
      const edges = storyData.edges.filter(e => e.source === node.id);
      if (edges.length === 1) {
        setTimeout(() => navigateTo(edges[0].target), 800);
      } else if (edges.length > 1) {
        // 多个出口但不含 choice 类型，取第一条
        setTimeout(() => navigateTo(edges[0].target), 800);
      }
    }

    function scrollToBottom() {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    }

    function escapeHTML(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    init();
  `
}

export async function exportToMinimalHTML(graph: StoryGraph): Promise<string> {
  const embeddedGraph = await embedAssets(graph)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(graph.title || '文字故事')}</title>
  <style>${generateMinimalRuntimeCSS()}</style>
</head>
<body>
  <button class="back-btn" id="back-btn">◀ 返回</button>
  <div class="story-container">
    <div class="story-header">
      <div class="title">${escapeHTML(graph.title || '未命名故事')}</div>
      ${graph.description ? '<div class="subtitle">' + escapeHTML(graph.description) + '</div>' : ''}
    </div>
    <div class="text-flow" id="text-flow"></div>
  </div>

  <div class="choices-section" id="choices-section">
    <div class="choices-inner" id="choices-inner"></div>
  </div>

  <script>
    window.STORY_DATA = ${JSON.stringify(embeddedGraph)};
  </script>
  <script>${generateMinimalRuntimeJS()}</script>
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
