import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, fileURLToPath } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 스타터 템플릿 파일을 대상 디렉토리에 복사한다.
 * @returns 복사된 파일 수
 *
 * 경로 탐색 우선순위:
 * 1. 배포 패키지: dist/ 옆의 templates/ (copy-templates.mjs가 빌드 시 복사)
 * 2. 개발 환경: monorepo의 packages/templates/
 */
export async function copyStarterTemplate(
  templateName: string,
  targetDir: string,
  projectName?: string
): Promise<number> {
  const templateDir = findTemplateDir(templateName);
  if (!templateDir) return 0;

  await mkdir(targetDir, { recursive: true });

  const files = await readdir(templateDir);
  let count = 0;

  for (const file of files) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;

    let content = await readFile(join(templateDir, file), "utf-8");

    if (projectName) {
      content = content.replace(/my-project/g, projectName);
    }

    await writeFile(join(targetDir, file), content, "utf-8");
    count++;
  }

  return count;
}

/** 템플릿 디렉토리를 환경에 맞게 탐색 */
function findTemplateDir(templateName: string): string | undefined {
  const candidates = [
    // 1. 배포 패키지: node_modules/ontoraness/templates/
    join(__dirname, "../templates/ontology-starters", templateName),
    // 2. 배포 패키지 (dist/ 한 단계 더 위)
    join(__dirname, "../../templates/ontology-starters", templateName),
    // 3. 개발 환경: monorepo packages/templates/
    join(__dirname, "../../../../packages/templates/ontology-starters", templateName),
    // 4. 개발 환경: 다른 깊이
    join(__dirname, "../../../packages/templates/ontology-starters", templateName),
  ];

  return candidates.find(existsSync);
}
