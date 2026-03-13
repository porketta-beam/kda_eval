# KDA 평가 시스템 구현 계획서

## 1. 프로젝트 개요

### 목적
KDA 교육 프로그램의 기수별 학생 평가를 유연하게 관리하는 내부 웹 애플리케이션.
평가 체계를 자유롭게 구성·변경하면서 실시간으로 총점 변화를 모니터링할 수 있는 도구.

### 핵심 요구사항 요약
| # | 요구사항 | 핵심 키워드 |
|---|---------|------------|
| 1 | 유연한 평가 체계 | 평가 방식 변경, 비중 조정, 실시간 반영 |
| 2 | 원본 데이터 보존 | 체계 변경 시에도 입력 데이터 유지 |
| 3 | 기수별 독립 | 기수 선택 네비게이션 |
| 4 | 우측 사이드바 | 접을 수 있는 총점 모니터, 누적/예상 모드 |
| 5 | 내부망 배포 | kidis.kda 도메인, 3인 사용 |
| 6 | 동시성 제어 | 3인 동시 입력/설정 변경 |
| 7 | 간단한 아키텍처 | DB 불필요, 최소 스택 |
| 8 | 정렬 기능 | 본문/사이드바 독립 정렬 |
| 9 | 중도퇴소 처리 | 체크박스, 기본 숨김, 토글 표시 |
| 10 | 동적 평가 항목 | 항목 추가/삭제, 방식 설정 |
| 11 | 기수 복제 | 기존 기수 포맷 → 새 기수 |
| 12 | Playwright 테스트 | 2기 데이터로 E2E 테스트 |
| 13 | 디자인 토큰 분리 | 색상/radius 등 비레이아웃 스타일을 토큰 파일로 분리하여 AI 코딩 시 토큰 절약 |

---

## 2. 아키텍처

### 2-1. 기술 스택

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
│  Next.js App Router + JavaScript        │
│  Tailwind CSS + shadcn/ui               │
├─────────────────────────────────────────┤
│           Backend (API Routes)          │
│  Next.js Route Handlers                 │
│  WebSocket (Socket.io) for live sync    │
├─────────────────────────────────────────┤
│           Storage (JSON Files)          │
│  data/{cohort_id}/config.json           │
│  data/{cohort_id}/students.json         │
│  data/{cohort_id}/scores.json           │
│  data/app_config.json                   │
└─────────────────────────────────────────┘
```

### 선정 근거

| 결정 | 이유 |
|------|------|
| **JavaScript (+ JSDoc)** | TypeScript 빌드 단계 제거. JSDoc으로 에디터 자동완성/타입힌트 확보. `schema.js` 단일 파일로 전체 구조 파악. 기수 ID는 UUID 자동 생성 |
| **Next.js (단일 프로젝트)** | 프론트+백엔드 통합, 배포 단순, API Routes로 별도 서버 불필요 |
| **JSON 파일 저장** | 기수당 데이터 ~수십KB, DB 과잉. 백업=폴더 복사. 사람이 읽을 수 있음 |
| **WebSocket (Socket.io)** | 3인 동시 작업 시 실시간 동기화. 사이드바 라이브 업데이트 |
| **Tailwind + shadcn/ui** | 빠른 UI 개발. 디자인 토큰 분리와 궁합 좋음 |
| **디자인 토큰 파일 분리** | 색상·radius·shadow 등을 `tokens.css`로 격리 → AI 코딩 시 불필요한 컨텍스트 제거 |

### 대안 비교

| 방식 | 장점 | 단점 | 판정 |
|------|------|------|------|
| Next.js 풀스택 (JS) | 단일 프로젝트, 배포 간편, 빌드 단순 | SSR 학습 필요 | **채택** |
| Next.js + TypeScript | 타입 안전성 | 빌드 단계 추가, AI 토큰 소모 증가 | 대안 |
| React + FastAPI | 백엔드 분리, Python 친화 | 프로젝트 2개 관리 | 대안 |
| SQLite | 동시성 우수 | "DB 불필요" 요구사항과 상충 | 미채택 |

### 2-2. 프로젝트 구조

```
kda_eval/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.js                     # 전체 레이아웃 (Navbar + SocketProvider)
│   │   ├── page.js                       # 기수 관리 홈 (생성, 복제, 삭제)
│   │   ├── cohort/[id]/
│   │   │   ├── layout.jsx                # 기수 레이아웃 (탭 + 사이드바 + CohortDataContext, 메인 콘텐츠 w-[80%] 중앙정렬)
│   │   │   ├── page.jsx                  # ★ 총점 대시보드 (SummaryTable + 항목 관리 Collapsible + 집계 설정)
│   │   │   ├── students/page.jsx         # 학생 명단 관리 + 팀 관리
│   │   │   └── eval/[categoryId]/
│   │   │       └── page.jsx              # ★ 항목별 점수 입력 (리프: ScoreTable, 복합: SummaryTable) + 인라인 설정 + FieldManager + ConflictDialog
│   │   └── api/
│   │       └── cohorts/
│   │           ├── route.js              # GET/POST (목록, 생성 — UUID 자동, 이름 중복 체크)
│   │           └── [id]/
│   │               ├── route.js          # GET/PUT/DELETE
│   │               ├── clone/route.js    # POST (복제 — UUID 자동, 이름 중복 체크)
│   │               ├── config/
│   │               │   ├── route.js      # GET/PUT (설정 전체 업데이트)
│   │               │   └── categories/
│   │               │       ├── route.js  # POST (카테고리 추가 + 기본 input_fields 자동 생성)
│   │               │       └── [categoryId]/route.js  # PUT/DELETE
│   │               ├── students/
│   │               │   ├── route.js      # GET/POST (단일/일괄 추가)
│   │               │   └── [studentId]/route.js       # PUT/DELETE
│   │               ├── scores/
│   │               │   ├── route.js      # GET (원본 + 계산 결과)
│   │               │   └── [categoryId]/route.js      # PUT (점수 저장)
│   │               ├── results/route.js  # GET ?mode=projected (총점/순위 계산)
│   │               └── export/route.js   # GET ?type=summary|detail (CSV 내보내기)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx                # 상단 네비게이션 (기수 선택 + CSV 내보내기 드롭다운)
│   │   │   ├── Sidebar.jsx               # 우측 총점 사이드바 (접기/드래그 리사이즈 180~500px, 누적/예상 모드)
│   │   │   └── SlidePanel.jsx            # ★ 하위 항목 슬라이드 오버 패널
│   │   ├── eval/
│   │   │   ├── ScoreTable.jsx            # 점수 입력 테이블 (리프 항목 전용, min-w-[60%] w-fit)
│   │   │   ├── SummaryTable.jsx          # ★ 읽기 전용 총점/복합 테이블 (대시보드 + 복합 카테고리 공용, min-w-[60%] w-fit)
│   │   │   ├── InlineSettings.jsx        # ★ 인라인 설정 패널 (방식별 동적 폼)
│   │   │   ├── FieldManager.jsx          # ★ 항목 관리 Collapsible (leaf: input_fields, composite: sub_categories)
│   │   │   └── CategoryCard.jsx          # 카테고리 카드 (목록용, 삭제/순서 변경 버튼 포함)
│   │   ├── common/
│   │   │   └── ConflictDialog.jsx        # 낙관적 잠금 충돌 다이얼로그
│   │   └── ui/                           # shadcn/ui 컴포넌트
│   │
│   ├── hooks/
│   │   ├── CohortDataContext.js          # React Context
│   │   └── useCohortData.js              # ★ 데이터 fetch + WebSocket 동기화
│   │
│   ├── lib/
│   │   ├── schema.js                     # ★ 전체 데이터 구조 정의 (SSOT)
│   │   ├── scoring-engine/               # 점수 계산 엔진
│   │   │   ├── index.js                  # calculateTotals, calculateProjectedScores
│   │   │   └── methods/                  # 8가지 평가 방식
│   │   │       ├── weighted-average.js
│   │   │       ├── sum-divide.js
│   │   │       ├── rank-differential.js
│   │   │       ├── formula.js
│   │   │       ├── boolean.js
│   │   │       ├── boolean-with-deduction.js
│   │   │       ├── user-input.js
│   │   │       └── composite.js
│   │   ├── services/                     # ★ 비즈니스 로직 서비스 레이어
│   │   │   ├── cohort-service.js         # 기수 CRUD, 복제
│   │   │   ├── config-service.js         # 평가 체계 설정 관리 (+ 기본 input_fields 생성)
│   │   │   ├── student-service.js        # 학생 CRUD, 중도퇴소
│   │   │   ├── score-service.js          # 점수 입력/조회, 계산 오케스트레이션
│   │   │   └── export-service.js         # CSV 내보내기 (요약/상세)
│   │   ├── storage/
│   │   │   ├── file-store.js             # JSON 파일 I/O
│   │   │   └── locking.js               # 낙관적 잠금 (async-mutex)
│   │   └── websocket/
│   │       ├── SocketProvider.jsx        # React WebSocket provider
│   │       └── socket-client.js          # Socket.io 클라이언트
│   │
│   └── styles/
│       └── tokens.css                    # ★ 디자인 토큰 (색상, radius, shadow)
│
├── data/                                 # 데이터 저장소 (git 제외)
│   └── cohorts/
│       └── <uuid>/                       # UUID 기반 기수 디렉토리
│           ├── config.json
│           ├── students.json
│           └── scores.json
│
├── tests/
│   ├── scoring-engine.test.js            # 계산 엔진 단위 테스트
│   └── e2e/
│       └── kda-workflow.spec.js           # Playwright E2E 워크플로우 (10개 테스트)
│
├── server.js                             # Socket.io + Next.js 커스텀 서버
├── jsconfig.json                         # 경로 별칭 (@/)
├── next.config.mjs
├── package.json
├── playwright.config.js
└── tailwind.config.mjs
```

### 2-3. 레이어 구조

```
 API Route ──► Service ──► Storage (file-store)
    │              │              │
    │              ├── schema.js (구조 참조)
    │              └── scoring-engine (계산 위임)
    │
 Component ──► Service (직접 호출 또는 API fetch)
