import { CognitiveQuadrant, CritiqueResult } from "../../types/schemas";

/**
 * 认知象限管理器
 * 管理人类介入策略
 */
export class CognitiveQuadrantManager {
  private config: CognitiveQuadrant;

  constructor(config?: Partial<CognitiveQuadrant>) {
    // 默认配置
    this.config = {
      mode: config?.mode ?? "supervised",
      thresholds: {
        autoApprove: config?.thresholds?.autoApprove ?? 0.8,
        requireReview: config?.thresholds?.requireReview ?? 0.6,
        autoCorrect: config?.thresholds?.autoCorrect ?? 0.5,
      },
      humanInterventionPoints: config?.humanInterventionPoints ?? [
        "on_low_confidence",
        "on_critical_issue",
      ],
    };
  }

  /**
   * 决定是否需要人类介入
   */
  shouldEscalateToHuman(critique: CritiqueResult): {
    shouldEscalate: boolean;
    reason: string;
  } {
    const confidence = critique.confidence.overall;

    // 模式：自动化优先
    if (this.config.mode === "autonomous") {
      // 只在严重问题时升级
      if (confidence < this.config.thresholds.autoCorrect) {
        return {
          shouldEscalate: true,
          reason: `置信度过低 (${(confidence * 100).toFixed(1)}%)`,
        };
      }
      if (this.hasCriticalErrors(critique)) {
        return {
          shouldEscalate: true,
          reason: "检测到关键错误",
        };
      }
      return { shouldEscalate: false, reason: "自动处理" };
    }

    // 模式：协作式
    if (this.config.mode === "collaborative") {
      // 自动批准高置信度
      if (confidence >= this.config.thresholds.autoApprove) {
        return { shouldEscalate: false, reason: "置信度高，自动批准" };
      }

      // 中低置信度需要审核
      if (confidence < this.config.thresholds.requireReview) {
        return {
          shouldEscalate: true,
          reason: `置信度中等 (${(confidence * 100).toFixed(1)}%)，需要审核`,
        };
      }

      // 检查人工介入点
      if (this.checkInterventionPoints(critique)) {
        return {
          shouldEscalate: true,
          reason: "触发人工介入点",
        };
      }

      return { shouldEscalate: false, reason: "自动处理" };
    }

    // 模式：监督式 (默认)
    if (this.config.mode === "supervised") {
      // 自动批准高置信度
      if (confidence >= this.config.thresholds.autoApprove) {
        return { shouldEscalate: false, reason: "置信度高，自动批准" };
      }

      // 低于审核阈值需要人工
      if (confidence < this.config.thresholds.requireReview) {
        return {
          shouldEscalate: true,
          reason: `置信度低于阈值 (${(confidence * 100).toFixed(1)}%)`,
        };
      }

      // 检查关键问题
      if (this.hasCriticalErrors(critique)) {
        return {
          shouldEscalate: true,
          reason: "检测到关键问题",
        };
      }

      return { shouldEscalate: false, reason: "自动处理" };
    }

    // 模式：人工优先
    if (this.config.mode === "manual") {
      // 只有非常高的置信度才自动批准
      if (confidence >= 0.9 && critique.issues.length === 0) {
        return { shouldEscalate: false, reason: "置信度极高，自动批准" };
      }

      return {
        shouldEscalate: true,
        reason: "人工模式，需要人工审核",
      };
    }

    return { shouldEscalate: false, reason: "默认自动处理" };
  }

  /**
   * 检查是否有关键错误
   */
  private hasCriticalErrors(critique: CritiqueResult): boolean {
    return critique.issues.some((issue) => issue.severity === "critical");
  }

  /**
   * 检查人工介入点
   */
  private checkInterventionPoints(critique: CritiqueResult): boolean {
    for (const point of this.config.humanInterventionPoints) {
      switch (point) {
        case "on_low_confidence":
          if (
            critique.confidence.overall < this.config.thresholds.requireReview
          ) {
            return true;
          }
          break;

        case "on_critical_issue":
          if (this.hasCriticalErrors(critique)) {
            return true;
          }
          break;

        case "on_error":
          if (critique.issues.length > 0) {
            return true;
          }
          break;

        case "before_phase":
        case "after_phase":
          // 这些需要在调用时由外部代码检查
          break;
      }
    }

    return false;
  }

  /**
   * 尝试自动修正
   */
  shouldAttemptAutoCorrect(critique: CritiqueResult): boolean {
    return (
      critique.autoCorrections.length > 0 &&
      critique.issues.length > 0 &&
      critique.confidence.overall >= this.config.thresholds.autoCorrect
    );
  }

  /**
   * 获取推荐动作
   */
  getRecommendedAction(critique: CritiqueResult): {
    action: "approve" | "reject" | "review" | "auto_correct";
    reason: string;
  } {
    const escalation = this.shouldEscalateToHuman(critique);

    // 需要升级到人工
    if (escalation.shouldEscalate) {
      if (critique.confidence.overall < this.config.thresholds.autoCorrect) {
        return {
          action: "reject",
          reason: escalation.reason,
        };
      }
      return {
        action: "review",
        reason: escalation.reason,
      };
    }

    // 尝试自动修正
    if (this.shouldAttemptAutoCorrect(critique)) {
      return {
        action: "auto_correct",
        reason: "检测到可自动修正的问题",
      };
    }

    // 自动批准
    if (critique.confidence.overall >= this.config.thresholds.autoApprove) {
      return {
        action: "approve",
        reason: "置信度高，自动批准",
      };
    }

    // 默认审核
    return {
      action: "review",
      reason: "置信度中等，建议审核",
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<CognitiveQuadrant>): void {
    this.config = {
      ...this.config,
      ...updates,
      thresholds: {
        ...this.config.thresholds,
        ...(updates.thresholds ?? {}),
      },
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): CognitiveQuadrant {
    return { ...this.config };
  }
}
