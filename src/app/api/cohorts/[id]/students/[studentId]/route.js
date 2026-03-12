import { NextResponse } from 'next/server';
import { updateStudent, deleteStudent, toggleDropout } from '@/lib/services/student-service';

/** PUT /api/cohorts/[id]/students/[studentId] */
export async function PUT(request, { params }) {
  const { id, studentId } = await params;
  try {
    const updates = await request.json();

    // 중도퇴소 토글 전용
    if (updates._action === 'toggleDropout') {
      const data = await toggleDropout(id, studentId);
      global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'students', cohortId: id });
      return NextResponse.json(data);
    }

    const data = await updateStudent(id, studentId, updates);
    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'students', cohortId: id });
    return NextResponse.json(data);
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/cohorts/[id]/students/[studentId] */
export async function DELETE(request, { params }) {
  const { id, studentId } = await params;
  try {
    const data = await deleteStudent(id, studentId);
    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'students', cohortId: id });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
