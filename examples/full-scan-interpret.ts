import {
  PlaywrightManager,
  StorageManager,
  LLMProviderManager,
  ConfigLoader,
} from '../src/index';
import { ScanAgent } from '../src/phases/phase-a-scan/ScanAgent';
import { InterpretAgent } from '../src/phases/phase-b-interpret/InterpretAgent';

/**
 * 完整的两阶段演示: 扫描 + 解读
 * 演示 Phase A (扫描) 和 Phase B (解读) 的协同工作
 */
async function main() {
  console.log('=== E2E Agents - 阶段 A+B 完整演示 ===\n');

  // 1. 加载配置
  console.log('1. 加载配置...');
  const config = ConfigLoader.loadFromEnv();
  console.log(`   LLM 提供商: ${config.llm.provider}`);
  console.log(`   模型: ${config.llm.model}`);
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
  console.log('   ✓ Playwright 已初始化');

  const llmManager = new LLMProviderManager(
    config.llm.provider,
    {
      qwen: {
        apiKey: config.llm.apiKey,
        model: config.llm.model,
        baseUrl: config.llm.baseUrl,
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: 'claude-sonnet-4-5-20250929',
      },
    },
    ['openai', 'claude']
  );
  console.log('   ✓ LLM 提供商管理器已初始化\n');

  // 3. 创建代理
  console.log('3. 创建代理...');
  const scanAgent = new ScanAgent(playwright, storage);
  const interpretAgent = new InterpretAgent(llmManager, storage);
  console.log('   ✓ ScanAgent 已创建');
  console.log('   ✓ InterpretAgent 已创建\n');

  // 4. 阶段 A: 扫描
  console.log('='.repeat(60));
  console.log('阶段 A: 扫描 (Scanning)');
  console.log('='.repeat(60));

  const testUrl = 'https://example.com';
  console.log(`\n目标 URL: ${testUrl}\n`);

  let scanResult;
  try {
    scanResult = await scanAgent.scanPage(testUrl);

    console.log('\n扫描结果摘要:');
    console.log(`  页面元素: ${scanResult.elements.length}`);
    console.log(`  网络请求: ${scanResult.networkRequests.length}`);
    console.log(`  控制台消息: ${scanResult.console.length}`);
    console.log(`  置信度: ${(scanResult.critique.confidence.overall * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('\n阶段 A 失败:', (error as Error).message);
    await playwright.cleanup();
    return;
  }

  // 5. 阶段 B: 解读
  console.log('\n' + '='.repeat(60));
  console.log('阶段 B: 解读 (Interpretation)');
  console.log('='.repeat(60) + '\n');

  try {
    const metadata = await interpretAgent.interpret(scanResult);

    console.log('\n解读结果摘要:');
    console.log(`  页面标题: ${metadata.pageTitle}`);
    console.log(`  页面类型: ${metadata.pageType}`);
    console.log(`  主要目的: ${metadata.primaryPurpose}`);
    console.log(`\n业务功能 (${metadata.businessFunctions.length}):`);
    metadata.businessFunctions.forEach((func, i) => {
      console.log(`  ${i + 1}. ${func}`);
    });

    if (metadata.businessFlows.length > 0) {
      console.log(`\n业务流程 (${metadata.businessFlows.length}):`);
      metadata.businessFlows.forEach((flow, i) => {
        console.log(`  ${i + 1}. ${flow.name}`);
        console.log(`     ${flow.description}`);
        console.log(`     步骤数: ${flow.steps.length}`);
      });
    }

    if (metadata.dataDependencies.length > 0) {
      console.log(`\n数据依赖 (${metadata.dataDependencies.length}):`);
      metadata.dataDependencies.slice(0, 5).forEach((dep, i) => {
        console.log(`  ${i + 1}. ${dep.fieldName} (${dep.dataType})`);
        if (dep.dependsOn.length > 0) {
          console.log(`     依赖: ${dep.dependsOn.join(', ')}`);
        }
      });
    }

    if (metadata.relatedPages.length > 0) {
      console.log(`\n相关页面 (${metadata.relatedPages.length}):`);
      metadata.relatedPages.forEach((page, i) => {
        console.log(`  ${i + 1}. [${page.relationship}] ${page.url}`);
      });
    }

    console.log(`\n置信度评分:`);
    console.log(`  总体: ${(metadata.critique.confidence.overall * 100).toFixed(1)}%`);
    console.log(`  完整性: ${(metadata.critique.confidence.dimensions.completeness * 100).toFixed(1)}%`);
    console.log(`  准确性: ${(metadata.critique.confidence.dimensions.accuracy * 100).toFixed(1)}%`);

    if (metadata.critique.issues.length > 0) {
      console.log(`\n发现问题: ${metadata.critique.issues.length}`);
      metadata.critique.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity}] ${issue.description}`);
      });
    }

    console.log(`\n是否需要人工审核: ${metadata.critique.confidence.humanReviewRequired ? '是' : '否'}`);

  } catch (error) {
    console.error('\n阶段 B 失败:', (error as Error).message);
    console.error((error as Error).stack);
  }

  // 6. 清理资源
  console.log('\n' + '='.repeat(60));
  console.log('清理资源');
  console.log('='.repeat(60) + '\n');

  await playwright.cleanup();
  console.log('✓ 浏览器已关闭\n');

  console.log('=== 演示完成 ===');
  console.log('\n数据已保存到:');
  console.log(`  扫描结果: ${config.storage.dataDir}/scans/latest/`);
  console.log(`  解读结果: ${config.storage.dataDir}/metadata/latest/`);
  console.log('\n下一步: 实现阶段 C (流程编排)');
}

// 运行示例
main().catch(console.error);
