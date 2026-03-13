'use client';

import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SCORING_METHOD } from '@/lib/schema';

// 빈 문자열 허용 number 변환 (입력 중 0 삭제 가능)
const numVal = (v) => v === '' ? '' : Number(v);
// 저장 시 빈 문자열 → 0 변환
const toNum = (v) => (v === '' || v == null) ? 0 : Number(v);

export default function InlineSettings({ category, onSave }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState({ ...category });

  const handleChange = (key, value) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleConfigChange = (key, value) => {
    setLocal(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const handleSave = () => {
    // 저장 시 빈 문자열을 숫자로 변환
    const data = {
      ...local,
      max_score: toNum(local.max_score),
      config: Object.fromEntries(
        Object.entries(local.config || {}).map(([k, v]) =>
          [k, typeof v === 'string' && v !== '' && !isNaN(v) ? Number(v) : v]
        ),
      ),
    };
    onSave?.(data);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 mb-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {open ? '▼' : '▶'} ⚙ 설정
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border rounded-lg p-4 mb-4 space-y-3">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">만점</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={local.max_score}
              onChange={e => handleChange('max_score', numVal(e.target.value))}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-sm">방식</Label>
            <Select value={local.scoring_method} onValueChange={v => handleChange('scoring_method', v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SCORING_METHOD).map(([key, val]) => (
                  <SelectItem key={val} value={val}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-bonus"
                checked={local.is_bonus}
                onCheckedChange={v => handleChange('is_bonus', v)}
              />
              <Label htmlFor="is-bonus" className="text-sm">가산점</Label>
            </div>
          </div>
        </div>

        {/* 방식별 파라미터 */}
        <MethodConfig method={local.scoring_method} config={local.config} onChange={handleConfigChange} />

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave}>설정 저장</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MethodConfig({ method, config, onChange }) {
  switch (method) {
    case SCORING_METHOD.WEIGHTED_AVERAGE:
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">multiplier</Label>
            <Input type="text" inputMode="numeric" value={config.multiplier ?? 1} onChange={e => onChange('multiplier', numVal(e.target.value))} className="h-8" />
          </div>
          <div className="flex items-end gap-2">
            <Checkbox checked={config.exclude_empty ?? true} onCheckedChange={v => onChange('exclude_empty', v)} />
            <Label className="text-sm">빈 값 제외</Label>
          </div>
        </div>
      );

    case SCORING_METHOD.SUM_DIVIDE:
      return (
        <div>
          <Label className="text-sm">divisor</Label>
          <Input type="text" inputMode="numeric" value={config.divisor ?? 1} onChange={e => onChange('divisor', numVal(e.target.value))} className="h-8 w-32" />
        </div>
      );

    case SCORING_METHOD.RANK_DIFFERENTIAL:
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">1위 점수</Label>
            <Input type="text" inputMode="numeric" value={config.top_score ?? 0} onChange={e => onChange('top_score', numVal(e.target.value))} className="h-8" />
          </div>
          <div>
            <Label className="text-sm">간격</Label>
            <Input type="text" inputMode="numeric" value={config.interval ?? 5} onChange={e => onChange('interval', numVal(e.target.value))} className="h-8" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={config.has_floor ?? false} onCheckedChange={v => onChange('has_floor', v)} />
            <Label className="text-sm">하한 적용</Label>
            {config.has_floor && (
              <Input type="text" inputMode="numeric" value={config.floor_value ?? 0} onChange={e => onChange('floor_value', numVal(e.target.value))} className="h-8 w-20" />
            )}
          </div>
          <div>
            <Label className="text-sm">범위</Label>
            <Select value={config.scope ?? 'all'} onValueChange={v => onChange('scope', v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="team">팀별</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case SCORING_METHOD.FORMULA:
      return (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">공식 타입</Label>
            <Select value={config.formula_type ?? 'attendance_deduction'} onValueChange={v => onChange('formula_type', v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance_deduction">출석률 차감법</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">기준</Label>
            <Input type="text" inputMode="numeric" value={config.params?.threshold ?? 90} onChange={e => onChange('params', { ...config.params, threshold: numVal(e.target.value) })} className="h-8" />
          </div>
          <div>
            <Label className="text-sm">차감한도</Label>
            <Input type="text" inputMode="numeric" value={config.params?.cap ?? 10} onChange={e => onChange('params', { ...config.params, cap: numVal(e.target.value) })} className="h-8" />
          </div>
        </div>
      );

    case SCORING_METHOD.COMPOSITE:
      return (
        <div>
          <Label className="text-sm">최종 공식</Label>
          <Input value={config.final_formula ?? ''} onChange={e => onChange('final_formula', e.target.value)} className="h-8" placeholder="(sub1 + sub2) * 15 / 100" />
        </div>
      );

    default:
      return null;
  }
}
