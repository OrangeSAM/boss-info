/**
 * BOSS直聘 JD采集助手 - 设置页脚本（多 Provider + 多公司）
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

/**
 * Markdown → HTML（基于 marked 库）
 */
function renderMarkdown(text) {
  if (!text) return '';
  return marked.parse(text);
}

document.addEventListener('DOMContentLoaded', () => {
  // ========== 通用 DOM ==========

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const messageEl = document.getElementById('message');
  const promptContent = document.getElementById('promptContent');

  // ========== 分析设置 DOM ==========

  const promptForm = document.getElementById('promptForm');
  const jobTypeSelect = document.getElementById('jobType');
  const customRequirementsInput = document.getElementById('customRequirements');

  // ========== Provider DOM ==========

  const providerList = document.getElementById('providerList');
  const providerEmpty = document.getElementById('providerEmpty');
  const settingsForm = document.getElementById('settingsForm');
  const providerNameInput = document.getElementById('providerName');
  const apiEndpointInput = document.getElementById('apiEndpoint');
  const apiKeyInput = document.getElementById('apiKey');
  const modelInput = document.getElementById('model');
  const testBtn = document.getElementById('testBtn');
  const addProviderBtn = document.getElementById('addProviderBtn');
  const deleteProviderBtn = document.getElementById('deleteProviderBtn');

  // ========== 公司 DOM ==========

  const companyList = document.getElementById('companyList');
  const companyListEmpty = document.getElementById('companyListEmpty');
  const companyEmpty = document.getElementById('companyEmpty');
  const companyDetail = document.getElementById('companyDetail');
  const dataCompany = document.getElementById('dataCompany');
  const dataCount = document.getElementById('dataCount');
  const jobListItems = document.getElementById('jobListItems');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const exportReportBtn = document.getElementById('exportReportBtn');
  const exportRawBtn = document.getElementById('exportRawBtn');
  const deleteCompanyBtn = document.getElementById('deleteCompanyBtn');

  // ========== 报告 DOM ==========

  const reportEmpty = document.getElementById('reportEmpty');
  const reportContent = document.getElementById('reportContent');
  const reportCompany = document.getElementById('reportCompany');
  const reportBody = document.getElementById('reportBody');
  const exportReportBtn2 = document.getElementById('exportReportBtn2');

  // ========== 状态 ==========

  let providers = [];
  let activeProviderId = null;
  let companies = [];
  let activeCompanyId = null;

  // ========== 消息 ==========

  function showMessage(text, type = 'success') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    if (type !== 'error') {
      setTimeout(() => messageEl.classList.add('hidden'), 3000);
    }
  }

  // ========== Tab 切换 ==========

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.add('active');
    });
  });

  // ================================================================
  //  Provider 逻辑
  // ================================================================

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  async function loadProviders() {
    const data = await chrome.storage.sync.get(['providers', 'activeProviderId']);
    providers = data.providers || [];
    activeProviderId = data.activeProviderId || null;

    renderProviderList();

    if (providers.length > 0) {
      const target = providers.find(p => p.id === activeProviderId) || providers[0];
      selectProvider(target.id);
    } else {
      showProviderEmpty();
    }
  }

  function renderProviderList() {
    if (providers.length === 0) {
      providerList.innerHTML = '';
      return;
    }

    providerList.innerHTML = providers.map(p => `
      <div class="split-list-item${p.id === activeProviderId ? ' active' : ''}" data-id="${p.id}">
        <div class="item-name">${p.name || '未命名'}</div>
        <div class="item-meta">${p.model || '-'}</div>
      </div>
    `).join('');

    providerList.querySelectorAll('.split-list-item').forEach(item => {
      item.addEventListener('click', () => selectProvider(item.dataset.id));
    });
  }

  function selectProvider(id) {
    activeProviderId = id;
    const provider = providers.find(p => p.id === id);
    if (!provider) return;

    providerEmpty.classList.add('hidden');
    settingsForm.classList.remove('hidden');

    providerNameInput.value = provider.name || '';
    apiEndpointInput.value = provider.endpoint || '';
    apiKeyInput.value = provider.key || '';
    modelInput.value = provider.model || '';

    renderProviderList();
    chrome.storage.sync.set({ activeProviderId: id });
  }

  function showProviderEmpty() {
    settingsForm.classList.add('hidden');
    providerEmpty.classList.remove('hidden');
    activeProviderId = null;
    renderProviderList();
  }

  addProviderBtn.addEventListener('click', async () => {
    const newProvider = {
      id: generateId('p'),
      name: '新 Provider',
      endpoint: '',
      key: '',
      model: ''
    };
    providers.push(newProvider);
    await chrome.storage.sync.set({ providers });
    selectProvider(newProvider.id);
    providerNameInput.focus();
    providerNameInput.select();
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!activeProviderId) return;

    const provider = providers.find(p => p.id === activeProviderId);
    if (!provider) return;

    provider.name = providerNameInput.value.trim();
    provider.endpoint = apiEndpointInput.value.trim();
    provider.key = apiKeyInput.value.trim();
    provider.model = modelInput.value.trim();

    if (!provider.endpoint || !provider.key || !provider.model) {
      showMessage('请填写完整的 API 配置', 'error');
      return;
    }

    await chrome.storage.sync.set({ providers, activeProviderId });
    renderProviderList();
    showMessage('Provider 已保存');
  });

  deleteProviderBtn.addEventListener('click', async () => {
    if (!activeProviderId) return;
    if (!confirm('确定要删除这个 Provider 吗？')) return;

    providers = providers.filter(p => p.id !== activeProviderId);
    activeProviderId = providers.length > 0 ? providers[0].id : null;

    await chrome.storage.sync.set({ providers, activeProviderId });

    if (activeProviderId) {
      selectProvider(activeProviderId);
    } else {
      showProviderEmpty();
    }
    showMessage('已删除');
  });

  testBtn.addEventListener('click', async () => {
    const endpoint = apiEndpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim();

    if (!endpoint || !apiKey) {
      showMessage('请先填写 API 地址和 Key', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '检测中...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_API',
        apiEndpoint: endpoint,
        apiKey: apiKey,
        model: model
      });

      if (response.success) {
        showMessage('API 连接成功！', 'success');
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

  // ================================================================
  //  分析设置逻辑
  // ================================================================

  function generatePrompt() {
    const jobType = jobTypeSelect.value;
    const customRequirements = customRequirementsInput.value.trim();
    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    let prompt = JOB_TYPE_PROMPTS[jobType] || JOB_TYPE_PROMPTS.other;

    prompt += '\n\n请按以下结构输出分析报告：';
    focusPoints.forEach(point => {
      if (FOCUS_MODULES[point]) {
        prompt += FOCUS_MODULES[point];
      }
    });

    if (customRequirements) {
      prompt += `\n\n## 用户额外需求\n${customRequirements}`;
    }

    prompt += '\n\n请用Markdown格式输出，层次清晰，重点突出。';

    return prompt;
  }

  function updatePromptPreview() {
    promptContent.textContent = generatePrompt();
  }

  async function loadPromptSettings() {
    const settings = await chrome.storage.sync.get([
      'jobType', 'focusPoints', 'customRequirements'
    ]);

    if (settings.jobType) jobTypeSelect.value = settings.jobType;
    if (settings.customRequirements) customRequirementsInput.value = settings.customRequirements;

    if (settings.focusPoints) {
      document.querySelectorAll('input[name="focus"]').forEach(cb => {
        cb.checked = settings.focusPoints.includes(cb.value);
      });
    }

    updatePromptPreview();
  }

  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    await chrome.storage.sync.set({
      jobType: jobTypeSelect.value,
      focusPoints,
      customRequirements: customRequirementsInput.value.trim(),
      analysisPrompt: generatePrompt()
    });

    showMessage('分析设置已保存');
  });

  jobTypeSelect.addEventListener('change', updatePromptPreview);
  document.querySelectorAll('input[name="focus"]').forEach(cb => {
    cb.addEventListener('change', updatePromptPreview);
  });
  customRequirementsInput.addEventListener('input', updatePromptPreview);

  // ================================================================
  //  公司数据逻辑
  // ================================================================

  async function loadCompanies() {
    const data = await chrome.storage.local.get(['companies', 'activeCompanyId']);
    companies = data.companies || [];
    activeCompanyId = data.activeCompanyId || null;

    renderCompanyList();

    if (companies.length > 0) {
      const target = companies.find(c => c.id === activeCompanyId) || companies[0];
      selectCompany(target.id);
    } else {
      showCompanyEmpty();
    }
  }

  function renderCompanyList() {
    companyListEmpty.classList.toggle('hidden', companies.length > 0);

    // 移除旧的动态 items
    companyList.querySelectorAll('.split-list-item').forEach(item => item.remove());

    companies.forEach(c => {
      const div = document.createElement('div');
      div.className = `split-list-item${c.id === activeCompanyId ? ' active' : ''}`;
      div.dataset.id = c.id;
      div.innerHTML = `
        <div class="item-name">${c.name || '未知公司'}</div>
        <div class="item-meta">${c.jobs.length} 个岗位</div>
      `;
      div.addEventListener('click', () => selectCompany(c.id));
      companyList.appendChild(div);
    });
  }

  function selectCompany(id) {
    activeCompanyId = id;
    const company = companies.find(c => c.id === id);
    if (!company) return;

    companyEmpty.classList.add('hidden');
    companyDetail.classList.remove('hidden');

    dataCompany.textContent = company.name || '未知公司';
    dataCount.textContent = `共 ${company.jobs.length} 个岗位`;

    renderJobList(company.jobs);

    analyzeBtn.disabled = company.jobs.length === 0;
    exportRawBtn.disabled = company.jobs.length === 0;
    exportReportBtn.disabled = !company.analyses || company.analyses.length === 0;

    updateReportTab();

    renderCompanyList();
    chrome.storage.local.set({ activeCompanyId: id });
  }

  function showCompanyEmpty() {
    companyDetail.classList.add('hidden');
    companyEmpty.classList.remove('hidden');
    activeCompanyId = null;
    showAnalysisResult(null);
    renderCompanyList();
  }

  function renderJobList(jobs) {
    if (!jobs || jobs.length === 0) {
      jobListItems.innerHTML = '<div class="empty-state"><p>暂无岗位数据</p></div>';
      return;
    }

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

    jobListItems.querySelectorAll('.job-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
        item.querySelector('.job-detail').classList.toggle('hidden');
      });
    });
  }

  function showAnalysisResult(analysis, companyName) {
    if (!analysis) {
      reportEmpty.classList.remove('hidden');
      reportContent.classList.add('hidden');
      return;
    }
    reportEmpty.classList.add('hidden');
    reportContent.classList.remove('hidden');
    reportCompany.textContent = companyName || '';
    reportBody.innerHTML = renderMarkdown(analysis);
  }

  function updateReportTab() {
    const company = companies.find(c => c.id === activeCompanyId);
    if (company && company.analyses && company.analyses.length > 0) {
      const latest = company.analyses[company.analyses.length - 1];
      showAnalysisResult(latest.analysis, company.name);
    } else {
      showAnalysisResult(null);
    }
  }

  deleteCompanyBtn.addEventListener('click', async () => {
    if (!activeCompanyId) return;
    const company = companies.find(c => c.id === activeCompanyId);
    if (!confirm(`确定要删除"${company?.name || '该公司'}"的所有数据吗？`)) return;

    companies = companies.filter(c => c.id !== activeCompanyId);
    activeCompanyId = companies.length > 0 ? companies[0].id : null;

    await chrome.storage.local.set({ companies, activeCompanyId });

    if (activeCompanyId) {
      selectCompany(activeCompanyId);
    } else {
      showCompanyEmpty();
    }
    showMessage('已删除');
  });

  // ================================================================
  //  AI 分析 & 导出
  // ================================================================

  analyzeBtn.addEventListener('click', async () => {
    if (!activeCompanyId) return;

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '分析中...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        companyId: activeCompanyId
      });

      if (response.success) {
        exportReportBtn.disabled = false;

        // 更新内存中的 analyses
        const company = companies.find(c => c.id === activeCompanyId);
        if (company) {
          if (!company.analyses) company.analyses = [];
          company.analyses.push({
            id: Date.now(),
            jobCount: company.jobs.length,
            analysis: response.analysis,
            createdAt: Date.now()
          });
          showAnalysisResult(response.analysis, company.name);
        }

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

  exportReportBtn.addEventListener('click', exportReport);
  exportReportBtn2.addEventListener('click', exportReport);

  async function exportReport() {
    if (!activeCompanyId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EXPORT_DATA',
        exportType: 'report',
        companyId: activeCompanyId
      });

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
  }

  exportRawBtn.addEventListener('click', async () => {
    if (!activeCompanyId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EXPORT_DATA',
        exportType: 'raw',
        companyId: activeCompanyId
      });

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

  // ================================================================
  //  初始化
  // ================================================================

  loadProviders();
  loadPromptSettings();
  loadCompanies();
});
