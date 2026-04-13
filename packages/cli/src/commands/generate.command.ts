import { Command } from "commander";
import { glob } from "glob";
import {
  loadOntologies,
  compileOntologies,
  renderDocs,
  writeDocs,
  renderClaudeMd,
  writeClaudeMd,
  generateEslintConfig,
  writeEslintConfig,
  recordEvent,
} from "@ontoraness/core";

export const generateCommand = new Command("generate")
  .description(
    "온톨로지를 컴파일해 CLAUDE.md + .ontoraness/docs/*.md + ESLint 규칙을 생성한다"
  )
  .option("-d, --dir <dir>", "온톨로지 디렉토리", ".ontoraness/ontology")
  .option("--docs-dir <dir>", "docs 출력 디렉토리", ".ontoraness/docs")
  .option("--claude-md <path>", "CLAUDE.md 출력 경로", "CLAUDE.md")
  .option(
    "--eslint-output <path>",
    "ESLint 규칙 출력 경로",
    ".eslintrc.ontoraness.mjs"
  )
  .option("--no-eslint", "ESLint 규칙 파일 생성 건너뜀")
  .option("--dry-run", "파일을 쓰지 않고 미리보기만 출력")
  .action(
    async (opts: {
      dir: string;
      docsDir: string;
      claudeMd: string;
      eslintOutput: string;
      eslint: boolean;
      dryRun?: boolean;
    }) => {
      const files = await glob(`${opts.dir}/**/*.{yml,yaml}`);

      if (files.length === 0) {
        console.error(`온톨로지 파일 없음: ${opts.dir}`);
        console.error("먼저 `ontoraness onboard`를 실행하세요.");
        process.exit(1);
      }

      console.log(`📦 온톨로지 로드 중... (${files.length}개 파일)`);

      let ontologies;
      try {
        ontologies = await loadOntologies(files);
      } catch (err) {
        console.error(`\n❌ ${(err as Error).message}`);
        process.exit(1);
      }

      const compiled = compileOntologies(ontologies);

      console.log(
        `✅ 컴파일 완료 — Tier1: ${compiled.tier1Rules.length}개 / Tier2: ${compiled.tier2Rules.length}개 / Tier3: ${compiled.tier3Rules.length}개`
      );

      // docs 렌더링
      const docs = renderDocs(compiled);
      console.log(`📄 docs 렌더링: ${docs.length}개`);

      // CLAUDE.md 렌더링
      const claudeMdContent = renderClaudeMd(compiled, docs, {
        docsDir: opts.docsDir,
      });

      // ESLint 규칙 생성
      const eslintConfig = opts.eslint
        ? generateEslintConfig(compiled)
        : { rules: {}, sources: {} };
      const eslintRuleCount = Object.keys(eslintConfig.rules).length;

      if (opts.dryRun) {
        console.log("\n─── CLAUDE.md 미리보기 ───────────────────");
        console.log(claudeMdContent);
        console.log("\n─── 생성될 파일 목록 ─────────────────────");
        docs.forEach((d) => console.log(`  📄 ${opts.docsDir}/${d.filename}`));
        if (opts.eslint && eslintRuleCount > 0) {
          console.log(
            `  📋 ${opts.eslintOutput} (${eslintRuleCount}개 규칙)`
          );
        }
        return;
      }

      // 파일 쓰기
      await writeDocs(docs, opts.docsDir);
      await writeClaudeMd(claudeMdContent, opts.claudeMd);

      if (opts.eslint && eslintRuleCount > 0) {
        await writeEslintConfig(eslintConfig, opts.eslintOutput);
      }

      // 온톨로지 변경 통계 기록
      await recordEvent({ event: "ontology_changed" });

      console.log(`\n✅ 생성 완료:`);
      console.log(`  📝 ${opts.claudeMd}`);
      docs.forEach((d) => console.log(`  📄 ${opts.docsDir}/${d.filename}`));
      if (opts.eslint && eslintRuleCount > 0) {
        console.log(
          `  📋 ${opts.eslintOutput} (Tier3 규칙 ${eslintRuleCount}개)`
        );
      }
    }
  );
