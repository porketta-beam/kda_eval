# Phase 1: Recursive Tree Engine - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

어떤 카테고리든 하위 항목을 가질 수 있고, 점수가 자동으로 올바르게 집계되며, 코호트마다 독립적인 트리를 갖는다. COMPOSITE-only 제한을 제거하고, 스코어링 메서드를 3가지(평균, 합산, 사용자입력)로 정리하며, 가중치를 칼럼별 설정으로 통합한다.

</domain>

<decisions>
## Implementation Decisions

### 부모 노드 집계 방식
- **D-01:** 부모 노드는 자신의 스코어링 메서드(평균/합산)에 따라 하위 항목을 자동 집계한다. 기존 augmented category 패턴을 활용.
- **D-02:** 각 하위 항목 칼럼에 가중치 행이 추가된다. 가중치 기본값은 1. 가중치를 입력하면 자연스럽게 가중평균/가중합산이 된다.
- **D-03:** 스코어링 메서드 이름은 "평균"과 "합산"으로 통일. 별도의 "가중평균"/"가중합산" 메서드 없음 — 가중치가 UI 설정으로 분리.

### Override 동작
- **D-04:** 어떤 노드에서든 직접 점수를 입력하면 하위 집계값을 덮어쓴다 (override).
- **D-05:** override를 지우면 자동 집계로 복귀한다 (null로 설정 시 calculated 값 사용).
- **D-06:** override된 셀은 시각적으로 구분하지 않는다 — 별도 표시 불필요.

### 노드 생명주기
- **D-07:** leaf/parent 구분 없음. 하위 항목이 있든 없든 어떤 노드에서든 직접 입력 가능.
- **D-08:** 하위 항목 삭제 시마다 남은 항목으로 즉시 재계산. 전부 삭제되면 빈 노드로 전환.
- **D-09:** 빈 노드에 하위 항목을 추가해도 특별한 전환 과정 없음 — 자연스럽게 공존.

### 스코어링 메서드 정리
- **D-10:** v1 스코어링 메서드는 3가지: 평균, 합산, 사용자입력.
- **D-11:** 등수차등배분은 v1에서 "등수 표시" 기능으로 대체. 차등 배분은 사용자가 직접 입력.
- **D-12:** 개인/팀 점수 테이블 모두에서 해당 카테고리 점수 기준으로 등수가 항상 표시된다.
- **D-13:** 기존 deprecated 메서드(formula, boolean, boolean_with_deduction, rank_differential, composite 등)는 엔진에서 하위 호환 유지하되, UI에서 새 카테고리 생성 시 선택 불가.

### Claude's Discretion
- 가중치 행의 정확한 UI 위치와 스타일링
- override 저장 메커니즘 (기존 overrides 필드 활용 vs raw_scores에 통합)
- 등수 계산의 동점 처리 방식
- 빈 노드의 점수 표시 방식 (0 vs 빈칸)

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above and the following project artifacts:

### 프로젝트 컨텍스트
- `.planning/PROJECT.md` — 프로젝트 비전, 핵심 가치, 요구사항
- `.planning/REQUIREMENTS.md` — v1 요구사항 (TREE-01, TREE-05, TREE-06, TREE-07, CONF-01)
- `.planning/ROADMAP.md` — Phase 1 상세 및 성공 기준

### 리서치
- `.planning/research/ARCHITECTURE.md` — augmented category 패턴 분석, 데이터 흐름
- `.planning/research/PITFALLS.md` — leaf/parent 전환, scores/config 비동기 문제
- `.planning/research/STACK.md` — immer 도입 권장, 트리 조작 패턴

### 코드베이스 분석
- `.planning/codebase/ARCHITECTURE.md` — 현재 아키텍처 레이어, 스코어링 엔진 구조
- `.planning/codebase/CONVENTIONS.md` — 코딩 규칙, 네이밍 패턴

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/scoring-engine/index.js`: `buildAugmentedCategory()`, `buildAugmentedScores()` — non-COMPOSITE 부모의 하위 집계 이미 구현
- `src/lib/scoring-engine/methods/weighted-average.js`: 가중평균 로직 — "평균" 메서드로 리네이밍/통합 가능
- `src/lib/scoring-engine/methods/sum-divide.js`: 합산 로직 — "합산" 메서드로 리네이밍/통합 가능
- `src/lib/scoring-engine/methods/user-input.js`: 사용자입력 — 그대로 유지
- `src/lib/schema.js`: `SCORING_METHOD` enum, `createEvaluationCategory()` — 메서드 목록 수정 필요
- `src/lib/storage/locking.js`: `writeWithLock()` — 파일 수준 낙관적 잠금 그대로 활용

### Established Patterns
- **Augmented category 패턴**: 부모의 `input_fields`와 하위 카테고리를 가상 필드로 병합하여 단일 메서드로 계산 — Phase 1의 핵심 메커니즘
- **Override 패턴**: `scores.json`의 `overrides` 필드로 카테고리별/학생별 override 저장, `calculateTotals()`에서 `overrideVal != null` 체크
- **재귀 계산**: `calculateCategory()`가 이미 재귀적으로 하위 카테고리를 먼저 계산 후 부모에 반영

### Integration Points
- `src/app/api/cohorts/[id]/results/route.js`: 결과 계산 API — 스코어링 엔진 변경 반영
- `src/lib/services/config-service.js`: 카테고리 CRUD — 스코어링 메서드 변경 반영
- `src/lib/services/score-service.js`: 점수 저장 — override 로직 확장

</code_context>

<specifics>
## Specific Ideas

- "칼럼 이름 밑에 가중치에 대한 열을 추가해서 해당 가중치만큼 곱해진 결과를 바탕으로 가중평균, 가중합산" — 가중치가 메서드가 아니라 UI/데이터 설정으로 자연스럽게 통합
- "사용자 입력이 항상 해당 노드의 집계를 overwriting" — override가 명시적 모드 전환 없이 직접 입력으로 동작
- "등수가 항상 표현되도록 하고 차등배분은 사용자 직접 입력으로 대체" — 등수는 표시 기능, 차등 배분은 수동

</specifics>

<deferred>
## Deferred Ideas

- 트리 사이드바 (v2 — NAV-01)
- 드래그앤드롭 카테고리 이동/재정렬 (v2 — NAV-02, NAV-03)
- 기존 데이터 마이그레이션 스크립트 — 기존 코호트가 deprecated 메서드 사용 시 필요할 수 있음

</deferred>

---

*Phase: 01-recursive-tree-engine*
*Context gathered: 2026-03-24*
