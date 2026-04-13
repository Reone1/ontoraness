import { describe, it, expect } from "vitest";
import {
  AnyOntologySchema,
  RuleSchema,
  ArchitectureOntologySchema,
  DomainOntologySchema,
  CodeStyleOntologySchema,
  AgentOntologySchema,
  WorkflowOntologySchema,
  MetricsOntologySchema,
} from "../index.js";

const validRule = {
  id: "no-circular-deps",
  name: "순환 의존성 금지",
  description: "레이어 간 순환 참조 금지",
  severity: "error",
  enforcement: "tier3",
};

describe("RuleSchema", () => {
  it("유효한 rule을 파싱한다", () => {
    const result = RuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
  });

  it("id가 없으면 실패한다", () => {
    const result = RuleSchema.safeParse({ ...validRule, id: "" });
    expect(result.success).toBe(false);
  });

  it("잘못된 severity면 실패한다", () => {
    const result = RuleSchema.safeParse({ ...validRule, severity: "critical" });
    expect(result.success).toBe(false);
  });
});

describe("ArchitectureOntologySchema", () => {
  const validArch = {
    version: "1.0",
    kind: "ArchitectureOntology",
    metadata: {
      id: "architecture",
      name: "아키텍처",
      description: "레이어 구조 정의",
      tier: 2,
      tags: ["architecture"],
    },
    spec: {
      rules: [validRule],
      layers: [
        {
          name: "presentation",
          path_pattern: "src/components/**",
          can_import_from: ["application"],
        },
      ],
    },
  };

  it("유효한 아키텍처 온톨로지를 파싱한다", () => {
    const result = ArchitectureOntologySchema.safeParse(validArch);
    expect(result.success).toBe(true);
  });

  it("kind 불일치 시 실패한다", () => {
    const result = ArchitectureOntologySchema.safeParse({
      ...validArch,
      kind: "DomainOntology",
    });
    expect(result.success).toBe(false);
  });
});

describe("AgentOntologySchema", () => {
  it("tier가 1이 아니면 실패한다", () => {
    const result = AgentOntologySchema.safeParse({
      version: "1.0",
      kind: "AgentOntology",
      metadata: {
        id: "agents",
        name: "에이전트",
        description: "AI 역할",
        tier: 2, // AgentOntology는 tier 1 고정
      },
      spec: { rules: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe("AnyOntologySchema (discriminated union)", () => {
  it("kind로 올바른 스키마를 선택한다", () => {
    const metricsInput = {
      version: "1.0",
      kind: "MetricsOntology",
      metadata: {
        id: "metrics",
        name: "지표",
        description: "커스텀 지표",
      },
      spec: {
        custom_metrics: [
          {
            id: "test_coverage",
            name: "테스트 커버리지",
            source: {
              type: "command",
              command: "npx vitest --coverage --reporter=json",
              extract: "$.total.lines.pct",
            },
            threshold: { warning: 70, error: 50 },
          },
        ],
      },
    };

    const result = AnyOntologySchema.safeParse(metricsInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("MetricsOntology");
    }
  });

  it("알 수 없는 kind면 실패한다", () => {
    const result = AnyOntologySchema.safeParse({
      version: "1.0",
      kind: "UnknownOntology",
      metadata: { id: "x", name: "x", description: "x", tier: 2 },
      spec: {},
    });
    expect(result.success).toBe(false);
  });
});
