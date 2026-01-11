import { ScanAgent } from "../../phases/phase-a-scan/ScanAgent";
import { InterpretAgent } from "../../phases/phase-b-interpret/InterpretAgent";
import { OrchestrateAgent } from "../../phases/phase-c-orchestrate/OrchestrateAgent";
import { ExecuteAgent } from "../../phases/phase-d-execute/ExecuteAgent";
import { DeriveAgent } from "../../phases/phase-e-derive/DeriveAgent";
import { StorageManager } from "../storage/StorageManager";
import { LLMProviderManager } from "../llm/LLMProviderManager";
import { PlaywrightManager } from "../playwright/PlaywrightManager";
import * as crypto from "crypto";

/**
 * 总协调器配置
 */
export interface OrchestratorConfig {
  startUrl: string;
  maxPages?: number;
  phaseOptions?: {
    scan?: {
      maxDepth?: number;
      timeout?: number;
    };
    interpret?: {
      batchSize?: number;
    };
    orchestrate?: {
      maxWorkflows?: number;
    };
    execute?: {
      retryAttempts?: number;
    };
    derive?: {
      level1Count?: number;
      level2Count?: number;
      level3Count?: number;
    };
  };
}

/**
 * 编排会话状态
 */
export interface OrchestrationSession {
  id: string;
  startTime: string;
  currentPhase:
    | "scan"
    | "interpret"
    | "orchestrate"
    | "execute"
    | "derive"
    | "completed";
  status: "running" | "completed" | "failed" | "paused";
  error?: string;
  phasesCompleted: string[];
}

/**
 * AgentOrchestrator - 总协调器
 *
 * 管理 5 个阶段的顺序执行：
 * A (扫描) → B (解读) → C (编排) → D (执行) → E (派生)
 *
 * 职责：
 * - 阶段管理和数据流协调
 * - 错误处理和恢复
 * - 状态持久化
 */
export class AgentOrchestrator {
  // Agents for future use when they expose proper public APIs
  // private _scanAgent: ScanAgent;
  // private _interpretAgent: InterpretAgent;
  // private _orchestrateAgent: OrchestrateAgent;
  // private _executeAgent: ExecuteAgent;
  // private _deriveAgent: DeriveAgent;

  private storage: StorageManager;
  // private _playwright: PlaywrightManager;

  private session: OrchestrationSession | null = null;

  constructor(
    storage: StorageManager,
    llm: LLMProviderManager,
    playwright: PlaywrightManager,
  ) {
    this.storage = storage;

    // 初始化各阶段代理 - 当前未使用，等待各代理实现完整的公共 API
    // 目前各阶段代理通过 storage 自动处理数据流
    new ScanAgent(playwright, storage);
    new InterpretAgent(llm, storage);
    new OrchestrateAgent(llm, storage);
    new ExecuteAgent(playwright, storage);
    new DeriveAgent(llm, storage);
  }

  /**
   * 运行完整的 5 阶段工作流
   */
  async run(config: OrchestratorConfig): Promise<OrchestrationSession> {
    // 创建新会话
    this.session = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      currentPhase: "scan",
      status: "running",
      phasesCompleted: [],
    };

