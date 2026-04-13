import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import yaml from "js-yaml";

/** harness.config.yml에서 읽어오는 컨텍스트 주입 매핑 */
interface HarnessConfig {
  output?: {
    claude_md?: string;
    docs_dir?: string;
  };
  context_injection?: Record<string, string[]>;
}

/**
 * 변경된 파일 경로를 분석해 관련 docs/*.md 내용을 stdout으로 출력한다.
 * PostToolUse 훅 스크립트에서 호출된다.
 *
 * 출력된 내용은 Claude Code가 자동으로 다음 컨텍스트에 주입한다.
 */
export async function injectContext(
  toolInput: string | undefined,
  rootDir: string = "."
): Promise<void> {
  if (!toolInput) return;

  let filePath: string | undefined;

  // TOOL_INPUT JSON에서 파일 경로 추출
  try {
    const input = JSON.parse(toolInput) as Record<string, unknown>;
    filePath =
      (input["path"] as string) ??
      (input["file_path"] as string) ??
      (input["target_file"] as string);
  } catch {
    return;
  }

  if (!filePath) return;

  // 온톨로지 파일 변경 시 재컴파일 신호만 출력하고 종료
  if (filePath.includes(".ontoraness/ontology")) {
    process.stdout.write(
      "\n[ontoraness] 온톨로지 변경 감지 → `ontoraness generate` 를 실행해 docs를 갱신하세요.\n"
    );
    return;
  }

  const config = await loadHarnessConfig(rootDir);
  const docsDir = config.output?.docs_dir ?? ".ontoraness/docs";
  const injectionMap = config.context_injection ?? defaultInjectionMap();

  // 경로 매핑에서 관련 doc ID 목록 찾기
  const relPath = relative(rootDir, filePath);
  const docIds = resolveDocIds(relPath, injectionMap);

  if (docIds.length === 0) return;

  // 관련 docs 읽어서 출력
  const sections: string[] = [];
  for (const docId of docIds) {
    const docPath = join(rootDir, docsDir, `${docId}.md`);
    if (!existsSync(docPath)) continue;

    try {
      const content = await readFile(docPath, "utf-8");
      // 생성 마커 제거
      const cleaned = content.replace(/<!--.*?-->\n?/gs, "").trim();
      sections.push(cleaned);
    } catch {
      // 읽기 실패 시 무시
    }
  }

  if (sections.length === 0) return;

  // Claude Code에 주입될 컨텍스트 출력
  process.stdout.write(
    `\n[ontoraness] 관련 규칙 로드 (${docIds.join(", ")}):\n\n` +
    sections.join("\n\n---\n\n") +
    "\n"
  );
}

/**
 * Tier3 규칙 위반 여부를 검사한다.
 * PreToolUse 훅에서 호출되며, 위반 시 exit(1)로 파일 작성을 차단한다.
 */
export async function checkViolation(
  toolInput: string | undefined,
  rootDir: string = "."
): Promise<void> {
  if (!toolInput) return;

  let filePath: string | undefined;
  let newContent: string | undefined;

  try {
    const input = JSON.parse(toolInput) as Record<string, unknown>;
    filePath =
      (input["path"] as string) ??
      (input["file_path"] as string) ??
      (input["target_file"] as string);
    newContent =
      (input["content"] as string) ??
      (input["new_content"] as string) ??
      (input["new_string"] as string);
  } catch {
    return;
  }

  if (!filePath) return;

  // 온톨로지 파일 자체는 검사 대상 제외
  if (filePath.includes(".ontoraness")) return;

  const violations: string[] = [];

  // 파일 확장자 기반 빠른 필터
  const ext = extname(filePath);
  const isCode = [".ts", ".tsx", ".js", ".jsx", ".py", ".go"].includes(ext);
  if (!isCode || !newContent) return;

  // 기본 Tier3 규칙 검사 (온톨로지 없어도 동작하는 내장 규칙)
  const builtinChecks: Array<{ pattern: RegExp; message: string; id: string }> = [
    {
      id: "no-hardcoded-secrets",
      pattern: /(?:api[_-]?key|secret|password|token)\s*=\s*["'][^"']{8,}["']/i,
      message: "하드코딩된 시크릿 감지. 환경변수를 사용하세요.",
    },
  ];

  for (const check of builtinChecks) {
    if (check.pattern.test(newContent)) {
      violations.push(`[${check.id}] ${check.message}`);
    }
  }

  // 온톨로지 Tier3 규칙 추가 검사
  const tier3Rules = await loadTier3Rules(rootDir);
  for (const rule of tier3Rules) {
    if (rule.pattern && rule.pattern.test(newContent)) {
      violations.push(`[${rule.id}] ${rule.message}`);
    }
  }

  if (violations.length > 0) {
    process.stderr.write(
      `\n[ontoraness] ❌ Tier3 규칙 위반 감지:\n` +
      violations.map((v) => `  - ${v}`).join("\n") +
      "\n파일 작성이 차단되었습니다. 위반을 수정 후 다시 시도하세요.\n"
    );
    process.exit(1);
  }
}

