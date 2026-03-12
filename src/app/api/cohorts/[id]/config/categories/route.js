import { NextResponse } from 'next/server';
import { addCategory } from '@/lib/services/config-service';

/** POST /api/cohorts/[id]/config/categories — 카테고리 추가 */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const { name, scoring_method, max_score, ...options } = await request.json();
    if (!name || !scoring_method) {
      return NextResponse.json({ error: 'name and scoring_method required' }, { status: 400 });
    }
    const result = await addCategory(id, name, scoring_method, max_score || 0, options);

    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'config', cohortId: id });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
