import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { cloneCohort, listCohorts } from '@/lib/services/cohort-service';

/** POST /api/cohorts/[id]/clone — 기수 복제 (ID 자동 생성) */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const { targetName, includeStudents, includeTeams, includeScores } = await request.json();
    if (!targetName) {
      return NextResponse.json({ error: '기수 이름을 입력해 주세요' }, { status: 400 });
    }

    // 이름 중복 체크
    const existing = await listCohorts();
    if (existing.some(c => c.name.trim().toLowerCase() === targetName.trim().toLowerCase())) {
      return NextResponse.json({ error: '같은 이름의 기수가 이미 존재합니다' }, { status: 409 });
    }

    const targetId = uuidv4();
    const config = await cloneCohort(id, targetId, targetName, { includeStudents, includeTeams, includeScores });
    return NextResponse.json(config, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
