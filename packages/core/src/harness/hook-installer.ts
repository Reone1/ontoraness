import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

/** Claude Code settings.json에 주입할 훅 구조 */
interface ClaudeHook {
  type: "command";
  command: string;
}

interface ClaudeHookMatcher {
  matcher: string;
  hooks: ClaudeHook[];
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: ClaudeHookMatcher[];
    PostToolUse?: ClaudeHookMatcher[];
    [key: string]: ClaudeHookMatcher[] | undefined;
  };
  [key: string]: unknown;
}

const HOOK_MARKER = "ontoraness";

/**
 * .claude/settings.json에 PreToolUse + PostToolUse 훅을 등록한다.
 * 이미 등록된 경우 덮어쓰지 않는다.
 */
export async function installHooks(rootDir: string = "."): Promise<void> {
  const settingsPath = join(rootDir, ".claude/settings.json");
  await mkdir(dirname(settingsPath), { recursive: true });

  // 기존 settings.json 읽기
  let settings: ClaudeSettings = {};
  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, "utf-8");
      settings = JSON.parse(raw) as ClaudeSettings;
    } catch {
      // 파싱 실패 시 빈 객체로 시작
    }
  }

  settings.hooks ??= {};

  // PreToolUse: Tier3 규칙 위반 시 파일 작성 차단
  settings.hooks.PreToolUse ??= [];
  const hasPreHook = settings.hooks.PreToolUse.some((h) =>
    h.hooks.some((hook) => hook.command.includes(HOOK_MARKER))
  );
  if (!hasPreHook) {
    settings.hooks.PreToolUse.push({
      matcher: "Write|Edit|MultiEdit",
      hooks: [
        {
          type: "command",
          command: "node -e \"try{const {checkViolation}=await import('@ontoraness/core');await checkViolation(process.env.TOOL_INPUT)}catch(e){}\"",
        },
      ],
    });
  }

  // PostToolUse: 작업 경로 감지 → 관련 docs 주입 + 온톨로지 재컴파일
  settings.hooks.PostToolUse ??= [];
  const hasPostHook = settings.hooks.PostToolUse.some((h) =>
    h.hooks.some((hook) => hook.command.includes(HOOK_MARKER))
  );
  if (!hasPostHook) {
    settings.hooks.PostToolUse.push({
      matcher: "Write|Edit|MultiEdit",
      hooks: [
        {
          type: "command",
          command: "node -e \"try{const {injectContext}=await import('@ontoraness/core');await injectContext(process.env.TOOL_INPUT)}catch(e){}\"",
        },
      ],
    });
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * 설치된 ontoraness 훅을 제거한다.
 */
export async function uninstallHooks(rootDir: string = "."): Promise<void> {
  const settingsPath = join(rootDir, ".claude/settings.json");
  if (!existsSync(settingsPath)) return;

  const raw = await readFile(settingsPath, "utf-8");
  const settings = JSON.parse(raw) as ClaudeSettings;

  if (!settings.hooks) return;

  const filterHooks = (matchers: ClaudeHookMatcher[]): ClaudeHookMatcher[] =>
    matchers
      .map((m) => ({
        ...m,
        hooks: m.hooks.filter((h) => !h.command.includes(HOOK_MARKER)),
      }))
      .filter((m) => m.hooks.length > 0);

  if (settings.hooks.PreToolUse) {
    settings.hooks.PreToolUse = filterHooks(settings.hooks.PreToolUse);
  }
  if (settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = filterHooks(settings.hooks.PostToolUse);
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
}
