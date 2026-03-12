import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { listCohorts, createCohort } from '@/lib/services/cohort-service';

/** GET /api/cohorts — 기수 목록 */
export async function GET() {
  try {
    const cohorts = await listCohorts();
    return NextResponse.json(cohorts);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/cohorts — 기수 생성 (ID 자동 생성) */
export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: '기수 이름을 입력해 주세요' }, { status: 400 });
    }

    // 이름 중복 체크
    const existing = await listCohorts();
    if (existing.some(c => c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ error: '같은 이름의 기수가 이미 존재합니다' }, { status: 409 });
    }

    const id = uuidv4();
    const config = await createCohort(id, name);
    return NextResponse.json(config, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
