import {
  CritiqueResult,
  ScanResult,
  PageMetadata,
  SOPWorkflow,
  ExecutionResult,
  DerivedTestCase,
} from "../../types/schemas";
import { ConfidenceCalculator } from "./ConfidenceCalculator";
import { ScanValidator } from "./validators/ScanValidator";
import { InterpretValidator } from "./validators/InterpretValidator";

/**
 * Issue with severity
 */
interface Issue {
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion?: string;
}

/**
 * 自我批判引擎
 * 对各阶段的输出进行质量验证
 */
export class CritiqueEngine {
  private humanReviewThreshold: number;

  constructor(humanReviewThreshold: number = 0.6) {
    this.humanReviewThreshold = humanReviewThreshold;
  }

  /**
   * 将简单的问题描述转换为结构化问题
   */
  private toIssue(
    description: string,
    severity: "critical" | "high" | "medium" | "low" = "medium",
  ): Issue {
    return { severity, description };
  }

  /**
   * 批判扫描结果 (Phase A)
   */
  critiqueScan(scanResult: ScanResult): CritiqueResult {
    return ScanValidator.validate(scanResult);
  }

  /**
   * 批判解读结果 (Phase B)
   */
  critiqueInterpret(metadata: PageMetadata): CritiqueResult {
    return InterpretValidator.validate(metadata);
  }

  /**
   * 批判编排结果 (Phase C)
   * TODO: 实现完整的 SOP 验证
   */
  critiqueOrchestrate(workflow: SOPWorkflow): CritiqueResult {
    const issues: Issue[] = [];

    // 基本验证 - 使用正确的字段名 'name' 而不是 'workflowName'
    if (!workflow.name) {
      issues.push(this.toIssue("缺少工作流名称", "high"));
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      issues.push(this.toIssue("工作流没有定义步骤", "critical"));
    }

    // 检查步骤完整性
    workflow.steps.forEach((step, index) => {
      if (!step.action) {
        issues.push(this.toIssue(`步骤 ${index} 缺少动作类型`, "high"));
      }
      if (!step.description) {
        issues.push(this.toIssue(`步骤 ${index} 缺少描述`, "medium"));
      }
    });

    const confidence = ConfidenceCalculator.quickScore(
      issues.map((i) => i.description),
      10,
    );

    return {
      phaseId: "orchestrate",
      timestamp: new Date().toISOString(),
      confidence,
      issues,
      autoCorrections: [],
    };
  }

  /**
   * 批判执行结果 (Phase D)
   * TODO: 实现完整的执行验证
   */
  critiqueExecute(executionResult: ExecutionResult): CritiqueResult {
    const issues: Issue[] = [];

    // 检查执行状态 - 使用正确的状态值 'failure' 而不是 'failed'
    if (executionResult.status === "failure") {
      // ExecutionResult 没有直接的 error 字段，错误在 stepResults 中
      const hasErrorDetails = executionResult.stepResults.some(
        (sr) => sr.error,
      );
      if (!hasErrorDetails) {
        issues.push(this.toIssue("执行失败但未记录错误信息", "high"));
      }
    }

    // 检查步骤结果
    if (
      !executionResult.stepResults ||
      executionResult.stepResults.length === 0
    ) {
      issues.push(this.toIssue("没有记录任何步骤结果", "critical"));
    }

    const confidence = ConfidenceCalculator.quickScore(
      issues.map((i) => i.description),
      5,
    );

    return {
      phaseId: "execute",
      timestamp: new Date().toISOString(),
      confidence,
      issues,
      autoCorrections: [],
    };
  }

  /**
   * 批判派生测试 (Phase E)
   * TODO: 实现完整的派生测试验证
   */
  critiqueDerive(testCase: DerivedTestCase): CritiqueResult {
    const issues: Issue[] = [];

    // 使用正确的字段名
    if (!testCase.workflow.name) {
      issues.push(this.toIssue("派生测试缺少工作流名称", "high"));
    }

    if (!testCase.sourceWorkflowId) {
      issues.push(this.toIssue("未指定源工作流", "high"));
    }

    if (!testCase.mutations || testCase.mutations.length === 0) {
      issues.push(this.toIssue("没有定义任何变异", "medium"));
    }

    const confidence = ConfidenceCalculator.quickScore(
      issues.map((i) => i.description),
      8,
    );

    return {
      phaseId: "derive",
      timestamp: new Date().toISOString(),
      confidence,
      issues,
      autoCorrections: [],
    };
  }

  /**
   * 判断是否需要人工审核
   */
  requiresHumanReview(critique: CritiqueResult): boolean {
    return (
      critique.confidence.humanReviewRequired ||
      critique.confidence.overall < this.humanReviewThreshold ||
      critique.issues.some((i) => i.severity === "critical")
    );
  }

  /**
   * 生成审核报告
   */
  generateReviewReport(phaseName: string, critique: CritiqueResult): string {
    const lines: string[] = [];

    lines.push(`# ${phaseName} 自我批判报告`);
    lines.push("");
    lines.push(
      `**总体置信度**: ${(critique.confidence.overall * 100).toFixed(1)}%`,
    );
    lines.push("");
    lines.push("**维度评分**:");
    lines.push(
      `- 完整性: ${(critique.confidence.dimensions.completeness * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 准确性: ${(critique.confidence.dimensions.accuracy * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 可行性: ${(critique.confidence.dimensions.feasibility * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 覆盖率: ${(critique.confidence.dimensions.coverage * 100).toFixed(1)}%`,
    );
    lines.push("");
    lines.push(`**推理过程**: ${critique.confidence.reasoning}`);
    lines.push("");

    if (critique.issues.length > 0) {
      lines.push("**发现的问题**:");
      critique.issues.forEach((issue, index) => {
        lines.push(
          `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`,
        );
        if (issue.suggestion) {
          lines.push(`   建议: ${issue.suggestion}`);
        }
      });
      lines.push("");
    }

    if (critique.autoCorrections.length > 0) {
      lines.push("**自动修正**:");
      critique.autoCorrections.forEach((correction, index) => {
        lines.push(
          `${index + 1}. ${correction.description} - ${correction.applied ? "已应用" : "未应用"}`,
        );
      });
      lines.push("");
    }

    lines.push(
      `**需要人工审核**: ${this.requiresHumanReview(critique) ? "是" : "否"}`,
    );

    return lines.join("\n");
  }
}
