import { NextResponse } from 'next/server';
import { updateCategory, deleteCategory } from '@/lib/services/config-service';

/** PUT /api/cohorts/[id]/config/categories/[categoryId] */
export async function PUT(request, { params }) {
  const { id, categoryId } = await params;
  try {
    const updates = await request.json();
    const config = await updateCategory(id, categoryId, updates);

    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'config', cohortId: id });

    return NextResponse.json(config);
  } catch (err) {
    if (err.name === 'ConflictError') {
      return NextResponse.json({ error: 'Conflict', current: err.currentData }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/cohorts/[id]/config/categories/[categoryId] */
export async function DELETE(request, { params }) {
  const { id, categoryId } = await params;
  try {
    const config = await deleteCategory(id, categoryId);

    global.__io?.to(`cohort:${id}`).emit('data-changed', { type: 'config', cohortId: id });

    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
