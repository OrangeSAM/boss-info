/**
 * BOSS直聘 JD采集助手 - AI分析模块
 * 支持 Anthropic 格式 API（如小米 MiMo）
 */

/**
 * 默认分析提示词（当用户未在设置中配置时使用）
 */
const DEFAULT_ANALYSIS_PROMPT = `你是一位资深技术面试官和招聘分析师。请分析以下公司的所有技术岗位JD。

## 分析要求

### 1. 公司业务分析（简要）
- 这家公司是做什么的？核心产品是什么？
- 技术团队规模大概多少人？
- 在行业中的定位？

### 2. 技术栈分析
请从JD中提取并分析：
- **前端技术栈**：框架、构建工具、状态管理、UI库等
- **后端技术栈**：语言、框架、数据库、中间件等
- **基础设施**：云服务、容器化、CI/CD等

### 3. 岗位要求分析
- **学历要求**
- **经验要求**
- **薪资范围**
- **加班情况**
- **加分项**

### 4. 技术氛围评估
从JD推断团队的技术文化和发展方向。

### 5. 面试准备清单
- 必须掌握的核心技术点
- 可能的面试题目
- 项目经验包装建议

### 6. 风险提示
- 技术栈是否老旧
- 薪资竞争力
- 潜在的坑

## 输出格式
使用Markdown格式输出，层次清晰，重点突出。`;

/**
 * 格式化岗位数据用于分析
 */
function formatJobsForAnalysis(jobs) {
  return jobs.map((job, index) => {
    return `### 岗位 ${index + 1}: ${job.title}
- 薪资: ${job.salary}
- 标签: ${Array.isArray(job.tags) ? job.tags.join(', ') : job.tags}

**岗位描述:**
${job.description || '暂无详细描述'}

---`;
  }).join('\n\n');
}

/**
 * 检测API格式（Anthropic 还是 OpenAI）
 */
function detectApiFormat(endpoint) {
  if (endpoint.includes('/anthropic') || endpoint.includes('/messages')) {
    return 'anthropic';
  }
  return 'openai';
}

/**
 * 调用 Anthropic 格式 API（如小米 MiMo）
 */
