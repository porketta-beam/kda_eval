import { NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/lib/services/config-service';

/** GET /api/cohorts/[id]/config */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const config = await getConfig(id);
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/cohorts/[id]/config — 전체 설정 업데이트 */
export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const { config, expectedVersion } = await request.json();
    const saved = await updateConfig(id, config, expectedVersion);
    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'config', cohortId: id });
    return NextResponse.json(saved);
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
