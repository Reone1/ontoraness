/** 서브 에이전트가 수행할 수 있는 작업 타입 */
export type AgentTask =
  | "code-review"   // 코드 리뷰 second opinion
  | "analyze"       // 대용량 문서/코드베이스 분석
  | "summarize"     // 긴 문서 요약
  | "translate"     // 번역
  | "custom";       // 사용자 정의 프롬프트

/** 서브 에이전트 실행 입력 */
export interface AgentInput {
  task: AgentTask;
  /** 분석/리뷰 대상 텍스트 또는 파일 내용 */
  content: string;
  /** 파일 경로 (컨텍스트용) */
  filePath?: string;
  /** 추가 지시사항 */
  instructions?: string;
  /** 온톨로지에서 가져온 프로젝트 컨텍스트 */
  projectContext: string | undefined;
}

/** 서브 에이전트 실행 결과 */
export interface AgentOutput {
  /** 에이전트 이름 (gpt, gemini 등) */
  agent: string;
  /** 작업 타입 */
  task: AgentTask;
  /** 결과 텍스트 */
  result: string;
  /** 사용된 토큰 수 (가능한 경우) */
  tokens_used: number | undefined;
  /** 실행 시간 (ms) */
  elapsed_ms: number;
}

/** 서브 에이전트 설정 */
export interface AgentConfig {
  /** 에이전트 식별자 */
  name: string;
  /** 표시 이름 */
  display_name: string;
  /** 주요 역할 설명 */
  role: string;
  /** API 키 환경변수 이름 */
  api_key_env: string;
  /** 기본 모델 */
  default_model?: string;
}

/** 서브 에이전트 인터페이스 */
export interface SubAgent {
  readonly config: AgentConfig;

  /** API 키 유효성 확인 */
  isAvailable(): boolean;

  /** 작업 실행 */
  run(input: AgentInput): Promise<AgentOutput>;
}

/** 작업별 시스템 프롬프트 생성 */
export function buildSystemPrompt(
  task: AgentTask,
  projectContext?: string
): string {
  const baseContext = projectContext
    ? `\n\n## 프로젝트 컨텍스트\n${projectContext}`
    : "";

  switch (task) {
    case "code-review":
      return `당신은 시니어 소프트웨어 엔지니어입니다. 제공된 코드를 리뷰해 다음을 분석하세요:
1. 잠재적 버그와 논리적 오류
2. 성능 문제
3. 보안 취약점
4. 코드 품질과 가독성
5. 아키텍처 패턴 준수 여부

각 항목에 대해 구체적인 코드 위치와 개선 방안을 제시하세요.${baseContext}`;

    case "analyze":
      return `당신은 소프트웨어 아키텍트입니다. 제공된 코드베이스/문서를 분석해 다음을 파악하세요:
1. 전체 구조와 패턴
2. 핵심 컴포넌트와 역할
3. 의존성 관계
4. 잠재적 문제점
5. 개선 가능한 영역

명확하고 구조화된 분석을 제공하세요.${baseContext}`;

    case "summarize":
      return `제공된 문서를 간결하게 요약하세요. 핵심 내용, 주요 결정 사항, 액션 아이템을 포함해야 합니다.${baseContext}`;

    case "translate":
      return `제공된 텍스트를 한국어로 번역하세요. 기술 용어는 원문을 병기하세요.${baseContext}`;

    case "custom":
      return `당신은 소프트웨어 개발 전문가입니다.${baseContext}`;
  }
}

/** 작업별 사용자 프롬프트 생성 */
export function buildUserPrompt(input: AgentInput): string {
  const fileInfo = input.filePath ? `파일: ${input.filePath}\n\n` : "";
  const instructions = input.instructions
    ? `\n\n추가 지시사항: ${input.instructions}`
    : "";

  return `${fileInfo}${input.content}${instructions}`;
}
