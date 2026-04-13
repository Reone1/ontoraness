import { z } from "zod";

/** 온톨로지 kind 목록 (확정) */
export const OntologyKind = z.enum([
  "ArchitectureOntology",
  "DomainOntology",
  "CodeStyleOntology",
  "AgentOntology",
  "WorkflowOntology",
  "MetricsOntology",
]);
export type OntologyKind = z.infer<typeof OntologyKind>;

/** 규칙 적용 강도 */
export const EnforcementLevel = z.enum(["tier1", "tier2", "tier3"]);
export type EnforcementLevel = z.infer<typeof EnforcementLevel>;

/** 규칙 심각도 */
export const Severity = z.enum(["error", "warning", "info"]);
export type Severity = z.infer<typeof Severity>;

/** 공통 rule 구조 — 모든 spec.rules[] 에서 동일하게 사용 */
export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  severity: Severity,
  enforcement: EnforcementLevel,
  examples: z
    .object({
      valid: z.array(z.string()).optional(),
      invalid: z.array(z.string()).optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

/** 공통 메타데이터 — 모든 온톨로지 파일 최상위에 동일하게 존재 */
export const OntologyMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(z.string()).optional(),
  updated_at: z.string().optional(),
});
export type OntologyMetadata = z.infer<typeof OntologyMetadataSchema>;

/** 공통 최상위 구조 베이스 */
export const BaseOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: OntologyKind,
  metadata: OntologyMetadataSchema,
  spec: z.record(z.unknown()),
});
export type BaseOntology = z.infer<typeof BaseOntologySchema>;
