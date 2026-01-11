import { PageMetadata, SOPWorkflow, SOPStep } from "../../types/schemas";
import { LLMProviderManager } from "../../core/llm/LLMProviderManager";
import { StorageManager } from "../../core/storage/StorageManager";
import { SOPFormatter } from "./SOPFormatter";
import { SOPParser } from "./SOPParser";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import * as crypto from "crypto";

/**
 * 编排代理 (Phase C)
 * 根据页面元数据生成 SOP 工作流
 */
export class OrchestrateAgent {
  private llmManager: LLMProviderManager;
  private storage: StorageManager;

  constructor(llmManager: LLMProviderManager, storage: StorageManager) {
    this.llmManager = llmManager;
    this.storage = storage;
  }

  /**
   * 编排工作流
   */
  async orchestrate(metadata: PageMetadata): Promise<SOPWorkflow> {
    console.log(`开始为页面 "${metadata.pageTitle}" 编排工作流...`);

    // 准备上下文
    const context = this.prepareContext(metadata);

    // 使用 LLM 生成工作流
    const workflowJson = await this.generateWorkflowWithLLM(context, metadata);

    // 解析工作流
    const workflow = this.parseWorkflow(workflowJson, metadata);

    // 保存到存储
    await this.storage.savePhaseData("orchestrate", workflow);

    // 生成并保存 Markdown
    const markdown = SOPFormatter.toMarkdown(workflow);
    const timestampDir = new Date().toISOString().replace(/:/g, "-");
    await this.storage.saveTextFile(
      "orchestrate",
      timestampDir,
      `${workflow.id}.md`,
      markdown,
    );

    console.log(`✓ 工作流编排完成: ${workflow.name}`);

    return workflow;
  }

  /**
   * 批量编排：为多个页面元数据生成工作流
   */
  async orchestrateBatch(metadataList: PageMetadata[]): Promise<SOPWorkflow[]> {
    const workflows: SOPWorkflow[] = [];

    for (const metadata of metadataList) {
      try {
        const workflow = await this.orchestrate(metadata);
        workflows.push(workflow);
      } catch (error) {
        console.error(
          `编排失败 for ${metadata.pageTitle}:`,
          (error as Error).message,
        );
      }
    }

    return workflows;
  }

  /**
   * 准备 LLM 上下文
   */
  private prepareContext(metadata: PageMetadata): string {
    const sections: string[] = [];

    sections.push(`## 页面信息`);
    sections.push(`- 标题: ${metadata.pageTitle}`);
    sections.push(`- 类型: ${metadata.pageType}`);
    sections.push(`- 主要目的: ${metadata.primaryPurpose}`);
    sections.push(`- URL: ${metadata.url}`);
    sections.push("");

    sections.push(`## 业务功能`);
    metadata.businessFunctions.forEach((func, index) => {
      sections.push(`${index + 1}. ${func}`);
    });
    sections.push("");

    if (metadata.businessFlows.length > 0) {
      sections.push(`## 业务流程`);
      metadata.businessFlows.forEach((flow) => {
        sections.push(`### ${flow.name}`);
        sections.push(flow.description);
        sections.push(`步骤数: ${flow.steps.length}`);
        sections.push("");
      });
    }

    if (metadata.interactiveElements.length > 0) {
      sections.push(`## 交互元素`);
      sections.push(`共 ${metadata.interactiveElements.length} 个交互元素`);
      metadata.interactiveElements.slice(0, 10).forEach((el) => {
        sections.push(
          `- ${el.elementType}: ${el.selector} - "${el.text?.substring(0, 50) ?? ""}"`,
        );
      });
      sections.push("");
    }

    if (metadata.dataDependencies.length > 0) {
      sections.push(`## 数据依赖`);
      metadata.dataDependencies.forEach((dep) => {
        sections.push(`- ${dep.fieldName} (${dep.dataType})`);
      });
      sections.push("");
    }

    return sections.join("\n");
  }

