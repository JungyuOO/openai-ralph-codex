# OPENAI-Ralph-codex 한국어 안내

`openai-ralph-codex`는 Codex 안에서 큰 작업을 더 안정적으로 진행하기 위한
PRD 기반 Ralph 루프 플러그인 + CLI입니다.

핵심은 단순합니다.

- **Codex**가 실제 코드를 작성하고 수정합니다.
- **Ralph**가 작업을 PRD → 태스크 → 검증 흐름으로 구조화합니다.
- **`.ralph/`**가 현재 프로젝트 전용 상태를 저장합니다.

즉, Codex를 대체하는 도구가 아니라 **Codex 위에 올리는 작업 관리 레이어**에
가깝습니다.

---

## 이 도구가 필요한 경우

다음 같은 작업에서 특히 유용합니다.

- 기능 단위 이상의 작업
- 여러 번 나눠서 진행해야 하는 작업
- 검증을 반드시 거쳐야 하는 작업
- 재시도 / blocked / resume 흐름이 필요한 작업
- PRD나 작은 태스크 단위로 쪼개서 진행하는 것이 더 안전한 작업

반대로 아주 작은 수정, 짧은 질답, 일회성 작업은 보통 Codex만으로 충분합니다.

---

## 현재 작동 방식

현재 구조는 **전역 설치 + 프로젝트별 활성화(opt-in)** 입니다.

### 1) 전역 설치

```bash
npm install -g @openai/codex openai-ralph-codex
```

전역 설치를 하면:

- `orc` CLI가 설치되고
- 호환용 `ralph` alias도 유지되며
- Codex plugin / hook 연결이 홈 디렉터리에 준비됩니다

하지만 **전역 설치만으로 모든 프로젝트에서 Ralph가 자동으로 개입하지는 않습니다.**

전역 설치는 Ralph를 “사용 가능한 상태”로 만드는 단계라고 보면 됩니다.

---

### 2) 프로젝트별 활성화

Ralph를 실제로 사용할 프로젝트에서만 아래를 실행합니다.

```bash
cd your-project
orc enable
```

그러면 현재 프로젝트에 `.ralph/project.json`이 생성되고,
이 프로젝트만 Ralph hook 라우팅 대상이 됩니다.

상태 확인:

```bash
orc status --project
```

비활성화:

```bash
orc disable
```

---

## 빠른 시작

```bash
npm install -g @openai/codex openai-ralph-codex
cd your-project
orc enable
orc status --project
codex
```

그 다음에는 평소처럼 작업을 설명하면 됩니다.

예:

- `Create a PRD and plan this feature.`
- `Run the next Ralph task.`
- `Verify the current task before continuing.`
- `Continue the blocked work in this project.`

---

## Codex 안에서는 어떻게 동작하나

이 플러그인은 모든 프롬프트를 가로채지 않습니다.

대신 현재 프로젝트 상태와 요청 의도를 보고:

- 계획 수립이 필요한지
- 다음 태스크 실행이 필요한지
- 검증이 필요한지
- 막힌 작업 재개가 필요한지

를 판단해서 `orc plan`, `orc run`, `orc verify`, `orc resume`,
`orc status` 쪽으로 라우팅합니다.

요약하면 다음과 같습니다.

- 작은 작업: Codex 그대로 사용
- 큰 작업: Ralph 루프 사용

---

## 첫 진입 시 bootstrap

프로젝트에 아직 `.ralph/` 상태가 없으면, 첫 relevant prompt에서 Ralph가
bootstrap 할 수 있습니다.

대략 순서는 아래와 같습니다.

1. `orc init`
2. `.ralph/prd.md` 준비
   - `PRD.md`, `prd.md`, `docs/PRD.md`, `docs/prd.md`가 있으면 우선 활용
   - 없으면 첫 프롬프트 기반으로 생성
3. `orc plan`
4. 이후 일반 루프로 진행

---

## 루프는 어떻게 구성되나

### Plan
`.ralph/prd.md`를 읽어서 `.ralph/tasks.json`을 만듭니다.

각 태스크에는 단순 제목만 들어가는 것이 아니라:

- acceptance criteria
- verification hints
- context files
- estimated load
- retry 정보
- 최근 failure fingerprint

같은 정보가 함께 들어갑니다.

### Run
다음 실행 가능한 태스크를 골라 Codex에 넘깁니다.

너무 큰 태스크는 무리하게 진행하지 않고,
컨텍스트 예산을 넘으면 blocked 처리 후 다시 plan 쪽으로 되돌립니다.

### Verify
검증 명령을 실제 subprocess로 실행하고,
결과를 `.ralph/evidence/`에 저장합니다.

### Resume / Blocked
작업이 막히거나 중간에 끊기면 `orc resume`으로 이어갈 수 있고,
반복 실패나 broad task에는 split proposal이 생길 수 있습니다.

---

## 주요 명령어

| 명령어 | 설명 |
|---|---|
| `orc enable` | 현재 프로젝트를 Ralph 대상 프로젝트로 활성화 |
| `orc disable` | 현재 프로젝트 비활성화 |
| `orc status --project` | 현재 프로젝트 활성화 여부 확인 |
| `orc init` | `.ralph/` 기본 상태 파일 생성 |
| `orc plan` | PRD 기반 태스크 그래프 생성/재생성 |
| `orc run` | 다음 실행 가능한 태스크 수행 |
| `orc verify` | 현재 태스크 검증 수행 |
| `orc status` | 현재 루프 상태 확인 |
| `orc resume` | 끊기거나 막힌 작업 재개 |
| `orc plugin install` | 전역 plugin/hook 수동 설치 |
| `orc plugin status` | 전역 plugin/hook 상태 확인 |

---

## `.ralph/` 아래에 생성되는 파일

```text
.ralph/project.json         프로젝트 활성화 marker
.ralph/config.yaml          runner / verification / context 설정
.ralph/prd.md               현재 작업의 PRD
.ralph/tasks.json           태스크 그래프
.ralph/state.json           현재 phase / next action / retry 상태
.ralph/progress.md          진행 로그
.ralph/memory.json          distilled memory
.ralph/split-proposals.json broad blocked task용 split 제안
.ralph/evidence/            검증 결과 아티팩트
```

---

## 현재 제품 범위

이 프로젝트는 의도적으로 좁고 실용적인 범위를 유지합니다.

현재 초점은 다음과 같습니다.

- Codex 안에서 자연스럽게 사용하기
- PRD → task graph → run → verify → resume 흐름 유지하기
- 검증과 상태 저장을 명시적으로 다루기
- 프로젝트별 opt-in 구조로 안전하게 사용하기

즉, 거대한 오케스트레이션 플랫폼이 아니라
**Codex 장기 작업을 더 신뢰 가능하게 만드는 실용 도구**라고 보면 됩니다.

---

## 참고

- 영어 문서: [README.md](README.md)
- 릴리즈 노트: [docs/releases](docs/releases)
