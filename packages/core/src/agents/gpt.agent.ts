import type {
  SubAgent,
  AgentConfig,
  AgentInput,
  AgentOutput,
} from "./base.agent.js";
import { buildSystemPrompt, buildUserPrompt } from "./base.agent.js";

const DEFAULT_MODEL = "gpt-4o";
const API_KEY_ENV = "OPENAI_API_KEY";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    total_tokens: number;
  };
}

/**
 * OpenAI GPT 서브 에이전트.
 * 코드 리뷰 second opinion을 주요 역할로 수행한다.
 * fetch를 직접 사용해 외부 의존성 없이 OpenAI REST API를 호출한다.
 */
export class GptAgent implements SubAgent {
  readonly config: AgentConfig;
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.config = {
      name: "gpt",
      display_name: "GPT (OpenAI)",
      role: "코드 리뷰 second opinion, 독립적인 시각으로 버그·보안 취약점 감지",
      api_key_env: API_KEY_ENV,
      default_model: model,
    };
  }

  isAvailable(): boolean {
    return !!process.env[API_KEY_ENV];
  }

  async run(input: AgentInput): Promise<AgentOutput> {
    const apiKey = process.env[API_KEY_ENV];
    if (!apiKey) {
      throw new Error(`${API_KEY_ENV} 환경변수가 설정되지 않았습니다.`);
    }

    const startTime = Date.now();

    const messages: OpenAIMessage[] = [
      {
        role: "system",
        content: buildSystemPrompt(input.task, input.projectContext),
      },
      {
        role: "user",
        content: buildUserPrompt(input),
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 4096,
        temperature: 0.3, // 코드 리뷰는 일관성이 중요
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API 오류 (${response.status}): ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const result = data.choices[0]?.message.content ?? "";

    return {
      agent: "gpt",
      task: input.task,
      result,
      tokens_used: data.usage?.total_tokens,
      elapsed_ms: Date.now() - startTime,
    };
  }
}
