/**
 * BOSS直聘 JD采集助手 - 设置页脚本（多 Provider + 多公司）
 */

/**
 * 根据选中的岗位推断岗位类型
 */
function inferJobType(selectedJobs) {
  if (!selectedJobs || selectedJobs.length === 0) return 'other';

  const typeCounts = { frontend: 0, backend: 0, fullstack: 0, mobile: 0, ai: 0, product: 0, test: 0 };

  selectedJobs.forEach(job => {
    const title = (job.title || '').toLowerCase();
    const tags = (job.tags || []).join(' ').toLowerCase();
    const text = title + ' ' + tags;

    if (/前端|frontend|react|vue|angular|web/.test(text)) typeCounts.frontend++;
    if (/后端|backend|java|golang|python|node/.test(text)) typeCounts.backend++;
    if (/全栈|fullstack/.test(text)) typeCounts.fullstack++;
    if (/移动端|ios|android|flutter|react native|kotlin|swift/.test(text)) typeCounts.mobile++;
    if (/\bai\b|算法|机器学习|深度学习|nlp|llm/.test(text)) typeCounts.ai++;
    if (/产品|product/.test(text)) typeCounts.product++;
    if (/测试|qa|自动化/.test(text)) typeCounts.test++;
  });

  let maxCount = 0;
  let result = 'other';
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      result = type;
    }
  }
  return result;
}

/**
 * 根据岗位类型获取角色设定
 */
function getRolePrompt(jobType) {
  const roles = {
    frontend: '你是一位资深前端技术面试官，有10年面试经验。请重点分析前端相关的技术栈、面试要点和职业发展建议。',
    backend: '你是一位资深后端技术面试官，精通分布式系统设计。请重点分析后端技术栈、系统架构和面试要点。',
    fullstack: '你是一位全栈技术负责人，前后端均有深入经验。请全面分析技术栈，并给出全栈工程师的成长建议。',
    mobile: '你是一位移动端开发专家，熟悉iOS和Android开发。请重点分析移动端技术栈和跨平台方案。',
    ai: '你是一位AI算法专家，熟悉大模型和机器学习。请重点分析AI技术栈、算法岗位要求和行业趋势。',
    product: '你是一位资深产品经理导师，熟悉互联网产品方法论。请重点分析产品岗位要求、业务方向和面试要点。',
    test: '你是一位测试架构师，精通自动化测试和质量保障。请重点分析测试技术栈和质量体系建设。',
    other: '你是一位资深HR和招聘分析师。请全面分析公司的技术实力、团队规模和发展前景。'
  };
  return roles[jobType] || roles.other;
}

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

