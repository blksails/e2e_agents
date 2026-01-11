import {
  SOPWorkflow,
  SOPStep,
  ExecutionState,
  ExecutionResult,
} from "../../types/schemas";
import { PlaywrightManager } from "../../core/playwright/PlaywrightManager";
import { Page } from "playwright";
import { faker } from "@faker-js/faker";
import * as crypto from "crypto";

/**
 * 工作流执行器
 * 负责执行 SOP 工作流中的每个步骤
 */
export class WorkflowExecutor {
  private playwright: PlaywrightManager;
  private executionState: ExecutionState;
  private currentPage: Page | null = null;

  constructor(playwright: PlaywrightManager) {
    this.playwright = playwright;
    this.executionState = this.createInitialState();
  }

  /**
   * 执行完整工作流
   */
  async executeWorkflow(
    workflow: SOPWorkflow,
    userInputs?: Record<string, any>,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: ExecutionResult["stepResults"] = [];

    console.log(`开始执行工作流: ${workflow.name}`);

    try {
      // 初始化浏览器
      await this.playwright.initialize();
      this.currentPage = await this.playwright.newPage();

      // 更新执行状态
      this.executionState = {
        ...this.executionState,
        workflowId: workflow.id,
        variables: {
          ...this.executionState.variables,
          ...userInputs,
        },
      };

      // 执行每个步骤
      for (const step of workflow.steps) {
        console.log(`  执行步骤 ${step.stepNumber}: ${step.description}`);

        const stepStartTime = Date.now();
        const stepResult = await this.executeStep(step);
        const stepDuration = Date.now() - stepStartTime;

        stepResults.push({
          stepNumber: step.stepNumber,
          status: stepResult.success ? "success" : "failure",
          duration: stepDuration,
          output: stepResult.output,
          error: stepResult.error,
          screenshot: stepResult.screenshot,
        });

        // 如果步骤失败，检查错误处理策略
        if (!stepResult.success) {
          const errorHandling = step.errorHandling;

          if (errorHandling?.strategy === "abort") {
            console.error(`  步骤 ${step.stepNumber} 失败，中止执行`);
            break;
          } else if (errorHandling?.strategy === "retry") {
            // 重试逻辑
            const maxRetries = errorHandling.maxRetries ?? 3;
            let retryCount = 0;
            let retrySuccess = false;

            while (retryCount < maxRetries && !retrySuccess) {
              retryCount++;
              console.log(
                `  重试步骤 ${step.stepNumber} (${retryCount}/${maxRetries})`,
              );
              const retryResult = await this.executeStep(step);
              retrySuccess = retryResult.success;

              if (retrySuccess) {
                const lastResult = stepResults[stepResults.length - 1];
                if (lastResult) {
                  lastResult.status = "success";
                  lastResult.output = retryResult.output;
                }
                break;
              }
            }

            if (!retrySuccess) {
              console.error(`  步骤 ${step.stepNumber} 重试失败`);
              break;
            }
          } else if (errorHandling?.strategy === "skip") {
            console.warn(`  步骤 ${step.stepNumber} 失败，跳过继续执行`);
            const lastResult = stepResults[stepResults.length - 1];
            if (lastResult) {
              lastResult.status = "skipped";
            }
            continue;
          }
        }

        // 更新当前步骤
        this.executionState.currentStepNumber = step.stepNumber;
      }

      const duration = Date.now() - startTime;
      const allSuccess = stepResults.every((r) => r.status === "success");
      const anyFailure = stepResults.some((r) => r.status === "failure");

      // 收集截图路径
      const screenshots = stepResults
        .filter((r) => r.screenshot)
        .map((r) => `step_${r.stepNumber}_screenshot.png`);

      const result: ExecutionResult = {
        id: crypto.randomUUID(),
        workflowId: workflow.id,
        executionStateId: this.executionState.id,
        timestamp: new Date().toISOString(),
        status: allSuccess ? "success" : anyFailure ? "failure" : "partial",
        duration,
        stepResults,
        screenshots,
        logs: [],
        finalState: this.executionState,
        critique: {
          phaseId: "execute",
          timestamp: new Date().toISOString(),
          confidence: {
            overall: allSuccess ? 0.9 : anyFailure ? 0.3 : 0.6,
            dimensions: {
              completeness:
                stepResults.length === workflow.steps.length ? 1 : 0.5,
              accuracy: allSuccess ? 1 : 0.5,
              feasibility: 1,
              coverage: stepResults.length / workflow.steps.length,
            },
            reasoning: allSuccess
              ? "All steps completed successfully"
              : anyFailure
                ? "Some steps failed"
                : "Partial completion",
            humanReviewRequired: anyFailure,
          },
          issues: stepResults
            .filter((r) => r.error)
            .map((r) => ({
              severity: "high" as const,
              description: `Step ${r.stepNumber} failed: ${r.error}`,
            })),
          autoCorrections: [],
        },
      };

      console.log(`✓ 工作流执行完成: ${result.status}`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("工作流执行失败:", (error as Error).message);

      return {
        id: crypto.randomUUID(),
        workflowId: workflow.id,
        executionStateId: this.executionState.id,
        timestamp: new Date().toISOString(),
        status: "failure",
        duration,
        stepResults,
        screenshots: [],
        logs: [(error as Error).message],
        finalState: this.executionState,
        critique: {
          phaseId: "execute",
          timestamp: new Date().toISOString(),
          confidence: {
            overall: 0.1,
            dimensions: {
              completeness: 0,
              accuracy: 0,
              feasibility: 0.5,
              coverage: 0,
            },
            reasoning: "Workflow execution failed with exception",
            humanReviewRequired: true,
          },
          issues: [
            {
              severity: "critical",
              description: `Workflow failed: ${(error as Error).message}`,
            },
          ],
          autoCorrections: [],
        },
      };
    } finally {
      // 清理
      await this.cleanup();
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
    screenshot?: string;
  }> {
    if (!this.currentPage) {
      return {
        success: false,
        error: "No active page",
      };
    }

    try {
      switch (step.action) {
        case "navigate":
          return await this.executeNavigate(step);
        case "click":
          return await this.executeClick(step);
        case "input":
          return await this.executeInput(step);
        case "select":
          return await this.executeSelect(step);
        case "wait":
          return await this.executeWait(step);
        case "verify":
          return await this.executeVerify(step);
        case "screenshot":
          return await this.executeScreenshot(step);
        case "extract":
          return await this.executeExtract(step);
        default:
          return {
            success: false,
            error: `Unknown action: ${step.action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 执行导航
   */
  private async executeNavigate(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    if (!step.target?.url) {
      return { success: false, error: "No URL specified" };
    }

    await this.playwright.goto(step.target.url);

    // 验证
    if (step.validation) {
      const validationResult = await this.validateStep(step);
      if (!validationResult.success) {
        return validationResult;
      }
    }

    return { success: true, output: { url: step.target.url } };
  }

  /**
   * 执行点击
   */
  private async executeClick(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    if (!step.target?.selector) {
      return { success: false, error: "No selector specified" };
    }

    await this.playwright.click(step.target.selector);

    return { success: true, output: { selector: step.target.selector } };
  }

  /**
   * 执行输入
   */
  private async executeInput(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    if (!step.target?.selector) {
      return { success: false, error: "No selector specified" };
    }

    // 获取输入值
    let value: string;

    if (step.data?.source === "user") {
      // 从用户输入或状态变量获取
      const fieldName = step.data.field ?? "value";
      value = this.executionState.variables[fieldName] ?? "";
    } else if (step.data?.source === "faker") {
      // 使用 faker 生成
      value = this.generateFakerValue(step.data.fakerMethod ?? "name");
    } else if (step.data?.source === "constant") {
      value = step.data.value ?? "";
    } else {
      value = step.target.value ?? "";
    }

    await this.playwright.fill(step.target.selector, value);

    // 保存到状态
    if (step.data?.field) {
      this.executionState.variables[step.data.field] = value;
    }

    return { success: true, output: { selector: step.target.selector, value } };
  }

  /**
   * 执行选择
   */
  private async executeSelect(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    if (!step.target?.selector || !step.target.value) {
      return { success: false, error: "No selector or value specified" };
    }

    if (!this.currentPage) {
      return { success: false, error: "No active page" };
    }

    await this.currentPage.selectOption(
      step.target.selector,
      step.target.value,
    );

    return {
      success: true,
      output: { selector: step.target.selector, value: step.target.value },
    };
  }

  /**
   * 执行等待
   */
  private async executeWait(_step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    const timeout = _step.validation?.timeout ?? 5000;

    if (_step.target?.selector) {
      // 等待元素
      await this.currentPage?.waitForSelector(_step.target.selector, {
        timeout,
      });
    } else {
      // 简单延迟
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }

    return { success: true, output: { waited: timeout } };
  }

  /**
   * 执行验证
   */
  private async executeVerify(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    return await this.validateStep(step);
  }

  /**
   * 执行截图
   */
  private async executeScreenshot(_step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    screenshot?: string;
  }> {
    const screenshot = await this.playwright.screenshot({ fullPage: true });
    const base64 = screenshot.toString("base64");

    return {
      success: true,
      screenshot: `data:image/png;base64,${base64}`,
    };
  }

  /**
   * 执行提取
   */
  private async executeExtract(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    if (!step.target?.selector || !this.currentPage) {
      return { success: false, error: "No selector specified" };
    }

    const text = await this.currentPage.textContent(step.target.selector);

    // 保存到状态
    if (step.data?.field) {
      this.executionState.variables[step.data.field] = text;
    }

    return { success: true, output: { text } };
  }

  /**
   * 验证步骤结果
   */
  private async validateStep(step: SOPStep): Promise<{
    success: boolean;
    output?: any;
    error?: string;
  }> {
    if (!step.validation || !this.currentPage) {
      return { success: true };
    }

    try {
      switch (step.validation.type) {
        case "exists": {
          const selector = step.target?.selector ?? "body";
          const element = await this.currentPage.$(selector);
          const exists = element !== null;

          if (exists !== step.validation.expected) {
            return {
              success: false,
              error: `Element ${selector} existence check failed`,
            };
          }
          break;
        }

        case "visible": {
          const selector = step.target?.selector ?? "body";
          const isVisible = await this.currentPage.isVisible(selector);

          if (isVisible !== step.validation.expected) {
            return {
              success: false,
              error: `Element ${selector} visibility check failed`,
            };
          }
          break;
        }

        case "text": {
          const selector = step.target?.selector ?? "body";
          const text = await this.currentPage.textContent(selector);
          const expectedText = String(step.validation.expected);

          if (!text?.includes(expectedText)) {
            return {
              success: false,
              error: `Text validation failed: expected "${expectedText}", got "${text}"`,
            };
          }
          break;
        }

        case "value": {
          const selector = step.target?.selector ?? "";
          const value = await this.currentPage.inputValue(selector);

          if (value !== step.validation.expected) {
            return {
              success: false,
              error: `Value validation failed: expected "${step.validation.expected}", got "${value}"`,
            };
          }
          break;
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 生成 Faker 值
   */
  private generateFakerValue(method: string): string {
    const parts = method.split(".");

    if (parts.length === 1) {
      // 简单方法
      switch (method) {
        case "name":
          return faker.person.fullName();
        case "email":
          return faker.internet.email();
        case "phone":
          return faker.phone.number();
        case "address":
          return faker.location.streetAddress();
        case "company":
          return faker.company.name();
        default:
          return faker.lorem.word();
      }
    } else {
      // 复杂方法，如 "person.firstName"
      // 这里简化处理
      return faker.person.fullName();
    }
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): ExecutionState {
    return {
      id: crypto.randomUUID(),
      workflowId: "",
      timestamp: new Date().toISOString(),
      variables: {},
      currentStepNumber: 0,
      completedSteps: [],
      failedSteps: [],
      currentUrl: "",
      cookies: [],
      localStorage: {},
      sessionStorage: {},
    };
  }

  /**
   * 获取当前执行状态
   */
  getExecutionState(): ExecutionState {
    return { ...this.executionState };
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    if (this.currentPage) {
      await this.currentPage.close().catch(() => {});
      this.currentPage = null;
    }
    // PlaywrightManager 会在外部管理生命周期，这里不需要关闭
  }
}
