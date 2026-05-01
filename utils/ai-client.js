/**
 * BOSS直聘 JD采集助手 - AI分析模块
 * 支持所有OpenAI兼容的API接口
 */

/**
 * 分析提示词
 */
const ANALYSIS_PROMPT = `你是一位资深技术面试官和招聘分析师。请分析以下公司所有技术岗位的JD，提取关键信息。

请按以下结构输出分析报告：

## 1. 技术栈分析

### 前端技术
- 框架（React/Vue/Angular等）
- UI组件库
- 构建工具
- 状态管理
- 其他前端技术

### 后端技术
- 编程语言
- 框架
- 数据库（关系型/非关系型）
- 中间件（消息队列/缓存等）
- API设计风格

### 基础设施
- 云服务商
- 容器化/部署
- CI/CD
- 监控/日志

## 2. 业务关注点

- 核心业务方向（从岗位JD推断）
- 正在解决的技术挑战
- 团队规模和结构
- 未来技术规划（如有提及）

## 3. 面试准备建议

### 必须掌握
- 列出5-10个最重要的技术点

### 建议深入
- 列出3-5个加分技术方向

### 可能的面试题目
- 根据技术栈推测5-8个可能的面试问题

请用Markdown格式输出，确保层次清晰、重点突出。`;

/**
 * 格式化岗位数据用于分析
 */
function formatJobsForAnalysis(jobs) {
  return jobs.map((job, index) => {
    return `### 岗位 ${index + 1}: ${job.title}
- 薪资: ${job.salary}
- 标签: ${Array.isArray(job.tags) ? job.tags.join(', ') : job.tags}

**岗位描述:**
${job.fullText || job.description || '暂无详细描述'}

---`;
  }).join('\n\n');
}

/**
 * 调用AI API（OpenAI兼容接口）
 * @param {Object} config - 配置
 * @param {string} config.apiEndpoint - API端点地址
 * @param {string} config.apiKey - API密钥
 * @param {string} config.model - 模型名称
 * @param {Array} jobs - 岗位数据
 * @param {string} companyName - 公司名称
 */
async function analyzeWithAI(config, jobs, companyName) {
  const { apiEndpoint, apiKey, model } = config;

  if (!apiEndpoint) {
    throw new Error('请先在设置中配置API地址');
  }

  if (!apiKey) {
    throw new Error('请先在设置中配置API Key');
  }

  if (!jobs || jobs.length === 0) {
    throw new Error('没有可分析的岗位数据');
  }

  const jobText = formatJobsForAnalysis(jobs);
  const userMessage = `公司名称：${companyName}\n\n以下是该公司的所有技术岗位JD：\n\n${jobText}`;

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: [
        { role: 'system', content: '你是一位资深技术面试官和招聘分析师。' },
        { role: 'user', content: `${ANALYSIS_PROMPT}\n\n${userMessage}` }
      ],
      temperature: 0.3,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API调用失败: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();

  if (result.choices && result.choices.length > 0) {
    return result.choices[0].message.content;
  }

  throw new Error('API返回格式异常');
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

export { analyzeWithAI, generateMarkdownReport };
