'use client';

import { useMemo } from 'react';
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
import { SCORING_METHOD } from '@/lib/schema';
import { buildTableColumns, buildCellData, buildResultColumns } from '@/lib/table-helpers';
import DataTable from '@/components/eval/DataTable';
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
    const stepsBack = breadcrumbItems.length - 1 - index;
    for (let i = 0; i < stepsBack; i++) {
      onBack();
    }
  };

  const inputFields = category.input_fields || [];
  const subCategories = category.sub_categories || [];

  const tableColumns = useMemo(
    () => buildTableColumns(inputFields, subCategories),
    [inputFields, subCategories]
  );

  const cellData = useMemo(() => {
    const rawScores = scores?.raw_scores?.[category.id] || {};
    const calcResults = scores?.calculated?.[category.id] || {};
    return buildCellData(rawScores, calcResults, students, subCategories);
  }, [scores, category.id, students, subCategories]);

  const resultColumns = useMemo(() => {
    const calcResults = scores?.calculated?.[category.id] || {};
    return buildResultColumns(category, calcResults);
  }, [scores, category]);

  const handleColumnClick = (col) => {
    const subCat = subCategories.find(s => s.id === col.id);
    if (subCat) onDrillDown?.(subCat);
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

          <DataTable
            columns={tableColumns}
            students={students}
            cellData={cellData}
            resultColumns={resultColumns}
            onCellChange={onScoreChange}
            onBulkCellChange={onBulkScoreChange}
            onColumnClick={handleColumnClick}
            showDropout={showDropout}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
