import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { input, select, confirm } from "@inquirer/prompts";
import {
  scanProject,
  summarizeScanResult,
  generateOntologyDraft,
  importFromClaudeCode,
  installHooks,
} from "@ontoraness/core";

export const onboardCommand = new Command("onboard")
  .description("프로젝트를 분석해 온톨로지 초안을 생성하고 하네스를 설치한다 (진입점)")
  .option("--new", "코드 없는 새 프로젝트로 시작")
  .option("--from <source>", "기존 설정에서 가져오기 (claude-code)")
  .option("--no-hooks", "Claude Code 훅 자동 등록을 건너뜀")
  .option("--api-key <key>", "Anthropic API 키 (ANTHROPIC_API_KEY 환경변수 대체)")
  .action(
    async (opts: {
      new?: boolean;
      from?: string;
      hooks: boolean;
      apiKey?: string;
    }) => {
      console.log("🚀 Ontoraness 온보딩을 시작합니다.\n");

      const apiKey = opts.apiKey ?? process.env["ANTHROPIC_API_KEY"];

      if (existsSync(".ontoraness/ontology")) {
        const overwrite = await confirm({
          message:
            ".ontoraness/ontology 가 이미 존재합니다. 초안을 덮어쓸까요?",
          default: false,
        });
        if (!overwrite) {
          console.log("취소되었습니다.");
          return;
        }
      }

      await mkdir(".ontoraness/ontology", { recursive: true });
      await mkdir(".ontoraness/docs", { recursive: true });

      // ── A. 기존 claude-code 설정에서 마이그레이션 ──────────────
      if (opts.from === "claude-code") {
        await runClaudeCodeImport(apiKey);
        if (opts.hooks) await registerHooks();
        return;
      }

      // ── B. 새 프로젝트 ─────────────────────────────────────────
      if (opts.new) {
        await runNewProjectOnboarding(apiKey);
        if (opts.hooks) await registerHooks();
        return;
      }

      // ── C. 기존 프로젝트 자동 스캔 (기본) ──────────────────────
      await runProjectScanOnboarding(apiKey);
      if (opts.hooks) await registerHooks();
    }
  );

// ── 온보딩 시나리오 ────────────────────────────────────────────────

async function runProjectScanOnboarding(apiKey?: string): Promise<void> {
  console.log("🔍 프로젝트를 자동 스캔하는 중...\n");

  const scanResult = await scanProject(".");
  console.log(summarizeScanResult(scanResult));
  console.log("");

  const confirmed = await confirm({
    message: "이 정보를 기반으로 온톨로지 초안을 생성하시겠습니까?",
    default: true,
  });
  if (!confirmed) {
    console.log("온보딩이 취소되었습니다.");
    return;
  }

  if (!apiKey) {
    console.log(
      "\n⚠️  ANTHROPIC_API_KEY가 없어 자동 초안 생성을 건너뜁니다."
    );
    console.log(
      "   API 키 설정 후 `ontoraness onboard --api-key sk-ant-...` 로 재실행하거나"
    );
    console.log("   .ontoraness/ontology/*.yml 을 직접 작성하세요.");
    printSchemaGuide();
    return;
  }

  try {
    const draft = await generateOntologyDraft(scanResult, apiKey);

    if (Object.keys(draft.files).length === 0) {
      console.log("\n⚠️  초안 생성에 실패했습니다. 수동으로 작성하세요.");
      printSchemaGuide();
      return;
    }

    // 생성된 파일 저장
    for (const [filename, content] of Object.entries(draft.files)) {
      const filePath = join(".ontoraness/ontology", filename);
      await writeFile(filePath, content, "utf-8");
      console.log(`  ✅ ${filePath}`);
    }

    if (draft.summary) {
      console.log(`\n📌 프로젝트 요약: ${draft.summary}`);
    }

    // 사용자 검토 안내
    console.log(
      "\n📝 생성된 온톨로지를 검토하고 필요한 부분을 수정하세요."
    );

    // 기존 claude-code 설정 안내
    if (scanResult.existingAiConfig.hasClaudeMemory) {
      console.log(
        "\n💡 기존 .claude/memory/ 설정이 발견되었습니다."
      );
      console.log(
        "   더 정확한 마이그레이션을 위해 `ontoraness onboard --from claude-code` 를 실행해보세요."
      );
    }

    // generate 실행
    await runGenerate();
  } catch (err) {
    console.error(`\n❌ 초안 생성 오류: ${(err as Error).message}`);
    console.log("수동으로 .ontoraness/ontology/*.yml 을 작성하세요.");
    printSchemaGuide();
  }
}

