const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db/schema');

const { CURRICULUM_COURSES, SEMESTERS_METADATA } = require('../db/curriculumData');

/**
 * Standard 8 Semesters in CSE Undergrad Program
 */
const STANDARD_SEMESTERS = SEMESTERS_METADATA.map(s => ({
  name: s.name,
  code: s.termCode,
  year: s.year,
  semester: s.semester
}));

// Official faculty assignments lookup
const FACULTY_ASSIGNMENTS = {
  'CSE 1101': 't-100228', // Nakib Aman Turzo
  'CSE 1102': 't-2',      // Dr. Sadia Fatima
  'CSE 1103': 't-2',      // Dr. Sadia Fatima
  'CSE 1104': 't-2',      // Dr. Sadia Fatima
  'MATH 1101': 't-100012',
  'PHY 1101': 't-100228',
  'HUM 1101': 't-100214',
  'CSE 1201': 't-100214', // Nitun Kumar Podder
  'CSE 1202': 't-100214',
  'CSE 1203': 't-100012', // Dr. Md. Niaz Imtiaz
  'EEE 1201': 't-100228',
  'MATH 1201': 't-100002',
  'CSE 2101': 't-100002', // S. M. Hasan Sazzad Iqbal
  'CSE 2102': 't-100002',
  'CSE 2103': 't-100010', // Dr. Md. Khaled Ben Islam
  'CSE 2104': 't-100010',
  'CSE 2201': 't-100002', // S. M. Hasan Sazzad Iqbal
  'CSE 2202': 't-100214',
  'CSE 2205': 't-100012', // Dr. Md. Niaz Imtiaz
  'CSE 3101': 't-1',      // Dr. Mahmudur Rahman
  'CSE 3103': 't-100228', // Nakib Aman Turzo
  'CSE 3104': 't-100228',
  'CSE 3107': 't-1',      // Dr. Mahmudur Rahman
  'CSE 3108': 't-2',      // Dr. Sadia Fatima
  'CSE 3201': 't-100016', // Dr. Md. Toukir Ahmed
  'CSE 3203': 't-100003', // Md. Shafiul Azam
  'CSE 3204': 't-100003',
  'CSE 3205': 't-100214', // Nitun Kumar Podder
  'CSE 4101': 't-100016', // Dr. Md. Toukir Ahmed
  'CSE 4103': 't-100009', // Dr. Md. Abdur Rahim (Chairman)
  'CSE 4104': 't-100009',
  'CSE 4119': 't-100009', // Dr. Md. Abdur Rahim
  'CSE 4201': 't-100016', // Dr. Md. Toukir Ahmed
  'CSE 4202': 't-100016',
  'CSE 4203': 't-100002', // S. M. Hasan Sazzad Iqbal
  'CSE 4207': 't-100010'  // Dr. Md. Khaled Ben Islam
};

/**
 * Standard CSE Courses across 8 semesters with official faculty assignments
 */
const STANDARD_CURRICULUM = {};
for (const s of SEMESTERS_METADATA) {
  STANDARD_CURRICULUM[s.termCode] = CURRICULUM_COURSES
    .filter(c => c.termCode === s.termCode)
    .map(c => ({
      code: c.courseCode,
      title: c.courseTitle,
      credits: c.creditHours,
      type: c.courseType,
      year: c.year,
      semester: c.semester,
      termCode: c.termCode,
      isOptional: c.isOptional,
      electiveGroup: c.electiveGroup,
      teacherId: FACULTY_ASSIGNMENTS[c.courseCode] || 't-1',
      syllabus: c.syllabusOutline
    }));
}

/**
 * Standard student roster template for generating authentic enrolled students per session
 */
const SAMPLE_STUDENT_NAMES = [
  { first: 'Kowshik', last: 'Ahmed' },
  { first: 'Tanvir', last: 'Hasan' },
  { first: 'Nusrat', last: 'Jahan' },
  { first: 'Fahim', last: 'Hossain' },
  { first: 'Ayesha', last: 'Siddiqua' },
  { first: 'Raihan', last: 'Kabir' },
  { first: 'Farhana', last: 'Yasmin' },
  { first: 'Mehedi', last: 'Hasan' },
  { first: 'Tasnim', last: 'Anjum' },
  { first: 'Ashikur', last: 'Rahman' },
  { first: 'Sanjida', last: 'Akter' },
  { first: 'Shakil', last: 'Mahmud' },
  { first: 'Mahfuzur', last: 'Rahman' },
  { first: 'Sadia', last: 'Afrin' },
  { first: 'Zubair', last: 'Hasan' }
];

/**
 * Ensure a given session exists in academic_sessions, has all 8 standard semesters,
 * has standard courses populated, assigned teachers, enrolled student cohort, and initial marks.
 */
