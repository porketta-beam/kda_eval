# Requirements: KDA Eval 리팩토링

**Defined:** 2026-03-24
**Core Value:** 평가 구조를 자유롭게 설계하고, 어떤 구조든 정확하게 점수가 집계되어야 한다.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### 재귀 트리 구조 (Tree Structure)

- [x] **TREE-01**: 임의 깊이로 하위 카테고리를 생성할 수 있다 (재귀 중첩)
- [ ] **TREE-02**: 각 카테고리 노드를 클릭하면 독립 페이지로 열린다 (Notion식 내비게이션)
- [ ] **TREE-03**: 어떤 깊이에서든 하위 카테고리를 추가할 수 있다
- [ ] **TREE-04**: 어떤 깊이에서든 카테고리를 삭제할 수 있다 (확인 다이얼로그 포함)
- [x] **TREE-05**: 부모 노드는 하위 항목의 점수를 자동으로 집계한다
- [x] **TREE-06**: 어떤 노드에서든 소계를 직접 입력하면 하위 항목의 집계값을 덮어쓴다 (override)
- [x] **TREE-07**: 하위 항목이 있는 노드에서도 직접 입력이 가능하다 (leaf 제한 없음)
- [ ] **TREE-08**: 브레드크럼 내비게이션이 모든 깊이에서 정확히 동작한다

### 팀 점수 입력 (Team Scoring)

- [ ] **TEAM-01**: 카테고리를 팀 입력 모드로 설정할 수 있다 (input_scope: 'team')
- [ ] **TEAM-02**: 팀 입력 모드에서 팀별로 점수를 입력할 수 있다
- [ ] **TEAM-03**: 팀에 입력된 점수가 팀원 전체에 동일하게 반영된다

### 스코어링 메서드 정리 (Scoring Consolidation)

- [ ] **SCORE-01**: UI에서 선택 가능한 스코어링 메서드가 4가지로 제한된다 (가중합산, 가중평균, 등수차등배분, 사용자입력)
- [ ] **SCORE-02**: 기존 코호트의 deprecated 메서드(formula, boolean 등)는 엔진에서 계속 동작한다 (하위 호환)
- [ ] **SCORE-03**: 새 카테고리 생성 시 deprecated 메서드는 선택할 수 없다

### 평가 구조 변경 (Config Flexibility)

- [x] **CONF-01**: 코호트별로 독립적인 평가 트리 구조를 가질 수 있다
- [ ] **CONF-02**: 카테고리의 스코어링 메서드를 언제든 변경할 수 있다
- [ ] **CONF-03**: 카테고리의 가중치/설정을 UI에서 직관적으로 변경할 수 있다

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 트리 내비게이션 강화

- **NAV-01**: 트리 사이드바 — 전체 평가 구조를 한눈에 보여주는 접기/펼치기 사이드바
- **NAV-02**: 드래그앤드롭 카테고리 이동 (같은 레벨 내 재정렬)
- **NAV-03**: 드래그앤드롭 reparenting (다른 부모로 카테고리 이동)
- **NAV-04**: 점수 완성도 표시기 (트리 노드별 입력 진행률)

### 추가 스코어링

- **XSCR-01**: 추가 스코어링 메서드 (기존 8가지 외 새 메서드)
- **XSCR-02**: 수식 기반 커스텀 집계 (composite 방식 확장)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 인증/권한 관리 | 소수 관리자가 내부 네트워크에서 사용, 현재 불필요 |
| 학생 대면 기능 | 관리자 전용 앱 |
| DB 마이그레이션 | 파일 기반 JSON 저장 유지 |
| 모바일 반응형 | 데스크톱 전용, 데이터 테이블 UI는 모바일 비적합 |
| 팀 내 개인별 차등 | 팀원 전체 동일 점수, 개인 차등은 별도 카테고리 활용 |
| 실시간 CRDT | 2-5명 규모에서 낙관적 잠금으로 충분 |
| 국제화 (i18n) | 한국어 전용 앱 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TREE-01 | Phase 1 | Complete |
| TREE-02 | Phase 2 | Pending |
| TREE-03 | Phase 2 | Pending |
| TREE-04 | Phase 2 | Pending |
| TREE-05 | Phase 1 | Complete |
| TREE-06 | Phase 1 | Complete |
| TREE-07 | Phase 1 | Complete |
| TREE-08 | Phase 2 | Pending |
| TEAM-01 | Phase 4 | Pending |
| TEAM-02 | Phase 4 | Pending |
| TEAM-03 | Phase 4 | Pending |
| SCORE-01 | Phase 3 | Pending |
| SCORE-02 | Phase 3 | Pending |
| SCORE-03 | Phase 3 | Pending |
| CONF-01 | Phase 1 | Complete |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
