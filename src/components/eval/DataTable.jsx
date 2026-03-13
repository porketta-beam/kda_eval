'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { SCORING_METHOD, COLUMN_TYPE } from '@/lib/schema';

/**
 * 통합 데이터 테이블 — 읽기전용(SummaryTable) + 입력(ScoreTable) 통합
 *
 * @param {Object} props
 * @param {string} [props.title]
 * @param {Array<{
 *   id: string,
 *   name: string,
 *   type: 'input' | 'computed',
 *   fieldType?: string,      // input: 'number' | 'text' | 'boolean'
 *   min?: number,
 *   max?: number,
 *   maxScore?: number,       // computed: 만점
 *   isBonus?: boolean,
 *   clickable?: boolean,     // computed: 클릭 가능 여부
 *   weight?: number,
 * }>} props.columns
 * @param {import('@/lib/schema').Student[]} props.students
 * @param {Object<string, Object<string, *>>} props.cellData - { [studentId]: { [colId]: value } }
 * @param {boolean} [props.showWeightRow]
 * @param {string} [props.scoringMethod] - SCORING_METHOD value
 * @param {Function} [props.onWeightChange] - (colId, weight) => void
 * @param {Array<{ id: string, label: string, getValue: (studentId: string) => * }>} [props.resultColumns]
 * @param {Function} [props.onCellChange] - (studentId, colId, value) => void
 * @param {Function} [props.onBulkCellChange] - (batch: { [studentId]: { [colId]: value } }) => void
 * @param {Function} [props.onColumnClick] - (column) => void
 * @param {boolean} [props.showDropout]
 * @param {Object<string, number|null>} [props.overrides] - { [studentId]: number|null }
 * @param {Function} [props.onOverrideChange] - (studentId, value) => void
 * @param {Function} [props.onBulkOverrideChange] - (batch: { [studentId]: number|null }) => void
 */
