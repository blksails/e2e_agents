import {
  SOPWorkflow,
  ExecutionResult,
  ExecutionState,
} from "../../types/schemas";
import { PlaywrightManager } from "../../core/playwright/PlaywrightManager";
import { StorageManager } from "../../core/storage/StorageManager";
import { WorkflowExecutor } from "./WorkflowExecutor";
import * as crypto from "crypto";

/**
 * 执行代理 (Phase D)
 * 负责执行 SOP 工作流
 */
export class ExecuteAgent {
  private playwright: PlaywrightManager;
  private storage: StorageManager;

  constructor(playwright: PlaywrightManager, storage: StorageManager) {
    this.playwright = playwright;
    this.storage = storage;
  }

  /**
   * 执行工作流
   */
  async execute(
    workflow: SOPWorkflow,
    userInputs?: Record<string, any>,
  ): Promise<ExecutionResult> {
    console.log(`开始执行工作流: ${workflow.name}`);

    // 创建执行器
    const executor = new WorkflowExecutor(this.playwright);

    // 执行工作流
    const result = await executor.executeWorkflow(workflow, userInputs);

    // 获取最终状态
    const finalState = executor.getExecutionState();

    // 保存执行结果和状态
    await this.saveExecutionResults(result, finalState);

    console.log(`✓ 工作流执行完成，状态: ${result.status}`);

    return result;
  }

  /**
   * 批量执行多个工作流
   */
  async executeBatch(
    workflows: SOPWorkflow[],
    userInputsMap?: Map<string, Record<string, any>>,
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const workflow of workflows) {
      try {
        const userInputs = userInputsMap?.get(workflow.id);
        const result = await this.execute(workflow, userInputs);
        results.push(result);
      } catch (error) {
        console.error(
          `执行工作流失败 ${workflow.name}:`,
          (error as Error).message,
        );

        // 创建失败结果
        results.push({
          id: crypto.randomUUID(),
          workflowId: workflow.id,
          executionStateId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          status: "failure",
          duration: 0,
          stepResults: [],
          screenshots: [],
          logs: [(error as Error).message],
          finalState: {
            id: crypto.randomUUID(),
            workflowId: workflow.id,
            timestamp: new Date().toISOString(),
            variables: {},
            currentStepNumber: 0,
            completedSteps: [],
            failedSteps: [],
          },
          critique: {
            phaseId: "execute",
            timestamp: new Date().toISOString(),
            confidence: {
              overall: 0,
              dimensions: {
                completeness: 0,
                accuracy: 0,
                feasibility: 0,
                coverage: 0,
              },
              reasoning: "Execution failed with exception",
              humanReviewRequired: true,
            },
            issues: [
              {
                severity: "critical",
                description: (error as Error).message,
              },
            ],
            autoCorrections: [],
          },
        });
      }
    }

    return results;
  }

  /**
   * 恢复执行（从某个步骤继续）
   */
  async resume(
    workflow: SOPWorkflow,
    executionState: ExecutionState,
    fromStep: number,
  ): Promise<ExecutionResult> {
    console.log(`恢复执行工作流 ${workflow.name} 从步骤 ${fromStep}`);

    // 创建执行器
    const executor = new WorkflowExecutor(this.playwright);

    // 过滤出需要执行的步骤
    const stepsToExecute = workflow.steps.filter(
      (step) => step.stepNumber >= fromStep,
    );

    const partialWorkflow: SOPWorkflow = {
      ...workflow,
      steps: stepsToExecute,
    };

    // 执行剩余步骤
    const result = await executor.executeWorkflow(
      partialWorkflow,
      executionState.variables,
    );

    // 保存结果
    await this.saveExecutionResults(result, executor.getExecutionState());

    return result;
  }

  /**
   * 保存执行结果和状态
   */
  private async saveExecutionResults(
    result: ExecutionResult,
    state: ExecutionState,
  ): Promise<void> {
    // 保存执行结果
    await this.storage.savePhaseData("execute", result);

    // 保存执行状态
    const stateFilename = `state_${state.id}.json`;
    const timestampDir = new Date().toISOString().replace(/:/g, "-");
    await this.storage.saveTextFile(
      "execute",
      timestampDir,
      stateFilename,
      JSON.stringify(state, null, 2),
    );

    // 保存截图（如果有）
    for (const stepResult of result.stepResults) {
      if (stepResult.screenshot) {
        const screenshotFilename = `step_${stepResult.stepNumber}_screenshot.png`;
        const base64Data = stepResult.screenshot.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");

        await this.storage.saveBinaryFile(
          "execute",
          timestampDir,
          screenshotFilename,
          buffer,
        );
      }
    }
  }

  /**
   * 生成执行报告
   */
  generateReport(result: ExecutionResult): string {
    const lines: string[] = [];

    lines.push(`# 执行报告`);
    lines.push("");
    lines.push(`**执行ID**: ${result.id}`);
    lines.push(`**工作流ID**: ${result.workflowId}`);
    lines.push(`**状态**: ${result.status}`);
    lines.push(`**执行时间**: ${result.timestamp}`);
    lines.push(`**持续时长**: ${result.duration}ms`);
    lines.push("");

    lines.push(`## 步骤结果`);
    lines.push("");
    lines.push(`| 步骤 | 状态 | 持续时长 | 错误 |`);
    lines.push(`|------|------|----------|------|`);

    result.stepResults.forEach((stepResult) => {
      const error = stepResult.error ?? "-";
      lines.push(
        `| ${stepResult.stepNumber} | ${stepResult.status} | ${stepResult.duration}ms | ${error} |`,
      );
    });

    lines.push("");

    if (result.logs.length > 0) {
      lines.push(`## 日志`);
      lines.push("");
      result.logs.forEach((log) => {
        lines.push(`- ${log}`);
      });
      lines.push("");
    }

    // 统计
    const totalSteps = result.stepResults.length;
    const successSteps = result.stepResults.filter(
      (r) => r.status === "success",
    ).length;
    const failedSteps = result.stepResults.filter(
      (r) => r.status === "failure",
    ).length;
    const skippedSteps = result.stepResults.filter(
      (r) => r.status === "skipped",
    ).length;

    lines.push(`## 统计`);
    lines.push("");
    lines.push(`- 总步骤数: ${totalSteps}`);
    lines.push(`- 成功: ${successSteps}`);
    lines.push(`- 失败: ${failedSteps}`);
    lines.push(`- 跳过: ${skippedSteps}`);
    lines.push(`- 成功率: ${((successSteps / totalSteps) * 100).toFixed(1)}%`);

    return lines.join("\n");
  }
}