async function runClaudeCodeImport(apiKey?: string): Promise<void> {
  console.log("📥 기존 claude-code 설정에서 마이그레이션 중...\n");

  const result = await importFromClaudeCode(".");

  if (result.sourceFiles.length === 0) {
    console.log("⚠️  마이그레이션할 파일을 찾을 수 없습니다.");
    console.log(
      "   CLAUDE.md 또는 .claude/memory/ 폴더가 있는지 확인하세요."
    );
    return;
  }

  console.log(`발견된 파일: ${result.sourceFiles.join(", ")}\n`);

  // 생성된 초안 저장
  for (const [filename, content] of Object.entries(result.files)) {
    const filePath = join(".ontoraness/ontology", filename);
    await writeFile(filePath, content, "utf-8");
    console.log(`  ✅ ${filePath}`);
  }

  // 경고 출력
  if (result.warnings.length > 0) {
    console.log("\n⚠️  주의사항:");
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  // OnboardingAgent로 보완 (API 키 있는 경우)
  if (apiKey) {
    const enhance = await confirm({
      message:
        "Claude AI로 초안을 더 개선하시겠습니까? (프로젝트 스캔 + AI 분석)",
      default: true,
    });

    if (enhance) {
      console.log("\n🔍 프로젝트를 추가로 스캔하는 중...");
      const { scanProject: scan, generateOntologyDraft: generate } =
        await import("@ontoraness/core");
      const scanResult = await scan(".");
      const draft = await generate(scanResult, apiKey);

      // AI 초안으로 보완 (기존 파일은 유지하고 없는 파일만 추가)
      for (const [filename, content] of Object.entries(draft.files)) {
        const filePath = join(".ontoraness/ontology", filename);
        if (!existsSync(filePath)) {
          await writeFile(filePath, content, "utf-8");
          console.log(`  ➕ ${filePath} (AI 추가)`);
        }
      }
    }
  }

  await runGenerate();
}

async function runNewProjectOnboarding(apiKey?: string): Promise<void> {
  const projectName = await input({
    message: "프로젝트 이름을 입력하세요:",
    validate: (v) => v.trim().length > 0 || "필수 입력입니다.",
  });

  const stack = await select({
    message: "주요 기술 스택을 선택하세요:",
    choices: [
      { name: "TypeScript + Node.js (백엔드)", value: "typescript-backend" },
      { name: "TypeScript + Next.js (풀스택)", value: "nextjs" },
      { name: "최소 구성 (직접 작성)", value: "minimal" },
    ],
  });

  console.log(`\n프로젝트: ${projectName} / 스택: ${stack}\n`);

  // 스타터 템플릿 복사
  const { copyStarterTemplate } = await import("../utils/template-loader.js");
  const copied = await copyStarterTemplate(stack, ".ontoraness/ontology", projectName);

  if (copied > 0) {
    console.log(`✅ ${stack} 스타터 템플릿 ${copied}개 파일 적용\n`);
    await runGenerate();
  } else {
    console.log("⚠️  스타터 템플릿을 찾을 수 없습니다. 수동으로 작성하세요.");
    printSchemaGuide();
  }
}

async function runGenerate(): Promise<void> {
  const shouldGenerate = await confirm({
    message: "온톨로지를 컴파일해 CLAUDE.md + docs/ 를 생성할까요?",
    default: true,
  });

  if (!shouldGenerate) {
    console.log("\n나중에 `ontoraness generate` 로 생성할 수 있습니다.");
    return;
  }

  const { generateCommand } = await import("./generate.command.js");
  await generateCommand.parseAsync([], { from: "user" });
}

async function registerHooks(): Promise<void> {
  const shouldInstall = await confirm({
    message:
      "Claude Code 훅을 자동으로 등록하시겠습니까? (.claude/settings.json)",
    default: true,
  });

  if (!shouldInstall) {
    console.log(
      "훅 등록을 건너뜁니다. 나중에 `ontoraness hooks install`로 등록할 수 있습니다."
    );
    return;
  }

  try {
    await installHooks(".");
    console.log("\n✅ Claude Code 훅 등록 완료 (.claude/settings.json)");
    console.log("   - PreToolUse:  Tier3 규칙 위반 시 파일 작성 차단");
    console.log(
      "   - PostToolUse: 작업 경로 감지 → 관련 docs 자동 주입"
    );
  } catch (err) {
    console.warn(`⚠️  훅 등록 실패: ${(err as Error).message}`);
  }
}

function printSchemaGuide(): void {
  console.log("\n📋 온톨로지 파일 작성 가이드:");
  console.log("   공통 구조 (모든 파일 동일):");
  console.log("   ─────────────────────────────────");
  console.log('   version: "1.0"');
  console.log(
    "   kind: ArchitectureOntology | DomainOntology | CodeStyleOntology"
  );
  console.log("         | AgentOntology | WorkflowOntology | MetricsOntology");
  console.log("   metadata:");
  console.log("     id: <고유 ID>");
  console.log("     name: <표시 이름>");
  console.log("     description: <설명>");
  console.log("     tier: 1 | 2 | 3");
  console.log("   spec:");
  console.log("     rules: []");
  console.log("     ... (kind별 추가 필드)");
  console.log("\n   작성 후 `ontoraness generate` 를 실행하세요.");
}
