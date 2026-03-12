import { NextResponse } from 'next/server';
import { bulkUpdateScores } from '@/lib/services/score-service';

/** PUT /api/cohorts/[id]/scores/[categoryId] — 카테고리별 점수 일괄 업데이트 */
export async function PUT(request, { params }) {
  const { id, categoryId } = await params;
  try {
    const { scores, expectedVersion } = await request.json();
    const saved = await bulkUpdateScores(id, categoryId, scores, expectedVersion);

    global.__io?.to(`cohort:${id}`).emit('data-changed', {
      type: 'scores',
      cohortId: id,
      categoryId,
    });

    return NextResponse.json(saved);
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
