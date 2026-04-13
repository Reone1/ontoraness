# 온톨로지 스키마 레퍼런스

## 공통 최상위 구조

모든 온톨로지 파일은 동일한 뼈대를 가집니다. `kind`별 `spec`만 다릅니다.

```yaml
version: "1.0"          # 고정값
kind: [OntologyKind]    # 아래 6개 중 하나
metadata:
  id: string            # 고유 ID — docs 파일명, 통계 key로 사용
  name: string          # 표시 이름
  description: string   # 한 줄 설명
  tier: 1 | 2 | 3       # 컨텍스트 주입 Tier
  tags: string[]        # 경로 매핑용 태그 (harness.config.yml과 연동)
  updated_at: string    # 선택적 날짜
spec:
  rules: []             # 공통 규칙 배열 (MetricsOntology 제외)
  ...                   # kind별 추가 필드
```

---

## 공통 Rule 구조

모든 `spec.rules[]` 항목은 동일한 구조를 사용합니다.
이 구조가 하네스의 Tier 분류, ESLint 규칙 생성, 통계 추적의 기준입니다.

```yaml
rules:
  - id: no-circular-deps          # 고유 ID — 위반 추적 key
    name: "순환 의존성 금지"
    description: "레이어 간 순환 참조는 아키텍처를 붕괴시킴"
    severity: error               # error | warning | info
    enforcement: tier3            # tier1 | tier2 | tier3
    examples:                     # 선택적
      valid:
        - "presentation → application (단방향)"
      invalid:
        - "domain → infrastructure → domain (순환)"
    tags: ["architecture"]        # 선택적 분류 태그
```

### enforcement 레벨 선택 기준

| 레벨 | 적용 방식 | 언제 사용 |
|------|---------|---------|
| `tier1` | CLAUDE.md에 항상 포함 | 절대 위반하면 안 되는 핵심 제약 |
| `tier2` | 작업 감지 시 docs로 주입 | 관련 작업 시 참고해야 하는 가이드 |
| `tier3` | ESLint 규칙 + 훅으로 코드 강제 | 코드에서 자동 검사 가능한 규칙 |

---

## Kind별 스키마

### ArchitectureOntology

레이어 구조와 의존성 규칙을 정의합니다.

```yaml
version: "1.0"
kind: ArchitectureOntology
metadata:
  id: architecture
  tier: 2          # 코드 작성 시 주입
spec:
  rules: [...]     # 공통 규칙

  layers:          # 선택적 — 레이어 경로 매핑
    - name: presentation
      path_pattern: "src/{components,pages}/**"
      can_import_from: [application]
      cannot_import_from: [infrastructure, domain]

  patterns:        # 선택적 — 아키텍처 패턴 설명
    - name: "Repository Pattern"
      description: "모든 DB 접근은 Repository를 통해서만"
      rule: "services/**/*.ts는 prisma를 직접 import하지 않음"

  constraints:     # 선택적 — 한 줄 제약 목록
    - "순환 의존성 절대 금지"
```

---

### DomainOntology

도메인 엔티티, 비즈니스 규칙, 용어를 정의합니다.

```yaml
version: "1.0"
kind: DomainOntology
metadata:
  id: domain
  tier: 2
spec:
  rules: [...]

  entities:        # 선택적 — 도메인 엔티티
    - name: User
      description: "서비스 사용자"
      attributes:
        - name: email
          type: string
          description: "소문자로 저장"
      invariants:
        - "email은 항상 소문자로 저장"

  glossary:        # 선택적 — 도메인 용어 (Ubiquitous Language)
    - term: "소프트 삭제"
      definition: "deletedAt 설정, 실제 삭제하지 않음"
      code_representation: "WHERE deletedAt IS NULL 필수"

  bounded_contexts: # 선택적 — 경계 컨텍스트
    - name: auth
      owns: [User, Session]
      does_not_touch: [Billing]
```

---

### CodeStyleOntology

코드 작성 규칙과 제약을 정의합니다.  
`prohibitions`의 Tier3 항목은 `.eslintrc.ontoraness.mjs`로 자동 변환됩니다.

```yaml
version: "1.0"
kind: CodeStyleOntology
metadata:
  id: code-style
  tier: 2
spec:
  rules: [...]

  naming:          # 선택적
    files: kebab-case
    classes: PascalCase
    functions: camelCase
    constants: UPPER_SNAKE_CASE
    types: PascalCase

  limits:          # 선택적 — 크기 제한
    file_lines_max: 500
    file_lines_recommended: 200
    function_lines_max: 50

  prohibitions:    # 선택적 — 금지 패턴 (Tier3 → ESLint 자동 변환)
    - pattern: "\\bany\\b"
      severity: error
      message: "any 타입 금지"
    - pattern: "console\\.log"
      severity: error
      message: "console.log 금지"
      context: "production"  # 선택적 컨텍스트

  requirements:    # 선택적 — 필수 요건
    - "모든 public 함수에 JSDoc 필수"

  preferred_libraries: # 선택적 — 권장 라이브러리
    validation: "zod"
    testing: "vitest"
```

