const express = require('express');
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function calendarStatus(semester, today = todayKey()) {
  if (semester.start_date > today) return 'UPCOMING';
  if (semester.end_date && semester.end_date < today) return 'RECENT';
  return 'RUNNING';
}

function gradeFor(total) {
  if (total === null || total === undefined) return { grade: '—', point: null };
  if (total >= 80) return { grade: 'A+', point: 4.00 };
  if (total >= 75) return { grade: 'A', point: 3.75 };
  if (total >= 70) return { grade: 'A-', point: 3.50 };
  if (total >= 65) return { grade: 'B+', point: 3.25 };
  if (total >= 60) return { grade: 'B', point: 3.00 };
  if (total >= 55) return { grade: 'B-', point: 2.75 };
  if (total >= 50) return { grade: 'C+', point: 2.50 };
  if (total >= 45) return { grade: 'C', point: 2.25 };
  if (total >= 40) return { grade: 'D', point: 2.00 };
  return { grade: 'F', point: 0.00 };
}

function assessmentSummary(row) {
  const entered = [row.ct1, row.ct2, row.ct3]
    .filter(value => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const attendance = row.attendance === null || row.attendance === undefined || row.attendance === ''
    ? null : Number(row.attendance);
  const finalMarks = row.finalMarks === null || row.finalMarks === undefined || row.finalMarks === ''
    ? null : Number(row.finalMarks);
  const caComplete = entered.length >= 2 && Number.isFinite(attendance);
  const caMarks = caComplete ? Math.round((entered[0] + entered[1] + attendance) * 10) / 10 : null;
  const complete = caMarks !== null && Number.isFinite(finalMarks);
  const total = complete ? Math.round((caMarks + finalMarks) * 10) / 10 : null;
  return { ...row, best2: caComplete ? Math.round((entered[0] + entered[1]) * 10) / 10 : null, caMarks, total, complete, ...gradeFor(total) };
}

function getRoutineSources() {
  const sources = [];
  for (const routine of db.prepare(`SELECT id, routine_data FROM routines WHERE type = 'CLASS_ROUTINE' ORDER BY updated_at DESC`).all()) {
    try { sources.push(JSON.parse(routine.routine_data || '{}')); } catch (_) { /* skip malformed snapshot */ }
    // Published routine versions preserve a semester's teacher allocation after
    // it has naturally left the active routine at the end of its calendar date.
    for (const version of db.prepare(`SELECT routine_snapshot FROM routine_versions WHERE routine_id = ? ORDER BY created_at DESC`).all(routine.id)) {
      try { sources.push(JSON.parse(version.routine_snapshot || '{}')); } catch (_) { /* skip malformed snapshot */ }
    }
  }
  return sources;
}

function getCalendarSemester(semesterId) {
  return db.prepare(`
    SELECT sem.id, sem.session_id, sem.semester_name, sem.term_code, sem.start_date, sem.end_date,
           sem.class_start_date, sem.class_end_date, sess.session_name
    FROM semesters sem JOIN academic_sessions sess ON sess.id = sem.session_id
    WHERE sem.id = ? AND sem.term_code LIKE 'CAL-%'
      AND (sess.student_info_enabled = 1 OR EXISTS (SELECT 1 FROM students st WHERE st.current_session_id = sess.id))
  `).get(semesterId);
}

function routineSemester(semesterId) {
  for (const source of getRoutineSources()) {
    const found = (source.semesters || []).find(item => (item.semesterId || item.id) === semesterId);
    if (found) return found;
  }
  return null;
}

function routeCourse(semesterId, courseId) {
  const semester = routineSemester(semesterId);
  if (!semester) return null;
  return (semester.courses || []).find(course => (course.courseId || course.id) === courseId || course.id === courseId) || null;
}

function assignedTeacher(course) {
  const teacher = course?.teacher || {};
  return teacher.type === 'department' && teacher.teacherId ? teacher : null;
}

function canEdit(req, course) {
  const teacher = assignedTeacher(course);
  return req.user.role === 'ADMIN' || Boolean(teacher && req.user.teacherId === teacher.teacherId);
}

function serializeCourse(course) {
  const teacher = assignedTeacher(course);
  return {
    id: course.courseId || course.id,
    course_id: course.courseId || course.id,
    course_code: course.courseCode || course.course_code,
    course_title: course.courseTitle || course.course_title,
    credit_hours: Number(course.creditHours ?? course.credit_hours ?? 0),
    course_type: course.courseType || course.course_type || 'Theory',
    is_assigned: Boolean(teacher),
    assigned_teacher_id: teacher?.teacherId || null,
    assigned_teacher_name: teacher?.teacherName || null,
    assigned_teacher_designation: teacher?.designation || null,
    assignment_note: teacher ? null : 'Assign a department teacher in Create Routine to open this assessment.'
  };
}

router.get('/sessions', authenticateUser, (req, res) => {
  try {
    const today = todayKey();
    const rows = db.prepare(`
      SELECT sess.id, sess.session_name, sess.start_date, sess.end_date,
             sem.id AS semester_id, sem.semester_name, sem.start_date AS semester_start_date,
             sem.end_date AS semester_end_date, sem.class_start_date, sem.class_end_date
      FROM academic_sessions sess
      JOIN semesters sem ON sem.session_id = sess.id
      WHERE (sess.student_info_enabled = 1 OR EXISTS (SELECT 1 FROM students st WHERE st.current_session_id = sess.id))
        AND sem.term_code LIKE 'CAL-%' AND sem.start_date IS NOT NULL
      ORDER BY sem.start_date DESC, sem.created_at DESC
    `).all();
    const studentCounts = new Map(db.prepare(`SELECT current_session_id, COUNT(*) AS count FROM students GROUP BY current_session_id`).all().map(r => [r.current_session_id, r.count]));
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, session_name: row.session_name, start_date: row.start_date, end_date: row.end_date, student_count: studentCounts.get(row.id) || 0, semesters: [] });
      grouped.get(row.id).semesters.push({ id: row.semester_id, semester_name: row.semester_name, start_date: row.semester_start_date, end_date: row.semester_end_date, class_start_date: row.class_start_date, class_end_date: row.class_end_date });
    }
    const sessions = [...grouped.values()].map(session => {
      const semesters = session.semesters.map(semester => ({ ...semester, calendar_status: calendarStatus(semester, today) }));
      const running = semesters.find(semester => semester.calendar_status === 'RUNNING');
      const upcoming = semesters.find(semester => semester.calendar_status === 'UPCOMING');
      const current = running || upcoming || semesters[0] || null;
      const group = running || upcoming ? 'running' : 'recent';
      return { ...session, group, session_status: running ? 'RUNNING' : upcoming ? 'UPCOMING' : 'PASSED', current_semester: current, semester_count: semesters.length };
    }).sort((a, b) => (a.group === b.group ? String(b.start_date || '').localeCompare(String(a.start_date || '')) : a.group === 'running' ? -1 : 1));
    return res.json({ running: sessions.filter(s => s.group === 'running'), recent: sessions.filter(s => s.group === 'recent') });
  } catch (error) { return res.status(500).json({ error: `Failed to load assessment sessions: ${error.message}` }); }
});

