import { z } from "zod";
import { ArchitectureOntologySchema } from "./architecture.schema.js";
import { DomainOntologySchema } from "./domain.schema.js";
import { CodeStyleOntologySchema } from "./code-style.schema.js";
import { AgentOntologySchema } from "./agent.schema.js";
import { WorkflowOntologySchema } from "./workflow.schema.js";
import { MetricsOntologySchema } from "./metrics.schema.js";

export * from "./base.schema.js";
export * from "./architecture.schema.js";
export * from "./domain.schema.js";
export * from "./code-style.schema.js";
export * from "./agent.schema.js";
export * from "./workflow.schema.js";
export * from "./metrics.schema.js";

/** 모든 온톨로지 파일의 discriminated union — kind로 타입 분기 */
export const AnyOntologySchema = z.discriminatedUnion("kind", [
  ArchitectureOntologySchema,
  DomainOntologySchema,
  CodeStyleOntologySchema,
  AgentOntologySchema,
  WorkflowOntologySchema,
  MetricsOntologySchema,
]);

export type AnyOntology = z.infer<typeof AnyOntologySchema>;
