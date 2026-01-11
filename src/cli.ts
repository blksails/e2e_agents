#!/usr/bin/env node

import { Command } from "commander";
import * as dotenv from "dotenv";
import * as path from "path";
import { AgentOrchestrator } from "./core/orchestration/AgentOrchestrator";
import { StorageManager } from "./core/storage/StorageManager";
import { LLMProviderManager } from "./core/llm/LLMProviderManager";
import { PlaywrightManager } from "./core/playwright/PlaywrightManager";
import type { CognitiveQuadrant } from "./types/schemas";

// 加载环境变量
dotenv.config();

const program = new Command();

/**
 * CLI 主程序
 */
program
  .name("e2e-agents")
  .description("智能浏览器自动化测试代理系统")
  .version("1.0.0");

/**
 * run 命令 - 运行完整的 5 阶段工作流
 */
program
  .command("run")
  .description("运行完整的 5 阶段工作流 (扫描→解读→编排→执行→派生)")
  .requiredOption("-u, --url <url>", "起始 URL 地址")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option(
    "-p, --provider <provider>",
    "LLM 提供商 (qwen/openai/claude)",
    process.env.LLM_PROVIDER || "qwen",
  )
  .option("-m, --model <model>", "LLM 模型名称")
  .option("--api-key <key>", "LLM API 密钥")
  .option("--max-pages <number>", "最大扫描页面数", "10")
  .option("--max-depth <number>", "最大扫描深度", "3")
  .option("--headless", "无头模式运行浏览器", false)
  .option(
    "--browser <browser>",
    "浏览器类型 (chromium/firefox/webkit)",
    "chromium",
  )
  .option(
    "--cognitive-mode <mode>",
    "认知象限模式 (autonomous/supervised/collaborative/manual)",
    "supervised",
  )
  .option("--auto-approve-threshold <number>", "自动批准阈值 (0-1)", "0.8")
  .option("--require-review-threshold <number>", "需要审核阈值 (0-1)", "0.6")
  .option("--derive-level1 <number>", "派生测试 Level 1 数量", "10")
  .option("--derive-level2 <number>", "派生测试 Level 2 数量", "5")
  .option("--derive-level3 <number>", "派生测试 Level 3 数量", "3")
  .action(async (options) => {
    try {
      console.log("🚀 E2E Agents - 启动完整工作流\n");

      // 初始化存储管理器
      const storage = new StorageManager(path.resolve(options.dataDir));
      console.log(`📁 数据目录: ${options.dataDir}`);

      // 初始化 LLM 提供商
      const provider = options.provider as "qwen" | "openai" | "claude";
      const llmConfigs = {
        qwen: {
          apiKey: options.apiKey || process.env.QWEN_API_KEY || "",
          model: options.model || process.env.QWEN_MODEL || "qwen-turbo",
        },
        openai: {
          apiKey: options.apiKey || process.env.OPENAI_API_KEY || "",
          model: options.model || process.env.OPENAI_MODEL || "gpt-4o",
        },
        claude: {
          apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY || "",
          model:
            options.model ||
            process.env.ANTHROPIC_MODEL ||
            "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager(provider, llmConfigs);
      console.log(`🤖 LLM 提供商: ${provider} (${llmConfigs[provider].model})`);

      // 初始化 Playwright
      const playwright = new PlaywrightManager({
        headless: options.headless,
      });
      console.log(
        `🌐 浏览器: chromium ${options.headless ? "(headless)" : "(headed)"}`,
      );

      // 初始化认知象限管理器 (用于配置显示)
      const cognitiveConfig: CognitiveQuadrant = {
        mode: options.cognitiveMode as
          | "autonomous"
          | "supervised"
          | "collaborative"
          | "manual",
        thresholds: {
          autoApprove: parseFloat(options.autoApproveThreshold),
          requireReview: parseFloat(options.requireReviewThreshold),
          autoCorrect: 0.7,
        },
        humanInterventionPoints: ["before_phase", "after_phase"],
      };
      console.log(`🧠 认知模式: ${cognitiveConfig.mode}`);
      console.log(
        `📊 阈值: 自动批准=${cognitiveConfig.thresholds.autoApprove}, 需要审核=${cognitiveConfig.thresholds.requireReview}\n`,
      );

      // 创建总协调器
      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      // 运行完整工作流
      const session = await orchestrator.run({
        startUrl: options.url,
        maxPages: parseInt(options.maxPages),
        phaseOptions: {
          scan: {
            maxDepth: parseInt(options.maxDepth),
            timeout: 30000,
          },
          derive: {
            level1Count: parseInt(options.deriveLevel1),
            level2Count: parseInt(options.deriveLevel2),
            level3Count: parseInt(options.deriveLevel3),
          },
        },
      });

      // 生成并显示报告
      console.log("\n" + "=".repeat(60));
      const report = await orchestrator.generateReport();
      console.log(report);
      console.log("=".repeat(60));

      // 保存报告到文件
      const reportPath = path.join(
        options.dataDir,
        "state",
        `report_${session.id}.md`,
      );
      await storage.saveGlobalState(`report_${session.id}`, report);
      console.log(`\n📄 报告已保存: ${reportPath}`);

      // 清理资源
      await orchestrator.cleanup();

      console.log("\n✅ 工作流执行完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      console.error((error as Error).stack);
      process.exit(1);
    }
  });

/**
 * scan 命令 - 仅运行扫描阶段
 */
program
  .command("scan")
  .description("仅运行阶段 A: 扫描")
  .requiredOption("-u, --url <url>", "起始 URL 地址")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option("--max-pages <number>", "最大扫描页面数", "10")
  .option("--max-depth <number>", "最大扫描深度", "3")
  .option("--headless", "无头模式运行浏览器", false)
  .option(
    "--browser <browser>",
    "浏览器类型 (chromium/firefox/webkit)",
    "chromium",
  )
  .action(async (options) => {
    try {
      console.log("🔍 E2E Agents - 扫描阶段\n");

      const storage = new StorageManager(path.resolve(options.dataDir));
      const playwright = new PlaywrightManager({
        headless: options.headless,
      });

      const llmConfigs = {
        qwen: { apiKey: process.env.QWEN_API_KEY || "", model: "qwen-turbo" },
        openai: { apiKey: process.env.OPENAI_API_KEY || "", model: "gpt-4o" },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || "",
          model: "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager("qwen", llmConfigs);

      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      await orchestrator.runPhase("scan", {
        startUrl: options.url,
        maxPages: parseInt(options.maxPages),
        phaseOptions: {
          scan: {
            maxDepth: parseInt(options.maxDepth),
          },
        },
      });

      await orchestrator.cleanup();
      console.log("\n✅ 扫描完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      process.exit(1);
    }
  });

/**
 * interpret 命令 - 仅运行解读阶段
 */
program
  .command("interpret")
  .description("仅运行阶段 B: 解读")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option("-p, --provider <provider>", "LLM 提供商", "qwen")
  .option("-m, --model <model>", "LLM 模型名称")
  .action(async (options) => {
    try {
      console.log("🔮 E2E Agents - 解读阶段\n");

      const storage = new StorageManager(path.resolve(options.dataDir));

      const provider = (options.provider || "qwen") as
        | "qwen"
        | "openai"
        | "claude";
      const llmConfigs = {
        qwen: {
          apiKey: process.env.QWEN_API_KEY || "",
          model: options.model || "qwen-turbo",
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY || "",
          model: options.model || "gpt-4o",
        },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || "",
          model: options.model || "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager(provider, llmConfigs);

      const playwright = new PlaywrightManager();

      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      await orchestrator.runPhase("interpret", { startUrl: "" });

      console.log("\n✅ 解读完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      process.exit(1);
    }
  });

/**
 * orchestrate 命令 - 仅运行编排阶段
 */
program
  .command("orchestrate")
  .description("仅运行阶段 C: 编排")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option("-p, --provider <provider>", "LLM 提供商", "qwen")
  .option("-m, --model <model>", "LLM 模型名称")
  .action(async (options) => {
    try {
      console.log("📝 E2E Agents - 编排阶段\n");

      const storage = new StorageManager(path.resolve(options.dataDir));

      const provider = (options.provider || "qwen") as
        | "qwen"
        | "openai"
        | "claude";
      const llmConfigs = {
        qwen: {
          apiKey: process.env.QWEN_API_KEY || "",
          model: options.model || "qwen-turbo",
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY || "",
          model: options.model || "gpt-4o",
        },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || "",
          model: options.model || "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager(provider, llmConfigs);

      const playwright = new PlaywrightManager();

      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      await orchestrator.runPhase("orchestrate", { startUrl: "" });

      console.log("\n✅ 编排完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      process.exit(1);
    }
  });

/**
 * execute 命令 - 仅运行执行阶段
 */
program
  .command("execute")
  .description("仅运行阶段 D: 执行")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option("--headless", "无头模式运行浏览器", false)
  .option("--browser <browser>", "浏览器类型", "chromium")
  .action(async (options) => {
    try {
      console.log("▶️ E2E Agents - 执行阶段\n");

      const storage = new StorageManager(path.resolve(options.dataDir));
      const playwright = new PlaywrightManager({
        headless: options.headless,
      });

      const llmConfigs = {
        qwen: { apiKey: process.env.QWEN_API_KEY || "", model: "qwen-turbo" },
        openai: { apiKey: process.env.OPENAI_API_KEY || "", model: "gpt-4o" },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || "",
          model: "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager("qwen", llmConfigs);

      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      await orchestrator.runPhase("execute", { startUrl: "" });

      await orchestrator.cleanup();
      console.log("\n✅ 执行完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      process.exit(1);
    }
  });

/**
 * derive 命令 - 仅运行派生阶段
 */
program
  .command("derive")
  .description("仅运行阶段 E: 派生")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option("-p, --provider <provider>", "LLM 提供商", "qwen")
  .option("-m, --model <model>", "LLM 模型名称")
  .option("--level1 <number>", "Level 1 测试数量", "10")
  .option("--level2 <number>", "Level 2 测试数量", "5")
  .option("--level3 <number>", "Level 3 测试数量", "3")
  .action(async (options) => {
    try {
      console.log("🧬 E2E Agents - 派生阶段\n");

      const storage = new StorageManager(path.resolve(options.dataDir));

      const provider = (options.provider || "qwen") as
        | "qwen"
        | "openai"
        | "claude";
      const llmConfigs = {
        qwen: {
          apiKey: process.env.QWEN_API_KEY || "",
          model: options.model || "qwen-turbo",
        },
        openai: {
          apiKey: process.env.OPENAI_API_KEY || "",
          model: options.model || "gpt-4o",
        },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || "",
          model: options.model || "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager(provider, llmConfigs);

      const playwright = new PlaywrightManager();

      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      await orchestrator.runPhase("derive", {
        startUrl: "",
        phaseOptions: {
          derive: {
            level1Count: parseInt(options.level1),
            level2Count: parseInt(options.level2),
            level3Count: parseInt(options.level3),
          },
        },
      });

      console.log("\n✅ 派生完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      process.exit(1);
    }
  });

/**
 * report 命令 - 生成报告
 */
program
  .command("report")
  .description("为指定会话生成报告")
  .option("-d, --data-dir <dir>", "数据存储目录", "./data")
  .option("-s, --session-id <id>", "会话 ID (可选)")
  .action(async (options) => {
    try {
      console.log("📊 E2E Agents - 生成报告\n");

      const storage = new StorageManager(path.resolve(options.dataDir));

      const llmConfigs = {
        qwen: { apiKey: process.env.QWEN_API_KEY || "", model: "qwen-turbo" },
        openai: { apiKey: process.env.OPENAI_API_KEY || "", model: "gpt-4o" },
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || "",
          model: "claude-sonnet-4-5-20241022",
        },
      };
      const llm = new LLMProviderManager("qwen", llmConfigs);

      const playwright = new PlaywrightManager();

      const orchestrator = new AgentOrchestrator(storage, llm, playwright);

      // Note: resume functionality not yet implemented in AgentOrchestrator
      // if (options.sessionId) {
      //   await orchestrator.resume(options.sessionId);
      // }

      const report = await orchestrator.generateReport();
      console.log(report);

      console.log("\n✅ 报告生成完成!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ 错误:", (error as Error).message);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供任何命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