/** harness.config.yml 로드 */
async function loadHarnessConfig(rootDir: string): Promise<HarnessConfig> {
  const configPath = join(rootDir, ".ontoraness/harness.config.yml");
  if (!existsSync(configPath)) return {};

  try {
    const raw = await readFile(configPath, "utf-8");
    return (yaml.load(raw) as HarnessConfig) ?? {};
  } catch {
    return {};
  }
}

/** 기본 경로 → doc ID 매핑 */
function defaultInjectionMap(): Record<string, string[]> {
  return {
    "src/components/**": ["architecture", "code-style"],
    "src/pages/**": ["architecture", "code-style"],
    "src/app/**": ["architecture", "code-style"],
    "src/domain/**": ["domain", "architecture"],
    "src/entities/**": ["domain"],
    "src/services/**": ["architecture", "workflows"],
    "src/usecases/**": ["architecture", "workflows"],
    "src/repositories/**": ["architecture"],
    "src/**/*.test.ts": ["workflows"],
    "src/**/*.spec.ts": ["workflows"],
    "*.ts": ["code-style"],
    "*.tsx": ["code-style"],
  };
}

/** glob 패턴과 파일 경로를 매칭해 doc ID 목록 반환 */
function resolveDocIds(
  filePath: string,
  injectionMap: Record<string, string[]>
): string[] {
  const matched = new Set<string>();

  for (const [pattern, docIds] of Object.entries(injectionMap)) {
    if (matchGlob(pattern, filePath)) {
      docIds.forEach((id) => matched.add(id));
    }
  }

  return [...matched];
}

/** 단순 glob 매칭 (** 와 * 지원) */
function matchGlob(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "§DOUBLE§")
    .replace(/\*/g, "[^/]*")
    .replace(/§DOUBLE§/g, ".*");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filePath);
}

/** 온톨로지에서 Tier3 규칙 로드 */
async function loadTier3Rules(
  rootDir: string
): Promise<Array<{ id: string; pattern: RegExp | undefined; message: string }>> {
  // 컴파일된 온톨로지에서 Tier3 규칙을 읽어오는 것이 이상적이나,
  // 훅 스크립트는 경량 실행을 위해 코드 스타일 온톨로지만 파싱
  const stylePath = join(rootDir, ".ontoraness/ontology/code-style.yml");
  if (!existsSync(stylePath)) return [];

  try {
    const raw = await readFile(stylePath, "utf-8");
    const onto = yaml.load(raw) as Record<string, unknown>;
    const spec = onto["spec"] as Record<string, unknown> | undefined;
    const prohibitions = spec?.["prohibitions"] as
      | Array<{ pattern: string; message: string; severity?: string }>
      | undefined;

    if (!prohibitions) return [];

    return prohibitions
      .filter((p) => p.severity === "error")
      .map((p) => ({
        id: `prohibited-pattern`,
        pattern: safeRegex(p.pattern),
        message: p.message,
      }));
  } catch {
    return [];
  }
}

function safeRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
}
