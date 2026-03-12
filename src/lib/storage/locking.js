import { Mutex } from 'async-mutex';
import { readJSON, writeJSON } from './file-store.js';

const fileMutexes = new Map();

/** 버전 충돌 에러 */
export class ConflictError extends Error {
  constructor(currentData) {
    super('Version conflict');
    this.name = 'ConflictError';
    this.currentData = currentData;
  }
}

/**
 * 파일별 뮤텍스 + 낙관적 잠금으로 안전한 쓰기
 * @param {string} filePath
 * @param {Object} data - 쓸 데이터
 * @param {number} expectedVersion - 클라이언트가 보유한 버전
 * @returns {Promise<Object>} 저장된 데이터 (version 증가됨)
 */
export async function writeWithLock(filePath, data, expectedVersion) {
  let mutex = fileMutexes.get(filePath);
  if (!mutex) {
    mutex = new Mutex();
    fileMutexes.set(filePath, mutex);
  }

  return mutex.runExclusive(async () => {
    const current = await readJSON(filePath);
    if (current && current.version !== expectedVersion) {
      throw new ConflictError(current);
    }
    data.version = (current?.version ?? 0) + 1;
    await writeJSON(filePath, data);
    return data;
  });
}