```

- **`schema.js`**: 전체 데이터 구조의 단일 진실 공급원 (Single Source of Truth). 이 파일만 보면 모든 설정/데이터 구조 파악 가능
- **`services/`**: 비즈니스 로직 캡슐화. API Route는 얇은 컨트롤러 역할만 수행
- **`storage/`**: JSON 파일 I/O + 잠금. 서비스에서만 호출

---

## 3. 데이터 모델

> 모든 구조는 `src/lib/schema.js` 단일 파일에 JSDoc으로 정의.
> 이 파일 하나만 읽으면 전체 데이터 구조를 파악할 수 있음.

### 3-1. schema.js 개요

```javascript
// src/lib/schema.js
// ============================================================
// KDA 평가 시스템 — 전체 데이터 구조 정의
// 이 파일 하나로 모든 설정·데이터 구조를 파악할 수 있습니다.
// ============================================================

// ─── 상수 ────────────────────────────────────────────────────

/** 평가 방식 열거 */
export const SCORING_METHOD = {
  WEIGHTED_AVERAGE: 'weighted_average',       // 가중평균: AVERAGE(항목들) × multiplier
  SUM_DIVIDE: 'sum_divide',                   // 합산: SUM(항목들) / divisor
  RANK_DIFFERENTIAL: 'rank_differential',     // 순위 차등배점
  FORMULA: 'formula',                         // 커스텀 공식 (출석률 등)
  BOOLEAN: 'boolean',                         // 해당 여부 (0 or fixed_score)
  BOOLEAN_WITH_DEDUCTION: 'boolean_with_deduction', // Boolean + 차감 (출석 가산점)
  USER_INPUT: 'user_input',                   // 사용자 직접 입력
  COMPOSITE: 'composite',                     // 복합 (하위 항목 조합)
};

export const INPUT_FIELD_TYPE = {
  NUMBER: 'number',
  TEXT: 'text',
  BOOLEAN: 'boolean',
  SELECT: 'select',
};

export const INPUT_SCOPE = {
  STUDENT: 'student',   // 학생별 입력
  TEAM: 'team',         // 팀별 입력 (팀원 동일값)
};


// ─── 기수 설정 (config.json) ─────────────────────────────────

/**
 * @typedef {Object} CohortConfig
 * @property {string} id              - 기수 식별자 (UUID)
 * @property {string} name            - 표시 이름 ("KDA 2기")
 * @property {string} created_at
 * @property {string|null} cloned_from - 복제 원본 기수 ID
 * @property {number} version         - 낙관적 잠금용
 * @property {Team[]} teams
 * @property {EvaluationCategory[]} evaluation_categories
 * @property {AggregationSettings} [aggregation_settings] - 총점 집계 설정
 */