export default function DataTable({
  title,
  columns = [],
  students = [],
  cellData = {},
  showWeightRow = false,
  scoringMethod,
  onWeightChange,
  resultColumns = [],
  onCellChange,
  onBulkCellChange,
  onColumnClick,
  showDropout,
  overrides,
  onOverrideChange,
  onBulkOverrideChange,
}) {
  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const tableRef = useRef(null);

  const activeStudents = useMemo(
    () => showDropout ? students : students.filter(s => !s.is_dropout),
    [students, showDropout]
  );

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const inputColumns = useMemo(
    () => columns.filter(c => c.type === COLUMN_TYPE.INPUT),
    [columns]
  );

  // Pre-build col.id → input index map for O(1) lookup per cell
  const inputColIndexMap = useMemo(() => {
    const map = {};
    inputColumns.forEach((c, i) => { map[c.id] = i; });
    return map;
  }, [inputColumns]);

  const sortedStudents = useMemo(() => {
    return [...activeStudents].sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const resultCol = resultColumns.find(rc => rc.id === sortKey);
      if (resultCol) {
        va = resultCol.getValue(a.id) ?? (sortKey === 'rank' ? 999 : -Infinity);
        vb = resultCol.getValue(b.id) ?? (sortKey === 'rank' ? 999 : -Infinity);
      } else if (sortKey === 'override') {
        va = overrides?.[a.id] ?? -Infinity;
        vb = overrides?.[b.id] ?? -Infinity;
      } else {
        va = cellData[a.id]?.[sortKey] ?? -Infinity;
        vb = cellData[b.id]?.[sortKey] ?? -Infinity;
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [activeStudents, sortKey, sortAsc, resultColumns, overrides, cellData]);

  // 셀 이동 (키보드 네비)
  const focusCell = useCallback((currentRow, currentCol, dRow, dCol) => {
    if (!tableRef.current) return;
    const targetRow = currentRow + dRow;
    const targetCol = currentCol + dCol;
    const selector = `[data-row="${targetRow}"][data-col="${targetCol}"]`;
    const targetInput = tableRef.current.querySelector(selector);
    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    }
  }, []);

  // 클립보드 텍스트를 2D 배열로 파싱
  const parseClipboard = useCallback((e) => {
    const pasteData = e.clipboardData?.getData('text');
    if (!pasteData) return null;
    const rows = pasteData.split(/\r?\n/).filter(r => r.length > 0);
    if (rows.length <= 1 && !rows[0]?.includes('\t')) return null;
    e.preventDefault();
    return rows.map(row => row.split('\t'));
  }, []);

  // 엑셀 붙여넣기 — input 칼럼만 대상
  const handlePaste = useCallback((e, startRow, startCol) => {
    const parsed = parseClipboard(e);
    if (!parsed) return;

    const batch = {};
    for (let r = 0; r < parsed.length; r++) {
      const studentIdx = startRow + r;
      if (studentIdx >= sortedStudents.length) break;
      const student = sortedStudents[studentIdx];

      for (let c = 0; c < parsed[r].length; c++) {
        const fieldIdx = startCol + c;
        if (fieldIdx >= inputColumns.length) break;
        const col = inputColumns[fieldIdx];
        const raw = parsed[r][c].trim();

        let value;
        if (col.fieldType === 'number') {
          value = raw === '' ? null : Number(raw);
          if (value !== null && isNaN(value)) continue;
        } else if (col.fieldType === 'boolean') {
          value = (raw === '1' || raw.toLowerCase() === 'true') ? 1 : 0;
        } else {
          value = raw;
        }

        if (!batch[student.id]) batch[student.id] = {};
        batch[student.id][col.id] = value;
      }
    }

    if (Object.keys(batch).length > 0) {
      onBulkCellChange?.(batch);
    }

    if (document.activeElement) document.activeElement.blur();
  }, [sortedStudents, inputColumns, onBulkCellChange, parseClipboard]);

  // 엑셀 붙여넣기 — 수정(override) 칼럼 대상
  const handleOverridePaste = useCallback((e, startRow) => {
    const parsed = parseClipboard(e);
    if (!parsed) return;

    const batch = {};
    for (let r = 0; r < parsed.length; r++) {
      const studentIdx = startRow + r;
      if (studentIdx >= sortedStudents.length) break;
      const student = sortedStudents[studentIdx];
      const raw = parsed[r][0].trim();
      const value = raw === '' ? null : Number(raw);
      if (value !== null && isNaN(value)) continue;
      batch[student.id] = value;
    }

    if (Object.keys(batch).length > 0) {
      onBulkOverrideChange?.(batch);
    }

    if (document.activeElement) document.activeElement.blur();
  }, [sortedStudents, onBulkOverrideChange, parseClipboard]);

  const clickableClass = 'text-blue-600 hover:underline cursor-pointer';

  const formatValue = (v) => {
    if (v == null) return '-';
    if (typeof v === 'number') return v.toFixed(1);
    return v;
  };

  const weightLabel = scoringMethod === SCORING_METHOD.SUM_DIVIDE ? '배수' : '가중치';

  const hasOverrideColumn = !!onOverrideChange;

  return (
    <div className="mb-4" ref={tableRef}>
      {title && <h3 className="text-sm font-semibold mb-2">{title}</h3>}
      <Table className="min-w-[60%] w-fit">
        <TableHeader>
          <TableRow>
            <SortHeader sortKey={sortKey} sortAsc={sortAsc} sortId="name" onSort={handleSort}>이름</SortHeader>
            {columns.map(col => (
              <SortHeader key={col.id} sortKey={sortKey} sortAsc={sortAsc} sortId={col.id} onSort={handleSort} className="text-center">
                {col.type === COLUMN_TYPE.COMPUTED && col.clickable ? (
                  <span
                    className={clickableClass}
                    onClick={(e) => { e.stopPropagation(); onColumnClick?.(col); }}
                  >
                    {col.name}{col.maxScore != null ? ` (${col.maxScore})` : ''}
                  </span>
                ) : (
                  <span>
                    {col.name}{col.maxScore != null ? ` (${col.maxScore})` : ''}
                  </span>
                )}
                {col.isBonus && <Badge variant="secondary" className="ml-1 text-xs">가산점</Badge>}
              </SortHeader>
            ))}
            {hasOverrideColumn && (
              <SortHeader sortKey={sortKey} sortAsc={sortAsc} sortId="override" onSort={handleSort} className="text-center">수정</SortHeader>
            )}
            {resultColumns.map(rc => (
              <SortHeader key={rc.id} sortKey={sortKey} sortAsc={sortAsc} sortId={rc.id} onSort={handleSort} className={rc.id === 'rank' ? 'text-center' : 'text-right'}>
                {rc.label}
              </SortHeader>
            ))}
          </TableRow>

          {/* 가중치 행 */}
          {showWeightRow && (
            <TableRow className="bg-muted/30">
              <TableCell className="text-xs text-muted-foreground font-medium">{weightLabel}</TableCell>
              {columns.map(col => (
                <TableCell key={col.id} className="text-center p-1">
                  <Input
                    type="number"
                    value={col.weight ?? 1}
                    onChange={e => {
                      const v = e.target.value === '' ? 1 : Number(e.target.value);
                      onWeightChange?.(col.id, v);
                    }}
                    className="h-6 w-14 text-center text-xs mx-auto"
                    step="any"
                    min={0}
                  />
                </TableCell>
              ))}
              {hasOverrideColumn && <TableCell />}
              {resultColumns.map(rc => (
                <TableCell key={rc.id} />
              ))}
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {sortedStudents.map((student, rowIdx) => {
            const studentData = cellData[student.id] || {};
            const overrideVal = overrides?.[student.id];
            const hasOverride = overrideVal != null;

            return (
              <TableRow
                key={student.id}
                className={student.is_dropout ? 'bg-[var(--color-dropout-row)] text-[var(--color-dropout-text)]' : ''}
              >
                <TableCell>{student.name}</TableCell>
                {columns.map((col) => {
                  if (col.type === COLUMN_TYPE.INPUT) {
                    return (
                      <TableCell key={col.id} className="text-center p-1">
                        <ScoreInput
                          field={{ id: col.id, type: col.fieldType || 'number', min: col.min, max: col.max }}
                          value={studentData[col.id]}
                          onChange={v => onCellChange?.(student.id, col.id, v)}
                          row={rowIdx}
                          col={inputColIndexMap[col.id]}
                          onNavigate={focusCell}
                          onPaste={handlePaste}
                        />
                      </TableCell>
                    );
                  }
                  // computed
                  const value = studentData[col.id];
                  return (
                    <TableCell key={col.id} className="text-center">
                      {col.clickable ? (
                        <button
                          className={clickableClass}
                          onClick={() => onColumnClick?.(col)}
                        >
                          ▶ {formatValue(value)}
                        </button>
                      ) : (
                        formatValue(value)
                      )}
                    </TableCell>
                  );
                })}

                {/* Override 칼럼 */}
                {hasOverrideColumn && (
                  <TableCell className="text-center p-1">
                    <OverrideInput
                      value={overrideVal}
                      onChange={v => onOverrideChange?.(student.id, v)}
                      row={rowIdx}
                      onPaste={handleOverridePaste}
                      tableRef={tableRef}
                      hasOverride={hasOverride}
                    />
                  </TableCell>
                )}

                {/* Result 칼럼 */}
                {resultColumns.map(rc => {
                  const val = rc.getValue(student.id);
                  return (
                    <TableCell
                      key={rc.id}
                      className={`${rc.id === 'rank' ? 'text-center' : 'text-right'} font-medium ${hasOverride && rc.id !== 'rank' ? 'text-amber-600 font-bold' : ''}`}
                    >
                      {formatValue(val)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── SortHeader: 정렬 가능한 헤더 셀 ──────────────────────────

function SortHeader({ sortKey, sortAsc, sortId, onSort, children, className }) {
  const indicator = sortKey === sortId ? (sortAsc ? '↑' : '↓') : '↕';
  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-accent/50 ${className || ''}`}
      onClick={() => onSort(sortId)}
    >
      {children} {indicator}
    </TableHead>
  );
}

// ─── ScoreInput: 입력 셀 (기존 ScoreTable에서 이동) ─────────

function ScoreInput({ field, value, onChange, row, col, onNavigate, onPaste }) {
  const [localValue, setLocalValue] = useState(value ?? '');

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const handleBlur = () => {
    if (field.type === 'number') {
      const num = localValue === '' ? null : Number(localValue);
      if (num !== value) onChange(num);
    } else {
      if (localValue !== value) onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.target.blur();
      onNavigate?.(row, col, 1, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.target.blur();
      onNavigate?.(row, col, -1, 0);
    } else if (e.key === 'ArrowLeft') {
      const pos = e.target.selectionStart;
      if (pos === 0) {
        e.preventDefault();
        e.target.blur();
        onNavigate?.(row, col, 0, -1);
      }
    } else if (e.key === 'ArrowRight') {
      const pos = e.target.selectionStart;
      const len = e.target.value.length;
      if (pos === len) {
        e.preventDefault();
        e.target.blur();
        onNavigate?.(row, col, 0, 1);
      }
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

// ─── OverrideInput: 점수 오버라이드 입력 셀 ─────────────────

function OverrideInput({ value, onChange, hasOverride, row, onPaste, tableRef }) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');

  useEffect(() => {
    setLocalValue(value != null ? String(value) : '');
  }, [value]);

  const handleBlur = () => {
    if (localValue === '') {
      if (value != null) onChange(null);
    } else {
      const num = Number(localValue);
      if (!isNaN(num) && num !== value) {
        onChange(num);
      }
    }
  };

  const focusOverrideRow = (targetRow) => {
    if (!tableRef?.current) return;
    const target = tableRef.current.querySelector(`[data-override-row="${targetRow}"]`);
    if (target) { target.focus(); target.select(); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.target.blur();
      focusOverrideRow(row + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.target.blur();
      focusOverrideRow(row - 1);
    }
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={e => onPaste?.(e, row)}
      data-override-row={row}
      className={`h-7 w-20 text-center text-sm ${hasOverride ? 'bg-amber-50 border-amber-300' : ''}`}
      step="any"
      placeholder="-"
    />
  );
}
