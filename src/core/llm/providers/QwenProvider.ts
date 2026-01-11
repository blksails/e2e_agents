import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ILLMProvider, ProviderConfig } from '../ILLMProvider';

/**
 * Qwen 提供商（生产环境）
 * 使用 OpenAI 兼容 API
 */
export class QwenProvider implements ILLMProvider {
  name = 'qwen';
  model: string;
  private chatModel: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.model = config.model;

    this.chatModel = new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      timeout: config.timeout ?? 30000,
      configuration: {
        baseURL: config.baseUrl ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
    });
  }

  async invoke(messages: BaseMessage[]): Promise<string> {
    const response = await this.chatModel.invoke(messages);
    return response.content.toString();
  }

  async *stream(messages: BaseMessage[]): AsyncIterable<string> {
    const stream = await this.chatModel.stream(messages);

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString();
      }
    }
  }

  getChatModel(): BaseChatModel {
    return this.chatModel;
  }
}
