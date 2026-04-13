import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";

/** 스캔 결과 */
export interface ProjectScanResult {
  /** 감지된 기술 스택 */
  stack: DetectedStack;
  /** 폴더 구조에서 추론한 아키텍처 패턴 */
  architecture: DetectedArchitecture;
  /** 외부 도구 감지 결과 */
  tools: DetectedTools;
  /** 기존 AI 설정 파일 */
  existingAiConfig: ExistingAiConfig;
  /** package.json 내용 (있는 경우) */
  packageJson: Record<string, unknown> | undefined;
}

export interface DetectedStack {
  language: "typescript" | "javascript" | "python" | "go" | "unknown";
  runtime: string | undefined;
  frameworks: string[];
  testFramework: string | undefined;
  styling: string | undefined;
}

export interface DetectedArchitecture {
  pattern: "clean" | "feature-based" | "flat" | "unknown";
  topLevelDirs: string[];
  hasTests: boolean;
  srcDir: string | undefined;
}

export interface DetectedTools {
  issueTracker?: "jira" | "linear" | "github" | "none";
  ci?: "github-actions" | "jenkins" | "circleci" | "none";
  packageManager: "pnpm" | "yarn" | "npm" | "bun" | "unknown";
}

export interface ExistingAiConfig {
  hasClaudeMd: boolean;
  hasClaudeMemory: boolean;
  claudeMemoryFiles: string[];
  hasCursorRules: boolean;
}

/**
 * 현재 디렉토리의 프로젝트를 자동으로 스캔한다.
 */
export async function scanProject(rootDir: string = "."): Promise<ProjectScanResult> {
  const [stack, architecture, tools, existingAiConfig, packageJson] =
    await Promise.all([
      detectStack(rootDir),
      detectArchitecture(rootDir),
      detectTools(rootDir),
      detectExistingAiConfig(rootDir),
      readPackageJson(rootDir),
    ]);

  return { stack, architecture, tools, existingAiConfig, packageJson };
}

async function detectStack(rootDir: string): Promise<DetectedStack> {
  const pkg = await readPackageJson(rootDir);
  const frameworks: string[] = [];
  let language: DetectedStack["language"] = "unknown";
  let runtime: string | undefined;
  let testFramework: string | undefined;
  let styling: string | undefined;

  // 언어 감지
  if (
    existsSync(join(rootDir, "tsconfig.json")) ||
    existsSync(join(rootDir, "tsconfig.base.json"))
  ) {
    language = "typescript";
  } else if (
    existsSync(join(rootDir, "package.json"))
  ) {
    language = "javascript";
  } else if (
    existsSync(join(rootDir, "pyproject.toml")) ||
    existsSync(join(rootDir, "requirements.txt"))
  ) {
    language = "python";
  } else if (existsSync(join(rootDir, "go.mod"))) {
    language = "go";
  }

  // 프레임워크 감지 (package.json deps 기반)
  if (pkg) {
    const allDeps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };

    if ("next" in allDeps) frameworks.push("Next.js");
    else if ("react" in allDeps) frameworks.push("React");
    if ("express" in allDeps) frameworks.push("Express");
    if ("fastify" in allDeps) frameworks.push("Fastify");
    if ("@nestjs/core" in allDeps) frameworks.push("NestJS");

    if ("vitest" in allDeps) testFramework = "vitest";
    else if ("jest" in allDeps) testFramework = "jest";

    if ("tailwindcss" in allDeps) styling = "Tailwind CSS";

    // 런타임
    const engines = pkg.engines as Record<string, string> | undefined;
    if (engines?.node) runtime = `Node.js ${engines.node}`;
    else if ("bun" in allDeps || existsSync(join(rootDir, "bun.lockb"))) {
      runtime = "Bun";
    } else if (language === "typescript" || language === "javascript") {
      runtime = "Node.js";
    }
  }

  return { language, runtime, frameworks, testFramework, styling };
}

async function detectArchitecture(rootDir: string): Promise<DetectedArchitecture> {
  let topLevelDirs: string[] = [];
  let pattern: DetectedArchitecture["pattern"] = "unknown";
  let srcDir: string | undefined;
  let hasTests = false;

  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    topLevelDirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => e.name);
  } catch {
    return { pattern: "unknown", topLevelDirs: [], hasTests: false, srcDir: undefined };
  }

  // src 디렉토리 확인
  if (topLevelDirs.includes("src")) {
    srcDir = "src";
    try {
      const srcEntries = await readdir(join(rootDir, "src"), { withFileTypes: true });
      const srcDirs = srcEntries.filter((e) => e.isDirectory()).map((e) => e.name);

      // 클린 아키텍처 패턴 감지
      const cleanMarkers = ["domain", "application", "infrastructure", "presentation"];
      const cleanScore = cleanMarkers.filter((m) => srcDirs.includes(m)).length;
      if (cleanScore >= 2) pattern = "clean";

      // 피처 기반 패턴 감지
      const featureMarkers = ["features", "modules"];
      if (featureMarkers.some((m) => srcDirs.includes(m))) pattern = "feature-based";

      // 테스트 확인
      hasTests = srcDirs.some((d) => d.includes("test") || d.includes("spec")) ||
        topLevelDirs.some((d) => d.includes("test") || d.includes("spec"));
    } catch {
      // src 읽기 실패 시 무시
    }
  } else {
    // flat 구조
    const codeMarkers = ["components", "pages", "routes", "controllers", "models"];
    if (codeMarkers.some((m) => topLevelDirs.includes(m))) pattern = "flat";
    hasTests = topLevelDirs.some((d) => d.includes("test") || d.includes("spec"));
  }

  return { pattern, topLevelDirs, hasTests, srcDir };
}

