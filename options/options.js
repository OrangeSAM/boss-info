/**
 * BOSS直聘 JD采集助手 - 设置页脚本
 */

// 岗位方向对应的预设 prompt
const JOB_TYPE_PROMPTS = {
  frontend: `你是一位资深前端技术面试官，有10年面试经验。请重点分析前端相关的技术栈、面试要点和职业发展建议。`,
  backend: `你是一位资深后端技术面试官，精通分布式系统设计。请重点分析后端技术栈、系统架构和面试要点。`,
  fullstack: `你是一位全栈技术负责人，前后端均有深入经验。请全面分析技术栈，并给出全栈工程师的成长建议。`,
  mobile: `你是一位移动端开发专家，熟悉iOS和Android开发。请重点分析移动端技术栈和跨平台方案。`,
  ai: `你是一位AI算法专家，熟悉大模型和机器学习。请重点分析AI技术栈、算法岗位要求和行业趋势。`,
  product: `你是一位资深产品经理导师，熟悉互联网产品方法论。请重点分析产品岗位要求、业务方向和面试要点。`,
  test: `你是一位测试架构师，精通自动化测试和质量保障。请重点分析测试技术栈和质量体系建设。`,
  other: `你是一位资深HR和招聘分析师。请全面分析公司的技术实力、团队规模和发展前景。`
};

// 关注点对应的分析模块
const FOCUS_MODULES = {
  tech_stack: `
## 技术栈分析
请详细列出：
- 前端/后端框架及版本
- 数据库和中间件
- 开发工具和构建工具
- 云服务和部署方案
- 其他关键技术`,

  interview: `
## 面试准备
请给出：
- 必须掌握的5个核心技术点
- 大概率会问的3个面试题（附简要答案思路）
- 项目经验如何包装
- 需要准备的算法/手写代码题`,

  salary: `
## 薪资分析
请分析：
- 岗位薪资范围（最低-最高）
- 在市场上的竞争力
- 薪资结构（几薪、是否有股票/期权）
- 晋升空间`,

  business: `
## 业务分析
请分析：
- 公司核心产品是什么
- 业务发展方向
- 在行业中的定位和竞争对手
- 技术如何支撑业务`,

  team: `
## 团队评估
请分析：
- 技术团队大概规模
- 技术氛围（保守还是前沿）
- 是否有技术分享/开源文化
- 工作强度（是否996）`,

  risk: `
## 风险提示
请分析：
- 有哪些可能的坑
- 技术栈是否老旧
- 公司发展前景
- 跳槽建议`
};

