# KDA 평가 시스템 - 프로젝트 분석 리포트

> 작성일: 2026-03-16
> 대상 프로젝트: `D:\DEV\kidis\kda_eval`

---

## 1. 프로젝트 정의

### 프로젝트명
**KDA 평가 시스템** (kda_eval)

### 목적
KDA(Korea Data Academy) 교육 프로그램에서 기수별 학생들의 종합 평가를 관리하는 **내부 웹 애플리케이션**.
기존에 Google Sheets로 수행하던 복잡한 평가 계산 작업을 자동화하고, 여러 운영자가 동시에 점수를 입력할 수 있는 환경을 제공한다.

### 핵심 문제 정의
| 기존 문제 | 해결 방향 |
|-----------|-----------|
| Google Sheets에서 복잡한 수식으로 평가 관리 → 유지보수 어려움 | 전용 웹앱으로 평가 체계를 시각적으로 구성 |
| 기수마다 평가 항목/배점이 달라질 수 있음 → 매번 시트 재구성 | 동적 평가 체계 설정 (항목 추가/삭제/방식 변경) |
| 3명의 운영자가 동시에 점수 입력 → 시트 충돌 | 낙관적 잠금 + WebSocket 실시간 동기화 |
| 점수 환산 방식이 항목마다 다름 (8가지) → 수식 오류 위험 | 8가지 평가 방식을 엔진으로 추상화 |

---

## 2. 요구사항 분석

### 2-1. 13개 핵심 요구사항

| # | 요구사항 | 설명 | 구현 상태 |
|---|---------|------|----------|
| 1 | **유연한 평가 체계** | 평가 방식 변경, 비중 조정, 설정 변경 시 실시간 점수 반영 | ✅ 완료 |
| 2 | **원본 데이터 보존** | 평가 체계를 바꿔도 입력된 원본 점수는 유지 | ✅ 완료 |
| 3 | **기수별 독립 관리** | 기수 선택 네비게이션으로 독립적인 평가 환경 | ✅ 완료 |
| 4 | **우측 사이드바** | 접을 수 있는 총점 모니터, 누적/예상 모드 | ✅ 완료 |
| 5 | **내부망 배포** | `kidis.kda` 도메인, 3인 사용 | ✅ 설계 완료 (배포 대기) |
| 6 | **동시성 제어** | 3인 동시 입력/설정 변경, 충돌 해결 UI | ✅ 완료 |
| 7 | **간단한 아키텍처** | DB 불필요, 최소 스택 (JSON 파일 저장) | ✅ 완료 |
| 8 | **정렬 기능** | 본문/사이드바 독립 정렬 | ✅ 완료 |
| 9 | **중도퇴소 처리** | 체크박스 표시, 기본 숨김, 토글 표시, 점수 입력 가능 | ✅ 완료 |
| 10 | **동적 평가 항목** | 항목 추가/삭제, 8가지 방식 설정, 순서 변경 | ✅ 완료 |
| 11 | **기수 복제** | 기존 기수의 설정/팀/학생/점수를 선택적으로 복제 | ✅ 완료 |
| 12 | **Playwright 테스트** | 2기 데이터 기반 E2E 테스트 | ✅ 기본 완료 (10개 테스트) |
| 13 | **디자인 토큰 분리** | 색상/radius/shadow를 tokens.css로 분리하여 AI 코딩 시 토큰 절약 | ✅ 완료 |

### 2-2. 세부 기능 요구사항

#### A. 기수 관리
- 기수 생성 (UUID 자동 생성)
- 기수 이름 중복 체크
- 기수 복제 (설정/팀/학생/점수 선택적)
- 기수 삭제

