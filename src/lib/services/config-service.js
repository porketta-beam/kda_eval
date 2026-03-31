// 평가 체계 설정 관리 서비스 (카테고리 CRUD, 순서 변경)

import { readJSON, getConfigPath } from '@/lib/storage/file-store';
import { writeWithLock } from '@/lib/storage/locking';
import { createCategory, SCORING_METHOD, V1_SCORING_METHOD } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';

/** 기수 설정 조회 */
export async function getConfig(cohortId) {
  return readJSON(getConfigPath(cohortId));
}

/** 기수 설정 전체 업데이트 */
export async function updateConfig(cohortId, config, expectedVersion) {
  return writeWithLock(getConfigPath(cohortId), config, expectedVersion);
}

/** 카테고리 추가 */
export async function addCategory(cohortId, name, scoringMethod, maxScore, options = {}) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  const maxOrder = config.evaluation_categories.reduce((m, c) => Math.max(m, c.order), 0);

  // input_fields가 없으면 방식별 기본 필드 자동 생성
  if (!options.input_fields || options.input_fields.length === 0) {
    options = { ...options, input_fields: generateDefaultInputFields(scoringMethod, maxScore) };
  }

  const category = createCategory(name, scoringMethod, maxScore, {
    ...options,
    order: maxOrder + 1,
  });
  config.evaluation_categories.push(category);

  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return { category, config: saved };
}

/** 카테고리 수정 */
export async function updateCategory(cohortId, categoryId, updates) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  const found = findCategoryRecursive(config.evaluation_categories, categoryId);
  if (!found) throw new Error(`Category ${categoryId} not found`);
  Object.assign(found, updates, { id: categoryId });

  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return saved;
}

/** 카테고리 삭제 (config에서만 제거, scores 데이터는 보존) */
export async function deleteCategory(cohortId, categoryId) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  config.evaluation_categories = removeCategoryRecursive(config.evaluation_categories, categoryId);

  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return saved;
}

/** 카테고리 순서 변경 */
export async function reorderCategories(cohortId, orderedIds) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  orderedIds.forEach((id, index) => {
    const cat = config.evaluation_categories.find(c => c.id === id);
    if (cat) cat.order = index + 1;
  });

  config.evaluation_categories.sort((a, b) => a.order - b.order);
  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return saved;
}

/** 하위 카테고리 추가 (임의 깊이 부모에 자식 추가) */
export async function addSubCategory(cohortId, parentCategoryId, childData) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  const parent = findCategoryRecursive(config.evaluation_categories, parentCategoryId);
  if (!parent) throw new Error(`Category ${parentCategoryId} not found`);

  if (!parent.sub_categories) parent.sub_categories = [];
  const maxOrder = parent.sub_categories.reduce((m, c) => Math.max(m, c.order), 0);

  const child = createCategory(
    childData.name,
    childData.scoring_method || V1_SCORING_METHOD.AVERAGE,
    childData.max_score || 0,
    { ...childData, order: maxOrder + 1 },
  );
  parent.sub_categories.push(child);

  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return { category: child, config: saved };
}

/** 하위 카테고리 순서 변경 */
export async function reorderSubCategories(cohortId, parentCategoryId, orderedIds) {
  const config = await getConfig(cohortId);
  if (!config) throw new Error(`Cohort ${cohortId} not found`);

  const parent = findCategoryRecursive(config.evaluation_categories, parentCategoryId);
  if (!parent) throw new Error(`Category ${parentCategoryId} not found`);
  if (!parent.sub_categories) parent.sub_categories = [];

  orderedIds.forEach((id, index) => {
    const cat = parent.sub_categories.find(c => c.id === id);
    if (cat) cat.order = index + 1;
  });
  parent.sub_categories.sort((a, b) => a.order - b.order);

  const saved = await writeWithLock(getConfigPath(cohortId), config, config.version);
  return saved;
}

// ─── 헬퍼 ──────────────────────────────────────────────────

/** 평가 방식별 기본 입력 필드 자동 생성 */
function generateDefaultInputFields(scoringMethod, maxScore) {
  const id = uuidv4();
  switch (scoringMethod) {
    case SCORING_METHOD.USER_INPUT:
      return [{ id, name: '점수', type: 'number', per: 'student', min: 0, max: maxScore }];
    case SCORING_METHOD.BOOLEAN:
      return [{ id, name: '충족', type: 'boolean', per: 'student' }];
    case SCORING_METHOD.WEIGHTED_AVERAGE:
    case SCORING_METHOD.SUM_DIVIDE:
      return [{ id, name: '값', type: 'number', per: 'student', min: 0 }];
    case SCORING_METHOD.FORMULA:
      return [{ id, name: '값', type: 'number', per: 'student', min: 0, max: 100 }];
    default:
      return [];
  }
}

export function findCategoryRecursive(categories, id) {
  for (const cat of categories) {
    if (cat.id === id) return cat;
    if (cat.sub_categories) {
      const found = findCategoryRecursive(cat.sub_categories, id);
      if (found) return found;
    }
  }
  return null;
}

function removeCategoryRecursive(categories, id) {
  return categories
    .filter(c => c.id !== id)
    .map(c => {
      if (c.sub_categories) {
        return { ...c, sub_categories: removeCategoryRecursive(c.sub_categories, id) };
      }
      return c;
    });
}
