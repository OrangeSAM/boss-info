/**
 * BOSS直聘 JD采集助手 - 设置页脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('model');
  const testBtn = document.getElementById('testBtn');
  const messageEl = document.getElementById('message');

  /**
   * 显示消息
   */
  function showMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
  }

  function hideMessage() {
    messageEl.classList.add('hidden');
  }

  /**
   * 加载保存的设置
   */
  async function loadSettings() {
    const settings = await chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'model']);

    if (settings.apiEndpoint) {
      apiEndpointInput.value = settings.apiEndpoint;
    }
    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
    }
    if (settings.model) {
      modelInput.value = settings.model;
    }
  }

  /**
   * 保存设置
   */
  async function saveSettings(e) {
    e.preventDefault();

    const settings = {
      apiEndpoint: apiEndpointInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim()
    };

    if (!settings.apiEndpoint || !settings.apiKey || !settings.model) {
      showMessage('请填写所有字段', 'error');
      return;
    }

    await chrome.storage.sync.set(settings);
    showMessage('设置已保存');
  }

  /**
   * 测试API连接
   */
  testBtn.addEventListener('click', async () => {
    const endpoint = apiEndpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim();

    if (!endpoint || !apiKey) {
      showMessage('请先填写API地址和Key', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '检测中...';
    showMessage('正在检测API连接...', 'testing');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [
            { role: 'user', content: 'Hi' }
          ],
          max_tokens: 5
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
          showMessage('API连接成功！', 'success');
        } else {
          showMessage('API返回格式异常', 'error');
        }
      } else {
        const error = await response.json().catch(() => ({}));
        const errMsg = error.error?.message || response.statusText || '未知错误';
        showMessage(`API错误: ${errMsg}`, 'error');
      }
    } catch (error) {
      showMessage(`连接失败: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '检测';
    }
  });

  // 事件监听
  form.addEventListener('submit', saveSettings);

  // 初始化
  loadSettings();
});
