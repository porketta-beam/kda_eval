import { NextResponse } from 'next/server';
import { addSubCategory } from '@/lib/services/config-service';

/** POST /api/cohorts/[id]/config/categories/[categoryId]/subcategories — 하위 카테고리 추가 */
export async function POST(request, { params }) {
  const { id, categoryId } = await params;
  try {
    const { name, scoring_method, max_score, ...options } = await request.json();
    if (!name) {
      return NextResponse.json({ error: '하위 항목 이름을 입력해 주세요' }, { status: 400 });
    }

    const result = await addSubCategory(id, categoryId, {
      name,
      scoring_method: scoring_method || 'weighted_average',
      max_score: max_score || 0,
      ...options,
    });

    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'config', cohortId: id });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