/**
 * @typedef {Object} AggregationSettings
 * @property {'sum'|'weighted'} method  - 집계 방식 (단순 합산/가중 합산)
 * @property {number} max_score         - 기본 만점
 * @property {number} bonus_limit       - 가산점 한도
 */

/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name            - "보험팀", "1팀-KFC" 등
 * @property {string[]} members       - student_id 배열
 */

/**
 * @typedef {Object} EvaluationCategory
 * @property {string} id
 * @property {string} name            - "출석률", "1차 프로젝트" 등
 * @property {number} order           - 표시 순서
 * @property {number} max_score       - 만점
 * @property {boolean} is_bonus       - 가산점 여부
 * @property {string} scoring_method  - SCORING_METHOD 값
 * @property {Object} config          - 방식별 세부 설정 (아래 참조)
 * @property {InputField[]} input_fields - 입력 필드 정의
 * @property {EvaluationCategory[]} [sub_categories] - 하위 항목 (재귀)
 */


// ─── 평가 방식별 설정 ────────────────────────────────────────

/**
 * @typedef {Object} WeightedAverageConfig
 * @property {number} multiplier      - 예: 2 (수업참여도: AVERAGE×2)
 * @property {boolean} exclude_empty  - 빈 값 제외 여부
 */

/**
 * @typedef {Object} SumDivideConfig
 * @property {number} divisor         - 예: 10 (협업및태도: SUM/10)
 */

/**
 * @typedef {Object} RankDifferentialConfig
 * @property {'team'|'all'} scope     - 팀내 순위 vs 전체 순위
 * @property {number} top_score       - 1위 점수
 * @property {number} interval        - 점수 간격
 * @property {boolean} has_floor      - 하한 적용 여부
 * @property {number} [floor_value]   - 하한값
 * @property {'weighted_sum'|'direct'} rank_source - 순위 산출 방식
 * @property {Object<string, number>} [weights]    - 가중합 가중치
 */

/**
 * @typedef {Object} FormulaConfig
 * @property {string} formula_type    - "attendance_deduction" 등
 * @property {Object<string, number>} params - { base: 20, threshold: 90, cap: 10 }
 */

/**
 * @typedef {Object} BooleanConfig
 * @property {number} true_score      - 충족 시 점수
 * @property {number} false_score     - 미충족 시 점수
 */

/**
 * @typedef {Object} BooleanWithDeductionConfig
 * @property {number} base_score      - 기본 점수 (2)
 * @property {DeductionRule[]} deduction_rules
 */

/**
 * @typedef {Object} DeductionRule
 * @property {string} field_id        - "absence_official"
 * @property {number} per_count       - 몇 개당 차감 (결석: 1, 지각: 3)
 * @property {number} deduction       - 차감값 (0.1)
 */

/**
 * @typedef {Object} CompositeConfig
 * @property {string} final_formula   - "(sub1 + sub2) * 15 / 100"
 * @property {EvaluationCategory[]} sub_categories
 */

/**
 * @typedef {Object} InputField
 * @property {string} id
 * @property {string} name
 * @property {string} type            - INPUT_FIELD_TYPE 값
 * @property {string} per             - INPUT_SCOPE 값
 * @property {number} [min]
 * @property {number} [max]
 * @property {Array<{label: string, value: *}>} [options]
 */


// ─── 학생 데이터 (students.json) ─────────────────────────────

/**
 * @typedef {Object} StudentsData
 * @property {number} version
 * @property {Student[]} students
 */

/**
 * @typedef {Object} Student
 * @property {string} id              - UUID
 * @property {string} name
 * @property {string|null} team_id
 * @property {boolean} is_dropout     - 중도퇴소 여부
 * @property {string} [dropout_date]
 * @property {string} [memo]
 */


// ─── 점수 데이터 (scores.json) ───────────────────────────────

/**
 * @typedef {Object} ScoresData
 * @property {number} version
 * @property {Object<string, Object<string, Object<string, number|boolean|string>>>} raw_scores
 *   구조: { [category_id]: { [student_id]: { [field_id]: value } } }
 */


// ─── 팩토리 함수 ────────────────────────────────────────────

/** 빈 기수 설정 생성 */
export function createEmptyCohortConfig(id, name) {
  return {
    id,
    name,
    created_at: new Date().toISOString(),
    cloned_from: null,
    version: 1,
    teams: [],
    evaluation_categories: [],
  };
}

/** 빈 학생 데이터 생성 */
export function createEmptyStudentsData() {
  return { version: 1, students: [] };
}

/** 빈 점수 데이터 생성 */
export function createEmptyScoresData() {
  return { version: 1, raw_scores: {} };
}
```

**핵심 설계 원칙**: `scores.json`은 **원본 입력값만** 저장. 환산 점수는 저장하지 않고 scoring engine이 config + raw_scores로 **실시간 계산**.

---

## 4. 점수 계산 엔진

### 4-1. 구조

```
입력: EvaluationCategory (설정) + raw_scores (원본) + students (명단)
  ↓
scoringEngine.calculate(category, rawScores, students)
  ↓
출력: { [student_id]: { raw: 값, calculated: 환산점수 } }
```

### 4-2. 계산 흐름 (2기 기준 예시)

```
[출석률]
  입력: 출석률(%) → formula(attendance_deduction) → 20점 만점

[1차 프로젝트]
  ├─ [팀 평가] 강사3+학생1 → weighted_sum → rank → rank_differential(60점, 간격5, 하한없음)
  ├─ [개인 평가] 강사3+타팀+동팀 → weighted_sum → rank → rank_differential(40점, 간격5, 하한20)
  └─ composite: (팀 + 개인) × 15 / 100

[2차 프로젝트]
  ├─ 키움평가(팀, 60) + 학생평가(팀, 10)
  ├─ [팀내 평가] 5항목+추천 → weighted_sum → rank → rank_differential(30점, 간격5, 하한10)
  └─ composite: (키움 + 학생 + 팀내) / 100 × 20

[수업참여도] 6과목 → weighted_average(multiplier=2, exclude_empty=true)
[협업및태도] 9항목 → sum_divide(divisor=10)
[성장가능성] 6과목 → weighted_average(multiplier=1, exclude_empty=true)
[동료추천]   → user_input (운영자 수동 배정)
[출석가산점] → boolean_with_deduction(base=2, 공과차감규칙)
[복수강사추천] → boolean(true=1, false=0)

