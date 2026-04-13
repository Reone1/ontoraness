# 시작 가이드

## 전제 조건

- Node.js 20+
- pnpm 9+
- ANTHROPIC_API_KEY (온보딩 자동 초안 생성 시 필요, 없어도 수동 작성으로 대체 가능)

---

## 시나리오별 시작 방법

### 시나리오 A: 새 프로젝트에 처음 적용

```bash
cd my-project
npx ontoraness onboard --new
```

1. 프로젝트 이름과 스택 선택 (대화형)
2. 스타터 템플릿이 `.ontoraness/ontology/` 에 복사됨
3. `ontoraness generate` 자동 실행 → CLAUDE.md + docs/ 생성
4. Claude Code 훅 등록 여부 확인

---

### 시나리오 B: 기존 프로젝트에 추가 (가장 일반적)

```bash
cd my-existing-project
npx ontoraness onboard
```

1. 프로젝트 자동 스캔 (package.json, 폴더 구조, 설정 파일 분석)
2. Claude API로 온톨로지 YAML 초안 자동 생성
3. 초안 검토 안내 출력
4. 사용자 확인 후 `generate` 실행

**API 키 없이 시작하는 경우:**
```bash
npx ontoraness onboard  # 스캔 결과만 출력 후 수동 작성 안내
# → .ontoraness/ontology/*.yml 직접 작성 후
npx ontoraness generate
```

---

### 시나리오 C: 기존 Claude Code 설정 마이그레이션

`CLAUDE.md` 또는 `.claude/memory/*.md` 파일이 이미 있는 경우:

```bash
npx ontoraness onboard --from claude-code
```

1. 기존 파일 분석 → 규칙 추출
2. 온톨로지 YAML 초안으로 역변환
3. 새 CLAUDE.md (짧게) + docs/ 생성
4. 훅 자동 등록

---

## 설치 후 디렉토리 구조

```
my-project/
├── CLAUDE.md                      ← [생성됨] 아키텍처 개요 + docs 인덱스
├── .eslintrc.ontoraness.mjs       ← [생성됨] Tier3 ESLint 규칙
│
├── .ontoraness/
│   ├── harness.config.yml         ← 하네스 설정 (git 추적 대상)
│   ├── stats.json                 ← 준수율 통계 (자동 수집)
│   ├── ontology/                  ← 마스터 데이터 (직접 편집)
│   │   ├── agents.yml
│   │   ├── architecture.yml
│   │   ├── code-style.yml
│   │   ├── domain.yml
│   │   └── workflows.yml
│   └── docs/                      ← [생성됨] AI 컨텍스트 문서
│       ├── agents.md
│       ├── architecture.md
│       ├── code-style.md
│       ├── domain.md
│       └── workflows.md
│
└── .claude/
    └── settings.json              ← 훅 등록됨 (PreToolUse + PostToolUse)
```

**편집 대상**: `.ontoraness/ontology/*.yml` + `harness.config.yml`  
**편집 금지**: `CLAUDE.md`, `.ontoraness/docs/*.md`, `.eslintrc.ontoraness.mjs` (재생성됨)

---

## 온톨로지 수정 후 재생성

```bash
# 온톨로지 YAML 편집 후
ontoraness validate   # 스키마 검증
ontoraness generate   # 결과물 재생성
```

훅이 등록된 경우, `.ontoraness/ontology/` 파일 수정 시 자동으로 재생성 안내가 출력됩니다.

---

## git 전략

```gitignore
# .ontoraness/ontology/ 와 harness.config.yml 은 반드시 커밋
# 생성 결과물은 팀 선택에 따라:

# 옵션 1: 생성 결과물도 커밋 (추천 — 리뷰 가능)
# CLAUDE.md, .ontoraness/docs/, .eslintrc.ontoraness.mjs 커밋

# 옵션 2: 생성 결과물 제외 (postinstall로 자동 생성)
CLAUDE.md
.ontoraness/docs/
.eslintrc.ontoraness.mjs
```

`package.json`에 자동 생성 스크립트 추가 (옵션 2):
```json
{
  "scripts": {
    "postinstall": "ontoraness generate"
  }
}
```

---

## 다음 단계

- [온톨로지 스키마 레퍼런스 →](ontology-schema.md) — YAML 파일 상세 작성 방법
- [컨텍스트 Tier 시스템 →](context-tiers.md) — Tier 분류 원칙
- [서브 에이전트 →](sub-agents.md) — GPT/Gemini 에이전트 설정
