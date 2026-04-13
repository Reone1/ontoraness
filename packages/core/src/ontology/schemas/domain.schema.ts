import { z } from "zod";
import { RuleSchema } from "./base.schema.js";

const AttributeSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
});

const EntitySchema = z.object({
  name: z.string(),
  description: z.string(),
  attributes: z.array(AttributeSchema).optional(),
  invariants: z.array(z.string()).optional(),
  relations: z
    .array(
      z.object({
        has_many: z.string().optional(),
        belongs_to: z.string().optional(),
        has_one: z.string().optional(),
      })
    )
    .optional(),
});

const GlossaryTermSchema = z.object({
  term: z.string(),
  definition: z.string(),
  code_representation: z.string().optional(),
  enforcement: z.string().optional(),
});

const BoundedContextSchema = z.object({
  name: z.string(),
  owns: z.array(z.string()),
  does_not_touch: z.array(z.string()).optional(),
});

export const DomainSpecSchema = z.object({
  rules: z.array(RuleSchema).default([]),
  entities: z.array(EntitySchema).optional(),
  glossary: z.array(GlossaryTermSchema).optional(),
  bounded_contexts: z.array(BoundedContextSchema).optional(),
});

export const DomainOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: z.literal("DomainOntology"),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    tags: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
  }),
  spec: DomainSpecSchema,
});

export type DomainOntology = z.infer<typeof DomainOntologySchema>;