총점 = SUM(all categories)
순위 = RANK(총점, descending)
```

### 4-3. 예상 점수 모드

사이드바에서 "예상 점수" 옵션 선택 시:
- 아직 입력되지 않은 항목은 **전체 평균값** 또는 **중앙값**으로 대체
- 입력 완료된 항목은 실제 값 사용
- 예상 점수 컬럼을 별도로 표시 (실 점수와 구분)

---

## 5. UI 설계

### 5-0. 디자인 토큰 분리 전략 (요구사항 13)

레이아웃(구조, 배치, 크기)과 비주얼 스타일(색상, radius, shadow)을 분리한다.

```css
/* src/styles/tokens.css — 이 파일은 AI 코딩 시 컨텍스트에서 제외 가능 */
:root {
  /* 색상 */
  --color-primary: ...;
  --color-sidebar-bg: ...;
  --color-dropout-row: ...;
  --color-projected-text: ...;

  /* 모서리 */
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;

  /* 그림자 */
  --shadow-card: ...;
  --shadow-panel: ...;

  /* 기타 비주얼 */
  --border-table: ...;
  --opacity-disabled: ...;
}
```

**규칙**:
- 컴포넌트 코드에서 색상·radius·shadow를 직접 쓰지 않고 CSS 변수(토큰) 참조
- `tailwind.config.js`의 `theme.extend`에서 토큰을 Tailwind 클래스로 매핑
- AI에게 레이아웃 작업을 요청할 때 `tokens.css`를 컨텍스트에서 제외하면 토큰 절약
- 디자인 수정 시 `tokens.css`만 변경하면 전체 앱에 반영

### 5-1. 네비게이션 구조: 페이지별 테이블

평가 항목의 트리 깊이가 2를 초과하므로 (예: 1차 프로젝트 → 개인평가 → 입력필드), **탭 기반 좌우 전환은 부적합**. Notion처럼 **각 테이블이 하나의 페이지**를 구성하고, **하위 항목은 슬라이드 패널**로 드릴다운.

```
항목 트리 예시:
총점 (root)
├── 출석률 (leaf)                    → 페이지: 바로 테이블
├── 1차 프로젝트 (composite)          → 페이지: 서브항목 테이블
│   ├── 팀 평가 (rank_differential)   → 슬라이드 패널 → 전체 페이지 가능
│   │   └── 입력필드들 (depth 3)      → 패널 내 드릴다운
│   └── 개인 평가 (rank_differential) → 슬라이드 패널
│       └── 입력필드들 (depth 3)
├── 2차 프로젝트 (composite)
│   ├── 키움평가 (direct)
│   ├── 학생평가 (direct)
│   └── 팀내 평가 (rank_differential) → 슬라이드 패널
└── ... (leaves)
```

### 5-2. 총점 대시보드 (기수 메인 페이지)

경로: `/cohort/[id]`

```
┌──────────────────────────────────────────────────────────────┐
│ [KDA] 평가 시스템      기수: [2기 ▼]           [내보내기↗]  │
├────────────────────────────────────────────────────┬─────────┤
│                                                    │ 총점 ◀  │
│ ┌─ ⚙ 총점 집계 설정 ──────────────────── [접기] ─┐│(접기)   │
│ │ 집계 방식: [단순 합산 ▼]                        ││         │
│ │ 기본 만점: [100]  가산점 한도: [3]              ││ 정렬:[▼]│
│ └─────────────────────────────────────────────────┘│         │
│                                                    │ 한현비  │
│ 학생: 28명 (중도퇴소 6명)                          │  95.2   │
│ ☐ 중도퇴소 인원 표시                               │ 윤세인  │
│                                                    │  93.1   │
│ ┌─── 총점 (SummaryTable) ────────────────────┐   │ 오준협  │
│ │ 이름↕│출석률(20)↕│1차(15)↕│...│총점↕│순위↕│   │  88.5   │
│ │──────│──────────│────────│───│─────│─────│   │  ...    │
│ │강일구 │  20.0    │  13.5  │...│95.2 │  1  │   │         │
│ │강주연 │  20.0    │  12.0  │...│93.1 │  2  │   │         │
│ │ ...  │   ...    │   ...  │...│ ... │ ... │   │         │
│ └────────────────────────────────────────────┘   │         │
│ ※ 칼럼 헤더/셀 클릭 → 해당 카테고리 페이지로 이동 │         │
│                                                    │         │
│ ┌─ ▶ 항목 관리 ───────────────────── [Collapsible]│ 모드:   │
│ │ 평가 항목             만점  방식      진행률  │  │ ◉ 누적  │
│ │──────────────────────────────────────────────│  │ ○ 예상  │
│ │ ▶ 출석률              20   공식       ████  │  │         │
│ │ ▶ 1차 프로젝트        15   복합       ██░░  │  │         │
│ │ ▶ 2차 프로젝트        20   복합       █░░░  │  │         │
│ │ ▶ 수업참여도          20   가중평균   ████  │  │         │
│ │ ▶ 협업 및 태도        10   합산       ███░  │  │         │
│ │ ▶ 성장가능성          10   가중평균   ████  │  │         │
│ │ ▶ 동료추천             5   수동입력   ░░░░  │  │         │
│ │ ▶ 출석 가산점          2   차감법     ████  │  │         │
│ │ ▶ 복수강사추천         1   Boolean    ████  │  │         │
│ │                                              │  │         │
│ │ [+ 평가항목 추가]                            │  │         │
│ └──────────────────────────────────────────────┘  │         │
├────────────────────────────────────────────────────┴─────────┤
│ 마지막 저장: 2026-03-12 14:30 | 동시 접속: 3명              │
└──────────────────────────────────────────────────────────────┘
```

- **SummaryTable**: 학생 × 카테고리 점수 + 총점 + 순위를 한눈에 표시. 칼럼 헤더/셀 클릭 시 해당 카테고리 eval 페이지로 이동. 가산점 칼럼에는 Badge 표시. 모든 칼럼 정렬 가능
- **항목 관리**: Collapsible로 접혀 있으며, 펼치면 CategoryCard 리스트 + 추가 버튼 표시
- 상단 **⚙ 총점 집계 설정**: 하위 항목들을 어떻게 합산할지 (단순합산, 가중합산 등) 설정

### 5-3. 평가 항목 페이지 (인라인 설정 포함)

경로: `/cohort/[id]/eval/[categoryId]`

#### 리프 항목 (예: 출석률)
```
┌──────────────────────────────────────────────────────────────┐
│ [KDA] 평가 시스템      기수: [2기 ▼]           [내보내기↗]  │
├────────────────────────────────────────────────────┬─────────┤
│                                                    │ 총점 ◀  │
│ ◀ 평가 항목 목록  ›  출석률                        │         │
│                                                    │         │
│ ┌─ ⚙ 설정 ──────────────────────────────  [접기] ─┐│         │
│ │ 만점: [20]  방식: [공식(차감법) ▼]               ││         │
│ │ 기준출석률: [90]  차감한도: [10]  가산점: ☐      ││         │
│ │ 입력필드: [출석률(%)] number, per student         ││         │
│ └──────────────────────────────────────────────────┘│         │
│                                                    │         │
│ ☐ 중도퇴소 인원 표시                               │         │
│ ┌─────────────────────────────────────────────┐   │         │
│ │ 이름 ↕ │ 출석률(%) ↕ │ 버림  │ 차감  │ 점수 │   │         │
│ │────────│────────────│──────│──────│──────│   │         │
│ │ 강일구 │   91.7     │  91  │   0  │  20  │   │         │
│ │ 강주연 │   90.3     │  90  │   0  │  20  │   │         │
│ │  ...   │    ...     │ ...  │ ...  │ ...  │   │         │
│ └─────────────────────────────────────────────┘   │         │
├────────────────────────────────────────────────────┴─────────┤
│ 마지막 저장: 2026-03-12 14:30 | 동시 접속: 3명              │
└──────────────────────────────────────────────────────────────┘
```

#### 복합 항목 (예: 1차 프로젝트) — SummaryTable 사용
```
┌──────────────────────────────────────────────────────────────┐
│ ◀ 평가 항목 목록  ›  1차 프로젝트                            │
│                                                              │
│ ┌─ ⚙ 설정 ──────────────────────────────────────── [접기] ─┐│
│ │ 만점: [15]  방식: [복합(composite) ▼]                     ││
│ │ 최종 공식: [(팀평가 + 개인평가) × 15 / 100]               ││
│ │ [+ 하위 항목 추가]                                        ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ SummaryTable (showRank=false)                                │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 이름 ↕ │ 팀평가(60) ↕ │ 개인평가(40) ↕ │ 총점 ↕    │   │
│ │────────│─────────────│───────────────│────────────│   │
│ │ 강일구 │     55.0    │      35.0     │    13.5    │   │
│ │ 강주연 │     50.0    │      30.0     │    12.0    │   │
│ │  ...   │     ...     │      ...      │    ...     │   │
│ └───────────────────────────────────────────────────────┘   │
│ ※ 하위에 sub_categories가 있는 칼럼은 클릭 가능 → 슬라이드  │
│   패널 열림 (리프 칼럼은 클릭 불가, 일반 텍스트 표시)        │
└──────────────────────────────────────────────────────────────┘
```
- 복합 항목은 ScoreTable 대신 **SummaryTable** 렌더링 (읽기 전용, 순위 미표시)
- 대시보드의 SummaryTable과 동일 컴포넌트 재사용
- 테이블 아래 **FieldManager** Collapsible: leaf → input_fields 추가/삭제/순서변경, composite → sub_categories 추가/삭제/순서변경
- 테이블 너비: `min-w-[60%] w-fit` — 최소 60%, 내용에 따라 확장, 100% 초과 시 횡스크롤
- 메인 콘텐츠 영역: `w-[80%] mx-auto` 중앙정렬
- **데이터 입력 기능**: 중도퇴소자도 입력 가능, Enter로 다음 행 이동, 엑셀 칼럼 붙여넣기 지원, number input 스피너 숨김

### 5-4. 슬라이드 패널 (하위 항목 드릴다운)

하위 항목의 ▶ 값을 클릭하면 우측에서 슬라이드 패널이 열림.

```
┌─── 본문 페이지 (1차 프로젝트) ────┬── 슬라이드 패널 ──────────┐
│                                    │                            │
│ ◀ 평가 항목 목록 › 1차 프로젝트   │ ◀ 1차 프로젝트 › 팀 평가  │
│                                    │                    [⛶전체] │
│ ⚙ 설정 (접힌 상태)               │                            │
│                                    │ ⚙ 설정                    │
│ ┌────────────────────────┐        │ 만점: [60]  방식: [순위 ▼] │
│ │ 이름 │ 팀평가 │개인│최종│        │ 1위=[60] 간격=[5] 하한=없음│
│ │ 강일구│ ▶ 55  │...│...│        │ 순위산출: [가중합 ▼]       │
│ │ 강주연│ ▶ 50  │...│...│        │ 장원영=[30] 문혜영=[15]    │
│ │  ... │  ...  │...│...│        │ 이정수=[15] 학생=[10]      │
│ │      │       │   │   │        │                            │
│ │      │       │   │   │        │ ┌──────────────────────┐  │
│ │      │       │   │   │        │ │이름 ↕│순위│ 점수    │  │
│ │      │       │   │   │        │ │──────│────│────────│  │
│ │      │       │   │   │        │ │ 강일구│  1 │   60   │  │
│ │      │       │   │   │        │ │ 강주연│  2 │   55   │  │
│ │      │       │   │   │        │ │  ... │ .. │  ...   │  │
│ │      │       │   │   │        │ └──────────────────────┘  │
│ └────────────────────────┘        │                            │
└────────────────────────────────────┴────────────────────────────┘
```

#### 슬라이드 패널 기능

| 기능 | 동작 |
|------|------|
| **[⛶ 전체]** 버튼 | 슬라이드 패널 → 전체 페이지로 전환 (URL 이동) |
| **패널 내 하위 항목 클릭** | 패널 내용이 해당 하위 항목으로 교체 (패널 내 네비게이션) |
| **◀ 버튼** | 상위 항목으로 복귀 (패널 내 뒤로가기) |
| **브레드크럼** | `1차 프로젝트 › 팀 평가 › [현재]` — 어느 레벨이든 클릭으로 이동 |
| **패널 닫기** | 패널 외부 클릭 또는 ESC |

#### 깊이 2+ 드릴다운 시나리오

```
패널: 팀 평가
  → 가중합 입력 항목 중 "학생평가" 클릭
    → 패널이 "학생평가" 상세로 교체
    → 브레드크럼: 1차 프로젝트 › 팀 평가 › 학생평가
    → ◀ 클릭하면 "팀 평가"로 복귀
