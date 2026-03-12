'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function SummaryTable({
  title,
  students,
  columns,
  data,
  onColumnClick,
  showRank = true,
}) {
  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortedStudents = [...students].sort((a, b) => {
    let va, vb;
    if (sortKey === 'name') {
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortKey === 'total') {
      va = data[a.id]?.total ?? 0;
      vb = data[b.id]?.total ?? 0;
    } else if (sortKey === 'rank') {
      va = data[a.id]?.rank ?? 999;
      vb = data[b.id]?.rank ?? 999;
    } else {
      va = data[a.id]?.scores?.[sortKey] ?? -Infinity;
      vb = data[b.id]?.scores?.[sortKey] ?? -Infinity;
    }
    return sortAsc ? va - vb : vb - va;
  });

  const SortHeader = ({ sortId, children, className }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-accent/50 ${className || ''}`}
      onClick={() => handleSort(sortId)}
    >
      {children} {sortKey === sortId ? (sortAsc ? '↑' : '↓') : '↕'}
    </TableHead>
  );

  const formatValue = (v) => {
    if (v == null) return '-';
    if (typeof v === 'number') return v.toFixed(1);
    return v;
  };

  const handleCellClick = (column) => {
    if (column.isClickable && onColumnClick) {
      onColumnClick(column);
    }
  };

  const clickableClass = 'text-blue-600 hover:underline cursor-pointer';

  return (
    <div className="mb-4">
      {title && <h3 className="text-sm font-semibold mb-2">{title}</h3>}
      <Table className="min-w-[60%] w-fit">
        <TableHeader>
          <TableRow>
            <SortHeader sortId="name">이름</SortHeader>
            {columns.map(col => (
              <SortHeader key={col.id} sortId={col.id} className="text-center">
                <span
                  className={col.isClickable ? clickableClass : ''}
                  onClick={col.isClickable ? (e) => { e.stopPropagation(); handleCellClick(col); } : undefined}
                >
                  {col.name} ({col.maxScore})
                </span>
                {col.isBonus && <Badge variant="secondary" className="ml-1 text-xs">가산점</Badge>}
              </SortHeader>
            ))}
            <SortHeader sortId="total" className="text-right">총점</SortHeader>
            {showRank && <SortHeader sortId="rank" className="text-center">순위</SortHeader>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStudents.map(student => {
            const row = data[student.id];
            return (
              <TableRow
                key={student.id}
                className={student.is_dropout ? 'bg-[var(--color-dropout-row)] text-[var(--color-dropout-text)]' : ''}
              >
                <TableCell>{student.name}</TableCell>
                {columns.map(col => {
                  const value = row?.scores?.[col.id];
                  return (
                    <TableCell key={col.id} className="text-center">
                      {col.isClickable ? (
                        <button
                          className={clickableClass}
                          onClick={() => handleCellClick(col)}
                        >
                          {formatValue(value)}
                        </button>
                      ) : (
                        formatValue(value)
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-medium">
                  {formatValue(row?.total)}
                </TableCell>
                {showRank && (
                  <TableCell className="text-center">
                    {row?.rank ?? '-'}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
