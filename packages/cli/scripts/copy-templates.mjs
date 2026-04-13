/**
 * 빌드 후 templates/ontology-starters 를 packages/cli/templates/ 로 복사한다.
 * npx ontoraness onboard --new 실행 시 참조하는 스타터 템플릿 파일들.
 */

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(__dirname, "..");
const sourceDir = join(cliRoot, "../../packages/templates/ontology-starters");
const targetDir = join(cliRoot, "templates/ontology-starters");

if (!existsSync(sourceDir)) {
  console.warn(`[copy-templates] 소스 디렉토리 없음: ${sourceDir}`);
  process.exit(0);
}

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });

console.log(`[copy-templates] templates → packages/cli/templates/ 복사 완료`);
