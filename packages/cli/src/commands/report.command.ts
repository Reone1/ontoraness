import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadStats,
  analyzeStats,
  formatReport,
  generateSuggestions,
} from "@ontoraness/core";

export const reportCommand = new Command("report")
  .description("온톨로지 준수율과 하네스 효과를 분석한 리포트를 출력한다")
  .option("--days <number>", "분석 기간 (일)", "30")
  .option("--metric <id>", "특정 커스텀 지표만 상세 조회")
  .option("--suggest", "Claude AI가 온톨로지 개선 제안 생성 (API 키 필요)")
  .action(
    async (opts: { days: string; metric?: string; suggest?: boolean }) => {
      const periodDays = parseInt(opts.days, 10) || 30;

      // 현재 존재하는 docs ID 목록 수집 (unused_docs 계산용)
      const knownDocIds = await getKnownDocIds(".ontoraness/docs");

      const data = await loadStats(".");

      if (!data) {
        console.log("📭 통계 데이터가 없습니다.");
        console.log(
          "  훅이 등록되어 있고 파일 작성 작업이 있으면 자동으로 수집됩니다."
        );
        console.log("  `ontoraness onboard`로 훅을 먼저 등록하세요.\n");
        return;
      }

      const report = analyzeStats(data, periodDays, knownDocIds);

      // 특정 지표 상세 조회
      if (opts.metric) {
        const metric = report.custom_metrics.find(
          (m) => m.metric_id === opts.metric
        );
        if (!metric) {
          console.error(`지표 '${opts.metric}'를 찾을 수 없습니다.`);
          console.log(
            "사용 가능한 지표:",
            report.custom_metrics.map((m) => m.metric_id).join(", ") || "없음"
          );
          process.exit(1);
        }

        console.log(`\n📈 지표 상세: ${metric.metric_id}`);
        console.log(`  측정 횟수:   ${metric.count}회`);
        console.log(`  최신 값:     ${metric.latest_value ?? "N/A"}`);
        console.log(`  평균 값:     ${metric.avg_value ?? "N/A"}`);
        return;
      }

      // 전체 리포트 출력
      console.log(formatReport(report));

      // 개선 제안 생성
      if (opts.suggest) {
        if (!process.env["ANTHROPIC_API_KEY"]) {
          console.error(
            "\n❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다."
          );
          console.error(
            "   export ANTHROPIC_API_KEY=sk-ant-... 후 다시 실행하세요."
          );
          process.exit(1);
        }

        console.log("\n🤖 Claude가 개선 제안을 생성하는 중...\n");
        try {
          const suggestions = await generateSuggestions(report);
          console.log("─".repeat(50));
          console.log("💡 온톨로지 개선 제안:");
          console.log("─".repeat(50));
          console.log(suggestions);
          console.log("─".repeat(50));
        } catch (err) {
          console.error(`\n❌ 개선 제안 생성 실패: ${(err as Error).message}`);
        }
      } else if (report.top_violations.length > 0 || report.ontology_changes === 0) {
        // 개선이 필요한 상황이면 suggest 옵션 안내
        console.log(
          "\n💡 개선 제안이 필요하면: ontoraness report --suggest"
        );
      }
    }
  );

/** .ontoraness/docs/ 에 존재하는 doc ID 목록 반환 (unused_docs 계산용) */
async function getKnownDocIds(docsDir: string): Promise<string[]> {
  if (!existsSync(docsDir)) return [];
  try {
    const files = await readdir(docsDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}
