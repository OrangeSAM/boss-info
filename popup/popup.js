/**
 * BOSS直聘 JD采集助手 - Popup脚本（精简版）
 */

document.addEventListener('DOMContentLoaded', () => {
  const collectBtn = document.getElementById('collectBtn');
  const settingsLink = document.getElementById('settingsLink');

  const companyNameEl = document.getElementById('companyName');
  const jobCountEl = document.getElementById('jobCount');

  const loadingEl = document.getElementById('loading');
  const loadingTextEl = document.getElementById('loadingText');

  const messageEl = document.getElementById('message');
  const messageTextEl = document.getElementById('messageText');

  /**
   * 显示/隐藏loading
   */
  function showLoading(text = '处理中...') {
    loadingTextEl.textContent = text;
    loadingEl.classList.remove('hidden');
  }

  function hideLoading() {
    loadingEl.classList.add('hidden');
  }

  /**
   * 显示消息
   */
  function showMessage(text, type = 'info') {
    messageEl.className = `message ${type}`;
    messageTextEl.textContent = text;
    messageEl.classList.remove('hidden');

    if (type !== 'error') {
      setTimeout(() => {
        messageEl.classList.add('hidden');
      }, 3000);
    }
  }

  /**
   * 隐藏消息
   */
  function hideMessage() {
    messageEl.classList.add('hidden');
  }

  /**
   * 更新状态显示
   */
  function updateStatus(count, companyName) {
    jobCountEl.textContent = count;
    companyNameEl.textContent = companyName || '未采集';
  }

  /**
   * 获取当前状态
   */
  async function loadStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response.success) {
        updateStatus(response.data.jobCount, response.data.companyName);
      }
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  }

  /**
   * 采集岗位
   */
  collectBtn.addEventListener('click', async () => {
    hideMessage();
    showLoading('正在采集岗位...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        hideLoading();
        showMessage('无法获取当前标签页', 'error');
        return;
      }

      if (!tab.url?.includes('zhipin.com')) {
        hideLoading();
        showMessage('请在BOSS直聘页面使用', 'error');
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startCollection' });

      hideLoading();

      if (response.success) {
        updateStatus(response.count, response.companyName);
        showMessage(`成功采集 ${response.count} 个岗位`, 'success');
      } else {
        showMessage(response.error || '采集失败', 'error');
      }
    } catch (error) {
      hideLoading();
      showMessage('采集失败: ' + error.message, 'error');
    }
  });

  /**
   * 打开数据页
   */
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  /**
   * 监听Background的消息
   */
  chrome.runtime.onMessage.addListener((request) => {
    switch (request.type) {
      case 'STATUS_UPDATE':
        updateStatus(request.jobCount, request.companyName);
        break;

      case 'COLLECTION_PROGRESS':
        showLoading(`正在采集: ${request.jobTitle} (${request.current}/${request.total})`);
        break;
    }
  });

  // 初始化：加载当前状态
  loadStatus();
});
