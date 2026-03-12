'use client';

import { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SCORING_METHOD } from '@/lib/schema';

export default function ScoreTable({
  category,
  students,
  scores,
  calculatedResults,
  showDropout,
  onScoreChange,
  onSubCategoryClick,
}) {
  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  const activeStudents = showDropout
    ? students
    : students.filter(s => !s.is_dropout);

  const categoryScores = scores?.raw_scores?.[category.id] || {};
  const calcResults = calculatedResults?.[category.id] || {};

  const isComposite = category.scoring_method === SCORING_METHOD.COMPOSITE;
  const subCategories = category.sub_categories || [];
  const inputFields = category.input_fields || [];

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortedStudents = [...activeStudents].sort((a, b) => {
    let va, vb;
    if (sortKey === 'name') {
      va = a.name; vb = b.name;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    if (sortKey === 'calculated') {
      va = calcResults[a.id]?.calculated ?? 0;
      vb = calcResults[b.id]?.calculated ?? 0;
    } else if (sortKey === 'rank') {
      va = calcResults[a.id]?.rank ?? 999;
      vb = calcResults[b.id]?.rank ?? 999;
    } else {
      va = categoryScores[a.id]?.[sortKey] ?? '';
      vb = categoryScores[b.id]?.[sortKey] ?? '';
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortAsc ? va - vb : vb - va;
    }
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const SortHeader = ({ sortId, children, className }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-accent/50 ${className || ''}`}
      onClick={() => handleSort(sortId)}
    >
      {children} {sortKey === sortId ? (sortAsc ? '↑' : '↓') : '↕'}
    </TableHead>
  );

  const handleCellChange = useCallback((studentId, fieldId, value) => {
    onScoreChange?.(studentId, fieldId, value);
  }, [onScoreChange]);

  if (isComposite) {
    // Composite table: shows sub-category calculated values
    return (
      <Table className="min-w-[60%] w-fit">
        <TableHeader>
          <TableRow>
            <SortHeader sortId="name">이름</SortHeader>
            {subCategories.map(sub => (
              <SortHeader key={sub.id} sortId={sub.id} className="text-center">
                {sub.name} ({sub.max_score})
              </SortHeader>
            ))}
            <SortHeader sortId="calculated" className="text-right">최종 ({category.max_score})</SortHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStudents.map(student => {
            const result = calcResults[student.id];
            return (
              <TableRow
                key={student.id}
                className={student.is_dropout ? 'bg-[var(--color-dropout-row)] text-[var(--color-dropout-text)]' : ''}
              >
                <TableCell>{student.name}</TableCell>
                {subCategories.map(sub => {
                  const subScore = result?.sub_scores?.[sub.id]?.calculated ?? '-';
                  return (
                    <TableCell key={sub.id} className="text-center">
                      <button
                        className="hover:underline text-blue-600"
                        onClick={() => onSubCategoryClick?.(sub)}
                      >
                        ▶ {typeof subScore === 'number' ? subScore.toFixed(1) : subScore}
                      </button>
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-medium">
                  {result?.calculated != null ? result.calculated.toFixed(1) : '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  // Leaf table: input fields + calculated result
  const showRank = category.scoring_method === SCORING_METHOD.RANK_DIFFERENTIAL;

  return (
    <Table className="min-w-[60%] w-fit">
      <TableHeader>
        <TableRow>
          <SortHeader sortId="name">이름</SortHeader>
          {inputFields.map(field => (
            <SortHeader key={field.id} sortId={field.id} className="text-center">
              {field.name}
            </SortHeader>
          ))}
          {showRank && <SortHeader sortId="rank" className="text-center">순위</SortHeader>}
          <SortHeader sortId="calculated" className="text-right">점수</SortHeader>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedStudents.map(student => {
          const studentScores = categoryScores[student.id] || {};
          const result = calcResults[student.id];
          return (
            <TableRow
              key={student.id}
              className={student.is_dropout ? 'bg-[var(--color-dropout-row)] text-[var(--color-dropout-text)]' : ''}
            >
              <TableCell>{student.name}</TableCell>
              {inputFields.map(field => (
                <TableCell key={field.id} className="text-center p-1">
                  <ScoreInput
                    field={field}
                    value={studentScores[field.id]}
                    onChange={v => handleCellChange(student.id, field.id, v)}
                    disabled={student.is_dropout}
                  />
                </TableCell>
              ))}
              {showRank && (
                <TableCell className="text-center">{result?.rank ?? '-'}</TableCell>
              )}
              <TableCell className="text-right font-medium">
                {result?.calculated != null ? (typeof result.calculated === 'number' ? result.calculated.toFixed(1) : result.calculated) : '-'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ScoreInput({ field, value, onChange, disabled }) {
  const [localValue, setLocalValue] = useState(value ?? '');

  const handleBlur = () => {
    if (field.type === 'number') {
      const num = localValue === '' ? null : Number(localValue);
      if (num !== value) onChange(num);
    } else {
      if (localValue !== value) onChange(localValue);
    }
  };

  if (field.type === 'boolean') {
    return (
      <Checkbox
        checked={!!value}
        onCheckedChange={v => onChange(v ? 1 : 0)}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      className="h-7 w-20 text-center text-sm"
      disabled={disabled}
      min={field.min}
      max={field.max}
      step="any"
    />
  );
}