async function detectTools(rootDir: string): Promise<DetectedTools> {
  let issueTracker: DetectedTools["issueTracker"] = "none";
  let ci: DetectedTools["ci"] = "none";
  let packageManager: DetectedTools["packageManager"] = "unknown";

  // CI 감지
  if (existsSync(join(rootDir, ".github/workflows"))) ci = "github-actions";
  else if (existsSync(join(rootDir, "Jenkinsfile"))) ci = "jenkins";
  else if (existsSync(join(rootDir, ".circleci"))) ci = "circleci";

  // 이슈 트래커 감지
  if (
    existsSync(join(rootDir, ".jira.yml")) ||
    existsSync(join(rootDir, "jira.config.yml"))
  ) {
    issueTracker = "jira";
  } else if (existsSync(join(rootDir, ".linear"))) {
    issueTracker = "linear";
  } else if (ci === "github-actions") {
    issueTracker = "github";
  }

  // 패키지 매니저 감지
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) packageManager = "pnpm";
  else if (existsSync(join(rootDir, "yarn.lock"))) packageManager = "yarn";
  else if (existsSync(join(rootDir, "bun.lockb"))) packageManager = "bun";
  else if (existsSync(join(rootDir, "package-lock.json"))) packageManager = "npm";

  return { issueTracker, ci, packageManager };
}

async function detectExistingAiConfig(rootDir: string): Promise<ExistingAiConfig> {
  const hasClaudeMd = existsSync(join(rootDir, "CLAUDE.md"));
  const claudeMemoryDir = join(rootDir, ".claude/memory");
  const hasClaudeMemory = existsSync(claudeMemoryDir);

  let claudeMemoryFiles: string[] = [];
  if (hasClaudeMemory) {
    try {
      const files = await readdir(claudeMemoryDir);
      claudeMemoryFiles = files.filter((f) => extname(f) === ".md");
    } catch {
      // 무시
    }
  }

  const hasCursorRules = existsSync(join(rootDir, ".cursorrules"));

  return { hasClaudeMd, hasClaudeMemory, claudeMemoryFiles, hasCursorRules };
}

async function readPackageJson(
  rootDir: string
): Promise<Record<string, unknown> | undefined> {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return undefined;
  try {
    const content = await readFile(pkgPath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** 스캔 결과를 사람이 읽기 쉬운 요약으로 변환 */
export function summarizeScanResult(result: ProjectScanResult): string {
  const { stack, architecture, tools, existingAiConfig } = result;
  const lines: string[] = ["🔍 프로젝트 스캔 결과:", ""];

  lines.push(`언어: ${stack.language}`);
  if (stack.runtime) lines.push(`런타임: ${stack.runtime}`);
  if (stack.frameworks.length) lines.push(`프레임워크: ${stack.frameworks.join(", ")}`);
  if (stack.testFramework) lines.push(`테스트: ${stack.testFramework}`);
  if (stack.styling) lines.push(`스타일링: ${stack.styling}`);

  lines.push("");
  lines.push(`아키텍처 패턴: ${architecture.pattern}`);
  if (architecture.srcDir) lines.push(`소스 디렉토리: ${architecture.srcDir}/`);
  lines.push(`테스트 존재: ${architecture.hasTests ? "✅" : "❌"}`);

  lines.push("");
  lines.push(`패키지 매니저: ${tools.packageManager}`);
  if (tools.ci !== "none") lines.push(`CI: ${tools.ci}`);
  if (tools.issueTracker !== "none") lines.push(`이슈 트래커: ${tools.issueTracker}`);

  if (existingAiConfig.hasClaudeMd || existingAiConfig.hasClaudeMemory) {
    lines.push("");
    lines.push("기존 AI 설정:");
    if (existingAiConfig.hasClaudeMd) lines.push("  - CLAUDE.md 발견");
    if (existingAiConfig.hasClaudeMemory) {
      lines.push(`  - .claude/memory/ 발견 (${existingAiConfig.claudeMemoryFiles.length}개 파일)`);
    }
  }

  return lines.join("\n");
}
