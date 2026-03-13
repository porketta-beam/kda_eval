'use client';

import { use, useState } from 'react';
import { useCohortDataContext } from '@/hooks/CohortDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function StudentsPage({ params }) {
  const { id: cohortId } = use(params);
  const { config, students, fetchStudents, fetchConfig } = useCohortDataContext();
  const [newName, setNewName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showDropout, setShowDropout] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // 팀 관리 state
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');

  const teams = config?.teams || [];
  const studentList = students?.students || [];
  const displayed = showDropout ? studentList : studentList.filter(s => !s.is_dropout);

  const enc = (id) => encodeURIComponent(id);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch(`/api/cohorts/${enc(cohortId)}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName('');
    await fetchStudents();
  };

  const handleBulkAdd = async () => {
    const names = bulkNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    await fetch(`/api/cohorts/${enc(cohortId)}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });
    setBulkNames('');
    setShowBulk(false);
    await fetchStudents();
  };

  const handleToggleDropout = async (studentId) => {
    await fetch(`/api/cohorts/${enc(cohortId)}/students/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'toggleDropout' }),
    });
    await fetchStudents();
  };

  const handleDelete = async (studentId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetch(`/api/cohorts/${enc(cohortId)}/students/${studentId}`, {
      method: 'DELETE',
    });
    await fetchStudents();
  };

  const handleUpdate = async (studentId) => {
    await fetch(`/api/cohorts/${enc(cohortId)}/students/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    await fetchStudents();
  };

  // ─── 팀 관리 핸들러 ──────────────────────────────
  const saveTeams = async (newTeams) => {
    const updatedConfig = { ...config, teams: newTeams };
    const res = await fetch(`/api/cohorts/${enc(cohortId)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: updatedConfig, expectedVersion: config.version }),
    });
    if (res.status === 409) {
      alert('다른 사용자가 설정을 변경했습니다. 새로고침 후 다시 시도하세요.');
      await fetchConfig();
      return;
    }
    await fetchConfig();
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    const { v4: uuidv4 } = await import('uuid');
    const newTeam = { id: uuidv4(), name: newTeamName.trim(), members: [] };
    await saveTeams([...teams, newTeam]);
    setNewTeamName('');
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('이 팀을 삭제하시겠습니까?')) return;
    await saveTeams(teams.filter(t => t.id !== teamId));
  };

  const handleAssignTeam = async (studentId, teamId) => {
    const updatedTeams = teams.map(t => ({
      ...t,
      members: t.members.filter(m => m !== studentId),
    }));
    if (teamId && teamId !== 'none') {
      const target = updatedTeams.find(t => t.id === teamId);
      if (target) target.members.push(studentId);
    }
    await saveTeams(updatedTeams);
  };

  const handleRenameTeam = async (teamId) => {
    if (!editTeamName.trim()) return;
    await saveTeams(teams.map(t =>
      t.id === teamId ? { ...t, name: editTeamName.trim() } : t
    ));
    setEditingTeamId(null);
  };

  const handleRemoveFromTeam = async (teamId, studentId) => {
    await saveTeams(teams.map(t =>
      t.id === teamId ? { ...t, members: t.members.filter(m => m !== studentId) } : t
    ));
  };

  const handleAddToTeam = async (teamId, studentId) => {
    // 다른 팀에서 제거 후 추가
    await saveTeams(teams.map(t => {
      const filtered = t.members.filter(m => m !== studentId);
      return t.id === teamId ? { ...t, members: [...filtered, studentId] } : { ...t, members: filtered };
    }));
  };

  const getStudentTeam = (studentId) => {
    return teams.find(t => t.members?.includes(studentId));
  };

  const getTeamMembers = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return [];
    return team.members.map(mid => studentList.find(s => s.id === mid)).filter(Boolean);
  };

  const unassignedStudents = studentList.filter(s =>
    !s.is_dropout && !teams.some(t => t.members?.includes(s.id))
  );

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold mb-4">학생 관리</h2>

      {/* 팀 관리 */}
      <Collapsible open={teamsOpen} onOpenChange={setTeamsOpen} className="mb-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {teamsOpen ? '▼' : '▶'} 팀 관리 ({teams.length}개 팀)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-lg p-4 mt-2 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="새 팀 이름"
              className="w-48"
              onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
            />
            <Button size="sm" onClick={handleAddTeam} disabled={!newTeamName.trim()}>추가</Button>
          </div>
          {teams.length > 0 && (
            <div className="space-y-2">
              {teams.map(team => {
                const members = getTeamMembers(team.id);
                const isExpanded = expandedTeamId === team.id;
                const isEditing = editingTeamId === team.id;
                return (
                  <div key={team.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-accent/30">
                      <button
                        className="text-xs text-muted-foreground"
                        onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editTeamName}
                            onChange={e => setEditTeamName(e.target.value)}
                            className="h-7 w-32 text-sm"
                            onKeyDown={e => e.key === 'Enter' && handleRenameTeam(team.id)}
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRenameTeam(team.id)}>✓</Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingTeamId(null)}>✗</Button>
                        </div>
                      ) : (
                        <span
                          className="font-medium text-sm cursor-pointer hover:underline"
                          onClick={() => { setEditingTeamId(team.id); setEditTeamName(team.name); }}
                        >
                          {team.name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">({members.length}명)</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTeam(team.id)}>×</Button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 py-2 space-y-2">
                        {members.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {members.map(s => (
                              <div key={s.id} className="flex items-center gap-1 bg-accent/50 rounded px-2 py-0.5 text-sm">
                                <span>{s.name}</span>
                                <button
                                  className="text-destructive hover:text-destructive/80 text-xs ml-0.5"
                                  onClick={() => handleRemoveFromTeam(team.id, s.id)}
                                >×</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">팀원이 없습니다.</p>
                        )}
                        {unassignedStudents.length > 0 && (
                          <div className="pt-1 border-t">
                            <Select onValueChange={(v) => handleAddToTeam(team.id, v)}>
                              <SelectTrigger className="h-7 w-40 text-xs">
                                <SelectValue placeholder="+ 학생 배정" />
                              </SelectTrigger>
                              <SelectContent>
                                {unassignedStudents.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center gap-2 mb-4">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="학생 이름"
          className="w-48"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={!newName.trim()}>추가</Button>
        <Button variant="outline" onClick={() => setShowBulk(!showBulk)}>일괄 추가</Button>
      </div>

      {showBulk && (
        <div className="mb-4 space-y-2">
          <textarea
            value={bulkNames}
            onChange={e => setBulkNames(e.target.value)}
            placeholder="이름을 줄바꿈으로 구분하여 입력"
            className="w-full h-32 border rounded-md p-2 text-sm"
          />
          <Button onClick={handleBulkAdd}>일괄 추가</Button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Checkbox id="show-dropout" checked={showDropout} onCheckedChange={setShowDropout} />
        <label htmlFor="show-dropout" className="text-sm">중도퇴소 인원 표시</label>
        <span className="text-sm text-muted-foreground ml-auto">
          총 {studentList.length}명 (활성 {studentList.filter(s => !s.is_dropout).length}명)
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>이름</TableHead>
            {teams.length > 0 && <TableHead className="w-32">팀</TableHead>}
            <TableHead className="w-24">중도퇴소</TableHead>
            <TableHead className="w-24">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.map((student, idx) => (
            <TableRow
              key={student.id}
              className={student.is_dropout ? 'bg-[var(--color-dropout-row)] text-[var(--color-dropout-text)]' : ''}
            >
              <TableCell>{idx + 1}</TableCell>
              <TableCell>
                {editingId === student.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 w-32"
                      onKeyDown={e => e.key === 'Enter' && handleUpdate(student.id)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleUpdate(student.id)}>✓</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>✗</Button>
                  </div>
                ) : (
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => { setEditingId(student.id); setEditName(student.name); }}
                  >
                    {student.name}
                    {student.is_dropout && <Badge variant="secondary" className="ml-2 text-xs">퇴소</Badge>}
                  </span>
                )}
              </TableCell>
              {teams.length > 0 && (
                <TableCell>
                  <Select
                    value={getStudentTeam(student.id)?.id || 'none'}
                    onValueChange={(v) => handleAssignTeam(student.id, v)}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue placeholder="팀 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">없음</SelectItem>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              )}
              <TableCell>
                <Checkbox
                  checked={student.is_dropout}
                  onCheckedChange={() => handleToggleDropout(student.id)}
                />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="text-destructive h-7"
                  onClick={() => handleDelete(student.id)}>
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
