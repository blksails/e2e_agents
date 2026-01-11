import { z } from "zod";

/**
 * 置信度评分 - 用于自我批判机制
 */
export const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1).describe("总体置信度 (0-1)"),
  dimensions: z.object({
    completeness: z.number().min(0).max(1).describe("完整性"),
    accuracy: z.number().min(0).max(1).describe("准确性"),
    feasibility: z.number().min(0).max(1).describe("可行性"),
    coverage: z.number().min(0).max(1).describe("覆盖率"),
  }),
  reasoning: z.string().describe("评分理由"),
  humanReviewRequired: z.boolean().describe("是否需要人工审核"),
});

export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>;

/**
 * 自我批判结果
 */
export const CritiqueResultSchema = z.object({
  phaseId: z.enum(["scan", "interpret", "orchestrate", "execute", "derive"]),
  timestamp: z.string().datetime().describe("ISO 8601 时间戳"),
  confidence: ConfidenceScoreSchema,
  issues: z.array(
    z.object({
      severity: z.enum(["critical", "high", "medium", "low"]),
      description: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
  autoCorrections: z.array(
    z.object({
      description: z.string(),
      applied: z.boolean(),
    }),
  ),
});

export type CritiqueResult = z.infer<typeof CritiqueResultSchema>;

/**
 * 元素信息
 */
export const ElementInfoSchema = z.object({
  selector: z.string().describe("CSS 选择器"),
  tagName: z.string(),
  text: z.string().optional(),
  attributes: z.record(z.string(), z.string()).describe("元素属性"),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  isInteractive: z.boolean().describe("是否可交互"),
  elementType: z.enum([
    "button",
    "input",
    "link",
    "form",
    "text",
    "image",
    "other",
  ]),
});

export type ElementInfo = z.infer<typeof ElementInfoSchema>;

/**
 * 网络请求信息
 */
export const NetworkRequestSchema = z.object({
  url: z.string(),
  method: z.string(),
  status: z.number().optional(),
  resourceType: z.string(),
  timestamp: z.string(),
});

export type NetworkRequest = z.infer<typeof NetworkRequestSchema>;

/**
 * 控制台消息
 */
export const ConsoleMessageSchema = z.object({
  type: z.enum(["log", "warn", "error", "info", "debug"]),
  text: z.string(),
  timestamp: z.string(),
});

export type ConsoleMessage = z.infer<typeof ConsoleMessageSchema>;

/**
 * 阶段 A: 扫描结果
 */
export const ScanResultSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  route: z.string(),
  timestamp: z.string().datetime(),
  screenshot: z.string().describe("截图文件路径"),
  elements: z.array(ElementInfoSchema),
  networkRequests: z.array(NetworkRequestSchema),
  console: z.array(ConsoleMessageSchema),
  htmlSnapshot: z.string().describe("HTML 快照文件路径"),
  critique: CritiqueResultSchema,
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

/**
 * 数据依赖
 */
export const DataDependencySchema = z.object({
  fieldName: z.string(),
  dependsOn: z.array(z.string()).describe("依赖的其他字段"),
  validationRules: z.array(z.string()),
  dataType: z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "email",
    "phone",
    "url",
    "file",
    "other",
  ]),
});

export type DataDependency = z.infer<typeof DataDependencySchema>;

/**
 * 业务流程
 */
export const BusinessFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(
    z.object({
      order: z.number(),
      action: z.string(),
      targetElement: z.string().optional(),
      expectedOutcome: z.string(),
    }),
  ),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
});

export type BusinessFlow = z.infer<typeof BusinessFlowSchema>;

/**
 * 阶段 B: 页面元数据
 */
export const PageMetadataSchema = z.object({
  id: z.string().uuid(),
  scanResultId: z.string().uuid().describe("关联的扫描结果 ID"),
  url: z.string().url(),
  route: z.string(),
  timestamp: z.string().datetime(),

  // 业务理解
  pageTitle: z.string(),
  pageType: z.enum([
    "landing",
    "form",
    "dashboard",
    "detail",
    "list",
    "auth",
    "other",
  ]),
  primaryPurpose: z.string().describe("页面主要目的"),
  businessFunctions: z.array(z.string()),

  // 提取的结构化数据
  interactiveElements: z.array(ElementInfoSchema),
  dataDependencies: z.array(DataDependencySchema),
  businessFlows: z.array(BusinessFlowSchema),

  // 页面关系
  relatedPages: z.array(
    z.object({
      url: z.string(),
      relationship: z.enum(["parent", "child", "sibling", "next", "previous"]),
    }),
  ),

  critique: CritiqueResultSchema,
});

export type PageMetadata = z.infer<typeof PageMetadataSchema>;

/**
 * SOP 步骤
 */