```

### 5-5. 우측 사이드바

**드래그 리사이즈**: 좌측 경계를 드래그하여 너비 조절 (180px ~ 500px, 기본 224px). `shrink-0`으로 메인 콘텐츠와 독립적인 크기 유지.

**누적 모드 (기본)**:
- 현재까지 입력된 항목만 합산
- 미입력 항목은 "-"로 표시
- 진행률 표시 (예: "5/9 항목 입력 완료")

**예상 모드**:
- 미입력 항목을 전체 평균으로 추정
- 예상 점수는 별도 색상(토큰: `--color-projected-text`)으로 구분
- "예상 순위"도 함께 표시

---

## 6. 동시성 제어

### 6-1. 전략: 낙관적 잠금 + WebSocket 동기화

```
┌─────────┐    WebSocket     ┌──────────┐    WebSocket     ┌─────────┐
│ 사용자A │ ◄──────────────► │  서버    │ ◄──────────────► │ 사용자B │
│ (브라우저)│                  │ (Next.js)│                  │(브라우저)│
└─────────┘                  └──────────┘                  └─────────┘
                                  │
                            ┌─────┴─────┐
                            │ JSON Files │
                            │ (+ version)│
                            └───────────┘
```

### 6-2. 동작 방식

1. **데이터 로드**: 클라이언트가 데이터 + `version` 번호를 받음
2. **데이터 수정**: 수정 요청 시 `expected_version`을 함께 전송
3. **서버 검증**:
   - `expected_version === current_version` → 저장 성공, version++
   - `expected_version !== current_version` → 충돌 발생, 거부
4. **충돌 시**: 클라이언트에 최신 데이터 전송, 사용자에게 병합 UI 표시
5. **WebSocket 브로드캐스트**: 저장 성공 시 다른 클라이언트에 변경 알림

### 6-3. 파일 접근 잠금

```javascript
// src/lib/storage/locking.js
import { Mutex } from 'async-mutex';

