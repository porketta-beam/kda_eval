import { NextResponse } from 'next/server';
import { getCohort, deleteCohort } from '@/lib/services/cohort-service';

/** GET /api/cohorts/[id] — 기수 상세 */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const config = await getCohort(id);
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/cohorts/[id] — 기수 삭제 */
export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    await deleteCohort(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
