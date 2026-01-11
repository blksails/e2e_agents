import { CritiqueResult } from "../../types/schemas";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

/**
 * 人工审核接口
 * 处理需要人工介入的审核请求
 */
export class HumanReviewInterface {
  private dataDir: string;
  private pendingReviews: Map<string, HumanReviewRequest> = new Map();

  constructor(dataDir: string = "./data") {
    this.dataDir = dataDir;
  }

  /**
   * 初始化审核目录
   */
  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.dataDir, "reviews/pending"), {
      recursive: true,
    });
    await fs.mkdir(path.join(this.dataDir, "reviews/completed"), {
      recursive: true,
    });
  }

  /**
   * 创建审核请求
   */
  async createReviewRequest(
    phaseName: string,
    critique: CritiqueResult,
    data: any,
    context?: string,
  ): Promise<string> {
    const reviewId = crypto.randomUUID();

    const request: HumanReviewRequest = {
      id: reviewId,
      phaseName,
      critique,
      data,
      context: context ?? "",
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    this.pendingReviews.set(reviewId, request);

    // 保存到文件系统
    const reviewPath = path.join(
      this.dataDir,
      "reviews/pending",
      `${reviewId}.json`,
    );
    await fs.writeFile(reviewPath, JSON.stringify(request, null, 2), "utf-8");

    return reviewId;
  }

  /**
   * 获取待审核列表
   */
  getPendingReviews(): HumanReviewRequest[] {
    return Array.from(this.pendingReviews.values()).filter(
      (r) => r.status === "pending",
    );
  }

  /**
   * 提交审核决策
   */
  async submitReview(
    reviewId: string,
    decision: "approve" | "reject" | "modify",
    modifiedData?: any,
    comments?: string,
  ): Promise<void> {
    const request = this.pendingReviews.get(reviewId);
    if (!request) {
      throw new Error(`审核请求不存在: ${reviewId}`);
    }

    request.status = decision === "approve" ? "approved" : "rejected";

    const reviewDecision: HumanReviewDecision = {
      decision,
      reviewedAt: new Date().toISOString(),
    };

    if (modifiedData !== undefined) {
      reviewDecision.modifiedData = modifiedData;
    }

    if (comments !== undefined) {
      reviewDecision.comments = comments;
    }

    request.decision = reviewDecision;

    // 移动到 completed 目录
    const completedPath = path.join(
      this.dataDir,
      "reviews/completed",
      `${reviewId}.json`,
    );
    await fs.writeFile(
      completedPath,
      JSON.stringify(request, null, 2),
      "utf-8",
    );

    // 删除 pending 文件
    const pendingPath = path.join(
      this.dataDir,
      "reviews/pending",
      `${reviewId}.json`,
    );
    await fs.unlink(pendingPath).catch(() => {
      /* ignore if not exists */
    });
  }

  /**
   * 等待审核结果
   * 注意：这是一个简化版本，实际应该使用事件或轮询机制
   */
  async waitForReview(
    reviewId: string,
    timeoutMs: number = 300000, // 5分钟
  ): Promise<HumanReviewDecision> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const request = this.pendingReviews.get(reviewId);
      if (request && request.decision) {
        return request.decision;
      }

      // 等待1秒后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`审核超时: ${reviewId}`);
  }

  /**
   * 生成审核报告
   */
  generateReviewPrompt(request: HumanReviewRequest): string {
    const lines: string[] = [];

    lines.push(`# 人工审核请求`);
    lines.push("");
    lines.push(`**审核ID**: ${request.id}`);
    lines.push(`**阶段**: ${request.phaseName}`);
    lines.push(`**创建时间**: ${request.createdAt}`);
    lines.push("");

    lines.push(`## 置信度评分`);
    lines.push(
      `- 总体: ${(request.critique.confidence.overall * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 完整性: ${(request.critique.confidence.dimensions.completeness * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 准确性: ${(request.critique.confidence.dimensions.accuracy * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 可行性: ${(request.critique.confidence.dimensions.feasibility * 100).toFixed(1)}%`,
    );
    lines.push(
      `- 覆盖率: ${(request.critique.confidence.dimensions.coverage * 100).toFixed(1)}%`,
    );
    lines.push("");

    if (request.critique.issues.length > 0) {
      lines.push(`## 发现的问题`);
      request.critique.issues.forEach((issue, index) => {
        lines.push(
          `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`,
        );
        if (issue.suggestion) {
          lines.push(`   建议: ${issue.suggestion}`);
        }
      });
      lines.push("");
    }

    if (request.context) {
      lines.push(`## 上下文`);
      lines.push(request.context);
      lines.push("");
    }

    lines.push(`## 数据`);
    lines.push("```json");
    lines.push(JSON.stringify(request.data, null, 2));
    lines.push("```");
    lines.push("");

    lines.push(`## 审核选项`);
    lines.push(`1. approve - 批准继续`);
    lines.push(`2. reject - 拒绝并停止`);
    lines.push(`3. modify - 修改数据后批准`);

    return lines.join("\n");
  }
}

/**
 * 人工审核请求
 */
export interface HumanReviewRequest {
  id: string;
  phaseName: string;
  critique: CritiqueResult;
  data: any;
  context: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  decision?: HumanReviewDecision;
}

/**
 * 人工审核决策
 */
export interface HumanReviewDecision {
  decision: "approve" | "reject" | "modify";
  modifiedData?: any;
  comments?: string;
  reviewedAt: string;
}
