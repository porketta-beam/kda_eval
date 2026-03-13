'use client';

import { use, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SCORING_METHOD } from '@/lib/schema';
import InlineSettings from '@/components/eval/InlineSettings';
import DataTable from '@/components/eval/DataTable';
import FieldManager from '@/components/eval/FieldManager';
import SlidePanel from '@/components/layout/SlidePanel';
import ConflictDialog from '@/components/common/ConflictDialog';

export default function EvalPage({ params }) {
  const { id: cohortId, categoryId } = use(params);
  const {
    config, students, scores, loading,
    fetchConfig, fetchScores,
  } = useCohortDataContext();
  const router = useRouter();

  const [showDropout, setShowDropout] = useState(false);
  const [panelCategory, setPanelCategory] = useState(null);
  const [panelStack, setPanelStack] = useState([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState(null);

  // Find the category in the config tree
  const category = useMemo(() => {
    if (!config) return null;
    return findCategory(config.evaluation_categories, categoryId);
  }, [config, categoryId]);

  // 최신 version을 ref로 추적 — useCallback 클로저의 stale version 문제 방지
  const versionRef = useRef(scores?.version);
  useEffect(() => {
    versionRef.current = scores?.version;
  }, [scores?.version]);

  // Fetch calculated scores when category changes
  const refreshCalculation = useCallback(async () => {
    await fetchScores();
  }, [fetchScores]);

  // PUT 후 응답에서 새 version을 즉시 반영
  const updateVersionFromResponse = useCallback(async (res) => {
    if (res.ok) {
      const data = await res.json();
      if (data?.version != null) {
        versionRef.current = data.version;
      }
    }
  }, []);

  const saveScore = useCallback(async (studentId, fieldId, value, version) => {
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scores: { [studentId]: { [fieldId]: value } },
        expectedVersion: version,
      }),
    });
    return res;
  }, [cohortId, categoryId]);

  const handleScoreChange = useCallback(async (studentId, fieldId, value) => {
    const res = await saveScore(studentId, fieldId, value, versionRef.current);
    if (res.status === 409) {
      setPendingChange({ studentId, fieldId, value });
      setConflictOpen(true);
      return;
    }
    await updateVersionFromResponse(res.clone());
    await refreshCalculation();
  }, [saveScore, updateVersionFromResponse, refreshCalculation]);

  // 배치 점수 저장 (엑셀 붙여넣기용) — 단일 PUT 요청
  const handleBulkScoreChange = useCallback(async (batchScores) => {
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scores: batchScores,
        expectedVersion: versionRef.current,
      }),
    });
    if (res.status === 409) {
      setConflictOpen(true);
      return;
    }
    await updateVersionFromResponse(res.clone());
    await refreshCalculation();
  }, [cohortId, categoryId, updateVersionFromResponse, refreshCalculation]);

  const handleConflictKeepMine = useCallback(async () => {
    if (!pendingChange) return;
    setConflictOpen(false);
    await fetchScores();
    const freshScores = await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}/scores`).then(r => r.json());
    await saveScore(pendingChange.studentId, pendingChange.fieldId, pendingChange.value, freshScores.version);
    await refreshCalculation();
    setPendingChange(null);
  }, [pendingChange, cohortId, fetchScores, saveScore, refreshCalculation]);

  const handleConflictUseServer = useCallback(async () => {
    setConflictOpen(false);
    setPendingChange(null);
    await refreshCalculation();
  }, [refreshCalculation]);

  const handleSettingsSave = useCallback(async (updatedCategory) => {
    const enc = encodeURIComponent;
    await fetch(`/api/cohorts/${enc(cohortId)}/config/categories/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCategory),
    });
    await fetchConfig();
    await refreshCalculation();
  }, [cohortId, categoryId, fetchConfig, refreshCalculation]);

  // Override 저장 (단일)
  const handleOverrideChange = useCallback(async (studentId, value) => {
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: { [studentId]: value },
        expectedVersion: versionRef.current,
      }),
    });
    if (res.status === 409) {
      setConflictOpen(true);
      return;
    }
    await updateVersionFromResponse(res.clone());
    await refreshCalculation();
  }, [cohortId, categoryId, updateVersionFromResponse, refreshCalculation]);

  // Override 일괄 저장 (엑셀 붙여넣기용) — 단일 PUT 요청
  const handleBulkOverrideChange = useCallback(async (batch) => {
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: batch,
        expectedVersion: versionRef.current,
      }),
    });
    if (res.status === 409) {
      setConflictOpen(true);
      return;
    }
    await updateVersionFromResponse(res.clone());
    await refreshCalculation();
  }, [cohortId, categoryId, updateVersionFromResponse, refreshCalculation]);

  // Weight 변경 → 설정 저장
  const handleWeightChange = useCallback((colId, weight) => {
    if (!category) return;
    const inputFields = (category.input_fields || []).map(f =>
      f.id === colId ? { ...f, weight } : f
    );
    const subCategories = (category.sub_categories || []).map(s =>
      s.id === colId ? { ...s, weight } : s
    );
    handleSettingsSave({ ...category, input_fields: inputFields, sub_categories: subCategories });
  }, [category, handleSettingsSave]);

  const handleSubCategoryClick = useCallback((sub) => {
    // sub는 column 객체일 수 있으므로 실제 카테고리 찾기
    const subCat = (category?.sub_categories || []).find(s => s.id === sub.id);
    if (subCat) {
      setPanelStack([]);
      setPanelCategory(subCat);
    }
  }, [category]);

  const handlePanelDrillDown = useCallback((sub) => {
    setPanelStack(prev => [...prev, panelCategory]);
    setPanelCategory(sub);
  }, [panelCategory]);

  const handlePanelBack = useCallback(() => {
    if (panelStack.length > 0) {
      const prev = panelStack[panelStack.length - 1];
      setPanelStack(s => s.slice(0, -1));
      setPanelCategory(prev);
    } else {
      setPanelCategory(null);
    }
  }, [panelStack]);

  const handlePanelFullPage = useCallback((sub) => {
    setPanelCategory(null);
    router.push(`/cohort/${encodeURIComponent(cohortId)}/eval/${sub.id}`);
  }, [cohortId, router]);

  const isComposite = category?.scoring_method === SCORING_METHOD.COMPOSITE;
  const inputFields = category?.input_fields || [];
  const subCategories = category?.sub_categories || [];

  // DataTable columns: input_fields → type='input', sub_categories → type='computed'
  const tableColumns = useMemo(() => {
    const cols = [];
    for (const field of inputFields) {
      cols.push({
        id: field.id,
        name: field.name,
        type: 'input',
        fieldType: field.type || 'number',
        min: field.min,
        max: field.max,
        weight: field.weight,
      });
    }
    for (const sub of subCategories) {
      cols.push({
        id: sub.id,
        name: sub.name,
        type: 'computed',
        maxScore: sub.max_score,
        isBonus: sub.is_bonus,
        clickable: true,
        weight: sub.weight,
      });
    }
    return cols;
  }, [inputFields, subCategories]);

  // cellData: raw_scores + calculated sub_scores 병합
  const cellData = useMemo(() => {
    const rawScores = scores?.raw_scores?.[categoryId] || {};
    const calcResults = scores?.calculated?.[categoryId] || {};
    const allStudents = students?.students || [];
    const d = {};
    for (const student of allStudents) {
      d[student.id] = { ...(rawScores[student.id] || {}) };
      // sub_scores에서 computed 값 추가
      const result = calcResults[student.id];
      if (result?.sub_scores) {
        for (const sub of subCategories) {
          d[student.id][sub.id] = result.sub_scores[sub.id]?.calculated ?? null;
        }
      }
    }
    return d;
  }, [scores, categoryId, students, subCategories]);

  // 결과 칼럼
  const resultColumns = useMemo(() => {
    const calcResults = scores?.calculated?.[categoryId] || {};
    const cols = [];
    if (category?.scoring_method === SCORING_METHOD.RANK_DIFFERENTIAL) {
      cols.push({
        id: 'rank',
        label: '순위',
        getValue: (sid) => calcResults[sid]?.rank ?? null,
      });
    }
    // 점수 칼럼: override가 있으면 override 값 사용
    const categoryOverrides = scores?.overrides?.[categoryId] || {};
    cols.push({
      id: 'score',
      label: `점수${category?.max_score != null ? ` (${category.max_score})` : ''}`,
      getValue: (sid) => {
        const overrideVal = categoryOverrides[sid];
        if (overrideVal != null) return overrideVal;
        return calcResults[sid]?.calculated ?? null;
      },
    });
    return cols;
  }, [scores, categoryId, category]);

  // showWeightRow: 칼럼이 있을 때만
  const showWeightRow = tableColumns.length > 0 && !isComposite;

  // overrides
  const categoryOverrides = useMemo(() =>
    scores?.overrides?.[categoryId] || {},
    [scores, categoryId]
  );

  if (loading || !category) {
    return <div className="p-6 text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button
          className="text-muted-foreground hover:underline"
          onClick={() => router.push(`/cohort/${encodeURIComponent(cohortId)}`)}
        >
          ◀ 평가 항목 목록
        </button>
        <span className="text-muted-foreground">›</span>
        <span className="font-medium">{category.name}</span>
      </div>

      {/* Inline Settings */}
      <InlineSettings category={category} onSave={handleSettingsSave} />

      {/* Dropout toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Checkbox id="show-dropout-eval" checked={showDropout} onCheckedChange={setShowDropout} />
        <Label htmlFor="show-dropout-eval" className="text-sm">중도퇴소 인원 표시</Label>
      </div>

      {/* DataTable */}
      <DataTable
        title={category.name}
        columns={tableColumns}
        students={students?.students || []}
        cellData={cellData}
        showWeightRow={showWeightRow}
        scoringMethod={category.scoring_method}
        onWeightChange={handleWeightChange}
        resultColumns={resultColumns}
        onCellChange={handleScoreChange}
        onBulkCellChange={handleBulkScoreChange}
        onColumnClick={handleSubCategoryClick}
        showDropout={showDropout}
        overrides={categoryOverrides}
        onOverrideChange={handleOverrideChange}
        onBulkOverrideChange={handleBulkOverrideChange}
      />
      <FieldManager category={category} onSave={handleSettingsSave} />

      {/* Conflict Dialog */}
      <ConflictDialog
        open={conflictOpen}
        onClose={() => { setConflictOpen(false); setPendingChange(null); }}
        onKeepMine={handleConflictKeepMine}
        onUseServer={handleConflictUseServer}
      />

      {/* Slide Panel */}
      {panelCategory && (
        <SlidePanel
          category={panelCategory}
          cohortId={cohortId}
          students={students?.students || []}
          scores={scores}
          panelStack={panelStack}
          onBack={handlePanelBack}
          onDrillDown={handlePanelDrillDown}
          onFullPage={handlePanelFullPage}
          onClose={() => setPanelCategory(null)}
          onScoreChange={handleScoreChange}
          onBulkScoreChange={handleBulkScoreChange}
          showDropout={showDropout}
        />
      )}
    </div>
  );
}

function findCategory(categories, id) {
  for (const cat of categories) {
    if (cat.id === id) return cat;
    if (cat.sub_categories) {
      const found = findCategory(cat.sub_categories, id);
      if (found) return found;
    }
  }
  return null;
}
