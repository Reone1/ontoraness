# npm 배포 가이드

## 패키지 구조

| npm 패키지 | 역할 | npx 사용 |
|-----------|------|---------|
| `ontoraness` | CLI 도구 | `npx ontoraness` |
| `@ontoraness/core` | 핵심 엔진 (CLI 의존성) | 직접 사용 안 함 |

---

## 배포 전 체크리스트

### 1. npm 계정 및 로그인

```bash
# 계정 없으면 npmjs.com에서 생성 후
npm login
npm whoami   # 로그인 확인
```

### 2. 패키지명 중복 확인

```bash
npm view ontoraness          # 이미 존재하면 다른 이름 사용
npm view @ontoraness/core    # scoped 패키지 확인
```

> **이름이 이미 사용 중이면** `packages/cli/package.json`의 `name`과  
> `packages/core/package.json`의 `name`을 변경하세요.

### 3. 메타데이터 업데이트

`packages/cli/package.json`과 `packages/core/package.json`에서:
```json
{
  "author": "Your Name <you@example.com>",
  "repository": {
    "url": "git+https://github.com/your-org/ontoraness.git"
  },
  "homepage": "https://github.com/your-org/ontoraness#readme"
}
```

### 4. 빌드 확인

```bash
pnpm build
# templates/ 복사까지 완료되어야 함
# "[copy-templates] templates → packages/cli/templates/ 복사 완료" 메시지 확인
```

### 5. 배포 내용 미리보기 (dry-run)

```bash
cd packages/core && npm pack --dry-run
cd packages/cli && npm pack --dry-run
```

core 패키지: `dist/` 파일들 포함 확인  
cli 패키지: `dist/` + `templates/ontology-starters/` 포함 확인

---

## 배포 명령어

### 처음 배포

```bash
# 1. core 먼저 배포 (@ontoraness/core)
cd packages/core
npm publish --access public

# 2. CLI 배포 (ontoraness)
cd ../cli
npm publish --access public
```

또는 루트에서 한 번에:

```bash
# workspace:^ 의존성을 실제 버전으로 자동 변환 후 배포
pnpm publish -r --access public
```

### 버전 업데이트 후 재배포

```bash
# 버전 일괄 bump (모든 패키지)
pnpm version:patch    # 0.1.0 → 0.1.1
pnpm version:minor    # 0.1.0 → 0.2.0

# 빌드 후 배포
pnpm build
pnpm publish -r --access public
```

---

## 배포 후 확인

```bash
# 설치 없이 바로 실행
npx ontoraness --version
npx ontoraness --help

# 새 프로젝트에서 테스트
mkdir /tmp/test-project && cd /tmp/test-project
npx ontoraness onboard
```

---

## 배포 파일 구조

### ontoraness (CLI)
```
ontoraness/
├── dist/          ← 빌드된 JS
└── templates/
    └── ontology-starters/
        ├── typescript-backend/   ← 스타터 템플릿
        └── minimal/
```

### @ontoraness/core
```
@ontoraness/core/
└── dist/          ← ESM + CJS + TypeScript 타입 선언
```

---

## GitHub Actions 자동 배포 (선택)

`.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm publish -r --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**NPM_TOKEN 설정:**
1. npmjs.com → Account Settings → Access Tokens → Generate New Token (Automation)
2. GitHub 레포 → Settings → Secrets → `NPM_TOKEN`에 추가

---

## 트러블슈팅

**403 Forbidden on publish**
- `npm login` 재실행
- scoped 패키지: `--access public` 필수

**패키지명 충돌**
- `npm view <name>` 으로 사전 확인
- 이름 변경 시 `packages/cli/package.json`, `packages/core/package.json` 수정

**templates 누락**
- `pnpm build` 재실행 (copy-templates.mjs가 templates/ 복사)
- `ls packages/cli/templates/` 로 복사 확인
