/**
 * Service Worker
 * 处理 API 调用、消息路由、快捷键、右键菜单
 */

(function() {
  'use strict';

  // 监听快捷键命令
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'translate-selection') {
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

  // ========== Storage Helpers ==========
  const STORAGE_KEYS = {
    API_CONFIG: 'apiConfig',
    USER_PREFS: 'userPrefs',
    SITE_PREFS: 'sitePrefs'
  };

  function storageGet(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (r) => resolve(r[key]));
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

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

  function getDefaultUserPrefs() {
    return {
      triggerMode: { bubbleButton: true, instant: false, shortcut: true },
      displayStyle: 'bubble',
      sourceLang: 'auto',
      targetLang: 'zh',
      rememberSitePref: true
    };
  }

  // ========== API Calls ==========
  /**
   * Translate text using OpenAI API
   * @param {string} text - Text to translate
   * @param {string} model - Model to use
   * @param {string} apiKey - API key for authentication
   * @param {string} sourceLang - Source language code or 'auto'
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} Translated text
   */
  async function translateWithOpenAI(text, model, apiKey, sourceLang, targetLang) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid OpenAI response structure');
    }
    return data.choices[0].message.content.trim();
  }

  /**
   * Translate text using Anthropic API
   * @param {string} text - Text to translate
   * @param {string} model - Model to use
   * @param {string} apiKey - API key for authentication
   * @param {string} sourceLang - Source language code or 'auto'
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} Translated text
   */
  async function translateWithAnthropic(text, model, apiKey, sourceLang, targetLang) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid Anthropic response structure');
    }
    return data.content[0].text.trim();
  }

  /**
   * Translate text using Google Gemini API
   * @param {string} text - Text to translate
   * @param {string} model - Model to use
   * @param {string} apiKey - API key for authentication
   * @param {string} sourceLang - Source language code or 'auto'
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} Translated text
   */
  async function translateWithGemini(text, model, apiKey, sourceLang, targetLang) {
    const langInstruction = sourceLang === 'auto'
      ? `Translate to ${targetLang}`
      : `Translate from ${sourceLang} to ${targetLang}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      throw new Error('Invalid Gemini response structure');
    }
    return data.candidates[0].content.parts[0].text.trim();
  }

  /**
   * Route translation to the appropriate provider
   * @param {string} text - Text to translate
   * @param {string} provider - Provider ID (openai, anthropic, gemini, or custom_*)
   * @param {string} model - Model to use
   * @param {string} apiKey - API key for authentication
   * @param {string} sourceLang - Source language code or 'auto'
   * @param {string} targetLang - Target language code
   * @param {string} baseUrl - Base URL for custom providers (optional)
   * @returns {Promise<string>} Translated text
   */
  async function doTranslate(text, provider, model, apiKey, sourceLang, targetLang, baseUrl) {
    switch (provider) {
      case 'openai': return translateWithOpenAI(text, model, apiKey, sourceLang, targetLang);
      case 'anthropic': return translateWithAnthropic(text, model, apiKey, sourceLang, targetLang);
      case 'gemini': return translateWithGemini(text, model, apiKey, sourceLang, targetLang);
      default:
        if (provider.startsWith('custom_')) {
          return translateWithCustom(text, model, apiKey, sourceLang, targetLang, baseUrl);
        }
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Translate text using a custom provider with OpenAI-compatible API
   * @param {string} text - Text to translate
   * @param {string} model - Model to use
   * @param {string} apiKey - API key for authentication
   * @param {string} sourceLang - Source language code or 'auto'
   * @param {string} targetLang - Target language code
   * @param {string} baseUrl - Custom API base URL
   * @returns {Promise<string>} Translated text
   */
  async function translateWithCustom(text, model, apiKey, sourceLang, targetLang, baseUrl) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const endpoint = baseUrl.endsWith('/') ? baseUrl + 'chat/completions' : baseUrl + '/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Custom API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid custom API response structure');
    }
    return data.choices[0].message.content.trim();
  }

  /**
   * Handle messages from content script
   * @param {Object} message - Message object with action and data
   * @param {Object} sender - Sender information
   * @returns {Promise<Object>} Response object
   */
  // ========== Message Handler ==========
  async function handleMessage(message, sender) {
    const { action, text, url } = message;

    if (action === 'getApiConfig') {
      const config = await storageGet(STORAGE_KEYS.API_CONFIG);
      return config || getDefaultApiConfig();
    }

    if (action === 'getUserPrefs') {
      const prefs = await storageGet(STORAGE_KEYS.USER_PREFS);
      return prefs || getDefaultUserPrefs();
    }

    if (action === 'saveApiConfig') {
      await storageSet(STORAGE_KEYS.API_CONFIG, message.config);
      return { success: true };
    }

    if (action === 'saveUserPrefs') {
      await storageSet(STORAGE_KEYS.USER_PREFS, message.prefs);
      return { success: true };
    }

    if (action === 'exportConfig') {
      const [apiConfig, userPrefs, sitePrefs] = await Promise.all([
        storageGet(STORAGE_KEYS.API_CONFIG),
        storageGet(STORAGE_KEYS.USER_PREFS),
        storageGet(STORAGE_KEYS.SITE_PREFS)
      ]);
      return JSON.stringify({
        apiConfig: apiConfig || getDefaultApiConfig(),
        userPrefs: userPrefs || getDefaultUserPrefs(),
        sitePrefs: sitePrefs || {}
      }, null, 2);
    }

    if (action === 'importConfig') {
      const data = JSON.parse(message.json);
      if (data.apiConfig) await storageSet(STORAGE_KEYS.API_CONFIG, data.apiConfig);
      if (data.userPrefs) await storageSet(STORAGE_KEYS.USER_PREFS, data.userPrefs);
      if (data.sitePrefs) await storageSet(STORAGE_KEYS.SITE_PREFS, data.sitePrefs);
      return { success: true };
    }

    if (action === 'testConnection') {
      const { provider, model, apiKey, baseUrl } = message;
      try {
        await doTranslate('test', provider, model, apiKey, 'en', 'zh', baseUrl);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    if (action === 'translate') {
      const apiConfig = await storageGet(STORAGE_KEYS.API_CONFIG) || getDefaultApiConfig();
      const userPrefs = await storageGet(STORAGE_KEYS.USER_PREFS) || getDefaultUserPrefs();
      const provider = apiConfig.providers.find(p => p.id === apiConfig.activeProvider);
      if (!provider) throw new Error(`Provider not found: ${apiConfig.activeProvider}`);
      if (!apiConfig.apiKeys[apiConfig.activeProvider]) throw new Error(`API key not set for ${apiConfig.activeProvider}`);

      let targetLang = userPrefs.targetLang;
      let sourceLang = message.sourceLang || 'auto';

      // 检查网站语言偏好
      if (url && userPrefs.rememberSitePref && sourceLang === 'auto') {
        try {
          const domain = new URL(url).hostname;
          const sitePrefs = await storageGet(STORAGE_KEYS.SITE_PREFS) || {};
          if (sitePrefs[domain]) {
            if (sitePrefs[domain].sourceLang) sourceLang = sitePrefs[domain].sourceLang;
            if (sitePrefs[domain].targetLang) targetLang = sitePrefs[domain].targetLang;
          }
        } catch (e) {
          console.error('AI Translate: Failed to parse URL for site pref', e.message);
        }
      }

      const result = await doTranslate(
        text,
        apiConfig.activeProvider,
        provider.defaultModel,
        apiConfig.apiKeys[apiConfig.activeProvider],
        sourceLang,
        targetLang,
        provider.baseUrl || null
      );
      return { result, detectedLang: sourceLang };
    }

    if (action === 'saveSitePref') {
      try {
        const domain = new URL(message.url).hostname;
        const sitePrefs = await storageGet(STORAGE_KEYS.SITE_PREFS) || {};
        sitePrefs[domain] = { sourceLang: message.sourceLang, targetLang: message.targetLang };
        await storageSet(STORAGE_KEYS.SITE_PREFS, sitePrefs);
      } catch (e) {
          console.error('AI Translate: Failed to parse URL for site pref', e.message);
        }
      return { success: true };
    }

    throw new Error(`Unknown action: ${action}`);
  }
})();