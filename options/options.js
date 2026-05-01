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
  const form = document.getElementById('settingsForm');
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

  // 事件监听
  form.addEventListener('submit', saveSettings);

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
});
