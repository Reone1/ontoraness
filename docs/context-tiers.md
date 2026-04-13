# 컨텍스트 Tier 시스템

CLAUDE.md에 모든 규칙을 쏟아넣으면 두 가지 문제가 생깁니다:
- **컨텍스트 낭비**: 대부분의 규칙은 현재 작업과 무관
- **규칙 희석**: 규칙이 많을수록 Claude가 각 규칙에 덜 주의

Tier 시스템은 **적은 토큰으로 높은 준수율**을 달성하기 위해 규칙을 3단계로 분리합니다.

---

## Tier 정의

### Tier 1 — Core Rules (항상 로드)

```
토큰 예산: ~200 tokens
로드 시점: 세션 시작 시 자동 (CLAUDE.md)
대상 규칙: 절대 금지 사항, 프로젝트 정체성
```

CLAUDE.md에 항상 포함됩니다. 모든 작업에서 Claude가 알아야 하는 핵심만 담습니다.

**예시:**
```yaml
- id: never-hardcode-secrets
  enforcement: tier1    # 항상 CLAUDE.md에 포함
  severity: error
```

생성된 CLAUDE.md 예시:
```markdown
## 절대 금지
- API 키 하드코딩 / .env 수정
- presentation에서 DB 직접 접근
```

---

### Tier 2 — Context Rules (작업 감지 시 주입)

```
토큰 예산: ~400 tokens (필요한 경우만)
로드 시점: PostToolUse 훅 — 파일 경로 감지 시
대상 규칙: 작업별 가이드, 아키텍처 상세, 도메인 규칙
```

파일을 수정할 때 PostToolUse 훅이 경로를 분석하고, `harness.config.yml`의 매핑에 따라 관련 docs를 자동으로 주입합니다.

**경로 매핑 예시 (harness.config.yml):**
```yaml
context_injection:
  "src/components/**":  ["architecture", "code-style"]
  "src/domain/**":      ["domain", "architecture"]
  "src/**/*.test.ts":   ["workflows"]
```

`src/components/UserCard.tsx` 수정 → `architecture.md` + `code-style.md` 주입  
`src/domain/user.ts` 수정 → `domain.md` + `architecture.md` 주입

---

### Tier 3 — Enforced Rules (코드로 강제)

```
토큰 예산: 0 (컨텍스트 불필요)
로드 시점: 코드 작성 시 자동 검사
대상 규칙: 코드에서 자동 검증 가능한 규칙
```

두 가지 방식으로 강제됩니다:

**1. PreToolUse 훅 — 파일 작성 차단**
```
규칙 위반 감지 → exit 1 → Claude Code가 파일 작성 차단
```

**2. ESLint 규칙 자동 생성**

`ontoraness generate` 실행 시 `CodeStyleOntology`의 `prohibitions` + `limits`에서 자동 생성:
```javascript
// .eslintrc.ontoraness.mjs (생성됨)
export default {
  rules: {
    "max-lines": ["warn", { max: 500 }],
    "no-restricted-syntax": ["error", {
      selector: "CallExpression[callee.object.name='console']",
      message: "console.log 금지"
    }]
  }
};
```

---

## 규칙 배치 결정 가이드

규칙을 어느 Tier에 배치할지 결정하는 기준:

```
이 규칙을 Claude가 항상 알아야 하는가?
  Yes → Tier 1 (절대 금지, 핵심 원칙)
  No  ↓

코드에서 자동으로 검사 가능한가? (패턴 매칭, 줄 수 등)
  Yes → Tier 3 (ESLint + 훅으로 강제)
  No  ↓

특정 파일/작업 시에만 필요한가?
  Yes → Tier 2 (경로 매핑으로 상황별 주입)
```

### 예시 배치

| 규칙 | Tier | 이유 |
|------|------|------|
| API 키 하드코딩 금지 | Tier 1 | 항상 알아야 하는 절대 금지 |
| 파일 500줄 제한 | Tier 3 | ESLint `max-lines`로 자동 검사 |
| 도메인 엔티티 불변 규칙 | Tier 2 | 도메인 파일 작업 시만 필요 |
| 아키텍처 레이어 구조 | Tier 2 | 코드 작성 시 참고 |
| 코드 리뷰 체크리스트 | Tier 2 | 리뷰 작업 시만 필요 |

---

## 준수율 확인

Tier별 준수율은 `ontoraness report`로 확인합니다:

```bash
ontoraness report
```

```
규칙 준수율: 94%  🟡 보통
자주 위반된 규칙:
  1. no-console-log — 12회 → Tier3으로 이동 검토
  2. dto-boundary   — 5회  → Tier2 설명 보완 필요
```

**지표 기반 Tier 재조정:**
- 특정 규칙이 반복 위반 → Tier2에서 Tier3으로 이동 (코드로 강제)
- 특정 doc이 주입 0회 → 경로 매핑 수정 또는 doc 제거
