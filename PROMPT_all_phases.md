# 전체 Phase 순차 자동 실행

## 이 파일은 ralph-loop가 매 반복마다 참조한다

---

## 1. 현재 진행 상태 확인 (매 반복 시작 시 반드시 실행)

각 Phase 완료 여부는 `.phase_state/` 디렉터리 내 마커 파일로 추적한다.

```bash
ls .phase_state/ 2>/dev/null || echo "(없음)"
```

모든 Phase 완료 확인:
```bash
test -f .phase_state/3a_done && \
test -f .phase_state/3b_done && \
test -f .phase_state/3c_done && \
test -f .phase_state/4a_done && \
test -f .phase_state/4b_done && \
test -f .phase_state/4c_done && \
echo "ALL_DONE" || echo "INCOMPLETE"
```

**ALL_DONE** 이면:
```
<promise>ALL PHASES COMPLETE</promise>
```

---

## 2. Phase 선택 로직

아래 순서로 완료되지 않은 첫 번째 Phase를 찾아 해당 Phase를 구현한다.

```
3-A → 3-B → 3-C → 4-A → 4-B → 4-C
```

각 Phase 완료 조건 확인:
```bash
test -f .phase_state/3a_done && echo "3A done" || echo "3A PENDING"
test -f .phase_state/3b_done && echo "3B done" || echo "3B PENDING"
test -f .phase_state/3c_done && echo "3C done" || echo "3C PENDING"
test -f .phase_state/4a_done && echo "4A done" || echo "4A PENDING"
test -f .phase_state/4b_done && echo "4B done" || echo "4B PENDING"
test -f .phase_state/4c_done && echo "4C done" || echo "4C PENDING"
```

---

## 3. 각 Phase 구현 지시

### Phase 3-A (마커: `.phase_state/3a_done`)

**테스트:**
```bash
npx playwright test tests/e2e/team-score-input.spec.js --reporter=line 2>&1 | tail -20
```

**완료 조건:** `5 passed`

**구현 내용:** `PROMPT_phase3a.md` 참조

**완료 처리:**
```bash
mkdir -p .phase_state && touch .phase_state/3a_done
```

---

### Phase 3-B (마커: `.phase_state/3b_done`)

**테스트:**
```bash
npx playwright test tests/e2e/composite-formula.spec.js --reporter=line 2>&1 | tail -20
```

**완료 조건:** `4 passed`

**구현 내용:** `PROMPT_phase3b.md` 참조

**완료 처리:**
```bash
touch .phase_state/3b_done
```

---

### Phase 3-C (마커: `.phase_state/3c_done`)

**테스트:**
```bash
npx playwright test tests/e2e/cohort-creation.spec.js --reporter=line 2>&1 | tail -20
```

**완료 조건:** `2 passed`

**구현 내용:** `PROMPT_phase3c.md` 참조

**완료 처리:**
```bash
touch .phase_state/3c_done
```

---

### Phase 4-A (마커: `.phase_state/4a_done`)

**테스트:**
```bash
npx playwright test tests/e2e/empty-state.spec.js --reporter=line 2>&1 | tail -20
```

**완료 조건:** `3 passed`

**구현 내용:** `PROMPT_phase4a.md` 참조

**완료 처리:**
```bash
touch .phase_state/4a_done
```

---

### Phase 4-B (마커: `.phase_state/4b_done`)

**테스트:**
```bash
npx playwright test tests/e2e/composite-creation-flow.spec.js --reporter=line 2>&1 | tail -20
```

**완료 조건:** `2 passed`

**구현 내용:** `PROMPT_phase4b.md` 참조

**완료 처리:**
```bash
touch .phase_state/4b_done
```

---

### Phase 4-C (마커: `.phase_state/4c_done`)

**테스트:**
```bash
npx playwright test tests/e2e/cell-display.spec.js --reporter=line 2>&1 | tail -20
```

**완료 조건:** `3 passed`

**구현 내용:** `PROMPT_phase4c.md` 참조

**완료 처리:**
```bash
touch .phase_state/4c_done
```

---

## 4. 매 반복 실행 규칙

1. `.phase_state/` 상태 확인 → 현재 진행 중인 Phase 파악
2. 해당 Phase의 PROMPT_phase*.md 파일을 읽고 구현
3. 테스트 실행 → 모두 통과하면 마커 파일 생성 후 다음 반복에서 다음 Phase로 전환
4. 회귀 테스트 확인 (Phase 3 완료 후, Phase 4 완료 후):
   ```bash
   npx playwright test tests/e2e/kda-workflow.spec.js tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -10
   ```
5. 모든 Phase 완료 시: `<promise>ALL PHASES COMPLETE</promise>` 출력

---

## 5. 완료 조건

```
.phase_state/3a_done  존재
.phase_state/3b_done  존재
.phase_state/3c_done  존재
.phase_state/4a_done  존재
.phase_state/4b_done  존재
.phase_state/4c_done  존재

team-score-input.spec.js:         5 passed
composite-formula.spec.js:        4 passed
cohort-creation.spec.js:          2 passed
empty-state.spec.js:              3 passed
composite-creation-flow.spec.js:  2 passed
cell-display.spec.js:             3 passed
kda-workflow.spec.js:            10 passed  (회귀 없음)
recursive-nav.spec.js:            9 passed  (회귀 없음)
```

```
<promise>ALL PHASES COMPLETE</promise>
```
