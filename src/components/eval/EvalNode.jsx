'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SCORING_METHOD, COLUMN_TYPE } from '@/lib/schema';
import { buildTableColumns, buildCellData, buildResultColumns } from '@/lib/table-helpers';
import InlineSettings from '@/components/eval/InlineSettings';
import DataTable from '@/components/eval/DataTable';
import FieldManager from '@/components/eval/FieldManager';
import ConflictDialog from '@/components/common/ConflictDialog';

function findCategoryByPath(categories, path) {
  if (path.length === 0) return null;
  const [head, ...tail] = path;
  const found = categories.find(c => c.id === head);
  if (!found) return null;
  if (tail.length === 0) return found;
  return findCategoryByPath(found.sub_categories || [], tail);
}

export default function EvalNode({ cohortId, path }) {
  const { config, students, scores, results, loading, fetchConfig, fetchScores } = useCohortDataContext();
  const router = useRouter();

  const [showDropout, setShowDropout] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState(null);

  const isRoot = path.length === 0;
  const categoryId = path.length > 0 ? path[path.length - 1] : null;

  // category must be declared early so callbacks can reference it
  const category = useMemo(() => {
    if (!config || isRoot) return null;
    return findCategoryByPath(config.evaluation_categories, path);
  }, [config, isRoot, path]);

  const versionRef = useRef(scores?.version);
  useEffect(() => {
    versionRef.current = scores?.version;
  }, [scores?.version]);

  const refreshCalculation = useCallback(async () => {
    await fetchScores();
  }, [fetchScores]);

  const updateVersionFromResponse = useCallback(async (res) => {
    if (res.ok) {
      const data = await res.json();
      if (data?.version != null) versionRef.current = data.version;
    }
  }, []);

  const saveToScores = useCallback(async (body) => {
    if (!categoryId) return { conflict: false };
    const enc = encodeURIComponent;
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/scores/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, expectedVersion: versionRef.current }),
    });
    if (res.status === 409) return { conflict: true, res };
    await updateVersionFromResponse(res.clone());
    await refreshCalculation();
    return { conflict: false, res };
  }, [cohortId, categoryId, updateVersionFromResponse, refreshCalculation]);

  const handleScoreChange = useCallback(async (studentId, fieldId, value) => {
    const { conflict } = await saveToScores({ scores: { [studentId]: { [fieldId]: value } } });
    if (conflict) {
      setPendingChange({ studentId, fieldId, value });
      setConflictOpen(true);
    }
  }, [saveToScores]);

  const handleBulkScoreChange = useCallback(async (batchScores) => {
    const { conflict } = await saveToScores({ scores: batchScores });
    if (conflict) setConflictOpen(true);
  }, [saveToScores]);

  const handleOverrideChange = useCallback(async (studentId, value) => {
    const { conflict } = await saveToScores({ overrides: { [studentId]: value } });
    if (conflict) setConflictOpen(true);
  }, [saveToScores]);

  const handleBulkOverrideChange = useCallback(async (batch) => {
    const { conflict } = await saveToScores({ overrides: batch });
    if (conflict) setConflictOpen(true);
  }, [saveToScores]);

  const handleConflictKeepMine = useCallback(async () => {
    if (!pendingChange) return;
    setConflictOpen(false);
    await fetchScores();
    await saveToScores({ scores: { [pendingChange.studentId]: { [pendingChange.fieldId]: pendingChange.value } } });
    setPendingChange(null);
  }, [pendingChange, fetchScores, saveToScores]);

  const handleConflictUseServer = useCallback(async () => {
    setConflictOpen(false);
    setPendingChange(null);
    await refreshCalculation();
  }, [refreshCalculation]);

  const handleSettingsSave = useCallback(async (updatedCategory) => {
    if (!categoryId) return;
    const enc = encodeURIComponent;
    await fetch(`/api/cohorts/${enc(cohortId)}/config/categories/${enc(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedCategory),
    });
    await fetchConfig();
    await refreshCalculation();
  }, [cohortId, categoryId, fetchConfig, refreshCalculation]);

  const handleWeightChange = useCallback((colId, weight) => {
    if (!category) return;
    const inputFields = (category.input_fields || []).map(f => f.id === colId ? { ...f, weight } : f);
    const subCategories = (category.sub_categories || []).map(s => s.id === colId ? { ...s, weight } : s);
    handleSettingsSave({ ...category, input_fields: inputFields, sub_categories: subCategories });
  }, [category, handleSettingsSave]);

  // COMPUTED column click → URL navigation (not SlidePanel)
  const handleColumnClick = useCallback((col) => {
    const newPath = [...path, col.id].join('/');
    router.push(`/cohort/${encodeURIComponent(cohortId)}/eval/${newPath}`);
  }, [cohortId, path, router]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const sortedCategories = useMemo(() =>
    (config?.evaluation_categories || []).sort((a, b) => a.order - b.order),
    [config]
  );

  // Breadcrumb items — built from path array (shown only when path.length >= 2)
  const breadcrumbItems = useMemo(() => {
    if (!config || path.length < 2) return [];
    return path.map((id, idx) => {
      const partial = path.slice(0, idx + 1);
      const cat = findCategoryByPath(config.evaluation_categories, partial);
      return {
        id,
        name: cat?.name || id,
        href: `/cohort/${encodeURIComponent(cohortId)}/eval/${partial.join('/')}`,
        isCurrent: idx === path.length - 1,
      };
    });
  }, [config, cohortId, path]);

  // ── ROOT columns & cell data ───────────────────────────────────────────────
  const rootColumns = useMemo(() => {
    if (!isRoot) return [];
    return sortedCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      type: COLUMN_TYPE.COMPUTED,
      maxScore: cat.max_score,
      isBonus: cat.is_bonus,
      clickable: true,
    }));
  }, [isRoot, sortedCategories]);

  const rootCellData = useMemo(() => {
    if (!isRoot) return {};
    const totals = results?.results?.totals;
    if (!totals) return {};
    const allStudents = students?.students || [];
    const calcResults = scores?.calculated || {};
    const d = {};
    for (const student of allStudents) {
      const t = totals[student.id];
      d[student.id] = {};
      if (t?.breakdown) {
        for (const catId of Object.keys(t.breakdown)) {
          const catCalc = calcResults[catId]?.[student.id];
          // raw === null 이면 미입력 상태 → null 표시
          const scoreValue = (!catCalc || catCalc.raw === null) ? null : (t.breakdown[catId]?.score ?? null);
          d[student.id][catId] = scoreValue;
        }
      }
      // 카테고리별 오류 포함
      for (const catId of Object.keys(calcResults)) {
        const cat = (config?.evaluation_categories || []).find(c => c.id === catId);
        const hasFormulaError = cat?.scoring_method === SCORING_METHOD.COMPOSITE && !cat?.config?.final_formula?.trim();
        const catResult = calcResults[catId]?.[student.id];
        if (hasFormulaError || catResult?.error) {
          d[student.id][`_err_${catId}`] = catResult?.error || 'formula_missing';
        }
      }
    }
    return d;
  }, [isRoot, results, students, scores, config]);

  // ── NON-ROOT columns & cell data ──────────────────────────────────────────
  const inputFields = category?.input_fields || [];
  const subCategories = category?.sub_categories || [];
  const isComposite = category?.scoring_method === SCORING_METHOD.COMPOSITE;
  const isTeamScope = !isRoot && category?.input_scope === 'team';

  const tableColumns = useMemo(() =>
    isRoot ? rootColumns : buildTableColumns(inputFields, subCategories),
    [isRoot, rootColumns, inputFields, subCategories]
  );

  const tableRows = useMemo(() => {
    if (!isTeamScope) return null;
    return (config?.teams || []).map(t => ({ id: t.id, name: t.name }));
  }, [isTeamScope, config]);

  const cellData = useMemo(() => {
    if (isRoot) return rootCellData;
    if (isTeamScope) {
      // 팀 모드: raw_scores가 teamId 키로 저장됨
      return scores?.raw_scores?.[categoryId] || {};
    }
    const rawScores = scores?.raw_scores?.[categoryId] || {};
    const calcResults = scores?.calculated?.[categoryId] || {};
    return buildCellData(rawScores, calcResults, students?.students || [], subCategories);
  }, [isRoot, rootCellData, isTeamScope, scores, categoryId, students, subCategories]);

  const categoryOverrides = useMemo(
    () => isRoot ? {} : (scores?.overrides?.[categoryId] || {}),
    [isRoot, scores, categoryId]
  );

  const resultColumns = useMemo(() => {
    if (isRoot) {
      const totals = results?.results?.totals;
      return [
        { id: 'total', label: '총점', getValue: (sid) => totals?.[sid]?.total ?? null },
        { id: 'rank', label: '순위', getValue: (sid) => totals?.[sid]?.rank ?? null },
      ];
    }
    if (!category) return [];
    const calcResults = scores?.calculated?.[categoryId] || {};
    return buildResultColumns(category, calcResults, categoryOverrides, true);
  }, [isRoot, results, scores, categoryId, category, categoryOverrides]);

  const showWeightRow = !isRoot && tableColumns.length > 0 && !isComposite;

  // ── Render ─────────────────────────────────────────────────────────────────
  // config 로딩 완료 여부로 렌더 결정 (scores/results 실패해도 config만 있으면 렌더 가능)
  if (!config || (!isRoot && !category)) {
    return <div className="p-6 text-muted-foreground">로딩 중...</div>;
  }

  const enc = encodeURIComponent;

  // 빈 상태 온보딩 (루트 페이지에서만)
  if (isRoot) {
    const hasStudents = (students?.students?.length ?? 0) > 0;
    const hasCategories = sortedCategories.length > 0;

    if (!hasStudents) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <p className="mb-2">학생이 없습니다. 먼저 학생을 추가해야 평가를 시작할 수 있습니다.</p>
          <Link href={`/cohort/${enc(cohortId)}/students`} className="text-primary underline">
            학생 관리로 이동 →
          </Link>
        </div>
      );
    }

    if (!hasCategories) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <p>평가 항목이 없습니다. 항목을 추가하세요.</p>
        </div>
      );
    }
  }

  return (
    <div className="p-6">
      {/* Breadcrumb — depth >= 2 */}
      {breadcrumbItems.length >= 2 && (
        <nav data-testid="eval-breadcrumb" className="flex items-center gap-1 mb-4 text-sm flex-wrap">
          <span>
            <Link
              href={`/cohort/${enc(cohortId)}/eval`}
              className="text-muted-foreground hover:underline"
            >
              전체 평가
            </Link>
          </span>
          {breadcrumbItems.map((item) => (
            <span key={item.id} className="flex items-center gap-1">
              <span className="text-muted-foreground">›</span>
              {item.isCurrent ? (
                <span className="font-medium">{item.name}</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:underline"
                >
                  {item.name}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Depth-1 back button (no breadcrumb at depth 1) */}
      {!isRoot && path.length === 1 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button
            className="text-muted-foreground hover:underline"
            onClick={() => router.push(`/cohort/${enc(cohortId)}/eval`)}
          >
            ◀ 전체 평가
          </button>
          <span className="text-muted-foreground">›</span>
          <span className="font-medium">{category?.name}</span>
        </div>
      )}

      {/* Team input scope badge */}
      {category?.input_scope === 'team' && (
        <span
          data-testid="input-scope-badge"
          aria-label="팀별 입력 모드"
          className="inline-block mb-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
        >
          팀별
        </span>
      )}

      {/* Formula 경고 배너 (composite이고 formula 미설정 시) */}
      {!isRoot && category?.scoring_method === SCORING_METHOD.COMPOSITE && !category?.config?.final_formula?.trim() && (
        <div data-testid="formula-warning" className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          최종 공식이 설정되지 않았습니다. ⚙ 설정에서 최종 공식을 입력하세요.
        </div>
      )}

      {/* Inline Settings (non-root) */}
      {!isRoot && <InlineSettings category={category} onSave={handleSettingsSave} />}

      {/* Dropout toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Checkbox id="show-dropout-evalnode" checked={showDropout} onCheckedChange={setShowDropout} />
        <Label htmlFor="show-dropout-evalnode" className="text-sm">중도퇴소 인원 표시</Label>
      </div>

      {/* DataTable */}
      <DataTable
        title={isRoot ? '전체 평가' : (category?.name || '')}
        columns={tableColumns}
        rows={tableRows}
        students={students?.students || []}
        cellData={cellData}
        showWeightRow={showWeightRow}
        scoringMethod={isRoot ? null : category?.scoring_method}
        onWeightChange={handleWeightChange}
        resultColumns={resultColumns}
        onCellChange={handleScoreChange}
        onBulkCellChange={handleBulkScoreChange}
        onColumnClick={handleColumnClick}
        showDropout={showDropout}
        overrides={categoryOverrides}
        onOverrideChange={isComposite ? undefined : handleOverrideChange}
        onBulkOverrideChange={isComposite ? undefined : handleBulkOverrideChange}
      />

      {/* FieldManager (non-root) */}
      {!isRoot && <FieldManager category={category} onSave={handleSettingsSave} />}

      {/* Conflict Dialog */}
      <ConflictDialog
        open={conflictOpen}
        onClose={() => { setConflictOpen(false); setPendingChange(null); }}
        onKeepMine={handleConflictKeepMine}
        onUseServer={handleConflictUseServer}
      />
    </div>
  );
}
