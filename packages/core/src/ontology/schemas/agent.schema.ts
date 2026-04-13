import { z } from "zod";
import { RuleSchema } from "./base.schema.js";

const AgentRoleSchema = z.object({
  name: z.string(),
  description: z.string(),
  responsibilities: z.array(z.string()),
  forbidden: z.array(z.string()).optional(),
  must_follow: z.array(z.string()).optional(),
  decision_authority: z.array(z.string()).optional(),
});

const ContextPrioritySchema = z.array(z.string());

export const AgentSpecSchema = z.object({
  /** rules[] = global_constraints 역할 (tier1 고정) */
  rules: z.array(RuleSchema).default([]),
  roles: z.array(AgentRoleSchema).optional(),
  context_priority: ContextPrioritySchema.optional(),
  // [Future] 서브 에이전트 설계 예약 필드
  sub_agents: z
    .record(
      z.object({
        role: z.string(),
        api_key_env: z.string(),
      })
    )
    .optional(),
});

export const AgentOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: z.literal("AgentOntology"),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.literal(1), // AgentOntology는 항상 Tier 1
    tags: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
  }),
  spec: AgentSpecSchema,
});

export type AgentOntology = z.infer<typeof AgentOntologySchema>;