function ensureSessionWithStandardCourses(sessionNameInput, startDateInput, endDateInput, isCurrent = false) {
  if (!sessionNameInput) return null;

  let sessionName = sessionNameInput.trim();
  if (!sessionName.toLowerCase().startsWith('session ') && /^\d{4}-\d{4}/.test(sessionName)) {
    sessionName = 'Session ' + sessionName;
  }

  // Extract years if possible
  const yearMatch = sessionName.match(/(\d{4})-(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1]) : 2024;
  const endYear = yearMatch ? parseInt(yearMatch[2]) : startYear + 1;

  const startDate = startDateInput || `${startYear}-07-01`;
  const endDate = endDateInput || `${endYear}-06-30`;

  // 1. Check if session already exists
  let session = db.prepare('SELECT * FROM academic_sessions WHERE session_name = ?').get(sessionName);

  if (!session) {
    const sessionId = `sess-${startYear}-${String(endYear).slice(-2)}`;
    // Check if id taken
    const existingById = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(sessionId);
    const finalSessionId = existingById ? 'sess-' + crypto.randomUUID() : sessionId;

    db.prepare(`
      INSERT INTO academic_sessions (id, session_name, start_date, end_date, is_current)
      VALUES (?, ?, ?, ?, ?)
    `).run(finalSessionId, sessionName, startDate, endDate, isCurrent ? 1 : 0);

    session = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(finalSessionId);
  } else if (startDateInput && (!session.start_date || session.start_date !== startDateInput)) {
    db.prepare('UPDATE academic_sessions SET start_date = ? WHERE id = ?').run(startDateInput, session.id);
    session.start_date = startDateInput;
  }

  // 2. Ensure 8 standard semesters exist
  const existingSemesters = db.prepare('SELECT * FROM semesters WHERE session_id = ?').all(session.id);
  const semesterMap = {};
  for (const s of existingSemesters) {
    semesterMap[s.term_code] = s.id;
  }

  const insertSemester = db.prepare(`
    INSERT INTO semesters (id, session_id, semester_name, term_code, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const semDef of STANDARD_SEMESTERS) {
    if (!semesterMap[semDef.code]) {
      const semId = `sem-${session.id}-${semDef.code.toLowerCase()}`;
      insertSemester.run(semId, session.id, semDef.name, semDef.code, semDef.year, semDef.semester, semDef.code === 'Y3S1' ? 1 : 0);
      semesterMap[semDef.code] = semId;
    }
  }

  // 3. Ensure standard courses exist under each semester
  const insertCourse = db.prepare(`
    INSERT INTO courses (
      id, semester_id, course_code, course_title, credit_hours, course_type,
      year, semester, term_code, is_optional, elective_group, syllabus_outline
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(semester_id, course_code) DO UPDATE SET
      course_title = excluded.course_title,
      credit_hours = excluded.credit_hours,
      course_type = excluded.course_type,
      year = excluded.year,
      semester = excluded.semester,
      term_code = excluded.term_code,
      is_optional = excluded.is_optional,
      elective_group = excluded.elective_group,
      syllabus_outline = excluded.syllabus_outline
  `);

  const insertAssignment = db.prepare(`
    INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(course_id, teacher_id) DO NOTHING
  `);

  const existingCourses = db.prepare(`
    SELECT c.id, c.course_code, sem.term_code
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    WHERE sem.session_id = ?
  `).all(session.id);

  const courseCodeMap = {};
  for (const c of existingCourses) {
    courseCodeMap[c.course_code] = c.id;
  }

  for (const [termCode, courseList] of Object.entries(STANDARD_CURRICULUM)) {
    const semId = semesterMap[termCode];
    if (!semId) continue;

    for (const cDef of courseList) {
      let courseId = courseCodeMap[cDef.code];
      if (!courseId) {
        courseId = `c-${session.id}-${cDef.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      }

      try {
        insertCourse.run(
          courseId,
          semId,
          cDef.code,
          cDef.title,
          cDef.credits,
          cDef.type,
          cDef.year,
          cDef.semester,
          cDef.termCode,
          cDef.isOptional ? 1 : 0,
          cDef.electiveGroup || null,
          cDef.syllabus
        );
        courseCodeMap[cDef.code] = courseId;
      } catch (e) {
        // If id collision, generate random
        courseId = 'c-' + crypto.randomUUID();
        insertCourse.run(
          courseId,
          semId,
          cDef.code,
          cDef.title,
          cDef.credits,
          cDef.type,
          cDef.year,
          cDef.semester,
          cDef.termCode,
          cDef.isOptional ? 1 : 0,
          cDef.electiveGroup || null,
          cDef.syllabus
        );
        courseCodeMap[cDef.code] = courseId;
      }

      // Assign teacher if designated and not yet assigned
      if (cDef.teacherId) {
        const hasAssignment = db.prepare('SELECT id FROM course_assignments WHERE course_id = ?').get(courseId);
        if (!hasAssignment) {
          insertAssignment.run('ca-' + crypto.randomUUID(), courseId, cDef.teacherId, 'u-office');
        }
      }
    }
  }

  // 4. Ensure students exist in this session
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE current_session_id = ?').get(session.id);
  if (!studentCount || studentCount.count < 10) {
    const rollYear = String(startYear).slice(-2);
    const passHash = bcrypt.hashSync('Student@123', 8);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone_number, status)
      VALUES (?, ?, ?, 'STUDENT', ?, ?, ?, 'ACTIVE')
      ON CONFLICT(email) DO NOTHING
    `);

    const insertStudent = db.prepare(`
      INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_roll) DO NOTHING
    `);

    for (let i = 0; i < SAMPLE_STUDENT_NAMES.length; i++) {
      const sNum = String(i + 1).padStart(2, '0');
      const roll = `CSE-${rollYear}01${sNum}`;
      const reg = `REG-${startYear}${sNum}`;
      const email = `student.${rollYear}01${sNum}@cse.pust.ac.bd`;
      const name = SAMPLE_STUDENT_NAMES[i];
      const userId = `u-stud-${rollYear}-${sNum}`;
      const studentId = `s-${rollYear}-${sNum}`;

      insertUser.run(
        userId,
        email,
        passHash,
        name.first,
        name.last,
        `+8801700${rollYear}${sNum}1`
      );

      const activeUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (activeUser) {
        insertStudent.run(
          studentId,
          activeUser.id,
          roll,
          reg,
          session.id
        );
      }
    }
  }

  // 5. Seed some initial continuous assessment marks for first 3 students on key courses so it displays immediately
  seedSampleMarksForSession(session.id);

  return session;
}

/**
 * Seed realistic Class Test marks and Attendance for previewing
 */
function seedSampleMarksForSession(sessionId) {
  const students = db.prepare(`
    SELECT s.id, s.student_roll
    FROM students s
    WHERE s.current_session_id = ?
    LIMIT 6
  `).all(sessionId);

  if (students.length === 0) return;

  const keyCourses = db.prepare(`
    SELECT c.id, ca.teacher_id
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    WHERE sem.session_id = ? AND c.course_code IN ('CSE-3101', 'CSE-3103', 'CSE-4101', 'CSE-1101')
  `).all(sessionId);

  const upsertMark = db.prepare(`
    INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(course_id, student_id, ct_number) DO NOTHING
  `);

  for (const c of keyCourses) {
    const teacherId = c.teacher_id || 't-1';
    students.forEach((st, idx) => {
      // CT 1
      const ct1Val = Number((7.5 + (idx * 0.4) % 2.5).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-1`, c.id, st.id, teacherId, 1, ct1Val, 10.0, 'Good conceptual clarity');
      // CT 2
      const ct2Val = Number((8.0 + (idx * 0.3) % 2.0).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-2`, c.id, st.id, teacherId, 2, ct2Val, 10.0, 'Strong problem solving');
      // CT 3
      const ct3Val = Number((7.0 + (idx * 0.5) % 3.0).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-3`, c.id, st.id, teacherId, 3, ct3Val, 10.0, 'Review test case edge cases');
      // Attendance (max 10)
      const attVal = Number((8.5 + (idx * 0.3) % 1.5).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-4`, c.id, st.id, teacherId, 4, attVal, 10.0, 'Consistent attendance');
    });
  }
}

/**
 * Synchronize all serial academic sessions
 * e.g., 2024-2025, 2023-2024, 2022-2023, 2021-2022, 2020-2021
 */
function syncAllSerialSessions() {
  const serialSessions = [
    { name: 'Session 2024-2025', startDate: '2024-07-01', endDate: '2025-06-30', isCurrent: false },
    { name: 'Session 2023-2024', startDate: '2023-07-01', endDate: '2024-06-30', isCurrent: true },
    { name: 'Session 2022-2023', startDate: '2022-07-01', endDate: '2023-06-30', isCurrent: false },
    { name: 'Session 2021-2022', startDate: '2021-07-01', endDate: '2022-06-30', isCurrent: false },
    { name: 'Session 2020-2021', startDate: '2020-07-01', endDate: '2021-06-30', isCurrent: false },
  ];

  for (const s of serialSessions) {
    ensureSessionWithStandardCourses(s.name, s.startDate, s.endDate, s.isCurrent);
  }
}

module.exports = {
  ensureSessionWithStandardCourses,
  syncAllSerialSessions,
  STANDARD_CURRICULUM,
  STANDARD_SEMESTERS
};
