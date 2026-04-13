import { describe, it, expect } from "vitest";
import { join } from "node:path";

const TEMPLATES_DIR = join(
  import.meta.dirname,
  "../../../../templates/ontology-starters"
);

describe("스타터 템플릿 유효성", () => {
  it("typescript-backend 템플릿 디렉토리가 존재한다", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(TEMPLATES_DIR, "typescript-backend"))).toBe(true);
  });

  it("minimal 템플릿 디렉토리가 존재한다", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(TEMPLATES_DIR, "minimal"))).toBe(true);
  });

  it("typescript-backend 템플릿은 agents.yml을 포함한다", async () => {
    const { existsSync } = await import("node:fs");
    expect(
      existsSync(join(TEMPLATES_DIR, "typescript-backend/agents.yml"))
    ).toBe(true);
  });
});
