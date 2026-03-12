import { NextResponse } from 'next/server';
import { getScores } from '@/lib/services/score-service';
import { getConfig } from '@/lib/services/config-service';
import { getStudents } from '@/lib/services/student-service';
import { calculateAllCategories } from '@/lib/scoring-engine/index';

/** GET /api/cohorts/[id]/scores?calculated=true */
export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const calculated = searchParams.get('calculated') === 'true';

  try {
    const scores = await getScores(id);

    if (calculated) {
      const config = await getConfig(id);
      const studentsData = await getStudents(id);
      const results = calculateAllCategories(config, scores.raw_scores, studentsData.students);
      return NextResponse.json({ ...scores, calculated: results });
    }

    return NextResponse.json(scores);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
