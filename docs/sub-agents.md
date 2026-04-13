# 서브 에이전트 설정

Claude Code가 메인 엔진이고, GPT/Gemini는 특정 작업을 위임받아 실행하는 **서브 에이전트**입니다.

---

## 내장 에이전트

| 에이전트 | 모델 | 주요 역할 | API 키 환경변수 |
|---------|------|----------|--------------|
| `gpt` | gpt-4o | 코드 리뷰 second opinion | `OPENAI_API_KEY` |
| `gemini` | gemini-1.5-pro | 대용량 코드베이스/문서 분석 | `GEMINI_API_KEY` |

> 서드파티 AI SDK를 사용하지 않고 `fetch`를 직접 사용합니다.

---

## 사용 방법

### 1. API 키 설정

```bash
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=AI...
```

### 2. 에이전트 상태 확인

```bash
ontoraness agent list
```

```
GPT (GPT (OpenAI))
  역할: 코드 리뷰 second opinion
  모델: gpt-4o
  상태: ✅ 사용 가능

GEMINI (Gemini (Google))
  역할: 대용량 코드베이스/문서 분석
  모델: gemini-1.5-pro
  상태: ❌ API 키 없음 (GEMINI_API_KEY)
```

### 3. 에이전트 실행

```bash
# 파일 코드 리뷰
ontoraness agent run gpt --task code-review --file src/auth/auth.service.ts

# stdin 파이프 입력
cat src/payments/*.ts | ontoraness agent run gpt --task code-review

# 직접 텍스트 입력
ontoraness agent run gemini --task analyze --prompt "$(cat src/domain/*.ts)"

# 추가 지시사항
ontoraness agent run gpt \
  --task code-review \
  --file src/users/user.service.ts \
  --instructions "특히 N+1 쿼리 문제에 집중해줘"
```

---

## 지원 작업(task) 목록

| task | 설명 | 권장 에이전트 |
|------|------|------------|
| `code-review` | 버그·보안·성능 관점 코드 리뷰 | gpt (독립적 second opinion) |
| `analyze` | 코드베이스/문서 구조 분석 | gemini (대용량 컨텍스트) |
| `summarize` | 긴 문서 요약 | gpt 또는 gemini |
| `translate` | 한국어 번역 | gpt |
| `custom` | 직접 프롬프트 (`--instructions` 필수) | 모두 |

---

## 온톨로지 컨텍스트 자동 주입

에이전트 실행 시 `.ontoraness/docs/`의 관련 문서가 자동으로 시스템 프롬프트에 주입됩니다.

| task | 자동 주입 docs |
|------|-------------|
| `code-review` | architecture.md + code-style.md |
| `analyze` | architecture.md + domain.md |
| `summarize` | domain.md |
| `translate` | (없음) |

`--no-context` 옵션으로 주입을 건너뛸 수 있습니다:
```bash
ontoraness agent run gpt --task code-review --file src/foo.ts --no-context
```

---

## agents.yml에서 에이전트 설정

`agents.yml`의 `sub_agents` 섹션을 활성화하면 모델을 커스터마이징할 수 있습니다:

```yaml
# .ontoraness/ontology/agents.yml
spec:
  rules: [...]
  sub_agents:
    gpt:
      role: "코드 리뷰 second opinion"
      api_key_env: OPENAI_API_KEY
      model: gpt-4o-mini    # 기본값 gpt-4o 대신 더 저렴한 모델
    gemini:
      role: "대용량 문서 분석"
      api_key_env: GEMINI_API_KEY
      model: gemini-2.0-flash  # 더 빠른 모델
```

설정 변경 후 `ontoraness generate` 를 재실행하지 않아도 됩니다 — 에이전트 실행 시 자동으로 읽습니다.

---

## Claude Code 내에서 사용하기

Claude Code 세션에서 서브 에이전트를 활용하는 방법:

```
사용자: "이 파일을 GPT로도 리뷰해줘"
Claude: (Bash 도구로 실행)
        ontoraness agent run gpt --task code-review --file src/auth.ts
```

또는 CLAUDE.md에 사용 안내를 추가해두면 Claude가 자동으로 활용합니다:

```markdown
## 서브 에이전트 활용
- 코드 리뷰 second opinion: `ontoraness agent run gpt --task code-review --file <파일>`
- 대용량 분석: `ontoraness agent run gemini --task analyze --file <디렉토리>`
```

---

## 새 에이전트 추가 (개발자용)

`SubAgent` 인터페이스를 구현하고 `AgentRunner`에 등록합니다:

```typescript
// packages/core/src/agents/my-agent.ts
import type { SubAgent, AgentConfig, AgentInput, AgentOutput } from "./base.agent.js";
import { buildSystemPrompt, buildUserPrompt } from "./base.agent.js";

export class MyAgent implements SubAgent {
  readonly config: AgentConfig = {
    name: "my-agent",
    display_name: "My Agent",
    role: "특정 역할",
    api_key_env: "MY_API_KEY",
    default_model: "my-model",
  };

  isAvailable(): boolean {
    return !!process.env["MY_API_KEY"];
  }

  async run(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    // fetch 직접 사용 (SDK 의존성 없이)
    const response = await fetch("https://api.my-ai.com/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env["MY_API_KEY"]}`,
      },
      body: JSON.stringify({
        prompt: buildUserPrompt(input),
        system: buildSystemPrompt(input.task, input.projectContext),
      }),
    });
    const data = await response.json();
    return {
      agent: "my-agent",
      task: input.task,
      result: data.text,
      tokens_used: undefined,
      elapsed_ms: Date.now() - startTime,
    };
  }
}
```

```typescript
// packages/core/src/agents/agent-runner.ts
private registerBuiltinAgents(): void {
  this.agents.set("gpt", new GptAgent());
  this.agents.set("gemini", new GeminiAgent());
  this.agents.set("my-agent", new MyAgent()); // 추가
}
```
