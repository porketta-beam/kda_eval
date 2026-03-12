// 점수 입력/조회 서비스 (원본 raw_scores 관리)

import { readJSON, getScoresPath } from '@/lib/storage/file-store';
import { writeWithLock } from '@/lib/storage/locking';

/** 점수 데이터 조회 */
export async function getScores(cohortId) {
  return readJSON(getScoresPath(cohortId), { version: 1, raw_scores: {} });
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

/** 카테고리별 일괄 점수 업데이트 */
export async function bulkUpdateScores(cohortId, categoryId, scores, expectedVersion) {
  const data = await getScores(cohortId);
  if (!data.raw_scores[categoryId]) data.raw_scores[categoryId] = {};

  // scores: { [studentId]: { [fieldId]: value } }
  for (const [studentId, fields] of Object.entries(scores)) {
    if (!data.raw_scores[categoryId][studentId]) data.raw_scores[categoryId][studentId] = {};
    Object.assign(data.raw_scores[categoryId][studentId], fields);
  }

  const saved = await writeWithLock(getScoresPath(cohortId), data, expectedVersion ?? data.version);
  return saved;
}

/** 점수 데이터 전체 업데이트 (주의: 전체 덮어쓰기) */
export async function updateScores(cohortId, scoresData, expectedVersion) {
  return writeWithLock(getScoresPath(cohortId), scoresData, expectedVersion);
}
