export * from './schemas';

/**
 * LLM 提供商类型
 */
export type LLMProvider = 'qwen' | 'openai' | 'claude';

/**
 * 阶段 ID
 */
export type PhaseId = 'scan' | 'interpret' | 'orchestrate' | 'execute' | 'derive';

/**
 * 阶段上下文
 */
export interface PhaseContext<TInput = any, TOutput = any> {
  phaseId: PhaseId;
  input: TInput;
  output?: TOutput;
  critique?: import('./schemas').CritiqueResult;
  timestamp: string;
  error?: Error;
}

/**
 * 工作流状态
 */
export interface WorkflowState {
  sessionId: string;
  currentPhase: PhaseId;
  history: PhaseContext[];
  sharedData: Record<string, any>;
  errors: Error[];
}