const fileMutexes = new Map();

/**
 * @param {string} filePath
 * @param {Object} data
 * @param {number} expectedVersion
 */
export async function writeWithLock(filePath, data, expectedVersion) {
  const mutex = fileMutexes.get(filePath) ?? new Mutex();
  fileMutexes.set(filePath, mutex);

  return mutex.runExclusive(async () => {
    const current = await readJSON(filePath);
    if (current.version !== expectedVersion) {
      throw new ConflictError(current);
    }
    data.version = current.version + 1;
    await writeJSON(filePath, data);
    return data;
  });
}
```

### 6-4. 세분화된 잠금 단위

| 작업 | 잠금 범위 | 충돌 가능성 |
|------|-----------|------------|
| 점수 입력 (항목별) | `scores.json` 내 category 단위 | 낮음 (다른 항목 편집 시) |
| 평가 체계 변경 | `config.json` 전체 | 중간 |
| 학생 명단 변경 | `students.json` 전체 | 낮음 |

실제로 3인이 동시에 **같은 항목**을 편집할 확률은 매우 낮으므로, category 단위 낙관적 잠금으로 충분.

---

## 7. 내부망 배포 (kidis.kda)

### 7-1. 네트워크 구성

```
[사용자 PC 1] ──┐
[사용자 PC 2] ──┼── 공유기 (게이트웨이) ── [서버 PC: 고정 IP 192.168.0.100]
[사용자 PC 3] ──┘
```

### 7-2. kidis.kda 도메인 접근 방법

#### 방법 A: hosts 파일 수정 (가장 간단, 권장)

각 사용자 PC의 hosts 파일에 추가:
```
# Windows: C:\Windows\System32\drivers\etc\hosts
192.168.0.100    kidis.kda
```
- 장점: 즉시 적용, 설정 간단, 어떤 공유기든 가능
- 단점: 각 PC마다 설정 필요 (3대라 부담 없음)

#### 방법 B: 공유기 DNS 설정

대부분의 가정/사무용 공유기(ipTIME 포함)는 커스텀 DNS 엔트리를 직접 추가하는 기능이 **없음**.
단, 일부 고급 공유기(OpenWrt, ASUS Merlin 펌웨어)는 dnsmasq 설정으로 가능:
```
# 공유기 dnsmasq 설정
address=/kidis.kda/192.168.0.100
```
- 장점: 모든 PC에 자동 적용
- 단점: 공유기 모델 의존적, ipTIME은 미지원

#### 방법 C: 서버에서 DNS 서버 실행

서버 PC에서 dnsmasq 실행:
```
# dnsmasq 설정
address=/kidis.kda/192.168.0.100
```
공유기 DHCP 설정에서 DNS 서버를 192.168.0.100으로 변경.
- 장점: 중앙 관리
- 단점: 서버 추가 소프트웨어, DNS 장애 시 인터넷 불가 위험

#### 방법 D: Pi-hole (DNS 싱크홀 + 커스텀 DNS)

Pi-hole을 서버 PC에 Docker로 설치하고 Local DNS Records에 `kidis.kda → 192.168.0.100` 추가.
공유기 DHCP DNS를 Pi-hole IP로 변경.
- 장점: 광고 차단 + 커스텀 DNS 동시 해결, Web UI 관리
- 단점: Docker 필요, 과잉 설정일 수 있음

#### 참고: `.kda` TLD 사용 시 주의
`.kda`는 IANA에 등록되지 않은 TLD이므로 내부망에서 자유롭게 사용 가능하나,
ICANN은 내부 전용 TLD로 `.internal`을 권장 (RFC 진행 중).
현재 `.kda`가 충돌할 가능성은 극히 낮으므로 그대로 사용해도 무방.

#### 권장: 방법 A (hosts 파일)
3대 PC에 한 줄만 추가하면 되므로 가장 실용적.

### 7-3. 서버 실행

```bash
# 서버 PC에서
cd kda-eval
npm run build
npm run start -- -p 80    # 또는 포트 3000 + hosts에 포트 포함

# PM2로 백그라운드 실행 (자동 재시작)
pm2 start npm --name "kda-eval" -- start -- -p 80
```

포트 80 사용 시: `http://kidis.kda` 로 바로 접근
포트 3000 사용 시: `http://kidis.kda:3000` 으로 접근

---

## 8. 핵심 기능 상세