#### B. 평가 체계 설정
- 평가 카테고리 동적 추가/삭제/순서 변경
- 8가지 평가 방식 중 선택:
  1. `weighted_average` — 가중평균 (수업참여도, 성장가능성)
  2. `sum_divide` — 합산 후 나누기 (협업 및 태도)
  3. `rank_differential` — 순위 차등배점 (프로젝트 평가)
  4. `formula` — 커스텀 공식 (출석률)
  5. `boolean` — 참/거짓 (복수강사추천)
  6. `boolean_with_deduction` — 참/거짓 + 차감 (출석 가산점)
  7. `user_input` — 사용자 직접 입력 (동료추천)
  8. `composite` — 하위 항목 조합 (프로젝트)
- 방식별 세부 파라미터 설정 (인라인 설정 패널)
- 가산점 항목 구분 (`is_bonus`)

#### C. 학생 관리
- 단일/일괄 학생 추가
- 팀 생성/삭제/학생 배정
- 중도퇴소 처리 (체크박스 + 날짜)
- 중도퇴소자 기본 숨김, 토글 표시

#### D. 점수 입력
- 평가 방식에 따른 자동 입력 필드 생성
- 입력 필드 타입: number, text, boolean, select
- 입력 범위: 학생별(student) / 팀별(team)
- 엑셀 칼럼 붙여넣기 (탭/줄바꿈 파싱 → 일괄 저장)
- Enter/방향키 셀 네비게이션
- 수정(override) 칼럼 — 계산 결과를 수동으로 덮어쓰기
- number input 스피너 숨김

#### E. 점수 계산 엔진
- 설정(config) + 원본 점수(raw_scores)로 실시간 계산
- 환산 점수는 저장하지 않음 (매번 계산)
- override가 있으면 계산 결과 대신 override 값 사용
- 순위 계산 + 하한 처리
- composite 방식: 하위 항목 재귀 계산 + `final_formula` 평가

#### F. 총점 집계
- 집계 방식: 단순 합산 / 가중 합산
- 기본 만점 설정
- 가산점 한도 설정
- 순위 산정 (중도퇴소자 제외)

#### G. 사이드바
- 누적 모드: 입력된 항목만 합산
- 예상 모드: 미입력 항목을 전체 평균으로 추정
- 접기/펼치기
- 드래그 리사이즈 (180~500px)
- 본문과 독립적인 정렬

#### H. 동시성 제어
- 낙관적 잠금 (version 기반)
- WebSocket 실시간 브로드캐스트
- 충돌 발생 시 ConflictDialog UI
- 카테고리 단위 세분화된 잠금

#### I. CSV 내보내기
- 총점 요약 (이름/총점/순위)
- 전체 상세 (모든 항목별 점수)
- UTF-8 BOM (Excel 한글 호환)

---

## 3. 기술 아키텍처

### 3-1. 기술 스택

```
┌──────────────────────────────────────────────┐
│         Frontend (React 19 + Next.js 16)     │
│  App Router + JavaScript (JSDoc 타입힌트)     │
│  Tailwind CSS v4 + shadcn/ui (Radix 기반)     │
├──────────────────────────────────────────────┤
│         Backend (Next.js API Routes)         │
│  Route Handlers + Socket.io (v4.8.3)         │
│  Custom HTTP Server (server.js)              │
├──────────────────────────────────────────────┤
│         Storage (JSON 파일)                   │
│  data/cohorts/<uuid>/config.json             │
│  data/cohorts/<uuid>/students.json           │
│  data/cohorts/<uuid>/scores.json             │
└──────────────────────────────────────────────┘
```

### 3-2. 선정 근거

| 결정 | 이유 |
|------|------|
| JavaScript (not TypeScript) | 빌드 단계 제거, AI 토큰 절약, JSDoc으로 타입힌트 확보 |
| Next.js 풀스택 | 프론트+백엔드 통합, 배포 단순 |
| JSON 파일 저장 | 기수당 데이터 수십KB 수준, DB 불필요 |
| Socket.io | 3인 동시 작업 실시간 동기화 |
| shadcn/ui | 빠른 UI 개발, 커스터마이징 용이 |

### 3-3. 레이어 구조

```
 API Route ──► Service ──► Storage (file-store)
     │              │              │
     │              ├── schema.js (데이터 구조 SSOT)
     │              └── scoring-engine (계산 위임)
     │
 Component ──► useCohortData (데이터 fetch + WebSocket)
```

