import type {
  SubAgent,
  AgentConfig,
  AgentInput,
  AgentOutput,
} from "./base.agent.js";
import { buildSystemPrompt, buildUserPrompt } from "./base.agent.js";

const DEFAULT_MODEL = "gemini-1.5-pro";
const API_KEY_ENV = "GEMINI_API_KEY";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    totalTokenCount: number;
  };
}

/**
 * Google Gemini 서브 에이전트.
 * 1M 컨텍스트 윈도우를 활용한 대용량 코드베이스/문서 분석이 주요 역할.
 * fetch를 직접 사용해 Google Generative AI REST API를 호출한다.
 */
export class GeminiAgent implements SubAgent {
  readonly config: AgentConfig;
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
    this.config = {
      name: "gemini",
      display_name: "Gemini (Google)",
      role: "대용량 코드베이스/문서 분석 (1M 컨텍스트), 전체 프로젝트 구조 파악",
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

    // Gemini는 system instruction을 별도 필드로 처리
    const systemInstruction = buildSystemPrompt(input.task, input.projectContext);
    const userContent = buildUserPrompt(input);

    const contents: GeminiContent[] = [
      { role: "user", parts: [{ text: userContent }] },
    ];

    const url = `${API_BASE}/${this.model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.2, // 분석 작업은 일관성 중시
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API 오류 (${response.status}): ${error}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const result =
      data.candidates[0]?.content.parts.map((p) => p.text).join("") ?? "";

    return {
      agent: "gemini",
      task: input.task,
      result,
      tokens_used: data.usageMetadata?.totalTokenCount,
      elapsed_ms: Date.now() - startTime,
    };
  }
}