  /**
   * 使用 LLM 生成工作流
   */
  private async generateWorkflowWithLLM(
    context: string,
    _metadata: PageMetadata,
  ): Promise<string> {
    const systemPrompt = `你是一个专业的测试流程设计专家。根据页面元数据，生成标准操作流程 (SOP)。

要求：
1. 返回完整的 JSON 格式工作流
2. 每个步骤必须包含: stepNumber, action, description, target
3. action 类型: navigate, click, input, select, wait, verify, screenshot, extract, conditional, loop
4. 为每个步骤设计合理的验证条件
5. 考虑错误处理策略

请返回 JSON 格式，不要包含任何其他文字。

JSON Schema:
{
  "name": "工作流名称",
  "description": "工作流描述",
  "steps": [
    {
      "stepNumber": 1,
      "action": "navigate",
      "description": "步骤描述",
      "target": { "url": "目标URL" },
      "validation": { "expectedUrl": "预期URL" }
    }
  ],
  "requiredInputs": [],
  "preconditions": [],
  "postconditions": [],
  "successCriteria": []
}`;

    const userPrompt = `请为以下页面生成测试工作流：

${context}

要求生成完整的端到端测试流程，包括导航、交互、验证等步骤。`;

    const { response } = await this.llmManager.invokeWithFallback([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    return response;
  }

  /**
   * 解析 LLM 生成的工作流
   */
  private parseWorkflow(
    llmResponse: string,
    _metadata: PageMetadata,
  ): SOPWorkflow {
    try {
      // 提取 JSON 内容（可能被包裹在代码块中）
      let jsonContent = llmResponse.trim();

      // 移除可能的代码块标记
      if (jsonContent.startsWith("```")) {
        const lines = jsonContent.split("\n");
        jsonContent = lines.slice(1, -1).join("\n");
        if (jsonContent.startsWith("json")) {
          jsonContent = jsonContent.substring(4).trim();
        }
      }

      const parsed = JSON.parse(jsonContent);

      // 构建完整的工作流对象
      const workflow: SOPWorkflow = {
        id: crypto.randomUUID(),
        name: parsed.name || `${_metadata.pageTitle} Workflow`,
        description:
          parsed.description ||
          `Auto-generated workflow for ${_metadata.pageTitle}`,
        metadataIds: [_metadata.id],
        timestamp: new Date().toISOString(),
        steps: parsed.steps || [],
        requiredInputs: parsed.requiredInputs || [],
        successCriteria: parsed.successCriteria || [
          {
            description: "All steps completed successfully",
            validation: "workflow.status === 'success'",
          },
        ],
        estimatedDuration: parsed.steps ? parsed.steps.length * 5000 : 30000, // 每步骤估计 5 秒
        complexity: parsed.complexity || "medium",
        tags: [_metadata.pageType, "auto-generated"],
        critique: {
          phaseId: "orchestrate",
          timestamp: new Date().toISOString(),
          confidence: {
            overall: 0.8,
            dimensions: {
              completeness: 0.8,
              accuracy: 0.8,
              feasibility: 0.8,
              coverage: 0.8,
            },
            reasoning: "LLM generated workflow, requires validation",
            humanReviewRequired: true,
          },
          issues: [],
          autoCorrections: [],
        },
      };

      // 验证工作流
      const validation = SOPParser.validate(workflow);
      if (!validation.isValid) {
        console.warn("Workflow validation warnings:", validation.errors);
      }

      return workflow;
    } catch (error) {
      console.error("Failed to parse workflow:", error);
      console.error("LLM Response:", llmResponse);

      // 返回默认的基础工作流
      return this.createDefaultWorkflow(_metadata);
    }
  }

  /**
   * 创建默认工作流（当 LLM 解析失败时）
   */
  private createDefaultWorkflow(metadata: PageMetadata): SOPWorkflow {
    const steps: SOPStep[] = [
      {
        stepNumber: 1,
        action: "navigate",
        description: `Navigate to ${metadata.pageTitle}`,
        target: { url: metadata.url },
        validation: {
          type: "text",
          expected: metadata.pageTitle,
        },
      },
      {
        stepNumber: 2,
        action: "screenshot",
        description: "Take a screenshot of the page",
        target: { selector: "body" },
      },
      {
        stepNumber: 3,
        action: "verify",
        description: "Verify page loaded successfully",
        target: { selector: "body" },
        validation: {
          type: "exists",
          expected: true,
        },
      },
    ];

    return {
      id: crypto.randomUUID(),
      name: `${metadata.pageTitle} - Basic Workflow`,
      description: `Default workflow for ${metadata.pageTitle}`,
      metadataIds: [metadata.id],
      timestamp: new Date().toISOString(),
      steps,
      requiredInputs: [],
      successCriteria: [
        {
          description: "Page loaded successfully",
          validation: "page.title === metadata.pageTitle",
        },
      ],
      estimatedDuration: 15000,
      complexity: "simple",
      tags: [metadata.pageType, "default"],
      critique: {
        phaseId: "orchestrate",
        timestamp: new Date().toISOString(),
        confidence: {
          overall: 0.5,
          dimensions: {
            completeness: 0.5,
            accuracy: 0.7,
            feasibility: 0.9,
            coverage: 0.3,
          },
          reasoning: "Default workflow created due to parsing failure",
          humanReviewRequired: true,
        },
        issues: [
          {
            severity: "high",
            description: "LLM workflow parsing failed, using default workflow",
            suggestion: "Review and enhance the workflow manually",
          },
        ],
        autoCorrections: [],
      },
    };
  }
}
