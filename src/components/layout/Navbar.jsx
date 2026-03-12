'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [cohorts, setCohorts] = useState([]);
  const currentCohortId = pathname.match(/\/cohort\/([^/]+)/)?.[1] || '';

  useEffect(() => {
    fetch('/api/cohorts')
      .then(r => r.json())
      .then(setCohorts)
      .catch(() => {});
  }, []);

  const handleCohortChange = (value) => {
    router.push(`/cohort/${encodeURIComponent(value)}`);
  };

  const handleExport = (type) => {
    if (!currentCohortId) return;
    const url = `/api/cohorts/${encodeURIComponent(currentCohortId)}/export?type=${type}`;
    window.open(url, '_blank');
  };

  return (
    <nav className="h-14 border-b flex items-center px-4 gap-4 bg-background">
      <button
        onClick={() => router.push('/')}
        className="font-bold text-lg tracking-tight"
      >
        [KDA] 평가 시스템
      </button>

      {cohorts.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">기수:</span>
          <Select value={currentCohortId} onValueChange={handleCohortChange}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="기수 선택" />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="ml-auto">
        {currentCohortId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">내보내기 ↗</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('summary')}>
                총점 요약 CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('detail')}>
                전체 상세 CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" disabled>내보내기 ↗</Button>
        )}
      </div>
    </nav>
  );
}
