import { ScanResult, CritiqueResult } from "../../../types/schemas";
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
 * 扫描结果验证器 (Phase A)
 */
export class ScanValidator {
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
   * 验证扫描结果的完整性
   */
  static validateCompleteness(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    // 检查必需字段
    if (!scanResult.url) {
      issues.push(this.toIssue("缺少 URL", "critical"));
    }

    if (!scanResult.screenshot) {
      issues.push(this.toIssue("缺少截图", "high"));
    }

    if (!scanResult.htmlSnapshot) {
      issues.push(this.toIssue("缺少 HTML 快照", "medium"));
    }

    // 检查元素数量
    if (!scanResult.elements || scanResult.elements.length === 0) {
      issues.push(this.toIssue("未提取到任何页面元素", "high"));
    }

    return issues;
  }

  /**
   * 验证扫描结果的准确性
   */
  static validateAccuracy(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    // 检查 URL 格式
    try {
      new URL(scanResult.url);
    } catch {
      issues.push(this.toIssue(`无效的 URL: ${scanResult.url}`, "critical"));
    }

    // 检查截图是否为有效的 base64
    if (
      scanResult.screenshot &&
      !scanResult.screenshot.startsWith("data:image")
    ) {
      issues.push(
        this.toIssue("截图格式不正确，应为 base64 data URL", "medium"),
      );
    }

    // 检查元素选择器
    scanResult.elements.forEach((element, index) => {
      if (!element.selector) {
        issues.push(this.toIssue(`元素 ${index} 缺少选择器`, "high"));
      }
      if (!element.tagName) {
        issues.push(this.toIssue(`元素 ${index} 缺少标签名`, "high"));
      }
    });

    return issues;
  }

  /**
   * 验证元素提取的覆盖率
   */
  static validateCoverage(scanResult: ScanResult): Issue[] {
    const issues: Issue[] = [];

    // 检查是否有交互元素
    const hasButtons = scanResult.elements.some(
      (el) => el.elementType === "button",
    );
    const hasInputs = scanResult.elements.some(
      (el) => el.elementType === "input",
    );
    const hasLinks = scanResult.elements.some(
      (el) => el.elementType === "link",
    );

    // 警告：可能遗漏了某些常见元素类型
    if (!hasButtons && !hasInputs && !hasLinks) {
      issues.push(
        this.toIssue("未找到任何交互元素（按钮、输入框、链接）", "low"),
      );
    }

    return issues;
  }

  /**
   * 完整验证
   */
  static validate(scanResult: ScanResult): CritiqueResult {
    const completenessIssues = this.validateCompleteness(scanResult);
    const accuracyIssues = this.validateAccuracy(scanResult);
    const coverageIssues = this.validateCoverage(scanResult);

    const allIssues = [
      ...completenessIssues,
      ...accuracyIssues,
      ...coverageIssues,
    ];

    // 计算置信度
    const confidence = ConfidenceCalculator.calculate(
      {
        completeness: ConfidenceCalculator.calculateCompletenessFromIssues(
          5,
          completenessIssues.length,
        ),
        accuracy: ConfidenceCalculator.calculateAccuracyFromErrors(
          scanResult.elements.length,
          accuracyIssues.length,
        ),
        feasibility: completenessIssues.length === 0 ? 1 : 0.5,
        coverage: coverageIssues.length === 0 ? 1 : 0.7,
      },
      allIssues.length === 0
        ? "扫描结果完整且准确"
        : `发现 ${allIssues.length} 个问题`,
    );

    return {
      phaseId: "scan",
      timestamp: new Date().toISOString(),
      confidence,
      issues: allIssues,
      autoCorrections: [],
    };
  }
}
