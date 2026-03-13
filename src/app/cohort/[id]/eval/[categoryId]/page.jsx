'use client';

import { use, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SCORING_METHOD } from '@/lib/schema';
import { buildTableColumns, buildCellData, buildResultColumns } from '@/lib/table-helpers';
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

  // 통합 PUT 핸들러 — scores, overrides 모두 처리
  const saveToCategoryScores = useCallback(async (body) => {
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        expectedVersion: versionRef.current,
      }),
    });
    if (res.status === 409) {
      return { conflict: true, res };
    }
    await updateVersionFromResponse(res.clone());
    await refreshCalculation();
    return { conflict: false, res };
  }, [cohortId, categoryId, updateVersionFromResponse, refreshCalculation]);

  const handleScoreChange = useCallback(async (studentId, fieldId, value) => {
    const { conflict } = await saveToCategoryScores({
      scores: { [studentId]: { [fieldId]: value } },
    });
    if (conflict) {
      setPendingChange({ studentId, fieldId, value });
      setConflictOpen(true);
    }
  }, [saveToCategoryScores]);

  const handleBulkScoreChange = useCallback(async (batchScores) => {
    const { conflict } = await saveToCategoryScores({ scores: batchScores });
    if (conflict) setConflictOpen(true);
  }, [saveToCategoryScores]);

  const handleOverrideChange = useCallback(async (studentId, value) => {
    const { conflict } = await saveToCategoryScores({
      overrides: { [studentId]: value },
    });
    if (conflict) setConflictOpen(true);
  }, [saveToCategoryScores]);

  const handleBulkOverrideChange = useCallback(async (batch) => {
    const { conflict } = await saveToCategoryScores({ overrides: batch });
    if (conflict) setConflictOpen(true);
  }, [saveToCategoryScores]);

  const handleConflictKeepMine = useCallback(async () => {
    if (!pendingChange) return;
    setConflictOpen(false);
    await fetchScores();
    // fetchScores updates versionRef via the useEffect, so saveToCategoryScores will use the fresh version
    await saveToCategoryScores({
      scores: { [pendingChange.studentId]: { [pendingChange.fieldId]: pendingChange.value } },
    });
    setPendingChange(null);
  }, [pendingChange, fetchScores, saveToCategoryScores]);

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

  const tableColumns = useMemo(
    () => buildTableColumns(inputFields, subCategories),
    [inputFields, subCategories]
  );

  const cellData = useMemo(() => {
    const rawScores = scores?.raw_scores?.[categoryId] || {};
    const calcResults = scores?.calculated?.[categoryId] || {};
    return buildCellData(rawScores, calcResults, students?.students || [], subCategories);
  }, [scores, categoryId, students, subCategories]);

  const categoryOverrides = useMemo(
    () => scores?.overrides?.[categoryId] || {},
    [scores, categoryId]
  );

  const resultColumns = useMemo(() => {
    const calcResults = scores?.calculated?.[categoryId] || {};
    return buildResultColumns(category, calcResults, categoryOverrides, true);
  }, [scores, categoryId, category, categoryOverrides]);

  const showWeightRow = tableColumns.length > 0 && !isComposite;

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
