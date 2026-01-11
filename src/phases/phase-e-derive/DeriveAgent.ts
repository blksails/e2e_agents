import {
  SOPWorkflow,
  PageMetadata,
  DerivedTestCase,
} from "../../types/schemas";
import { LLMProviderManager } from "../../core/llm/LLMProviderManager";
import { StorageManager } from "../../core/storage/StorageManager";
import { ErrorPatternLibrary } from "./level1/ErrorPatternLibrary";
import { MutationEngine } from "./level2/MutationEngine";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import * as crypto from "crypto";

/**
 * 派生代理 (Phase E)
 * 通过三级策略生成派生测试用例
 */
export class DeriveAgent {
  private llmManager: LLMProviderManager;
  private storage: StorageManager;

  constructor(llmManager: LLMProviderManager, storage: StorageManager) {
    this.llmManager = llmManager;
    this.storage = storage;
  }

  /**
   * 派生测试用例
   */
  async derive(
    workflow: SOPWorkflow,
    metadata?: PageMetadata,
    options?: {
      level1Count?: number;
      level2Count?: number;
      level3Count?: number;
    },
  ): Promise<DerivedTestCase[]> {
    console.log(`开始为工作流 "${workflow.name}" 派生测试用例...`);

    const allTestCases: DerivedTestCase[] = [];

    // Level 1: 错误模式库
    console.log("  Level 1: 应用错误模式库...");
    const level1Cases = ErrorPatternLibrary.generateAll(workflow);
    const level1Selected = level1Cases.slice(0, options?.level1Count ?? 10);
    allTestCases.push(...level1Selected);
    console.log(`    生成 ${level1Selected.length} 个错误模式测试`);

    // Level 2: 变异引擎
    console.log("  Level 2: 应用变异引擎...");
    const level2Cases = MutationEngine.generateAll(
      workflow,
      options?.level2Count ?? 5,
    );
    allTestCases.push(...level2Cases);
    console.log(`    生成 ${level2Cases.length} 个变异测试`);

    // Level 3: LLM 推理边界情况
    if (metadata) {
      console.log("  Level 3: LLM 推理边界情况...");
      const level3Cases = await this.generateLLMEdgeCases(
        workflow,
        metadata,
        options?.level3Count ?? 3,
      );
      allTestCases.push(...level3Cases);
      console.log(`    生成 ${level3Cases.length} 个 LLM 推理测试`);
    }

    // 保存派生测试用例
    for (const testCase of allTestCases) {
      await this.storage.savePhaseData("derive", testCase);
    }

    console.log(`✓ 总共生成 ${allTestCases.length} 个派生测试用例`);

    return allTestCases;
  }

