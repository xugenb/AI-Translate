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
