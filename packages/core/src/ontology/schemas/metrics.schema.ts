import { z } from "zod";

const ThresholdSchema = z.object({
  warning: z.number().optional(),
  error: z.number().optional(),
});

/** 지표 수집 소스 타입 */
const MetricSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    command: z.string(),
    extract: z.string().optional(), // JSONPath
  }),
  z.object({
    type: z.literal("script"),
    path: z.string(),
  }),
  z.object({
    type: z.literal("github"),
    query: z.string(),
    extract: z.string().optional(),
  }),
  z.object({
    type: z.literal("builtin"),
    event: z.string(),
  }),
]);

const CustomMetricSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  source: MetricSourceSchema,
  threshold: ThresholdSchema.optional(),
});

const CollectionConfigSchema = z.object({
  on_hook: z.boolean().default(true),
  on_commit: z.boolean().default(false),
  scheduled: z.string().optional(), // cron expression
});

export const MetricsSpecSchema = z.object({
  custom_metrics: z.array(CustomMetricSchema).default([]),
  collection: CollectionConfigSchema.optional(),
});

export const MetricsOntologySchema = z.object({
  version: z.literal("1.0"),
  kind: z.literal("MetricsOntology"),
  metadata: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    tags: z.array(z.string()).optional(),
    updated_at: z.string().optional(),
  }),
  spec: MetricsSpecSchema,
});

export type MetricsOntology = z.infer<typeof MetricsOntologySchema>;
export type CustomMetric = z.infer<typeof CustomMetricSchema>;
export type MetricSource = z.infer<typeof MetricSourceSchema>;