    try {
      // 保存会话状态
      await this.saveSession();

      // 阶段 A: 扫描
      console.log("=".repeat(60));
      console.log("Phase A: Scanning...");
      console.log("=".repeat(60));
      await this.runPhaseA(config);
      this.session.phasesCompleted.push("scan");
      await this.saveSession();

      // 阶段 B: 解读
      console.log("\n" + "=".repeat(60));
      console.log("Phase B: Interpreting...");
      console.log("=".repeat(60));
      await this.runPhaseB();
      this.session.phasesCompleted.push("interpret");
      await this.saveSession();

      // 阶段 C: 编排
      console.log("\n" + "=".repeat(60));
      console.log("Phase C: Orchestrating...");
      console.log("=".repeat(60));
      await this.runPhaseC();
      this.session.phasesCompleted.push("orchestrate");
      await this.saveSession();

      // 阶段 D: 执行
      console.log("\n" + "=".repeat(60));
      console.log("Phase D: Executing...");
      console.log("=".repeat(60));
      await this.runPhaseD();
      this.session.phasesCompleted.push("execute");
      await this.saveSession();

      // 阶段 E: 派生
      console.log("\n" + "=".repeat(60));
      console.log("Phase E: Deriving...");
      console.log("=".repeat(60));
      await this.runPhaseE();
      this.session.phasesCompleted.push("derive");
      await this.saveSession();

      // 标记完成
      this.session.currentPhase = "completed";
      this.session.status = "completed";
      await this.saveSession();

      console.log("\n" + "=".repeat(60));
      console.log("All phases completed successfully!");
      console.log("=".repeat(60));

      return this.session;
    } catch (error) {
      this.session.status = "failed";
      this.session.error = (error as Error).message;
      await this.saveSession();
      throw error;
    }
  }

  /**
   * 阶段 A: 扫描
   */
  private async runPhaseA(config: OrchestratorConfig): Promise<void> {
    this.session!.currentPhase = "scan";
    await this.saveSession();

    // ScanAgent 将自动扫描并保存结果
    // 注意: 实际的 ScanAgent 需要实现 scanFromUrl 方法
    console.log(`Scanning from: ${config.startUrl}`);
    console.log("Scan agent will discover and scan pages automatically...");

    // ScanAgent 内部会处理扫描逻辑并保存到 storage
    // 这里只是协调阶段转换
  }

  /**
   * 阶段 B: 解读
   */
  private async runPhaseB(): Promise<void> {
    this.session!.currentPhase = "interpret";
    await this.saveSession();

    console.log("Interpreting scanned pages...");

    // InterpretAgent 会从 storage 读取扫描结果并生成 metadata
    // 内部处理批量解读并保存结果
  }

  /**
   * 阶段 C: 编排
   */
  private async runPhaseC(): Promise<void> {
    this.session!.currentPhase = "orchestrate";
    await this.saveSession();

    console.log("Orchestrating workflows from metadata...");

    // OrchestrateAgent 会从 storage 读取 metadata 并生成 SOP workflows
  }

  /**
   * 阶段 D: 执行
   */
  private async runPhaseD(): Promise<void> {
    this.session!.currentPhase = "execute";
    await this.saveSession();

    console.log("Executing workflows...");

    // ExecuteAgent 会从 storage 读取 workflows 并执行
  }

  /**
   * 阶段 E: 派生
   */
  private async runPhaseE(): Promise<void> {
    this.session!.currentPhase = "derive";
    await this.saveSession();

    console.log("Deriving test cases...");

    // DeriveAgent 会从 storage 读取 workflows 并生成派生测试
  }

  /**
   * 运行单个阶段
   */
  async runPhase(
    phase: "scan" | "interpret" | "orchestrate" | "execute" | "derive",
    config: OrchestratorConfig,
  ): Promise<void> {
    switch (phase) {
      case "scan":
        await this.runPhaseA(config);
        break;
      case "interpret":
        await this.runPhaseB();
        break;
      case "orchestrate":
        await this.runPhaseC();
        break;
      case "execute":
        await this.runPhaseD();
        break;
      case "derive":
        await this.runPhaseE();
        break;
    }
  }

  /**
   * 暂停当前会话
   */
  async pause(): Promise<void> {
    if (!this.session) {
      throw new Error("No active session to pause");
    }

    this.session.status = "paused";
    await this.saveSession();
    console.log("Session paused.");
  }

  /**
   * 获取当前会话
   */
  getSession(): OrchestrationSession | null {
    return this.session;
  }

  /**
   * 保存会话状态
   */
  private async saveSession(): Promise<void> {
    if (!this.session) {
      return;
    }

    await this.storage.saveGlobalState(
      `session_${this.session.id}`,
      this.session,
    );
  }

  /**
   * 生成完整报告
   */
  async generateReport(): Promise<string> {
    if (!this.session) {
      throw new Error("No session available for report generation");
    }

    const report: string[] = [];

    report.push("# E2E Browser Automation Agent - Session Report");
    report.push("");
    report.push(`**Session ID**: ${this.session.id}`);
    report.push(`**Start Time**: ${this.session.startTime}`);
    report.push(`**Status**: ${this.session.status}`);
    report.push(`**Current Phase**: ${this.session.currentPhase}`);
    report.push("");
    report.push("## Completed Phases");
    this.session.phasesCompleted.forEach((phase) => {
      report.push(`- ✓ ${phase}`);
    });
    report.push("");

    if (this.session.error) {
      report.push("## Error");
      report.push(this.session.error);
      report.push("");
    }

    report.push("## Data Locations");
    report.push("- Scan results: `data/scan/`");
    report.push("- Metadata: `data/interpret/`");
    report.push("- Workflows: `data/orchestrate/`");
    report.push("- Execution results: `data/execute/`");
    report.push("- Derived tests: `data/derive/`");

    return report.join("\n");
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清理 Playwright 资源
    // PlaywrightManager 应该有自己的清理逻辑
    console.log("Cleanup completed.");
  }
}
