import { ILLMProvider, ProviderConfig } from './ILLMProvider';
import { QwenProvider } from './providers/QwenProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ClaudeProvider } from './providers/ClaudeProvider';
import { LLMProvider } from '../../types/config';

/**
 * LLM 提供商管理器
 * 支持 Qwen (生产) / OpenAI / Claude (实验)
 * 实现 fallback 和 retry 逻辑
 */
export class LLMProviderManager {
  private providers: Map<LLMProvider, ILLMProvider>;
  private primaryProvider: LLMProvider;
  private fallbackProviders: LLMProvider[];

  constructor(
    primaryProvider: LLMProvider,
    configs: Record<LLMProvider, ProviderConfig>,
    fallbackProviders: LLMProvider[] = []
  ) {
    this.primaryProvider = primaryProvider;
    this.fallbackProviders = fallbackProviders;
    this.providers = new Map();

    // 初始化提供商
    for (const [name, config] of Object.entries(configs)) {
      const provider = this.createProvider(name as LLMProvider, config);
      this.providers.set(name as LLMProvider, provider);
    }
  }

  /**
   * 创建提供商实例
   */
  private createProvider(
    name: LLMProvider,
    config: ProviderConfig
  ): ILLMProvider {
    switch (name) {
      case 'qwen':
        return new QwenProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'claude':
        return new ClaudeProvider(config);
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  /**
   * 获取主要提供商
   */
  getPrimaryProvider(): ILLMProvider {
    const provider = this.providers.get(this.primaryProvider);
    if (!provider) {
      throw new Error(`Primary provider ${this.primaryProvider} not found`);
    }
    return provider;
  }

  /**
   * 获取指定提供商
   */
  getProvider(name: LLMProvider): ILLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    return provider;
  }

  /**
   * 使用 fallback 策略调用 LLM
   */
  async invokeWithFallback(
    messages: import('@langchain/core/messages').BaseMessage[]
  ): Promise<{ response: string; usedProvider: LLMProvider }> {
    const providersToTry = [this.primaryProvider, ...this.fallbackProviders];
    let lastError: Error | null = null;

    for (const providerName of providersToTry) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        const response = await this.retryWithBackoff(
          () => provider.invoke(messages),
          providerName
        );
        return { response, usedProvider: providerName };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Provider ${providerName} failed: ${(error as Error).message}`
        );
        // 继续尝试下一个提供商
      }
    }

    throw new Error(
      `All LLM providers failed. Last error: ${lastError?.message}`
    );
  }

  /**
   * 使用指数退避重试
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    providerName: LLMProvider,
    maxAttempts: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw error;
        }

        // 指数退避
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000; // 0-1s 随机抖动
        const waitTime = delay + jitter;

        console.log(
          `Attempt ${attempt} failed for ${providerName}. Retrying in ${Math.round(waitTime)}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }

  /**
   * 切换主要提供商
   */
  setPrimaryProvider(name: LLMProvider): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not found`);
    }
    this.primaryProvider = name;
  }

  /**
   * 获取所有可用提供商名称
   */
  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }
}
