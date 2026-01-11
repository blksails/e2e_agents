import {
  PlaywrightManager,
  StorageManager,
  ConfigLoader
} from '../src/index';
import { ScanAgent } from '../src/phases/phase-a-scan/ScanAgent';

/**
 * 阶段 A: 扫描代理演示
 * 演示如何使用 ScanAgent 扫描网站
 */
async function main() {
  console.log('=== E2E Agents - 阶段 A: 扫描代理演示 ===\n');

  // 1. 加载配置
  console.log('1. 加载配置...');
  const config = ConfigLoader.loadFromEnv();
  console.log(`   数据目录: ${config.storage.dataDir}\n`);

  // 2. 初始化组件
  console.log('2. 初始化组件...');
  const storage = new StorageManager(config.storage.dataDir);
  await storage.initialize();
  console.log('   ✓ 存储管理器已初始化');

  const playwright = new PlaywrightManager({
    headless: config.playwright.headless,
    slowMo: config.playwright.slowMo,
    timeout: config.playwright.timeout,
  });

  await playwright.initialize();
  console.log('   ✓ Playwright 已初始化\n');

  // 3. 创建扫描代理
  console.log('3. 创建扫描代理...');
  const scanAgent = new ScanAgent(playwright, storage);
  console.log('   ✓ ScanAgent 已创建\n');

  // 4. 扫描示例页面
  console.log('4. 开始扫描...\n');

  const testUrl = 'https://example.com';
  console.log(`   目标 URL: ${testUrl}\n`);

  try {
    const result = await scanAgent.scanPage(testUrl);

    console.log('\n=== 扫描结果 ===');
    console.log(`ID: ${result.id}`);
    console.log(`URL: ${result.url}`);
    console.log(`路由: ${result.route}`);
    console.log(`时间戳: ${result.timestamp}`);
    console.log(`\n元素统计:`);
    console.log(`  总计: ${result.elements.length}`);
    console.log(`  按钮: ${result.elements.filter(e => e.elementType === 'button').length}`);
    console.log(`  链接: ${result.elements.filter(e => e.elementType === 'link').length}`);
    console.log(`  输入框: ${result.elements.filter(e => e.elementType === 'input').length}`);

    console.log(`\n网络活动:`);
    console.log(`  请求总数: ${result.networkRequests.length}`);
    console.log(`  成功响应: ${result.networkRequests.filter(r => r.status && r.status < 400).length}`);

    console.log(`\n控制台消息: ${result.console.length}`);
    if (result.console.length > 0) {
      console.log(`  错误: ${result.console.filter(c => c.type === 'error').length}`);
      console.log(`  警告: ${result.console.filter(c => c.type === 'warn').length}`);
    }

    console.log(`\n置信度评分:`);
    console.log(`  总体: ${(result.critique.confidence.overall * 100).toFixed(1)}%`);
    console.log(`  完整性: ${(result.critique.confidence.dimensions.completeness * 100).toFixed(1)}%`);
    console.log(`  准确性: ${(result.critique.confidence.dimensions.accuracy * 100).toFixed(1)}%`);
    console.log(`  可行性: ${(result.critique.confidence.dimensions.feasibility * 100).toFixed(1)}%`);
    console.log(`  覆盖率: ${(result.critique.confidence.dimensions.coverage * 100).toFixed(1)}%`);

    if (result.critique.issues.length > 0) {
      console.log(`\n发现问题: ${result.critique.issues.length}`);
      result.critique.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity}] ${issue.description}`);
        if (issue.suggestion) {
          console.log(`     建议: ${issue.suggestion}`);
        }
      });
    }

    console.log(`\n文件保存:`);
    console.log(`  截图: ${result.screenshot}`);
    console.log(`  HTML: ${result.htmlSnapshot}`);

    // 显示一些元素示例
    if (result.elements.length > 0) {
      console.log(`\n元素示例 (前 5 个):`);
      result.elements.slice(0, 5).forEach((el, i) => {
        console.log(`  ${i + 1}. [${el.elementType}] ${el.tagName}`);
        console.log(`     选择器: ${el.selector}`);
        if (el.text) {
          console.log(`     文本: ${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}`);
        }
        console.log(`     位置: (${el.boundingBox?.x}, ${el.boundingBox?.y})`);
      });
    }

  } catch (error) {
    console.error('\n扫描失败:', (error as Error).message);
    console.error((error as Error).stack);
  }

  // 5. 清理资源
  console.log('\n5. 清理资源...');
  await playwright.cleanup();
  console.log('   ✓ 浏览器已关闭\n');

  console.log('=== 演示完成 ===');
  console.log('\n查看数据目录以查看保存的扫描结果:');
  console.log(`  cd ${config.storage.dataDir}/scans/latest`);
}

// 运行示例
main().catch(console.error);
