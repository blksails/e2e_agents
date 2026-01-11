import { SOPWorkflow, SOPStep, SOPWorkflowSchema } from "../../types/schemas";

/**
 * SOP 解析器
 * 将 Markdown 格式的 SOP 解析为结构化工作流
 */
export class SOPParser {
  /**
   * 从 Markdown 解析工作流
   */
  static fromMarkdown(markdown: string): SOPWorkflow {
    const lines = markdown.split("\n");
    let currentSection: string | null = null;
    const metadata: any = {};
    const steps: SOPStep[] = [];
    const requiredInputs: any[] = [];
    const successCriteria: Array<{ description: string; validation: string }> =
      [];

    // 解析标题
    const titleMatch = lines[0]?.match(/^#\s+SOP:\s+(.+)$/);
    if (titleMatch) {
      metadata.name = titleMatch[1];
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";

      // 跳过空行
      if (!line) continue;

      // 解析元数据行 (> 开头)
      if (line.startsWith(">")) {
        const metaMatch = line.match(/>\s+\*\*(\w+)\*\*:\s+(.+)$/);
        if (metaMatch) {
          const [, key, value] = metaMatch;
          if (key === "Generated") {
            metadata.timestamp = value;
          } else if (key === "ID") {
            metadata.id = value?.replace(/`/g, "") ?? "";
          } else if (key === "Description") {
            metadata.description = value;
          } else if (key === "Complexity") {
            metadata.complexity = value;
          }
        }
        continue;
      }

      // 检测章节标题
      if (line.startsWith("## ")) {
        currentSection = line.substring(3).trim();
        continue;
      }

      // 根据当前章节解析内容
      if (currentSection === "Success Criteria") {
        const criterionMatch = line.match(/^\d+\.\s+(.+)$/);
        if (criterionMatch && criterionMatch[1]) {
          const description = criterionMatch[1];
          // 下一行应该是 validation
          i++;
          const validationLine = lines[i]?.trim() ?? "";
          const validationMatch = validationLine.match(/Validation:\s+(.+)$/);
          successCriteria.push({
            description,
            validation: validationMatch?.[1] ?? "",
          });
        }
      } else if (currentSection === "Required Inputs") {
        // 跳过表格头和分隔符
        if (line.startsWith("|") && !line.includes("---")) {
          const parts = line
            .split("|")
            .map((p) => p.trim())
            .filter((p) => p);
          if (parts.length >= 4 && parts[0] !== "Field") {
            requiredInputs.push({
              field: parts[0],
              type: parts[1],
              required: parts[2] === "Yes",
              defaultValue: parts[3] === "-" ? undefined : parts[3],
            });
          }
        }
      } else if (currentSection === "Workflow Steps") {
        // 检测步骤标题
        const stepMatch = line.match(/^###\s+Step\s+(\d+):\s+(.+)$/);
        if (stepMatch) {
          // 开始新步骤，但先不添加到数组
          continue;
        }

        // 提取 JSON 代码块
        if (line === "```json") {
          let jsonContent = "";
          i++; // 移到下一行
          while (i < lines.length && lines[i]?.trim() !== "```") {
            jsonContent += (lines[i] ?? "") + "\n";
            i++;
          }

          try {
            const stepData = JSON.parse(jsonContent);
            steps.push(stepData);
          } catch (error) {
            console.warn("Failed to parse step JSON:", error);
          }
        }
      }
    }

    // 构建工作流对象
    const workflow: SOPWorkflow = {
      id: metadata.id || crypto.randomUUID(),
      name: metadata.name || "Untitled Workflow",
      description: metadata.description || "",
      metadataIds: [],
      timestamp: metadata.timestamp || new Date().toISOString(),
      steps: steps.sort((a, b) => a.stepNumber - b.stepNumber),
      requiredInputs,
      successCriteria,
      estimatedDuration: 0, // 需要后续计算
      complexity: metadata.complexity || "medium",
      tags: [],
      critique: {
        phaseId: "orchestrate",
        timestamp: new Date().toISOString(),
        confidence: {
          overall: 1,
          dimensions: {
            completeness: 1,
            accuracy: 1,
            feasibility: 1,
            coverage: 1,
          },
          reasoning: "Parsed from markdown",
          humanReviewRequired: false,
        },
        issues: [],
        autoCorrections: [],
      },
    };

    // 验证工作流
    try {
      return SOPWorkflowSchema.parse(workflow);
    } catch (error) {
      console.error("Workflow validation failed:", error);
      throw new Error(`Invalid workflow structure: ${error}`);
    }
  }

  /**
   * 从 JSON 字符串解析工作流
   */
  static fromJSON(json: string): SOPWorkflow {
    try {
      const data = JSON.parse(json);
      return SOPWorkflowSchema.parse(data);
    } catch (error) {
      throw new Error(`Failed to parse workflow JSON: ${error}`);
    }
  }

  /**
   * 验证工作流的完整性
   */
  static validate(workflow: SOPWorkflow): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!workflow.name) {
      errors.push("Missing workflow name");
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push("No steps defined");
    }

    // 检查步骤编号连续性
    const stepNumbers = workflow.steps
      .map((s) => s.stepNumber)
      .sort((a, b) => a - b);
    for (let i = 0; i < stepNumbers.length; i++) {
      if (stepNumbers[i] !== i + 1) {
        errors.push(
          `Step numbering gap: expected ${i + 1}, found ${stepNumbers[i]}`,
        );
        break;
      }
    }

    // 检查每个步骤的必需字段
    workflow.steps.forEach((step, index) => {
      if (!step.action) {
        errors.push(`Step ${index + 1} missing action`);
      }
      if (!step.description) {
        errors.push(`Step ${index + 1} missing description`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 合并多个工作流
   */
  static merge(workflows: SOPWorkflow[], name: string): SOPWorkflow {
    let stepNumber = 1;
    const allSteps: SOPStep[] = [];

    workflows.forEach((workflow) => {
      workflow.steps.forEach((step) => {
        allSteps.push({
          ...step,
          stepNumber: stepNumber++,
        });
      });
    });

    const mergedWorkflow: SOPWorkflow = {
      id: crypto.randomUUID(),
      name,
      description: `Merged workflow from ${workflows.length} workflows`,
      metadataIds: workflows.flatMap((w) => w.metadataIds),
      timestamp: new Date().toISOString(),
      steps: allSteps,
      requiredInputs: workflows.flatMap((w) => w.requiredInputs),
      successCriteria: workflows.flatMap((w) => w.successCriteria),
      estimatedDuration: workflows.reduce(
        (sum, w) => sum + w.estimatedDuration,
        0,
      ),
      complexity: "complex",
      tags: [...new Set(workflows.flatMap((w) => w.tags))],
      critique: {
        phaseId: "orchestrate",
        timestamp: new Date().toISOString(),
        confidence: {
          overall: 1,
          dimensions: {
            completeness: 1,
            accuracy: 1,
            feasibility: 1,
            coverage: 1,
          },
          reasoning: "Merged workflow",
          humanReviewRequired: false,
        },
        issues: [],
        autoCorrections: [],
      },
    };

    return mergedWorkflow;
  }
}
