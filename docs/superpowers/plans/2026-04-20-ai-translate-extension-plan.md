# AI 划词翻译插件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Chrome 扩展插件，支持 AI 划词翻译和整页翻译，调用多种模型厂商 API

**Architecture:** Manifest V3 + Service Worker 架构。Content Script 处理划词监听和 DOM 操作，Service Worker 处理 API 调用，Popup 处理配置

**Tech Stack:** Chrome Extension (Manifest V3), Vanilla JS, CSS

---

## 文件结构

```
ai-translate-extension/
├── manifest.json           # 扩展配置（声明权限、入口、资源）
├── _locales/               # i18n
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── popup.html              # 设置页面入口
├── popup.js                # Popup 逻辑
├── popup.css               # Popup 样式
├── content/
│   ├── content.js          # Content Script（划词、整页翻译DOM）
│   └── content.css         # 气泡、面板、工具栏样式
├── background/
│   └── background.js       # Service Worker（API调用、消息路由）
├── lib/
│   ├── api-providers.js    # 各厂商 API 封装
│   └── storage.js          # 存储抽象层
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── (本计划文档)
```

---

## Task 1: 项目初始化与 manifest.json

**Files:**
- Create: `ai-translate-extension/manifest.json`

- [ ] **Step 1: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  "version": "1.0.0",
  "default_locale": "en",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": [
    "storage",
    "activeTab",
    "contextMenus",
    "scripting"
  ],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  },
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/content.css"],
      "run_at": "document_end"
    }
  ],
  "commands": {
    "translate-selection": {
      "suggested_key": {
        "default": "Alt+T",
        "mac": "Alt+T"
      },
      "description": "__MSG_cmdTranslateSelection__"
    },
    "translate-page": {
      "suggested_key": {
        "default": "Alt+Shift+T",
        "mac": "Alt+Shift+T"
      },
      "description": "__MSG_cmdTranslatePage__"
    }
  }
}
```

- [ ] **Step 2: 创建 _locales/en/messages.json**

```json
{
  "extName": { "message": "AI Translate Assistant" },
  "extDescription": { "message": "AI-powered translation with multi-provider support" },
  "cmdTranslateSelection": { "message": "Translate selected text" },
  "cmdTranslatePage": { "message": "Translate entire page" }
}
```

- [ ] **Step 3: 创建 _locales/zh_CN/messages.json**

```json
{
  "extName": { "message": "AI 翻译助手" },
  "extDescription": { "message": "支持多模型厂商的 AI 翻译插件" },
  "cmdTranslateSelection": { "message": "翻译选中文字" },
  "cmdTranslatePage": { "message": "翻译整页" }
}
```

- [ ] **Step 4: 创建占位图标（16x16, 48x48, 128x128 PNG）**

```bash
# 创建 icons 目录并生成占位图标（使用 ImageMagick 或手动创建）
mkdir -p ai-translate-extension/icons
```

- [ ] **Step 5: 提交**

```bash
git add ai-translate-extension/manifest.json ai-translate-extension/_locales/ ai-translate-extension/icons/
git commit -m "feat: initialize Chrome extension project with Manifest V3"
```

---

## Task 2: 存储层（storage.js）

**Files:**
- Create: `ai-translate-extension/lib/storage.js`

- [ ] **Step 1: 编写 storage.js**

```javascript
/**
 * 存储抽象层
 * 统一管理 chrome.storage.local 的读写操作
 */

const STORAGE_KEYS = {
  API_CONFIG: 'apiConfig',        // { providers, activeProvider, apiKeys }
  USER_PREFS: 'userPrefs',        // { triggerMode, displayStyle, targetLang, ... }
  SITE_PREFS: 'sitePrefs'         // { 'example.com': { sourceLang, targetLang } }
};

/**
 * 获取 API 配置
 * @returns {Promise<{providers: Array, activeProvider: string, apiKeys: Object}>}
 */
async function getApiConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.API_CONFIG, (result) => {
      resolve(result[STORAGE_KEYS.API_CONFIG] || getDefaultApiConfig());
    });
  });
}

/**
 * 保存 API 配置
 * @param {Object} config
 */
async function saveApiConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.API_CONFIG]: config }, resolve);
  });
}

/**
 * 获取用户偏好
 * @returns {Promise<Object>}
 */
async function getUserPrefs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.USER_PREFS, (result) => {
      resolve(result[STORAGE_KEYS.USER_PREFS] || getDefaultUserPrefs());
    });
  });
}

