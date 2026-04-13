import { z } from "zod";
import { RuleSchema } from "./base.schema.js";

const LayerSchema = z.object({
  name: z.string(),
  path_pattern: z.string(),
  can_import_from: z.array(z.string()),
  cannot_import_from: z.array(z.string()).optional(),
});

const PatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  rule: z.string(),
});

export const ArchitectureSpecSchema = z.object({
  rules: z.array(RuleSchema).default([]),
  layers: z.array(LayerSchema).optional(),
  patterns: z.array(PatternSchema).optional(),
  constraints: z.array(z.string()).optional(),
});

export const ArchitectureOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: z.literal("ArchitectureOntology"),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    tags: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
  }),
  spec: ArchitectureSpecSchema,
});

export type ArchitectureOntology = z.infer<typeof ArchitectureOntologySchema>;
