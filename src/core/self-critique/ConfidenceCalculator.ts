import { ConfidenceScore } from "../../types/schemas";

/**
 * 置信度计算器
 * 计算各个维度的置信度分数
 */
export class ConfidenceCalculator {
  /**
   * 计算总体置信度
   * @param dimensions 各维度分数
   * @param reasoning 推理过程
   * @param humanReviewThreshold 人工审核阈值
   */
  static calculate(
    dimensions: {
      completeness: number;
      accuracy: number;
      feasibility: number;
      coverage: number;
    },
    reasoning: string,
    humanReviewThreshold: number = 0.6,
  ): ConfidenceScore {
    // 各维度权重
    const weights = {
      completeness: 0.3, // 完整性 30%
      accuracy: 0.3, // 准确性 30%
      feasibility: 0.25, // 可行性 25%
      coverage: 0.15, // 覆盖率 15%
    };

    // 验证维度分数范围
    Object.values(dimensions).forEach((score) => {
      if (score < 0 || score > 1) {
        throw new Error(`维度分数必须在 0-1 之间，收到: ${score}`);
      }
    });

    // 计算加权平均
    const overall =
      dimensions.completeness * weights.completeness +
      dimensions.accuracy * weights.accuracy +
      dimensions.feasibility * weights.feasibility +
      dimensions.coverage * weights.coverage;

    // 判断是否需要人工审核
    const humanReviewRequired =
      overall < humanReviewThreshold ||
      dimensions.accuracy < 0.5 ||
      dimensions.feasibility < 0.5;

    return {
      overall: Math.round(overall * 1000) / 1000, // 保留3位小数
      dimensions,
      reasoning,
      humanReviewRequired,
    };
  }

  /**
   * 根据问题列表计算完整性分数
   */
  static calculateCompletenessFromIssues(
    totalExpected: number,
    missingCount: number,
  ): number {
    if (totalExpected === 0) return 1;
    return Math.max(0, 1 - missingCount / totalExpected);
  }

  /**
   * 根据错误列表计算准确性分数
   */
  static calculateAccuracyFromErrors(
    totalItems: number,
    errorCount: number,
  ): number {
    if (totalItems === 0) return 1;
    return Math.max(0, 1 - errorCount / totalItems);
  }

  /**
   * 根据覆盖情况计算覆盖率分数
   */
  static calculateCoverageScore(
    coveredItems: number,
    totalItems: number,
  ): number {
    if (totalItems === 0) return 1;
    return Math.min(1, coveredItems / totalItems);
  }

  /**
   * 简化的评分：基于问题列表
   */
  static quickScore(
    issues: string[],
    totalExpected: number = 10,
  ): ConfidenceScore {
    const completeness = this.calculateCompletenessFromIssues(
      totalExpected,
      issues.length,
    );
    const accuracy = issues.length === 0 ? 1 : 0.7;
    const feasibility = issues.length === 0 ? 1 : 0.8;
    const coverage = completeness;

    return this.calculate(
      { completeness, accuracy, feasibility, coverage },
      issues.length === 0
        ? "没有发现问题"
        : `发现 ${issues.length} 个问题: ${issues.join(", ")}`,
    );
  }
}