export const SOPStepSchema = z.object({
  stepNumber: z.number(),
  action: z.enum([
    "navigate",
    "click",
    "input",
    "select",
    "wait",
    "verify",
    "screenshot",
    "extract",
    "conditional",
    "loop",
  ]),
  description: z.string(),
  target: z
    .object({
      selector: z.string().optional(),
      url: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
  data: z
    .object({
      source: z.enum(["user", "faker", "state", "constant"]),
      field: z.string().optional(),
      fakerMethod: z.string().optional(),
      value: z.any().optional(),
    })
    .optional(),
  validation: z
    .object({
      type: z.enum(["exists", "visible", "text", "value", "count", "custom"]),
      expected: z.any(),
      timeout: z.number().optional(),
    })
    .optional(),
  errorHandling: z
    .object({
      strategy: z.enum(["retry", "skip", "abort", "fallback"]),
      maxRetries: z.number().optional(),
      fallbackStepNumber: z.number().optional(),
    })
    .optional(),
});

export type SOPStep = z.infer<typeof SOPStepSchema>;

/**
 * 阶段 C: SOP 工作流
 */
export const SOPWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  metadataIds: z.array(z.string().uuid()).describe("关联的页面元数据 ID"),
  timestamp: z.string().datetime(),

  steps: z.array(SOPStepSchema),

  requiredInputs: z.array(
    z.object({
      field: z.string(),
      type: z.string(),
      required: z.boolean(),
      defaultValue: z.any().optional(),
    }),
  ),

  successCriteria: z.array(
    z.object({
      description: z.string(),
      validation: z.string(),
    }),
  ),

  estimatedDuration: z.number().describe("预计执行时长（秒）"),
  complexity: z.enum(["simple", "medium", "complex"]),
  tags: z.array(z.string()),

  critique: CritiqueResultSchema,
});

export type SOPWorkflow = z.infer<typeof SOPWorkflowSchema>;

/**
 * 执行状态
 */
export const ExecutionStateSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  timestamp: z.string().datetime(),

  // 可变状态
  variables: z.record(z.string(), z.any()).describe("状态变量"),

  currentStepNumber: z.number(),
  completedSteps: z.array(z.number()),
  failedSteps: z.array(
    z.object({
      stepNumber: z.number(),
      error: z.string(),
      timestamp: z.string(),
    }),
  ),

  // 浏览器状态
  currentUrl: z.string().optional(),
  cookies: z.array(z.any()).optional(),
  localStorage: z.record(z.string(), z.string()).optional(),
  sessionStorage: z.record(z.string(), z.string()).optional(),
});

export type ExecutionState = z.infer<typeof ExecutionStateSchema>;

/**
 * 阶段 D: 执行结果
 */
export const ExecutionResultSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  executionStateId: z.string().uuid(),
  timestamp: z.string().datetime(),

  status: z.enum(["success", "failure", "partial", "skipped"]),
  duration: z.number().describe("执行时长（毫秒）"),

  stepResults: z.array(
    z.object({
      stepNumber: z.number(),
      status: z.enum(["success", "failure", "skipped"]),
      duration: z.number(),
      output: z.any().optional(),
      error: z.string().optional(),
      screenshot: z.string().optional(),
    }),
  ),

  screenshots: z.array(z.string()).describe("截图文件路径"),
  logs: z.array(z.string()).describe("日志文件路径"),
  finalState: ExecutionStateSchema,

  critique: CritiqueResultSchema,
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

/**
 * 阶段 E: 派生测试用例
 */
export const DerivedTestCaseSchema = z.object({
  id: z.string().uuid(),
  sourceWorkflowId: z.string().uuid(),
  timestamp: z.string().datetime(),

  strategy: z.enum(["error_pattern", "mutation", "llm_inferred"]),
  strategyLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),

  mutations: z.array(
    z.object({
      stepNumber: z.number(),
      mutationType: z.enum([
        "boundary_value",
        "invalid_input",
        "missing_field",
        "wrong_order",
        "timing_issue",
        "timing_delay",
        "selector_change",
        "unexpected_navigation",
        "race_condition",
        "permission_denial",
        "other",
      ]),
      originalValue: z.any(),
      mutatedValue: z.any(),
      expectedBehavior: z.string(),
    }),
  ),

  workflow: SOPWorkflowSchema.describe("变异后的工作流"),

  expectedOutcome: z.enum(["success", "failure"]).describe("预期执行结果"),
  expectedFailureMode: z.string().optional(),
  bugHypothesis: z.string(),

  critique: CritiqueResultSchema,
});

export type DerivedTestCase = z.infer<typeof DerivedTestCaseSchema>;

/**
 * 认知象限配置
 */
export const CognitiveQuadrantSchema = z.object({
  mode: z.enum(["autonomous", "supervised", "collaborative", "manual"]),
  thresholds: z.object({
    autoApprove: z.number().min(0).max(1).describe("自动批准阈值"),
    requireReview: z.number().min(0).max(1).describe("需要审核阈值"),
    autoCorrect: z.number().min(0).max(1).describe("自动修正阈值"),
  }),
  humanInterventionPoints: z.array(
    z.enum([
      "before_phase",
      "after_phase",
      "on_low_confidence",
      "on_error",
      "on_critical_issue",
    ]),
  ),
});

export type CognitiveQuadrant = z.infer<typeof CognitiveQuadrantSchema>;

/**
 * 配置类型
 */
export const ConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(["qwen", "openai", "claude"]),
    model: z.string(),
    apiKey: z.string(),
    baseUrl: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().default(2048),
  }),
  playwright: z.object({
    headless: z.boolean().default(true),
    slowMo: z.number().default(0),
    timeout: z.number().default(30000),
  }),
  storage: z.object({
    dataDir: z.string().default("./data"),
  }),
  cognitiveQuadrant: CognitiveQuadrantSchema,
});

export type Config = z.infer<typeof ConfigSchema>;
