import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { getAgentRunner } from "@ontoraness/core";
import type { AgentTask } from "@ontoraness/core";

export const agentCommand = new Command("agent")
  .description("서브 에이전트(GPT, Gemini)로 특정 작업을 위임한다");

/** 사용 가능한 에이전트 목록 출력 */
agentCommand
  .command("list")
  .description("설정된 서브 에이전트 목록과 API 키 상태를 출력한다")
  .action(async () => {
    const runner = getAgentRunner();
    await runner.loadFromOntology(".");

    const agents = runner.listAgents();

    console.log("\n🤖 서브 에이전트 목록:");
    console.log("-".repeat(60));

    for (const { name, config, available } of agents) {
      const status = available ? "✅ 사용 가능" : `❌ API 키 없음 (${config.api_key_env})`;
      console.log(`\n${name.toUpperCase()} (${config.display_name})`);
      console.log(`  역할: ${config.role}`);
      console.log(`  모델: ${config.default_model}`);
      console.log(`  상태: ${status}`);
    }

    console.log("\n" + "-".repeat(60));
    console.log("\n실행 예시:");
    console.log("  ontoraness agent run gpt --task code-review --file src/auth.ts");
    console.log("  ontoraness agent run gemini --task analyze --file src/");
  });

/** 에이전트 실행 */
agentCommand
  .command("run <name>")
  .description("지정한 에이전트로 작업을 실행한다")
  .option(
    "--task <task>",
    "수행할 작업 (code-review | analyze | summarize | translate | custom)",
    "code-review"
  )
  .option("--file <path>", "분석/리뷰 대상 파일 또는 디렉토리")
  .option("--prompt <text>", "직접 텍스트 입력 (--file 대신)")
  .option("--instructions <text>", "추가 지시사항")
  .option("--no-context", "온톨로지 컨텍스트 주입 건너뜀")
  .action(
    async (
      name: string,
      opts: {
        task: string;
        file?: string;
        prompt?: string;
        instructions?: string;
        context: boolean;
      }
    ) => {
      const runner = getAgentRunner();
      await runner.loadFromOntology(".");

      // 입력 준비
      let content: string;
      let filePath: string | undefined;

      if (opts.file) {
        if (!existsSync(opts.file)) {
          console.error(`❌ 파일을 찾을 수 없습니다: ${opts.file}`);
          process.exit(1);
        }
        try {
          content = await readFile(opts.file, "utf-8");
          filePath = opts.file;
        } catch (err) {
          console.error(`❌ 파일 읽기 실패: ${(err as Error).message}`);
          process.exit(1);
        }
      } else if (opts.prompt) {
        content = opts.prompt;
      } else {
        // stdin에서 읽기
        content = await readStdin();
        if (!content.trim()) {
          console.error("❌ 입력이 없습니다. --file 또는 --prompt 를 사용하세요.");
          console.error(
            "   예: ontoraness agent run gpt --task code-review --file src/auth.ts"
          );
          process.exit(1);
        }
      }

      const task = opts.task as AgentTask;

      console.log(
        `\n🚀 ${name.toUpperCase()} 에이전트 실행 중 (task: ${task})...`
      );
      if (filePath) console.log(`   파일: ${filePath}`);

      try {
        const output = await runner.run(
          name,
          {
            task,
            content,
            filePath,
            instructions: opts.instructions,
          },
          opts.context ? "." : undefined
        );

        console.log("\n" + "-".repeat(60));
        console.log(
          `📋 ${output.agent.toUpperCase()} 결과 (${output.elapsed_ms}ms${
            output.tokens_used ? ` / ${output.tokens_used} tokens` : ""
          }):`
        );
        console.log("-".repeat(60));
        console.log(output.result);
        console.log("-".repeat(60));
      } catch (err) {
        console.error(`\n❌ 에이전트 실행 실패: ${(err as Error).message}`);
        process.exit(1);
      }
    }
  );

/** stdin에서 텍스트 읽기 */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf-8"))
    );
    // TTY인 경우 (파이프 없음) 빈 문자열 반환
    if (process.stdin.isTTY) resolve("");
  });
}