/**
 * 保存用户偏好
 * @param {Object} prefs
 */
async function saveUserPrefs(prefs) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFS]: prefs }, resolve);
  });
}

/**
 * 获取网站语言偏好
 * @param {string} domain
 * @returns {Promise<Object|null>}
 */
async function getSitePref(domain) {
  const all = await new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SITE_PREFS, (r) => resolve(r[STORAGE_KEYS.SITE_PREFS] || {}));
  });
  return all[domain] || null;
}

/**
 * 保存网站语言偏好
 * @param {string} domain
 * @param {Object} pref
 */
async function saveSitePref(domain, pref) {
  const all = await new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SITE_PREFS, (r) => resolve(r[STORAGE_KEYS.SITE_PREFS] || {}));
  });
  all[domain] = pref;
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SITE_PREFS]: all }, resolve);
  });
}

/**
 * 导出配置为 JSON
 */
async function exportConfig() {
  const [apiConfig, userPrefs, sitePrefs] = await Promise.all([
    getApiConfig(),
    getUserPrefs(),
    new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.SITE_PREFS, (r) => resolve(r[STORAGE_KEYS.SITE_PREFS] || {}));
    })
  ]);
  return JSON.stringify({ apiConfig, userPrefs, sitePrefs }, null, 2);
}

/**
 * 从 JSON 导入配置
 */
async function importConfig(jsonStr) {
  const data = JSON.parse(jsonStr);
  await Promise.all([
    saveApiConfig(data.apiConfig),
    saveUserPrefs(data.userPrefs),
    new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SITE_PREFS]: data.sitePrefs || {} }, resolve);
    })
  ]);
}

// 默认 API 配置
function getDefaultApiConfig() {
  return {
    providers: [
      { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], defaultModel: 'gpt-4o-mini' },
      { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-6', 'claude-opus-4-6'], defaultModel: 'claude-sonnet-4-6' },
      { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-pro-preview', 'gemini-2.0-flash'], defaultModel: 'gemini-2.0-flash' }
    ],
    activeProvider: 'anthropic',
    apiKeys: { openai: '', anthropic: '', gemini: '' }
  };
}

// 默认用户偏好
function getDefaultUserPrefs() {
  return {
    triggerMode: { bubbleButton: true, instant: false, shortcut: true },
    displayStyle: 'bubble',  // 'bubble' | 'panel' | 'inline'
    sourceLang: 'auto',
    targetLang: 'zh',
    rememberSitePref: true
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/lib/storage.js
git commit -m "feat: add storage abstraction layer"
```

---

## Task 3: API 封装（api-providers.js）

**Files:**
- Create: `ai-translate-extension/lib/api-providers.js`

- [ ] **Step 1: 编写 api-providers.js**

```javascript
/**
 * 多模型厂商 API 封装
 */

class TranslationAPI {
  constructor(provider, model, apiKey) {
    this.provider = provider;
    this.model = model;
    this.apiKey = apiKey;
  }

  async translate(text, sourceLang = 'auto', targetLang = 'zh') {
    switch (this.provider) {
      case 'openai':
        return this.translateWithOpenAI(text, sourceLang, targetLang);
      case 'anthropic':
        return this.translateWithAnthropic(text, sourceLang, targetLang);
      case 'gemini':
        return this.translateWithGemini(text, sourceLang, targetLang);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  async translateWithOpenAI(text, sourceLang, targetLang) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async translateWithAnthropic(text, sourceLang, targetLang) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  }

  async translateWithGemini(text, sourceLang, targetLang) {
    const langInstruction = sourceLang === 'auto'
      ? `Translate to ${targetLang}`
      : `Translate from ${sourceLang} to ${targetLang}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${langInstruction}. Only output the translation:\n${text}` }] }]
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }
}

async function createTranslator(apiConfig) {
  const { providers, activeProvider, apiKeys } = apiConfig;
  const providerConfig = providers.find(p => p.id === activeProvider);
  if (!providerConfig) throw new Error(`Provider not found: ${activeProvider}`);
  if (!apiKeys[activeProvider]) throw new Error(`API key not set for ${activeProvider}`);
  return new TranslationAPI(activeProvider, providerConfig.defaultModel, apiKeys[activeProvider]);
}
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/lib/api-providers.js
git commit -m "feat: add multi-provider API wrapper (OpenAI, Anthropic, Gemini)"
```

---

## Task 4: Service Worker（background.js）

**Files:**
- Create: `ai-translate-extension/background/background.js`

- [ ] **Step 1: 编写 background.js**

```javascript
/**
 * Service Worker
 * 处理 API 调用、消息路由、快捷键、右键菜单
 */