async function callAnthropicApi(apiEndpoint, apiKey, model, userMessage) {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      model: model || 'mimo-v2.5',
      max_tokens: 131072,
      system: '你是一位资深技术面试官和招聘分析师。',
      messages: [
        { role: 'user', content: userMessage }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API调用失败: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();

  // Anthropic 格式响应
  if (result.content && result.content.length > 0) {
    return result.content[0].text;
  }

  throw new Error('API返回格式异常');
}

/**
 * 调用 OpenAI 格式 API
 */
async function callOpenAiApi(apiEndpoint, apiKey, model, userMessage) {
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: [
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 131072
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API调用失败: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();

  // OpenAI 格式响应
  if (result.choices && result.choices.length > 0) {
    return result.choices[0].message.content;
  }

  throw new Error('API返回格式异常');
}

/**
 * 获取用户配置的分析提示词
 */
async function getAnalysisPrompt() {
  const settings = await chrome.storage.local.get('analysisPrompt');
  return settings.analysisPrompt || DEFAULT_ANALYSIS_PROMPT;
}

/**
 * 调用AI分析
 * @param {Object} config - API 配置
 * @param {Object} targetJob - 用户要投递的目标岗位
 * @param {Array} otherJobs - 该公司其他岗位（用于勾勒公司全貌）
 * @param {string} companyName - 公司名称
 * @param {Object} companyProfile - 公司简介信息
 */
async function analyzeWithAI(config, targetJob, otherJobs, companyName, companyProfile) {
  const { apiEndpoint, apiKey, model } = config;

  if (!apiEndpoint) {
    throw new Error('请先在设置中配置API地址');
  }

  if (!apiKey) {
    throw new Error('请先在设置中配置API Key');
  }

  if (!targetJob) {
    throw new Error('没有可分析的目标岗位');
  }

  // 从设置中获取用户配置的 prompt
  const analysisPrompt = await getAnalysisPrompt();

  // 格式化目标岗位
  const targetJobText = formatJobsForAnalysis([targetJob]);

  // 格式化其他岗位
  const otherJobsText = otherJobs && otherJobs.length > 0
    ? formatJobsForAnalysis(otherJobs)
    : '';

  // 组装公司背景信息
  let companyProfileText = '';
  if (companyProfile) {
    const parts = [];
    if (companyProfile.companyIntro) parts.push(`公司简介：${companyProfile.companyIntro}`);
    if (companyProfile.culture) parts.push(`企业文化：${companyProfile.culture}`);
    if (companyProfile.products?.length) parts.push(`产品介绍：${companyProfile.products.join('、')}`);
    if (companyProfile.workTime) parts.push(`工作时间：${companyProfile.workTime}`);
    if (companyProfile.benefits?.length) parts.push(`福利待遇：${companyProfile.benefits.join('、')}`);
    if (companyProfile.talentDev?.length) parts.push(`人才发展：${companyProfile.talentDev.join('、')}`);
    if (parts.length > 0) {
      companyProfileText = parts.join('\n');
    }
  }

  // 动态替换 prompt 中的占位符
  let finalPrompt = analysisPrompt;
  finalPrompt = finalPrompt.replace('公司名称：（选择目标岗位后自动填充）', `公司名称：${companyName}`);
  finalPrompt = finalPrompt.replace('（公司背景信息会在这里自动填充）', companyProfileText || '（暂无公司背景信息）');
  finalPrompt = finalPrompt.replace('（请先选择一个目标岗位）', targetJobText);
  finalPrompt = finalPrompt.replace('（其他岗位信息会在这里自动填充）', otherJobsText || '（暂无其他岗位信息）');

  console.log('[JD采集助手] Prompt 组装完成:');
  console.log('- 公司:', companyName);
  console.log('- 目标岗位:', targetJob.title);
  console.log('- 其他岗位数:', otherJobs?.length || 0);
  console.log('- Prompt 长度:', finalPrompt.length, '字符');
  console.log('[JD采集助手] 完整 Prompt:', finalPrompt);

  // 自动检测API格式
  const apiFormat = detectApiFormat(apiEndpoint);
  console.log('[JD采集助手] API格式:', apiFormat);

  if (apiFormat === 'anthropic') {
    return await callAnthropicApi(apiEndpoint, apiKey, model, finalPrompt);
  } else {
    return await callOpenAiApi(apiEndpoint, apiKey, model, finalPrompt);
  }
}

/**
 * 测试API连接
 */
async function testApiConnection(config) {
  const { apiEndpoint, apiKey, model } = config;
  const apiFormat = detectApiFormat(apiEndpoint);

  if (apiFormat === 'anthropic') {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        model: model || 'mimo-v2.5',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || response.statusText);
    }

    const result = await response.json();
    if (!result.content) {
      throw new Error('API返回格式异常');
    }
  } else {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || response.statusText);
    }

    const result = await response.json();
    if (!result.choices) {
      throw new Error('API返回格式异常');
    }
  }
}

/**
 * 生成导出用的Markdown报告
 */
function generateMarkdownReport(analysis, jobs, companyName) {
  const now = new Date().toLocaleString('zh-CN');

  const jobSummary = jobs.map(job => {
    return `| ${job.title} | ${job.salary} |`;
  }).join('\n');

  return `# ${companyName} 技术分析报告

> 生成时间：${now}
> 采集岗位数：${jobs.length}

---

## 采集岗位概览

| 岗位 | 薪资 |
|------|------|
${jobSummary}

---

${analysis}

---

*本报告由BOSS直聘JD采集助手自动生成*
`;
}

export { analyzeWithAI, testApiConnection, generateMarkdownReport };
