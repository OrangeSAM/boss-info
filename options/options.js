/**
 * BOSS直聘 JD采集助手 - 设置页脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const providerSelect = document.getElementById('provider');
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const apiEndpointGroup = document.getElementById('apiEndpointGroup');
  const resetBtn = document.getElementById('resetBtn');
  const messageEl = document.getElementById('message');

  /**
   * 模型选项配置
   */
  const modelOptions = {
    claude: [
      { value: 'claude-sonnet-4-20250514', text: 'Claude Sonnet 4 (推荐)' },
      { value: 'claude-opus-4-20250514', text: 'Claude Opus 4' },
      { value: 'claude-haiku-4-20250414', text: 'Claude Haiku 4' }
    ],
    openai: [
      { value: 'gpt-4', text: 'GPT-4' },
      { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
      { value: 'gpt-4o', text: 'GPT-4o (推荐)' },
      { value: 'gpt-4o-mini', text: 'GPT-4o Mini' }
    ]
  };

  /**
   * 显示消息
   */
  function showMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');

    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 3000);
  }

  /**
   * 更新模型选项
   */
  function updateModelOptions(provider) {
    const options = modelOptions[provider] || [];
    modelSelect.innerHTML = options.map(opt =>
      `<option value="${opt.value}">${opt.text}</option>`
    ).join('');
  }

  /**
   * 显示/隐藏自定义端点
   */
  function toggleApiEndpoint(provider) {
    if (provider === 'openai') {
      apiEndpointGroup.style.display = 'flex';
    } else {
      apiEndpointGroup.style.display = 'none';
    }
  }

  /**
   * 加载保存的设置
   */
  async function loadSettings() {
    const settings = await chrome.storage.sync.get([
      'provider', 'apiKey', 'model', 'apiEndpoint'
    ]);

    if (settings.provider) {
      providerSelect.value = settings.provider;
      updateModelOptions(settings.provider);
      toggleApiEndpoint(settings.provider);
    }

    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
    }

    if (settings.model) {
      modelSelect.value = settings.model;
    }

    if (settings.apiEndpoint) {
      apiEndpointInput.value = settings.apiEndpoint;
    }
  }

  /**
   * 保存设置
   */
  async function saveSettings(e) {
    e.preventDefault();

    const settings = {
      provider: providerSelect.value,
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      apiEndpoint: apiEndpointInput.value.trim()
    };

    // 验证
    if (!settings.apiKey) {
      showMessage('请输入API Key', 'error');
      return;
    }

    await chrome.storage.sync.set(settings);
    showMessage('设置已保存');
  }

  /**
   * 重置设置
   */
  async function resetSettings() {
    await chrome.storage.sync.clear();
    providerSelect.value = 'claude';
    apiKeyInput.value = '';
    updateModelOptions('claude');
    toggleApiEndpoint('claude');
    apiEndpointInput.value = '';
    showMessage('设置已重置');
  }

  // 事件监听
  form.addEventListener('submit', saveSettings);

  providerSelect.addEventListener('change', (e) => {
    const provider = e.target.value;
    updateModelOptions(provider);
    toggleApiEndpoint(provider);
  });

  resetBtn.addEventListener('click', resetSettings);

  // 初始化：加载已有设置
  loadSettings();
});
