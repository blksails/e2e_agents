import { SOPWorkflow, DerivedTestCase, SOPStep } from "../../../types/schemas";
import * as crypto from "crypto";

/**
 * Level 2: 变异引擎
 * 通过随机变异现有流程生成测试用例
 */
export class MutationEngine {
  /**
   * 随机化步骤顺序
   */
  static mutateStepOrder(workflow: SOPWorkflow): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));

    // 随机打乱步骤顺序
    const steps = [...mutatedWorkflow.steps];
    for (let i = steps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = steps[i]!;
      steps[i] = steps[j]!;
      steps[j] = temp;
    }

    // 重新编号
    steps.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    mutatedWorkflow.steps = steps;

    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "mutation",
      strategyLevel: 2,
      mutations: [
        {
          stepNumber: 0,
          mutationType: "wrong_order",
          originalValue: "original step order",
          mutatedValue: "randomized step order",
          expectedBehavior: "可能失败或产生意外结果",
        },
      ],
      workflow: mutatedWorkflow,
      expectedOutcome: "failure",
      bugHypothesis: "步骤顺序错误导致依赖关系破坏",
      critique: this.createCritique(),
    };
  }

  /**
   * 跳过随机步骤
   */
  static mutateSkipSteps(
    workflow: SOPWorkflow,
    skipCount: number = 1,
  ): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));

    // 随机选择要跳过的步骤
    const skipIndices = new Set<number>();
    while (
      skipIndices.size < skipCount &&
      skipIndices.size < workflow.steps.length
    ) {
      const randomIndex = Math.floor(Math.random() * workflow.steps.length);
      skipIndices.add(randomIndex);
    }

    const skipStepNumbers = Array.from(skipIndices).map((idx) => idx + 1);

    // 移除选中的步骤
    mutatedWorkflow.steps = mutatedWorkflow.steps.filter(
      (_, index) => !skipIndices.has(index),
    );

    // 重新编号
    mutatedWorkflow.steps.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "mutation",
      strategyLevel: 2,
      mutations: [
        {
          stepNumber: Array.from(skipIndices)[0] ?? 0 + 1,
          mutationType: "missing_field",
          originalValue: "complete workflow",
          mutatedValue: `skipped ${skipCount} steps`,
          expectedBehavior: "可能失败或跳过关键步骤",
        },
      ],
      workflow: mutatedWorkflow,
      expectedOutcome: "failure",
      bugHypothesis: `跳过步骤 ${skipStepNumbers.join(", ")} 导致流程不完整`,
      critique: this.createCritique(),
    };
  }

  /**
   * 重复步骤
   */
  static mutateDuplicateSteps(workflow: SOPWorkflow): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));

    if (mutatedWorkflow.steps.length === 0) {
      return this.createEmptyTestCase(workflow);
    }

    // 随机选择一个步骤并重复
    const randomIndex = Math.floor(
      Math.random() * mutatedWorkflow.steps.length,
    );
    const stepToDuplicate = JSON.parse(
      JSON.stringify(mutatedWorkflow.steps[randomIndex]),
    );
    const duplicateStepNumber = randomIndex + 1;

    // 插入重复步骤
    mutatedWorkflow.steps.splice(randomIndex + 1, 0, stepToDuplicate);

    // 重新编号
    mutatedWorkflow.steps.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "mutation",
      strategyLevel: 2,
      mutations: [
        {
          stepNumber: randomIndex + 1,
          mutationType: "other",
          originalValue: "single execution",
          mutatedValue: "duplicated execution",
          expectedBehavior: "可能产生重复提交或错误",
        },
      ],
      workflow: mutatedWorkflow,
      expectedOutcome: "failure",
      bugHypothesis: `重复执行步骤 ${duplicateStepNumber} 可能导致副作用`,
      critique: this.createCritique(),
    };
  }

  /**
   * 添加随机延迟
   */
  static mutateAddDelays(workflow: SOPWorkflow): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));

    // 在随机位置插入等待步骤
    const delayStep: SOPStep = {
      stepNumber: 0,
      action: "wait",
      description: "Random delay",
      validation: {
        type: "custom",
        expected: true,
        timeout: Math.floor(Math.random() * 5000) + 1000, // 1-6秒
      },
    };

    const insertIndex = Math.floor(
      Math.random() * (mutatedWorkflow.steps.length + 1),
    );
    mutatedWorkflow.steps.splice(insertIndex, 0, delayStep);

    // 重新编号
    mutatedWorkflow.steps.forEach((step, index) => {
      step.stepNumber = index + 1;
    });

    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "mutation",
      strategyLevel: 2,
      mutations: [
        {
          stepNumber: insertIndex + 1,
          mutationType: "timing_delay",
          originalValue: "no delay",
          mutatedValue: `${delayStep.validation?.timeout}ms delay`,
          expectedBehavior: "测试超时处理",
        },
      ],
      workflow: mutatedWorkflow,
      expectedOutcome: "failure",
      bugHypothesis: "添加延迟可能暴露竞态条件或超时问题",
      critique: this.createCritique(),
    };
  }

  /**
   * 修改元素选择器
   */
  static mutateSelectorChange(workflow: SOPWorkflow): DerivedTestCase {
    const mutatedWorkflow: SOPWorkflow = JSON.parse(JSON.stringify(workflow));

    // 查找有选择器的步骤
    const stepsWithSelectors = mutatedWorkflow.steps.filter(
      (s) => s.target?.selector,
    );

    if (stepsWithSelectors.length > 0) {
      const randomStep =
        stepsWithSelectors[
          Math.floor(Math.random() * stepsWithSelectors.length)
        ];

      if (!randomStep) {
        return this.createEmptyTestCase(workflow);
      }

      const originalSelector = randomStep.target?.selector ?? "";

      // 修改选择器（添加后缀使其无效）
      if (randomStep.target) {
        randomStep.target.selector = originalSelector + "-invalid";
      }

      return {
        id: crypto.randomUUID(),
        sourceWorkflowId: workflow.id,
        timestamp: new Date().toISOString(),
        strategy: "mutation",
        strategyLevel: 2,
        mutations: [
          {
            stepNumber: randomStep.stepNumber,
            mutationType: "selector_change",
            originalValue: originalSelector,
            mutatedValue: randomStep.target?.selector,
            expectedBehavior: "元素未找到错误",
          },
        ],
        workflow: mutatedWorkflow,
        expectedOutcome: "failure",
        bugHypothesis: "选择器不匹配导致元素无法定位",
        critique: this.createCritique(),
      };
    }

    return this.createEmptyTestCase(workflow);
  }

  /**
   * 生成所有变异测试
   */
  static generateAll(
    workflow: SOPWorkflow,
    count: number = 5,
  ): DerivedTestCase[] {
    const mutations = [
      () => this.mutateStepOrder(workflow),
      () => this.mutateSkipSteps(workflow, 1),
      () => this.mutateSkipSteps(workflow, 2),
      () => this.mutateDuplicateSteps(workflow),
      () => this.mutateAddDelays(workflow),
      () => this.mutateSelectorChange(workflow),
    ];

    const testCases: DerivedTestCase[] = [];

    for (let i = 0; i < count && i < mutations.length; i++) {
      try {
        const mutationFn = mutations[i];
        if (mutationFn) {
          testCases.push(mutationFn());
        }
      } catch (error) {
        console.warn("Mutation generation failed:", error);
      }
    }

    return testCases;
  }

  /**
   * 创建默认 critique
   */
  private static createCritique() {
    return {
      phaseId: "derive" as const,
      timestamp: new Date().toISOString(),
      confidence: {
        overall: 0.7,
        dimensions: {
          completeness: 0.8,
          accuracy: 0.7,
          feasibility: 0.8,
          coverage: 0.6,
        },
        reasoning: "Mutation-based test case",
        humanReviewRequired: false,
      },
      issues: [],
      autoCorrections: [],
    };
  }

  /**
   * 创建空测试用例（当变异失败时）
   */
  private static createEmptyTestCase(workflow: SOPWorkflow): DerivedTestCase {
    return {
      id: crypto.randomUUID(),
      sourceWorkflowId: workflow.id,
      timestamp: new Date().toISOString(),
      strategy: "mutation",
      strategyLevel: 2,
      mutations: [],
      workflow,
      expectedOutcome: "success",
      bugHypothesis: "空变异测试用例",
      critique: this.createCritique(),
    };
  }
}
