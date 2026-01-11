import { v4 as uuidv4 } from 'uuid';
import { PlaywrightManager } from '../../core/playwright/PlaywrightManager';
import { StorageManager } from '../../core/storage/StorageManager';
import { ScanResult, NetworkRequest, ConsoleMessage, CritiqueResult } from '../../types/schemas';
import { ElementExtractor } from './ElementExtractor';
import { RouteDiscovery } from './RouteDiscovery';

/**
 * 扫描代理 (Phase A)
 * 负责探索页面功能、截图并提取元素信息
 */
export class ScanAgent {
  private playwright: PlaywrightManager;
  private storage: StorageManager;
  private elementExtractor: ElementExtractor;
  private routeDiscovery: RouteDiscovery | null = null;

  constructor(playwright: PlaywrightManager, storage: StorageManager) {
    this.playwright = playwright;
    this.storage = storage;
    this.elementExtractor = new ElementExtractor();
  }

  /**
   * 扫描单个页面
   */
  async scanPage(url: string): Promise<ScanResult> {
    console.log(`\n[ScanAgent] 开始扫描页面: ${url}`);

    // 记录网络请求和控制台消息
    const networkRequests: NetworkRequest[] = [];
    const consoleMessages: ConsoleMessage[] = [];

    const page = this.playwright.getPage();

    // 监听网络请求
    page.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        timestamp: new Date().toISOString(),
      });
    });

    page.on('response', (response) => {
      const request = networkRequests.find(r => r.url === response.url());
      if (request) {
        request.status = response.status();
      }
    });

    // 监听控制台消息
    page.on('console', (msg) => {
      const type = msg.type();
      if (['log', 'warn', 'error', 'info', 'debug'].includes(type)) {
        consoleMessages.push({
          type: type as any,
          text: msg.text(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 导航到页面
    await this.playwright.goto(url, { waitUntil: 'networkidle' });

    // 等待页面稳定
    await this.delay(1000);

    // 提取元素
    console.log('[ScanAgent] 提取页面元素...');
    const elements = await this.elementExtractor.extractElements(page);
    console.log(`[ScanAgent] 发现 ${elements.length} 个交互元素`);

    // 截图
    console.log('[ScanAgent] 捕获截图...');
    const screenshot = await this.playwright.screenshot({ fullPage: true });

    // 获取 HTML 快照
    console.log('[ScanAgent] 保存 HTML 快照...');
    const html = await this.playwright.getHTML();

    // 生成时间戳
    const timestamp = new Date().toISOString();
    const timestampDir = timestamp.replace(/:/g, '-').split('.')[0] + 'Z';

    // 保存截图
    const screenshotFilename = `scan_${Date.now()}.png`;
    const screenshotPath = await this.storage.saveBinaryFile(
      'scan',
      timestampDir,
      screenshotFilename,
      screenshot
    );

    // 保存 HTML 快照
    const htmlFilename = `scan_${Date.now()}.html`;
    const htmlPath = await this.storage.saveTextFile(
      'scan',
      timestampDir,
      htmlFilename,
      html
    );

    // 创建扫描结果
    const scanResult: ScanResult = {
      id: uuidv4(),
      url,
      route: new URL(url).pathname,
      timestamp,
      screenshot: screenshotPath,
      elements,
      networkRequests,
      console: consoleMessages,
      htmlSnapshot: htmlPath,
      critique: this.generateBasicCritique(elements, networkRequests),
    };

    // 保存扫描结果
    await this.storage.savePhaseData('scan', scanResult);

    console.log(`[ScanAgent] 扫描完成: ${url}`);
    console.log(`  - 元素: ${elements.length}`);
    console.log(`  - 网络请求: ${networkRequests.length}`);
    console.log(`  - 控制台消息: ${consoleMessages.length}`);

    return scanResult;
  }

  /**
   * 扫描多个页面
   */
  async scanPages(urls: string[]): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const url of urls) {
      try {
        const result = await this.scanPage(url);
        results.push(result);

        // 添加延迟，避免过快请求
        await this.delay(1000);
      } catch (error) {
        console.error(`[ScanAgent] 扫描失败 ${url}:`, (error as Error).message);
      }
    }

    return results;
  }

  /**
   * 自动发现并扫描网站路由
   */
  async scanWebsite(baseUrl: string, maxDepth: number = 2): Promise<ScanResult[]> {
    console.log(`\n[ScanAgent] 开始扫描网站: ${baseUrl}`);
    console.log(`[ScanAgent] 最大深度: ${maxDepth}`);

    // 初始化路由发现
    this.routeDiscovery = new RouteDiscovery(baseUrl);

    const page = this.playwright.getPage();

    // 尝试从 sitemap 和 robots.txt 发现路由
    console.log('[ScanAgent] 尝试从 sitemap.xml 发现路由...');
    const sitemapRoutes = await this.routeDiscovery.discoverFromSitemap(page);
    console.log(`[ScanAgent] 从 sitemap 发现 ${sitemapRoutes.length} 个路由`);

    console.log('[ScanAgent] 尝试从 robots.txt 发现路由...');
    const robotsRoutes = await this.routeDiscovery.discoverFromRobots(page);
    console.log(`[ScanAgent] 从 robots.txt 发现 ${robotsRoutes.length} 个路由`);

    // 爬取发现路由
    console.log('[ScanAgent] 开始爬取发现路由...');
    const crawledRoutes = await this.routeDiscovery.discoverRoutes(page, maxDepth);
    console.log(`[ScanAgent] 爬取发现 ${crawledRoutes.length} 个路由`);

    // 合并去重
    const allRoutes = Array.from(new Set([
      ...sitemapRoutes,
      ...robotsRoutes,
      ...crawledRoutes,
    ]));

    console.log(`[ScanAgent] 总共发现 ${allRoutes.length} 个唯一路由`);

    // 扫描所有路由
    return await this.scanPages(allRoutes);
  }

  /**
   * 生成基础批判（简化版，完整的 CritiqueEngine 稍后实现）
   */
  private generateBasicCritique(
    elements: any[],
    networkRequests: any[]
  ): CritiqueResult {
    // 简单的置信度计算
    const hasElements = elements.length > 0;
    const hasNetworkActivity = networkRequests.length > 0;

    const completeness = hasElements ? 0.9 : 0.3;
    const accuracy = hasElements && hasNetworkActivity ? 0.8 : 0.6;
    const feasibility = 0.9;
    const coverage = elements.length > 5 ? 0.8 : 0.5;

    const overall = (completeness * 0.3 + accuracy * 0.3 + feasibility * 0.25 + coverage * 0.15);

    const issues: Array<{ severity: any; description: string; suggestion?: string }> = [];

    if (elements.length === 0) {
      issues.push({
        severity: 'high',
        description: '未发现任何交互元素',
        suggestion: '增加等待时间或检查页面加载状态',
      });
    }

    if (networkRequests.length === 0) {
      issues.push({
        severity: 'medium',
        description: '未捕获到网络请求',
        suggestion: '检查页面是否为静态页面',
      });
    }

    return {
      phaseId: 'scan',
      timestamp: new Date().toISOString(),
      confidence: {
        overall,
        dimensions: {
          completeness,
          accuracy,
          feasibility,
          coverage,
        },
        reasoning: `扫描发现 ${elements.length} 个元素和 ${networkRequests.length} 个网络请求`,
        humanReviewRequired: overall < 0.6,
      },
      issues,
      autoCorrections: [],
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
