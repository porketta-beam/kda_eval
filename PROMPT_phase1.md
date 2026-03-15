# Phase 1: 팀 입력 모드 구현

## 이 파일은 ralph-loop가 매 반복마다 참조한다

## 1. 현재 상태 확인 (매 반복 시작 시 반드시 실행)

```bash
node --import ./tests/register-loader.js tests/team-scoring.test.js 2>&1 | tail -20
```

모든 테스트가 통과하면 아래 선언을 출력하고 종료:
```
<promise>PHASE1 COMPLETE</promise>
```

## 2. 구현 목표

`tests/team-scoring.test.js`의 5개 테스트를 모두 통과시킨다.

## 3. 설계 문서 참조

- `claudedocs/implementation-design.md` — 전체 설계 (섹션 1~3 집중)
- `claudedocs/recursive-table-analysis.md` — 문제 배경

## 4. 구현 순서 (이 순서를 지킬 것)

### Step A: schema.js — input_scope 추가

파일: `src/lib/schema.js`

`EvaluationCategory` typedef에 다음을 추가:
```
@property {string} [input_scope] - 'student'(기본) | 'team'
```

`createCategory()` 팩토리 함수에 기본값 추가:
```javascript
input_scope: options.input_scope ?? 'student',
```

### Step B: scoring-engine/index.js — 팀 모드 분기

파일: `src/lib/scoring-engine/index.js`

`calculateCategory()` 함수 상단에 팀 모드 분기를 추가한다.
기존 composite 분기 **앞**에 위치시킨다:

```javascript
// ★ 팀 입력 모드
if (category.input_scope === 'team') {
  return calculateTeamCategory(category, allRawScores, activeStudents, teams, method);
}
```

같은 파일에 `calculateTeamCategory` 함수를 추가한다:

```javascript
function calculateTeamCategory(category, allRawScores, students, teams, method) {
  const teamScores = allRawScores[category.id] || {};

  // 팀별 계산
  const teamResultMap = {};
  for (const team of teams) {
    const singleEntityScores = { [team.id]: teamScores[team.id] || {} };
    const result = method.calculate(
      category,
      singleEntityScores,
      [{ id: team.id, name: team.name, is_dropout: false }],
      []
    );
    teamResultMap[team.id] = result[team.id] ?? { raw: null, calculated: 0 };
  }

  // 팀 점수를 학생에게 배분
  const studentResults = {};
  for (const student of students) {
    const teamId = student.team_id;
    studentResults[student.id] = teamResultMap[teamId] ?? { raw: null, calculated: 0 };
  }
  return studentResults;
}
```

### Step C: composite.js — 팀 sub 처리 확인

파일: `src/lib/scoring-engine/methods/composite.js`

현재 코드: `subResults[sub.id] = calculateCategory(sub, rawScores, students, teams);`

`calculateCategory`가 이미 팀 모드를 처리하므로 **변경 불필요**.
단, composite의 `students` 파라미터가 `activeStudents`인지 확인한다.

### Step D: 테스트 실행으로 확인

```bash
node --import ./tests/register-loader.js tests/team-scoring.test.js
```

5개 테스트 모두 ✓ 가 붙어야 한다.

이전 테스트도 회귀 확인:
```bash
node --import ./tests/register-loader.js tests/scoring-engine.test.js
```

## 5. 실패 패턴별 대응

**`calculateTeamCategory is not a function` 류 오류:**
→ 함수가 export되지 않았거나 분기 위치가 잘못됨. composite 분기보다 먼저 위치해야 함.

**`teamResultMap[team.id] is undefined`:**
→ method.calculate() 호출 시 students 배열에 팀 엔티티가 포함됐는지 확인.

**팀 점수가 학생에게 배분되지 않음 (0만 나옴):**
→ student.team_id와 teams 배열의 team.id가 일치하는지 확인.

**composite 테스트 실패 (테스트 4):**
→ composite.js에서 sub_categories의 `input_scope`가 `calculateCategory` 재귀 호출에 전달되는지 확인.
→ `calculateCategory(sub, rawScores, students, teams)` — teams가 4번째 인자로 전달되어야 함.

## 6. 완료 조건

```
결과: N passed, 0 failed
```

출력 후:
```
<promise>PHASE1 COMPLETE</promise>
```
