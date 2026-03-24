# Roadmap: KDA Eval — 평가 시스템 리팩토링

## Overview

기존 Next.js 평가 앱의 평탄한 카테고리 구조를 Notion식 재귀 트리로 확장한다. 먼저 백엔드 엔진에서 임의 깊이 중첩과 자동 집계를 구현하고, 그 위에 트리 내비게이션 UI를 올리며, 스코어링 메서드를 정리한 뒤, 마지막으로 팀 점수 입력을 완성한다. 4단계 모두 완료되면 관리자가 어떤 평가 구조든 자유롭게 설계하고 정확히 집계되는 시스템이 된다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Recursive Tree Engine** - 임의 깊이 중첩, 자동 집계, override를 config/scoring 레이어에서 구현
- [ ] **Phase 2: Tree Navigation & Manipulation UI** - Notion식 페이지 내비게이션, 카테고리 CRUD, 브레드크럼, 설정 변경 UI
- [ ] **Phase 3: Scoring Method Consolidation** - 8가지 메서드를 4가지로 정리하고 하위 호환 유지
- [ ] **Phase 4: Team Scoring** - 팀 입력 모드 설정, 팀별 점수 입력, 팀원 전체 반영

## Phase Details

### Phase 1: Recursive Tree Engine
**Goal**: 어떤 카테고리든 하위 항목을 가질 수 있고, 점수가 자동으로 올바르게 집계되며, 코호트마다 독립적인 트리를 갖는다
**Depends on**: Nothing (first phase)
**Requirements**: TREE-01, TREE-05, TREE-06, TREE-07, CONF-01
**Success Criteria** (what must be TRUE):
  1. 관리자가 3단계 이상 깊이로 카테고리를 중첩 생성할 수 있고, config.json에 재귀적으로 저장된다
  2. 부모 노드의 점수가 하위 항목의 점수를 기반으로 자동 집계되어 정확한 합계를 보여준다
  3. 하위 항목이 있는 노드에서도 직접 점수를 입력하면 집계값 대신 입력값이 사용된다 (override)
  4. 서로 다른 코호트가 완전히 다른 트리 구조를 가질 수 있고, 한쪽 변경이 다른 쪽에 영향을 주지 않는다
**Plans**: TBD

### Phase 2: Tree Navigation & Manipulation UI
**Goal**: 관리자가 Notion처럼 각 카테고리를 독립 페이지로 탐색하고, 어디서든 하위 항목을 추가/삭제하며, 설정을 자유롭게 변경할 수 있다
**Depends on**: Phase 1
**Requirements**: TREE-02, TREE-03, TREE-04, TREE-08, CONF-02, CONF-03
**Success Criteria** (what must be TRUE):
  1. 카테고리 노드를 클릭하면 해당 카테고리가 독립 페이지로 열리고, 그 안에서 하위 항목을 볼 수 있다
  2. 어떤 깊이의 카테고리 페이지에서든 하위 카테고리를 추가할 수 있고, 즉시 반영된다
  3. 어떤 깊이의 카테고리든 삭제할 수 있고, 확인 다이얼로그 후 삭제된다
  4. 브레드크럼이 현재 위치의 전체 경로를 보여주고, 중간 단계를 클릭하면 해당 페이지로 이동한다
  5. 카테고리의 스코어링 메서드와 가중치를 UI에서 변경할 수 있고, 변경 즉시 점수가 재계산된다
**Plans**: TBD
**UI hint**: yes

### Phase 3: Scoring Method Consolidation
**Goal**: 스코어링 메서드가 핵심 4가지로 정리되고, 기존 코호트의 deprecated 메서드는 계속 동작한다
**Depends on**: Phase 1
**Requirements**: SCORE-01, SCORE-02, SCORE-03
**Success Criteria** (what must be TRUE):
  1. 새 카테고리 생성 시 스코어링 메서드 선택 UI에 4가지만 표시된다 (가중합산, 가중평균, 등수차등배분, 사용자입력)
  2. deprecated 메서드(formula, boolean 등)를 사용하는 기존 코호트가 정상적으로 점수 계산된다
  3. 기존 카테고리의 deprecated 메서드를 4가지 중 하나로 변경할 수 있지만, deprecated 메서드로 되돌릴 수는 없다
**Plans**: TBD

### Phase 4: Team Scoring
**Goal**: 관리자가 팀 단위로 점수를 입력하면 팀원 전체에 동일하게 반영되는 완전한 워크플로우가 동작한다
**Depends on**: Phase 2, Phase 3
**Requirements**: TEAM-01, TEAM-02, TEAM-03
**Success Criteria** (what must be TRUE):
  1. 카테고리 설정에서 입력 모드를 팀(team)으로 전환할 수 있고, UI가 팀 입력 모드로 변경된다
  2. 팀 입력 모드에서 각 팀별로 점수를 입력할 수 있다
  3. 팀에 입력된 점수가 해당 팀의 모든 학생에게 동일하게 반영되어 개인 점수 표에 나타난다
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Recursive Tree Engine | 0/TBD | Not started | - |
| 2. Tree Navigation & Manipulation UI | 0/TBD | Not started | - |
| 3. Scoring Method Consolidation | 0/TBD | Not started | - |
| 4. Team Scoring | 0/TBD | Not started | - |
