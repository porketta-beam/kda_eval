# Phase 4-B: Composite 카테고리 생성 — formula 안내

## 완료 조건 (테스트가 ground truth)

```bash
npx playwright test tests/e2e/composite-creation-flow.spec.js --reporter=line 2>&1 | tail -20
```
**2 passed** + 회귀 없음:
```bash
npx playwright test tests/e2e/kda-workflow.spec.js tests/e2e/recursive-nav.spec.js --reporter=line 2>&1 | tail -10
```

---

## 테스트가 요구하는 것

1. 기수 대시보드 → "항목 관리" → "평가항목 추가" → 방식 combobox에서 "복합" 선택 → formula 입력 필드 표시
   - 선택자: `input[placeholder*="sub"]`, `input[placeholder*="formula"]`, `input[placeholder*="공식"]`, 또는 "최종 공식" 텍스트 근처 input
   - 복합 옵션 없으면 `test.skip` → 스킵되면 통과로 처리됨
2. API로 formula 없는 composite 생성 → eval 페이지에서 `[data-testid="formula-warning"]` 표시 (Phase 3-B 의존)

---

## 아키텍처 컨텍스트

**수정 대상 파일:**
- 평가항목 추가 다이얼로그 컴포넌트 (위치 먼저 파악 필요)

**다이얼로그 위치 파악:**
```bash
grep -r "평가항목 추가\|AddCategory\|addCategory\|scoring_method" src/components/ --include="*.jsx" -l
```

**기존 관련 코드:**
- 다이얼로그의 현재 폼 상태 관리 방식 (useState 패턴)
- `scoring_method` 선택 UI가 이미 있는지 확인
- 없으면 추가, 있으면 composite 선택 시 formula 필드 조건부 렌더만 추가

**주의사항:**
- 테스트 2는 Phase 3-B `formula-warning`에 완전히 의존 → Phase 3-B 완료 시 자동 통과 가능
- 테스트 1이 skip되면 "2 passed (1 skipped)" 형태 → 스펙상 "2 passed" 조건 충족 여부 실제 실행으로 확인
