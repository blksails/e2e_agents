import { SOPWorkflow, SOPStep } from "../../types/schemas";

/**
 * SOP 格式化器
 * 将结构化的工作流转换为 Markdown 格式
 */
export class SOPFormatter {
  /**
   * 将工作流转换为 Markdown
   */
  static toMarkdown(workflow: SOPWorkflow): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# SOP: ${workflow.name}`);
    lines.push("");

    // 元数据
    lines.push(`> **Generated**: ${workflow.timestamp}`);
    lines.push(`> **ID**: \`${workflow.id}\``);
    lines.push(`> **Description**: ${workflow.description}`);
    lines.push(`> **Complexity**: ${workflow.complexity}`);
    lines.push("");

    // 所需输入
    if (workflow.requiredInputs.length > 0) {
      lines.push(`## Required Inputs`);
      lines.push("");
      lines.push(`| Field | Type | Required | Default |`);
      lines.push(`|-------|------|----------|---------|`);

      workflow.requiredInputs.forEach((input) => {
        const required = input.required ? "Yes" : "No";
        const defaultVal = input.defaultValue ?? "-";
        lines.push(
          `| ${input.field} | ${input.type} | ${required} | ${defaultVal} |`,
        );
      });
      lines.push("");
    }

    // 工作流步骤
    lines.push(`## Workflow Steps`);
    lines.push("");

    workflow.steps.forEach((step) => {
      lines.push(`### Step ${step.stepNumber}: ${step.description}`);
      lines.push("");
      lines.push(`**Action**: \`${step.action}\``);

      if (step.target) {
        lines.push(`**Target**: ${this.formatTarget(step.target)}`);
      }

      if (step.data) {
        lines.push(`**Data**: ${this.formatData(step.data)}`);
      }

      if (step.validation) {
        lines.push(`**Validation**: ${this.formatValidation(step.validation)}`);
      }

      if (step.errorHandling) {
        lines.push(`**Error Handling**:`);
        lines.push(`- Strategy: ${step.errorHandling.strategy}`);
        lines.push(`- Max Retries: ${step.errorHandling.maxRetries}`);
        if (step.errorHandling.fallbackStepNumber !== undefined) {
          lines.push(
            `- Fallback Step: ${step.errorHandling.fallbackStepNumber}`,
          );
        }
      }

      // JSON 配置块
      lines.push("");
      lines.push("```json");
      lines.push(
        JSON.stringify(
          {
            stepNumber: step.stepNumber,
            action: step.action,
            target: step.target,
            data: step.data,
            validation: step.validation,
            errorHandling: step.errorHandling,
          },
          null,
          2,
        ),
      );
      lines.push("```");
      lines.push("");
    });

    // 成功标准
    if (workflow.successCriteria.length > 0) {
      lines.push(`## Success Criteria`);
      lines.push("");
      workflow.successCriteria.forEach((criterion, index) => {
        lines.push(`${index + 1}. ${criterion.description}`);
        lines.push(`   Validation: ${criterion.validation}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 格式化目标
   */
  private static formatTarget(target: SOPStep["target"]): string {
    if (!target) return "-";

    if ("selector" in target) {
      return `\`${target.selector}\``;
    }
    if ("url" in target) {
      return `\`${target.url}\``;
    }
    if ("text" in target) {
      return `"${target.text}"`;
    }
    if ("condition" in target) {
      return `Condition: ${target.condition}`;
    }

    return JSON.stringify(target);
  }

  /**
   * 格式化数据
   */
  private static formatData(data: SOPStep["data"]): string {
    if (!data) return "-";

    if (typeof data === "string") {
      return `"${data}"`;
    }

    return `\`${JSON.stringify(data)}\``;
  }

  /**
   * 格式化验证
   */
  private static formatValidation(validation: SOPStep["validation"]): string {
    if (!validation) return "-";

    const parts: string[] = [];
    parts.push(`Type: ${validation.type}`);
    parts.push(`Expected: ${JSON.stringify(validation.expected)}`);

    if (validation.timeout) {
      parts.push(`Timeout: ${validation.timeout}ms`);
    }

    return parts.join(", ");
  }

  /**
   * 生成简化版 Markdown (用于快速预览)
   */
  static toSimpleMarkdown(workflow: SOPWorkflow): string {
    const lines: string[] = [];

    lines.push(`# ${workflow.name}`);
    lines.push("");
    lines.push(workflow.description);
    lines.push("");

    workflow.steps.forEach((step) => {
      lines.push(`${step.stepNumber}. **${step.action}**: ${step.description}`);
    });

    return lines.join("\n");
  }

  /**
   * 生成表格格式的步骤总览
   */
  static toStepTable(workflow: SOPWorkflow): string {
    const lines: string[] = [];

    lines.push(`| Step | Action | Description | Target |`);
    lines.push(`|------|--------|-------------|--------|`);

    workflow.steps.forEach((step) => {
      const target = this.formatTarget(step.target);
      lines.push(
        `| ${step.stepNumber} | ${step.action} | ${step.description} | ${target} |`,
      );
    });

    return lines.join("\n");
  }
}
