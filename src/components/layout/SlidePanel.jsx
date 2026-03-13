'use client';

import { useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import ScoreTable from '@/components/eval/ScoreTable';
import InlineSettings from '@/components/eval/InlineSettings';

export default function SlidePanel({
  category,
  cohortId,
  students,
  scores,
  panelStack,
  onBack,
  onDrillDown,
  onFullPage,
  onClose,
  onScoreChange,
  onBulkScoreChange,
  showDropout,
}) {
  if (!category) return null;

  const breadcrumbItems = [...panelStack, category];

  const handleBreadcrumbClick = (index) => {
    // Navigate back to that level
    const stepsBack = breadcrumbItems.length - 1 - index;
    for (let i = 0; i < stepsBack; i++) {
      onBack();
    }
  };

  return (
    <Sheet open={!!category} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {panelStack.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onBack}>◀</Button>
              )}
              <SheetTitle className="text-base">{category.name}</SheetTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFullPage(category)}
            >
              ⛶ 전체
            </Button>
          </div>

          {/* Breadcrumb */}
          {breadcrumbItems.length > 1 && (
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbItems.map((item, idx) => (
                  <BreadcrumbItem key={item.id}>
                    {idx < breadcrumbItems.length - 1 ? (
                      <>
                        <BreadcrumbLink
                          className="cursor-pointer"
                          onClick={() => handleBreadcrumbClick(idx)}
                        >
                          {item.name}
                        </BreadcrumbLink>
                        <BreadcrumbSeparator />
                      </>
                    ) : (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <InlineSettings
            category={category}
            onSave={async (updated) => {
              const enc = encodeURIComponent;
              await fetch(`/api/cohorts/${enc(cohortId)}/config/categories/${enc(category.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
              });
            }}
          />

          <ScoreTable
            category={category}
            students={students}
            scores={scores}
            calculatedResults={scores?.calculated || {}}
            showDropout={showDropout}
            onScoreChange={(studentId, fieldId, value) => {
              onScoreChange?.(studentId, fieldId, value);
            }}
            onBulkScoreChange={onBulkScoreChange}
            onSubCategoryClick={onDrillDown}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
