import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";

export interface ImportResult {
  /** 파일명 → YAML 내용 (수동 검토 후 저장) */
  files: Record<string, string>;
  /** 발견된 원본 파일 목록 */
  sourceFiles: string[];
  /** 임포트 경고 메시지 */
  warnings: string[];
}

/**
 * 기존 CLAUDE.md / .claude/memory/*.md 파일을 읽어
 * 온톨로지 YAML 초안으로 역변환한다.
 *
 * 완전한 자동 변환은 불가능하므로 사용자 검토가 필요한 초안을 생성한다.
 */
export async function importFromClaudeCode(
  rootDir: string = "."
): Promise<ImportResult> {
  const result: ImportResult = {
    files: {},
    sourceFiles: [],
    warnings: [],
  };

  // 1. CLAUDE.md 읽기
  const claudeMdPath = join(rootDir, "CLAUDE.md");
  let claudeMdContent: string | undefined;

  if (existsSync(claudeMdPath)) {
    claudeMdContent = await readFile(claudeMdPath, "utf-8");
    result.sourceFiles.push("CLAUDE.md");
  }

  // 2. .claude/memory/*.md 읽기
  const memoryDir = join(rootDir, ".claude/memory");
  const memoryFiles: Record<string, string> = {};

  if (existsSync(memoryDir)) {
    const entries = await readdir(memoryDir);
    for (const entry of entries) {
      if (extname(entry) === ".md") {
        const content = await readFile(join(memoryDir, entry), "utf-8");
        memoryFiles[entry] = content;
        result.sourceFiles.push(`.claude/memory/${entry}`);
      }
    }
  }

  if (result.sourceFiles.length === 0) {
    result.warnings.push("CLAUDE.md와 .claude/memory/ 파일을 찾을 수 없습니다.");
    return result;
  }

  // 3. 규칙 추출 및 온톨로지 파일 생성
  result.files["agents.yml"] = generateAgentsYaml(claudeMdContent, memoryFiles);
  result.files["architecture.yml"] = generateArchitectureYaml(claudeMdContent, memoryFiles);
  result.files["code-style.yml"] = generateCodeStyleYaml(claudeMdContent, memoryFiles);
  result.files["workflows.yml"] = generateWorkflowsYaml(claudeMdContent, memoryFiles);

  result.warnings.push(
    "자동 변환은 완벽하지 않습니다. 생성된 파일을 반드시 검토하고 수정하세요.",
    "도메인 모델(domain.yml)은 자동 생성되지 않습니다. 직접 작성하거나 OnboardingAgent를 사용하세요."
  );

  return result;
}

/** AgentOntology 생성 — 전역 제약 추출 */
function generateAgentsYaml(
  claudeMd: string | undefined,
  memory: Record<string, string>
): string {
  const neverItems = extractListItems(claudeMd ?? "", [
    "절대 금지",
    "NEVER",
    "금지",
    "하지 말",
  ]);
  const alwaysItems = extractListItems(claudeMd ?? "", [
    "항상",
    "ALWAYS",
    "반드시",
    "필수",
  ]);

  const rules = [
    ...neverItems.map((item, i) => `  - id: never-rule-${i + 1}
    name: "${truncate(item, 40)}"
    description: "${escapeYaml(item)}"
    severity: error
    enforcement: tier1
    tags: ["never"]`),
    ...alwaysItems.map((item, i) => `  - id: always-rule-${i + 1}
    name: "${truncate(item, 40)}"
    description: "${escapeYaml(item)}"
    severity: warning
    enforcement: tier1
    tags: ["always"]`),
  ];

  return `version: "1.0"
kind: AgentOntology
metadata:
  id: agents
  name: "에이전트 제약"
  description: "AI 역할 정의 및 전역 제약 (기존 설정에서 마이그레이션)"
  tier: 1
  tags: ["agent", "constraints"]
spec:
  rules:
${rules.length > 0 ? rules.join("\n") : "    [] # TODO: 규칙을 직접 추가하세요"}
`;
}

/** ArchitectureOntology 생성 — 아키텍처 패턴 추출 */
function generateArchitectureYaml(
  claudeMd: string | undefined,
  memory: Record<string, string>
): string {
  const projectRules = memory["PROJECT_RULES.md"] ?? memory["project-rules.md"] ?? "";
  const combined = (claudeMd ?? "") + "\n" + projectRules;

  // 레이어 키워드 감지
  const hasCleanArch =
    /presentation|application|domain|infrastructure/i.test(combined);
  const layersSection = hasCleanArch
    ? `  layers:
    - name: presentation
      path_pattern: "src/{components,pages,app}/**"
      can_import_from: [application]
      cannot_import_from: [infrastructure, domain]
    - name: application
      path_pattern: "src/{services,usecases}/**"
      can_import_from: [domain]
      cannot_import_from: [presentation, infrastructure]
    - name: domain
      path_pattern: "src/{entities,models,domain}/**"
      can_import_from: []
    - name: infrastructure
      path_pattern: "src/{repositories,adapters,db}/**"
      can_import_from: [domain, application]`
    : `  # layers: # TODO: 레이어 구조를 정의하세요`;

  const archRules = extractListItems(combined, [
    "아키텍처",
    "레이어",
    "의존성",
    "순환",
    "architecture",
    "layer",
  ]);

  const rules = archRules.slice(0, 5).map((item, i) => `  - id: arch-rule-${i + 1}
    name: "${truncate(item, 40)}"
    description: "${escapeYaml(item)}"
    severity: error
    enforcement: tier2`);

  return `version: "1.0"
kind: ArchitectureOntology
metadata:
  id: architecture
  name: "아키텍처 규칙"
  description: "레이어 구조와 의존성 규칙 (기존 설정에서 마이그레이션)"
  tier: 2
  tags: ["architecture", "layer"]
spec:
  rules:
${rules.length > 0 ? rules.join("\n") : "    [] # TODO: 아키텍처 규칙을 추가하세요"}
${layersSection}
`;
}

