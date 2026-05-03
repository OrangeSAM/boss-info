/**
 * BOSS直聘 JD采集助手 - Content Script
 * 通过模拟点击采集所有岗位详情，支持分页
 */

(function() {
  'use strict';

  const collectedJobs = new Map();
  let companyName = '';
  let isCollecting = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 提取公司名称
   */
  function extractCompanyName() {
    const titleMatch = document.title.match(/^(.+?)的招聘/);
    if (titleMatch) return titleMatch[1];

    const el = document.querySelector('.company-name, [class*="brand-name"]');
    return el?.textContent?.trim() || '';
  }

  /**
   * 提取当前页岗位卡片（只从主列表提取，排除推荐）
   */
  function extractJobCards() {
    const cards = [];

    // 尝试多种选择器
    let jobCards = [];

    // 方法1: ul.job-list > li.job-card-box
    const mainList = document.querySelector('ul.job-list');
    if (mainList) {
      jobCards = mainList.querySelectorAll(':scope > li');
    }

    // 方法2: 直接找所有 li.job-card-box
    if (jobCards.length === 0) {
      jobCards = document.querySelectorAll('li.job-card-box');
    }

    // 方法3: 更宽泛的选择器
    if (jobCards.length === 0) {
      jobCards = document.querySelectorAll('[class*="job-card"]');
    }

    jobCards.forEach((card, index) => {
      try {
        // 提取标题
        const titleEl = card.querySelector('a.job-name, [class*="job-name"]');
        const title = titleEl?.textContent?.trim() || '';

        // 提取薪资
        const salaryEl = card.querySelector('.job-salary, [class*="salary"]');
        const salary = salaryEl?.textContent?.trim() || '';

        // 提取标签
        const tagEls = card.querySelectorAll('.tag-list li, [class*="tag"] li');
        const tags = Array.from(tagEls).map(t => t.textContent.trim()).filter(Boolean);

        // 从链接提取jobId
        const href = titleEl?.getAttribute('href') || '';
        const jobIdMatch = href.match(/job_detail\/([^.~]+)/);
        const jobId = jobIdMatch ? jobIdMatch[1] : `card_${Date.now()}_${index}`;

        // 提取地区
        const area = tags.find(t => /深圳|北京|上海|广州|杭州|成都/.test(t)) || '';

        if (title) {
          cards.push({
            element: card,
            jobId: jobId,
            title: title,
            salary: salary,
            area: area,
            tags: tags.filter(t => t !== area),
            index: index
          });
        }
      } catch (e) {
        console.error(`[JD采集助手] 提取第${index}个卡片失败:`, e);
      }
    });
    return cards;
  }

  /**
   * 清理文本中的CSS样式代码和反爬虫水印
   */
  function cleanText(text) {
    if (!text) return '';

    let cleaned = text;

    // 移除CSS样式代码
    cleaned = cleaned.replace(/\.[a-zA-Z0-9_-]+\{[^}]*\}/g, '');

    // 移除BOSS直聘反爬虫水印
    cleaned = cleaned.replace(/来自BOSS直聘/g, '');
    cleaned = cleaned.replace(/BOSS直聘/g, '');
    cleaned = cleaned.replace(/来自BOSS/g, '');
    cleaned = cleaned.replace(/kanzhun/g, '');

    // 循环移除所有"直聘"，直到没有为止
    // 因为"直聘"被随机插入到任意中文字符之间
    let prev;
    do {
      prev = cleaned;
      // 移除被中文包围的"直聘"
      cleaned = cleaned.replace(/直聘/g, '');
    } while (cleaned !== prev);

    // 移除boss（不区分大小写）
    cleaned = cleaned.replace(/boss/gi, '');

    // 移除多余空白
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * 提取当前详情面板内容
   */
  function extractCurrentJobDetail() {
    const detailPanel = document.querySelector('.job-detail-box');
    if (!detailPanel) {
      return { description: '' };
    }

    // 提取职位描述
    const descEl = detailPanel.querySelector('.desc-wrapper');
    let description = descEl?.textContent?.trim() || '';

    // 清理描述内容
    description = cleanText(description);

    // 尝试从面板提取公司名
    const panelText = detailPanel.textContent;
    const companyMatch = panelText.match(/[一-龥]+科技[一-龥]*/);
    if (companyMatch && !companyName) {
      companyName = companyMatch[0];
    }

    return {
      description: description
    };
  }

  /**
   * 点击岗位卡片
   */
  function clickCardSafely(cardElement) {
    // 直接点击卡片元素
    const rect = cardElement.getBoundingClientRect();
    const x = rect.left + 50;
    const y = rect.top + rect.height / 2;

    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    });

    cardElement.dispatchEvent(event);
  }

  /**
   * 检查是否有下一页
   */
  function hasNextPage() {
    const nextBtn = document.querySelector('a[ka="page-next"]');
    return nextBtn && !nextBtn.classList.contains('disabled');
  }

  /**
   * 点击下一页
   */
  async function goToNextPage() {
    const nextBtn = document.querySelector('a[ka="page-next"]');
    if (nextBtn && !nextBtn.classList.contains('disabled')) {
      nextBtn.click();
      await sleep(2000);
      return true;
    }
    return false;
  }

  /**
   * 获取当前页码
   */
  function getCurrentPage() {
    const selected = document.querySelector('.options-pages a.selected');
    return selected ? parseInt(selected.textContent) || 1 : 1;
  }

  /**
   * 采集当前页的所有岗位
   */
  async function collectCurrentPage(callback) {
    const cards = extractJobCards();

    if (cards.length === 0) {
      return 0;
    }

    let collectedCount = 0;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      // 跳过已采集的
      if (collectedJobs.has(card.jobId)) {
        continue;
      }

      // 通知进度
      if (callback) {
        callback({
          type: 'COLLECTION_PROGRESS',
          current: collectedJobs.size + 1,
          jobTitle: card.title
        });
      }

      // 点击卡片
      clickCardSafely(card.element);

      // 等待详情加载
      await sleep(1000);

      // 提取详情
      const detail = extractCurrentJobDetail();

      // 存储
      collectedJobs.set(card.jobId, {
        id: card.jobId,
        title: card.title,
        salary: card.salary,
        tags: card.tags,
        description: detail.description,
        collectedAt: Date.now()
      });

      collectedCount++;
      await sleep(500);
    }

    return collectedCount;
  }

  /**
   * 检查当前是否在正确的采集页面（公司招聘岗位页）
   */
  function isOnValidCollectPage() {
    const url = window.location.href;
    // 匹配 /gongsi/job/ 路径
    return /zhipin\.com\/gongsi\/job\//.test(url);
  }

  /**
   * 完整采集流程
   */
  async function performCollection(callback) {
    if (isCollecting) {
      return { success: false, error: '正在采集中' };
    }

    // 检查是否在正确的页面
    if (!isOnValidCollectPage()) {
      return {
        success: false,
        error: '请先打开公司招聘岗位页面再采集'
      };
    }

    isCollecting = true;

    companyName = extractCompanyName();

    let pageNum = 1;
    const maxPages = 10; // 安全限制

    try {
      while (pageNum <= maxPages) {
        if (callback) {
          callback({
            type: 'COLLECTION_PROGRESS',
            page: pageNum,
            collected: collectedJobs.size,
            message: `正在采集第 ${pageNum} 页...`
          });
        }

        // 采集当前页
        await collectCurrentPage(callback);

        // 检查是否有下一页
        if (hasNextPage()) {
          const moved = await goToNextPage();

          if (!moved) {
            break;
          }

          pageNum++;
        } else {
          break;
        }
      }
    } catch (error) {
      console.error('[JD采集助手] 采集出错:', error);
      isCollecting = false;
      return {
        success: false,
        error: `采集出错: ${error.message}`,
        count: collectedJobs.size,
        companyName: companyName
      };
    }

    isCollecting = false;

    const jobsData = Array.from(collectedJobs.values());

    const result = {
      success: true,
      count: jobsData.length,
      companyName: companyName,
      pages: pageNum,
      jobs: jobsData
    };

    // 通知 Background 写入存储
    chrome.runtime.sendMessage({
      type: 'JOB_LIST_COLLECTED',
      jobs: jobsData,
      companyName: companyName
    }).catch(() => {});

    return result;
  }

  function getAllJobs() {
    return Array.from(collectedJobs.values());
  }

  function getCompanyName() {
    return companyName;
  }

  function clearJobs() {
    collectedJobs.clear();
    companyName = '';
  }

  // 消息监听
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getJobs') {
      sendResponse({
        success: true,
        data: getAllJobs(),
        companyName: getCompanyName()
      });
      return false;
    }

    if (request.action === 'startCollection') {
      performCollection((progress) => {
        chrome.runtime.sendMessage(progress).catch(() => {});
      }).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }

    if (request.action === 'getStatus') {
      sendResponse({
        success: true,
        data: {
          count: collectedJobs.size,
          companyName: getCompanyName()
        }
      });
      return false;
    }

    if (request.action === 'clearJobs') {
      clearJobs();
      sendResponse({ success: true });
      return false;
    }

    return false;
  });

  console.log('[JD采集助手] Content Script 已加载');
})();
