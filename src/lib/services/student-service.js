// 학생 CRUD, 중도퇴소 토글, 일괄 추가 서비스

import { readJSON } from '@/lib/storage/file-store';
import { getStudentsPath } from '@/lib/storage/file-store';
import { writeWithLock } from '@/lib/storage/locking';
import { createStudent } from '@/lib/schema';

/** 학생 목록 조회 */
export async function getStudents(cohortId) {
  return readJSON(getStudentsPath(cohortId), { version: 1, students: [] });
}

/** 학생 추가 */
export async function addStudent(cohortId, name, options = {}) {
  const data = await getStudents(cohortId);
  const student = createStudent(name, options);
  data.students.push(student);
  const saved = await writeWithLock(getStudentsPath(cohortId), data, data.version);
  return { student, data: saved };
}

/** 학생 수정 */
export async function updateStudent(cohortId, studentId, updates) {
  const data = await getStudents(cohortId);
  const idx = data.students.findIndex(s => s.id === studentId);
  if (idx === -1) throw new Error(`Student ${studentId} not found`);
  data.students[idx] = { ...data.students[idx], ...updates, id: studentId };
  const saved = await writeWithLock(getStudentsPath(cohortId), data, data.version);
  return saved;
}

/** 학생 삭제 */
export async function deleteStudent(cohortId, studentId) {
  const data = await getStudents(cohortId);
  data.students = data.students.filter(s => s.id !== studentId);
  const saved = await writeWithLock(getStudentsPath(cohortId), data, data.version);
  return saved;
}

/** 중도퇴소 토글 */
export async function toggleDropout(cohortId, studentId) {
  const data = await getStudents(cohortId);
  const student = data.students.find(s => s.id === studentId);
  if (!student) throw new Error(`Student ${studentId} not found`);
  student.is_dropout = !student.is_dropout;
  student.dropout_date = student.is_dropout ? new Date().toISOString().split('T')[0] : undefined;
  const saved = await writeWithLock(getStudentsPath(cohortId), data, data.version);
  return saved;
}

/** 학생 일괄 추가 */
export async function bulkAddStudents(cohortId, studentNames, options = {}) {
  const data = await getStudents(cohortId);
  const newStudents = studentNames.map(name => createStudent(name, options));
  data.students.push(...newStudents);
  const saved = await writeWithLock(getStudentsPath(cohortId), data, data.version);
  return { students: newStudents, data: saved };
}