// 岗位定制的 focus 模块（仅覆盖有差异的模块，其余走 FOCUS_MODULES 默认）
const FOCUS_MODULE_OVERRIDES = {
  frontend: {
    tech_stack: `
## 前端技术栈分析
请详细分析：
- 主框架及版本（React/Vue/Angular）及配套生态（状态管理、路由、UI库）
- 构建工具链（Webpack/Vite/Turbopack）及优化策略
- 跨端方案（如 Electron/Taro/React Native）
- 工程化能力（Monorepo、CI/CD、代码规范、测试方案）
- 性能优化和监控体系`,

    interview: `
## 前端面试准备
请针对前端岗位给出：
- 必须掌握的5个核心前端知识点（如：事件循环、虚拟DOM、浏览器渲染机制、CSS布局、模块化）
- 大概率会问的3个前端面试题（附简要答案思路）
- 如何包装前端项目经验（性能优化、工程化、复杂交互）
- 需要准备的手写代码题（如：Promise实现、深拷贝、虚拟列表）
- 前端系统设计题准备（如：设计一个组件库、设计一个前端监控方案）`
  },

  backend: {
    tech_stack: `
## 后端技术栈分析
请详细分析：
- 主力语言及版本（Java/Go/Python/Node.js）及核心框架
- 数据库选型（MySQL/PostgreSQL/MongoDB）及缓存方案（Redis）
- 中间件使用（消息队列 Kafka/RabbitMQ、搜索引擎 ES）
- 微服务架构（服务注册发现、网关、链路追踪）
- 基础设施（K8s、容器化、CI/CD、云服务商）`,

    interview: `
## 后端面试准备
请针对后端岗位给出：
- 必须掌握的5个核心后端知识点（如：并发编程、分布式事务、数据库索引、消息队列、缓存策略）
- 大概率会问的3个后端面试题（附简要答案思路）
- 如何包装后端项目经验（高并发、高可用、系统设计）
- 需要准备的系统设计题（如：设计短链服务、设计秒杀系统）
- 数据库和 SQL 优化相关准备`
  },

  fullstack: {
    tech_stack: `
## 全栈技术栈分析
请详细分析：
- 前端技术栈（框架、构建工具、UI 库）
- 后端技术栈（语言、框架、数据库）
- 前后端协作方式（BFF 层、API 规范、联调方式）
- 全栈工程师的技术广度要求和成长路径
- DevOps 和部署相关的工具链`,

    interview: `
## 全栈面试准备
请针对全栈岗位给出：
- 必须掌握的5个核心知识点（兼顾前后端：如 API 设计、数据库建模、前端组件化、部署运维、性能优化）
- 大概率会问的3个面试题（附简要答案思路）
- 如何展示全栈能力（独立负责模块、端到端交付经验）
- 需要准备的编码题（前后端各准备 2-3 道）
- 全栈工程师在团队中的定位和价值展示`
  },

  mobile: {
    tech_stack: `
## 移动端技术栈分析
请详细分析：
- 原生开发（iOS Swift/ObjC、Android Kotlin/Java）
- 跨平台方案（Flutter/React Native/Weex）及选型依据
- 移动端架构（MVC/MVVM/MVP/Clean Architecture）
- 性能优化工具（内存泄漏检测、启动优化、包体积优化）
- CI/CD 和自动化发布流程`,

    interview: `
## 移动端面试准备
请针对移动端岗位给出：
- 必须掌握的5个核心知识点（如：内存管理、多线程、网络优化、UI 渲染机制、跨平台原理）
- 大概率会问的3个面试题（附简要答案思路）
- 如何包装移动端项目经验（性能优化、架构演进、用户量级）
- 需要准备的编码题（Swift/Kotlin 手写、算法题）
- 原生 vs 跨平台的技术决策能力展示`
  },

  ai: {
    tech_stack: `
## AI/算法技术栈分析
请详细分析：
- 机器学习框架（PyTorch/TensorFlow/JAX）及版本
- 大模型相关（模型微调、推理部署、RAG、Agent）
- 数据处理和特征工程工具链
- 模型训练基础设施（GPU 集群、分布式训练、MLflow 等 MLOps）
- 应用层技术（向量数据库、模型服务框架、A/B 测试）`,

    interview: `
## AI/算法面试准备
请针对 AI 算法岗位给出：
- 必须掌握的5个核心知识点（如：Transformer 原理、损失函数设计、模型评估指标、正则化方法、特征工程）
- 大概率会问的3个算法面试题（附简要答案思路）
- 如何包装算法项目经验（模型效果提升、业务指标、论文/专利）
- 需要准备的手撕代码题（经典 ML 算法实现、PyTorch 训练循环）
- Paper reading 和前沿技术追踪能力展示`
  },

  product: {
    tech_stack: `
## 产品岗位工具与方法论分析
请分析：
- 产品设计工具（Figma/Axure/墨刀）
- 数据分析工具（SQL、数据看板、A/B 测试平台）
- 项目管理工具（Jira/飞书/Notion）
- 用户研究方法（用户访谈、可用性测试、数据埋点）
- 所在行业的竞品分析工具和方法`,

    interview: `
## 产品岗位面试准备
请针对产品经理岗位给出：
- 必须掌握的5个核心能力点（如：需求分析、竞品调研、数据驱动决策、PRD 撰写、用户画像）
- 大概率会问的3个面试题（附回答思路：如"如何从0到1设计一个产品"）
- 如何包装产品项目经验（数据指标、业务增长、用户反馈）
- 需要准备的产品设计题（现场出方案、流程图绘制）
- 产品经理的技术理解力和协作能力展示`
  },

  test: {
    tech_stack: `
## 测试技术栈分析
请详细分析：
- 自动化测试框架（Selenium/Playwright/Cypress/Appium）
- 性能测试工具（JMeter/Locust/k6）
- 接口测试工具（Postman/RestAssured）
- 测试平台和 CI/CD 集成（TestNG/Pytest、测试报告）
- 质量保障体系（代码覆盖率、SonarQube、灰度发布）`,

    interview: `
## 测试岗位面试准备
请针对测试岗位给出：
- 必须掌握的5个核心知识点（如：测试用例设计方法、自动化测试策略、性能测试、接口测试、测试左移右移）
- 大概率会问的3个面试题（附简要答案思路）
- 如何包装测试项目经验（质量指标提升、自动化覆盖率、效率提升）
- 需要准备的编码题（Python/Java 自动化脚本、SQL 查询）
- 测试架构设计能力展示（测试策略、分层测试、质量体系建设）`
  }
};

