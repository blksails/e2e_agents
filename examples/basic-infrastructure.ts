import {
  StorageManager,
  LLMProviderManager,
  PlaywrightManager,
  ConfigLoader
} from '../src/index';

/**
 * 基础设施初始化示例
 * 演示如何初始化和使用核心组件
 */
async function main() {
  console.log('=== E2E Agents - 基础设施演示 ===\n');

  // 1. 加载配置
  console.log('1. 加载配置...');
  const config = ConfigLoader.loadFromEnv();
  console.log(`   LLM 提供商: ${config.llm.provider}`);
  console.log(`   模型: ${config.llm.model}`);
  console.log(`   数据目录: ${config.storage.dataDir}\n`);

  // 2. 初始化存储管理器
  console.log('2. 初始化存储管理器...');
  const storage = new StorageManager(config.storage.dataDir);
  await storage.initialize();
  console.log('   ✓ 存储目录结构已创建\n');

  // 3. 初始化 LLM 提供商管理器
  console.log('3. 初始化 LLM 提供商管理器...');
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
      // 可以添加其他提供商作为 fallback
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4o',
      },
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: 'claude-sonnet-4-5-20250929',
      },
    },
    ['openai', 'claude'] // fallback 提供商
  );

  const primaryProvider = llmManager.getPrimaryProvider();
  console.log(`   ✓ 主要提供商: ${primaryProvider.name} (${primaryProvider.model})`);
  console.log(`   可用提供商: ${llmManager.getAvailableProviders().join(', ')}\n`);

  // 4. 初始化 Playwright 管理器
  console.log('4. 初始化 Playwright 管理器...');
  const playwright = new PlaywrightManager({
    headless: config.playwright.headless,
    slowMo: config.playwright.slowMo,
    timeout: config.playwright.timeout,
  });

  await playwright.initialize();
  console.log('   ✓ 浏览器已启动\n');

  // 5. 测试基本功能
  console.log('5. 测试基本功能...');

  // 5.1 浏览器导航
  console.log('   5.1 导航到示例页面...');
  await playwright.goto('https://example.com');
  const url = playwright.getCurrentUrl();
  console.log(`       当前 URL: ${url}`);

  // 5.2 截图
  console.log('   5.2 捕获截图...');
  const screenshot = await playwright.screenshot();
  console.log(`       截图大小: ${screenshot.length} bytes`);

  // 5.3 保存到存储
  console.log('   5.3 保存截图到存储...');
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0] + 'Z';
  const screenshotPath = await storage.saveBinaryFile(
    'scan',
    timestamp,
    'example_screenshot.png',
    screenshot
  );
  console.log(`       已保存: ${screenshotPath}`);

  // 5.4 保存全局状态
  console.log('   5.4 保存会话状态...');
  await storage.saveGlobalState('session', {
    id: 'demo-session-001',
    startTime: new Date().toISOString(),
    provider: config.llm.provider,
  });
  console.log('       ✓ 会话状态已保存\n');

  // 6. 清理资源
  console.log('6. 清理资源...');
  await playwright.cleanup();
  console.log('   ✓ 浏览器已关闭\n');

  console.log('=== 演示完成 ===');
  console.log('\n下一步:');
  console.log('- 实现阶段 A: 扫描代理 (ScanAgent)');
  console.log('- 实现阶段 B: 解读代理 (InterpretAgent)');
  console.log('- 实现阶段 C: 编排代理 (OrchestrateAgent)');
  console.log('- 实现阶段 D: 执行代理 (ExecuteAgent)');
  console.log('- 实现阶段 E: 派生代理 (DeriveAgent)');
}

// 运行示例
main().catch(console.error);
