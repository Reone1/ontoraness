import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import yaml from "js-yaml";
import { AnyOntologySchema, type AnyOntology } from "./schemas/index.js";

export class OntologyLoadError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly cause: unknown
  ) {
    super(`온톨로지 로드 실패: ${filePath}`);
    this.name = "OntologyLoadError";
  }
}

/**
 * 단일 온톨로지 YAML 파일을 로드하고 Zod 스키마로 검증한다.
 */
export async function loadOntology(filePath: string): Promise<AnyOntology> {
  const absolutePath = resolve(filePath);

  if (extname(absolutePath) !== ".yml" && extname(absolutePath) !== ".yaml") {
    throw new OntologyLoadError(filePath, new Error("YAML 파일만 지원합니다 (.yml, .yaml)"));
  }

  let raw: string;
  try {
    raw = await readFile(absolutePath, "utf-8");
  } catch (err) {
    throw new OntologyLoadError(filePath, err);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new OntologyLoadError(filePath, new Error(`YAML 파싱 오류: ${err}`));
  }

  const result = AnyOntologySchema.safeParse(parsed);
  if (!result.success) {
    throw new OntologyLoadError(
      filePath,
      new Error(
        `스키마 검증 실패:\n${result.error.issues
          .map((i) => `  - [${i.path.join(".")}] ${i.message}`)
          .join("\n")}`
      )
    );
  }

  return result.data;
}

/**
 * 여러 온톨로지 파일을 병렬로 로드한다.
 */
export async function loadOntologies(
  filePaths: string[]
): Promise<AnyOntology[]> {
  return Promise.all(filePaths.map(loadOntology));
}
