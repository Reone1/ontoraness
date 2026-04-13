import Anthropic from "@anthropic-ai/sdk";
import type { StatsData, StatsEvent } from "./collector.js";
import { filterEventsByPeriod } from "./collector.js";

export interface StatsReport {
  period_days: number;
  total_events: number;

  /** 규칙 준수율 (100 - 위반율) */
  compliance_rate: number;

  /** 위반 규칙 Top 5 */
  top_violations: Array<{ rule_id: string; count: number }>;

  /** doc 주입 횟수 (doc ID별) */
  doc_injection_counts: Record<string, number>;

  /** 주입 안 된 docs (매핑됐지만 0회) */
  unused_docs: string[];

  /** 커스텀 지표 현황 */
  custom_metrics: Array<{
    metric_id: string;
    latest_value: number | undefined;
    avg_value: number | undefined;
    count: number;
  }>;

  /** 온톨로지 변경 횟수 (개선 활성도) */
  ontology_changes: number;

  /** Claude API가 생성한 개선 제안 */
  suggestions?: string;
}

/**
 * stats.json 데이터를 분석해 리포트를 생성한다.
 */
export function analyzeStats(
  data: StatsData,
  periodDays: number = 30
): StatsReport {
  const events = filterEventsByPeriod(data.events, periodDays);

  const writeAttempts = events.filter(
    (e) => e.event === "pre_block" || e.event === "doc_injected"
  ).length;
  const violations = events.filter((e) => e.event === "pre_block").length;
  const complianceRate =
    writeAttempts > 0
      ? Math.round(((writeAttempts - violations) / writeAttempts) * 100)
      : 100;

  // 위반 규칙 집계
  const violationCounts: Record<string, number> = {};
  for (const e of events.filter((e) => e.event === "pre_block")) {
    const id = e.rule_id ?? "unknown";
    violationCounts[id] = (violationCounts[id] ?? 0) + 1;
  }
  const topViolations = Object.entries(violationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([rule_id, count]) => ({ rule_id, count }));

  // doc 주입 집계
  const docCounts: Record<string, number> = {};
  for (const e of events.filter((e) => e.event === "doc_injected")) {
    const id = e.doc_id ?? "unknown";
    docCounts[id] = (docCounts[id] ?? 0) + 1;
  }

  // 커스텀 지표 집계
  const metricMap: Record<string, number[]> = {};
  for (const e of events.filter((e) => e.event === "custom_metric")) {
    if (e.metric_id && e.value !== undefined) {
      metricMap[e.metric_id] ??= [];
      metricMap[e.metric_id]!.push(e.value);
    }
  }
  const customMetrics = Object.entries(metricMap).map(([metric_id, values]) => ({
    metric_id,
    latest_value: values.at(-1),
    avg_value:
      values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : undefined,
    count: values.length,
  }));

  const ontologyChanges = events.filter(
    (e) => e.event === "ontology_changed"
  ).length;

  return {
    period_days: periodDays,
    total_events: events.length,
    compliance_rate: complianceRate,
    top_violations: topViolations,
    doc_injection_counts: docCounts,
    unused_docs: [], // generate 시 알려진 docs 목록과 비교해야 채울 수 있음
    custom_metrics: customMetrics,
    ontology_changes: ontologyChanges,
  };
}

/**
 * Claude API를 사용해 리포트를 기반으로 온톨로지 개선 제안을 생성한다.
 */
export async function generateSuggestions(
  report: StatsReport,
  apiKey?: string
): Promise<string> {
  const client = new Anthropic({ apiKey: apiKey ?? process.env["ANTHROPIC_API_KEY"] });

  const prompt = buildSuggestionPrompt(report);

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: "당신은 소프트웨어 개발팀의 온톨로지 및 코드 품질 개선 전문가입니다. 통계 데이터를 분석해 실행 가능한 개선 제안을 제공하세요.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "제안 생성 실패";
}

