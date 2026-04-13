# Ontoraness

> AI 온톨로지 + 하네스 시스템 — Claude Code 위에서 동작하는 프로젝트 규칙 자동화 도구

프로젝트의 아키텍처·도메인·코드 스타일 규칙을 **구조화된 YAML 온톨로지**로 정의하고,  
**하네스(Harness)**가 이를 Claude Code 컨텍스트에 적절히 분배해 AI가 규칙을 일관되게 지키도록 합니다.

---

## 핵심 개념

### 세 가지 역할 분리

| 구성 요소 | 역할 | 형태 |
|---------|------|------|
| **Ontology** | 프로젝트 지식의 마스터 데이터 | `.ontoraness/ontology/*.yml` |
| **Harness** | 온톨로지를 컴파일해 AI 컨텍스트에 분배 | 엔진 (CLI + 훅) |
| **CLAUDE.md** | 항상 로드되는 핵심 요약 (~200 tokens) | 생성 결과물 |

### 컨텍스트 Tier 시스템

전체 온톨로지를 CLAUDE.md에 쏟아넣으면 규칙이 희석됩니다.  
Tier별로 역할을 분리해 **적은 토큰으로 높은 준수율**을 달성합니다.

```
Tier 1 — Core Rules        항상 로드  (~200 tokens)
  └── CLAUDE.md에 고정: 절대 금지, 아키텍처 개요

Tier 2 — Context Rules     작업 감지 시 주입  (~400 tokens)
  └── PostToolUse 훅: 파일 경로 감지 → 관련 docs/*.md 자동 주입

Tier 3 — Enforced Rules    코드로 강제  (토큰 0)
  └── PreToolUse 훅 차단 + ESLint 규칙 자동 생성
```

---

## 빠른 시작

### 1. 새 프로젝트에 적용

```bash
npx ontoraness onboard
```

대화형으로 프로젝트 정보를 입력하면 스캔 → Claude API 분석 → 온톨로지 초안 → CLAUDE.md 생성까지 한 번에 진행됩니다.

### 2. 기존 Claude Code 프로젝트에 추가

```bash
npx ontoraness onboard --from claude-code
```

기존 `CLAUDE.md` / `.claude/memory/*.md`를 온톨로지 YAML로 역변환합니다.

### 3. 온톨로지 직접 작성 후 적용

```bash
# .ontoraness/ontology/*.yml 직접 작성 후
npx ontoraness validate   # 스키마 검증
npx ontoraness generate   # CLAUDE.md + docs/ + ESLint 규칙 생성
```

---

## CLI 명령어

```
ontoraness onboard [options]     프로젝트 분석 → 온톨로지 초안 생성 → 하네스 설치
ontoraness generate [options]    온톨로지 컴파일 → CLAUDE.md + docs/ + ESLint 규칙
ontoraness validate              온톨로지 스키마 유효성 검증
ontoraness report [options]      준수율·위반 패턴·doc 활용도 리포트
ontoraness agent list            서브 에이전트(GPT, Gemini) 상태 확인
ontoraness agent run <name>      서브 에이전트에 작업 위임
```

자세한 옵션은 [CLI 레퍼런스 →](docs/cli-reference.md)

---

## 프로젝트 구조

```
ontoraness/                         ← 이 레포지토리 (ontoraness 도구 자체)
├── packages/
│   ├── core/                       ← 핵심 엔진 (@ontoraness/core)
│   │   └── src/
│   │       ├── ontology/           ← YAML 로더, Zod 스키마, 컴파일러
│   │       ├── harness/            ← DocRenderer, ContextInjector, ESLintGenerator
│   │       ├── adapters/           ← ClaudeCodeAdapter (CLAUDE.md 생성)
│   │       ├── agents/             ← 서브 에이전트 (GPT, Gemini)
│   │       ├── scanner/            ← 프로젝트 자동 스캔, OnboardingAgent
│   │       └── importers/          ← ClaudeMemoryImporter
│   ├── cli/                        ← CLI 도구 (@ontoraness/cli)
│   │   └── src/commands/
│   │       ├── onboard.command.ts
│   │       ├── generate.command.ts
│   │       ├── validate.command.ts
│   │       ├── report.command.ts
│   │       └── agent.command.ts
│   └── templates/
│       └── ontology-starters/      ← 초기 온톨로지 템플릿
│           ├── typescript-backend/
│           └── minimal/
│
├── docs/                           ← 사람을 위한 문서 (이 디렉토리)
│
├── .ontoraness/                    ← ontoraness를 이 프로젝트에 적용한 결과
│   ├── harness.config.yml          ← 하네스 설정
│   ├── ontology/                   ← 이 프로젝트의 온톨로지 (마스터)
│   └── docs/                      ← AI를 위한 컨텍스트 문서 (생성됨)
│
└── CLAUDE.md                       ← 생성됨 (AI 항상 로드 컨텍스트)
```

