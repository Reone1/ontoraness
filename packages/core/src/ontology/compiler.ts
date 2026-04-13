import type { AnyOntology } from "./schemas/index.js";
import type { Rule } from "./schemas/base.schema.js";

/** 컴파일된 온톨로지 — 여러 파일을 병합하고 Tier별로 분류한 결과 */
export interface CompiledOntology {
  /** 원본 온톨로지 파일 목록 */
  sources: AnyOntology[];

  /** Tier 1: CLAUDE.md 항상 로드 (AgentOntology rules + 핵심 아키텍처) */
  tier1Rules: Rule[];

  /** Tier 2: 작업 감지 시 docs로 주입 */
  tier2Rules: Rule[];

  /** Tier 3: ESLint/훅으로 코드 강제 */
  tier3Rules: Rule[];

  /** metadata.id → 온톨로지 매핑 (docs 생성, 주입 경로 매핑에 사용) */
  byId: Map<string, AnyOntology>;

  /** metadata.tags → 온톨로지 ID 목록 (PostToolUse 경로 매핑용) */
  byTag: Map<string, string[]>;
}

/**
 * 여러 온톨로지를 병합하고 Tier별로 규칙을 분류한다.
 */
export function compileOntologies(ontologies: AnyOntology[]): CompiledOntology {
  const byId = new Map<string, AnyOntology>();
  const byTag = new Map<string, string[]>();
  const tier1Rules: Rule[] = [];
  const tier2Rules: Rule[] = [];
  const tier3Rules: Rule[] = [];

  for (const onto of ontologies) {
    const { id, tags, tier } = onto.metadata;

    // byId 등록
    byId.set(id, onto);

    // byTag 등록
    for (const tag of tags ?? []) {
      const existing = byTag.get(tag) ?? [];
      byTag.set(tag, [...existing, id]);
    }

    // spec.rules가 없는 kind(MetricsOntology)는 건너뜀
    if (!("rules" in onto.spec)) continue;

    const specRules = onto.spec.rules as Rule[];

    for (const rule of specRules) {
      // rule.enforcement가 명시된 경우 우선 적용, 아니면 metadata.tier 기준
      const effectiveTier = rule.enforcement ?? tierNumberToLabel(tier ?? 2);

      if (effectiveTier === "tier1") tier1Rules.push(rule);
      else if (effectiveTier === "tier2") tier2Rules.push(rule);
      else if (effectiveTier === "tier3") tier3Rules.push(rule);
    }
  }

  return { sources: ontologies, tier1Rules, tier2Rules, tier3Rules, byId, byTag };
}

function tierNumberToLabel(tier: 1 | 2 | 3): "tier1" | "tier2" | "tier3" {
  return `tier${tier}` as "tier1" | "tier2" | "tier3";
}
