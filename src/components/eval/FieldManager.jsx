'use client';

import { useState } from 'react';
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
import { SCORING_METHOD, INPUT_FIELD_TYPE } from '@/lib/schema';

export default function FieldManager({ category, onSave }) {
  const [open, setOpen] = useState(false);
  const isComposite = category.scoring_method === SCORING_METHOD.COMPOSITE;

  if (isComposite) {
    return (
      <CompositeManager
        category={category}
        onSave={onSave}
        open={open}
        setOpen={setOpen}
      />
    );
  }

  return (
    <LeafManager
      category={category}
      onSave={onSave}
      open={open}
      setOpen={setOpen}
    />
  );
}

// ─── Leaf: input_fields 관리 ────────────────────────────────

function LeafManager({ category, onSave, open, setOpen }) {
  const [fields, setFields] = useState(category.input_fields || []);

  const handleAdd = () => {
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

  const handleDelete = (fieldId) => {
    if (!confirm('이 입력필드를 삭제하시겠습니까? (기존 점수 데이터는 보존됩니다)')) return;
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const handleMove = (index, direction) => {
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

  const handleSave = () => {
    onSave?.({ ...category, input_fields: fields });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 mt-4 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {open ? '▼' : '▶'} 입력필드 관리
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border rounded-lg p-4 mb-4 space-y-3">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">입력필드가 없습니다.</p>
        )}
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-center gap-2 p-2 rounded border">
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
            <div className="flex items-center gap-0.5 ml-auto">
              {idx > 0 && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleMove(idx, -1)}>
                  ↑
                </Button>
              )}
              {idx < fields.length - 1 && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleMove(idx, 1)}>
                  ↓
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(field.id)}>
                ×
              </Button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd}>
            + 필드 추가
          </Button>
          <Button size="sm" onClick={handleSave}>
            저장
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Composite: sub_categories 관리 ─────────────────────────

function CompositeManager({ category, onSave, open, setOpen }) {
  const [subs, setSubs] = useState(category.sub_categories || []);

  const handleAdd = () => {
    const newSub = {
      id: uuidv4(),
      name: `하위항목${subs.length + 1}`,
      order: subs.length + 1,
      max_score: 10,
      is_bonus: false,
      scoring_method: SCORING_METHOD.USER_INPUT,
      config: {},
      input_fields: [],
    };
    setSubs([...subs, newSub]);
  };

  const handleDelete = (subId) => {
    if (!confirm('이 하위항목을 삭제하시겠습니까? (기존 점수 데이터는 보존됩니다)')) return;
    setSubs(subs.filter(s => s.id !== subId));
  };

  const handleMove = (index, direction) => {
    const newSubs = [...subs];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSubs.length) return;
    [newSubs[index], newSubs[targetIndex]] = [newSubs[targetIndex], newSubs[index]];
    // update order
    newSubs.forEach((s, i) => { s.order = i + 1; });
    setSubs(newSubs);
  };

  const handleSubChange = (subId, key, value) => {
    setSubs(subs.map(s =>
      s.id === subId ? { ...s, [key]: value } : s
    ));
  };

  const handleSave = () => {
    onSave?.({ ...category, sub_categories: subs });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 mt-4 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {open ? '▼' : '▶'} 하위항목 관리
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border rounded-lg p-4 mb-4 space-y-3">
        {subs.length === 0 && (
          <p className="text-sm text-muted-foreground">하위항목이 없습니다.</p>
        )}
        {subs.map((sub, idx) => (
          <div key={sub.id} className="flex items-center gap-2 p-2 rounded border">
            <Input
              value={sub.name}
              onChange={e => handleSubChange(sub.id, 'name', e.target.value)}
              className="h-7 w-40 text-sm"
              placeholder="항목명"
            />
            <Label className="text-xs text-muted-foreground ml-1">만점</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={sub.max_score}
              onChange={e => handleSubChange(sub.id, 'max_score', e.target.value === '' ? '' : Number(e.target.value) || 0)}
              className="h-7 w-16 text-sm"
            />
            <Select
              value={sub.scoring_method}
              onValueChange={v => handleSubChange(sub.id, 'scoring_method', v)}
            >
              <SelectTrigger className="h-7 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCORING_METHOD).map(([key, val]) => (
                  <SelectItem key={val} value={val}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 ml-auto">
              {idx > 0 && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleMove(idx, -1)}>
                  ↑
                </Button>
              )}
              {idx < subs.length - 1 && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => handleMove(idx, 1)}>
                  ↓
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(sub.id)}>
                ×
              </Button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd}>
            + 하위항목 추가
          </Button>
          <Button size="sm" onClick={handleSave}>
            저장
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
