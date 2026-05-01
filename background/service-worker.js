/**
 * BOSS直聘 JD采集助手 - Background Service Worker
 * 处理数据存储和AI分析
 */

import { analyzeWithAI, testApiConnection, generateMarkdownReport } from '../utils/ai-client.js';

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('[JD采集助手] 扩展已安装');
  // 初始化存储
  chrome.storage.local.set({
    jobs: [],
    analyses: [],
    companyName: ''
  });
});

// 监听来自Content Script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

/**
 * 处理消息
 */
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

      case 'JOB_DETAIL_COLLECTED':
        await handleJobDetailCollected(request);
        sendResponse({ success: true });
        break;

      case 'START_ANALYSIS':
        await startAnalysis(sendResponse);
        break;

      case 'GET_EXPORT_DATA':
        await getExportData(request.exportType, sendResponse);
        break;

      case 'GET_STATUS':
        await getStatus(sendResponse);
        break;

      case 'CLEAR_DATA':
        await clearData(sendResponse);
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
 * 测试API连接
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
 */
async function handleJobListCollected(request) {
  const { count, companyName } = request;
  await chrome.storage.local.set({ companyName });
  notifyPopup({
    type: 'STATUS_UPDATE',
    jobCount: count,
    companyName: companyName
  });
}

/**
 * 处理岗位详情采集完成
 */
async function handleJobDetailCollected(request) {
  const { count } = request;
  notifyPopup({
    type: 'STATUS_UPDATE',
    jobCount: count
  });
}

/**
 * 开始AI分析
 */
async function startAnalysis(sendResponse) {
  // 获取当前页面的岗位数据
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    sendResponse({ success: false, error: '无法获取当前标签页' });
    return;
  }

  // 从Content Script获取岗位数据
  let jobs = [];
  let companyName = '';

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobs' });
    if (response.success) {
      jobs = response.data;
      companyName = response.companyName;
    }
  } catch (error) {
    sendResponse({ success: false, error: '请确保在BOSS直聘页面使用' });
    return;
  }

  if (jobs.length === 0) {
    sendResponse({ success: false, error: '没有采集到岗位数据，请先采集' });
    return;
  }

  // 获取AI配置
  const config = await chrome.storage.sync.get(['apiEndpoint', 'apiKey', 'model']);

  if (!config.apiEndpoint || !config.apiKey) {
    sendResponse({ success: false, error: '请先在设置中配置API地址和Key' });
    return;
  }

  // 通知开始分析
  notifyPopup({ type: 'ANALYSIS_START', jobCount: jobs.length });

  try {
    // 调用AI分析
    const analysis = await analyzeWithAI(config, jobs, companyName);

    // 保存分析结果
    const analyses = await chrome.storage.local.get('analyses');
    const analysisRecord = {
      id: Date.now(),
      companyName: companyName,
      jobCount: jobs.length,
      analysis: analysis,
      createdAt: Date.now()
    };

    const existingAnalyses = analyses.analyses || [];
    existingAnalyses.push(analysisRecord);
    await chrome.storage.local.set({ analyses: existingAnalyses });

    // 通知分析完成
    notifyPopup({
      type: 'ANALYSIS_COMPLETE',
      analysis: analysis,
      companyName: companyName
    });

    sendResponse({ success: true, analysis: analysis });
  } catch (error) {
    notifyPopup({ type: 'ANALYSIS_ERROR', error: error.message });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 获取导出数据（返回数据给Popup，由Popup处理下载）
 */
async function getExportData(exportType, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ success: false, error: '无法获取当前标签页' });
      return;
    }

    let jobs = [];

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobs' });
      if (response.success) {
        jobs = response.data;
      }
    } catch (error) {
      sendResponse({ success: false, error: '请确保在BOSS直聘页面使用' });
      return;
    }

    if (jobs.length === 0) {
      sendResponse({ success: false, error: '没有可导出的数据，请先采集' });
      return;
    }

    // 从页面标题获取公司名
    const pageTitle = tab.title || '';
    const companyMatch = pageTitle.match(/^(.+?)的招聘/);
    const companyName = companyMatch ? companyMatch[1] : '未知公司';

    if (exportType === 'report') {
      // 导出AI分析报告
      const { analyses = [] } = await chrome.storage.local.get('analyses');

      if (analyses.length === 0) {
        sendResponse({ success: false, error: '没有可导出的分析结果，请先进行AI分析' });
        return;
      }

      const latestAnalysis = analyses[analyses.length - 1];
      const markdown = generateMarkdownReport(latestAnalysis.analysis, jobs, companyName);

      sendResponse({
        success: true,
        data: {
          markdown: markdown,
          companyName: companyName
        }
      });
    } else if (exportType === 'raw') {
      // 导出原始数据
      const exportData = {
        exportedAt: new Date().toISOString(),
        source: 'BOSS直聘JD采集助手',
        companyName: companyName,
        totalJobs: jobs.length,
        jobs: jobs
      };

      const jsonData = JSON.stringify(exportData, null, 2);

      sendResponse({
        success: true,
        data: {
          jsonData: jsonData,
          companyName: companyName
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
 * 获取状态
 */
async function getStatus(sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    sendResponse({
      success: true,
      data: { jobCount: 0, companyName: '', hasAnalysis: false }
    });
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
    const { analyses = [] } = await chrome.storage.local.get('analyses');

    sendResponse({
      success: true,
      data: {
        jobCount: response.data?.count || 0,
        companyName: response.data?.companyName || '',
        hasAnalysis: analyses.length > 0
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
 * 清空数据
 */
async function clearData(sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'clearJobs' });
    } catch (e) {
      // 忽略错误
    }
  }

  await chrome.storage.local.set({ analyses: [] });

  notifyPopup({
    type: 'STATUS_UPDATE',
    jobCount: 0,
    companyName: ''
  });

  sendResponse({ success: true });
}

/**
 * 通知Popup
 */
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup可能未打开，忽略错误
  });
}
