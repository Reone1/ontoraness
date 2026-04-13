# ontoraness

AI 온톨로지 + 하네스 시스템 — Claude Code 위에서 동작하는 프로젝트 규칙 자동화 CLI

## 설치 없이 바로 사용

```bash
npx ontoraness onboard
```

## 명령어

```
onboard    프로젝트 분석 → 온톨로지 초안 생성 → 하네스 설치
generate   온톨로지 컴파일 → CLAUDE.md + docs/ + ESLint 규칙
validate   온톨로지 스키마 유효성 검증
report     준수율·위반 패턴·doc 활용도 리포트
agent      서브 에이전트(GPT, Gemini)에 작업 위임
```

## 핵심 개념

프로젝트 규칙을 `.ontoraness/ontology/*.yml` 에 정의하면 하네스가 자동으로:

- **CLAUDE.md** 생성 (핵심 규칙 ~200 tokens)
- **docs/** 생성 (작업별 상세 규칙, 상황에 맞게 AI 컨텍스트에 주입)
- **ESLint 규칙** 생성 (Tier3 규칙 코드 강제)
- **Claude Code 훅** 등록 (파일 작성 전/후 자동 검사)

## 상세 문서

- [시작 가이드](docs/getting-started.md)
- [온톨로지 스키마 레퍼런스](docs/ontology-schema.md)
- [컨텍스트 Tier 시스템](docs/context-tiers.md)
- [서브 에이전트 설정](docs/sub-agents.md)
- [CLI 레퍼런스](docs/cli-reference.md)

## 저장소

https://github.com/Reone1/ontoraness
