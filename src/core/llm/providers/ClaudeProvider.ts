import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ILLMProvider, ProviderConfig } from "../ILLMProvider";

/**
 * Claude 提供商（实验/开发环境）
 */
export class ClaudeProvider implements ILLMProvider {
  name = "claude";
  model: string;
  private chatModel: ChatAnthropic;

  constructor(config: ProviderConfig) {
    this.model = config.model;

    this.chatModel = new ChatAnthropic({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      // Note: ChatAnthropic doesn't support timeout in constructor
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
