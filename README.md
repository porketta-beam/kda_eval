# KDA 평가 시스템

KDA 교육 프로그램의 기수별 학생 평가를 관리하는 내부 웹 애플리케이션.

## 실행 방법

```bash
# 개발 서버 (Socket.io 포함, 파일 변경 시 자동 재시작)
npm run dev

# 프로덕션 빌드 후 실행
npm run build
npm run start
```

`http://localhost:3000` 접속.

## 주요 기능

- **기수 관리** — 생성(UUID 자동), 복제(설정/팀/학생/점수 선택적), 삭제, 이름 중복 체크
- **평가 체계 설정** — 카테고리 추가/삭제/순서 변경, 8가지 평가 방식, 인라인 설정 패널
- **학생 관리** — 단일/일괄 추가, 중도퇴소 처리, 팀 관리 (생성/삭제/학생 배정)
- **점수 입력** — 방식별 자동 입력 필드, 슬라이드 패널 드릴다운, 실시간 계산
- **총점 집계** — 단순 합산/가중 합산, 가산점 한도, 순위 산정
- **사이드바** — 누적/예상 모드, 접기/펼치기, 독립 정렬
- **동시성 제어** — 낙관적 잠금 + WebSocket 실시간 동기화 + 충돌 해결 UI
- **CSV 내보내기** — 총점 요약 / 전체 상세 (UTF-8 BOM, Excel 호환)

## 테스트

```bash
# E2E 테스트 (Playwright — 서버 자동 시작)
npx playwright install chromium   # 최초 1회
npx playwright test

# 계산 엔진 단위 테스트
npm run test:scoring
```

## 기술 스택

- **Next.js 16** (App Router, JavaScript)
- **Tailwind CSS v4** + **shadcn/ui**
- **Socket.io** — 실시간 동기화
- **JSON 파일 저장소** — `data/cohorts/<uuid>/` 하위

## 프로젝트 구조

```
src/
├── app/                    # 페이지 및 API 라우트
│   ├── api/cohorts/        # REST API (CRUD, 복제, 점수, 결과, 내보내기)
│   └── cohort/[id]/        # 기수별 UI (대시보드, 학생, 점수 입력)
├── components/             # React 컴포넌트
│   ├── eval/               # 평가 관련 (CategoryCard, ScoreTable, InlineSettings)
│   ├── layout/             # 레이아웃 (Navbar, Sidebar, SlidePanel)
│   └── common/             # 공통 (ConflictDialog)
├── hooks/                  # 커스텀 훅 (useCohortData + WebSocket)
├── lib/
│   ├── schema.js           # 전체 데이터 구조 정의 (SSOT)
│   ├── scoring-engine/     # 점수 계산 엔진 (8가지 방식)
│   ├── services/           # 비즈니스 로직 (cohort, config, student, score, export)
│   ├── storage/            # JSON 파일 I/O + 낙관적 잠금
│   └── websocket/          # Socket.io 클라이언트
└── styles/tokens.css       # 디자인 토큰
```

## 참고 문서

`docs/` 폴더 참조:

- `implementation_plan.md` — 아키텍처, 데이터 모델, UI 설계
- `scoring_system.md` — 2기 점수 계산 체계
- `folder_structure.md` — Google Sheets 데이터 소스 구조