> `.ontoraness/docs/` 는 AI를 위한 컨텍스트이고, `docs/` 는 사람을 위한 문서입니다.

---

## 온톨로지 파일 구조

모든 `.ontoraness/ontology/*.yml` 파일은 동일한 최상위 구조를 가집니다:

```yaml
version: "1.0"
kind: ArchitectureOntology   # 6개 kind 중 하나
metadata:
  id: architecture           # 고유 ID (docs 매핑에 사용)
  name: "아키텍처 규칙"
  description: "한 줄 설명"
  tier: 2                    # 1(항상) | 2(상황별) | 3(코드 강제)
  tags: ["architecture"]
spec:
  rules:                     # 공통 규칙 구조
    - id: no-circular-deps
      name: "순환 의존성 금지"
      description: "레이어 간 순환 참조 금지"
      severity: error        # error | warning | info
      enforcement: tier3     # tier1 | tier2 | tier3
  ...                        # kind별 추가 필드
```

지원하는 kind: `ArchitectureOntology` · `DomainOntology` · `CodeStyleOntology` · `AgentOntology` · `WorkflowOntology` · `MetricsOntology`

자세한 스키마: [온톨로지 스키마 레퍼런스 →](docs/ontology-schema.md)

---

## 적용된 생성 파일

`ontoraness generate` 실행 시 생성되는 파일들:

| 파일 | 내용 | 편집 여부 |
|------|------|---------|
| `CLAUDE.md` | 아키텍처 개요 + docs 인덱스 (Tier1) | 직접 편집 X (재생성됨) |
| `.ontoraness/docs/*.md` | 작업별 상세 규칙 (Tier2) | 직접 편집 X (재생성됨) |
| `.eslintrc.ontoraness.mjs` | Tier3 규칙 → ESLint 규칙 | 직접 편집 X (재생성됨) |

이 파일들은 모두 온톨로지 YAML에서 자동 생성됩니다. **편집은 YAML 파일에서 하세요.**

---

## 서브 에이전트

Claude Code가 메인 엔진, GPT/Gemini는 특정 작업을 위임받는 서브 에이전트입니다.

```bash
# API 키 설정
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=AI...

# 코드 리뷰 second opinion
ontoraness agent run gpt --task code-review --file src/payments/service.ts

# 대용량 코드베이스 분석
ontoraness agent run gemini --task analyze --file src/
```

서브 에이전트는 외부 SDK 없이 `fetch`를 직접 사용합니다.  
자세한 설정: [서브 에이전트 가이드 →](docs/sub-agents.md)

---

## 개선 루프

```bash
# 준수율 리포트
ontoraness report

# Claude AI 개선 제안 (ANTHROPIC_API_KEY 필요)
ontoraness report --suggest

# 특정 지표 상세 조회
ontoraness report --metric test_coverage
```

---

## 기술 스택

| 항목 | 선택 |
|------|------|
| 언어 | TypeScript 5.4+ (ESM, strictest) |
| 런타임 | Node.js 20+ |
| 스키마 검증 | Zod (discriminated union) |
| YAML 파싱 | js-yaml |
| CLI | Commander.js + @inquirer/prompts |
| AI API | @anthropic-ai/sdk (Claude), fetch 직접 (GPT/Gemini) |
| 빌드 | tsup (ESM + CJS) |
| 테스트 | Vitest |
| 패키지 매니저 | pnpm workspaces |

---

## 문서

- [시작 가이드](docs/getting-started.md)
- [온톨로지 스키마 레퍼런스](docs/ontology-schema.md)
- [컨텍스트 Tier 시스템](docs/context-tiers.md)
- [서브 에이전트 설정](docs/sub-agents.md)
- [CLI 레퍼런스](docs/cli-reference.md)
- [npm 배포 가이드](docs/publishing.md)
