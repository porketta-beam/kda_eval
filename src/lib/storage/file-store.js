import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const COHORTS_DIR = path.join(DATA_DIR, 'cohorts');

/** 디렉토리가 없으면 생성 */
export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** JSON 파일 읽기. 없으면 defaultValue 반환 */
export async function readJSON(filePath, defaultValue = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}

/** JSON 파일 쓰기 */
export async function writeJSON(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 파일 존재 여부 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** 디렉토리 삭제 (재귀) */
export async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/** 디렉토리 목록 */
export async function listDirs(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// ─── 경로 헬퍼 ──────────────────────────────────────────────

export function getCohortDir(cohortId) {
  return path.join(COHORTS_DIR, cohortId);
}

export function getConfigPath(cohortId) {
  return path.join(COHORTS_DIR, cohortId, 'config.json');
}

export function getStudentsPath(cohortId) {
  return path.join(COHORTS_DIR, cohortId, 'students.json');
}

export function getScoresPath(cohortId) {
  return path.join(COHORTS_DIR, cohortId, 'scores.json');
}
