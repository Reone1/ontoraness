# @ontoraness/core

Ontoraness 핵심 엔진 — 온톨로지 로더, 컴파일러, 하네스, 어댑터

> 이 패키지는 `ontoraness` CLI의 내부 의존성입니다.  
> 직접 사용보다는 `npx ontoraness` 를 사용하세요.

## 직접 사용 시

```bash
npm install @ontoraness/core
```

```typescript
import {
  loadOntologies,
  compileOntologies,
  renderDocs,
  renderClaudeMd,
} from "@ontoraness/core";

const ontologies = await loadOntologies(["./ontology/architecture.yml"]);
const compiled = compileOntologies(ontologies);
const docs = renderDocs(compiled);
const claudeMd = renderClaudeMd(compiled, docs);
```

## 주요 export

| 모듈 | 역할 |
|------|------|
| `loadOntology / loadOntologies` | YAML 파싱 + Zod 검증 |
| `compileOntologies` | 병합 + Tier 분류 |
| `renderDocs / writeDocs` | docs/*.md 렌더링 |
| `renderClaudeMd / writeClaudeMd` | CLAUDE.md 생성 |
| `generateEslintConfig` | ESLint 규칙 생성 |
| `installHooks` | Claude Code 훅 등록 |
| `scanProject` | 프로젝트 자동 스캔 |
| `generateOntologyDraft` | Claude API 온톨로지 초안 |
| `AgentRunner / GptAgent / GeminiAgent` | 서브 에이전트 |

## 저장소

https://github.com/Reone1/ontoraness
