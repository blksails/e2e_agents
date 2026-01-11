import * as dotenv from "dotenv";
import { Config, ConfigSchema } from "../../types/schemas";
import { LLMProvider } from "../../types/config";

// 加载环境变量
dotenv.config();

/**
 * 配置加载器
 */
export class ConfigLoader {
  /**
   * 从环境变量加载配置
   */
  static loadFromEnv(): Config {
    const provider = (process.env.LLM_PROVIDER || "qwen") as LLMProvider;

    const config: Config = {
      llm: {
        provider,
        model: this.getModelForProvider(provider),
        apiKey: this.getApiKeyForProvider(provider),
        baseUrl: this.getBaseUrlForProvider(provider),
        temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "2048"),
      },
      playwright: {
        headless: process.env.PLAYWRIGHT_HEADLESS === "true",
        slowMo: parseInt(process.env.PLAYWRIGHT_SLOW_MO || "0"),
        timeout: parseInt(process.env.PLAYWRIGHT_TIMEOUT || "30000"),
      },
      storage: {
        dataDir: process.env.DATA_DIR || "./data",
      },
      cognitiveQuadrant: {
        mode: (process.env.COGNITIVE_MODE || "autonomous") as any,
        thresholds: {
          autoApprove: parseFloat(process.env.THRESHOLD_AUTO_APPROVE || "0.8"),
          requireReview: parseFloat(
            process.env.THRESHOLD_REQUIRE_REVIEW || "0.6",
          ),
          autoCorrect: parseFloat(process.env.THRESHOLD_AUTO_CORRECT || "0.7"),
        },
        humanInterventionPoints: this.parseInterventionPoints(),
      },
    };

    // 验证配置
    return ConfigSchema.parse(config);
  }

  private static getModelForProvider(provider: LLMProvider): string {
    switch (provider) {
      case "qwen":
        return process.env.QWEN_MODEL || "qwen-turbo";
      case "openai":
        return process.env.OPENAI_MODEL || "gpt-4o";
      case "claude":
        return process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private static getApiKeyForProvider(provider: LLMProvider): string {
    switch (provider) {
      case "qwen":
        return process.env.QWEN_API_KEY || "";
      case "openai":
        return process.env.OPENAI_API_KEY || "";
      case "claude":
        return process.env.ANTHROPIC_API_KEY || "";
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private static getBaseUrlForProvider(
    provider: LLMProvider,
  ): string | undefined {
    if (provider === "qwen") {
      return (
        process.env.QWEN_BASE_URL ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
      );
    }
    return undefined;
  }

  private static parseInterventionPoints(): any[] {
    const pointsStr = process.env.HUMAN_INTERVENTION_POINTS || "";
    if (!pointsStr) {
      return ["on_low_confidence", "on_critical_issue"];
    }
    return pointsStr.split(",").map((p) => p.trim());
  }
}