function buildSuggestionPrompt(report: StatsReport): string {
  const lines = [
    `최근 ${report.period_days}일간 통계 분석 결과입니다. 온톨로지와 하네스 개선 제안을 제공해주세요.`,
    "",
    `**규칙 준수율**: ${report.compliance_rate}%`,
    `**총 이벤트**: ${report.total_events}건`,
    `**온톨로지 변경 횟수**: ${report.ontology_changes}회`,
  ];

  if (report.top_violations.length > 0) {
    lines.push("\n**자주 위반된 규칙 Top 5:**");
    report.top_violations.forEach(({ rule_id, count }) => {
      lines.push(`- \`${rule_id}\`: ${count}회`);
    });
  }

  const docEntries = Object.entries(report.doc_injection_counts);
  if (docEntries.length > 0) {
    lines.push("\n**docs 주입 현황:**");
    docEntries
      .sort(([, a], [, b]) => b - a)
      .forEach(([doc_id, count]) => {
        lines.push(`- \`${doc_id}.md\`: ${count}회`);
      });
  }

  if (report.unused_docs.length > 0) {
    lines.push("\n**주입되지 않은 docs:**");
    report.unused_docs.forEach((d) => lines.push(`- \`${d}.md\` (0회)`));
  }

  if (report.custom_metrics.length > 0) {
    lines.push("\n**커스텀 지표:**");
    report.custom_metrics.forEach(({ metric_id, latest_value, avg_value }) => {
      lines.push(
        `- \`${metric_id}\`: 최신=${latest_value ?? "N/A"}, 평균=${avg_value ?? "N/A"}`
      );
    });
  }

  lines.push(
    "",
    "위 데이터를 바탕으로:",
    "1. 가장 시급한 온톨로지 개선 사항 (1-3개)",
    "2. 자주 위반되는 규칙의 Tier 재분류 필요 여부",
    "3. 사용되지 않는 docs의 처리 방안",
    "4. 다음 주에 집중해야 할 개선 과제",
    "",
    "각 제안은 구체적이고 실행 가능하게 작성해주세요."
  );

  return lines.join("\n");
}

/** 리포트를 사람이 읽기 쉬운 형태로 포맷 */
export function formatReport(report: StatsReport): string {
  const lines: string[] = [
    `\n📊 Ontoraness 리포트 (최근 ${report.period_days}일)`,
    "=".repeat(50),
    "",
    `규칙 준수율: ${report.compliance_rate}%  ${getComplianceEmoji(report.compliance_rate)}`,
    `총 이벤트:   ${report.total_events}건`,
    `온톨로지 변경: ${report.ontology_changes}회 ${report.ontology_changes === 0 ? "⚠️ (개선이 없음)" : "✅"}`,
  ];

  if (report.top_violations.length > 0) {
    lines.push("\n🔴 자주 위반된 규칙 Top 5:");
    report.top_violations.forEach(({ rule_id, count }, i) => {
      lines.push(`  ${i + 1}. \`${rule_id}\` — ${count}회`);
    });
    lines.push("  → Tier 재분류 또는 규칙 설명 보완 검토");
  } else {
    lines.push("\n✅ 규칙 위반 없음 (기록 기간 내)");
  }

  const docEntries = Object.entries(report.doc_injection_counts);
  if (docEntries.length > 0) {
    lines.push("\n📄 docs 주입 현황:");
    docEntries
      .sort(([, a], [, b]) => b - a)
      .forEach(([id, count]) => {
        lines.push(`  - ${id}.md: ${count}회`);
      });
  }

  if (report.unused_docs.length > 0) {
    lines.push("\n⚠️  사용되지 않는 docs (경로 매핑 확인 필요):");
    report.unused_docs.forEach((d) => lines.push(`  - ${d}.md`));
  }

  if (report.custom_metrics.length > 0) {
    lines.push("\n📈 커스텀 지표:");
    report.custom_metrics.forEach(({ metric_id, latest_value, avg_value, count }) => {
      lines.push(
        `  - ${metric_id}: 최신=${latest_value ?? "N/A"}, 평균=${avg_value ?? "N/A"} (${count}회 측정)`
      );
    });
  }

  return lines.join("\n");
}

function getComplianceEmoji(rate: number): string {
  if (rate >= 95) return "🟢 우수";
  if (rate >= 80) return "🟡 보통";
  return "🔴 개선 필요";
}
