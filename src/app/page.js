'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function HomePage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [cloneMode, setCloneMode] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [includeTeams, setIncludeTeams] = useState(true);
  const [includeStudents, setIncludeStudents] = useState(false);
  const [includeScores, setIncludeScores] = useState(false);

  const fetchCohorts = () => {
    fetch('/api/cohorts')
      .then(r => r.json())
      .then(data => { setCohorts(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(fetchCohorts, []);

  const handleCreate = async () => {
    if (!newName) return;
    try {
      let res;
      if (cloneMode && sourceId) {
        res = await fetch(`/api/cohorts/${encodeURIComponent(sourceId)}/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetName: newName, includeTeams, includeStudents, includeScores }),
        });
      } else {
        res = await fetch('/api/cohorts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || '생성 실패');
        return;
      }
      setDialogOpen(false);
      setNewName(''); setCloneMode(false);
      fetchCohorts();
    } catch (err) {
      alert('생성 실패: ' + err.message);
    }
  };

  const handleDelete = async (cohortId) => {
    if (!confirm(`"${cohortId}" 기수를 삭제하시겠습니까?`)) return;
    await fetch(`/api/cohorts/${encodeURIComponent(cohortId)}`, { method: 'DELETE' });
    fetchCohorts();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">기수 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ 새 기수 만들기</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 기수 만들기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox id="clone-mode" checked={cloneMode} onCheckedChange={setCloneMode} />
                <Label htmlFor="clone-mode">기존 기수 복제</Label>
              </div>
              {cloneMode && (
                <>
                  <div>
                    <Label>원본 기수</Label>
                    <Select value={sourceId} onValueChange={setSourceId}>
                      <SelectTrigger><SelectValue placeholder="기수 선택" /></SelectTrigger>
                      <SelectContent>
                        {cohorts.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 pl-4">
                    <div className="flex items-center gap-2">
                      <Checkbox checked disabled /><span className="text-sm">평가 체계 (항상 복제)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="inc-teams" checked={includeTeams} onCheckedChange={setIncludeTeams} />
                      <Label htmlFor="inc-teams" className="text-sm">팀 구조</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="inc-students" checked={includeStudents} onCheckedChange={setIncludeStudents} />
                      <Label htmlFor="inc-students" className="text-sm">학생 명단</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="inc-scores" checked={includeScores} onCheckedChange={setIncludeScores} />
                      <Label htmlFor="inc-scores" className="text-sm">점수 데이터</Label>
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="new-name">기수 이름</Label>
                <Input id="new-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: KDA 3기" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button onClick={handleCreate} disabled={!newName}>생성</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">로딩 중...</p>
      ) : cohorts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            등록된 기수가 없습니다. 새 기수를 만들어 주세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map(cohort => (
            <Card
              key={cohort.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/cohort/${encodeURIComponent(cohort.id)}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{cohort.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">ID: {cohort.id}</p>
                <p className="text-sm text-muted-foreground">
                  생성일: {new Date(cohort.created_at).toLocaleDateString('ko-KR')}
                </p>
                <Button
                  variant="ghost" size="sm"
                  className="mt-2 text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete(cohort.id); }}
                >
                  삭제
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
