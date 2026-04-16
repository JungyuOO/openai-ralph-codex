# OPENAI-Ralph-codex 한국어 안내

<p align="center">
  <img src="ralph.png" alt="Ralph" width="260" />
  <br />
  <em>작은 작업은 Codex 그대로, 큰 작업은 Ralph 루프로 구조화합니다.</em>
</p>

`openai-ralph-codex`는 Codex 안에서 큰 작업을 더 안정적으로 진행하기 위한
PRD 기반 Ralph 루프 플러그인 + CLI입니다.

핵심은 단순합니다.

- **Codex**가 실제 코드를 작성하고 수정합니다.
- **Ralph**가 작업을 PRD → 태스크 → 검증 흐름으로 구조화합니다.
- **`.ralph/`**가 현재 프로젝트 전용 상태를 저장합니다.

즉, Codex를 대체하는 도구가 아니라 **Codex 위에 올리는 작업 관리 레이어**에
가깝습니다.

---

## 빠른 시작

가장 빠른 시작 순서는 아래와 같습니다.

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

`orc`가 기본 CLI 이름이고, 기존 `ralph` alias도 호환용으로 유지됩니다.

---

## 이 도구를 어떻게 이해하면 되나

가장 간단한 멘탈 모델은 아래와 같습니다.

- **Codex**: 실제 실행 담당
- **Ralph**: 작업을 루프로 만드는 구조 담당
- **`.ralph/`**: 그 루프를 이어가기 위한 프로젝트 상태 저장소

따라서 목표는 “Codex 대신 다른 에이전트를 하나 더 쓰는 것”이 아닙니다.
목표는 **계획, 검증, 재개가 필요한 작업에서 Codex가 더 안정적으로 움직이도록
틀을 제공하는 것**입니다.

---

## 언제 Ralph를 쓰면 좋은가

다음 같은 작업에서 특히 유용합니다.

- 기능 단위 이상의 작업
- 여러 번 나눠서 진행해야 하는 작업
- 검증을 반드시 거쳐야 하는 작업
- 재시도 / blocked / resume 흐름이 필요한 작업
- PRD나 작은 태스크 단위로 쪼개서 진행하는 것이 더 안전한 작업

예를 들면:

- PRD 기반 기능 개발
- 여러 파일을 건드는 중간 규모 리팩터링
- 프로젝트 체크를 반드시 통과해야 완료로 볼 수 있는 작업
- 한 번 막히면 다시 이어서 작업해야 하는 장기 작업

반대로 아래 같은 경우는 보통 Codex만으로 충분합니다.

- 아주 작은 수정
- 짧은 질답
- 일회성 응답
- 상태 저장이나 검증이 필요 없는 작업

요약하면:

- **작은 작업**: Codex 그대로 사용
- **큰 작업**: Ralph 루프 사용

---

## 기존 단순 Ralph 루프보다 무엇이 다른가

이 구현은 “계속 진행해서 끝낸다”는 Ralph의 장점은 유지하면서,
Codex 제품처럼 쓰기 쉽게 주변 구조를 정리한 버전입니다.

### 1) 구조화된 상태 저장

진행 메모만 남기는 게 아니라 상태를 명시적으로 저장합니다.

- `.ralph/state.json` - 현재 phase, current task, next action, loop session, failure summary
- `.ralph/tasks.json` - 태스크 그래프, retry 상태, context 메타데이터, task contract, last failure
- `.ralph/progress.md` - append-only 진행 로그
- `.ralph/memory.json` - distilled memory
- `.ralph/split-proposals.json` - broad blocked task용 split 제안

그래서 루프가 끊겨도 다시 이어가기 쉽습니다.

### 2) PRD 기반 태스크 그래프

단순 “다음 할 일 목록”이 아니라,
`.ralph/prd.md`를 바탕으로 **실행 가능한 태스크 그래프**를 만듭니다.

즉, 작업을:

- 다시 읽고
- 다시 계획하고
- 다시 실행하고
- 다시 검증할 수 있는 구조로 유지합니다.

### 3) classifier 기반 라우팅

예전처럼 단순 키워드 매칭에만 의존하지 않습니다.

Codex가 현재 프롬프트 의도를 분류하고,
이미 시작된 루프는 loop session latch를 통해 더 짧고 상태 기반으로 이어집니다.

### 4) task contract

각 태스크에는 아래 정보가 같이 들어갑니다.

- acceptance criteria
- verification hints
- context files
- recent failure context

그래서 매번 “이 작업의 성공 조건이 뭐였지?”를 다시 추론하지 않고,
태스크 단위로 더 안정적으로 이어갈 수 있습니다.

### 5) adaptive prompt modes

모든 태스크를 같은 무게의 프롬프트로 보내지 않습니다.

- **small**: 작고 깔끔한 작업
- **balanced**: 일반적인 작업
- **recovery**: 실패 맥락이나 broad-risk가 있는 작업

이 모드는 사용자 설정값이 아니라 내부 동작 방식입니다.

### 6) context budget

태스크마다 context metadata를 들고 있고,
너무 큰 태스크는 그냥 밀어붙이지 않고 blocked 처리 후 다시 planning 쪽으로 돌릴 수 있습니다.

### 7) evidence 기반 verification

완료는 추측이 아니라 검증 결과로 판단합니다.

검증 명령은 실제 subprocess로 실행되고,
결과는 `.ralph/evidence/` 아래에 저장됩니다.

프로젝트 전체 verification 명령이 아직 없더라도,
태스크별 verification hints를 fallback으로 사용할 수 있습니다.

### 8) 명시적인 recovery

retry, blocked, resume을 예외 상황이 아니라 기본 흐름으로 다룹니다.

