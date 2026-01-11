import { v4 as uuidv4 } from 'uuid';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LLMProviderManager } from '../../core/llm/LLMProviderManager';
import { StorageManager } from '../../core/storage/StorageManager';
import {
  ScanResult,
  PageMetadata,
  BusinessFlow,
  DataDependency,
  CritiqueResult,
} from '../../types/schemas';

/**
 * 解读代理 (Phase B)
 * 使用 LLM 理解页面的业务功能并生成结构化 metadata
 */
export class InterpretAgent {
  private llmManager: LLMProviderManager;
  private storage: StorageManager;

  constructor(llmManager: LLMProviderManager, storage: StorageManager) {
    this.llmManager = llmManager;
    this.storage = storage;
  }

  /**
   * 解读单个扫描结果
   */
  async interpret(scanResult: ScanResult): Promise<PageMetadata> {
    console.log(`\n[InterpretAgent] 开始解读页面: ${scanResult.url}`);

    // 准备上下文信息
    const context = this.prepareContext(scanResult);

    // 调用 LLM 进行分析
    console.log('[InterpretAgent] 调用 LLM 分析页面...');
    const analysis = await this.analyzeWithLLM(context);

    // 解析 LLM 响应
    const parsedAnalysis = this.parseAnalysis(analysis);

    // 创建 PageMetadata
    const metadata: PageMetadata = {
      id: uuidv4(),
      scanResultId: scanResult.id,
      url: scanResult.url,
      route: scanResult.route,
      timestamp: new Date().toISOString(),

      pageTitle: parsedAnalysis.pageTitle,
      pageType: parsedAnalysis.pageType,
      primaryPurpose: parsedAnalysis.primaryPurpose,
      businessFunctions: parsedAnalysis.businessFunctions,

      interactiveElements: scanResult.elements,
      dataDependencies: parsedAnalysis.dataDependencies,
      businessFlows: parsedAnalysis.businessFlows,

      relatedPages: parsedAnalysis.relatedPages,

      critique: this.generateBasicCritique(parsedAnalysis),
    };

    // 保存 metadata
    await this.storage.savePhaseData('interpret', metadata);

    console.log(`[InterpretAgent] 解读完成: ${scanResult.url}`);
    console.log(`  - 页面类型: ${metadata.pageType}`);
    console.log(`  - 业务功能: ${metadata.businessFunctions.length}`);
    console.log(`  - 业务流程: ${metadata.businessFlows.length}`);

    return metadata;
  }

  /**
   * 批量解读扫描结果
   */
  async interpretBatch(scanResults: ScanResult[]): Promise<PageMetadata[]> {
    const metadataList: PageMetadata[] = [];

    for (const scanResult of scanResults) {
      try {
        const metadata = await this.interpret(scanResult);
        metadataList.push(metadata);
      } catch (error) {
        console.error(
          `[InterpretAgent] 解读失败 ${scanResult.url}:`,
          (error as Error).message
        );
      }
    }

    return metadataList;
  }

  /**
   * 准备 LLM 分析的上下文
   */
  private prepareContext(scanResult: ScanResult): string {
    const elementsSummary = scanResult.elements
      .slice(0, 20)
      .map(
        (el) =>
          `- ${el.elementType}: ${el.tagName}${el.text ? ` ("${el.text.substring(0, 30)}")` : ''}`
      )
      .join('\n');

    const linksSummary = scanResult.elements
      .filter((el) => el.elementType === 'link')
      .slice(0, 10)
      .map((el) => `- ${el.text || '无文本'}: ${el.attributes.href || ''}`)
      .join('\n');

    return `
URL: ${scanResult.url}
路由: ${scanResult.route}

交互元素 (前 20 个):
${elementsSummary}

链接 (前 10 个):
${linksSummary}

元素统计:
- 总计: ${scanResult.elements.length}
- 按钮: ${scanResult.elements.filter((e) => e.elementType === 'button').length}
- 链接: ${scanResult.elements.filter((e) => e.elementType === 'link').length}
- 输入框: ${scanResult.elements.filter((e) => e.elementType === 'input').length}
- 表单: ${scanResult.elements.filter((e) => e.elementType === 'form').length}

网络请求: ${scanResult.networkRequests.length}
控制台消息: ${scanResult.console.length}
`.trim();
  }

