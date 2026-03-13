'use client';

import { use, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SCORING_METHOD } from '@/lib/schema';
import InlineSettings from '@/components/eval/InlineSettings';
import ScoreTable from '@/components/eval/ScoreTable';
import SummaryTable from '@/components/eval/SummaryTable';
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

  // Calculate results for this category
  const [calculatedResults, setCalculatedResults] = useState(null);

  // Fetch calculated scores when category changes
  const refreshCalculation = useCallback(async () => {
    await fetchScores();
  }, [fetchScores]);

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
    const res = await saveScore(studentId, fieldId, value, scores?.version);
    if (res.status === 409) {
      setPendingChange({ studentId, fieldId, value });
      setConflictOpen(true);
      return;
    }
    await refreshCalculation();
  }, [scores?.version, saveScore, refreshCalculation]);

  // 배치 점수 저장 (엑셀 붙여넣기용) — 단일 PUT 요청
  const handleBulkScoreChange = useCallback(async (batchScores) => {
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scores: batchScores,
        expectedVersion: scores?.version,
      }),
    });
    if (res.status === 409) {
      setConflictOpen(true);
      return;
    }
    await refreshCalculation();
  }, [cohortId, categoryId, scores?.version, refreshCalculation]);

  const handleConflictKeepMine = useCallback(async () => {
    if (!pendingChange) return;
    setConflictOpen(false);
    // 서버 최신 버전을 가져와서 재시도
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

  const handleSubCategoryClick = useCallback((sub) => {
    setPanelStack([]);
    setPanelCategory(sub);
  }, []);

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
  const subCategories = category?.sub_categories || [];

  const compositeColumns = useMemo(() => {
    if (!isComposite) return [];
    return subCategories.map(sub => ({
      id: sub.id,
      name: sub.name,
      maxScore: sub.max_score,
      isBonus: sub.is_bonus,
      isClickable: !!(sub.sub_categories?.length),
    }));
  }, [isComposite, subCategories]);

  const compositeData = useMemo(() => {
    if (!isComposite) return {};
    const calcResults = scores?.calculated?.[categoryId] || {};
    const allStudents = students?.students || [];
    const d = {};
    for (const student of allStudents) {
      const result = calcResults[student.id];
      const sScores = {};
      for (const sub of subCategories) {
        sScores[sub.id] = result?.sub_scores?.[sub.id]?.calculated ?? null;
      }
      d[student.id] = {
        scores: sScores,
        total: result?.calculated ?? 0,
        rank: null,
      };
    }
    return d;
  }, [isComposite, scores, categoryId, students, subCategories]);

  const compositeStudents = useMemo(() => {
    const all = students?.students || [];
    return showDropout ? all : all.filter(s => !s.is_dropout);
  }, [students, showDropout]);

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

      {/* Score Table */}
      {isComposite ? (
        <>
          <SummaryTable
            title={category.name}
            students={compositeStudents}
            columns={compositeColumns}
            data={compositeData}
            onColumnClick={handleSubCategoryClick}
            showRank={false}
          />
          <FieldManager category={category} onSave={handleSettingsSave} />
        </>
      ) : (
        <>
          <ScoreTable
            category={category}
            students={students?.students || []}
            scores={scores}
            calculatedResults={scores?.calculated || {}}
            showDropout={showDropout}
            onScoreChange={handleScoreChange}
            onBulkScoreChange={handleBulkScoreChange}
            onSubCategoryClick={handleSubCategoryClick}
          />
          <FieldManager category={category} onSave={handleSettingsSave} />
        </>
      )}

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
