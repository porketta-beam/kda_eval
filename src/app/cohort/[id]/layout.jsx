'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import useCohortData from '@/hooks/useCohortData';
import { CohortDataContext } from '@/hooks/CohortDataContext';

export default function CohortLayout({ children, params }) {
  const { id } = use(params);
  const pathname = usePathname();
  const cohortData = useCohortData(id);
  const [sidebarMode, setSidebarMode] = useState('actual');

  const handleModeChange = useCallback(async (mode) => {
    setSidebarMode(mode);
    await cohortData.fetchResults(mode);
  }, [cohortData]);

  const tabs = [
    {
      label: '평가 항목',
      href: `/cohort/${id}`,
      active: pathname === `/cohort/${id}` || pathname.startsWith(`/cohort/${id}/eval`),
    },
    {
      label: '학생 관리',
      href: `/cohort/${id}/students`,
      active: pathname.startsWith(`/cohort/${id}/students`),
    },
  ];

  return (
    <CohortDataContext.Provider value={cohortData}>
      <div className="border-b px-4 flex gap-1 bg-background">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab.active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-1 h-[calc(100vh-3.5rem-2.5rem)]">
        <div className="flex-1 overflow-y-auto">
          <div className="w-[80%] mx-auto">
            {children}
          </div>
        </div>
        <Sidebar
          results={cohortData.results}
          students={cohortData.students}
          onModeChange={handleModeChange}
        />
      </div>
    </CohortDataContext.Provider>
  );
}
