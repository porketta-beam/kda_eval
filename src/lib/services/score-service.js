// 점수 입력/조회 서비스 (원본 raw_scores 관리)

import { readJSON, getScoresPath } from '@/lib/storage/file-store';
import { writeWithLock } from '@/lib/storage/locking';

/** 점수 데이터 조회 */
export async function getScores(cohortId) {
  return readJSON(getScoresPath(cohortId), { version: 1, raw_scores: {}, overrides: {} });
}

/** 단일 카테고리 점수 업데이트 */
export async function updateScore(cohortId, categoryId, studentId, fieldId, value) {
  const data = await getScores(cohortId);
  if (!data.raw_scores[categoryId]) data.raw_scores[categoryId] = {};
  if (!data.raw_scores[categoryId][studentId]) data.raw_scores[categoryId][studentId] = {};
  data.raw_scores[categoryId][studentId][fieldId] = value;

  const saved = await writeWithLock(getScoresPath(cohortId), data, data.version);
  return saved;
}

/** 카테고리별 일괄 점수 업데이트 (overrides 포함 가능) */
export async function bulkUpdateScores(cohortId, categoryId, scores, expectedVersion, overrides) {
  const data = await getScores(cohortId);
  if (!data.raw_scores[categoryId]) data.raw_scores[categoryId] = {};

  // scores: { [studentId]: { [fieldId]: value } }
  if (scores) {
    for (const [studentId, fields] of Object.entries(scores)) {
      if (!data.raw_scores[categoryId][studentId]) data.raw_scores[categoryId][studentId] = {};
      Object.assign(data.raw_scores[categoryId][studentId], fields);
    }
  }

  // overrides: { [studentId]: number|null }
  if (overrides) {
    if (!data.overrides) data.overrides = {};
    if (!data.overrides[categoryId]) data.overrides[categoryId] = {};
    for (const [studentId, value] of Object.entries(overrides)) {
      if (value === null || value === undefined) {
        delete data.overrides[categoryId][studentId];
      } else {
        data.overrides[categoryId][studentId] = value;
      }
    }
    // 빈 카테고리 정리
    if (Object.keys(data.overrides[categoryId]).length === 0) {
      delete data.overrides[categoryId];
    }
  }

  const saved = await writeWithLock(getScoresPath(cohortId), data, expectedVersion ?? data.version);
  return saved;
}

/** 점수 데이터 전체 업데이트 (주의: 전체 덮어쓰기) */
export async function updateScores(cohortId, scoresData, expectedVersion) {
  return writeWithLock(getScoresPath(cohortId), scoresData, expectedVersion);
}
