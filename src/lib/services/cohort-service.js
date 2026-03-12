// 기수(cohort) CRUD 및 복제 서비스

import {
  readJSON, writeJSON, ensureDir, removeDir, listDirs,
  getCohortDir, getConfigPath, getStudentsPath, getScoresPath,
} from '@/lib/storage/file-store';
import {
  createEmptyCohortConfig, createEmptyStudentsData, createEmptyScoresData,
} from '@/lib/schema';

/** 기수 목록 조회 */
export async function listCohorts() {
  const path = await import('path');
  const cohortsDir = path.join(process.cwd(), 'data', 'cohorts');
  const names = await listDirs(cohortsDir);
  const cohorts = [];
  for (const name of names) {
    const config = await readJSON(getConfigPath(name));
    if (config) {
      cohorts.push({ id: config.id, name: config.name, created_at: config.created_at });
    }
  }
  return cohorts;
}

/** 기수 상세 조회 */
export async function getCohort(cohortId) {
  return readJSON(getConfigPath(cohortId));
}

/** 기수 생성 */
export async function createCohort(id, name) {
  await ensureDir(getCohortDir(id));
  const config = createEmptyCohortConfig(id, name);
  const students = createEmptyStudentsData();
  const scores = createEmptyScoresData();

  await writeJSON(getConfigPath(id), config);
  await writeJSON(getStudentsPath(id), students);
  await writeJSON(getScoresPath(id), scores);

  return config;
}

/** 기수 삭제 */
export async function deleteCohort(cohortId) {
  await removeDir(getCohortDir(cohortId));
}

/** 기수 복제 */
export async function cloneCohort(sourceId, targetId, targetName, options = {}) {
  const sourceConfig = await readJSON(getConfigPath(sourceId));
  if (!sourceConfig) throw new Error(`Source cohort ${sourceId} not found`);

  await ensureDir(getCohortDir(targetId));

  // 설정 복제 (항상)
  const newConfig = {
    ...sourceConfig,
    id: targetId,
    name: targetName,
    created_at: new Date().toISOString(),
    cloned_from: sourceId,
    version: 1,
  };

  // 학생 명단 복제 (옵션)
  let newStudents;
  if (options.includeStudents) {
    const sourceStudents = await readJSON(getStudentsPath(sourceId));
    newStudents = { ...sourceStudents, version: 1 };
  } else {
    newStudents = createEmptyStudentsData();
    // 팀 구조는 유지하되 멤버는 비움
    if (!options.includeStudents) {
      newConfig.teams = options.includeTeams
        ? sourceConfig.teams.map(t => ({ ...t, members: [] }))
        : [];
    }
  }

  // 점수 데이터 복제 (옵션)
  let newScores;
  if (options.includeScores) {
    const sourceScores = await readJSON(getScoresPath(sourceId));
    newScores = { ...sourceScores, version: 1 };
  } else {
    newScores = createEmptyScoresData();
  }

  await writeJSON(getConfigPath(targetId), newConfig);
  await writeJSON(getStudentsPath(targetId), newStudents);
  await writeJSON(getScoresPath(targetId), newScores);

  return newConfig;
}