---

### AgentOntology

AI 역할과 전역 제약을 정의합니다.  
**`metadata.tier`는 반드시 `1`** — 항상 CLAUDE.md에 포함됩니다.

```yaml
version: "1.0"
kind: AgentOntology
metadata:
  id: agents
  tier: 1          # 반드시 1 (tier1 고정)
spec:
  rules:           # 전역 제약 (tier1 enforcement 권장)
    - id: never-hardcode-secrets
      name: "시크릿 하드코딩 금지"
      description: "API 키를 코드에 직접 작성 금지"
      severity: error
      enforcement: tier1
      tags: ["never"]

  roles:           # 선택적 — 에이전트 역할 정의
    - name: "implementer"
      description: "기능 구현 담당"
      responsibilities:
        - "요구사항 분석 및 구현"
      forbidden:
        - "직접 DB 접근"

  # 서브 에이전트 설정 (API 키 환경변수 필요)
  # sub_agents:
  #   gpt:
  #     role: "코드 리뷰 second opinion"
  #     api_key_env: OPENAI_API_KEY
  #     model: gpt-4o
  #   gemini:
  #     role: "대용량 문서 분석"
  #     api_key_env: GEMINI_API_KEY
  #     model: gemini-1.5-pro
```

---

### WorkflowOntology

작업 단계와 체크리스트를 정의합니다.

```yaml
version: "1.0"
kind: WorkflowOntology
metadata:
  id: workflows
  tier: 2
spec:
  rules: [...]

  workflows:       # 선택적 — 작업 플로우
    - name: "기능 개발"
      trigger: "새 기능 구현 요청 시"
      steps:
        - "요구사항 분석"
        - "인터페이스 정의"
        - "구현 및 테스트"
        - "코드 리뷰"

  checklists:      # 선택적 — 체크리스트
    pre-commit:
      - "파일 크기 제한 준수"
      - "테스트 통과"
```

---

### MetricsOntology

사용자 정의 평가 지표를 정의합니다.  
수집된 데이터는 `ontoraness report`에 자동 포함됩니다.

```yaml
version: "1.0"
kind: MetricsOntology
metadata:
  id: metrics
  name: "평가 지표"
  description: "커스텀 지표 정의"
spec:
  # rules 없음 (MetricsOntology 예외)

  custom_metrics:
    # 명령어 실행 결과를 지표로
    - id: test_coverage
      name: "테스트 커버리지"
      source:
        type: command
        command: "npx vitest --coverage --reporter=json"
        extract: "$.total.lines.pct"  # JSONPath
      threshold:
        warning: 70
        error: 50

    # 커스텀 스크립트
    - id: api_response_time
      name: "API 응답 시간 (ms)"
      source:
        type: script
        path: ".ontoraness/scripts/measure-api.js"
      threshold:
        warning: 300

    # GitHub API 연동
    - id: pr_review_time
      name: "PR 리뷰 소요 시간"
      source:
        type: github
        query: "pulls?state=closed"
        extract: "avg(closed_at - created_at)"

    # 내장 이벤트 기반
    - id: doc_staleness
      name: "docs 업데이트 지연"
      source:
        type: builtin
        event: ontology_not_regenerated

  collection:
    on_hook: true        # 훅 실행마다
    on_commit: false     # git commit 시
    scheduled: "0 9 * * 1"  # 매주 월요일 9시 (cron)
```

---

## harness.config.yml

온톨로지 파일들을 어떻게 사용할지 설정합니다.

```yaml
version: "1.0"
project:
  name: "my-project"
  description: "프로젝트 설명"

output:
  claude_md: "CLAUDE.md"         # CLAUDE.md 출력 경로
  docs_dir: ".ontoraness/docs"   # docs 출력 디렉토리

# PostToolUse 훅의 경로 → docs ID 매핑
context_injection:
  "src/components/**": ["architecture", "code-style"]
  "src/domain/**":     ["domain", "architecture"]
  "src/**/*.test.ts":  ["workflows"]

adapters:
  claude-code:
    enabled: true
    append: |
      ## 추가 메모
      YAML로 표현하기 어려운 내용을 수동으로 추가할 수 있습니다.
```

---

## 스키마 검증

```bash
ontoraness validate
```

모든 `.ontoraness/ontology/*.yml` 파일을 Zod 스키마로 검증합니다.

**주요 검증 규칙:**
- `version`은 `"1.0"` 고정
- `kind`는 6개 열거형 중 하나
- `AgentOntology`의 `metadata.tier`는 반드시 `1`
- `spec.rules[].severity`는 `error | warning | info` 중 하나
- `spec.rules[].enforcement`는 `tier1 | tier2 | tier3` 중 하나
