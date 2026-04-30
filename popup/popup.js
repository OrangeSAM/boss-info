/**
 * BOSS直聘 JD采集助手 - Popup脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  const collectBtn = document.getElementById('collectBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const exportBtn = document.getElementById('exportBtn');
  const exportRawBtn = document.getElementById('exportRawBtn');
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

  function hideMessage() {
    messageEl.classList.add('hidden');
  }

  /**
   * 更新状态显示
   */
  function updateStatus(count, companyName) {
    jobCountEl.textContent = count;
    companyNameEl.textContent = companyName || '未采集';

    // 启用/禁用按钮
    analyzeBtn.disabled = count === 0;
    exportBtn.disabled = count === 0;
    exportRawBtn.disabled = count === 0;
  }

  /**
   * 获取当前状态
   */
  async function loadStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response.success) {
        updateStatus(response.data.jobCount, response.data.companyName);
        if (response.data.hasAnalysis) {
          exportBtn.disabled = false;
        }
        if (response.data.jobCount > 0) {
          exportRawBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  }

  /**
   * 采集岗位（通过模拟点击）
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

      // 检查是否在BOSS直聘页面
      if (!tab.url?.includes('zhipin.com')) {
        hideLoading();
        showMessage('请在BOSS直聘页面使用', 'error');
        return;
      }

      // 启动采集（会逐个点击岗位）
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
   * AI分析
   */
  analyzeBtn.addEventListener('click', async () => {
    hideMessage();
    showLoading('正在进行AI分析...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_ANALYSIS' });

      hideLoading();

      if (response.success) {
        showMessage('分析完成！可以导出报告', 'success');
        exportBtn.disabled = false;
      } else {
        showMessage(response.error || '分析失败', 'error');
      }
    } catch (error) {
      hideLoading();
      showMessage('分析失败: ' + error.message, 'error');
    }
  });

  /**
   * 下载文件的通用函数
   */
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 导出报告
   */
  exportBtn.addEventListener('click', async () => {
    hideMessage();
    showLoading('正在导出报告...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_EXPORT_DATA', exportType: 'report' });

      hideLoading();

      if (response.success) {
        const { markdown, companyName } = response.data;
        const filename = `${companyName || '未知公司'}_技术分析报告_${new Date().toISOString().slice(0, 10)}.md`;
        downloadFile(markdown, filename, 'text/markdown;charset=utf-8');
        showMessage(`已导出: ${filename}`, 'success');
      } else {
        showMessage(response.error || '导出失败', 'error');
      }
    } catch (error) {
      hideLoading();
      showMessage('导出失败: ' + error.message, 'error');
    }
  });

  /**
   * 导出原始数据
   */
  exportRawBtn.addEventListener('click', async () => {
    hideMessage();
    showLoading('正在导出原始数据...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_EXPORT_DATA', exportType: 'raw' });

      hideLoading();

      if (response.success) {
        const { jsonData, companyName } = response.data;
        const filename = `${companyName || '未知公司'}_原始数据_${new Date().toISOString().slice(0, 10)}.json`;
        downloadFile(jsonData, filename, 'application/json;charset=utf-8');
        showMessage(`已导出: ${filename}`, 'success');
      } else {
        showMessage(response.error || '导出失败', 'error');
      }
    } catch (error) {
      hideLoading();
      showMessage('导出失败: ' + error.message, 'error');
    }
  });

  /**
   * 打开设置页
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

      case 'ANALYSIS_START':
        showLoading(`正在分析 ${request.jobCount} 个岗位...`);
        break;

      case 'ANALYSIS_COMPLETE':
        hideLoading();
        showMessage('分析完成！可以导出报告', 'success');
        exportBtn.disabled = false;
        break;

      case 'ANALYSIS_ERROR':
        hideLoading();
        showMessage('分析失败: ' + request.error, 'error');
        break;
    }
  });

  // 初始化：加载当前状态
  loadStatus();
});
