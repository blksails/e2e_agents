import { PageMetadata, CritiqueResult } from "../../../types/schemas";
import { ConfidenceCalculator } from "../ConfidenceCalculator";

/**
 * Issue with severity
 */
interface Issue {
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion?: string;
}

/**
 * 解读结果验证器 (Phase B)
 */
export class InterpretValidator {
  /**
   * 将简单的问题描述转换为结构化问题
   */
  private static toIssue(
    description: string,
    severity: "critical" | "high" | "medium" | "low" = "medium",
  ): Issue {
    return { severity, description };
  }

  /**
   * 验证元数据的完整性
   */
  static validateCompleteness(metadata: PageMetadata): Issue[] {
    const issues: Issue[] = [];

    if (!metadata.pageTitle) {
      issues.push(this.toIssue("缺少页面标题", "high"));
    }

    if (!metadata.pageType) {
      issues.push(this.toIssue("缺少页面类型", "high"));
    }

    if (
      !metadata.businessFunctions ||
      metadata.businessFunctions.length === 0
    ) {
      issues.push(this.toIssue("未识别任何业务功能", "medium"));
    }

    if (!metadata.businessFlows || metadata.businessFlows.length === 0) {
      issues.push(this.toIssue("未识别任何业务流程", "low"));
    }

    return issues;
  }

  /**
   * 验证业务理解的准确性
   */
  static validateAccuracy(metadata: PageMetadata): Issue[] {
    const issues: Issue[] = [];

    // 检查业务功能描述是否过于简短
    metadata.businessFunctions.forEach((func, index) => {
      if (func.length < 3) {
        issues.push(
          this.toIssue(`业务功能 ${index} 描述过于简短: "${func}"`, "low"),
        );
      }
    });

    // 检查业务流程的完整性
    metadata.businessFlows.forEach((flow, index) => {
      if (!flow.name) {
        issues.push(this.toIssue(`业务流程 ${index} 缺少名称`, "high"));
      }
      if (!flow.steps || flow.steps.length === 0) {
        issues.push(
          this.toIssue(`业务流程 "${flow.name}" 没有定义步骤`, "medium"),
        );
      }
    });

    return issues;
  }

  /**
   * 验证业务流程的可行性
   */
  static validateFeasibility(metadata: PageMetadata): Issue[] {
    const issues: Issue[] = [];

    // 检查数据依赖
    metadata.dataDependencies.forEach((dep) => {
      // dataDependencies 是单个字段，不是包含 fields 的对象
      if (!dep.fieldName) {
        issues.push(this.toIssue(`数据依赖缺少字段名`, "medium"));
      }
    });

    return issues;
  }

  /**
   * 完整验证
   */
  static validate(metadata: PageMetadata): CritiqueResult {
    const completenessIssues = this.validateCompleteness(metadata);
    const accuracyIssues = this.validateAccuracy(metadata);
    const feasibilityIssues = this.validateFeasibility(metadata);

    const allIssues = [
      ...completenessIssues,
      ...accuracyIssues,
      ...feasibilityIssues,
    ];

    // 计算置信度
    const confidence = ConfidenceCalculator.calculate(
      {
        completeness: ConfidenceCalculator.calculateCompletenessFromIssues(
          4,
          completenessIssues.length,
        ),
        accuracy: ConfidenceCalculator.calculateAccuracyFromErrors(
          metadata.businessFunctions.length + metadata.businessFlows.length,
          accuracyIssues.length,
        ),
        feasibility:
          feasibilityIssues.length === 0
            ? 1
            : 1 - feasibilityIssues.length * 0.1,
        coverage: metadata.businessFlows.length > 0 ? 1 : 0.5,
      },
      allIssues.length === 0
        ? "业务解读完整且准确"
        : `发现 ${allIssues.length} 个问题`,
    );

    return {
      phaseId: "interpret",
      timestamp: new Date().toISOString(),
      confidence,
      issues: allIssues,
      autoCorrections: [],
    };
  }
}
