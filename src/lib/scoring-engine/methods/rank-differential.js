/**
 * 순위 차등배점
 * 가중합 → 순위 → top_score - (rank-1) * interval, floor 적용
 */
export function calculate(category, rawScores, students, teams = []) {
  const {
    scope = 'all',
    top_score,
    interval,
    has_floor = false,
    floor_value = 0,
    rank_source = 'weighted_sum',
    weights = {},
  } = category.config;

  const fieldIds = category.input_fields.map(f => f.id);
  const results = {};

  // Step 1: 각 학생의 가중합 또는 직접값 계산
  const studentValues = {};
  for (const student of students) {
    const scores = rawScores[student.id] || {};

    if (rank_source === 'weighted_sum') {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const fid of fieldIds) {
        const w = weights[fid] || 1;
        const v = Number(scores[fid]) || 0;
        weightedSum += v * w;
        totalWeight += w;
      }
      studentValues[student.id] = totalWeight > 0 ? weightedSum / totalWeight : 0;
    } else {
      // direct: 첫 번째 필드 값 사용
      studentValues[student.id] = Number(scores[fieldIds[0]]) || 0;
    }
  }

  // Step 2: 순위 산정 (scope에 따라 그룹화)
  if (scope === 'team') {
    // 팀별로 순위 산정
    const teamGroups = {};
    for (const student of students) {
      const teamId = student.team_id || '__no_team';
      if (!teamGroups[teamId]) teamGroups[teamId] = [];
      teamGroups[teamId].push(student);
    }

    for (const group of Object.values(teamGroups)) {
      assignRanksAndScores(group, studentValues, results, top_score, interval, has_floor, floor_value);
    }
  } else {
    // 전체 순위
    assignRanksAndScores(students, studentValues, results, top_score, interval, has_floor, floor_value);
  }

  return results;
}

function assignRanksAndScores(group, studentValues, results, topScore, interval, hasFloor, floorValue) {
  // 내림차순 정렬
  const sorted = [...group].sort((a, b) => (studentValues[b.id] || 0) - (studentValues[a.id] || 0));

  // 동점자 처리: 같은 값이면 같은 순위
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && studentValues[sorted[i].id] !== studentValues[sorted[i - 1].id]) {
      currentRank = i + 1;
    }

    let score = topScore - (currentRank - 1) * interval;
    if (hasFloor && score < floorValue) {
      score = floorValue;
    }

    results[sorted[i].id] = {
      raw: studentValues[sorted[i].id],
      calculated: score,
      rank: currentRank,
    };
  }
}
