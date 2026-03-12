# KDA 평가 프로젝트 - 문서 인덱스

## 문서 목록

| 문서 | 설명 | 상태 |
|------|------|------|
| [INDEX.md](INDEX.md) | 본 문서. 문서 탐색 가이드 | 유지 |
| [implementation_plan.md](implementation_plan.md) | **구현 계획서 (아키텍처, UI, 데이터 모델)** — Phase 1~6 완료 | 최신 |
| [scoring_system.md](scoring_system.md) | 2기 점수 계산 체계 분석 (참고용) | 완료 |
| [folder_structure.md](folder_structure.md) | Google Drive 폴더/파일/시트 구조 | 완료 |
| [analysis_plan.md](analysis_plan.md) | 분석 계획 (아카이브) | 완료 |


---

## 용도별 참고 문서

### 점수 계산 관련


| 알고 싶은 것                  | 참고 문서             | 섹션                 |
| ------------------------ | ----------------- | ------------------ |
| 전체 배점 구조 (9개 항목, 만점, 방식) | scoring_system.md | `1. 총괄 구조`         |
| 총점 계산 공식                 | scoring_system.md | `1. 총괄 구조 > 총점 계산` |
| 순위 차등배점 하한 원칙            | scoring_system.md | `1. 총괄 구조 > 하한 원칙` |
| 출석률 점수 환산 공식             | scoring_system.md | `2-1. 출석률`         |
| 1차 프로젝트 팀/개인 평가 계산       | scoring_system.md | `2-2. 1차 프로젝트`     |
| 2차 프로젝트 계산 및 팀내 평가 내부 구조 | scoring_system.md | `2-3. 2차 프로젝트`     |
| 수업참여도/성장가능성 계산           | scoring_system.md | `2-4`, `2-6`       |
| 협업 및 태도 계산 (9개 하위항목)     | scoring_system.md | `2-5. 협업 및 태도`     |
| 동료추천 점수 배정 방식            | scoring_system.md | `2-7. 동료추천`        |
| 출석 가산점 및 공과 차감           | scoring_system.md | `2-8. 출석 가산점`      |
| 프로그램 입력 항목 정리            | scoring_system.md | `3. 프로그램 입력 항목 정리` |
| 중도탈락자 처리 방식              | scoring_system.md | `3. 중도탈락자 처리`      |
| 발견된 데이터 오류               | scoring_system.md | `4. 데이터 오류 기록`     |


### 데이터 소스 관련


| 알고 싶은 것                 | 참고 문서               | 섹션            |
| ----------------------- | ------------------- | ------------- |
| 전체 폴더/파일 트리 구조          | folder_structure.md | 전체            |
| 특정 스프레드시트의 ID           | folder_structure.md | 각 파일명 옆 괄호    |
| 특정 스프레드시트 안의 시트 목록      | analysis_plan.md    | `전체 파일·시트 구조` |
| 1차 프로젝트 원본 데이터 위치       | folder_structure.md | `1차 프로젝트`     |
| 2차 프로젝트 원본 데이터 위치       | folder_structure.md | `2차 프로젝트`     |
| Google Sheets MCP 접근 방법 | folder_structure.md | 파일별 ID로 직접 접근 |


### 구현 관련
| 알고 싶은 것 | 참고 문서 | 섹션 |
|-------------|-----------|------|
| 기술 스택 및 아키텍처 | implementation_plan.md | `2. 아키텍처` |
| 데이터 모델 (타입 정의) | implementation_plan.md | `3. 데이터 모델` |
| 평가 방식 타입 시스템 | implementation_plan.md | `3-2. 평가 방식 타입` |
| 점수 계산 엔진 설계 | implementation_plan.md | `4. 점수 계산 엔진` |
| UI 레이아웃/화면 설계 | implementation_plan.md | `5. UI 설계` |
| 동시성 제어 전략 | implementation_plan.md | `6. 동시성 제어` |
| 내부망 배포 (kidis.kda) | implementation_plan.md | `7. 내부망 배포` |
| 핵심 기능 상세 | implementation_plan.md | `8. 핵심 기능 상세` |
| Playwright 테스트 전략 | implementation_plan.md | `9. 테스트 전략` |
| 구현 단계/일정 | implementation_plan.md | `10. 구현 단계` |

### Google Sheets MCP 설정
| 알고 싶은 것 | 참고 |
|-------------|------|
| MCP 서버 설정 | `uvx mcp-google-sheets@latest`, 서비스 계정 인증 |
| 서비스 계정 경로 | `C:\Users\server\credentials\google_json_joinus.json` |
| 기본 폴더 ID | `1WJ70610HnYmSOrfK_4cn8L3PC-6BQ86S` (평가자료) |
| 폴더 접근 방법 | 서비스 계정 이메일에 폴더 공유 필요 |