router.get('/sessions/:sessionId/semesters', authenticateUser, (req, res) => {
  try {
    const today = todayKey();
    const session = db.prepare('SELECT id, session_name FROM academic_sessions s WHERE id = ? AND (student_info_enabled = 1 OR EXISTS (SELECT 1 FROM students st WHERE st.current_session_id = s.id))').get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    const semesters = db.prepare(`
      SELECT id, semester_name, term_code, start_date, end_date, class_start_date, class_end_date
      FROM semesters WHERE session_id = ? AND term_code LIKE 'CAL-%' AND start_date <= ?
      ORDER BY start_date ASC, created_at ASC
    `).all(session.id, today).map(semester => ({ ...semester, calendar_status: calendarStatus(semester, today) }));
    return res.json({ session, semesters });
  } catch (error) { return res.status(500).json({ error: `Failed to load semesters: ${error.message}` }); }
});

router.get('/semesters/:semesterId/courses', authenticateUser, (req, res) => {
  try {
    const semester = getCalendarSemester(req.params.semesterId);
    if (!semester) return res.status(404).json({ error: 'Calendar semester not found.' });
    const linked = routineSemester(semester.id);
    const courses = (linked?.courses || []).filter(course => course.isIncluded !== false).map(serializeCourse);
    return res.json({ semester: { ...semester, calendar_status: calendarStatus(semester) }, courses });
  } catch (error) { return res.status(500).json({ error: `Failed to load routine courses: ${error.message}` }); }
});

