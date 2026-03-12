'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const MIN_WIDTH = 180;
const MAX_WIDTH = 500;

export default function Sidebar({ results, students, onModeChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState('actual'); // actual | projected
  const [sortAsc, setSortAsc] = useState(false);
  const [width, setWidth] = useState(224); // w-56 = 224px
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // 사이드바가 우측이라 왼쪽으로 드래그하면 넓어짐
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleModeChange = (checked) => {
    const newMode = checked ? 'projected' : 'actual';
    setMode(newMode);
    onModeChange?.(newMode);
  };

  const sortedStudents = useMemo(() => {
    if (!results?.results?.totals || !students?.students) return [];

    const activeStudents = students.students.filter(s => !s.is_dropout);
    return activeStudents
      .map(s => ({
        ...s,
        total: results.results.totals[s.id]?.total ?? 0,
        rank: results.results.totals[s.id]?.rank ?? '-',
      }))
      .sort((a, b) => sortAsc ? a.total - b.total : b.total - a.total);
  }, [results, students, sortAsc]);

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-l flex flex-col items-center pt-4">
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(false)} className="text-xs writing-mode-vertical">
          총점 ▶
        </Button>
      </div>
    );
  }

  return (
    <div className="relative shrink-0 border-l flex flex-col bg-[var(--color-sidebar-bg)]" style={{ width: `${width}px` }}>
      {/* 리사이즈 핸들 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10"
        onMouseDown={handleMouseDown}
      />
      <div className="p-3 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">총점</span>
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(true)} className="text-xs h-6 px-1">
          ◀
        </Button>
      </div>

      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            정렬: {sortAsc ? '오름차순' : '내림차순'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSortAsc(!sortAsc)} className="text-xs h-6 px-1">
            {sortAsc ? '↑' : '↓'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="mode-toggle" checked={mode === 'projected'} onCheckedChange={handleModeChange} />
          <Label htmlFor="mode-toggle" className="text-xs">
            {mode === 'projected' ? '예상' : '누적'}
          </Label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedStudents.map((s, i) => (
          <div
            key={s.id}
            className="px-3 py-1.5 flex items-center justify-between hover:bg-[var(--color-sidebar-hover)] text-sm"
          >
            <span className="truncate">{s.name}</span>
            <span className="font-mono tabular-nums ml-2">
              {s.total.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
