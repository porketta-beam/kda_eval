# Phase 1: Recursive Tree Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-recursive-tree-engine
**Areas discussed:** 부모 노드 집계, Override 동작, 노드 생명주기, 스코어링 방식

---

## 부모 노드 집계

| Option | Description | Selected |
|--------|-------------|----------|
| 카테고리 메서드 따름 | 부모의 스코어링 메서드로 하위 점수 집계 (augmented 패턴) | |
| 항상 단순 합산 | 하위 항목 점수를 무조건 더함 | |
| (User explained) | 카테고리 메서드를 따르되, 칼럼별 가중치 행 추가. 평균/합산 + 가중치 = 가중평균/가중합산 | ✓ |

**User's choice:** 카테고리의 스코어링 메서드를 따라 자동 계산하되, 칼럼 이름 밑에 가중치 열을 추가. 가중치만큼 곱해진 결과로 가중평균/가중합산. 결국 메서드 이름은 "평균"과 "합산"으로 통일.
**Notes:** 가중치 기본값은 1.

## 가중치 기본값

| Option | Description | Selected |
|--------|-------------|----------|
| 기본값 1 | 모든 하위 항목의 기본 가중치가 1 (동일 비중) | ✓ |
| 기본값 없음 | 가중치를 입력해야만 계산됨 | |

**User's choice:** 기본값 1

## Override 삭제 시 동작

| Option | Description | Selected |
|--------|-------------|----------|
| 자동집계 복귀 | override를 지우면 하위 항목 집계값으로 돌아감 | ✓ |
| 0으로 처리 | override를 지우면 0점으로 처리 | |

**User's choice:** 자동집계 복귀

## Override 시각적 구분

| Option | Description | Selected |
|--------|-------------|----------|
| 색상 구분 | override된 셀을 다른 색(amber)으로 표시 | |
| 구분 불필요 | 별도 표시 없이 그냥 점수만 표시 | ✓ |
| You decide | Claude가 적절히 판단 | |

**User's choice:** 구분 불필요

## 빈 노드에 하위 항목 추가 시

| Option | Description | Selected |
|--------|-------------|----------|
| 자동 전환 | 하위 항목 추가 시 자동으로 부모로 전환, 기존 점수는 override로 유지 | |
| 상관없음 | 하위 항목 있어도 직접 입력 가능, 구분 없이 공존 | ✓ |

**User's choice:** 상관없음 — leaf/parent 구분 없이 자유롭게 공존

## 하위 항목 전부 삭제 시

| Option | Description | Selected |
|--------|-------------|----------|
| 빈 노드로 | 하위 항목 없는 빈 카테고리가 됨, 점수 0 | |
| 점수 유지 | 삭제 전 집계값이 override로 유지됨 | |
| (User explained) | 하위 항목 삭제 때마다 다시 계산 | ✓ |

**User's choice:** 하위 항목 삭제 때마다 남은 항목으로 즉시 재계산

## 등수차등배분 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 그대로 유지 | 현재 rank_differential 로직 변경 없이 유지 | |
| 수정 필요 | 등수차등 로직에 변경이 필요함 | |
| (User explained) | v1에서는 등수 표시만 구현, 차등배분은 사용자 직접 입력으로 대체 | ✓ |

**User's choice:** 등수차등배분 시스템을 등수 표현으로 대체. 개인/팀 점수 테이블 모두에서 항상 등수 표시. 차등 배분은 사용자가 직접 입력.
**Notes:** v1 스코어링 메서드는 평균, 합산, 사용자입력 — 3가지. 등수차등배분은 메서드가 아닌 표시 기능.

## 등수 기준

| Option | Description | Selected |
|--------|-------------|----------|
| 해당 카테고리 점수 | 현재 보고 있는 카테고리의 점수 기준으로 등수 | ✓ |
| 총점 기준 | 전체 총점 기준으로 등수 | |
| You decide | Claude가 적절히 판단 | |

**User's choice:** 해당 카테고리 점수

---

## Claude's Discretion

- 가중치 행의 정확한 UI 위치와 스타일링
- override 저장 메커니즘 (기존 overrides 필드 활용 vs raw_scores에 통합)
- 등수 계산의 동점 처리 방식
- 빈 노드의 점수 표시 방식

## Deferred Ideas

- 트리 사이드바 (v2)
- 드래그앤드롭 카테고리 이동/재정렬 (v2)
- 기존 데이터 마이그레이션 스크립트
