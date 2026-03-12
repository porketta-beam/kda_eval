import { NextResponse } from 'next/server';
import { getScores } from '@/lib/services/score-service';
import { getConfig } from '@/lib/services/config-service';
import { getStudents } from '@/lib/services/student-service';
import { calculateTotals, calculateProjectedScores } from '@/lib/scoring-engine/index';

/** GET /api/cohorts/[id]/results?mode=projected */
export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');

  try {
    const [config, studentsData, scoresData] = await Promise.all([
      getConfig(id),
      getStudents(id),
      getScores(id),
    ]);

    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const calculator = mode === 'projected' ? calculateProjectedScores : calculateTotals;
    const results = calculator(config, scoresData.raw_scores, studentsData.students);

    return NextResponse.json({
      config,
      students: studentsData.students,
      scores: scoresData,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
