/**
 * Content Script
 * 处理划词监听、翻译气泡/面板 UI、整页翻译 DOM 操作
 */

(function() {
  'use strict';

  // 状态
  let currentBubble = null;
  let currentPanel = null;
  let userPrefs = null;

  // 初始化
  async function init() {
    userPrefs = await chrome.runtime.sendMessage({ action: 'getUserPrefs' });
    setupSelectionListener();
    setupKeyboardShortcuts();
  }

  // 划词监听
  function setupSelectionListener() {
    document.addEventListener('mouseup', async (e) => {
      if (!userPrefs.triggerMode.bubbleButton && !userPrefs.triggerMode.instant) return;

      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (!text) return;

      // 延迟以获取完整选择
      setTimeout(() => {
        const freshText = window.getSelection().toString().trim();
        if (!freshText) return;

        if (userPrefs.triggerMode.instant) {
          showTranslation(freshText, e.clientX, e.clientY);
        } else if (userPrefs.triggerMode.bubbleButton) {
          showBubbleButton(freshText, e.clientX, e.clientY);
        }
      }, 10);
    });
  }

  // 快捷键
  function setupKeyboardShortcuts() {
    if (!userPrefs.triggerMode.shortcut) return;
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'T' && !e.shiftKey) {
        const text = window.getSelection().toString().trim();
        if (text) {
          e.preventDefault();
          const range = window.getSelection().getRangeAt(0);
          const rect = range.getBoundingClientRect();
          showTranslation(text, rect.left + rect.width / 2, rect.bottom + 10);
        }
      }
    });
  }

  // 显示气泡按钮
  function showBubbleButton(text, x, y) {
    removeBubbleButton();
    const btn = document.createElement('div');
    btn.className = 'ai-translate-bubble-btn';
    btn.innerHTML = '&#x1F4DA;'; // 翻译图标
    btn.style.cssText = `position:fixed;left:${x}px;top:${y + 20}px;z-index:2147483647;cursor:pointer;width:32px;height:32px;border-radius:50%;background:#4A90D9;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
    btn.title = '点击翻译';
    btn.addEventListener('click', () => {
      showTranslation(text, x, y + 20);
      removeBubbleButton();
    });
    document.body.appendChild(btn);
    currentBubble = btn;
  }

  function removeBubbleButton() {
    if (currentBubble) {
      currentBubble.remove();
      currentBubble = null;
    }
  }

  // 显示翻译结果
  async function showTranslation(text, x, y) {
    removeBubbleButton();

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text,
        url: location.href,
        sourceLang: userPrefs.sourceLang
      });

      if (response.error) throw new Error(response.error);

      switch (userPrefs.displayStyle) {
        case 'panel':
          showPanel(response.result, response.detectedLang);
          break;
        case 'inline':
          showInline(text, response.result, x, y);
          break;
        default:
          showBubble(text, response.result, x, y);
      }
    } catch (err) {
      showError(err.message, x, y);
    }
  }

  // 气泡样式
  function showBubble(originalText, translatedText, x, y) {
    const bubble = document.createElement('div');
    bubble.className = 'ai-translate-bubble';
    bubble.innerHTML = `
      <div class="ai-translate-bubble-header">
        <span class="ai-translate-lang">${userPrefs.targetLang}</span>
        <button class="ai-translate-close">&times;</button>
      </div>
      <div class="ai-translate-content">${escapeHtml(translatedText)}</div>
    `;
    document.body.appendChild(bubble);

    // 定位（避免超出视口）
    const rect = bubble.getBoundingClientRect();
    let left = x - rect.width / 2;
    let top = y + 10;
    if (left < 10) left = 10;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
    if (top + rect.height > window.innerHeight) top = y - rect.height - 10;

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;

    bubble.querySelector('.ai-translate-close').onclick = () => bubble.remove();

    if (currentBubble) currentBubble.remove();
    currentBubble = bubble;
  }

  // 侧边面板样式
  function showPanel(translatedText, detectedLang) {
    if (currentPanel) currentPanel.remove();
    const panel = document.createElement('div');
    panel.className = 'ai-translate-panel';
    panel.innerHTML = `
      <div class="ai-translate-panel-header">
        <span>翻译结果 ${detectedLang !== 'auto' ? `[${detectedLang}]` : ''}</span>
        <button class="ai-translate-close">&times;</button>
      </div>
      <div class="ai-translate-panel-content">${escapeHtml(translatedText)}</div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.ai-translate-close').onclick = () => panel.remove();
    currentPanel = panel;
  }

  // 原生下嵌样式
  function showInline(originalText, translatedText, x, y) {
    const container = document.createElement('div');
    container.className = 'ai-translate-inline';
    container.innerHTML = `
      <div class="ai-translate-inline-result">${escapeHtml(translatedText)}</div>
    `;
    // 插入到选中文字下方
    const range = window.getSelection().getRangeAt(0);
    range.collapse(false);
    range.insertNode(container);
  }

  // 错误显示
  function showError(msg, x, y) {
    const err = document.createElement('div');
    err.className = 'ai-translate-error';
    err.textContent = `翻译失败: ${msg}`;
    err.style.cssText = `position:fixed;left:${x}px;top:${y + 10}px;z-index:2147483647;background:#ff4444;color:#fff;padding:8px 16px;border-radius:4px;font-size:14px;max-width:300px;`;
    document.body.appendChild(err);
    setTimeout(() => err.remove(), 3000);
  }

  // HTML 转义
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translateSelection') {
      const text = window.getSelection().toString().trim();
      if (text) {
        const range = window.getSelection().getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showTranslation(text, rect.left + rect.width / 2, rect.bottom + 10);
      }
    }
    if (message.action === 'translatePage') {
      translatePage();
    }
  });

  // 整页翻译
  async function translatePage() {
    // TODO: 实现整页翻译逻辑
    alert('整页翻译功能待实现');
  }

  init();
})();
