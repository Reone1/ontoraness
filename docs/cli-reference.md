# CLI 레퍼런스

## ontoraness onboard

프로젝트를 분석해 온톨로지 초안을 생성하고 하네스를 설치합니다.  
**모든 시나리오의 진입점입니다.**

```
ontoraness onboard [options]

Options:
  --new           코드 없는 새 프로젝트로 시작 (스타터 템플릿 선택)
  --from <source> 기존 설정에서 가져오기 (현재 지원: claude-code)
  --no-hooks      Claude Code 훅 자동 등록 건너뜀
  --api-key <key> Anthropic API 키 (ANTHROPIC_API_KEY 환경변수 대체)
```

**동작 흐름 (기본):**
1. 프로젝트 자동 스캔 (package.json, 폴더 구조, 설정 파일)
2. Claude API로 온톨로지 YAML 초안 생성 (`ANTHROPIC_API_KEY` 필요)
3. `.ontoraness/ontology/` 에 파일 저장
4. `ontoraness generate` 실행 (확인 후)
5. Claude Code 훅 등록 (확인 후)

---

## ontoraness generate

온톨로지를 컴파일해 결과물을 생성합니다.

```
ontoraness generate [options]

Options:
  -d, --dir <dir>           온톨로지 디렉토리 (기본: .ontoraness/ontology)
  --docs-dir <dir>          docs 출력 디렉토리 (기본: .ontoraness/docs)
  --claude-md <path>        CLAUDE.md 출력 경로 (기본: CLAUDE.md)
  --eslint-output <path>    ESLint 출력 경로 (기본: .eslintrc.ontoraness.mjs)
  --no-eslint               ESLint 규칙 파일 생성 건너뜀
  --dry-run                 파일을 쓰지 않고 미리보기만 출력
```

**생성 결과물:**
- `CLAUDE.md` — Tier1 규칙 + docs 인덱스 (~200 tokens)
- `.ontoraness/docs/*.md` — kind별 상세 문서 (Tier2 주입 대상)
- `.eslintrc.ontoraness.mjs` — Tier3 규칙 → ESLint 규칙

**미리보기:**
```bash
ontoraness generate --dry-run
```

---

## ontoraness validate

온톨로지 파일의 Zod 스키마 유효성을 검증합니다.

```
ontoraness validate [options]

Options:
  -d, --dir <dir>   온톨로지 디렉토리 (기본: .ontoraness/ontology)
```

**출력 예시:**
```
✅ .ontoraness/ontology/agents.yml
✅ .ontoraness/ontology/architecture.yml
❌ .ontoraness/ontology/code-style.yml
   - [spec.rules.0.enforcement] Invalid enum value. Expected 'tier1' | 'tier2' | 'tier3'

총 3개 파일 검증 완료.
```

---

## ontoraness report

통계 데이터를 분석해 리포트를 출력합니다.

```
ontoraness report [options]

Options:
  --days <number>   분석 기간 (기본: 30일)
  --metric <id>     특정 커스텀 지표만 상세 조회
  --suggest         Claude AI가 온톨로지 개선 제안 생성 (ANTHROPIC_API_KEY 필요)
```

**출력 항목:**
- 규칙 준수율 (PreToolUse 차단 횟수 기반)
- 자주 위반된 규칙 Top 5 → Tier 재분류 신호
- docs별 주입 횟수 → 경로 매핑 최적화 근거
- 커스텀 지표 현황 (MetricsOntology 정의 시)
- Claude 개선 제안 (`--suggest` 옵션)

**통계 수집 위치:** `.ontoraness/stats.json` (훅이 자동 기록)

---

## ontoraness agent

서브 에이전트를 관리하고 실행합니다.

### agent list

```
ontoraness agent list
```

등록된 서브 에이전트 목록과 API 키 설정 상태를 출력합니다.

### agent run

```
ontoraness agent run <name> [options]

Arguments:
  name              에이전트 이름 (gpt | gemini)

Options:
  --task <task>     작업 타입 (기본: code-review)
                    code-review | analyze | summarize | translate | custom
  --file <path>     분석 대상 파일 또는 디렉토리
  --prompt <text>   직접 텍스트 입력
  --instructions <text>  추가 지시사항
  --no-context      온톨로지 컨텍스트 주입 건너뜀
```

**예시:**
```bash
# 파일 코드 리뷰
ontoraness agent run gpt --task code-review --file src/auth.ts

# 디렉토리 전체 분석
ontoraness agent run gemini --task analyze --file src/

# 추가 지시사항
ontoraness agent run gpt \
  --task code-review \
  --file src/payments.ts \
  --instructions "N+1 쿼리와 트랜잭션 처리에 집중해줘"

# stdin 파이프
git diff HEAD~1 | ontoraness agent run gpt --task code-review
```

---

## 환경변수

| 변수 | 설명 | 필요 명령어 |
|------|------|-----------|
| `ANTHROPIC_API_KEY` | Claude API 키 | `onboard` (자동 초안), `report --suggest` |
| `OPENAI_API_KEY` | OpenAI API 키 | `agent run gpt` |
| `GEMINI_API_KEY` | Google Gemini API 키 | `agent run gemini` |

---

## 훅 동작

`ontoraness onboard` 실행 후 `.claude/settings.json`에 등록되는 훅:

| 훅 | 트리거 | 동작 |
|----|--------|------|
| `PreToolUse` | Write/Edit 실행 전 | Tier3 규칙 위반 감지 시 exit 1로 차단 |
| `PostToolUse` | Write/Edit 실행 후 | 경로 분석 → 관련 docs 컨텍스트 주입 |

**PostToolUse 경로 매핑** (harness.config.yml의 `context_injection`):
```yaml
"src/domain/**": ["domain", "architecture"]
# → src/domain/ 파일 수정 시 domain.md + architecture.md 주입
```

---

## 빠른 참조

```bash
# 처음 시작
npx ontoraness onboard

# 온톨로지 수정 후 재적용
ontoraness validate && ontoraness generate

# 준수율 확인
ontoraness report

# AI 개선 제안
ontoraness report --suggest

# 코드 리뷰 second opinion
ontoraness agent run gpt --task code-review --file <파일>
```