document.addEventListener('DOMContentLoaded', () => {
  const apiForm = document.getElementById('settingsForm');
  const promptForm = document.getElementById('promptForm');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('model');
  const jobTypeSelect = document.getElementById('jobType');
  const customRequirementsInput = document.getElementById('customRequirements');
  const testBtn = document.getElementById('testBtn');
  const togglePromptBtn = document.getElementById('togglePrompt');
  const promptPreview = document.getElementById('promptPreview');
  const promptContent = document.getElementById('promptContent');
  const messageEl = document.getElementById('message');

  /**
   * 显示消息
   */
  function showMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');

    if (type !== 'error') {
      setTimeout(() => messageEl.classList.add('hidden'), 3000);
    }
  }

  /**
   * 生成当前配置的 prompt
   */
  function generatePrompt() {
    const jobType = jobTypeSelect.value;
    const customRequirements = customRequirementsInput.value.trim();

    // 获取选中的关注点
    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    // 基础 prompt
    let prompt = JOB_TYPE_PROMPTS[jobType] || JOB_TYPE_PROMPTS.other;

    // 添加关注点模块
    prompt += '\n\n请按以下结构输出分析报告：';
    focusPoints.forEach(point => {
      if (FOCUS_MODULES[point]) {
        prompt += FOCUS_MODULES[point];
      }
    });

    // 添加自定义需求
    if (customRequirements) {
      prompt += `\n\n## 用户额外需求\n${customRequirements}`;
    }

    prompt += '\n\n请用Markdown格式输出，层次清晰，重点突出。';

    return prompt;
  }

  /**
   * 更新 prompt 预览
   */
  function updatePromptPreview() {
    const prompt = generatePrompt();
    promptContent.textContent = prompt;
  }

  /**
   * 加载保存的设置
   */
  async function loadSettings() {
    const settings = await chrome.storage.sync.get([
      'apiEndpoint', 'apiKey', 'model',
      'jobType', 'focusPoints', 'customRequirements'
    ]);

    if (settings.apiEndpoint) apiEndpointInput.value = settings.apiEndpoint;
    if (settings.apiKey) apiKeyInput.value = settings.apiKey;
    if (settings.model) modelInput.value = settings.model;
    if (settings.jobType) jobTypeSelect.value = settings.jobType;
    if (settings.customRequirements) customRequirementsInput.value = settings.customRequirements;

    // 恢复关注点选择
    if (settings.focusPoints) {
      document.querySelectorAll('input[name="focus"]').forEach(cb => {
        cb.checked = settings.focusPoints.includes(cb.value);
      });
    }

    updatePromptPreview();
  }

  /**
   * 保存设置
   */
  async function saveSettings(e) {
    e.preventDefault();

    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    const settings = {
      apiEndpoint: apiEndpointInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      jobType: jobTypeSelect.value,
      focusPoints: focusPoints,
      customRequirements: customRequirementsInput.value.trim(),
      // 保存生成的 prompt
      analysisPrompt: generatePrompt()
    };

    if (!settings.apiEndpoint || !settings.apiKey || !settings.model) {
      showMessage('请填写API配置', 'error');
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
    showMessage('正在检测...', 'testing');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_API',
        apiEndpoint: endpoint,
        apiKey: apiKey,
        model: model
      });

      if (response.success) {
        showMessage('API连接成功！', 'success');
      } else {
        showMessage(response.error || '检测失败', 'error');
      }
    } catch (error) {
      showMessage(`连接失败: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '检测';
    }
  });

  // Tab 切换
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.add('active');
    });
  });

  // 事件监听
  apiForm.addEventListener('submit', saveSettings);
  promptForm.addEventListener('submit', saveSettings);

  togglePromptBtn.addEventListener('click', () => {
    promptPreview.classList.toggle('show');
  });

  // 岗位方向变化时更新预览
  jobTypeSelect.addEventListener('change', updatePromptPreview);

  // 关注点变化时更新预览
  document.querySelectorAll('input[name="focus"]').forEach(cb => {
    cb.addEventListener('change', updatePromptPreview);
  });

  // 自定义需求变化时更新预览
  customRequirementsInput.addEventListener('input', updatePromptPreview);

  // 初始化
  loadSettings();

  // ========== 数据 Tab 相关 ==========

  const dataCompany = document.getElementById('dataCompany');
  const dataCount = document.getElementById('dataCount');
  const jobListItems = document.getElementById('jobListItems');
  const emptyState = document.getElementById('emptyState');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const exportReportBtn = document.getElementById('exportReportBtn');
  const exportRawBtn = document.getElementById('exportRawBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const analysisResult = document.getElementById('analysisResult');
  const analysisContent = document.getElementById('analysisContent');

  let currentJobs = [];

  /**
   * 加载已采集数据
   */
  async function loadJobData() {
    const { jobs = [] } = await chrome.storage.local.get('jobs');
    const { companyName = '' } = await chrome.storage.local.get('companyName');
    const { analyses = [] } = await chrome.storage.local.get('analyses');

    currentJobs = jobs;
    renderJobList(jobs, companyName);

    // 更新按钮状态
    analyzeBtn.disabled = jobs.length === 0;
    exportRawBtn.disabled = jobs.length === 0;
    exportReportBtn.disabled = analyses.length === 0;

    // 显示最新的分析结果
    if (analyses.length > 0) {
      const latest = analyses[analyses.length - 1];
      showAnalysisResult(latest.analysis);
    }
  }

  /**
   * 渲染岗位列表
   */
  function renderJobList(jobs, companyName) {
    dataCompany.textContent = companyName || '未采集';
    dataCount.textContent = `共 ${jobs.length} 个岗位`;

    if (jobs.length === 0) {
      emptyState.classList.remove('hidden');
      jobListItems.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');
    jobListItems.innerHTML = jobs.map((job, index) => `
      <div class="job-item" data-index="${index}">
        <div class="job-header">
          <span class="job-title">${job.title || '未知岗位'}</span>
          <span class="job-salary">${job.salary || ''}</span>
        </div>
        <div class="job-tags">
          ${(job.tags || []).slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="job-detail hidden">
          <p>${job.description || '暂无描述'}</p>
        </div>
      </div>
    `).join('');

    // 添加点击展开/收起
    jobListItems.querySelectorAll('.job-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
        item.querySelector('.job-detail').classList.toggle('hidden');
      });
    });
  }

  /**
   * 显示分析结果
   */
  function showAnalysisResult(analysis) {
    if (!analysis) return;
    analysisContent.innerHTML = `<div class="markdown">${analysis.replace(/\n/g, '<br>')}</div>`;
    analysisResult.classList.remove('hidden');
  }

  /**
   * 下载文件
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
   * AI 分析
   */
  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '分析中...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_ANALYSIS' });

      if (response.success) {
        showAnalysisResult(response.analysis);
        exportReportBtn.disabled = false;
        showMessage('分析完成！');
      } else {
        showMessage(response.error || '分析失败', 'error');
      }
    } catch (error) {
      showMessage('分析失败: ' + error.message, 'error');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI 分析';
    }
  });

  /**
   * 导出报告
   */
  exportReportBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_EXPORT_DATA', exportType: 'report' });

      if (response.success) {
        const { markdown, companyName } = response.data;
        const filename = `${companyName || '未知公司'}_技术分析报告_${new Date().toISOString().slice(0, 10)}.md`;
        downloadFile(markdown, filename, 'text/markdown;charset=utf-8');
        showMessage(`已导出: ${filename}`);
      } else {
        showMessage(response.error || '导出失败', 'error');
      }
    } catch (error) {
      showMessage('导出失败: ' + error.message, 'error');
    }
  });

  /**
   * 导出原始数据
   */
  exportRawBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_EXPORT_DATA', exportType: 'raw' });

      if (response.success) {
        const { jsonData, companyName } = response.data;
        const filename = `${companyName || '未知公司'}_原始数据_${new Date().toISOString().slice(0, 10)}.json`;
        downloadFile(jsonData, filename, 'application/json;charset=utf-8');
        showMessage(`已导出: ${filename}`);
      } else {
        showMessage(response.error || '导出失败', 'error');
      }
    } catch (error) {
      showMessage('导出失败: ' + error.message, 'error');
    }
  });

  /**
   * 清空数据
   */
  clearDataBtn.addEventListener('click', async () => {
    if (!confirm('确定要清空所有采集数据吗？')) return;

    await chrome.storage.local.set({ jobs: [], companyName: '', analyses: [] });
    currentJobs = [];
    renderJobList([], '');
    analysisResult.classList.add('hidden');
    analyzeBtn.disabled = true;
    exportReportBtn.disabled = true;
    exportRawBtn.disabled = true;
    showMessage('数据已清空');
  });

  // 初始化加载数据
  loadJobData();
});
