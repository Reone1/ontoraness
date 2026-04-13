import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { SubAgent, AgentInput, AgentOutput, AgentConfig } from "./base.agent.js";
import { GptAgent } from "./gpt.agent.js";
import { GeminiAgent } from "./gemini.agent.js";

/** agents.yml의 sub_agents 섹션 타입 */
interface SubAgentDefinition {
  role: string;
  api_key_env: string;
  model?: string;
}

/**
 * 서브 에이전트를 관리하고 실행하는 오케스트레이터.
 * agents.yml의 sub_agents 섹션을 읽어 동적으로 에이전트를 구성한다.
 */
export class AgentRunner {
  private agents: Map<string, SubAgent> = new Map();

  constructor() {
    // 내장 에이전트 등록
    this.registerBuiltinAgents();
  }

  /** 내장 에이전트 등록 */
  private registerBuiltinAgents(): void {
    this.agents.set("gpt", new GptAgent());
    this.agents.set("gemini", new GeminiAgent());
  }

  /**
   * agents.yml의 sub_agents 섹션을 읽어 에이전트 설정을 로드한다.
   * 내장 에이전트의 설정을 override하거나 새 에이전트를 추가할 수 있다.
   */
  async loadFromOntology(rootDir: string = "."): Promise<void> {
    const agentsPath = join(rootDir, ".ontoraness/ontology/agents.yml");
    if (!existsSync(agentsPath)) return;

    try {
      const raw = await readFile(agentsPath, "utf-8");
      const onto = yaml.load(raw) as Record<string, unknown>;
      const spec = onto["spec"] as Record<string, unknown> | undefined;
      const subAgents = spec?.["sub_agents"] as
        | Record<string, SubAgentDefinition>
        | undefined;

      if (!subAgents) return;

      for (const [name, def] of Object.entries(subAgents)) {
        // 내장 에이전트 설정 override
        if (name === "gpt" && def.model) {
          this.agents.set("gpt", new GptAgent(def.model));
        } else if (name === "gemini" && def.model) {
          this.agents.set("gemini", new GeminiAgent(def.model));
        }
        // 향후: 플러그인 에이전트 동적 로드
      }
    } catch {
      // 파싱 실패 시 내장 에이전트 유지
    }
  }

  /** 사용 가능한 에이전트 목록 반환 */
  listAgents(): Array<{ name: string; config: AgentConfig; available: boolean }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      config: agent.config,
      available: agent.isAvailable(),
    }));
  }

  /** 특정 에이전트 가져오기 */
  getAgent(name: string): SubAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * 지정한 에이전트로 작업을 실행한다.
   * 온톨로지 컨텍스트(CLAUDE.md 또는 docs)를 자동으로 주입한다.
   */
  async run(
    agentName: string,
    input: Omit<AgentInput, "projectContext">,
    rootDir: string = "."
  ): Promise<AgentOutput> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(
        `에이전트 '${agentName}'를 찾을 수 없습니다. 사용 가능: ${[...this.agents.keys()].join(", ")}`
      );
    }

    if (!agent.isAvailable()) {
      throw new Error(
        `에이전트 '${agentName}'의 API 키가 설정되지 않았습니다.\n` +
          `환경변수 ${agent.config.api_key_env} 를 설정하세요.`
      );
    }

    // 온톨로지 컨텍스트 자동 주입
    const projectContext = await loadProjectContext(agentName, input.task, rootDir);

    return agent.run({ ...input, projectContext });
  }
}

/** 작업 타입에 맞는 온톨로지 docs 컨텍스트 로드 */
async function loadProjectContext(
  agentName: string,
  task: string,
  rootDir: string
): Promise<string | undefined> {
  const docsDir = join(rootDir, ".ontoraness/docs");
  if (!existsSync(docsDir)) return undefined;

  // 작업별 관련 docs 선택
  const relevantDocs: Record<string, string[]> = {
    "code-review": ["architecture", "code-style"],
    "analyze": ["architecture", "domain"],
    "summarize": ["domain"],
    "translate": [],
    "custom": [],
  };

  const docIds = relevantDocs[task] ?? [];
  const sections: string[] = [];

  for (const docId of docIds) {
    const docPath = join(docsDir, `${docId}.md`);
    if (!existsSync(docPath)) continue;

    try {
      const content = await readFile(docPath, "utf-8");
      // 생성 마커 제거
      const cleaned = content.replace(/<!--.*?-->\n?/gs, "").trim();
      if (cleaned) sections.push(cleaned);
    } catch {
      // 무시
    }
  }

  return sections.length > 0 ? sections.join("\n\n---\n\n") : undefined;
}

/** 싱글톤 AgentRunner 인스턴스 */
let _runner: AgentRunner | undefined;

export function getAgentRunner(): AgentRunner {
  _runner ??= new AgentRunner();
  return _runner;
}
