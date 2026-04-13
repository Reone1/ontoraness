import { Command } from "commander";
import { glob } from "glob";
import { loadOntology } from "@ontoraness/core";

export const validateCommand = new Command("validate")
  .description("온톨로지 파일의 스키마 유효성을 검증한다")
  .option("-d, --dir <dir>", "온톨로지 디렉토리", ".ontoraness/ontology")
  .action(async (opts: { dir: string }) => {
    const files = await glob(`${opts.dir}/**/*.{yml,yaml}`);

    if (files.length === 0) {
      console.log(`온톨로지 파일을 찾을 수 없습니다: ${opts.dir}`);
      process.exit(1);
    }

    let hasError = false;

    for (const file of files) {
      try {
        await loadOntology(file);
        console.log(`✅ ${file}`);
      } catch (err) {
        console.error(`❌ ${file}\n   ${(err as Error).message}`);
        hasError = true;
      }
    }

    if (hasError) process.exit(1);
    else console.log(`\n총 ${files.length}개 파일 검증 완료.`);
  });