/**
 * Markdown → HTML（基于 marked 库）
 */
function renderMarkdown(text) {
  if (!text) return '';
  return marked.parse(text);
}

document.addEventListener('DOMContentLoaded', () => {
  // ========== 主题切换 ==========

  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'light';

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }

  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  // ========== 通用 DOM ==========

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const messageEl = document.getElementById('message');
  const promptContent = document.getElementById('promptContent');

  // ========== 分析设置 DOM ==========

  const promptForm = document.getElementById('promptForm');
  const customRequirementsInput = document.getElementById('customRequirements');
  const userBackgroundInput = document.getElementById('userBackground');
  const targetJobList = document.getElementById('targetJobList');

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

  function getSelectedJobs() {
    const selectedIds = Array.from(targetJobList.querySelectorAll('input[name="targetJob"]:checked'))
      .map(cb => cb.value);

    const allJobs = [];
    companies.forEach(company => {
      if (company.jobs) {
        company.jobs.forEach(job => {
          if (selectedIds.includes(job.id)) {
            allJobs.push(job);
          }
        });
      }
    });
    return allJobs;
  }

  /**
   * 格式化岗位数据用于 prompt 预览
   */
  function formatJobsForPreview(jobs) {
    if (!jobs || jobs.length === 0) return '（暂无岗位数据）';

    return jobs.map((job, index) => {
      let text = `### 岗位 ${index + 1}: ${job.title}`;
      if (job.salary) text += `\n- 薪资: ${job.salary}`;
      if (job.tags && job.tags.length > 0) {
        text += `\n- 标签: ${job.tags.join(', ')}`;
      }
      if (job.description) {
        text += `\n\n**岗位描述:**\n${job.description}`;
      }
      return text;
    }).join('\n\n---\n\n');
  }

  /**
   * 生成 prompt 模板（不含岗位数据，用于保存和 AI 分析时动态替换）
   */
  function generatePromptTemplate() {
    const userBackground = userBackgroundInput.value.trim();
    const customRequirements = customRequirementsInput.value.trim();
    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    // 根据选中的岗位推断类型
    const selectedJobs = getSelectedJobs();
    const jobType = inferJobType(selectedJobs);

    // 角色设定
    const rolePrompt = getRolePrompt(jobType);

    // 获取岗位定制的模块
    const overrides = FOCUS_MODULE_OVERRIDES[jobType] || {};

    let prompt = rolePrompt;

    // 我的背景
    if (userBackground) {
      prompt += `\n\n## 我的背景\n${userBackground}`;
    } else {
      prompt += '\n\n## 我的背景\n（在这里填写你的简历、工作经历、技术栈等信息）';
    }

    prompt += '\n\n## 我要面试的公司\n公司名称：（选择目标岗位后自动填充）\n（公司背景信息会在这里自动填充）';
    prompt += '\n\n## 我要投递的岗位\n（请先选择一个目标岗位）';

    prompt += '\n\n## 请帮我';
    focusPoints.forEach(point => {
      const module = overrides[point] || FOCUS_MODULES[point];
      if (module) {
        prompt += module + '\n';
      }
    });

    if (customRequirements) {
      prompt += `\n\n## 其他需求\n${customRequirements}`;
    }

    prompt += '\n\n请重点围绕"我需要准备什么"来回答，而不是泛泛分析公司。';

    return prompt;
  }

  function generatePrompt() {
    const userBackground = userBackgroundInput.value.trim();
    const customRequirements = customRequirementsInput.value.trim();
    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    // 根据选中的岗位推断类型
    const selectedJobs = getSelectedJobs();
    const jobType = inferJobType(selectedJobs);

    // 角色设定
    const rolePrompt = getRolePrompt(jobType);

    // 获取岗位定制的模块
    const overrides = FOCUS_MODULE_OVERRIDES[jobType] || {};

    // 获取选中岗位的公司及所有岗位
    let companyName = '';
    let companyProfile = null;
    let allCompanyJobs = [];
    if (selectedJobs.length > 0) {
      const company = companies.find(c => c.jobs?.some(j => selectedJobs.some(sj => sj.id === j.id)));
      if (company) {
        companyName = company.name;
        companyProfile = company.companyProfile || null;
        allCompanyJobs = company.jobs || [];
      }
    }

    // 格式化目标岗位
    const targetJobText = formatJobsForPreview(selectedJobs);

    // 格式化其他岗位（排除目标岗位，用于勾勒公司全貌）
    const otherJobs = allCompanyJobs.filter(j => !selectedJobs.some(sj => sj.id === j.id));
    const otherJobsText = formatJobsForPreview(otherJobs);

    let prompt = rolePrompt;

    // 我的背景
    if (userBackground) {
      prompt += `\n\n## 我的背景\n${userBackground}`;
    } else {
      prompt += '\n\n## 我的背景\n（在这里填写你的简历、工作经历、技术栈等信息）';
    }

    // 公司信息
    if (companyName) {
      prompt += `\n\n## 我要面试的公司\n公司名称：${companyName}`;
      if (companyProfile) {
        const parts = [];
        if (companyProfile.companyIntro) parts.push(`公司简介：${companyProfile.companyIntro}`);
        if (companyProfile.culture) parts.push(`企业文化：${companyProfile.culture}`);
        if (companyProfile.products?.length) parts.push(`产品介绍：${companyProfile.products.join('、')}`);
        if (companyProfile.workTime) parts.push(`工作时间：${companyProfile.workTime}`);
        if (companyProfile.benefits?.length) parts.push(`福利待遇：${companyProfile.benefits.join('、')}`);
        if (parts.length > 0) prompt += `\n${parts.join('\n')}`;
      }
    } else {
      prompt += '\n\n## 我要面试的公司\n（选择目标岗位后自动填充）';
    }

    // 目标岗位（用户要投递/面试的）
    if (selectedJobs.length > 0) {
      prompt += `\n\n## 我要投递的岗位\n${targetJobText}`;
    } else {
      prompt += '\n\n## 我要投递的岗位\n（请先选择一个目标岗位）';
    }

    // 其他岗位（用于勾勒公司全貌）
    if (otherJobs.length > 0) {
      prompt += `\n\n## 该公司其他在招岗位（供参考，帮助了解公司全貌）\n${otherJobsText}`;
    }

    prompt += '\n\n## 请帮我';
    focusPoints.forEach(point => {
      const module = overrides[point] || FOCUS_MODULES[point];
      if (module) {
        prompt += module + '\n';
      }
    });

    if (customRequirements) {
      prompt += `\n\n## 其他需求\n${customRequirements}`;
    }

    prompt += '\n\n请重点围绕"我需要准备什么"来回答，而不是泛泛分析公司。';

    return prompt;
  }

  function updatePromptPreview() {
    promptContent.value = generatePrompt();
  }

  async function loadPromptSettings() {
    const settings = await chrome.storage.sync.get([
      'focusPoints', 'customRequirements', 'selectedJobId', 'userBackground'
    ]);

    if (settings.userBackground) userBackgroundInput.value = settings.userBackground;
    if (settings.customRequirements) customRequirementsInput.value = settings.customRequirements;

    if (settings.focusPoints) {
      document.querySelectorAll('input[name="focus"]').forEach(cb => {
        cb.checked = settings.focusPoints.includes(cb.value);
      });
    }

    await loadTargetJobs(settings.selectedJobId);
    updatePromptPreview();
  }

  async function loadTargetJobs(selectedId) {
    const { companies = [] } = await chrome.storage.local.get('companies');

    // 收集所有岗位
    const allJobs = [];
    companies.forEach(company => {
      if (company.jobs) {
        company.jobs.forEach(job => {
          allJobs.push({
            id: job.id,
            title: job.title,
            salary: job.salary,
            companyName: company.name
          });
        });
      }
    });

    if (allJobs.length === 0) {
      targetJobList.innerHTML = '<p class="hint">暂无已采集的岗位数据</p>';
      return;
    }

    // 按公司分组
    const grouped = {};
    allJobs.forEach(job => {
      if (!grouped[job.companyName]) {
        grouped[job.companyName] = [];
      }
      grouped[job.companyName].push(job);
    });

    let html = '';
    for (const [company, jobs] of Object.entries(grouped)) {
      html += `<div class="target-job-group">`;
      html += `<div class="target-job-company">${company}</div>`;
      jobs.forEach(job => {
        const checked = selectedId === job.id ? 'checked' : '';
        html += `
          <label class="radio target-job-item">
            <input type="radio" name="targetJob" value="${job.id}" ${checked}>
            <span class="target-job-title">${job.title}</span>
            <span class="target-job-salary">${job.salary}</span>
          </label>`;
      });
      html += `</div>`;
    }

    targetJobList.innerHTML = html;
  }

  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const focusCheckboxes = document.querySelectorAll('input[name="focus"]:checked');
    const focusPoints = Array.from(focusCheckboxes).map(cb => cb.value);

    // 收集选中的岗位 ID
    const selectedJob = targetJobList.querySelector('input[name="targetJob"]:checked');
    const selectedJobId = selectedJob ? selectedJob.value : null;

    // 保存模板（不含岗位数据），AI 分析时动态替换占位符
    const promptTemplate = generatePromptTemplate();

    await chrome.storage.sync.set({
      focusPoints,
      customRequirements: customRequirementsInput.value.trim(),
      userBackground: userBackgroundInput.value.trim(),
      selectedJobId
    });

    // prompt 模板存 local（可能超出 sync 配额）
    await chrome.storage.local.set({ analysisPrompt: promptTemplate });

    showMessage('分析设置已保存');
  });
  document.querySelectorAll('input[name="focus"]').forEach(cb => {
    cb.addEventListener('change', updatePromptPreview);
  });
  customRequirementsInput.addEventListener('input', updatePromptPreview);
  userBackgroundInput.addEventListener('input', updatePromptPreview);
  targetJobList.addEventListener('change', (e) => {
    if (e.target.name === 'targetJob') {
      updatePromptPreview();
    }
  });

  // ================================================================
  //  公司数据逻辑
  // ================================================================

  async function loadCompanies() {
    const data = await chrome.storage.local.get(['companies', 'activeCompanyId']);
    companies = data.companies || [];
    activeCompanyId = data.activeCompanyId || null;

    renderCompanyList();
    await refreshTargetJobs();

    if (companies.length > 0) {
      const target = companies.find(c => c.id === activeCompanyId) || companies[0];
      selectCompany(target.id);
    } else {
      showCompanyEmpty();
    }
  }

  async function refreshTargetJobs() {
    const settings = await chrome.storage.sync.get('selectedJobId');
    await loadTargetJobs(settings.selectedJobId);
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

    renderCompanyProfile(company.companyProfile);
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

  const companyProfile = document.getElementById('companyProfile');
  const profileContent = document.getElementById('profileContent');

  function renderCompanyProfile(profile) {
    if (!profile || Object.keys(profile).length === 0) {
      companyProfile.classList.add('hidden');
      return;
    }

    companyProfile.classList.remove('hidden');
    let html = '';

    if (profile.companyIntro) {
      html += `<div class="profile-section"><h4>公司简介</h4><p>${profile.companyIntro}</p></div>`;
    }
    if (profile.culture) {
      html += `<div class="profile-section"><h4>企业文化</h4><p>${profile.culture}</p></div>`;
    }
    if (profile.talentDev?.length) {
      html += `<div class="profile-section"><h4>人才发展</h4><div class="tag-list">${profile.talentDev.map(t => `<span class="tag">${t}</span>`).join('')}</div></div>`;
    }
    if (profile.products?.length) {
      html += `<div class="profile-section"><h4>产品介绍</h4><p>${profile.products.join('、')}</p></div>`;
    }
    if (profile.workTime) {
      html += `<div class="profile-section"><h4>工作时间及福利</h4><p>${profile.workTime}</p></div>`;
    }
    if (profile.benefits?.length) {
      html += `<div class="profile-section"><div class="tag-list">${profile.benefits.map(t => `<span class="tag">${t}</span>`).join('')}</div></div>`;
    }

    profileContent.innerHTML = html;
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
