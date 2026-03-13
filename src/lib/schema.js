// ============================================================
// KDA 평가 시스템 — 전체 데이터 구조 정의
// 이 파일 하나로 모든 설정·데이터 구조를 파악할 수 있습니다.
// ============================================================

import { v4 as uuidv4 } from 'uuid';

// ─── 상수 ────────────────────────────────────────────────────

/** 평가 방식 열거 */
export const SCORING_METHOD = {
  WEIGHTED_AVERAGE: 'weighted_average',
  SUM_DIVIDE: 'sum_divide',
  RANK_DIFFERENTIAL: 'rank_differential',
  FORMULA: 'formula',
  BOOLEAN: 'boolean',
  BOOLEAN_WITH_DEDUCTION: 'boolean_with_deduction',
  USER_INPUT: 'user_input',
  COMPOSITE: 'composite',
};

/** 평가 방식 한글 라벨 */
export const METHOD_LABELS = {
  [SCORING_METHOD.WEIGHTED_AVERAGE]: '가중평균',
  [SCORING_METHOD.SUM_DIVIDE]: '합산',
  [SCORING_METHOD.RANK_DIFFERENTIAL]: '순위',
  [SCORING_METHOD.FORMULA]: '공식',
  [SCORING_METHOD.BOOLEAN]: 'Boolean',
  [SCORING_METHOD.BOOLEAN_WITH_DEDUCTION]: '차감법',
  [SCORING_METHOD.USER_INPUT]: '수동입력',
  [SCORING_METHOD.COMPOSITE]: '복합',
};

export const INPUT_FIELD_TYPE = {
  NUMBER: 'number',
  TEXT: 'text',
  BOOLEAN: 'boolean',
  SELECT: 'select',
};

export const INPUT_SCOPE = {
  STUDENT: 'student',
  TEAM: 'team',
};

// ─── 기수 설정 (config.json) ─────────────────────────────────

/**
 * @typedef {Object} CohortConfig
 * @property {string} id              - 기수 식별자 ("2기")
 * @property {string} name            - 표시 이름 ("KDA 2기")
 * @property {string} created_at
 * @property {string|null} cloned_from - 복제 원본 기수 ID
 * @property {number} version         - 낙관적 잠금용
 * @property {Team[]} teams
 * @property {EvaluationCategory[]} evaluation_categories
 */

/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name            - "보험팀", "1팀-KFC" 등
 * @property {string[]} members       - student_id 배열
 */

/**
 * @typedef {Object} EvaluationCategory
 * @property {string} id
 * @property {string} name            - "출석률", "1차 프로젝트" 등
 * @property {number} order           - 표시 순서
 * @property {number} max_score       - 만점
 * @property {boolean} is_bonus       - 가산점 여부
 * @property {string} scoring_method  - SCORING_METHOD 값
 * @property {Object} config          - 방식별 세부 설정
 * @property {InputField[]} input_fields - 입력 필드 정의
 * @property {number} [weight]        - 가중치 (하위항목으로 사용 시, 기본 1)
 * @property {EvaluationCategory[]} [sub_categories] - 하위 항목
 */

/**
 * @typedef {Object} WeightedAverageConfig
 * @property {number} multiplier      - 예: 2 (수업참여도: AVERAGE×2)
 * @property {boolean} exclude_empty  - 빈 값 제외 여부
 */

/**
 * @typedef {Object} SumDivideConfig
 * @property {number} divisor         - 예: 10 (협업및태도: SUM/10)
 */

/**
 * @typedef {Object} RankDifferentialConfig
 * @property {'team'|'all'} scope     - 팀내 순위 vs 전체 순위
 * @property {number} top_score       - 1위 점수
 * @property {number} interval        - 점수 간격
 * @property {boolean} has_floor      - 하한 적용 여부
 * @property {number} [floor_value]   - 하한값
 * @property {'weighted_sum'|'direct'} rank_source - 순위 산출 방식
 * @property {Object<string, number>} [weights] - 가중합 가중치 (field_id → weight)
 */

/**
 * @typedef {Object} FormulaConfig
 * @property {string} formula_type    - "attendance_deduction" 등
 * @property {Object<string, number>} params - { base: 20, threshold: 90, cap: 10 }
 */

/**
 * @typedef {Object} BooleanConfig
 * @property {number} true_score      - 충족 시 점수
 * @property {number} false_score     - 미충족 시 점수
 */

/**
 * @typedef {Object} BooleanWithDeductionConfig
 * @property {number} base_score      - 기본 점수 (2)
 * @property {DeductionRule[]} deduction_rules
 */

/**
 * @typedef {Object} DeductionRule
 * @property {string} field_id        - "absence_official"
 * @property {number} per_count       - 몇 개당 차감 (결석: 1, 지각: 3)
 * @property {number} deduction       - 차감값 (0.1)
 */

/**
 * @typedef {Object} CompositeConfig
 * @property {string} final_formula   - "(sub1 + sub2) * 15 / 100"
 */

/**
 * @typedef {Object} InputField
 * @property {string} id
 * @property {string} name
 * @property {string} type            - INPUT_FIELD_TYPE 값
 * @property {string} per             - INPUT_SCOPE 값
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [weight]        - 가중치 (기본 1)
 * @property {Array<{label: string, value: *}>} [options]
 */

// ─── 학생 데이터 (students.json) ─────────────────────────────

/**
 * @typedef {Object} StudentsData
 * @property {number} version
 * @property {Student[]} students
 */

/**
 * @typedef {Object} Student
 * @property {string} id              - UUID
 * @property {string} name
 * @property {string|null} team_id
 * @property {boolean} is_dropout     - 중도퇴소 여부
 * @property {string} [dropout_date]
 * @property {string} [memo]
 */

// ─── 점수 데이터 (scores.json) ───────────────────────────────

/**
 * @typedef {Object} ScoresData
 * @property {number} version
 * @property {Object<string, Object<string, Object<string, number|boolean|string>>>} raw_scores
 *   구조: { [category_id]: { [student_id]: { [field_id]: value } } }
 * @property {Object<string, Object<string, number|null>>} [overrides]
 *   구조: { [category_id]: { [student_id]: number|null } }
 */

// ─── 팩토리 함수 ────────────────────────────────────────────

/** 빈 기수 설정 생성 */
export function createEmptyCohortConfig(id, name) {
  return {
    id,
    name,
    created_at: new Date().toISOString(),
    cloned_from: null,
    version: 1,
    teams: [],
    evaluation_categories: [],
  };
}

/** 빈 학생 데이터 생성 */
export function createEmptyStudentsData() {
  return { version: 1, students: [] };
}

/** 빈 점수 데이터 생성 */
export function createEmptyScoresData() {
  return { version: 1, raw_scores: {} };
}

/** 평가 카테고리 생성 */
export function createCategory(name, scoringMethod, maxScore, options = {}) {
  return {
    id: uuidv4(),
    name,
    order: options.order ?? 0,
    max_score: maxScore,
    is_bonus: options.is_bonus ?? false,
    scoring_method: scoringMethod,
    config: options.config ?? {},
    input_fields: options.input_fields ?? [],
    sub_categories: options.sub_categories ?? [],
  };
}

/** 학생 생성 */
export function createStudent(name, options = {}) {
  return {
    id: uuidv4(),
    name,
    team_id: options.team_id ?? null,
    is_dropout: options.is_dropout ?? false,
    dropout_date: options.dropout_date ?? undefined,
    memo: options.memo ?? undefined,
  };
}

/** 팀 생성 */
export function createTeam(name, members = []) {
  return {
    id: uuidv4(),
    name,
    members,
  };
}