### 3-4. 프로젝트 구조 (실제 파일 기준)

```
kda_eval/
├── src/
│   ├── app/                          # 15 files — 페이지 + API 라우트
│   │   ├── page.js                   # 기수 관리 홈
│   │   ├── layout.js                 # 루트 레이아웃 + SocketProvider
│   │   ├── cohort/[id]/
│   │   │   ├── page.jsx              # 총점 대시보드
│   │   │   ├── layout.jsx            # 기수 레이아웃 (Context + Sidebar)
│   │   │   ├── students/page.jsx     # 학생/팀 관리
│   │   │   └── eval/[categoryId]/page.jsx  # 점수 입력
│   │   └── api/cohorts/              # 12개 REST API 라우트
│   │
│   ├── components/                   # 24 files
│   │   ├── eval/                     # DataTable, InlineSettings, FieldManager, CategoryCard
│   │   ├── layout/                   # Navbar, Sidebar, SlidePanel
│   │   ├── common/                   # ConflictDialog
│   │   └── ui/                       # 16개 shadcn/ui 컴포넌트
│   │
│   ├── hooks/                        # useCohortData + CohortDataContext
│   │
│   ├── lib/
│   │   ├── schema.js                 # SSOT — 전체 데이터 구조 정의
│   │   ├── scoring-engine/           # 8가지 계산 방식 + 총점/순위
│   │   ├── services/                 # 5개 비즈니스 로직 서비스
│   │   ├── storage/                  # JSON I/O + 낙관적 잠금
│   │   └── websocket/               # Socket.io 클라이언트
│   │
│   └── styles/tokens.css            # 디자인 토큰
│
├── tests/
│   ├── scoring-engine.test.js        # 계산 엔진 단위 테스트
│   └── e2e/kda-workflow.spec.js      # Playwright E2E (10개 테스트)
│
├── docs/                             # 6개 설계/분석 문서
├── server.js                         # Socket.io + Next.js 커스텀 서버
├── package.json
└── [설정 파일들]                      # ESLint, Next, Playwright, jsconfig 등
```

---

## 4. 데이터 모델

### 4-1. 저장 구조

```
data/cohorts/
└── <uuid>/
    ├── config.json      # 기수 설정 (평가 체계, 팀 구조)
    ├── students.json    # 학생 명단
    └── scores.json      # 원본 점수 + 오버라이드
```

### 4-2. 핵심 설계 원칙

**"점수는 저장하지 않고 매번 계산한다"**

```
scores.json = raw_scores (원본 입력값) + overrides (수동 덮어쓰기)
환산 점수 = scoring-engine.calculate(config + raw_scores)
최종 점수 = override 있으면 override, 없으면 환산 점수
```

이 설계 덕분에:
- 평가 체계(config)를 바꿔도 원본 데이터(raw_scores)가 보존됨
- 설정 변경 시 점수가 실시간으로 재계산됨
- 오버라이드로 예외 처리가 가능하면서도, 삭제하면 계산 결과로 복원됨

### 4-3. 평가 카테고리 계층 구조

```
EvaluationCategory (재귀 구조)
├── id, name, order, max_score, is_bonus
├── scoring_method (8가지 중 택 1)
├── config (방식별 세부 파라미터)
├── input_fields[] (입력 필드 정의)
├── weight (하위 항목으로 사용 시)
└── sub_categories[] (하위 EvaluationCategory[])
```

이 구조가 재귀적이기 때문에 트리 깊이에 제한이 없다.
예: `1차 프로젝트(composite) → 팀평가(rank_differential) → 입력필드들`

---

## 5. KDA 2기 평가 체계 (원본 데이터 기준)

### 5-1. 배점 총괄