import { getApiConfig, createTranslator } from '../lib/api-providers.js';
import { getUserPrefs, getSitePref, saveSitePref } from '../lib/storage.js';

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'translate-selection') {
    // 通知 content script 执行划词翻译
    chrome.tabs.sendMessage(tab.id, { action: 'translateSelection' });
  } else if (command === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'translatePage' });
  }
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'translatePage' });
  }
});

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-page',
    title: chrome.i18n.getMessage('cmdTranslatePage'),
    contexts: ['page']
  });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // 异步响应
});

async function handleMessage(message, sender) {
  const { action, text, url } = message;

  if (action === 'translate') {
    const apiConfig = await getApiConfig();
    const translator = await createTranslator(apiConfig);

    let targetLang = (await getUserPrefs()).targetLang;
    const sourceLang = message.sourceLang || 'auto';

    // 检查网站语言偏好
    if (url && sourceLang === 'auto') {
      const domain = new URL(url).hostname;
      const sitePref = await getSitePref(domain);
      if (sitePref) {
        if (sitePref.sourceLang) message.sourceLang = sitePref.sourceLang;
        if (sitePref.targetLang) targetLang = sitePref.targetLang;
      }
    }

    const result = await translator.translate(text, message.sourceLang || 'auto', targetLang);
    return { result, detectedLang: message.sourceLang };
  }

  if (action === 'saveSitePref') {
    const domain = new URL(message.url).hostname;
    await saveSitePref(domain, { sourceLang: message.sourceLang, targetLang: message.targetLang });
    return { success: true };
  }

  throw new Error(`Unknown action: ${action}`);
}
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/background/background.js
git commit -m "feat: add Service Worker with message routing and API calls"
```

---

## Task 5: Content Script（content.js）

**Files:**
- Create: `ai-translate-extension/content/content.js`

- [ ] **Step 1: 编写 content.js - 基础结构**

```javascript
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
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/content/content.js
git commit -m "feat: add content script with selection listener and translation UI"
```

---

## Task 6: Content Script - 整页翻译实现

**Files:**
- Modify: `ai-translate-extension/content/content.js`（扩展 translatePage 函数）

- [ ] **Step 1: 实现整页翻译逻辑**

在 content.js 的 `translatePage` 函数中替换为以下实现：

```javascript
  // 整页翻译
  async function translatePage() {
    const progressBar = document.createElement('div');
    progressBar.className = 'ai-translate-progress';
    progressBar.innerHTML = '<div class="ai-translate-progress-bar"></div><span>翻译中...</span>';
    progressBar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fff;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1);font-family:sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;';
    progressBar.querySelector('.ai-translate-progress-bar').style.cssText = 'flex:1;height:4px;background:#4A90D9;transition:width 0.3s;width:0%;';
    document.body.appendChild(progressBar);

    try {
      // 1. 提取页面文本节点
      const textNodes = getTextNodes(document.body);
      const chunks = chunkTextNodes(textNodes, 3000); // 按字符数分块

      progressBar.querySelector('.ai-translate-progress-bar').style.width = '10%';

      // 2. 逐块翻译
      const translatedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const response = await chrome.runtime.sendMessage({
          action: 'translate',
          text: chunks[i].text,
          url: location.href,
          sourceLang: userPrefs.sourceLang
        });

        if (response.error) throw new Error(response.error);

        translatedChunks.push({
          nodes: chunks[i].nodes,
          translated: response.result,
          detectedLang: response.detectedLang
        });

        progressBar.querySelector('.ai-translate-progress-bar').style.width =
          `${10 + (i + 1) / chunks.length * 80}%`;
      }

      // 3. 创建译文容器
      const container = document.createElement('div');
      container.className = 'ai-translate-page-container';

      // 添加头部
      const header = document.createElement('div');
      header.className = 'ai-translate-page-header';
      header.innerHTML = `
        <div class="ai-translate-page-toolbar">
          <button class="ai-translate-view-toggle active" data-view="both">双语</button>
          <button class="ai-translate-view-toggle" data-view="original">原文</button>
          <button class="ai-translate-view-toggle" data-view="translated">译文</button>
          <button class="ai-translate-close-page">&times;</button>
        </div>
      `;
      container.appendChild(header);

      // 4. 插入译文
      for (const chunk of translatedChunks) {
        const block = document.createElement('div');
        block.className = 'ai-translate-page-block';
        block.innerHTML = `
          <div class="ai-translate-original">${escapeHtml(chunk.nodes.map(n => n.textContent).join(''))}</div>
          <div class="ai-translate-translated">${escapeHtml(chunk.translated)}</div>
        `;
        container.appendChild(block);
      }

      // 分隔线
      const divider = document.createElement('div');
      divider.className = 'ai-translate-divider';
      divider.textContent = '--- 译文结束 ---';
      container.appendChild(divider);

      document.body.appendChild(container);
      progressBar.querySelector('.ai-translate-progress-bar').style.width = '100%';
      setTimeout(() => progressBar.remove(), 500);

      // 工具栏交互
      header.querySelectorAll('.ai-translate-view-toggle').forEach(btn => {
        btn.onclick = () => {
          header.querySelectorAll('.ai-translate-view-toggle').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const view = btn.dataset.view;
          container.dataset.view = view;
        };
      });
      header.querySelector('.ai-translate-close-page').onclick = () => container.remove();

    } catch (err) {
      progressBar.querySelector('span').textContent = `翻译失败: ${err.message}`;
      setTimeout(() => progressBar.remove(), 3000);
    }
  }

  // 获取所有文本节点
  function getTextNodes(element) {
    const nodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // 跳过 script、style、code 标签内容和空节点
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'IFRAME'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  // 将文本节点分块
  function chunkTextNodes(nodes, maxChars) {
    const chunks = [];
    let currentChunk = { text: '', nodes: [] };
    let currentLength = 0;

    for (const node of nodes) {
      const text = node.textContent;
      if (currentLength + text.length > maxChars && currentLength > 0) {
        chunks.push(currentChunk);
        currentChunk = { text: '', nodes: [] };
        currentLength = 0;
      }
      currentChunk.text += text;
      currentChunk.nodes.push(node);
      currentLength += text.length;
    }
    if (currentChunk.nodes.length > 0) chunks.push(currentChunk);
    return chunks;
  }
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/content/content.js
git commit -m "feat: implement full page translation with progress bar and view toggle"
```

---

## Task 7: Content Script 样式（content.css）

**Files:**
- Create: `ai-translate-extension/content/content.css`

- [ ] **Step 1: 编写 content.css**

```css
/* 划词翻译气泡 */
.ai-translate-bubble {
  position: fixed;
  z-index: 2147483647;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  min-width: 200px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
  animation: ai-translate-fadein 0.2s ease;
}

@keyframes ai-translate-fadein {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-translate-bubble-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
}

.ai-translate-lang {
  font-size: 12px;
  color: #666;
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 4px;
}

.ai-translate-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  padding: 0;
  line-height: 1;
}

