import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';

/**
 * LLM 提供商接口
 */
export interface ILLMProvider {
  name: string;
  model: string;

  /**
   * 调用 LLM
   */
  invoke(messages: BaseMessage[]): Promise<string>;

  /**
   * 流式调用 LLM
   */
  stream(messages: BaseMessage[]): AsyncIterable<string>;

  /**
   * 获取底层的 ChatModel 实例（用于 LangChain 工具调用）
   */
  getChatModel(): BaseChatModel;
}

/**
 * 提供商配置
 */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}