  /**
   * Level 3: 使用 LLM 生成边界情况
   */
  private async generateLLMEdgeCases(
    workflow: SOPWorkflow,
    metadata: PageMetadata,
    count: number,
  ): Promise<DerivedTestCase[]> {
    const systemPrompt = `你是一个测试专家，专门发现软件中的边界情况和潜在问题。

根据工作流和页面元数据，生成可能导致问题的边界测试场景。

考虑：
1. 业务逻辑边界（如库存为0、账户余额不足等）
2. 并发场景（同时操作、竞态条件）
3. 异常状态（网络中断、超时、部分失败）
4. 集成问题（第三方服务失败、API 限流）
5. 数据一致性问题

返回 JSON 数组，每个元素包含：
{
  "scenario": "场景描述",
  "stepNumber": 要修改的步骤编号,
  "mutation": "如何修改该步骤",
  "expectedBehavior": "预期系统行为"
}`;

    const userPrompt = `工作流: ${workflow.name}
描述: ${workflow.description}

页面类型: ${metadata.pageType}
主要功能: ${metadata.primaryPurpose}
业务功能: ${metadata.businessFunctions.join(", ")}

步骤概览:
${workflow.steps.map((s) => `${s.stepNumber}. ${s.action}: ${s.description}`).join("\n")}

请生成 ${count} 个边界测试场景。`;

    try {
      const { response } = await this.llmManager.invokeWithFallback([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      // 解析 LLM 响应
      const scenarios = this.parseLLMResponse(response);

      // 转换为 DerivedTestCase
      return scenarios
        .slice(0, count)
        .map((scenario) => this.createLLMTestCase(workflow, scenario));
    } catch (error) {
      console.error("LLM edge case generation failed:", error);
      return [];
    }
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(response: string): Array<{
    scenario: string;
    stepNumber: number;
    mutation: string;
    expectedBehavior: string;
  }> {
    try {
      // 提取 JSON 内容
      let jsonContent = response.trim();

      if (jsonContent.startsWith("```")) {
        const lines = jsonContent.split("\n");
        jsonContent = lines.slice(1, -1).join("\n");
        if (jsonContent.startsWith("json")) {
          jsonContent = jsonContent.substring(4).trim();
        }
      }

      const parsed = JSON.parse(jsonContent);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.warn("Failed to parse LLM response:", error);
      return [];
    }
  }

  /**
   * 创建 LLM 推理的测试用例
   */
  private createLLMTestCase(
    workflow: SOPWorkflow,
    scenario: {
      scenario: string;
      stepNumber: number;
      mutation: string;
      expectedBehavior: string;
    },
  ): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));

    // 应用变异（这里简化处理，实际应根据 mutation 描述修改）
    const targetStep = mutatedWorkflow.steps.find(
      (s) => s.stepNumber === scenario.stepNumber,
    );

    if (targetStep) {
      // 简化处理：在步骤描述中添加场景说明
      targetStep.description = `[LLM Edge Case: ${scenario.scenario}] ${targetStep.description}`;
    }

    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "llm_inferred",
      strategyLevel: 3,
      mutations: [
        {
          stepNumber: scenario.stepNumber,
          mutationType: "other",
          originalValue: "normal flow",
          mutatedValue: scenario.mutation,
          expectedBehavior: scenario.expectedBehavior,
        },
      ],
      workflow: mutatedWorkflow,
      expectedOutcome: "failure",
      bugHypothesis: `LLM 推断的边界情况: ${scenario.scenario}`,
      critique: {
        phaseId: "derive",
        timestamp: new Date().toISOString(),
        confidence: {
          overall: 0.6,
          dimensions: {
            completeness: 0.7,
            accuracy: 0.6,
            feasibility: 0.6,
            coverage: 0.5,
          },
          reasoning: "LLM-inferred edge case, requires validation",
          humanReviewRequired: true,
        },
        issues: [],
        autoCorrections: [],
      },
    };
  }

  /**
   * 批量派生
   */
  async deriveBatch(
    workflows: SOPWorkflow[],
    metadataMap?: Map<string, PageMetadata>,
  ): Promise<Map<string, DerivedTestCase[]>> {
    const results = new Map<string, DerivedTestCase[]>();

    for (const workflow of workflows) {
      try {
        const metadata = metadataMap?.get(workflow.id);
        const testCases = await this.derive(workflow, metadata);
        results.set(workflow.id, testCases);
      } catch (error) {
        console.error(
          `派生失败 for ${workflow.name}:`,
          (error as Error).message,
        );
        results.set(workflow.id, []);
      }
    }

    return results;
  }

  /**
   * 生成派生测试报告
   */
  generateReport(testCases: DerivedTestCase[]): string {
    const lines: string[] = [];

    lines.push(`# 派生测试报告`);
    lines.push("");
    lines.push(`**总测试数**: ${testCases.length}`);
    lines.push("");

    // 按策略分类统计
    const byStrategy = {
      error_pattern: testCases.filter((t) => t.strategy === "error_pattern")
        .length,
      mutation: testCases.filter((t) => t.strategy === "mutation").length,
      llm_inferred: testCases.filter((t) => t.strategy === "llm_inferred")
        .length,
    };

    lines.push(`## 策略分布`);
    lines.push("");
    lines.push(`- Level 1 (错误模式): ${byStrategy.error_pattern}`);
    lines.push(`- Level 2 (变异): ${byStrategy.mutation}`);
    lines.push(`- Level 3 (LLM 推理): ${byStrategy.llm_inferred}`);
    lines.push("");

    // 按变异类型统计
    const mutationTypes = new Map<string, number>();
    testCases.forEach((tc) => {
      tc.mutations.forEach((m) => {
        mutationTypes.set(
          m.mutationType,
          (mutationTypes.get(m.mutationType) ?? 0) + 1,
        );
      });
    });

    lines.push(`## 变异类型分布`);
    lines.push("");
    mutationTypes.forEach((count, type) => {
      lines.push(`- ${type}: ${count}`);
    });
    lines.push("");

    // 列出所有测试
    lines.push(`## 测试用例列表`);
    lines.push("");
    lines.push(`| ID | 策略 | 变异类型 | 预期结果 |`);
    lines.push(`|----|------|----------|----------|`);

    testCases.forEach((tc) => {
      const mutationType = tc.mutations[0]?.mutationType ?? "unknown";
      lines.push(
        `| ${tc.id.substring(0, 8)} | Level ${tc.strategyLevel} | ${mutationType} | ${tc.expectedOutcome} |`,
      );
    });

    return lines.join("\n");
  }
}