반복 실패나 broad task에는 failure fingerprint와 split proposal이 남기 때문에
다음 계획 단계가 빈 화면에서 시작되지 않습니다.

### 9) value / cost 기반 태스크 선택

실행 가능한 태스크를 단순 순서대로 고르지 않습니다.

더 좁고, 비용이 적고, downstream unlock이 큰 작업을 우선할 수 있습니다.

### 10) Codex-native 사용성

플러그인 + CLI 구조로 패키징되어 있어서,
Codex를 쓰는 흐름 안에서 Ralph가 자연스럽게 개입할 수 있습니다.

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

전역 설치가 준비하는 것:

- `~/plugins/openai-ralph-codex`
- `~/.agents/plugins/marketplace.json`
- `~/.codex/hooks.json`

만약 postinstall이 막히는 환경이라면:

```bash
orc plugin install
orc plugin status
```

로 수동 설치 / 상태 확인이 가능합니다.

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

즉, 현재 구조는:

- 전역 설치 = 준비
- 프로젝트 활성화 = 실제 사용 시작

으로 이해하면 됩니다.

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

이 플러그인이 기대하는 프롬프트 형태는 대략 아래와 같습니다.

- 기능 계획을 세워 달라는 요청
- PRD나 태스크 그래프로 바꿔 달라는 요청
- blocked work를 이어 달라는 요청
- 계속 진행 전에 검증해 달라는 요청
- 다음 bounded task를 실행해 달라는 요청

즉, “무조건 끼어드는 플러그인”이 아니라
**필요한 순간에만 Ralph 루프로 진입시키는 플러그인**입니다.

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

이 구조 덕분에:

- 새 프로젝트
- 이미 작업 중인 기존 프로젝트

둘 다 중간에 Ralph 루프를 도입할 수 있습니다.

---

## 루프는 어떻게 구성되나

### 1) Plan

`.ralph/prd.md`를 읽어서 `.ralph/tasks.json`을 만듭니다.

각 태스크에는 단순 제목만 들어가는 것이 아니라:

- acceptance criteria
- verification hints
- context files
- estimated load
- retry 정보
- 최근 failure fingerprint

같은 정보가 함께 들어갑니다.

### 2) Select

다음 실행 가능한 태스크를 고릅니다.

단순 순서대로 고르지 않고,
현재 context budget 안에 들어오면서 downstream unlock이 큰 작업을 우선할 수 있습니다.

### 3) Run

다음 실행 가능한 태스크를 골라 Codex에 넘깁니다.

너무 큰 태스크는 무리하게 진행하지 않고,
컨텍스트 예산을 넘으면 blocked 처리 후 다시 plan 쪽으로 되돌립니다.

### 4) Verify

검증 명령을 실제 subprocess로 실행하고,
결과를 `.ralph/evidence/`에 저장합니다.

저장되는 정보는 예를 들면:

- 실행한 명령
- stdout
- stderr
- exit code
- duration

입니다.

### 5) Resolve

검증 이후에는 결과에 따라 아래 중 하나로 분기합니다.

- success → 완료 처리 후 다음 태스크로 이동
- retry → retry budget이 남아 있으면 재시도 대기
- blocked → blocker를 저장하고 resume / replan 대기

### 6) Resume

작업이 막히거나 중간에 끊기면 `orc resume`으로 이어갈 수 있고,
반복 실패나 broad task에는 split proposal이 생길 수 있습니다.

---

## Prompt routing policy

현재 라우팅 정책은 대략 이렇게 보면 됩니다.

- 초기 loop 진입 → stage classifier
- 이미 시작된 loop continuation → latched continuation routing
- PRD / planning 요청 → `orc plan`
- execution 요청 → `orc run`
- verification 요청 → `orc verify`
- blocked / continue 요청 → `orc status` 후 `orc resume` 또는 `orc plan`

한 줄로 정리하면:

> 단순한 작업은 Codex, 루프가 필요한 작업은 Ralph

---

## 예시 시나리오

### 예시 1: 새 프로젝트

프롬프트:

```text
Create a PRD and plan this feature: add authentication with email login and password reset.
```

전형적인 흐름:

1. `.ralph/` 없음
2. bootstrap 실행
3. `.ralph/prd.md` 생성 또는 추론
4. `.ralph/tasks.json` 생성
5. 이후 `orc run` 쪽으로 진입

### 예시 2: 기존 프로젝트에서 blocked work 이어가기

프롬프트:

```text
Continue the blocked work in this project and tell me what should happen next.
```

전형적인 흐름:

1. 기존 `.ralph/state.json` 로드
2. 현재 blocked reason 확인
3. `orc status` 쪽으로 라우팅
4. blocked 원인에 따라 `orc resume` 또는 `orc plan`

### 예시 3: 검증 중심 작업

프롬프트:

```text
Verify the current task before we continue.
```

전형적인 흐름:

1. 현재 Ralph 상태 로드
2. verification intent 분류
3. `orc verify` 쪽으로 라우팅
4. `.ralph/evidence/`에 결과 저장

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

이 파일들이 중요한 이유는,
루프가 중간에 멈췄다가 다시 시작되어도 **어디까지 했고 다음에 무엇을 해야 하는지**
잃지 않게 해주기 때문입니다.

---

## 설계 원칙

이 프로젝트는 다음 원칙을 중심에 둡니다.

- 한 번에 하나의 bounded task
- 완료 전에 반드시 verification
- 근거 없는 완료 선언 금지
- 실패를 숨기지 않고 recovery 흐름으로 처리
- 별도 제어 평면보다 Codex-native 사용성 우선

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