### 8-1. 평가 항목 동적 관리 (요구사항 10)

총점 대시보드에서 `[+ 평가항목 추가]` 클릭 시:
1. 항목명 입력
2. 만점 설정
3. 평가 방식 선택 (드롭다운)
4. 방식별 파라미터 설정 (동적 폼)
5. 입력 필드 정의 (이름, 타입, 학생별/팀별)
6. 저장 → config.json 업데이트

항목 삭제 시:
- config에서만 제거
- scores.json의 해당 데이터는 **보존** (soft delete)
- "삭제된 항목 데이터 복구" 기능 제공 가능

### 8-2. 인라인 설정 (요구사항 3 연관)

각 평가 항목 페이지 상단에 접이식 설정 패널:
- **리프 항목**: 만점, 평가 방식, 방식별 파라미터, 입력 필드 정의
- **복합 항목**: 최종 공식, 하위 항목 목록 및 가중치
- **총점 대시보드**: 집계 방식 (단순합산/가중합산), 기본만점, 가산점 한도
- 설정 변경 시 → 해당 페이지 테이블의 계산 결과가 **즉시 재계산** → 사이드바도 실시간 반영

### 8-3. 기수 복제 (요구사항 11)

```
[새 기수 만들기] → [빈 기수 | 기존 기수 복제]
                             ↓
                    기수 선택: [2기 ▼]
                             ↓
                    복제 대상 선택:
                    ☑ 평가 체계 (config)
                    ☑ 팀 구조
                    ☐ 학생 명단
                    ☐ 점수 데이터
                             ↓
                    [3기] 생성 완료
```

### 8-4. 정렬 기능 (요구사항 8)

- 모든 테이블 헤더에 정렬 토글 (↑↓)
- **본문 테이블**: 현재 보고 있는 평가 항목 기준 정렬
- **사이드바**: 독립적으로 총점 기준 정렬
- **슬라이드 패널**: 패널 내 테이블도 독립 정렬
- 정렬 상태는 클라이언트 로컬 (서버 저장 불필요)

### 8-5. 중도퇴소 처리 (요구사항 9)

- 학생 명단 화면에서 체크박스로 중도퇴소 표시
- 중도퇴소 인원도 **점수 입력 가능** (disabled 제거, 행 스타일만 구분)
- 모든 점수 입력/조회 화면:
  - 기본: 중도퇴소 인원 **숨김**
  - `☐ 중도퇴소 인원 표시` 체크 시 표시 (토큰: `--color-dropout-row`)
- 총점 계산/순위에서 중도퇴소 인원 **제외**
- 사이드바, 슬라이드 패널에서도 동일 토글 적용

### 8-6. 데이터 입력 UX

#### 엑셀 붙여넣기 (ScoreTable)

엑셀에서 칼럼(또는 범위)을 복사한 뒤 ScoreTable의 셀에 붙여넣으면, 해당 셀부터 아래/오른쪽 방향으로 데이터가 자동 입력된다.

**구현 상세:**

1. **이벤트 가로채기**: 각 `<input>`에 `onPaste` 핸들러 등록. 이벤트 발생 시 `e.clipboardData.getData('text')`로 클립보드 텍스트를 읽음
2. **엑셀 형식 파싱**: 엑셀은 복사 시 셀을 **탭(`\t`)으로 칼럼 구분**, **줄바꿈(`\r\n` 또는 `\n`)으로 행 구분**하여 클립보드에 저장. 이를 `split(/\r?\n/)` → `split('\t')`로 2차원 배열로 변환
3. **단일 값 판별**: 행이 1개이고 탭이 없으면 일반 붙여넣기(기본 동작)로 처리하여 사용자 경험 보존
4. **배치 수집**: 파싱된 2차원 데이터를 현재 셀 위치(`startRow`, `startCol`)부터 순회하며, `{ [studentId]: { [fieldId]: value } }` 형태의 배치 객체로 수집
5. **단일 API 요청**: 수집된 배치 객체를 `onBulkScoreChange(batch)`로 전달 → eval 페이지에서 **단일 PUT 요청**으로 서버에 전송. 낙관적 잠금 버전 충돌 방지
6. **타입 변환**: number 필드는 `Number()` 변환 (NaN이면 건너뜀), boolean 필드는 `'1'`/`'true'` → 1, 그 외 → 0, text 필드는 그대로 사용
7. **범위 제한**: 학생 수 또는 필드 수를 넘는 데이터는 무시 (배열 경계 체크)
8. **셀 위치 식별**: 각 input에 `data-row`, `data-col` 속성 부여. 테이블을 감싸는 `ref`의 `querySelector`로 특정 위치의 input을 찾음

**버전 충돌 해결 — 왜 배치가 필요한가:**

기존에는 붙여넣기 시 셀마다 `onScoreChange`가 호출되어 각각 독립적인 PUT 요청이 발생했다. 이 시스템은 낙관적 잠금(optimistic locking)을 사용하므로:

```
요청1: PUT scores { student1: { field1: 90 } } expectedVersion=1
  → 서버: version 1 === 1 ✓ → 저장, version → 2
요청2: PUT scores { student2: { field1: 85 } } expectedVersion=1
  → 서버: version 2 !== 1 ✗ → 409 Conflict!
요청3~N: 전부 409 Conflict
```

**해결**: 모든 붙여넣기 데이터를 하나의 배치 객체로 모은 뒤 **단일 PUT 요청**으로 전송:
```
배치 요청: PUT scores {
  student1: { field1: 90 },
  student2: { field1: 85 },
  student3: { field1: 92 },
  ...
} expectedVersion=1
  → 서버: version 1 === 1 ✓ → 전부 저장, version → 2
```

`bulkUpdateScores` 서비스가 이미 다중 학생 형식을 지원하므로 API 변경 불필요.

**데이터 흐름:**
```
ScoreTable.handlePaste
  → 클립보드 파싱 → batch 객체 수집
  → onBulkScoreChange(batch) 호출
    → eval page: 단일 PUT /api/cohorts/{id}/scores/{categoryId}
      → score-service.bulkUpdateScores(cohortId, categoryId, batch, version)
        → writeWithLock: 버전 체크 1회 → 전체 머지 → version++
          → 성공 → refreshCalculation()
```

**사용 예시:**
```
엑셀에서 A1:A5 (5명의 점수 칼럼) 복사
→ ScoreTable 첫 번째 학생의 해당 필드 셀 클릭
→ Ctrl+V
→ 5명의 점수가 단일 요청으로 서버에 저장
```