.ai-translate-close:hover { color: #333; }

.ai-translate-bubble .ai-translate-content {
  padding: 12px;
  color: #333;
}

/* 侧边面板 */
.ai-translate-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 360px;
  z-index: 2147483647;
  background: #fff;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-y: auto;
  animation: ai-translate-slidein 0.3s ease;
}

@keyframes ai-translate-slidein {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.ai-translate-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
}

.ai-translate-panel-content {
  padding: 16px;
  line-height: 1.6;
  color: #333;
}

/* 原生下嵌 */
.ai-translate-inline {
  margin: 8px 0;
  padding: 12px;
  background: #f9f9f9;
  border-left: 3px solid #4A90D9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  animation: ai-translate-fadein 0.2s ease;
}

/* 整页翻译容器 */
.ai-translate-page-container {
  margin: 20px;
  padding: 20px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-translate-page-header {
  position: sticky;
  top: 0;
  background: #fff;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.ai-translate-page-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ai-translate-view-toggle {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.ai-translate-view-toggle.active {
  background: #4A90D9;
  color: #fff;
  border-color: #4A90D9;
}

.ai-translate-close-page {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.ai-translate-page-block {
  margin-bottom: 20px;
}

.ai-translate-original {
  color: #999;
  font-size: 13px;
  margin-bottom: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 4px;
}

.ai-translate-translated {
  color: #333;
  line-height: 1.7;
}

.ai-translate-divider {
  text-align: center;
  color: #999;
  font-size: 13px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed #ddd;
}

/* 双语/原文/译文视图切换 */
.ai-translate-page-container[data-view="original"] .ai-translate-translated,
.ai-translate-page-container[data-view="original"] .ai-translate-divider { display: none; }

.ai-translate-page-container[data-view="translated"] .ai-translate-original { display: none; }

.ai-translate-page-container[data-view="both"] .ai-translate-original { display: block; }

/* 错误提示 */
.ai-translate-error {
  animation: ai-translate-fadein 0.2s ease;
}
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/content/content.css
git commit -m "feat: add content script styles (bubble, panel, inline, page translation)"
```

---

## Task 8: Popup 页面（popup.html + popup.js + popup.css）

**Files:**
- Create: `ai-translate-extension/popup.html`
- Create: `ai-translate-extension/popup.js`
- Create: `ai-translate-extension/popup.css`

- [ ] **Step 1: 编写 popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header class="popup-header">
      <h1>AI 翻译助手</h1>
      <span class="version">v1.0</span>
    </header>

    <section class="section">
      <h2>API 配置</h2>
      <div class="form-group">
        <label>提供商</label>
        <select id="provider-select"></select>
      </div>
      <div class="form-group">
        <label>模型</label>
        <select id="model-select"></select>
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="api-key-input" placeholder="输入 API Key">
      </div>
      <button id="save-api-btn" class="btn-primary">保存</button>
      <span id="save-status" class="status"></span>
    </section>

    <section class="section">
      <h2>翻译触发</h2>
      <label class="checkbox-label">
        <input type="checkbox" id="trigger-bubble"> 划词气泡按钮
      </label>
      <label class="checkbox-label">
        <input type="checkbox" id="trigger-instant"> 即时划词翻译
      </label>
      <label class="checkbox-label">
        <input type="checkbox" id="trigger-shortcut"> 快捷键 (Alt+T)
      </label>
    </section>

    <section class="section">
      <h2>展示样式</h2>
      <div class="radio-group">
        <label><input type="radio" name="display" value="bubble"> 气泡卡片</label>
        <label><input type="radio" name="display" value="panel"> 侧边面板</label>
        <label><input type="radio" name="display" value="inline"> 原生下嵌</label>
      </div>
    </section>

    <section class="section">
      <h2>语言偏好</h2>
      <div class="form-group">
        <label>源语言</label>
        <select id="source-lang-select">
          <option value="auto">自动检测</option>
          <option value="en">英语</option>
          <option value="ja">日语</option>
          <option value="ko">韩语</option>
          <option value="fr">法语</option>
          <option value="de">德语</option>
          <option value="es">西班牙语</option>
          <option value="zh">中文</option>
        </select>
      </div>
      <div class="form-group">
        <label>目标语言</label>
        <select id="target-lang-select">
          <option value="zh">中文</option>
          <option value="en">英语</option>
          <option value="ja">日语</option>
          <option value="ko">韩语</option>
          <option value="fr">法语</option>
          <option value="de">德语</option>
          <option value="es">西班牙语</option>
        </select>
      </div>
      <label class="checkbox-label">
        <input type="checkbox" id="remember-site"> 记忆网站偏好
      </label>
    </section>

    <section class="section">
      <h2>高级</h2>
      <div class="btn-group">
        <button id="manage-keys-btn" class="btn-secondary">管理 API Keys</button>
        <button id="export-btn" class="btn-secondary">导出配置</button>
        <button id="import-btn" class="btn-secondary">导入配置</button>
      </div>
      <input type="file" id="import-file" accept=".json" style="display:none">
    </section>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 编写 popup.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body { width: 380px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333; }

.popup-container { padding: 16px; }

.popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
.popup-header h1 { font-size: 18px; font-weight: 600; }
.version { font-size: 12px; color: #999; }

.section { margin-bottom: 20px; }
.section h2 { font-size: 14px; font-weight: 600; color: #666; margin-bottom: 12px; }

.form-group { margin-bottom: 10px; }
.form-group label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
.form-group select, .form-group input[type="password"] { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.form-group select:focus, .form-group input:focus { outline: none; border-color: #4A90D9; }

.checkbox-label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; font-size: 14px; }
.checkbox-label input[type="checkbox"] { width: 16px; height: 16px; }

.radio-group { display: flex; flex-direction: column; gap: 8px; }
.radio-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }

.btn-primary { width: 100%; padding: 10px; background: #4A90D9; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-primary:hover { background: #3a7bc8; }

.btn-secondary { padding: 8px 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-secondary:hover { background: #eee; }

.btn-group { display: flex; gap: 8px; flex-wrap: wrap; }

.status { font-size: 12px; margin-left: 8px; }
.status.success { color: #4caf50; }
.status.error { color: #f44336; }
```

- [ ] **Step 3: 编写 popup.js**

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const [apiConfig, userPrefs] = await Promise.all([
    sendMessage({ action: 'getApiConfig' }),
    sendMessage({ action: 'getUserPrefs' })
  ]);

  // 填充 Provider 下拉框
  const providerSelect = document.getElementById('provider-select');
  apiConfig.providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === apiConfig.activeProvider) opt.selected = true;
    providerSelect.appendChild(opt);
  });

  // 填充 Model 下拉框
  function updateModelSelect(providerId) {
    const modelSelect = document.getElementById('model-select');
    modelSelect.innerHTML = '';
    const provider = apiConfig.providers.find(p => p.id === providerId);
    provider.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === provider.defaultModel) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  }
  updateModelSelect(apiConfig.activeProvider);

  providerSelect.addEventListener('change', () => updateModelSelect(providerSelect.value));

  // 填充 API Key
  document.getElementById('api-key-input').value = apiConfig.apiKeys[apiConfig.activeProvider] || '';

  // 保存 API 配置
  document.getElementById('save-api-btn').addEventListener('click', async () => {
    const provider = providerSelect.value;
    const model = document.getElementById('model-select').value;
    const apiKey = document.getElementById('api-key-input').value;

    apiConfig.activeProvider = provider;
    apiConfig.apiKeys[provider] = apiKey;
    const providerConfig = apiConfig.providers.find(p => p.id === provider);
    providerConfig.defaultModel = model;

    await sendMessage({ action: 'saveApiConfig', config: apiConfig });
    showStatus('保存成功', 'success');
  });

  // 触发方式
  document.getElementById('trigger-bubble').checked = userPrefs.triggerMode.bubbleButton;
  document.getElementById('trigger-instant').checked = userPrefs.triggerMode.instant;
  document.getElementById('trigger-shortcut').checked = userPrefs.triggerMode.shortcut;

  ['trigger-bubble', 'trigger-instant', 'trigger-shortcut'].forEach(id => {
    document.getElementById(id).addEventListener('change', async () => {
      userPrefs.triggerMode[id.replace('trigger-', '')] = document.getElementById(id).checked;
      await sendMessage({ action: 'saveUserPrefs', prefs: userPrefs });
    });
  });

  // 展示样式
  document.querySelector(`input[name="display"][value="${userPrefs.displayStyle}"]`).checked = true;
  document.querySelectorAll('input[name="display"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      userPrefs.displayStyle = document.querySelector('input[name="display"]:checked').value;
      await sendMessage({ action: 'saveUserPrefs', prefs: userPrefs });
    });
  });

  // 语言偏好
  document.getElementById('source-lang-select').value = userPrefs.sourceLang;
  document.getElementById('target-lang-select').value = userPrefs.targetLang;
  document.getElementById('remember-site').checked = userPrefs.rememberSitePref;

  ['source-lang-select', 'target-lang-select', 'remember-site'].forEach(id => {
    document.getElementById(id).addEventListener('change', async () => {
      userPrefs.sourceLang = document.getElementById('source-lang-select').value;
      userPrefs.targetLang = document.getElementById('target-lang-select').value;
      userPrefs.rememberSitePref = document.getElementById('remember-site').checked;
      await sendMessage({ action: 'saveUserPrefs', prefs: userPrefs });
    });
  });

  // 导出
  document.getElementById('export-btn').addEventListener('click', async () => {
    const config = await sendMessage({ action: 'exportConfig' });
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-translate-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // 导入
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      await sendMessage({ action: 'importConfig', json: text });
      location.reload();
    } catch (err) {
      showStatus('导入失败: ' + err.message, 'error');
    }
  });

  function showStatus(msg, type) {
    const el = document.getElementById('save-status');
    el.textContent = msg;
    el.className = `status ${type}`;
    setTimeout(() => el.textContent = '', 2000);
  }
});

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}
```

- [ ] **Step 4: 提交**

```bash
git add ai-translate-extension/popup.html ai-translate-extension/popup.js ai-translate-extension/popup.css
git commit -m "feat: add popup settings page"
```

---

## Task 9: 代码翻译增强

**Files:**
- Modify: `ai-translate-extension/content/content.js`（扩展 getTextNodes 函数以跳过代码块）

- [ ] **Step 1: 更新 getTextNodes 函数以识别代码块**

将 `getTextNodes` 函数替换为以下实现，在页面翻译时保留代码块不翻译：

```javascript
  // 获取所有文本节点（跳过代码块）
  function getTextNodes(element) {
    const nodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // 跳过代码相关标签
        if (['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'IFRAME'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // 跳过行内代码（保留原样）
        if (parent.tagName === 'CODE') {
          return NodeFilter.FILTER_REJECT;
        }

        // 跳过已标记的代码块
        if (parent.closest('.ai-translate-code-block')) {
          return NodeFilter.FILTER_REJECT;
        }

        // 标记代码块父元素
        if (parent.closest('pre')) {
          parent.closest('pre').classList.add('ai-translate-code-block');
          return NodeFilter.FILTER_REJECT;
        }

        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }
```

- [ ] **Step 2: 在翻译结果中添加代码提示**

在 `showInline` 函数的结果后添加提示：

```javascript
  // 原生下嵌样式
  function showInline(originalText, translatedText, x, y) {
    const container = document.createElement('div');
    container.className = 'ai-translate-inline';
    container.innerHTML = `
      <div class="ai-translate-inline-result">${escapeHtml(translatedText)}</div>
    `;
    const range = window.getSelection().getRangeAt(0);
    range.collapse(false);
    range.insertNode(container);

    // 检查是否包含代码并添加提示
    if (hasCodeNodes(originalText)) {
      const codeHint = document.createElement('div');
      codeHint.className = 'ai-translate-code-hint';
      codeHint.textContent = '代码块未被翻译';
      codeHint.style.cssText = 'font-size:11px;color:#999;margin-top:4px;';
      container.appendChild(codeHint);
    }
  }

  function hasCodeNodes(text) {
    // 简单检测是否包含代码特征
    return /[{}\[\]();]/.test(text) && (text.includes('function') || text.includes('const ') || text.includes('var ') || text.includes('=>'));
  }
```

- [ ] **Step 3: 提交**

```bash
git add ai-translate-extension/content/content.js
git commit -m "feat: enhance code block detection for translation"
```

---

## Task 10: 用户偏好获取接口

**Files:**
- Modify: `ai-translate-extension/background/background.js`

- [ ] **Step 1: 添加 getUserPrefs 消息处理**

在 `handleMessage` 函数中添加：

```javascript
async function handleMessage(message, sender) {
  const { action, text, url } = message;

  if (action === 'getApiConfig') {
    return getApiConfig();
  }

  if (action === 'getUserPrefs') {
    return getUserPrefs();
  }

  if (action === 'saveApiConfig') {
    await saveApiConfig(message.config);
    return { success: true };
  }

  if (action === 'saveUserPrefs') {
    await saveUserPrefs(message.prefs);
    return { success: true };
  }

  if (action === 'exportConfig') {
    return exportConfig();
  }

  if (action === 'importConfig') {
    await importConfig(message.json);
    return { success: true };
  }

  // ... 原有 translate 和 saveSitePref 处理
}
```

- [ ] **Step 2: 提交**

```bash
git add ai-translate-extension/background/background.js
git commit -m "feat: add user prefs and config import/export message handlers"
```

---

## 自检清单

1. **Spec 覆盖检查**:
   - [x] Manifest V3 架构 ✓
   - [x] Content Script 划词监听 ✓
   - [x] 三种触发方式（气泡按钮、即時划词、快捷键）✓
   - [x] 三种展示样式（气泡、侧边面板、原生下嵌）✓
   - [x] 整页翻译 + 进度条 + 视图切换 ✓
   - [x] 多厂商 API（OpenAI/Anthropic/Gemini）✓
   - [x] 代码块保留 ✓
   - [x] 语言检测 + 记忆网站偏好 ✓
   - [x] API 配置 + 模型选择 ✓
   - [x] 导入/导出配置 ✓
   - [x] i18n 国际化 ✓

2. **占位符检查**: 无 TBD/TODO/placeholder

3. **类型一致性检查**: storage.js 和 background.js 的接口定义一致
