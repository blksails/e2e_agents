import { SOPWorkflow, DerivedTestCase } from "../../../types/schemas";

/**
 * Level 1: 错误模式库
 * 基于常见错误模式生成测试用例
 */
export class ErrorPatternLibrary {
  /**
   * 生成边界值测试
   */
  static generateBoundaryValueTests(workflow: SOPWorkflow): DerivedTestCase[] {
    const testCases: DerivedTestCase[] = [];

    workflow.steps.forEach((step) => {
      if (step.action === "input" && step.target?.selector) {
        // 空字符串
        testCases.push(
          this.createTestCase(workflow, step.stepNumber, {
            mutationType: "boundary_value",
            description: "测试空字符串输入",
            originalValue: step.data?.value,
            mutatedValue: "",
            expectedBehavior: "应显示'必填字段'错误或阻止提交",
          }),
        );

        // 超长字符串
        testCases.push(
          this.createTestCase(workflow, step.stepNumber, {
            mutationType: "boundary_value",
            description: "测试超长字符串",
            originalValue: step.data?.value,
            mutatedValue: "A".repeat(10000),
            expectedBehavior: "应限制输入长度或显示错误",
          }),
        );

        // 特殊字符
        testCases.push(
          this.createTestCase(workflow, step.stepNumber, {
            mutationType: "boundary_value",
            description: "测试特殊字符",
            originalValue: step.data?.value,
            mutatedValue: "<script>alert('xss')</script>",
            expectedBehavior: "应过滤或转义特殊字符",
          }),
        );
      }

      // 数字边界值
      if (
        step.action === "input" &&
        step.data?.fakerMethod?.includes("number")
      ) {
        testCases.push(
          this.createTestCase(workflow, step.stepNumber, {
            mutationType: "boundary_value",
            description: "测试负数",
            originalValue: step.data?.value,
            mutatedValue: -1,
            expectedBehavior: "应拒绝负数或显示错误",
          }),
        );

        testCases.push(
          this.createTestCase(workflow, step.stepNumber, {
            mutationType: "boundary_value",
            description: "测试超大数字",
            originalValue: step.data?.value,
            mutatedValue: Number.MAX_SAFE_INTEGER,
            expectedBehavior: "应处理或限制超大数字",
          }),
        );
      }
    });

    return testCases;
  }

  /**
   * 生成无效输入测试
   */
  static generateInvalidInputTests(workflow: SOPWorkflow): DerivedTestCase[] {
    const testCases: DerivedTestCase[] = [];

    workflow.steps.forEach((step) => {
      if (step.action === "input" && step.target?.selector) {
        const selector = step.target.selector;

        // 邮箱字段
        if (
          selector.includes("email") ||
          step.data?.fakerMethod?.includes("email")
        ) {
          testCases.push(
            this.createTestCase(workflow, step.stepNumber, {
              mutationType: "invalid_input",
              description: "测试无效邮箱格式",
              originalValue: step.data?.value,
              mutatedValue: "invalid-email",
              expectedBehavior: "应显示邮箱格式错误",
            }),
          );
        }

        // 电话字段
        if (
          selector.includes("phone") ||
          selector.includes("tel") ||
          step.data?.fakerMethod?.includes("phone")
        ) {
          testCases.push(
            this.createTestCase(workflow, step.stepNumber, {
              mutationType: "invalid_input",
              description: "测试无效电话格式",
              originalValue: step.data?.value,
              mutatedValue: "abc123",
              expectedBehavior: "应显示电话格式错误",
            }),
          );
        }

        // URL 字段
        if (selector.includes("url") || selector.includes("website")) {
          testCases.push(
            this.createTestCase(workflow, step.stepNumber, {
              mutationType: "invalid_input",
              description: "测试无效 URL 格式",
              originalValue: step.data?.value,
              mutatedValue: "not-a-url",
              expectedBehavior: "应显示 URL 格式错误",
            }),
          );
        }
      }
    });

    return testCases;
  }

