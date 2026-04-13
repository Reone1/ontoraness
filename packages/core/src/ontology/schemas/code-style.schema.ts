import { z } from "zod";
import { RuleSchema, Severity } from "./base.schema.js";

const NamingConventionSchema = z.enum([
  "camelCase",
  "PascalCase",
  "kebab-case",
  "snake_case",
  "UPPER_SNAKE_CASE",
]);

const ProhibitionSchema = z.object({
  pattern: z.string(),
  severity: Severity,
  message: z.string(),
  context: z.string().optional(),
});

export const CodeStyleSpecSchema = z.object({
  rules: z.array(RuleSchema).default([]),
  naming: z
    .object({
      files: NamingConventionSchema.optional(),
      classes: NamingConventionSchema.optional(),
      functions: NamingConventionSchema.optional(),
      constants: NamingConventionSchema.optional(),
      types: NamingConventionSchema.optional(),
      interfaces: NamingConventionSchema.optional(),
    })
    .optional(),
  limits: z
    .object({
      file_lines_max: z.number().optional(),
      file_lines_recommended: z.number().optional(),
      function_lines_max: z.number().optional(),
      function_lines_recommended: z.number().optional(),
    })
    .optional(),
  prohibitions: z.array(ProhibitionSchema).optional(),
  requirements: z.array(z.string()).optional(),
  import_order: z.array(z.string()).optional(),
  preferred_libraries: z.record(z.string()).optional(),
});

export const CodeStyleOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: z.literal("CodeStyleOntology"),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    tags: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
  }),
  spec: CodeStyleSpecSchema,
});

export type CodeStyleOntology = z.infer<typeof CodeStyleOntologySchema>;