| # | 항목 | 만점 | 평가 방식 | 비고 |
|---|------|------|----------|------|
| 1 | 출석률 | 20 | formula (차감법) | 90% 기준, 차감 한도 10 |
| 2 | 1차 프로젝트 | 15 | composite | 팀(60)+개인(40) → 15점 환산 |
| 3 | 2차 프로젝트 | 20 | composite | (키움+학생+팀내)/100×20 |
| 4 | 수업참여도 | 20 | weighted_average | AVERAGE×2 |
| 5 | 협업 및 태도 | 10 | sum_divide | SUM/10 |
| 6 | 성장가능성 | 10 | weighted_average | AVERAGE×1 |
| 7 | 동료추천 | 5 | user_input | 수동 배정 |
| 8 | 출석 가산점 | 2 | boolean_with_deduction | 완벽출석 2점, 공과 차감 |
| 9 | 복수강사추천 | 1 | boolean | 1 or 0 |
| | **합계** | **103** | | 기본 100 + 가산 3 |

### 5-2. 복잡한 계산 흐름 (1차 프로젝트 예시)

```
1차 프로젝트 (composite, 15점)
├── 팀 평가 (rank_differential, 60점)
│   ├── rank_source: weighted_sum
│   │   ├── 장원영 강사 (weight: 30)
│   │   ├── 문혜영 강사 (weight: 15)
│   │   ├── 이정수 강사 (weight: 15)
│   │   └── 학생 타팀 평가 (weight: 10)
│   ├── scope: all (전체 순위)
│   ├── top_score: 60, interval: 5
│   └── has_floor: false
│
├── 개인 평가 (rank_differential, 40점)
│   ├── rank_source: weighted_sum
│   │   ├── 장원영 강사 (weight: 30)
│   │   ├── 문혜영 강사 (weight: 15)
│   │   ├── 이정수 강사 (weight: 15)
│   │   ├── 타팀 평가 (weight: 10)
│   │   └── 동팀 평가 (weight: 30)
│   ├── scope: team (팀내 순위)
│   ├── top_score: 40, interval: 5
│   └── has_floor: true, floor_value: 20
│
└── final_formula: "(팀평가 + 개인평가) * 15 / 100"
```

---

## 6. UI 설계

### 6-1. 페이지 구조

| 경로 | 화면 | 주요 기능 |
|------|------|----------|
| `/` | 기수 관리 홈 | 기수 목록, 생성, 복제, 삭제 |
| `/cohort/[id]` | 총점 대시보드 | 총점 테이블, 항목 관리, 집계 설정 |
| `/cohort/[id]/students` | 학생 관리 | 학생/팀 CRUD, 중도퇴소 |
| `/cohort/[id]/eval/[categoryId]` | 점수 입력 | DataTable + 인라인 설정 |

### 6-2. 핵심 UI 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| **DataTable** | 통합 데이터 테이블 (입력+읽기전용, 가중치 행, 오버라이드, 엑셀 붙여넣기) |
| **InlineSettings** | 방식별 동적 설정 폼 (Collapsible) |
| **FieldManager** | input_fields/sub_categories 관리 UI |
| **SlidePanel** | 하위 항목 드릴다운 오버레이 (브레드크럼 + 전체화면 전환) |
| **Sidebar** | 우측 총점 모니터 (접기, 드래그 리사이즈, 누적/예상 모드) |
| **ConflictDialog** | 낙관적 잠금 충돌 해결 UI |

### 6-3. 네비게이션 전략

평가 항목의 트리 깊이가 2를 초과하므로 탭 UI 대신 **"페이지별 테이블 + 슬라이드 패널 드릴다운"** 방식을 채택:

```
총점 대시보드
  → 항목 칼럼 클릭 → 해당 eval 페이지로 이동
     → 하위 항목 값 클릭 → 슬라이드 패널 열림
        → 패널 내 하위 항목 클릭 → 패널 내용 교체
        → [전체] 버튼 → 전체 페이지로 URL 이동
```

---

## 7. 구현 현황