  /**
   * 使用 LLM 分析页面
   */
  private async analyzeWithLLM(context: string): Promise<string> {
    const systemPrompt = `你是一个网页业务分析专家。分析给定的网页信息，理解其业务功能和目的。

请以 JSON 格式返回分析结果，包含以下字段:

{
  "pageTitle": "页面标题",
  "pageType": "页面类型 (landing/form/dashboard/detail/list/auth/other)",
  "primaryPurpose": "页面的主要目的（一句话描述）",
  "businessFunctions": ["业务功能1", "业务功能2"],
  "businessFlows": [
    {
      "id": "flow_1",
      "name": "流程名称",
      "description": "流程描述",
      "steps": [
        {
          "order": 1,
          "action": "动作描述",
          "targetElement": "目标元素描述",
          "expectedOutcome": "预期结果"
        }
      ],
      "preconditions": ["前置条件"],
      "postconditions": ["后置条件"]
    }
  ],
  "dataDependencies": [
    {
      "fieldName": "字段名",
      "dependsOn": ["依赖字段"],
      "validationRules": ["验证规则"],
      "dataType": "数据类型 (string/number/email等)"
    }
  ],
  "relatedPages": [
    {
      "url": "相关页面URL",
      "relationship": "关系 (parent/child/sibling/next/previous)"
    }
  ]
}

注意:
1. 仔细分析元素类型和文本，推断业务功能
2. 识别可能的用户操作流程
3. 如果是表单页面，识别字段之间的依赖关系
4. 保持分析的准确性和实用性`;

    const userPrompt = `请分析以下网页信息:\n\n${context}`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    const { response } = await this.llmManager.invokeWithFallback(messages);
    return response;
  }

  /**
   * 解析 LLM 的分析结果
   */
  private parseAnalysis(response: string): {
    pageTitle: string;
    pageType: any;
    primaryPurpose: string;
    businessFunctions: string[];
    businessFlows: BusinessFlow[];
    dataDependencies: DataDependency[];
    relatedPages: Array<{ url: string; relationship: any }>;
  } {
    try {
      // 尝试提取 JSON（可能包含在 markdown 代码块中）
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('无法从响应中提取 JSON');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        pageTitle: parsed.pageTitle || 'Unknown Page',
        pageType: this.validatePageType(parsed.pageType),
        primaryPurpose: parsed.primaryPurpose || 'Unknown purpose',
        businessFunctions: Array.isArray(parsed.businessFunctions)
          ? parsed.businessFunctions
          : [],
        businessFlows: Array.isArray(parsed.businessFlows)
          ? parsed.businessFlows
          : [],
        dataDependencies: Array.isArray(parsed.dataDependencies)
          ? parsed.dataDependencies
          : [],
        relatedPages: Array.isArray(parsed.relatedPages)
          ? parsed.relatedPages
          : [],
      };
    } catch (error) {
      console.warn('[InterpretAgent] 解析 LLM 响应失败，使用默认值');
      console.warn('响应内容:', response);

      return {
        pageTitle: 'Unknown Page',
        pageType: 'other',
        primaryPurpose: 'Unable to determine',
        businessFunctions: [],
        businessFlows: [],
        dataDependencies: [],
        relatedPages: [],
      };
    }
  }

  /**
   * 验证页面类型
   */
  private validatePageType(type: string): any {
    const validTypes = ['landing', 'form', 'dashboard', 'detail', 'list', 'auth', 'other'];
    return validTypes.includes(type) ? type : 'other';
  }

  /**
   * 生成基础批判
   */
  private generateBasicCritique(analysis: any): CritiqueResult {
    const hasBusinessFunctions = analysis.businessFunctions.length > 0;
    const hasBusinessFlows = analysis.businessFlows.length > 0;
    const hasValidPageType = analysis.pageType !== 'other';

    const completeness = hasBusinessFunctions && hasBusinessFlows ? 0.9 : 0.6;
    const accuracy = hasValidPageType ? 0.8 : 0.6;
    const feasibility = 0.85;
    const coverage = analysis.businessFunctions.length > 2 ? 0.8 : 0.6;

    const overall =
      completeness * 0.3 + accuracy * 0.3 + feasibility * 0.25 + coverage * 0.15;

    const issues: Array<{ severity: any; description: string; suggestion?: string }> = [];

    if (!hasBusinessFunctions) {
      issues.push({
        severity: 'high',
        description: '未识别出业务功能',
        suggestion: '增加页面元素或提供更多上下文信息',
      });
    }

    if (!hasBusinessFlows) {
      issues.push({
        severity: 'medium',
        description: '未识别出业务流程',
        suggestion: '检查页面是否包含交互流程',
      });
    }

    return {
      phaseId: 'interpret',
      timestamp: new Date().toISOString(),
      confidence: {
        overall,
        dimensions: {
          completeness,
          accuracy,
          feasibility,
          coverage,
        },
        reasoning: `识别出 ${analysis.businessFunctions.length} 个业务功能和 ${analysis.businessFlows.length} 个业务流程`,
        humanReviewRequired: overall < 0.6,
      },
      issues,
      autoCorrections: [],
    };
  }
}
