'use client';

import { use, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import InlineSettings from '@/components/eval/InlineSettings';
import ScoreTable from '@/components/eval/ScoreTable';
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
      <ScoreTable
        category={category}
        students={students?.students || []}
        scores={scores}
        calculatedResults={scores?.calculated || {}}
        showDropout={showDropout}
        onScoreChange={handleScoreChange}
        onSubCategoryClick={handleSubCategoryClick}
      />

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
