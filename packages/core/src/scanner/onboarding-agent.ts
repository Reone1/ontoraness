import Anthropic from "@anthropic-ai/sdk";
import type { ProjectScanResult } from "./project-scanner.js";

export interface OnboardingDraft {
  /** 생성된 온톨로지 파일들 (파일명 → YAML 내용) */
  files: Record<string, string>;
  /** 감지된 프로젝트 요약 */
  summary: string;
}

/**
 * 프로젝트 스캔 결과를 Claude API로 분석해 온톨로지 YAML 초안을 자동 생성한다.
 *
 * - 모델: claude-opus-4-6 (adaptive thinking)
 * - 프롬프트 캐싱: 시스템 프롬프트 고정
 * - 스트리밍: 긴 출력 지원
 */
export async function generateOntologyDraft(
  scanResult: ProjectScanResult,
  apiKey?: string
): Promise<OnboardingDraft> {
  const client = new Anthropic({ apiKey: apiKey ?? process.env["ANTHROPIC_API_KEY"] });

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(scanResult);

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" }, // 시스템 프롬프트 캐싱
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  let fullText = "";
  process.stdout.write("🤖 Claude가 온톨로지 초안을 생성하는 중");

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      process.stdout.write(".");
    }
  }

  process.stdout.write(" 완료!\n\n");

  return parseOnboardingResponse(fullText);
}

/** 시스템 프롬프트 — 캐싱 대상 */
function buildSystemPrompt(): string {
  return `당신은 소프트웨어 프로젝트의 아키텍처와 규칙을 분석해 AI 온톨로지 YAML 파일을 생성하는 전문가입니다.

## 온톨로지 파일 공통 구조 (모든 파일 동일)

\`\`\`yaml
version: "1.0"
kind: [OntologyKind]
metadata:
  id: [고유 ID]
  name: [표시 이름]
  description: [한 줄 설명]
  tier: 1 | 2 | 3   # 1=항상로드, 2=상황별주입, 3=코드강제
  tags: [tag1, tag2]
spec:
  rules:
    - id: [고유 규칙 ID]
      name: [규칙 이름]
      description: [설명]
      severity: error | warning | info
      enforcement: tier1 | tier2 | tier3
      examples:
        valid: [올바른 예시]
        invalid: [잘못된 예시]
  [kind별 추가 필드]
\`\`\`

## Kind 목록

- **ArchitectureOntology**: 레이어 구조, 의존성 규칙. spec에 layers[], patterns[], constraints[] 추가
- **DomainOntology**: 도메인 엔티티, 비즈니스 규칙. spec에 entities[], glossary[], bounded_contexts[] 추가
- **CodeStyleOntology**: 코드 스타일 규칙. spec에 naming{}, limits{}, prohibitions[], requirements[] 추가
- **AgentOntology**: AI 역할과 전역 제약. tier는 반드시 1. spec에 rules[], roles[] 추가
- **WorkflowOntology**: 작업 플로우. spec에 workflows[], checklists{} 추가

## 출력 형식

반드시 아래 형식으로 응답하세요:

\`\`\`
SUMMARY:
[프로젝트 한 줄 요약]

FILE: agents.yml
\`\`\`yaml
[AgentOntology YAML]
\`\`\`

FILE: architecture.yml
\`\`\`yaml
[ArchitectureOntology YAML]
\`\`\`

FILE: code-style.yml
\`\`\`yaml
[CodeStyleOntology YAML]
\`\`\`

FILE: workflows.yml
\`\`\`yaml
[WorkflowOntology YAML]
\`\`\`
\`\`\`

## 중요 규칙

1. agents.yml의 metadata.tier는 반드시 1
2. 각 파일의 spec.rules는 항상 배열 (비어있어도 rules: [])
3. 감지된 기술 스택에 맞는 실제 규칙 작성 (TypeScript면 any 금지 등)
4. 도메인 정보가 부족하면 domain.yml은 생략
5. YAML 형식 엄수 (들여쓰기 2칸)`;
}

/** 사용자 메시지 — 스캔 결과 기반 */
function buildUserMessage(scan: ProjectScanResult): string {
  const lines = [
    "다음 프로젝트 스캔 결과를 분석해 온톨로지 초안을 생성해주세요:",
    "",
    `**언어**: ${scan.stack.language}`,
    scan.stack.runtime ? `**런타임**: ${scan.stack.runtime}` : "",
    scan.stack.frameworks.length > 0
      ? `**프레임워크**: ${scan.stack.frameworks.join(", ")}`
      : "",
    scan.stack.testFramework ? `**테스트**: ${scan.stack.testFramework}` : "",
    scan.stack.styling ? `**스타일링**: ${scan.stack.styling}` : "",
    "",
    `**아키텍처 패턴**: ${scan.architecture.pattern}`,
    `**최상위 디렉토리**: ${scan.architecture.topLevelDirs.join(", ")}`,
    scan.architecture.srcDir ? `**소스 디렉토리**: ${scan.architecture.srcDir}/` : "",
    `**테스트 존재**: ${scan.architecture.hasTests}`,
    "",
    `**패키지 매니저**: ${scan.tools.packageManager}`,
    scan.tools.ci !== "none" ? `**CI**: ${scan.tools.ci}` : "",
    scan.tools.issueTracker !== "none"
      ? `**이슈 트래커**: ${scan.tools.issueTracker}`
      : "",
  ].filter(Boolean);

  if (scan.packageJson) {
    const pkg = scan.packageJson;
    const name = pkg["name"] as string | undefined;
    const description = pkg["description"] as string | undefined;
    if (name) lines.push(`\n**패키지명**: ${name}`);
    if (description) lines.push(`**설명**: ${description}`);
  }

  if (scan.existingAiConfig.hasClaudeMd) {
    lines.push("\n기존 CLAUDE.md 파일이 발견되었습니다. 이를 참고해 온톨로지를 구성하세요.");
  }

  return lines.join("\n");
}

/** Claude 응답 파싱 → 파일별 YAML 추출 */
function parseOnboardingResponse(text: string): OnboardingDraft {
  const files: Record<string, string> = {};
  let summary = "";

  // SUMMARY 추출
  const summaryMatch = text.match(/SUMMARY:\s*\n([^\n]+)/);
  if (summaryMatch?.[1]) {
    summary = summaryMatch[1].trim();
  }

  // FILE: xxx.yml 블록 추출
  const filePattern = /FILE:\s*(\S+\.yml)\s*\n```yaml\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = filePattern.exec(text)) !== null) {
    const filename = match[1];
    const content = match[2];
    if (filename && content) {
      files[filename] = content.trim();
    }
  }

  return { files, summary };
}
