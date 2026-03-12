// CSV 내보내기 서비스

/**
 * CSV 문자열 생성 유틸 — 값에 콤마/따옴표/줄바꿈이 있으면 이스케이프
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values) {
  return values.map(csvEscape).join(',');
}

/**
 * 총점 + 순위 요약 CSV
 * @param {Object} config - cohort config
 * @param {Array} students - students array
 * @param {Object} results - { categoryResults, totals }
 * @returns {string} CSV 문자열
 */
export function exportSummaryCSV(config, students, results) {
  const activeStudents = students.filter(s => !s.is_dropout);
  const rows = [];

  // 헤더
  rows.push(toCsvRow(['순위', '이름', '총점']));

  // 순위 순으로 정렬
  const sorted = activeStudents
    .map(s => ({
      name: s.name,
      total: results.totals[s.id]?.total ?? 0,
      rank: results.totals[s.id]?.rank ?? '-',
    }))
    .sort((a, b) => (a.rank === '-' ? 999 : a.rank) - (b.rank === '-' ? 999 : b.rank));

  for (const s of sorted) {
    rows.push(toCsvRow([s.rank, s.name, s.total]));
  }

  // UTF-8 BOM 추가 (Excel 한글 호환)
  return '\uFEFF' + rows.join('\n');
}

/**
 * 전체 상세 데이터 CSV (학생별 모든 카테고리 점수 + 총점 + 순위)
 * @param {Object} config - cohort config
 * @param {Array} students - students array
 * @param {Object} results - { categoryResults, totals }
 * @returns {string} CSV 문자열
 */
export function exportDetailCSV(config, students, results) {
  const activeStudents = students.filter(s => !s.is_dropout);
  const categories = (config.evaluation_categories || []).sort((a, b) => a.order - b.order);
  const rows = [];

  // 헤더: 순위, 이름, 카테고리1, 카테고리2, ..., 총점
  const header = ['순위', '이름'];
  for (const cat of categories) {
    header.push(`${cat.name} (${cat.max_score})`);
  }
  header.push('총점');
  rows.push(toCsvRow(header));

  // 학생 데이터 (순위 순)
  const sorted = activeStudents
    .map(s => {
      const totalInfo = results.totals[s.id] || {};
      return {
        id: s.id,
        name: s.name,
        total: totalInfo.total ?? 0,
        rank: totalInfo.rank ?? '-',
        breakdown: totalInfo.breakdown || {},
      };
    })
    .sort((a, b) => (a.rank === '-' ? 999 : a.rank) - (b.rank === '-' ? 999 : b.rank));

  for (const s of sorted) {
    const row = [s.rank, s.name];
    for (const cat of categories) {
      row.push(s.breakdown[cat.id]?.score ?? '');
    }
    row.push(s.total);
    rows.push(toCsvRow(row));
  }

  return '\uFEFF' + rows.join('\n');
}