router.get('/semesters/:semesterId/courses/:courseId/marks', authenticateUser, (req, res) => {
  try {
    const semester = getCalendarSemester(req.params.semesterId);
    const sourceCourse = routeCourse(req.params.semesterId, req.params.courseId);
    if (!semester || !sourceCourse) return res.status(404).json({ error: 'This course is not available in the selected calendar routine.' });
    const course = serializeCourse(sourceCourse);
    if (!course.is_assigned) return res.status(409).json({ error: 'This course has no routine teacher assignment yet.' });
    const students = db.prepare(`
      SELECT st.id, st.student_roll, st.registration_no, u.first_name || ' ' || u.last_name AS student_name
      FROM students st JOIN users u ON u.id = st.user_id
      WHERE st.current_session_id = ? ORDER BY st.student_roll ASC
    `).all(semester.session_id);
    const marks = db.prepare(`SELECT student_id, ct1, ct2, ct3, attendance, final_marks FROM regular_assessment_marks WHERE calendar_semester_id = ? AND course_id = ?`).all(semester.id, course.course_id);
    const markMap = new Map(marks.map(mark => [mark.student_id, mark]));
    const rows = students.map(student => assessmentSummary({
      studentId: student.id, studentRoll: student.student_roll, registrationNo: student.registration_no, studentName: student.student_name,
      ct1: markMap.get(student.id)?.ct1 ?? null, ct2: markMap.get(student.id)?.ct2 ?? null, ct3: markMap.get(student.id)?.ct3 ?? null,
      attendance: markMap.get(student.id)?.attendance ?? null, finalMarks: markMap.get(student.id)?.final_marks ?? null
    }));
    const ranked = rows.filter(row => row.complete).sort((a, b) => b.total - a.total);
    let position = 0;
    ranked.forEach((row, index) => { if (index === 0 || row.total < ranked[index - 1].total) position = index + 1; row.position = position; });
    const positions = new Map(ranked.map(row => [row.studentId, row.position]));
    return res.json({ semester: { ...semester, calendar_status: calendarStatus(semester) }, course, canEdit: canEdit(req, sourceCourse), matrix: rows.map(row => ({ ...row, position: positions.get(row.studentId) || null })), finalMaxMarks: 70 });
  } catch (error) { return res.status(500).json({ error: `Failed to load assessment report: ${error.message}` }); }
});

router.post('/semesters/:semesterId/courses/:courseId/marks', authenticateUser, (req, res) => {
  try {
    const semester = getCalendarSemester(req.params.semesterId);
    const sourceCourse = routeCourse(req.params.semesterId, req.params.courseId);
    if (!semester || !sourceCourse) return res.status(404).json({ error: 'This course is not available in the selected calendar routine.' });
    if (!assignedTeacher(sourceCourse)) return res.status(409).json({ error: 'Assign a teacher in the routine before entering marks.' });
    if (!canEdit(req, sourceCourse)) return res.status(403).json({ error: 'Only the routine-assigned teacher or an administrator may edit these marks.' });
    if (!Array.isArray(req.body.matrix)) return res.status(400).json({ error: 'Assessment matrix is required.' });
    const enrolled = new Set(db.prepare('SELECT id FROM students WHERE current_session_id = ?').all(semester.session_id).map(student => student.id));
    const courseId = sourceCourse.courseId || sourceCourse.id;
    const clean = value => value === '' || value === null || value === undefined ? null : Number(value);
    for (const row of req.body.matrix) for (const field of ['ct1', 'ct2', 'ct3', 'attendance']) { const value = clean(row[field]); if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10)) return res.status(400).json({ error: `${field} must be between 0 and 10.` }); }
    for (const row of req.body.matrix) { const value = clean(row.finalMarks); if (value !== null && (!Number.isFinite(value) || value < 0 || value > 70)) return res.status(400).json({ error: 'Final marks must be between 0 and 70.' }); }
    const upsert = db.prepare(`
      INSERT INTO regular_assessment_marks (id, calendar_semester_id, course_id, student_id, ct1, ct2, ct3, attendance, final_marks, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(calendar_semester_id, course_id, student_id) DO UPDATE SET
        ct1=excluded.ct1, ct2=excluded.ct2, ct3=excluded.ct3, attendance=excluded.attendance, final_marks=excluded.final_marks, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP
    `);
    db.transaction(() => req.body.matrix.forEach(row => {
      if (!enrolled.has(row.studentId)) return;
      upsert.run(`ram-${crypto.randomUUID()}`, semester.id, courseId, row.studentId, clean(row.ct1), clean(row.ct2), clean(row.ct3), clean(row.attendance), clean(row.finalMarks), req.user.id);
    }))();
    return res.json({ message: 'Assessment marks saved successfully.' });
  } catch (error) { return res.status(500).json({ error: `Failed to save assessment marks: ${error.message}` }); }
});

module.exports = router;
