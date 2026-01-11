import { Page } from "playwright";

/**
 * 路由发现器
 * 发现和探索网站的所有路由
 */
export class RouteDiscovery {
  private visitedUrls: Set<string> = new Set();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = this.normalizeUrl(baseUrl);
  }

  /**
   * 发现页面中的所有内部链接
   */
  async discoverRoutes(page: Page, maxDepth: number = 2): Promise<string[]> {
    const routes: string[] = [];
    const toVisit: Array<{ url: string; depth: number }> = [
      { url: this.baseUrl, depth: 0 },
    ];

    while (toVisit.length > 0) {
      const current = toVisit.shift();
      if (!current || current.depth > maxDepth) continue;

      // 跳过已访问的 URL
      if (this.visitedUrls.has(current.url)) continue;

      try {
        await page.goto(current.url, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        this.visitedUrls.add(current.url);
        routes.push(current.url);

        // 发现新链接
        const links = await this.extractInternalLinks(page);

        for (const link of links) {
          if (!this.visitedUrls.has(link) && current.depth < maxDepth) {
            toVisit.push({ url: link, depth: current.depth + 1 });
          }
        }

        // 添加延迟，避免过快请求
        await this.delay(500);
      } catch (error) {
        console.warn(
          `Failed to visit ${current.url}:`,
          (error as Error).message,
        );
      }
    }

    return routes;
  }

  /**
   * 提取页面中的所有内部链接
   */
  private async extractInternalLinks(page: Page): Promise<string[]> {
    const baseUrl = this.baseUrl;
    const links = await page.evaluate((base) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => {
          try {
            const url = new URL(href);
            const baseUrl = new URL(base);
            // 只保留同域名的链接
            return url.hostname === baseUrl.hostname;
          } catch {
            return false;
          }
        });
    }, baseUrl);

    return links.map((link) => this.normalizeUrl(link));
  }

  /**
   * 从 sitemap.xml 发现路由
   */
  async discoverFromSitemap(page: Page): Promise<string[]> {
    const sitemapUrl = new URL("/sitemap.xml", this.baseUrl).href;
    const routes: string[] = [];

    try {
      await page.goto(sitemapUrl, { timeout: 10000 });

      const urls = await page.evaluate(() => {
        const locs = Array.from(document.querySelectorAll("loc"));
        return locs.map((loc) => (loc as HTMLElement).textContent || "");
      });

      routes.push(...urls.filter((url) => url.startsWith(this.baseUrl)));
    } catch (error) {
      console.warn("Sitemap not found or not accessible");
    }

    return routes;
  }

  /**
   * 从 robots.txt 发现路由
   */
  async discoverFromRobots(page: Page): Promise<string[]> {
    const robotsUrl = new URL("/robots.txt", this.baseUrl).href;
    const routes: string[] = [];

    try {
      await page.goto(robotsUrl, { timeout: 10000 });

      const content = await page.evaluate(
        () => document.body.textContent || "",
      );

      // 提取 Sitemap 和 Allow 的路径
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("Sitemap:")) {
          const sitemapUrl = line.substring(8).trim();
          routes.push(sitemapUrl);
        } else if (line.startsWith("Allow:")) {
          const path = line.substring(6).trim();
          if (path && path !== "/") {
            routes.push(new URL(path, this.baseUrl).href);
          }
        }
      }
    } catch (error) {
      console.warn("robots.txt not found or not accessible");
    }

    return routes;
  }

  /**
   * 标准化 URL（移除查询参数和锚点）
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 移除查询参数和锚点
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取已访问的 URL 列表
   */
  getVisitedUrls(): string[] {
    return Array.from(this.visitedUrls);
  }

  /**
   * 重置访问记录
   */
  reset(): void {
    this.visitedUrls.clear();
  }
}
