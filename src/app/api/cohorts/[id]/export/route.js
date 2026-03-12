import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/services/config-service';
import { getStudents } from '@/lib/services/student-service';
import { getScores } from '@/lib/services/score-service';
import { calculateTotals } from '@/lib/scoring-engine/index';
import { exportSummaryCSV, exportDetailCSV } from '@/lib/services/export-service';

/** GET /api/cohorts/[id]/export?type=summary|detail */
export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'summary';

  try {
    const [config, studentsData, scoresData] = await Promise.all([
      getConfig(id),
      getStudents(id),
      getScores(id),
    ]);

    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const results = calculateTotals(config, scoresData.raw_scores, studentsData.students);

    const csv = type === 'detail'
      ? exportDetailCSV(config, studentsData.students, results)
      : exportSummaryCSV(config, studentsData.students, results);

    const filename = `${config.name}_${type === 'detail' ? '상세' : '요약'}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