### 7-1. 완료된 Phase (Phase 1~7, 모두 완료)

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 기반 — 프로젝트 셋업, schema, storage, services, API | ✅ |
| Phase 2 | 점수 계산 엔진 — 8가지 방식 + 단위 테스트 | ✅ |
| Phase 3 | UI 핵심 — 기수/학생/대시보드/점수입력/슬라이드패널/정렬 | ✅ |
| Phase 4 | 사이드바 & 설정 — 누적/예상, 인라인 설정, 복제, 실시간 재계산 | ✅ |
| Phase 5 | 동시성 & 내보내기 — WebSocket, 충돌 UI, CSV 내보내기 | ✅ |
| Phase 6 | E2E 테스트 — Playwright 10개 워크플로우 테스트 | ✅ |
| Phase 7 | UI 개선 — 테이블 너비, 리사이즈, FieldManager, 붙여넣기, 키보드 네비 | ✅ |

### 7-2. 코드 규모

| 영역 | 파일 수 | 비고 |
|------|---------|------|
| 페이지 + API 라우트 | 15 | Next.js App Router |
| 커스텀 컴포넌트 | 8 | eval, layout, common |
| shadcn/ui 컴포넌트 | 16 | Radix 기반 |
| 비즈니스 로직 | 22 | services, scoring-engine, storage |
| 훅/컨텍스트 | 2 | useCohortData + Context |
| 테스트 | 3 | 단위 + E2E |
| **총 소스 코드** | **~65 파일** | **~5,000 LOC** |

---

## 8. 배포 계획

### 8-1. 대상 환경
- 내부망 (사무실 LAN)
- 사용자 3명
- 도메인: `kidis.kda`

### 8-2. 배포 방식 (권장: hosts 파일)
```
[사용자 PC 1~3] → 공유기 → [서버 PC: 192.168.0.100]
                              ├── Node.js + PM2
                              └── http://kidis.kda (port 80)
```

각 PC의 hosts 파일에 `192.168.0.100 kidis.kda` 추가.

---

## 9. newsdot 프로젝트

`D:\DEV\kidis\newsdot` 디렉토리는 **빈 폴더** — 파일 없음.
향후 프로젝트를 위한 플레이스홀더로 추정됨.

---

## 10. 종합 평가

### 강점
1. **아키텍처 설계가 탄탄함** — schema.js SSOT, 서비스 레이어 분리, 계산 엔진 추상화
2. **유연한 평가 체계** — 8가지 방식을 플러그인처럼 교체 가능, 재귀적 하위 항목
3. **실시간 동기화** — WebSocket + 낙관적 잠금으로 3인 동시 작업 지원
4. **원본 데이터 보존** — 설정 변경해도 입력 데이터 유지되는 핵심 설계
5. **DB 없는 간결한 스택** — JSON 파일 저장으로 배포/백업 단순화
6. **상세한 문서화** — implementation_plan.md가 매우 상세하여 전체 설계 의도 파악 가능

### 잠재적 개선 영역
1. **API 입력 검증** — 현재 클라이언트 입력을 신뢰하는 구조, 서버 측 검증 보강 필요
2. **에러 핸들링** — alert() 기반의 기본적인 에러 표시, 사용자 친화적 에러 UI 개선 가능
3. **테스트 커버리지** — 계산 엔진만 단위 테스트 있음, API/서비스 레이어 테스트 부재
4. **데이터 백업** — 자동 백업 스크립트 미구현 (data/ 폴더 수동 복사 필요)
5. **인증/권한** — 현재 오픈 액세스 (3인 내부 사용이므로 낮은 우선순위)

### 결론

KDA 평가 시스템은 **설계부터 구현까지 7개 Phase를 모두 완료한 상태**로, 핵심 기능이 모두 구현되어 있다. Google Sheets의 복잡한 수식 관리를 웹 애플리케이션으로 대체하되, 평가 체계의 유연성을 극대화하고 동시 편집을 지원하는 것이 이 프로젝트의 핵심 가치이다. `npm run build && npm start`로 즉시 배포 가능한 상태이며, 3인 운영 환경에서 `kidis.kda` 내부 도메인으로 서비스할 준비가 되어 있다.
