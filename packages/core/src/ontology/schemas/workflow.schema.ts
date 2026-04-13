import { z } from "zod";
import { RuleSchema } from "./base.schema.js";

const WorkflowStepSchema = z.object({
  step: z.number().optional(),
  action: z.string(),
  description: z.string().optional(),
});

const WorkflowSchema = z.object({
  name: z.string(),
  trigger: z.string().optional(),
  steps: z.union([z.array(z.string()), z.array(WorkflowStepSchema)]),
});

const ChecklistSchema = z.object({
  name: z.string(),
  items: z.array(z.string()),
});

export const WorkflowSpecSchema = z.object({
  rules: z.array(RuleSchema).default([]),
  workflows: z.array(WorkflowSchema).optional(),
  checklists: z.record(z.array(z.string())).optional(),
});

export const WorkflowOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: z.literal("WorkflowOntology"),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    tags: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
  }),
  spec: WorkflowSpecSchema,
});

export type WorkflowOntology = z.infer<typeof WorkflowOntologySchema>;
