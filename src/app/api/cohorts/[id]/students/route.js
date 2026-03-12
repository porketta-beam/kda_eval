import { NextResponse } from 'next/server';
import { getStudents, addStudent, bulkAddStudents } from '@/lib/services/student-service';

/** GET /api/cohorts/[id]/students */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const data = await getStudents(id);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/cohorts/[id]/students — 학생 추가 (단일 또는 일괄) */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();

    // 일괄 추가
    if (body.names && Array.isArray(body.names)) {
      const result = await bulkAddStudents(id, body.names, body.options);
      global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'students', cohortId: id });
      return NextResponse.json(result, { status: 201 });
    }

    // 단일 추가
    if (!body.name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    const result = await addStudent(id, body.name, body);
    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'students', cohortId: id });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
