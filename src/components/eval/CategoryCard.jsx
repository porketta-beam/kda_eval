'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SCORING_METHOD } from '@/lib/schema';

const METHOD_LABELS = {
  [SCORING_METHOD.WEIGHTED_AVERAGE]: '가중평균',
  [SCORING_METHOD.SUM_DIVIDE]: '합산',
  [SCORING_METHOD.RANK_DIFFERENTIAL]: '순위',
  [SCORING_METHOD.FORMULA]: '공식',
  [SCORING_METHOD.BOOLEAN]: 'Boolean',
  [SCORING_METHOD.BOOLEAN_WITH_DEDUCTION]: '차감법',
  [SCORING_METHOD.USER_INPUT]: '수동입력',
  [SCORING_METHOD.COMPOSITE]: '복합',
};

export default function CategoryCard({ category, scores, students, onClick, onDelete, onMoveUp, onMoveDown }) {
  const methodLabel = METHOD_LABELS[category.scoring_method] || category.scoring_method;

  // 진행률 계산: 점수가 입력된 학생 수 / 전체 활성 학생 수
  const activeStudents = students?.filter(s => !s.is_dropout) || [];
  const categoryScores = scores?.raw_scores?.[category.id] || {};
  const filledCount = activeStudents.filter(s => {
    const studentScores = categoryScores[s.id];
    if (!studentScores) return false;
    return Object.values(studentScores).some(v => v !== null && v !== undefined && v !== '');
  }).length;
  const progress = activeStudents.length > 0 ? filledCount / activeStudents.length : 0;

  return (
    <div className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors flex items-center gap-3">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-muted-foreground">▶</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{category.name}</span>
            {category.is_bonus && <Badge variant="secondary" className="text-xs">가산점</Badge>}
          </div>
        </div>
        <div className="text-sm text-muted-foreground w-12 text-right">{category.max_score}</div>
        <div className="text-xs text-muted-foreground w-16 text-center">{methodLabel}</div>
        <div className="w-20">
          <div className="h-2 rounded-full bg-[var(--color-progress-bg)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-progress-fill)] transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-0.5">
        {onMoveUp && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onMoveUp(); }}>
            ↑
          </Button>
        )}
        {onMoveDown && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onMoveDown(); }}>
            ↓
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            ×
          </Button>
        )}
      </div>
    </div>
  );
}