  /**
   * 生成缺失必填字段测试
   */
  static generateMissingFieldTests(workflow: SOPWorkflow): DerivedTestCase[] {
    const testCases: DerivedTestCase[] = [];

    // 查找所有输入步骤
    const inputSteps = workflow.steps.filter((s) => s.action === "input");

    inputSteps.forEach((step) => {
      testCases.push(
        this.createTestCase(workflow, step.stepNumber, {
          mutationType: "missing_field",
          description: "跳过必填字段",
          originalValue: step.data?.value,
          mutatedValue: null,
          expectedBehavior: "应阻止提交并显示错误",
        }),
      );
    });

    return testCases;
  }

  /**
   * 生成 SQL 注入测试
   */
  static generateSQLInjectionTests(workflow: SOPWorkflow): DerivedTestCase[] {
    const testCases: DerivedTestCase[] = [];
    const sqlPayloads = [
      "' OR '1'='1",
      "admin'--",
      "1' UNION SELECT NULL--",
      "'; DROP TABLE users--",
    ];

    workflow.steps.forEach((step) => {
      if (step.action === "input" && step.target?.selector) {
        sqlPayloads.forEach((payload) => {
          testCases.push(
            this.createTestCase(workflow, step.stepNumber, {
              mutationType: "sql_injection",
              description: `SQL 注入测试: ${payload}`,
              originalValue: step.data?.value,
              mutatedValue: payload,
              expectedBehavior: "应过滤或拒绝 SQL 注入尝试",
            }),
          );
        });
      }
    });

    return testCases;
  }

  /**
   * 生成 XSS 测试
   */
  static generateXSSTests(workflow: SOPWorkflow): DerivedTestCase[] {
    const testCases: DerivedTestCase[] = [];
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>",
    ];

    workflow.steps.forEach((step) => {
      if (step.action === "input" && step.target?.selector) {
        xssPayloads.forEach((payload) => {
          testCases.push(
            this.createTestCase(workflow, step.stepNumber, {
              mutationType: "xss_attack",
              description: `XSS 测试: ${payload}`,
              originalValue: step.data?.value,
              mutatedValue: payload,
              expectedBehavior: "应转义或过滤 XSS 脚本",
            }),
          );
        });
      }
    });

    return testCases;
  }

  /**
   * 生成所有错误模式测试
   */
  static generateAll(workflow: SOPWorkflow): DerivedTestCase[] {
    return [
      ...this.generateBoundaryValueTests(workflow),
      ...this.generateInvalidInputTests(workflow),
      ...this.generateMissingFieldTests(workflow),
      ...this.generateSQLInjectionTests(workflow),
      ...this.generateXSSTests(workflow),
    ];
  }

  /**
   * 创建测试用例
   */
  private static createTestCase(
    workflow: SOPWorkflow,
    stepNumber: number,
    mutation: {
      mutationType: string;
      description: string;
      originalValue: any;
      mutatedValue: any;
      expectedBehavior: string;
    },
  ): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));
    const targetStep = mutatedWorkflow.steps.find(
      (s) => s.stepNumber === stepNumber,
    );

    if (targetStep && targetStep.data) {
      targetStep.data.value = mutation.mutatedValue;
    }

    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "error_pattern",
      strategyLevel: 1,
      mutations: [
        {
          stepNumber,
          mutationType: mutation.mutationType as any,
          originalValue: mutation.originalValue,
          mutatedValue: mutation.mutatedValue,
          expectedBehavior: mutation.expectedBehavior,
        },
      ],
      workflow: mutatedWorkflow,
      expectedOutcome: "failure",
      bugHypothesis: `${mutation.mutationType} 错误模式可能导致验证失败`,
      critique: {
        phaseId: "derive",
        timestamp: new Date().toISOString(),
        confidence: {
          overall: 0.9,
          dimensions: {
            completeness: 1,
            accuracy: 0.9,
            feasibility: 0.9,
            coverage: 0.8,
          },
          reasoning: "Error pattern based test case",
          humanReviewRequired: false,
        },
        issues: [],
        autoCorrections: [],
      },
    };
  }
}
