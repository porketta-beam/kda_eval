'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { INPUT_FIELD_TYPE, V1_SCORING_METHOD, V1_METHOD_LABELS } from '@/lib/schema';

/**
 * 통합 필드 관리자 — 입력 필드 + 하위 항목 두 섹션을 항상 동시 표시 (per D-07)
 * @param {Object} props
 * @param {Object} props.category - 현재 카테고리
 * @param {Function} props.onSave - 카테고리 업데이트 콜백
 * @param {string} props.cohortId - 코호트 ID
 */
export default function FieldManager({ category, onSave, cohortId }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(category.input_fields || []);

  // ─── 입력 필드 핸들러 ─────────────────────────────────────

  const handleAddField = () => {
    const newField = {
      id: uuidv4(),
      name: `필드${fields.length + 1}`,
      type: INPUT_FIELD_TYPE.NUMBER,
      per: 'student',
      min: 0,
      max: 100,
    };
    setFields([...fields, newField]);
  };

  const handleDeleteField = (fieldId) => {
    if (!confirm('이 입력필드를 삭제하시겠습니까? (기존 점수 데이터는 보존됩니다)')) return;
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const handleMoveField = (index, direction) => {
    const newFields = [...fields];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleFieldChange = (fieldId, key, value) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, [key]: value } : f
    ));
  };

  const handleSaveFields = () => {
    onSave?.({ ...category, input_fields: fields });
  };

  // ─── 하위 항목 핸들러 ─────────────────────────────────────

  const categoryId = category.id;
  const handleAddSubCategory = useCallback(async () => {
    if (!cohortId || !categoryId) return;
    try {
      const enc = encodeURIComponent;
      const res = await fetch(
        `/api/cohorts/${enc(cohortId)}/config/categories/${enc(categoryId)}/subcategories`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '새 항목',
            scoring_method: V1_SCORING_METHOD.AVERAGE,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '하위 항목 추가 실패');
      }
      // 데이터 갱신은 WebSocket data-changed 이벤트로 자동 처리됨
    } catch (err) {
      alert('하위 항목 추가 중 오류: ' + err.message);
    }
  }, [cohortId, categoryId]);

  const handleDeleteSubCategory = useCallback(async (subCatId) => {
    if (!confirm('이 하위 항목을 삭제하시겠습니까? 하위 점수 데이터는 보존됩니다.')) return;
    if (!cohortId) return;
    try {
      const enc = encodeURIComponent;
      const res = await fetch(
        `/api/cohorts/${enc(cohortId)}/config/categories/${enc(subCatId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '하위 항목 삭제 실패');
      }
    } catch (err) {
      alert('하위 항목 삭제 중 오류: ' + err.message);
    }
  }, [cohortId]);

  const subCategories = category.sub_categories || [];
  const hasBothSections = fields.length > 0 && subCategories.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 mt-4 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {open ? '▼' : '▶'} 필드 관리
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border rounded-lg p-4 mb-4 space-y-3">
        {/* ─── 섹션 1: 입력 필드 ───────────────────────────── */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-2 block">입력 필드</Label>
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">입력필드가 없습니다.</p>
          )}
          {fields.map((field, idx) => (
            <div key={field.id} className="flex items-center gap-2 p-2 rounded border mb-1">
              <Input
                value={field.name}
                onChange={e => handleFieldChange(field.id, 'name', e.target.value)}
                className="h-7 w-32 text-sm"
                placeholder="필드명"
              />
              <Select
                value={field.type}
                onValueChange={v => handleFieldChange(field.id, 'type', v)}
              >
                <SelectTrigger className="h-7 w-24 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INPUT_FIELD_TYPE.NUMBER}>숫자</SelectItem>
                  <SelectItem value={INPUT_FIELD_TYPE.TEXT}>텍스트</SelectItem>
                  <SelectItem value={INPUT_FIELD_TYPE.BOOLEAN}>체크</SelectItem>
                </SelectContent>
              </Select>
              {field.type === INPUT_FIELD_TYPE.NUMBER && (
                <>
                  <Label className="text-xs text-muted-foreground ml-1">min</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={field.min ?? ''}
                    onChange={e => handleFieldChange(field.id, 'min', e.target.value === '' ? undefined : Number(e.target.value))}
                    className="h-7 w-16 text-sm"
                  />
                  <Label className="text-xs text-muted-foreground">max</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={field.max ?? ''}
                    onChange={e => handleFieldChange(field.id, 'max', e.target.value === '' ? undefined : Number(e.target.value))}
                    className="h-7 w-16 text-sm"
                  />
                </>
              )}
              <Label className="text-xs text-muted-foreground ml-1">가중치</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={field.weight ?? 1}
                onChange={e => handleFieldChange(field.id, 'weight', e.target.value === '' ? 1 : Number(e.target.value))}
                className="h-7 w-14 text-sm"
              />
              <div className="flex items-center gap-0.5 ml-auto">
                {idx > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleMoveField(idx, -1)}>
                    ↑
                  </Button>
                )}
                {idx < fields.length - 1 && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleMoveField(idx, 1)}>
                    ↓
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteField(field.id)}>
                  ×
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleAddField}>
              + 입력 필드 추가
            </Button>
            <Button size="sm" onClick={handleSaveFields}>
              저장
            </Button>
          </div>
        </div>

        {/* 구분선 — 두 섹션 모두 항목이 있을 때만 */}
        {hasBothSections && <Separator />}

        {/* ─── 섹션 2: 하위 항목 ───────────────────────────── */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-2 block">하위 항목</Label>
          {subCategories.length === 0 && (
            <p className="text-sm text-muted-foreground">하위 항목이 없습니다.</p>
          )}
          {subCategories.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 p-2 rounded border mb-1">
              <span className="text-sm flex-1 min-w-0 truncate">{sub.name}</span>
              <span className="text-xs text-muted-foreground">
                {V1_METHOD_LABELS[sub.scoring_method] || sub.scoring_method}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleDeleteSubCategory(sub.id)}
              >
                ×
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={handleAddSubCategory}>
            + 하위 항목 추가
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
