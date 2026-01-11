import { chromium, Browser, BrowserContext, Page } from "playwright";

/**
 * Playwright 管理器配置
 */
export interface PlaywrightConfig {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  viewport?: { width: number; height: number };
}

/**
 * Playwright 管理器
 * 负责浏览器生命周期管理
 */
export class PlaywrightManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: PlaywrightConfig;

  constructor(config: PlaywrightConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      slowMo: config.slowMo ?? 0,
      timeout: config.timeout ?? 30000,
      viewport: config.viewport ?? { width: 1920, height: 1080 },
    };
  }

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return; // 已经初始化
    }

    this.browser = await chromium.launch({
      headless: this.config.headless ?? true,
      slowMo: this.config.slowMo ?? 0,
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport ?? { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      // 避免检测
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    // 设置默认超时
    this.context.setDefaultTimeout(this.config.timeout ?? 30000);

    this.page = await this.context.newPage();

    // 注入反检测脚本
    await this.setupAntiDetection();
  }

  /**
   * 设置反检测机制
   */
  private async setupAntiDetection(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      // 隐藏 webdriver 标志
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });

      // 模拟真实平台
      Object.defineProperty(navigator, "platform", {
        get: () => "MacIntel",
      });

      // 添加 chrome 对象（非 headless 浏览器特征）
      // @ts-ignore - 浏览器环境
      window.chrome = {
        runtime: {},
      };

      // 覆盖 permissions API
      // @ts-ignore - 浏览器环境
      const originalQuery = navigator.permissions.query;
      // @ts-ignore - 浏览器环境
      navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              // @ts-ignore - 浏览器环境
              state: Notification.permission,
            } as any)
          : originalQuery(parameters);
    });
  }

  /**
   * 获取当前页面
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error("Playwright not initialized. Call initialize() first.");
    }
    return this.page;
  }

  /**
   * 获取浏览器上下文
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error("Playwright not initialized. Call initialize() first.");
    }
    return this.context;
  }

  /**
   * 创建新页面
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error("Playwright not initialized. Call initialize() first.");
    }
    return await this.context.newPage();
  }

  /**
   * 导航到 URL
   */
  async goto(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" },
  ): Promise<void> {
    const page = this.getPage();
    await page.goto(url, options);
  }

  /**
   * 截图
   */
  async screenshot(options?: {
    fullPage?: boolean;
    path?: string;
  }): Promise<Buffer> {
    const page = this.getPage();
    return await page.screenshot(options);
  }

  /**
   * 获取页面 HTML
   */
  async getHTML(): Promise<string> {
    const page = this.getPage();
    return await page.content();
  }

  /**
   * 等待元素
   */
  async waitForSelector(
    selector: string,
    options?: { timeout?: number },
  ): Promise<void> {
    const page = this.getPage();
    await page.waitForSelector(selector, options);
  }

  /**
   * 点击元素
   */
  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    const page = this.getPage();
    await page.click(selector, options);
  }

  /**
   * 输入文本
   */
  async fill(
    selector: string,
    value: string,
    options?: { timeout?: number },
  ): Promise<void> {
    const page = this.getPage();
    await page.fill(selector, value, options);
  }

  /**
   * 获取元素文本
   */
  async getText(selector: string): Promise<string | null> {
    const page = this.getPage();
    return await page.textContent(selector);
  }

  /**
   * 评估 JavaScript
   */
  async evaluate<T>(pageFunction: () => T): Promise<T> {
    const page = this.getPage();
    return await page.evaluate(pageFunction);
  }

  /**
   * 获取当前 URL
   */
  getCurrentUrl(): string {
    const page = this.getPage();
    return page.url();
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.page = null;
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null && this.page !== null;
  }
}
