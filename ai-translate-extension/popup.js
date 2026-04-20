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