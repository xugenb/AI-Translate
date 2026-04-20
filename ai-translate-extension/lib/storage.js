(function() {
  'use strict';

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
   * @returns {Promise<string>} JSON string of all configuration
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
   * @param {string} jsonStr JSON string containing apiConfig, userPrefs, and optionally sitePrefs
   * @returns {Promise<void>}
   */
  async function importConfig(jsonStr) {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Invalid JSON format');
    }
    if (!data.apiConfig || !data.userPrefs) {
      throw new Error('Missing required config fields');
    }
    await Promise.all([
      saveApiConfig(data.apiConfig),
      saveUserPrefs(data.userPrefs),
      new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.SITE_PREFS]: data.sitePrefs || {} }, resolve);
      })
    ]);
  }

  /**
   * 获取默认 API 配置
   * @returns {{providers: Array, activeProvider: string, apiKeys: Object}}
   */
  function getDefaultApiConfig() {
    return {
      providers: [
        // 国外模型
        { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], defaultModel: 'gpt-4o-mini' },
        { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-6', 'claude-opus-4-6'], defaultModel: 'claude-sonnet-4-6' },
        { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-pro-preview', 'gemini-2.0-flash'], defaultModel: 'gemini-2.0-flash' },
        // 国内模型
        { id: 'qwen', name: '阿里云通义千问', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'], defaultModel: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
        { id: 'deepseek', name: '深度求索 DeepSeek', models: ['deepseek-chat', 'deepseek-coder'], defaultModel: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' },
        { id: 'zhipu', name: '智谱 AI GLM', models: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-3-turbo'], defaultModel: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
        { id: 'baidu', name: '百度文心一言', models: ['ernie-4.0-8k-latest', 'ernie-4.0-8k-preview', 'ernie-3.5-8k-latest'], defaultModel: 'ernie-4.0-8k-latest', baseUrl: 'https://qianfan.ai.baidubce.com/v2' },
        { id: 'minimax', name: 'MiniMax', models: ['MiniMax-Text-01', 'abab6.5s-chat'], defaultModel: 'MiniMax-Text-01', baseUrl: 'https://api.minimax.chat/v1' },
        { id: 'moonshot', name: '月之暗面 Kimi', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], defaultModel: 'moonshot-v1-8k', baseUrl: 'https://api.moonshot.cn/v1' },
        { id: 'tencent', name: '腾讯混元', models: ['hunyuan-pro', 'hunyuan-standard', 'hunyuan-lite'], defaultModel: 'hunyuan-standard', baseUrl: 'https://hunyuan.cloud.tencent.com' }
      ],
      activeProvider: 'deepseek',
      apiKeys: { openai: '', anthropic: '', gemini: '', qwen: '', deepseek: '', zhipu: '', baidu: '', minimax: '', moonshot: '', tencent: '' }
    };
  }

  /**
   * 获取默认用户偏好
   * @returns {{triggerMode: Object, displayStyle: string, sourceLang: string, targetLang: string, rememberSitePref: boolean}}
   */
  function getDefaultUserPrefs() {
    return {
      triggerMode: { bubbleButton: true, instant: false, shortcut: true },
      displayStyle: 'bubble',  // 'bubble' | 'panel' | 'inline'
      sourceLang: 'auto',
      targetLang: 'zh',
      rememberSitePref: true
    };
  }
})();
