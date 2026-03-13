'use client';

import { useState, useCallback, useRef } from 'react';
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
  onBulkScoreChange,
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

  const tableRef = useRef(null);

  const handleCellChange = useCallback((studentId, fieldId, value) => {
    onScoreChange?.(studentId, fieldId, value);
  }, [onScoreChange]);

  // Enter 키로 다음 행 같은 칼럼으로 포커스 이동
  const focusNextRow = useCallback((currentRow, currentCol) => {
    if (!tableRef.current) return;
    const nextRow = currentRow + 1;
    const selector = `[data-row="${nextRow}"][data-col="${currentCol}"]`;
    const nextInput = tableRef.current.querySelector(selector);
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
  }, []);

  // 엑셀 칼럼 붙여넣기 처리 — 배치로 모아서 단일 요청
  const handlePaste = useCallback((e, startRow, startCol) => {
    const pasteData = e.clipboardData?.getData('text');
    if (!pasteData) return;

    // 탭+줄바꿈으로 분리 (엑셀 복사 형식)
    const rows = pasteData.split(/\r?\n/).filter(r => r.length > 0);
    // 단일 값이면 기본 동작 사용
    if (rows.length <= 1 && !rows[0]?.includes('\t')) return;

    e.preventDefault();

    const parsed = rows.map(row => row.split('\t'));

    // 배치 객체: { [studentId]: { [fieldId]: value } }
    const batch = {};

    for (let r = 0; r < parsed.length; r++) {
      const studentIdx = startRow + r;
      if (studentIdx >= sortedStudents.length) break;
      const student = sortedStudents[studentIdx];

      for (let c = 0; c < parsed[r].length; c++) {
        const fieldIdx = startCol + c;
        if (fieldIdx >= inputFields.length) break;
        const field = inputFields[fieldIdx];
        const raw = parsed[r][c].trim();

        let value;
        if (field.type === 'number') {
          value = raw === '' ? null : Number(raw);
          if (value !== null && isNaN(value)) continue;
        } else if (field.type === 'boolean') {
          value = (raw === '1' || raw.toLowerCase() === 'true') ? 1 : 0;
        } else {
          value = raw;
        }

        if (!batch[student.id]) batch[student.id] = {};
        batch[student.id][field.id] = value;
      }
    }

    // 단일 배치 요청으로 전송
    if (Object.keys(batch).length > 0) {
      onBulkScoreChange?.(batch);
    }

    // 붙여넣기 후 셀의 로컬 값도 업데이트하기 위해 blur
    if (document.activeElement) document.activeElement.blur();
  }, [sortedStudents, inputFields, onBulkScoreChange]);

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
    <div ref={tableRef}>
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
          {sortedStudents.map((student, rowIdx) => {
            const studentScores = categoryScores[student.id] || {};
            const result = calcResults[student.id];
            return (
              <TableRow
                key={student.id}
                className={student.is_dropout ? 'bg-[var(--color-dropout-row)] text-[var(--color-dropout-text)]' : ''}
              >
                <TableCell>{student.name}</TableCell>
                {inputFields.map((field, colIdx) => (
                  <TableCell key={field.id} className="text-center p-1">
                    <ScoreInput
                      field={field}
                      value={studentScores[field.id]}
                      onChange={v => handleCellChange(student.id, field.id, v)}
                      row={rowIdx}
                      col={colIdx}
                      onEnter={focusNextRow}
                      onPaste={handlePaste}
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
    </div>
  );
}

function ScoreInput({ field, value, onChange, row, col, onEnter, onPaste }) {
  const [localValue, setLocalValue] = useState(value ?? '');

  const handleBlur = () => {
    if (field.type === 'number') {
      const num = localValue === '' ? null : Number(localValue);
      if (num !== value) onChange(num);
    } else {
      if (localValue !== value) onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
      onEnter?.(row, col);
    }
  };

  if (field.type === 'boolean') {
    return (
      <Checkbox
        checked={!!value}
        onCheckedChange={v => onChange(v ? 1 : 0)}
      />
    );
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={e => onPaste?.(e, row, col)}
      className="h-7 w-20 text-center text-sm"
      data-row={row}
      data-col={col}
      min={field.min}
      max={field.max}
      step="any"
    />
  );
}
