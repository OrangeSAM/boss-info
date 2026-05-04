/**
 * BOSS直聘 JD采集助手 - Background Service Worker（多 Provider + 多公司）
 */

import { analyzeWithAI, testApiConnection, generateMarkdownReport } from '../utils/ai-client.js';

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ companies: [], activeCompanyId: null });
});

// 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.type) {
      case 'TEST_API':
        await testApiConnectionHandler(request, sendResponse);
        break;
      case 'JOB_LIST_COLLECTED':
        await handleJobListCollected(request);
        sendResponse({ success: true });
        break;
      case 'START_ANALYSIS':
        await startAnalysis(request, sendResponse);
        break;
      case 'GET_EXPORT_DATA':
        await getExportData(request, sendResponse);
        break;
      case 'GET_STATUS':
        await getStatus(sendResponse);
        break;
      default:
        sendResponse({ success: false, error: '未知操作类型' });
    }
  } catch (error) {
    console.error('[JD采集助手] 处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 测试 API 连接
 */
async function testApiConnectionHandler(request, sendResponse) {
  const { apiEndpoint, apiKey, model } = request;
  try {
    await testApiConnection({ apiEndpoint, apiKey, model });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理岗位列表采集完成
 * 将数据写入对应的 company 条目（按名称匹配，有则追加，无则新建）
 */
async function handleJobListCollected(request) {
  const { jobs, companyName, companyProfile } = request;

  if (!companyName || !jobs || jobs.length === 0) return;

  const { companies = [] } = await chrome.storage.local.get('companies');

  // 按名称查找已有公司
  let company = companies.find(c => c.name === companyName);

  if (company) {
    // 追加岗位（去重）
    const existingIds = new Set(company.jobs.map(j => j.id));
    const newJobs = jobs.filter(j => !existingIds.has(j.id));
    company.jobs.push(...newJobs);
    // 如果有新的公司简介且之前没有，则存储
    if (companyProfile && !company.companyProfile) {
      company.companyProfile = companyProfile;
    }
  } else {
    // 新建公司条目
    company = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: companyName,
      jobs: jobs,
      analyses: [],
      companyProfile: companyProfile || null,
      collectedAt: Date.now()
    };
    companies.push(company);
  }

  await chrome.storage.local.set({ companies });

  notifyPopup({
    type: 'STATUS_UPDATE',
    jobCount: company.jobs.length,
    companyName: companyName
  });
}

/**
 * 获取活跃 Provider 配置
 */
async function getActiveProvider() {
  const { providers = [], activeProviderId } = await chrome.storage.sync.get(['providers', 'activeProviderId']);

  if (providers.length === 0) return null;

  const provider = providers.find(p => p.id === activeProviderId) || providers[0];
  if (!provider || !provider.endpoint || !provider.key) return null;

  return {
    apiEndpoint: provider.endpoint,
    apiKey: provider.key,
    model: provider.model
  };
}

/**
 * 获取指定公司
 */
async function getCompany(companyId) {
  const { companies = [] } = await chrome.storage.local.get('companies');
  return companies.find(c => c.id === companyId) || null;
}

/**
 * 保存公司数据
 */
async function saveCompany(company) {
  const { companies = [] } = await chrome.storage.local.get('companies');
  const index = companies.findIndex(c => c.id === company.id);
  if (index >= 0) {
    companies[index] = company;
  }
  await chrome.storage.local.set({ companies });
}

/**
 * 开始 AI 分析
 */
async function startAnalysis(request, sendResponse) {
  const { companyId } = request;

  const company = await getCompany(companyId);
  if (!company || company.jobs.length === 0) {
    sendResponse({ success: false, error: '没有采集到岗位数据，请先采集' });
    return;
  }

  const config = await getActiveProvider();
  if (!config) {
    sendResponse({ success: false, error: '请先在设置中配置 API Provider' });
    return;
  }

  // 根据用户选择的目标岗位筛选
  const { selectedJobId } = await chrome.storage.sync.get('selectedJobId');

  if (!selectedJobId) {
    sendResponse({ success: false, error: '请先选择一个目标岗位' });
    return;
  }

  const targetJob = company.jobs.find(j => j.id === selectedJobId);
  if (!targetJob) {
    sendResponse({ success: false, error: '选中的岗位不存在，请重新选择' });
    return;
  }

  // 其他岗位用于勾勒公司全貌
  const otherJobs = company.jobs.filter(j => j.id !== selectedJobId);

  notifyPopup({ type: 'ANALYSIS_START', jobCount: 1 });

  try {
    const analysis = await analyzeWithAI(config, targetJob, otherJobs, company.name, company.companyProfile);

    if (!company.analyses) company.analyses = [];
    company.analyses.push({
      id: Date.now(),
      jobCount: 1,
      analysis: analysis,
      createdAt: Date.now()
    });

    await saveCompany(company);

    notifyPopup({ type: 'ANALYSIS_COMPLETE', analysis, companyName: company.name });
    sendResponse({ success: true, analysis });
  } catch (error) {
    notifyPopup({ type: 'ANALYSIS_ERROR', error: error.message });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 获取导出数据
 */
async function getExportData(request, sendResponse) {
  const { exportType, companyId } = request;

  const company = await getCompany(companyId);
  if (!company || company.jobs.length === 0) {
    sendResponse({ success: false, error: '没有可导出的数据，请先采集' });
    return;
  }

  try {
    if (exportType === 'report') {
      if (!company.analyses || company.analyses.length === 0) {
        sendResponse({ success: false, error: '没有可导出的分析结果，请先进行 AI 分析' });
        return;
      }

      const latestAnalysis = company.analyses[company.analyses.length - 1];
      const markdown = generateMarkdownReport(latestAnalysis.analysis, company.jobs, company.name);

      sendResponse({
        success: true,
        data: { markdown, companyName: company.name }
      });
    } else if (exportType === 'raw') {
      const exportData = {
        exportedAt: new Date().toISOString(),
        source: 'BOSS直聘JD采集助手',
        companyName: company.name,
        totalJobs: company.jobs.length,
        jobs: company.jobs
      };

      sendResponse({
        success: true,
        data: {
          jsonData: JSON.stringify(exportData, null, 2),
          companyName: company.name
        }
      });
    } else {
      sendResponse({ success: false, error: '未知的导出类型' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 获取状态（返回最新公司信息）
 */
async function getStatus(sendResponse) {
  try {
    const { companies = [] } = await chrome.storage.local.get('companies');

    if (companies.length === 0) {
      sendResponse({
        success: true,
        data: { jobCount: 0, companyName: '', hasAnalysis: false }
      });
      return;
    }

    // 返回最近采集的公司
    const latest = companies.reduce((a, b) => (a.collectedAt > b.collectedAt ? a : b));

    sendResponse({
      success: true,
      data: {
        jobCount: latest.jobs.length,
        companyName: latest.name,
        hasAnalysis: latest.analyses && latest.analyses.length > 0
      }
    });
  } catch (error) {
    sendResponse({
      success: true,
      data: { jobCount: 0, companyName: '', hasAnalysis: false }
    });
  }
}

/**
 * 通知 Popup
 */
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}
