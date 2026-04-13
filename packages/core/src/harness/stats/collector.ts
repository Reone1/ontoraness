import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

/** 수집되는 이벤트 타입 */
export type StatsEventType =
  | "pre_block"       // PreToolUse 훅이 파일 작성 차단
  | "doc_injected"    // PostToolUse 훅이 docs 주입
  | "lint_error"      // ESLint Tier3 규칙 위반
  | "ontology_changed"// 온톨로지 YAML 파일 변경
  | "custom_metric";  // 사용자 정의 지표 수집

export interface StatsEvent {
  timestamp: string;          // ISO 8601
  event: StatsEventType;
  metric_id?: string;         // custom_metric의 경우 지표 ID
  value?: number;             // custom_metric 측정값
  rule_id?: string;           // 위반 규칙 ID (pre_block, lint_error)
  doc_id?: string;            // 주입된 doc ID (doc_injected)
  file_path?: string;         // 변경된 파일 경로
}

export interface StatsData {
  version: "1.0";
  created_at: string;
  updated_at: string;
  events: StatsEvent[];
}

const STATS_FILENAME = ".ontoraness/stats.json";

/**
 * stats.json에 이벤트를 누적 기록한다.
 * 훅 스크립트에서 호출 — 경량, 실패해도 훅 동작에 영향 없음.
 */
export async function recordEvent(
  event: Omit<StatsEvent, "timestamp">,
  rootDir: string = "."
): Promise<void> {
  const statsPath = join(rootDir, STATS_FILENAME);

  try {
    await mkdir(dirname(statsPath), { recursive: true });

    let data: StatsData;

    if (existsSync(statsPath)) {
      const raw = await readFile(statsPath, "utf-8");
      data = JSON.parse(raw) as StatsData;
    } else {
      data = {
        version: "1.0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        events: [],
      };
    }

    data.events.push({ ...event, timestamp: new Date().toISOString() });
    data.updated_at = new Date().toISOString();

    // 최근 10,000개 이벤트만 유지
    if (data.events.length > 10_000) {
      data.events = data.events.slice(-10_000);
    }

    await writeFile(statsPath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // 통계 기록 실패는 무시 — 훅 동작에 영향 없어야 함
  }
}

/** stats.json 전체 로드 */
export async function loadStats(rootDir: string = "."): Promise<StatsData | null> {
  const statsPath = join(rootDir, STATS_FILENAME);
  if (!existsSync(statsPath)) return null;

  try {
    const raw = await readFile(statsPath, "utf-8");
    return JSON.parse(raw) as StatsData;
  } catch {
    return null;
  }
}

/** 기간별 이벤트 필터링 */
export function filterEventsByPeriod(
  events: StatsEvent[],
  days: number
): StatsEvent[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffMs = cutoff.getTime();

  return events.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoffMs
  );
}
