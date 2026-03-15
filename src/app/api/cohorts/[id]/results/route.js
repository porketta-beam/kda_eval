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

    // 학생에 team_id 설정 (config.teams[].members 기반)
    const studentTeamMap = {};
    for (const team of (config.teams || [])) {
      for (const memberId of (team.members || [])) {
        studentTeamMap[memberId] = team.id;
      }
    }
    const studentsWithTeam = studentsData.students.map(s => ({
      ...s,
      team_id: studentTeamMap[s.id] ?? null,
    }));

    const overrides = scoresData.overrides || {};
    const calculator = mode === 'projected' ? calculateProjectedScores : calculateTotals;
    const results = calculator(config, scoresData.raw_scores, studentsWithTeam, overrides);

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
