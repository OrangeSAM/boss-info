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
  console.log('[JD采集助手] Background 收到消息:', request.type || request.action);
  handleMessage(request, sender, sendResponse);
  return true;
});

/**
 * 处理消息
 */
async function handleMessage(request, sender, sendResponse) {
  console.log('[JD采集助手] Background 处理消息:', JSON.stringify(request).substring(0, 100));
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
  console.log(`[JD采集助手] 收到采集完成消息: ${companyName}, ${count} 个岗位`);
  await chrome.storage.local.set({ companyName });
  console.log('[JD采集助手] companyName 已存储');
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
  // 从 storage.local 读取岗位数据
  const { jobs = [] } = await chrome.storage.local.get('jobs');
  const { companyName = '' } = await chrome.storage.local.get('companyName');

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
    // 从 storage.local 读取岗位数据
    const { jobs = [] } = await chrome.storage.local.get('jobs');
    const { companyName = '未知公司' } = await chrome.storage.local.get('companyName');

    if (jobs.length === 0) {
      sendResponse({ success: false, error: '没有可导出的数据，请先采集' });
      return;
    }

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
  try {
    // 从 storage.local 读取数据
    const { jobs = [] } = await chrome.storage.local.get('jobs');
    const { companyName = '' } = await chrome.storage.local.get('companyName');
    const { analyses = [] } = await chrome.storage.local.get('analyses');

    sendResponse({
      success: true,
      data: {
        jobCount: jobs.length,
        companyName: companyName,
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

  await chrome.storage.local.set({ jobs: [], companyName: '', analyses: [] });

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
