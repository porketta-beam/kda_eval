# KDA Eval — 평가 시스템 리팩토링

## What This Is

교육 현장에서 학생 점수를 취합하고 총점을 계산하는 웹 앱. 2-5명의 관리자(강사/조교)가 코호트별로 평가 항목을 구성하고, 학생 점수를 입력하며, 자동 집계된 결과를 확인한다. Next.js 16 + Socket.io 기반 실시간 협업 앱으로, 파일 기반 JSON 저장을 사용한다.

## Core Value

평가 구조를 자유롭게 설계하고, 어떤 구조든 정확하게 점수가 집계되어야 한다.

## Requirements

### Validated

- ✓ 코호트(반) CRUD — existing
- ✓ 학생 CRUD 및 목록 관리 — existing
- ✓ 개인별 점수 입력 (DataTable) — existing
- ✓ 실시간 WebSocket 동기화 — existing
- ✓ 파일 기반 JSON 저장 + 낙관적 잠금 — existing
- ✓ 스코어링 엔진 (8가지 메서드) — existing
- ✓ 등수별 차등 배분 계산 — existing
- ✓ Excel 호환 클립보드 붙여넣기 — existing
- ✓ 코호트 복제 — existing
- ✓ 결과 내보내기 — existing

### Active

- [ ] Notion식 재귀 평가 트리: 각 평가 항목이 독립 페이지로 열리고, 하위 항목을 자유롭게 가질 수 있는 구조
- [ ] Leaf 노드 직접 입력: 소계에 직접 점수를 입력하면 해당 항목이 leaf 노드가 됨
- [ ] 상위 노드 자동 집계: 부모 노드는 하위 항목 점수를 자동으로 집계
- [ ] 팀 점수 입력: 팀 단위로 점수를 입력하면 팀원 전체에 동일하게 반영 (이번 단계에서는 사용자 직접입력)
- [ ] 스코어링 메서드 정리: 가중합산, 가중평균, 등수 차등배분, 사용자입력 — 4가지로 핵심 정리
- [ ] 평가 구조 자유 변경: 카테고리 추가/삭제/이동/중첩을 UI에서 자연스럽게 수행
- [ ] 코호트별 독립 평가 구조: 코호트마다 다른 평가 트리를 적용 가능

### Out of Scope

- 추가 스코어링 메서드 (4가지 핵심 외) — v1 완성 후 추가 구현 예정
- 인증/권한 관리 — 소수 관리자가 내부 네트워크에서 사용, 현재 불필요
- 학생 대면 기능 (점수 조회 등) — 관리자 전용 앱
- 데이터베이스 마이그레이션 — 파일 기반 저장 유지
- 모바일 앱 — 웹 전용

## Context

- 기존 코드에 재귀 카테고리 구조가 부분적으로 있음 (`sub_categories`, `EvalNode` 재귀 렌더링, catch-all 라우팅)
- 하지만 Notion처럼 각 항목이 독립 페이지로 열리고 자유롭게 편집되는 경험은 미완성
- 스코어링 엔진은 8가지 메서드가 있으나, 실제 사용되는 핵심은 4가지
- 팀 개념은 schema에 존재하지만 (`teams` 필드), 팀 단위 점수 입력 UI는 없음
- 한국어 전용 앱, 국제화 불필요

## Constraints

- **Tech stack**: Next.js 16 + React 19 + Socket.io 유지 — 기존 인프라 활용
- **Storage**: 파일 기반 JSON 저장 유지 — DB 도입 안 함
- **Language**: JavaScript (ESM) 유지 — TypeScript 전환 안 함
- **Users**: 2-5명 동시 접속 규모 — 대규모 성능 최적화 불필요

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 팀 점수는 사용자 직접입력으로 시작 | 등수 차등배분은 이미 구현됨, 팀 입력 UI가 우선 | — Pending |
| 스코어링 메서드 4가지로 정리 | 불필요한 복잡성 제거, 핵심에 집중 | — Pending |
| 재귀 트리를 Notion 페이지 방식으로 설계 | 기존 재귀 구조를 확장하여 독립 페이지 내비게이션 구현 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after initialization*