#### Enter 키 네비게이션

셀에서 Enter 입력 시:
1. 현재 셀의 값을 저장 (blur 트리거 → `onScoreChange` 호출)
2. 같은 칼럼의 다음 행 셀로 포커스 이동 (`data-row`/`data-col` 기반 querySelector)
3. 이동한 셀의 텍스트 자동 선택 (select)

#### Number Input 스피너 숨김

`globals.css`에서 `input[type="number"]`의 WebKit/Firefox 스피너를 전역으로 숨김 처리하여, 호버/포커스 시 화살표가 나타나지 않음.

---

## 9. 테스트 전략

### 9-1. E2E 테스트 (Playwright)

```
tests/
├── scoring-engine.test.js              # 계산 엔진 단위 테스트
└── e2e/
    └── kda-workflow.spec.js            # ★ E2E 워크플로우 (순차 실행)
        ├── 1. 기수 생성 (UUID 자동 생성 확인)
        ├── 2. 이름 중복 체크 (409 응답 → alert)
        ├── 3. 학생 관리 탭 이동 + 단일/일괄 학생 추가
        ├── 4. 카테고리 추가 (기본 input_fields 자동 생성)
        ├── 5. 점수 입력 (number input → blur → API 저장 확인)
        ├── 6. 카테고리 순서 변경 (↑/↓ 버튼)
        ├── 7. 카테고리 삭제 (× 버튼 + confirm)
        ├── 8. 사이드바 총점/순위 확인 + 예상 모드 토글
        ├── 9. CSV 내보내기 (API 수준 — 요약/상세)
        └── 10. 데이터 영속성 확인 (API + 파일 직접 읽기)
```

### 9-2. 실행 방법

```bash
# Playwright 브라우저 설치 (최초 1회)
npx playwright install chromium

# E2E 테스트 실행 (서버 자동 시작)
npx playwright test

# 계산 엔진 단위 테스트
npm run test:scoring
```

### 9-3. 향후 추가 가능한 테스트

- 2기 실제 데이터 기반 점수 검증 (scoring_system.md 대조)
- 슬라이드 패널 드릴다운/브레드크럼
- 동시성 충돌 + WebSocket 실시간 업데이트
- 기수 복제 워크플로우

---

## 10. 구현 단계

### Phase 1: 기반 ✅
- [x] Next.js 프로젝트 셋업 (JavaScript, Tailwind, shadcn/ui, jsconfig.json)
- [x] `schema.js` 데이터 구조 정의
- [x] `tokens.css` 디자인 토큰 파일 생성
- [x] JSON 파일 저장소 구현 (읽기/쓰기/잠금)
- [x] 서비스 레이어 기본 구조 (cohort, student, score, config)
- [x] API 라우트 기본 CRUD

### Phase 2: 점수 계산 엔진 ✅
- [x] 8가지 평가 방식 구현 (weighted_average, sum_divide, rank_differential, formula, boolean, boolean_with_deduction, user_input, composite)
- [x] composite 방식 구현 (하위 항목 조합 + 최종 공식)
- [x] 순위 계산 + 하한 처리
- [x] 단위 테스트 (`tests/scoring-engine.test.js`)

### Phase 3: UI 핵심 ✅
- [x] 기수 관리 홈 (생성/복제/삭제 — UUID 자동 생성, 이름 중복 체크)
- [x] 기수 선택 네비게이션 (Navbar 콤보박스)
- [x] 학생 명단 관리 (단일/일괄 추가, 중도퇴소 체크, 팀 관리)
- [x] 총점 대시보드 (항목 목록 + 집계 설정 + 카테고리 삭제/순서 변경)
- [x] 평가 항목 페이지 (데이터 테이블 + 인라인 설정)
- [x] 슬라이드 패널 (하위 항목 드릴다운, 전체화면 전환)
- [x] 정렬 기능 (본문/사이드바/패널 독립 정렬)

### Phase 4: 사이드바 & 설정 고도화 ✅
- [x] 우측 사이드바 (누적/예상 모드)
- [x] 인라인 설정 — 방식별 동적 폼
- [x] 기수 복제 기능 (설정/팀/학생/점수 선택적 복제)
- [x] 설정 변경 시 실시간 점수 재계산

### Phase 5: 동시성 & 내보내기 ✅
- [x] WebSocket 실시간 동기화 (Socket.io)
- [x] 낙관적 잠금 + 충돌 처리 UI (ConflictDialog)
- [x] CSV 내보내기 (총점 요약 / 전체 상세)
- [x] 카테고리 추가 시 기본 input_fields 자동 생성

### Phase 6: E2E 테스트 ✅
- [x] Playwright 설정 + Chromium
- [x] E2E 워크플로우 테스트 (10개 — `tests/e2e/kda-workflow.spec.js`)
  - 기수 생성/중복 체크, 학생 추가, 카테고리 추가/삭제/순서 변경
  - 점수 입력, 사이드바 총점/순위 확인, CSV 내보내기, 데이터 영속성

### Phase 7: UI 개선 ✅
- [x] 테이블 너비 조정 — `w-full` 제거, `min-w-[60%] w-fit`으로 내용 기반 너비
- [x] 사이드바 드래그 리사이즈 (180~500px, `shrink-0` 독립 크기)
- [x] 메인 콘텐츠 영역 80% 너비 + 중앙정렬 (`w-[80%] mx-auto`)
- [x] FieldManager 컴포넌트 — eval 페이지에서 input_fields/sub_categories 관리 UI
- [x] 중도퇴소자 점수 입력 가능 (disabled 제거)
- [x] 엑셀 칼럼 붙여넣기 지원 (탭/줄바꿈 파싱, 다중 셀 일괄 입력)
- [x] Enter 키로 다음 행 같은 칼럼 포커스 이동
- [x] number input 스피너(화살표) 전역 숨김

---

## 11. 추가 고려사항

### 데이터 백업
- `data/` 폴더를 주기적으로 복사하는 간단한 스크립트
- JSON 파일이므로 git으로도 버전 관리 가능

### 데이터 내보내기
- CSV/Excel 내보내기 기능 (최종 결과표)
- 기존 구글 시트와 동일한 포맷으로 출력 가능

### 향후 확장
- 학생별 상세 리포트 페이지
- 기수 간 통계 비교
- 평가 체계 템플릿 라이브러리