/** CodeStyleOntology 생성 — 코드 스타일 규칙 추출 */
function generateCodeStyleYaml(
  claudeMd: string | undefined,
  memory: Record<string, string>
): string {
  const codeStyle = memory["CODE_STYLE.md"] ?? memory["code-style.md"] ?? "";
  const techStack = memory["TECH_STACK.md"] ?? "";
  const combined = (claudeMd ?? "") + "\n" + codeStyle + "\n" + techStack;

  // 파일 크기 제한 감지
  const lineLimit = extractNumber(combined, /(\d+)\s*줄|lines?/i) ?? 500;
  // 함수 크기 제한
  const funcLimit = extractNumber(combined, /함수.{0,20}(\d+)\s*줄/i) ?? 50;

  // 금지 패턴
  const prohibitions = [];
  if (/any\s*타입|no.*any/i.test(combined)) {
    prohibitions.push(`  - pattern: "\\\\bany\\\\b"
    severity: error
    message: "any 타입 사용 금지. unknown 또는 명시적 타입 사용"`);
  }
  if (/console\.log|console 금지/i.test(combined)) {
    prohibitions.push(`  - pattern: "console\\\\.log"
    severity: error
    message: "프로덕션 코드에 console.log 금지"
    context: "production"`);
  }

  return `version: "1.0"
kind: CodeStyleOntology
metadata:
  id: code-style
  name: "코드 스타일"
  description: "코드 작성 규칙과 제약 (기존 설정에서 마이그레이션)"
  tier: 2
  tags: ["code-style", "quality"]
spec:
  rules: []
  naming:
    files: kebab-case    # TODO: 확인 필요
    classes: PascalCase
    functions: camelCase
    constants: UPPER_SNAKE_CASE
  limits:
    file_lines_max: ${lineLimit}
    function_lines_max: ${funcLimit}
${prohibitions.length > 0
    ? `  prohibitions:\n${prohibitions.join("\n")}`
    : "  # prohibitions: # TODO: 금지 패턴을 추가하세요"}
`;
}

/** WorkflowOntology 생성 — 작업 플로우 추출 */
function generateWorkflowsYaml(
  claudeMd: string | undefined,
  memory: Record<string, string>
): string {
  const context = memory["CURRENT_CONTEXT.md"] ?? "";
  const hasDevWorkflow = /dev.*plan|dev.*build|기능.*구현/i.test(claudeMd ?? "");

  const workflows = hasDevWorkflow
    ? `  workflows:
    - name: "기능 개발"
      steps:
        - "요구사항 분석 및 도메인 모델 확인"
        - "영향받는 레이어 식별"
        - "인터페이스 먼저 정의"
        - "구현 및 유닛 테스트 작성"
        - "통합 테스트 확인"
        - "코드 리뷰 체크리스트 자체 검토"
    - name: "버그 수정"
      steps:
        - "재현 조건 파악"
        - "원인 분석 (로그, 테스트)"
        - "최소한의 변경으로 수정"
        - "회귀 테스트 추가"`
    : `  # workflows: # TODO: 작업 플로우를 추가하세요`;

  return `version: "1.0"
kind: WorkflowOntology
metadata:
  id: workflows
  name: "작업 플로우"
  description: "개발 작업 단계와 체크리스트 (기존 설정에서 마이그레이션)"
  tier: 2
  tags: ["workflow", "process"]
spec:
  rules: []
${workflows}
  checklists:
    pre-commit:
      - "파일 크기 제한 준수"
      - "금지 패턴 없음"
      - "테스트 통과"
`;
}

// ── 유틸리티 ────────────────────────────────────────────────

/** 텍스트에서 특정 키워드 다음의 목록 항목을 추출 */
function extractListItems(text: string, keywords: string[]): string[] {
  const items: string[] = [];
  const lines = text.split("\n");

  let capturing = false;
  for (const line of lines) {
    const lower = line.toLowerCase();

    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      capturing = true;
      continue;
    }

    if (capturing) {
      const match = line.match(/^[\s-*•]\s*(.+)/);
      if (match?.[1]) {
        items.push(match[1].trim());
      } else if (line.match(/^#+\s/) || line.trim() === "") {
        if (items.length > 0) capturing = false;
      }
    }
  }

  return items.slice(0, 10); // 최대 10개
}

function extractNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match) return undefined;
  const num = parseInt(match[1] ?? "", 10);
  return isNaN(num) ? undefined : num;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, " ").trim();
}
