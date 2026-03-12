'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCORING_METHOD } from '@/lib/schema';
import CategoryCard from '@/components/eval/CategoryCard';

export default function CohortDashboard({ params }) {
  const { id: cohortId } = use(params);
  const { config, students, scores, loading, fetchConfig, fetchScores, fetchResults } = useCohortDataContext();
  const router = useRouter();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDropout, setShowDropout] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatMethod, setNewCatMethod] = useState(SCORING_METHOD.USER_INPUT);
  const [newCatMax, setNewCatMax] = useState('10');
  const [newCatBonus, setNewCatBonus] = useState(false);

  // 집계 설정 state
  const aggSettings = config?.aggregation_settings || {};
  const [aggMethod, setAggMethod] = useState(aggSettings.method || 'sum');
  const [aggMaxScore, setAggMaxScore] = useState(String(aggSettings.max_score ?? 100));
  const [aggBonusLimit, setAggBonusLimit] = useState(String(aggSettings.bonus_limit ?? 3));

  if (loading || !config) {
    return <div className="p-6 text-muted-foreground">로딩 중...</div>;
  }

  const categories = (config.evaluation_categories || []).sort((a, b) => a.order - b.order);
  const activeStudents = students?.students?.filter(s => !s.is_dropout) || [];
  const dropoutCount = students?.students?.filter(s => s.is_dropout).length || 0;

  const handleAddCategory = async () => {
    if (!newCatName) return;
    await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}/config/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCatName,
        scoring_method: newCatMethod,
        max_score: Number(newCatMax) || 0,
        is_bonus: newCatBonus,
      }),
    });
    setAddDialogOpen(false);
    setNewCatName('');
    setNewCatMax('10');
    setNewCatBonus(false);
    await fetchConfig();
    await fetchScores();
  };

  const handleCategoryClick = (category) => {
    router.push(`/cohort/${encodeURIComponent(cohortId)}/eval/${category.id}`);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('이 평가항목을 삭제하시겠습니까? (입력된 점수 데이터는 보존됩니다)')) return;
    await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}/config/categories/${categoryId}`, {
      method: 'DELETE',
    });
    await fetchConfig();
  };

  const handleReorder = async (index, direction) => {
    const sorted = [...categories];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // swap orders
    const orderedIds = sorted.map(c => c.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];

    await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        evaluation_categories: config.evaluation_categories.map(c => {
          const newOrder = orderedIds.indexOf(c.id) + 1;
          return { ...c, order: newOrder };
        }),
      }),
    });
    await fetchConfig();
  };

  const handleAggSettingChange = async (field, value) => {
    const newSettings = {
      method: aggMethod,
      max_score: Number(aggMaxScore) || 100,
      bonus_limit: Number(aggBonusLimit) || 3,
      [field]: field === 'method' ? value : Number(value) || 0,
    };

    if (field === 'method') setAggMethod(value);
    else if (field === 'max_score') setAggMaxScore(value);
    else if (field === 'bonus_limit') setAggBonusLimit(value);

    await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        aggregation_settings: newSettings,
      }),
    });
    await fetchConfig();
    await fetchResults();
  };

  return (
    <div className="p-6 max-w-4xl">
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <div className="flex items-center gap-2 mb-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {settingsOpen ? '▼' : '▶'} ⚙ 총점 집계 설정
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="border rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm">집계 방식</Label>
              <Select value={aggMethod} onValueChange={(v) => handleAggSettingChange('method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">단순 합산</SelectItem>
                  <SelectItem value="weighted">가중 합산</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">기본 만점</Label>
              <Input
                type="number"
                value={aggMaxScore}
                onChange={e => setAggMaxScore(e.target.value)}
                onBlur={() => handleAggSettingChange('max_score', aggMaxScore)}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-sm">가산점 한도</Label>
              <Input
                type="number"
                value={aggBonusLimit}
                onChange={e => setAggBonusLimit(e.target.value)}
                onBlur={() => handleAggSettingChange('bonus_limit', aggBonusLimit)}
                className="h-8"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          학생: {activeStudents.length}명
          {dropoutCount > 0 && ` (중도퇴소 ${dropoutCount}명)`}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-dropout"
            checked={showDropout}
            onCheckedChange={setShowDropout}
          />
          <Label htmlFor="show-dropout" className="text-sm">중도퇴소 인원 표시</Label>
        </div>
      </div>

      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground font-medium">
          <span className="w-4" />
          <span className="flex-1">평가 항목</span>
          <span className="w-12 text-right">만점</span>
          <span className="w-16 text-center">방식</span>
          <span className="w-20 text-center">진행률</span>
          <span className="w-[5.5rem]" />
        </div>
        {categories.map((cat, idx) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            scores={scores}
            students={students?.students}
            onClick={() => handleCategoryClick(cat)}
            onDelete={() => handleDeleteCategory(cat.id)}
            onMoveUp={idx > 0 ? () => handleReorder(idx, -1) : null}
            onMoveDown={idx < categories.length - 1 ? () => handleReorder(idx, 1) : null}
          />
        ))}
      </div>

      <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
        + 평가항목 추가
      </Button>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>평가항목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>항목명</Label>
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="예: 수업참여도" />
            </div>
            <div>
              <Label>만점</Label>
              <Input type="number" value={newCatMax} onChange={e => setNewCatMax(e.target.value)} />
            </div>
            <div>
              <Label>평가 방식</Label>
              <Select value={newCatMethod} onValueChange={setNewCatMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SCORING_METHOD).map(([key, val]) => (
                    <SelectItem key={val} value={val}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="bonus" checked={newCatBonus} onCheckedChange={setNewCatBonus} />
              <Label htmlFor="bonus">가산점 항목</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>취소</Button>
            <Button onClick={handleAddCategory} disabled={!newCatName}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
