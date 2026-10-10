const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { ensureSessionWithStandardCourses, syncAllSerialSessions } = require('../utils/sessionSync');
const { syncPustTeachersToDatabase, getSyncStatus } = require('../services/pustTeacherSync');
const { CURRICULUM_COURSES, SEMESTERS_METADATA } = require('../db/curriculumData');

function requireAcademicAuthority(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const isChair = req.user.email === 'chair.cse_pust@gmail.com' || req.user.role === 'ADMIN' || (req.user.designation && req.user.designation.toLowerCase().includes('chair'));
  if (['OFFICE_STAFF', 'ADMIN', 'TEACHER'].includes(req.user.role) || isChair) {
    return next();
  }
  return res.status(403).json({ error: 'Access Denied: Only Department Faculty, Chairman, or Academic Office Staff can perform this action.' });
}

// ==========================================
// 1. SESSIONS MANAGEMENT
// ==========================================

// Get all sessions
router.get('/sessions', authenticateUser, (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, 
           (SELECT COUNT(*) FROM students WHERE current_session_id = s.id) as student_count,
           (SELECT COUNT(*) FROM semesters WHERE session_id = s.id) as semester_count
    FROM academic_sessions s
    ORDER BY s.start_date DESC
  `).all();
  return res.json({ sessions });
});

// Create a new session (Chairman / Office Staff / Admin)
router.post('/sessions', authenticateUser, requireAcademicAuthority, (req, res) => {
  const sessionName = (req.body.sessionName || req.body.session_name || '').trim();
  const startDate = req.body.startDate || req.body.start_date || new Date().toISOString().split('T')[0];
  const endDate = req.body.endDate || req.body.end_date || null;
  const isCurrent = Boolean(req.body.isCurrent || req.body.is_current);

  if (!sessionName) {
    return res.status(400).json({ error: 'Session name is required.' });
  }

  const existing = db.prepare('SELECT id FROM academic_sessions WHERE session_name = ?').get(sessionName);
  if (existing) {
    return res.status(400).json({ error: 'Session with this name already exists.' });
  }

  const sessionId = 'sess-' + crypto.randomUUID();

  const transaction = db.transaction(() => {
    if (isCurrent) {
      db.prepare('UPDATE academic_sessions SET is_current = 0').run();
    }
    db.prepare(`
      INSERT INTO academic_sessions (id, session_name, start_date, end_date, is_current)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, sessionName, startDate, endDate || null, isCurrent ? 1 : 0);

    // Auto pre-populate 8 standard CSE semesters (Y1S1 to Y4S2) for convenience
    const standardSemesters = [
      { name: '1st Year 1st Semester', code: 'Y1S1', active: 1 },
      { name: '1st Year 2nd Semester', code: 'Y1S2', active: 0 },
      { name: '2nd Year 1st Semester', code: 'Y2S1', active: 0 },
      { name: '2nd Year 2nd Semester', code: 'Y2S2', active: 0 },
      { name: '3rd Year 1st Semester', code: 'Y3S1', active: 0 },
      { name: '3rd Year 2nd Semester', code: 'Y3S2', active: 0 },
      { name: '4th Year 1st Semester', code: 'Y4S1', active: 0 },
      { name: '4th Year 2nd Semester', code: 'Y4S2', active: 0 },
    ];

    const insertSem = db.prepare(`
      INSERT INTO semesters (id, session_id, semester_name, term_code, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const sem of standardSemesters) {
      insertSem.run('sem-' + crypto.randomUUID(), sessionId, sem.name, sem.code, sem.active);
    }
  });

  try {
    transaction();
    return res.status(201).json({
      message: `Session '${sessionName}' created with standard 8 semesters successfully!`,
      sessionId,
      session: {
        session_id: sessionId,
        session_name: sessionName,
        start_date: startDate,
        end_date: endDate,
        is_current: isCurrent,
        max_seats: 40
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create session: ' + err.message });
  }
});

// Set session as current
router.patch('/sessions/:id/current', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { id } = req.params;
  const transaction = db.transaction(() => {
    db.prepare('UPDATE academic_sessions SET is_current = 0').run();
    db.prepare('UPDATE academic_sessions SET is_current = 1 WHERE id = ?').run(id);
  });

  try {
    transaction();
    return res.json({ message: 'Current session updated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. SEMESTERS MANAGEMENT
// ==========================================

// Get semesters for a specific session
router.get('/sessions/:sessionId/semesters', authenticateUser, (req, res) => {
  const { sessionId } = req.params;
  const semesters = db.prepare(`
    SELECT sem.*,
           (SELECT COUNT(*) FROM courses WHERE semester_id = sem.id) as course_count
    FROM semesters sem
    WHERE sem.session_id = ?
    ORDER BY sem.created_at ASC
  `).all(sessionId);

  return res.json({ semesters });
});

// Toggle semester active state (Office Staff / Admin)
router.patch('/semesters/:id/status', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  db.prepare('UPDATE semesters SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return res.json({ message: 'Semester status updated.' });
});

// Add a custom semester to a session
router.post('/sessions/:sessionId/semesters', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { sessionId } = req.params;
  const { semesterName, termCode, isActive } = req.body;

  if (!semesterName || !termCode) {
    return res.status(400).json({ error: 'Semester name and term code are required.' });
  }

  const semId = 'sem-' + crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO semesters (id, session_id, semester_name, term_code, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(semId, sessionId, semesterName, termCode, isActive ? 1 : 0);

    return res.status(201).json({ message: 'Semester created successfully!', id: semId });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to create semester: ' + err.message });
  }
});

// ==========================================
// 3. COURSES & FACULTY ASSIGNMENTS
// ==========================================

// Get courses under a semester (Includes assigned teacher details)
router.get('/semesters/:semesterId/courses', authenticateUser, (req, res) => {
  const { semesterId } = req.params;
  const courses = db.prepare(`
    SELECT c.*,
           ca.teacher_id as assigned_teacher_id,
           u.first_name || ' ' || u.last_name as assigned_teacher_name,
           u.email as assigned_teacher_email,
           u.phone_number as assigned_teacher_phone,
           t.designation as assigned_teacher_designation,
           t.department_code as assigned_teacher_department,
           (SELECT COUNT(*) FROM course_materials WHERE course_id = c.id) as material_count,
           (SELECT COUNT(DISTINCT student_id) FROM ct_marks WHERE course_id = c.id) as marked_student_count
    FROM courses c
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN teachers t ON t.id = ca.teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE c.semester_id = ?
    ORDER BY c.course_code ASC
  `).all(semesterId);

  return res.json({ courses });
});

// Create course under a semester (Office Staff / Admin)
router.post('/semesters/:semesterId/courses', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { semesterId } = req.params;
  const { courseCode, courseTitle, creditHours, courseType, syllabusOutline, assignedTeacherId } = req.body;

  if (!courseCode || !courseTitle || creditHours === undefined) {
    return res.status(400).json({ error: 'Course code, title, and credit hours are required.' });
  }

  const courseId = 'c-' + crypto.randomUUID();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, syllabus_outline)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(courseId, semesterId, courseCode.toUpperCase().trim(), courseTitle.trim(), parseFloat(creditHours), courseType || 'THEORY', syllabusOutline || null);

    // If a teacher was designated immediately
    if (assignedTeacherId) {
      db.prepare(`
        INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
        VALUES (?, ?, ?, ?)
      `).run('ca-' + crypto.randomUUID(), courseId, assignedTeacherId, req.user.id);
    }
  });

  try {
    transaction();
    return res.status(201).json({ message: `Course ${courseCode} created successfully!`, courseId });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to create course: ' + err.message });
  }
});

// Assign or Reassign Teacher to a Course (Office Staff / Admin)
router.post('/courses/:courseId/assign', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { courseId } = req.params;
  const { teacherId } = req.body;

  if (!teacherId) {
    return res.status(400).json({ error: 'Teacher ID is required.' });
  }

  // Verify teacher exists
  const teacher = db.prepare('SELECT id FROM teachers WHERE id = ?').get(teacherId);
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found.' });
  }

  const transaction = db.transaction(() => {
    // Delete existing assignment for this course
    db.prepare('DELETE FROM course_assignments WHERE course_id = ?').run(courseId);
    // Insert new assignment
    db.prepare(`
      INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
      VALUES (?, ?, ?, ?)
    `).run('ca-' + crypto.randomUUID(), courseId, teacherId, req.user.id);
  });

  try {
    transaction();
    return res.json({ message: 'Course faculty designated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to assign teacher: ' + err.message });
  }
});

// ==========================================
// 4. STUDENT REGISTRATION & ROSTER
// ==========================================

// Enroll new student under a session (Office Staff / Admin)
router.post('/sessions/:sessionId/students', authenticateUser, requireRoles(['OFFICE_STAFF', 'ADMIN']), (req, res) => {
  const { sessionId } = req.params;
  const { studentRoll, registrationNo, email, password, firstName, lastName, phoneNumber } = req.body;

  if (!studentRoll || !registrationNo || !email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'All student profile and authentication fields are required.' });
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existingEmail) {
    return res.status(400).json({ error: 'A user with this email already exists.' });
  }

  const existingRoll = db.prepare('SELECT id FROM students WHERE student_roll = ?').get(studentRoll);
  if (existingRoll) {
    return res.status(400).json({ error: 'A student with this roll number already exists.' });
  }

  const userId = 'u-' + crypto.randomUUID();
  const studentId = 's-' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, 'STUDENT', 'ACTIVE', ?, ?, ?)
    `).run(userId, email, passwordHash, firstName, lastName, phoneNumber || null);

    db.prepare(`
      INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentId, userId, studentRoll.toUpperCase().trim(), registrationNo.trim(), sessionId);
  });

  try {
    transaction();
    return res.status(201).json({ message: `Student ${firstName} ${lastName} (${studentRoll}) registered successfully!` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to enroll student: ' + err.message });
  }
});

// List students for a session
router.get('/sessions/:sessionId/students', authenticateUser, (req, res) => {
  const { sessionId } = req.params;
  const students = db.prepare(`
    SELECT s.id as student_id, s.student_roll, s.registration_no,
           u.id as user_id, u.first_name, u.last_name, u.email, u.phone_number, u.status
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.current_session_id = ?
    ORDER BY s.student_roll ASC
  `).all(sessionId);

  return res.json({ students });
});

// ==========================================
// 5. DEPARTMENT CURRICULUM & SYLLABUS OVERVIEW
// ==========================================

// Get complete department curriculum organized semester-by-semester (1st Year 1st Semester to 4th Year 2nd Semester)
router.get('/curriculum', authenticateUser, (req, res) => {
  const currentSession = db.prepare('SELECT id, session_name FROM academic_sessions WHERE is_current = 1').get()
    || db.prepare('SELECT id, session_name FROM academic_sessions ORDER BY start_date DESC LIMIT 1').get();

  const sessionId = req.query.sessionId || (currentSession ? currentSession.id : 'sess-2023-24');

  const termOrder = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];
  const semesters = db.prepare(`
    SELECT id, semester_name, term_code, is_active
    FROM semesters
    WHERE session_id = ?
  `).all(sessionId);

  semesters.sort((a, b) => {
    const idxA = termOrder.indexOf(a.term_code);
    const idxB = termOrder.indexOf(b.term_code);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    return a.semester_name.localeCompare(b.semester_name);
  });

  const result = semesters.map(sem => {
    const courses = db.prepare(`
      SELECT c.*,
             ca.teacher_id as assigned_teacher_id,
             u.first_name || ' ' || u.last_name as assigned_teacher_name,
             u.email as assigned_teacher_email,
             t.designation as assigned_teacher_designation,
             (SELECT COUNT(*) FROM course_materials WHERE course_id = c.id) as material_count
      FROM courses c
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE c.semester_id = ?
      ORDER BY c.course_code ASC
    `).all(sem.id);

    return {
      ...sem,
      semester_id: sem.id,
      courses,
      total_credits: courses.reduce((sum, c) => sum + (c.credit_hours || 0), 0)
    };
  });

  return res.json({
    session: currentSession,
    semesters: result,
    total_courses: result.reduce((sum, s) => sum + s.courses.length, 0),
    total_credits: result.reduce((sum, s) => sum + (s.total_credits || 0), 0)
  });
});

// Create new course directly under any semester (Chairman / Office Staff / Admin)
router.post('/courses', authenticateUser, requireAcademicAuthority, (req, res) => {
  const { semesterId, courseCode, courseTitle, creditHours, courseType, syllabusOutline, assignedTeacherId } = req.body;

  if (!semesterId || !courseCode || !courseTitle || creditHours === undefined) {
    return res.status(400).json({ error: 'Semester, Course Code, Title, and Credit Hours are required.' });
  }

  const courseId = 'c-' + crypto.randomUUID();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, syllabus_outline)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(courseId, semesterId, courseCode.toUpperCase().trim(), courseTitle.trim(), parseFloat(creditHours), courseType || 'THEORY', syllabusOutline || null);

    if (assignedTeacherId) {
      db.prepare(`
        INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
        VALUES (?, ?, ?, ?)
      `).run('ca-' + crypto.randomUUID(), courseId, assignedTeacherId, req.user.id);
    }
  });

  try {
    transaction();
    return res.status(201).json({
      success: true,
      message: `Course ${courseCode.toUpperCase()} (${courseTitle}) added successfully!`,
      courseId
    });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to create course: ' + err.message });
  }
});

// ==========================================
// 6. DEPARTMENT STUDENT OVERVIEW (40 SEATS CAPACITY)
// ==========================================

// Get student overview by session with 40-seat capacity metrics
router.get('/students-overview', authenticateUser, (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM students WHERE current_session_id = s.id) as enrolled_count
    FROM academic_sessions s
    ORDER BY s.start_date DESC
  `).all();

  const result = sessions.map(sess => {
    const maxSeats = 40; // CSE Dept standard intake seat capacity
    const enrolledCount = sess.enrolled_count || 0;
    const remainingSeats = Math.max(0, maxSeats - enrolledCount);

    const students = db.prepare(`
      SELECT s.id as student_id, s.student_roll, s.registration_no,
             u.id as user_id, u.first_name, u.last_name, u.email, u.phone_number, u.status, u.created_at
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.current_session_id = ?
      ORDER BY s.student_roll ASC
    `).all(sess.id);

    return {
      session_id: sess.id,
      session_name: sess.session_name,
      start_date: sess.start_date,
      end_date: sess.end_date,
      is_current: Boolean(sess.is_current),
      max_seats: maxSeats,
      enrolled_count: enrolledCount,
      remaining_seats: remainingSeats,
      fill_percentage: Math.min(100, Math.round((enrolledCount / maxSeats) * 100)),
      students
    };
  });

  return res.json({ sessions: result });
});

// Enroll / Add student to a session with strict 40-seat capacity check
router.post('/students', authenticateUser, requireAcademicAuthority, (req, res) => {
  const sessionId = req.body.sessionId || req.body.session_id;
  const studentRoll = req.body.studentRoll || req.body.student_roll;
  const registrationNo = req.body.registrationNo || req.body.registration_no || '';
  const email = req.body.email;
  const password = req.body.password;
  const firstName = req.body.firstName || req.body.first_name || '';
  const lastName = req.body.lastName || req.body.last_name || '';
  const phoneNumber = req.body.phoneNumber || req.body.phone_number || '';

  if (!sessionId || !studentRoll || !email) {
    return res.status(400).json({ error: 'Session ID, Student Roll Number, and Email are required.' });
  }

  // Check 40-seat quota limit for this session
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE current_session_id = ?').get(sessionId).count;
  if (currentCount >= 40) {
    return res.status(400).json({
      error: `Intake Quota Exceeded: This session has reached its maximum intake capacity of 40 students (40/40 seats occupied).`
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedRoll = studentRoll.toUpperCase().trim();

  // Check duplicates
  const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  if (existingEmail) {
    return res.status(400).json({ error: `A user with email "${normalizedEmail}" already exists in the system.` });
  }
  const existingRoll = db.prepare('SELECT id FROM students WHERE UPPER(student_roll) = ?').get(normalizedRoll);
  if (existingRoll) {
    return res.status(400).json({ error: `A student with roll "${normalizedRoll}" is already registered.` });
  }

  // Derive reasonable names if omitted
  let resolvedFirst = (firstName || '').trim();
  let resolvedLast = (lastName || '').trim();
  if (!resolvedFirst && !resolvedLast) {
    resolvedFirst = 'Student';
    resolvedLast = normalizedRoll;
  } else if (!resolvedFirst) {
    resolvedFirst = 'Student';
  } else if (!resolvedLast) {
    resolvedLast = 'Member';
  }

  const resolvedReg = (registrationNo || '').trim() || ('REG-' + Math.floor(10000 + Math.random() * 90000));
  const resolvedPass = (password || '').trim() || '12345678';
  const passwordHash = bcrypt.hashSync(resolvedPass, 10);

  const userId = 'u-' + crypto.randomUUID();
  const studentId = 's-' + crypto.randomUUID();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
      VALUES (?, ?, ?, 'STUDENT', 'ACTIVE', ?, ?, ?)
    `).run(userId, normalizedEmail, passwordHash, resolvedFirst, resolvedLast, phoneNumber || null);

    db.prepare(`
      INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentId, userId, normalizedRoll, resolvedReg, sessionId);
  });

  try {
    transaction();
    return res.status(201).json({
      success: true,
      message: `Student ${resolvedFirst} ${resolvedLast} (${normalizedRoll}) enrolled successfully! (${currentCount + 1}/40 Seats)`,
      student: {
        id: studentId,
        student_roll: normalizedRoll,
        registration_no: resolvedReg,
        first_name: resolvedFirst,
        last_name: resolvedLast,
        email: normalizedEmail,
        plainPassword: resolvedPass,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to enroll student: ' + err.message });
  }
});

// ==========================================
// 7. SESSION-WISE STUDENT INFORMATION SHEET (40 SEATS / CUSTOM CAPACITY)
// ==========================================

// Helper: require student sheet access
function requireStudentSheetAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const isChair = req.user.email === 'chair.cse_pust@gmail.com' || req.user.role === 'ADMIN' || (req.user.designation && req.user.designation.toLowerCase().includes('chair'));
  if (['OFFICE_STAFF', 'ADMIN', 'TEACHER'].includes(req.user.role) || isChair) {
    return next();
  }
  return res.status(403).json({ error: 'Access Denied: Only Department Faculty, Chairman, or Academic Office Staff can edit student records.' });
}

// 1. GET full student sheet for a session
router.get('/sessions/:sessionId/student-sheet', authenticateUser, (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const students = db.prepare(`
      SELECT s.id as student_id,
             s.serial_no,
             s.student_roll,
             s.registration_no,
             s.father_name,
             s.father_contact,
             s.mother_name,
             s.address,
             s.created_at as student_created_at,
             u.id as user_id,
             u.first_name,
             u.last_name,
             TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) as student_name,
             u.email,
             u.phone_number as contact_no,
             u.status as user_status
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.current_session_id = ?
      ORDER BY 
        CASE WHEN s.serial_no IS NOT NULL AND s.serial_no > 0 THEN s.serial_no ELSE 999999 END ASC,
        s.student_roll ASC
    `).all(sessionId);

    return res.json({
      session,
      students,
      total_enrolled: students.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch student sheet: ' + err.message });
  }
});

// 2. UPSERT single student row in the session sheet
router.post('/sessions/:sessionId/student-sheet/row', authenticateUser, requireStudentSheetAccess, (req, res) => {
  const { sessionId } = req.params;
  const {
    studentId,
    serialNo,
    studentRoll,
    registrationNo,
    studentName,
    contactNo,
    fatherName,
    fatherContact,
    motherName,
    address
  } = req.body;

  if (!studentRoll || !studentRoll.toString().trim()) {
    return res.status(400).json({ error: 'Roll number is required.' });
  }

  const cleanRoll = studentRoll.toString().trim().toUpperCase();
  const cleanReg = (registrationNo || '').toString().trim();
  const cleanSerial = serialNo !== undefined && serialNo !== null && serialNo !== '' ? parseInt(serialNo, 10) : null;
  const cleanContact = (contactNo || '').toString().trim();
  const cleanFatherName = (fatherName || '').toString().trim();
  const cleanFatherContact = (fatherContact || '').toString().trim();
  const cleanMotherName = (motherName || '').toString().trim();
  const cleanAddress = (address || '').toString().trim();

  // Parse Student Name into firstName & lastName
  let rawName = (studentName || '').toString().trim();
  let firstName = rawName;
  let lastName = '';
  if (rawName.includes(' ')) {
    const parts = rawName.split(/\s+/);
    lastName = parts.pop();
    firstName = parts.join(' ');
  } else if (!rawName) {
    firstName = 'Student';
    lastName = cleanRoll;
  }

  try {
    const session = db.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    let existingStudent = null;
    if (studentId) {
      existingStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    }
    if (!existingStudent) {
      // Check if student with this roll already exists in this session
      existingStudent = db.prepare('SELECT * FROM students WHERE UPPER(student_roll) = ? AND current_session_id = ?').get(cleanRoll, sessionId);
    }
    if (!existingStudent) {
      // If student with this roll exists in the system, adopt and update them for this session
      existingStudent = db.prepare('SELECT * FROM students WHERE UPPER(student_roll) = ?').get(cleanRoll);
    }

    // Check roll collision with a different student record
    if (existingStudent) {
      const rollConflict = db.prepare('SELECT id FROM students WHERE UPPER(student_roll) = ? AND id != ?').get(cleanRoll, existingStudent.id);
      if (rollConflict) {
        return res.status(400).json({ error: `Roll "${cleanRoll}" is already assigned to another student in the system.` });
      }
    }

    let savedStudentId = existingStudent ? existingStudent.id : null;

    const transaction = db.transaction(() => {
      if (existingStudent) {
        // UPDATE existing student
        db.prepare(`
          UPDATE students
          SET serial_no = ?,
              student_roll = ?,
              registration_no = ?,
              current_session_id = ?,
              father_name = ?,
              father_contact = ?,
              mother_name = ?,
              address = ?
          WHERE id = ?
        `).run(
          cleanSerial,
          cleanRoll,
          cleanReg || existingStudent.registration_no,
          sessionId,
          cleanFatherName,
          cleanFatherContact,
          cleanMotherName,
          cleanAddress,
          existingStudent.id
        );

        // UPDATE corresponding user record so names and phones sync everywhere
        db.prepare(`
          UPDATE users
          SET first_name = ?,
              last_name = ?,
              phone_number = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          firstName,
          lastName,
          cleanContact || null,
          existingStudent.user_id
        );
        savedStudentId = existingStudent.id;
      } else {
        // INSERT new student
        const newUserId = 'u-' + crypto.randomUUID();
        const newStudentId = 's-' + crypto.randomUUID();
        const baseEmail = `${cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '')}@cse.pust.ac.bd`;
        let finalEmail = baseEmail;
        const emailCheck = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(finalEmail);
        if (emailCheck) {
          finalEmail = `${cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@cse.pust.ac.bd`;
        }

        db.prepare(`
          INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
          VALUES (?, ?, ?, 'STUDENT', 'ACTIVE', ?, ?, ?)
        `).run(
          newUserId,
          finalEmail,
          bcrypt.hashSync('12345678', 10),
          firstName,
          lastName,
          cleanContact || null
        );

        db.prepare(`
          INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id, serial_no, father_name, father_contact, mother_name, address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newStudentId,
          newUserId,
          cleanRoll,
          cleanReg || ('REG-' + Math.floor(100000 + Math.random() * 900000)),
          sessionId,
          cleanSerial,
          cleanFatherName,
          cleanFatherContact,
          cleanMotherName,
          cleanAddress
        );
        savedStudentId = newStudentId;
      }
    });

    transaction();

    // Fetch the updated student row to return immediately
    const row = db.prepare(`
      SELECT s.id as student_id,
             s.serial_no,
             s.student_roll,
             s.registration_no,
             s.father_name,
             s.father_contact,
             s.mother_name,
             s.address,
             u.id as user_id,
             u.first_name,
             u.last_name,
             TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) as student_name,
             u.email,
             u.phone_number as contact_no
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).get(savedStudentId);

    return res.json({
      message: `Student ${cleanRoll} saved successfully!`,
      student: row
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save student: ' + err.message });
  }
});

// 3. BATCH SAVE / UPDATE multiple student rows in the session sheet
router.post('/sessions/:sessionId/student-sheet/batch', authenticateUser, requireStudentSheetAccess, (req, res) => {
  const { sessionId } = req.params;
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No student rows provided to save.' });
  }

  const session = db.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  let savedCount = 0;

  const transaction = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.studentRoll || !r.studentRoll.toString().trim()) {
        continue; // skip completely empty slot rows
      }

      const cleanRoll = r.studentRoll.toString().trim().toUpperCase();
      const cleanReg = (r.registrationNo || '').toString().trim();
      const cleanSerial = r.serialNo !== undefined && r.serialNo !== null && r.serialNo !== '' ? parseInt(r.serialNo, 10) : (i + 1);
      const cleanContact = (r.contactNo || '').toString().trim();
      const cleanFatherName = (r.fatherName || '').toString().trim();
      const cleanFatherContact = (r.fatherContact || '').toString().trim();
      const cleanMotherName = (r.motherName || '').toString().trim();
      const cleanAddress = (r.address || '').toString().trim();

      let rawName = (r.studentName || '').toString().trim();
      let firstName = rawName;
      let lastName = '';
      if (rawName.includes(' ')) {
        const parts = rawName.split(/\s+/);
        lastName = parts.pop();
        firstName = parts.join(' ');
      } else if (!rawName) {
        firstName = 'Student';
        lastName = cleanRoll;
      }

      let existing = null;
      if (r.studentId) {
        existing = db.prepare('SELECT * FROM students WHERE id = ?').get(r.studentId);
      }
      if (!existing) {
        existing = db.prepare('SELECT * FROM students WHERE UPPER(student_roll) = ? AND current_session_id = ?').get(cleanRoll, sessionId);
      }
      if (!existing) {
        existing = db.prepare('SELECT * FROM students WHERE UPPER(student_roll) = ?').get(cleanRoll);
      }

      if (existing) {
        // Update existing record
        db.prepare(`
          UPDATE students
          SET serial_no = ?,
              student_roll = ?,
              registration_no = ?,
              current_session_id = ?,
              father_name = ?,
              father_contact = ?,
              mother_name = ?,
              address = ?
          WHERE id = ?
        `).run(
          cleanSerial,
          cleanRoll,
          cleanReg || existing.registration_no,
          sessionId,
          cleanFatherName,
          cleanFatherContact,
          cleanMotherName,
          cleanAddress,
          existing.id
        );

        db.prepare(`
          UPDATE users
          SET first_name = ?,
              last_name = ?,
              phone_number = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          firstName,
          lastName,
          cleanContact || null,
          existing.user_id
        );
        savedCount++;
      } else {
        // Insert new record
        const newUserId = 'u-' + crypto.randomUUID();
        const newStudentId = 's-' + crypto.randomUUID();
        let finalEmail = `${cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '')}@cse.pust.ac.bd`;
        const emailCheck = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(finalEmail);
        if (emailCheck) {
          finalEmail = `${cleanRoll.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@cse.pust.ac.bd`;
        }

        db.prepare(`
          INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
          VALUES (?, ?, ?, 'STUDENT', 'ACTIVE', ?, ?, ?)
        `).run(
          newUserId,
          finalEmail,
          bcrypt.hashSync('12345678', 10),
          firstName,
          lastName,
          cleanContact || null
        );

        db.prepare(`
          INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id, serial_no, father_name, father_contact, mother_name, address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newStudentId,
          newUserId,
          cleanRoll,
          cleanReg || ('REG-' + Math.floor(100000 + Math.random() * 900000)),
          sessionId,
          cleanSerial,
          cleanFatherName,
          cleanFatherContact,
          cleanMotherName,
          cleanAddress
        );
        savedCount++;
      }
    }
  });

  try {
    transaction();
    return res.json({
      message: `Batch update successful: saved ${savedCount} student records.`,
      savedCount
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to batch save student sheet: ' + err.message });
  }
});

// 4. CLEAR / DELETE a student row from the session sheet
router.delete('/sessions/:sessionId/student-sheet/:studentId', authenticateUser, requireStudentSheetAccess, (req, res) => {
  const { sessionId, studentId } = req.params;
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND current_session_id = ?').get(studentId, sessionId);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found in this session.' });
    }

    const transaction = db.transaction(() => {
      // Clean up CT marks
      db.prepare('DELETE FROM ct_marks WHERE student_id = ?').run(studentId);
      // Clean up enrollments
      db.prepare('DELETE FROM course_enrollments WHERE student_id = ?').run(studentId);
      // Clean up results
      db.prepare('DELETE FROM student_results WHERE student_id = ?').run(studentId);
      // Clean up student profile
      db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
      // Clean up user account
      db.prepare('DELETE FROM users WHERE id = ?').run(student.user_id);
    });

    transaction();
    return res.json({ message: `Student (${student.student_roll}) cleared from session successfully.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete student: ' + err.message });
  }
});

// ==========================================
// 8. PUST CSE FACULTY MEMBERS & COURSES BREAKDOWN (SYNCED WITH PUST OFFICIAL PORTAL)
// ==========================================

// Get all faculty members with Department Courses, Non-Department Courses, Staff & Live Sync Metadata
router.get('/faculty-courses', (req, res) => {
  try {
    const teachers = db.prepare(`
      SELECT t.*,
             u.first_name, u.last_name, u.email, u.phone_number, u.status as user_status
      FROM teachers t
      JOIN users u ON u.id = t.user_id
      WHERE (t.profile_id IS NOT NULL OR t.id LIKE 't-100%')
        AND u.status = 'ACTIVE'
      ORDER BY 
        CASE 
          WHEN t.designation LIKE '%Chairman%' THEN 1
          WHEN t.designation LIKE '%Professor%' AND t.designation NOT LIKE '%Associate%' AND t.designation NOT LIKE '%Assistant%' THEN 2
          WHEN t.designation LIKE '%Associate Professor%' THEN 3
          WHEN t.designation LIKE '%Assistant Professor%' THEN 4
          ELSE 5
        END ASC,
        t.publications_count DESC
    `).all();

    const coursesStmt = db.prepare(`
      SELECT * FROM teacher_courses
      WHERE teacher_id = ?
      ORDER BY is_current DESC, course_code ASC
    `);

    const result = teachers.map(teacher => {
      const allCourses = coursesStmt.all(teacher.id);
      const currentCourses = allCourses.filter(c => c.is_current === 1);
      const previousCourses = allCourses.filter(c => c.is_current === 0);

      const deptCourses = currentCourses.filter(c => c.course_type === 'DEPARTMENT');
      const nonDeptCourses = currentCourses.filter(c => c.course_type === 'NON_DEPARTMENT');

      return {
        ...teacher,
        fullName: `${teacher.first_name} ${teacher.last_name}`.trim(),
        currentCourses,
        deptCourses,
        nonDeptCourses,
        previousCourses
      };
    });

    // Also fetch Academic Department Staff members
    const staffMembers = db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.role, u.status, u.created_at,
             'Academic Support & Department Operations' as designation,
             'CSE Department Office, Room 401' as office_location
      FROM users u
      WHERE u.role = 'OFFICE_STAFF' AND u.status = 'ACTIVE'
      ORDER BY u.first_name ASC
    `).all();

    return res.json({
      faculty: result,
      staff: staffMembers,
      departmentGlance: {
        departmentName: 'Department of Computer Science and Engineering',
        university: 'Pabna University of Science and Technology',
        officePhone: '+8802588844876',
        officeEmail: 'cse@pust.ac.bd',
        totalTeachers: result.length,
        totalStaff: staffMembers.length,
        portalUrl: 'https://pust.ac.bd/academic/departments/dept_teachers/D01'
      },
      syncInfo: getSyncStatus()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch faculty courses: ' + err.message });
  }
});

// Trigger 1-Click On-Demand Sync from PUST External Website
router.post('/sync-pust-teachers', async (req, res) => {
  try {
    const syncResult = await syncPustTeachersToDatabase();
    return res.json({
      message: `Successfully synchronized ${syncResult.totalSynced} CSE faculty members from PUST Official Portal (D01)!`,
      syncInfo: getSyncStatus(),
      teachers: syncResult.teachers
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to synchronize faculty from PUST portal: ' + err.message });
  }
});

// Get Live Sync Status
router.get('/pust-sync-status', (req, res) => {
  return res.json({ syncInfo: getSyncStatus() });
});

// Update a teacher's course deadline or schedule
router.put('/faculty-courses/:id', authenticateUser, (req, res) => {
  const { classEndDate, weeklySchedule, targetDept } = req.body;
  const courseId = req.params.id;

  try {
    db.prepare(`
      UPDATE teacher_courses
      SET class_end_date = COALESCE(?, class_end_date),
          weekly_schedule = COALESCE(?, weekly_schedule),
          target_dept = COALESCE(?, target_dept)
      WHERE id = ?
    `).run(classEndDate || null, weeklySchedule || null, targetDept || null, courseId);

    return res.json({ message: 'Course schedule updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update course schedule: ' + err.message });
  }
});

// ==========================================
// 8. CONTINUOUS ASSESSMENT PIPELINE & MARKS MATRIX
// ==========================================

// Helper: Calculate grade from percentage (PUST Grading Ordinance)
// Helper: Calculate standard course grade from total marks out of 100
function calculateGrade(totalMarks) {
  const marks = Math.max(0, Math.min(100, Math.round(Number(totalMarks) * 10) / 10));
  if (marks >= 80.0) return { letterGrade: 'A+', gradePoint: 4.00, isPassed: true };
  if (marks >= 75.0) return { letterGrade: 'A',  gradePoint: 3.75, isPassed: true };
  if (marks >= 70.0) return { letterGrade: 'A-', gradePoint: 3.50, isPassed: true };
  if (marks >= 65.0) return { letterGrade: 'B+', gradePoint: 3.25, isPassed: true };
  if (marks >= 60.0) return { letterGrade: 'B',  gradePoint: 3.00, isPassed: true };
  if (marks >= 55.0) return { letterGrade: 'B-', gradePoint: 2.75, isPassed: true };
  if (marks >= 50.0) return { letterGrade: 'C+', gradePoint: 2.50, isPassed: true };
  if (marks >= 45.0) return { letterGrade: 'C',  gradePoint: 2.25, isPassed: true };
  if (marks >= 40.0) return { letterGrade: 'D',  gradePoint: 2.00, isPassed: true };
  return { letterGrade: 'F', gradePoint: 0.00, isPassed: false };
}

// Helper: Calculate grade from percentage (PUST Grading Ordinance: Engineering Scale)
function calculatePUSTGrade(percentage) {
  if (percentage >= 80.0) return { grade: 'A+', gpa: 4.00, status: 'EXCELLENT' };
  if (percentage >= 75.0) return { grade: 'A',  gpa: 3.75, status: 'VERY_GOOD' };
  if (percentage >= 70.0) return { grade: 'A-', gpa: 3.50, status: 'GOOD' };
  if (percentage >= 65.0) return { grade: 'B+', gpa: 3.25, status: 'SATISFACTORY' };
  if (percentage >= 60.0) return { grade: 'B',  gpa: 3.00, status: 'ABOVE_AVERAGE' };
  if (percentage >= 55.0) return { grade: 'B-', gpa: 2.75, status: 'AVERAGE' };
  if (percentage >= 50.0) return { grade: 'C+', gpa: 2.50, status: 'PASS' };
  if (percentage >= 45.0) return { grade: 'C',  gpa: 2.25, status: 'PASS' };
  if (percentage >= 40.0) return { grade: 'D',  gpa: 2.00, status: 'MARGINAL' };
  return { grade: 'F', gpa: 0.00, status: 'FAIL' };
}

// Helper: Resolve course teacher assignment from Routine / course_assignments / teacher_courses
function resolveCourseTeacher(courseId, courseCode, sessionName) {
  // 1. Direct course_assignments lookup
  let ca = db.prepare(`
    SELECT ca.teacher_id, t.user_id, t.designation, COALESCE(t.department_code, 'CSE') as department,
           t.room_number, t.photo_url, t.bio, t.research_area,
           u.first_name || ' ' || u.last_name as teacher_name, u.email as teacher_email, u.phone_number
    FROM course_assignments ca
    JOIN teachers t ON t.id = ca.teacher_id
    JOIN users u ON u.id = t.user_id
    WHERE ca.course_id = ?
    LIMIT 1
  `).get(courseId);

  if (ca) return ca;

  // 2. Lookup teacher_courses (assigned via Routine module or official portal sync)
  if (courseCode) {
    let tc = db.prepare(`
      SELECT tc.teacher_id, t.user_id, t.designation, COALESCE(t.department_code, 'CSE') as department,
             t.room_number, t.photo_url, t.bio, t.research_area,
             u.first_name || ' ' || u.last_name as teacher_name, u.email as teacher_email, u.phone_number
      FROM teacher_courses tc
      JOIN teachers t ON t.id = tc.teacher_id
      JOIN users u ON u.id = t.user_id
      WHERE UPPER(tc.course_code) = UPPER(?) AND (tc.session_name = ? OR tc.is_current = 1)
      ORDER BY tc.is_current DESC
      LIMIT 1
    `).get(courseCode, sessionName || '');

    if (tc) {
      // Auto-synchronize into course_assignments to keep single source of truth permanently linked
      try {
        db.prepare(`
          INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(course_id, teacher_id) DO NOTHING
        `).run('ca-' + crypto.randomUUID(), courseId, tc.teacher_id, 'u-admin');
      } catch (e) { /* ignore */ }
      return tc;
    }
  }

  return null;
}

// 8a. GET ALL SESSIONS WITH RUNNING SEMESTER IDENTIFICATION (Dynamic from DB)
router.get('/continuous-assessment/sessions', authenticateUser, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT s.id, s.session_name, s.start_date, s.end_date, s.is_current,
             (SELECT COUNT(DISTINCT c.id) FROM courses c JOIN semesters sem ON sem.id = c.semester_id WHERE sem.session_id = s.id) as course_count,
             (SELECT COUNT(DISTINCT st.id) FROM students st WHERE st.current_session_id = s.id) as student_count,
             (SELECT COUNT(DISTINCT ca.teacher_id) FROM courses c JOIN semesters sem ON sem.id = c.semester_id JOIN course_assignments ca ON ca.course_id = c.id WHERE sem.session_id = s.id) as teacher_count,
             (SELECT COUNT(DISTINCT m.id) FROM ct_marks m JOIN courses c ON c.id = m.course_id JOIN semesters sem ON sem.id = c.semester_id WHERE sem.session_id = s.id) as assessed_marks_count
      FROM academic_sessions s
    `).all();

    // Identify currently running semester for each session dynamically from DB
    const enriched = sessions.map(s => {
      // Fetch all semesters for this session
      const semesters = db.prepare(`
        SELECT id, semester_name, term_code, year, semester, start_date, end_date, class_end_date, assessment_deadline, status, is_active, is_finalized, is_published, published_at
        FROM semesters
        WHERE session_id = ?
        ORDER BY term_code DESC
      `).all(s.id);

      // Prioritize running or active semester
      let runningSem = semesters.find(sem => sem.status === 'Running' || sem.is_active === 1);
      if (!runningSem && semesters.length > 0) {
        // Fallback: latest semester in session
        runningSem = semesters[0];
      }

      // Check overall publication / archive status of session
      const hasPublished = semesters.some(sem => sem.status === 'Result Published' || sem.is_published === 1);
      const allArchived = semesters.length > 0 && semesters.every(sem => sem.status === 'Archived');
      const isHistorical = !s.is_current && (hasPublished || allArchived);

      let publicationStatus = 'Draft / In Progress';
      if (allArchived) publicationStatus = 'Archived';
      else if (hasPublished) publicationStatus = 'Result Published';
      else if (s.is_current) publicationStatus = 'Active Semester';

      let completionStatus = 'Not Started';
      if (s.assessed_marks_count > 0) {
        completionStatus = s.assessed_marks_count > 50 ? 'Evaluation Complete' : 'In Progress';
      }

      return {
        ...s,
        assigned_teachers_count: s.teacher_count || 0,
        runningSemester: runningSem ? `${runningSem.semester_name} — ${runningSem.status || 'Running'}` : 'No Active Semester',
        running_semester_id: runningSem?.id || null,
        running_semester_name: runningSem?.semester_name || 'No Semester Defined',
        running_semester_term_code: runningSem?.term_code || '',
        running_semester_status: runningSem?.status || (s.is_current ? 'Running' : 'Archived'),
        running_semester_start_date: runningSem?.start_date || s.start_date,
        running_semester_end_date: runningSem?.class_end_date || runningSem?.end_date || s.end_date,
        assessment_deadline: runningSem?.assessment_deadline || null,
        is_historical: isHistorical,
        publication_status: publicationStatus,
        publicationStatus: publicationStatus,
        completion_status: completionStatus,
        completionStatus: completionStatus,
        total_semesters_count: semesters.length
      };
    });

    // Sort strictly by session starting year descending (e.g. 2024-2025, 2023-2024, 2022-2023)
    const sorted = [...enriched].sort((a, b) => {
      if (a.is_current && !b.is_current) return -1;
      if (!a.is_current && b.is_current) return 1;

      const yearA = parseInt((a.session_name.match(/(\d{4})/) || [0, 0])[1]) || (a.start_date ? parseInt(a.start_date.slice(0, 4)) : 0);
      const yearB = parseInt((b.session_name.match(/(\d{4})/) || [0, 0])[1]) || (b.start_date ? parseInt(b.start_date.slice(0, 4)) : 0);
      return yearB - yearA;
    });

    return res.json({ sessions: sorted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch assessment sessions: ' + err.message });
  }
});

// 8b. CREATE / START NEW ACADEMIC SESSION
router.post('/continuous-assessment/sessions', authenticateUser, (req, res) => {
  const { sessionName, startDate, endDate, isCurrent } = req.body;

  if (!sessionName || !sessionName.trim()) {
    return res.status(400).json({ error: 'Session name is required.' });
  }

  try {
    const session = ensureSessionWithStandardCourses(sessionName.trim(), startDate, endDate, Boolean(isCurrent));
    return res.status(201).json({
      message: `Academic Session '${session.session_name}' initialized successfully!`,
      session
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create session: ' + err.message });
  }
});

// 8c. CREATE SEMESTER FEATURE (With duplicate validation, auto curriculum courses & Routine teacher linking)
router.post('/continuous-assessment/semesters', authenticateUser, requireAcademicAuthority, (req, res) => {
  const {
    sessionId,
    year,
    semester,
    startDate,
    classEndDate,
    assessmentDeadline,
    status = 'Running',
    notes = '',
    academicYear = ''
  } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session selection is required.' });
  }
  const yearNum = parseInt(year);
  const semNum = parseInt(semester);
  if (![1, 2, 3, 4].includes(yearNum) || ![1, 2].includes(semNum)) {
    return res.status(400).json({ error: 'Valid Year (1-4) and Semester (1-2) are required.' });
  }
  if (!startDate) {
    return res.status(400).json({ error: 'Semester start date is required.' });
  }

  const session = db.prepare('SELECT id, session_name FROM academic_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Selected academic session does not exist.' });
  }

  const termCode = `Y${yearNum}S${semNum}`;
  const yearLabels = ['1st', '2nd', '3rd', '4th'];
  const semLabels = ['1st', '2nd'];
  const semesterName = `${yearLabels[yearNum - 1]} Year ${semLabels[semNum - 1]} Semester`;

  // 1. Prevent duplicate semester records for the same session, year, and semester
  const existing = db.prepare(`
    SELECT id, semester_name FROM semesters
    WHERE session_id = ? AND (term_code = ? OR (year = ? AND semester = ?))
  `).get(sessionId, termCode, yearNum, semNum);

  if (existing) {
    return res.status(400).json({
      error: `A semester record for '${semesterName}' already exists in ${session.session_name}.`
    });
  }

  const semesterId = 'sem-' + crypto.randomUUID();

  const transaction = db.transaction(() => {
    // If setting to Running, update other semesters in this session if needed
    if (status === 'Running') {
      db.prepare('UPDATE semesters SET is_active = 0 WHERE session_id = ?').run(sessionId);
    }

    db.prepare(`
      INSERT INTO semesters (
        id, session_id, semester_name, term_code, year, semester,
        start_date, end_date, class_end_date, assessment_deadline,
        status, notes, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      semesterId,
      sessionId,
      semesterName,
      termCode,
      yearNum,
      semNum,
      startDate,
      classEndDate || null,
      classEndDate || null,
      assessmentDeadline || null,
      status,
      notes,
      status === 'Running' ? 1 : 0
    );

    // 2. Automatically load standard curriculum courses for this specific Year & Semester
    const standardCourses = CURRICULUM_COURSES.filter(c => c.termCode === termCode || (c.year === yearNum && c.semester === semNum));
    const insertCourse = db.prepare(`
      INSERT INTO courses (
        id, semester_id, course_code, course_title, credit_hours, course_type,
        year, semester, term_code, is_optional, elective_group, syllabus_outline
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(semester_id, course_code) DO NOTHING
    `);

    for (const c of standardCourses) {
      const cid = 'c-' + crypto.randomUUID();
      insertCourse.run(
        cid,
        semesterId,
        c.courseCode,
        c.courseTitle,
        c.creditHours,
        c.courseType || 'Theory',
        yearNum,
        semNum,
        termCode,
        c.isOptional ? 1 : 0,
        c.electiveGroup || null,
        c.syllabusOutline || ''
      );

      // Check if a teacher was already assigned for this course in the Routine module
      resolveCourseTeacher(cid, c.courseCode, session.session_name);
    }
  });

  try {
    transaction();

    const createdSemester = db.prepare(`
      SELECT sem.*, 
             (SELECT COUNT(*) FROM courses WHERE semester_id = sem.id) as course_count
      FROM semesters sem
      WHERE sem.id = ?
    `).get(semesterId);

    return res.status(201).json({
      message: `Semester '${semesterName}' successfully created with ${createdSemester.course_count} curriculum courses!`,
      semester: createdSemester
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create semester: ' + err.message });
  }
});

// 8d. GET ALL SEMESTERS UNDER A SESSION
router.get('/continuous-assessment/sessions/:sessionId/semesters', authenticateUser, (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = db.prepare('SELECT id, session_name FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const semesters = db.prepare(`
      SELECT sem.id, sem.session_id, sem.semester_name, sem.term_code,
             COALESCE(sem.year, CAST(SUBSTR(sem.term_code, 2, 1) AS INTEGER)) as year,
             COALESCE(sem.semester, CAST(SUBSTR(sem.term_code, 4, 1) AS INTEGER)) as semester,
             sem.start_date, sem.end_date, sem.class_end_date, sem.assessment_deadline,
             COALESCE(sem.status, 'Running') as status, sem.notes,
             sem.is_active, sem.is_finalized, sem.is_published, sem.published_at,
             (SELECT COUNT(*) FROM courses WHERE semester_id = sem.id) as course_count,
             (SELECT COUNT(DISTINCT ca.teacher_id) FROM courses c JOIN course_assignments ca ON ca.course_id = c.id WHERE c.semester_id = sem.id) as assigned_teacher_count,
             (SELECT COUNT(DISTINCT m.student_id) FROM ct_marks m JOIN courses c ON c.id = m.course_id WHERE c.semester_id = sem.id) as assessed_students_count
      FROM semesters sem
      WHERE sem.session_id = ?
      ORDER BY sem.term_code ASC
    `).all(sessionId);

    return res.json({ session, semesters });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch semesters: ' + err.message });
  }
});

// 8e. GET COURSES FOR A SESSION / SEMESTER (Connected directly to Routine assignments)
router.get('/continuous-assessment/sessions/:sessionId/courses', authenticateUser, (req, res) => {
  const { sessionId } = req.params;
  const { semesterId } = req.query;
  const user = req.user;

  try {
    const session = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const termOrder = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];

    let query = `
      SELECT c.id, c.course_code, c.course_title, c.credit_hours, c.course_type, c.syllabus_outline,
             sem.id as semester_id, sem.semester_name, sem.term_code,
             COALESCE(sem.status, 'Running') as semester_status,
             sem.class_end_date, sem.assessment_deadline,
             ca.teacher_id as assigned_teacher_id,
             t.user_id as teacher_user_id,
             u.first_name || ' ' || u.last_name as assigned_teacher_name,
             u.email as assigned_teacher_email,
             u.phone_number as assigned_teacher_phone,
             t.designation as assigned_teacher_designation,
             COALESCE(t.department_code, 'CSE') as assigned_teacher_department,
             t.room_number as assigned_teacher_room,
             cas.status as assessment_status,
             cas.final_max_marks,
             cas.is_finalized,
             cas.is_published,
             cas.published_at,
             (SELECT COUNT(*) FROM students WHERE current_session_id = sem.session_id) as enrolled_students_count,
             (SELECT COUNT(DISTINCT student_id) FROM ct_marks WHERE course_id = c.id) as assessed_students_count
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN course_assessments cas ON cas.course_id = c.id AND cas.semester_id = sem.id
      WHERE sem.session_id = ?
    `;

    const params = [sessionId];
    if (semesterId && semesterId !== 'ALL') {
      query += ` AND sem.id = ?`;
      params.push(semesterId);
    }

    const rawCourses = db.prepare(query).all(...params);

    // Resolve teacher assignments dynamically from Routine module if course_assignments row wasn't yet created
    const courses = rawCourses.map(c => {
      let teacherInfo = null;
      if (!c.assigned_teacher_id) {
        teacherInfo = resolveCourseTeacher(c.id, c.course_code, session.session_name);
      }

      const teacherId = c.assigned_teacher_id || teacherInfo?.teacher_id || null;
      const teacherUserId = c.teacher_user_id || teacherInfo?.user_id || null;
      const teacherName = c.assigned_teacher_name || teacherInfo?.teacher_name || null;
      const teacherDesignation = c.assigned_teacher_designation || teacherInfo?.designation || null;
      const teacherDepartment = c.assigned_teacher_department || teacherInfo?.department || 'CSE';
      const teacherRoom = c.assigned_teacher_room || teacherInfo?.room_number || null;
      const teacherEmail = c.assigned_teacher_email || teacherInfo?.teacher_email || null;
      const teacherPhone = c.assigned_teacher_phone || teacherInfo?.phone_number || null;

      const isAssigned = Boolean(teacherId && teacherName && teacherName !== 'Not Assigned');

      // Authorization & Editability Check
      const effectiveStatus = c.assessment_status || c.semester_status || 'Running';
      const isLocked = ['Finalized', 'Result Published', 'Archived'].includes(effectiveStatus);

      const isUserTeacher = Boolean(
        (user.teacherId && user.teacherId === teacherId) ||
        (user.id && user.id === teacherUserId) ||
        (user.email && user.email.toLowerCase() === teacherEmail?.toLowerCase())
      );

      // Teacher can edit ONLY if assigned AND assessment is not locked
      const canEdit = Boolean(isAssigned && isUserTeacher && !isLocked);

      return {
        ...c,
        assigned_teacher_id: teacherId,
        teacher_user_id: teacherUserId,
        assigned_teacher_name: isAssigned ? teacherName : null,
        assigned_teacher_designation: isAssigned ? teacherDesignation : null,
        assigned_teacher_department: isAssigned ? teacherDepartment : null,
        assigned_teacher_room: teacherRoom,
        assigned_teacher_email: teacherEmail,
        assigned_teacher_phone: teacherPhone,
        is_assigned: isAssigned,
        is_user_assigned_teacher: isUserTeacher,
        is_locked: isLocked,
        status: effectiveStatus,
        can_edit: canEdit
      };
    });

    // Sort by term code and course code
    courses.sort((a, b) => {
      const idxA = termOrder.indexOf(a.term_code);
      const idxB = termOrder.indexOf(b.term_code);
      if (idxA !== idxB && idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.course_code.localeCompare(b.course_code);
    });

    // Separate into Assigned courses (ready for assessment) and Unassigned courses (need Routine allocation)
    const assignedCourses = courses.filter(c => c.is_assigned);
    const unassignedCourses = courses.filter(c => !c.is_assigned);

    return res.json({
      session,
      courses,
      assignedCourses,
      unassignedCourses,
      total_courses: courses.length,
      assigned_count: assignedCourses.length,
      unassigned_count: unassignedCourses.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch session courses: ' + err.message });
  }
});

// 8f. GET SPREADSHEET ASSESSMENT SHEET FOR A COURSE (Strict Roster, CA Calculation, Ranks & Access Control)
router.get('/continuous-assessment/courses/:courseId/marks', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  try {
    const course = db.prepare(`
      SELECT c.*,
             sem.session_id, sem.semester_name, sem.term_code,
             COALESCE(sem.status, 'Running') as semester_status,
             sem.class_end_date, sem.assessment_deadline,
             s.session_name,
             ca.teacher_id as assigned_teacher_id,
             t.user_id as teacher_user_id,
             u.first_name || ' ' || u.last_name as assigned_teacher_name,
             u.email as assigned_teacher_email,
             u.phone_number as assigned_teacher_phone,
             t.designation as assigned_teacher_designation,
             COALESCE(t.department_code, 'CSE') as assigned_teacher_department,
             t.room_number as assigned_teacher_room,
             cas.status as assessment_status,
             cas.final_max_marks,
             cas.is_finalized,
             cas.is_published,
             cas.published_at,
             cas.submitted_at
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      JOIN academic_sessions s ON s.id = sem.session_id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN course_assessments cas ON cas.course_id = c.id AND cas.semester_id = sem.id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Resolve teacher assignment from Routine / teacher_courses if missing
    let teacherId = course.assigned_teacher_id;
    let teacherUserId = course.teacher_user_id;
    let teacherName = course.assigned_teacher_name;
    let teacherEmail = course.assigned_teacher_email;

    if (!teacherId) {
      const resolved = resolveCourseTeacher(course.id, course.course_code, course.session_name);
      if (resolved) {
        teacherId = resolved.teacher_id;
        teacherUserId = resolved.user_id;
        teacherName = resolved.teacher_name;
        teacherEmail = resolved.teacher_email;
        course.assigned_teacher_id = teacherId;
        course.teacher_user_id = teacherUserId;
        course.assigned_teacher_name = teacherName;
        course.assigned_teacher_designation = resolved.designation;
        course.assigned_teacher_department = resolved.department;
        course.assigned_teacher_room = resolved.room_number;
      }
    }

    const effectiveStatus = course.assessment_status || course.semester_status || 'Running';
    const isLocked = ['Finalized', 'Result Published', 'Archived'].includes(effectiveStatus);

    // Strict Teacher Ownership Check
    const isAssigned = Boolean(
      (user.teacherId && user.teacherId === teacherId) ||
      (user.id && user.id === teacherUserId) ||
      (user.email && user.email.toLowerCase() === teacherEmail?.toLowerCase())
    );

    // Editing permission: ONLY assigned teacher while not locked!
    // Admins can view everything, but cannot edit teacher marks unless explicitly authorized in settings
    const canEdit = Boolean(isAssigned && !isLocked);

    // Fetch all enrolled students from Student Information for this session
    const students = db.prepare(`
      SELECT st.id as student_id, st.student_roll, st.registration_no,
             u.first_name || ' ' || u.last_name as student_name,
             u.email as student_email
      FROM students st
      JOIN users u ON u.id = st.user_id
      WHERE st.current_session_id = ?
      ORDER BY st.student_roll ASC
    `).all(course.session_id);

    // Fetch all existing marks for this course:
    // CT 1, 2, 3 = ct_number 1, 2, 3
    // Attendance = ct_number 4
    // Final Theory = ct_number 5
    const marks = db.prepare(`
      SELECT m.*, u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ct_marks m
      LEFT JOIN teachers t ON t.id = m.recorded_by
      LEFT JOIN users u ON u.id = t.user_id
      WHERE m.course_id = ?
    `).all(courseId);

    const marksByStudent = {};
    for (const m of marks) {
      if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = {};
      marksByStudent[m.student_id][m.ct_number] = {
        obtained: m.obtained_marks,
        max: m.max_marks,
        remarks: m.remarks || ''
      };
    }

    const finalMaxMarks = parseFloat(course.final_max_marks || 70.0);

    // Build Student Assessment Rows
    const rawMatrix = students.map(st => {
      const sm = marksByStudent[st.student_id] || {};
      const ct1 = sm[1]?.obtained !== undefined ? sm[1].obtained : null;
      const ct2 = sm[2]?.obtained !== undefined ? sm[2].obtained : null;
      const ct3 = sm[3]?.obtained !== undefined ? sm[3].obtained : null;
      const attendance = sm[4]?.obtained !== undefined ? sm[4].obtained : null;
      const finalTheory = sm[5]?.obtained !== undefined ? sm[5].obtained : null;
      const remarks = sm[1]?.remarks || sm[2]?.remarks || sm[3]?.remarks || sm[4]?.remarks || sm[5]?.remarks || '';

      // CA Calculation Formula:
      // Best 2 of CT-1, CT-2, CT-3 + Attendance (out of 30)
      const enteredCTs = [ct1, ct2, ct3].filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
      const isAttendanceEntered = attendance !== null && attendance !== undefined && !isNaN(attendance);

      // Must have at least 2 CTs and Attendance to calculate CA marks
      const isCAComplete = enteredCTs.length >= 2 && isAttendanceEntered;

      let best2Total = null;
      let caMarks = null;
      let caGrade = '—';
      let caGradeInfo = null;

      if (isCAComplete) {
        const sortedCTs = [...enteredCTs].sort((a, b) => b - a);
        best2Total = Math.round((sortedCTs[0] + sortedCTs[1]) * 10) / 10;
        const attVal = Number(attendance);
        caMarks = Math.round((best2Total + attVal) * 10) / 10;
        const percentage = Number(((caMarks / 30.0) * 100).toFixed(1));
        caGradeInfo = calculatePUSTGrade(percentage);
        caGrade = caGradeInfo.grade;
      } else if (enteredCTs.length > 0 || isAttendanceEntered) {
        caGrade = 'Incomplete';
      }

      return {
        studentId: st.student_id,
        studentRoll: st.student_roll,
        registrationNo: st.registration_no,
        studentName: st.student_name,
        studentEmail: st.student_email,
        ct1,
        ct2,
        ct3,
        attendance,
        best2Total,
        caMarks,
        caGrade,
        caGradeStatus: caGradeInfo?.status || (isCAComplete ? 'EVALUATED' : 'PENDING'),
        caRank: null, // Computed below
        finalTheory,
        isCAComplete,
        remarks,
        status: effectiveStatus
      };
    });

    // Compute Standard Competition Ranking (1, 2, 2, 4...) for completed CA marks
    const completedStudents = rawMatrix.filter(m => m.caMarks !== null);
    completedStudents.sort((a, b) => b.caMarks - a.caMarks);

    const rankMap = {};
    let curRank = 1;
    for (let i = 0; i < completedStudents.length; i++) {
      if (i > 0 && completedStudents[i].caMarks < completedStudents[i - 1].caMarks) {
        curRank = i + 1;
      }
      rankMap[completedStudents[i].studentId] = curRank;
    }

    const matrix = rawMatrix.map(m => ({
      ...m,
      caRank: m.caMarks !== null ? (rankMap[m.studentId] || null) : null
    }));

    // Stats
    const totalComplete = matrix.filter(m => m.isCAComplete).length;
    const avgScore = totalComplete > 0
      ? Number((matrix.filter(m => m.caMarks !== null).reduce((sum, m) => sum + m.caMarks, 0) / totalComplete).toFixed(1))
      : 0;
    const highestScore = totalComplete > 0 ? Math.max(...matrix.filter(m => m.caMarks !== null).map(m => m.caMarks)) : 0;
    const lowestScore = totalComplete > 0 ? Math.min(...matrix.filter(m => m.caMarks !== null).map(m => m.caMarks)) : 0;

    const studentsList = matrix.map(m => ({
      ...m,
      id: m.studentId,
      student_roll: m.studentRoll,
      student_name: m.studentName
    }));

    return res.json({
      course,
      semester: {
        id: course.semester_id,
        semester_name: course.semester_name,
        term_code: course.term_code,
        status: course.semester_status
      },
      canEdit,
      isAssignedTeacher: isAssigned,
      isLocked,
      isPublished: Boolean(course.is_published === 1 || effectiveStatus === 'Result Published'),
      status: effectiveStatus,
      finalMaxMarks,
      matrix,
      students: studentsList,
      stats: {
        totalEnrolled: students.length,
        totalComplete,
        totalPending: students.length - totalComplete,
        avgScore,
        highestScore,
        lowestScore
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch assessment sheet: ' + err.message });
  }
});

// 8g. SAVE REGULAR ASSESSMENT MARKS (Strict: Only Assigned Course Teacher & When Not Locked)
router.post('/continuous-assessment/courses/:courseId/marks', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const { finalMaxMarks = 70.0 } = req.body;
  const user = req.user;

  let matrix = req.body.matrix;
  if (!matrix && Array.isArray(req.body.marks)) {
    const grouped = {};
    for (const m of req.body.marks) {
      if (!grouped[m.studentId]) {
        grouped[m.studentId] = { studentId: m.studentId };
      }
      if (m.ctNumber === 1) grouped[m.studentId].ct1 = m.marks;
      else if (m.ctNumber === 2) grouped[m.studentId].ct2 = m.marks;
      else if (m.ctNumber === 3) grouped[m.studentId].ct3 = m.marks;
      else if (m.ctNumber === 4) grouped[m.studentId].attendance = m.marks;
      else if (m.ctNumber === 5) grouped[m.studentId].finalTheory = m.marks;
    }
    matrix = Object.values(grouped);
  }

  if (!Array.isArray(matrix)) {
    return res.status(400).json({ error: 'Matrix array data is required.' });
  }

  // 1. Verify Course & Teacher Assignment
  const course = db.prepare(`
    SELECT c.id, c.course_code, c.course_title,
           sem.id as semester_id, sem.session_id,
           COALESCE(sem.status, 'Running') as semester_status,
           ca.teacher_id as assigned_teacher_id,
           t.user_id as teacher_user_id,
           u.first_name || ' ' || u.last_name as assigned_teacher_name,
           u.email as assigned_teacher_email,
           cas.status as assessment_status
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN teachers t ON t.id = ca.teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN course_assessments cas ON cas.course_id = c.id AND cas.semester_id = sem.id
    WHERE c.id = ?
  `).get(courseId);

  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  let assignedTeacherId = course.assigned_teacher_id;
  let teacherUserId = course.teacher_user_id;
  let teacherEmail = course.assigned_teacher_email;
  let teacherName = course.assigned_teacher_name;

  if (!assignedTeacherId) {
    const session = db.prepare('SELECT session_name FROM academic_sessions WHERE id = ?').get(course.session_id);
    const resolved = resolveCourseTeacher(course.id, course.course_code, session?.session_name);
    if (resolved) {
      assignedTeacherId = resolved.teacher_id;
      teacherUserId = resolved.user_id;
      teacherEmail = resolved.teacher_email;
      teacherName = resolved.teacher_name;
    }
  }

  const effectiveStatus = course.assessment_status || course.semester_status || 'Running';
  if (['Finalized', 'Result Published', 'Archived'].includes(effectiveStatus)) {
    return res.status(400).json({
      error: `Assessment is currently '${effectiveStatus}' and read-only. Marks cannot be modified without authorized administrative reopening.`
    });
  }

  // 2. Strict Teacher-Based Access Control
  const isAssigned = Boolean(
    (user.teacherId && user.teacherId === assignedTeacherId) ||
    (user.id && user.id === teacherUserId) ||
    (user.email && user.email.toLowerCase() === teacherEmail?.toLowerCase())
  );

  if (!isAssigned) {
    return res.status(403).json({
      error: `Access Denied: Only the assigned course teacher (${teacherName || 'Assigned Faculty'}) can enter or modify marks for ${course.course_code}.`
    });
  }

  const teacherIdToRecord = user.teacherId || assignedTeacherId || 't-1';
  const parsedFinalMax = Math.max(10.0, parseFloat(finalMaxMarks) || 70.0);

  // 3. Strict Validation for all entries
  for (const item of matrix) {
    if (!item.studentId) continue;

    const checkRange = (val, max, fieldName) => {
      if (val === null || val === undefined || val === '' || isNaN(val)) return;
      const num = parseFloat(val);
      if (num < 0 || num > max) {
        throw new Error(`Invalid mark for student: ${fieldName} must be between 0 and ${max}. Received: ${val}`);
      }
    };

    try {
      checkRange(item.ct1, 10.0, 'CT-1');
      checkRange(item.ct2, 10.0, 'CT-2');
      checkRange(item.ct3, 10.0, 'CT-3');
      checkRange(item.attendance, 10.0, 'Attendance');
      checkRange(item.finalTheory, parsedFinalMax, 'Final Theory');
    } catch (valErr) {
      return res.status(400).json({ error: valErr.message });
    }
  }

  // 4. Atomic Save
  const upsertMark = db.prepare(`
    INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(course_id, student_id, ct_number) DO UPDATE SET
      obtained_marks = excluded.obtained_marks,
      max_marks = excluded.max_marks,
      recorded_by = excluded.recorded_by,
      remarks = excluded.remarks,
      updated_at = CURRENT_TIMESTAMP
  `);

  const deleteMark = db.prepare(`
    DELETE FROM ct_marks WHERE course_id = ? AND student_id = ? AND ct_number = ?
  `);

  const saveTx = db.transaction(() => {
    // Upsert course_assessments row
    db.prepare(`
      INSERT INTO course_assessments (id, course_id, semester_id, session_id, final_max_marks, status, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Running', CURRENT_TIMESTAMP)
      ON CONFLICT(course_id, semester_id) DO UPDATE SET
        final_max_marks = excluded.final_max_marks,
        updated_at = CURRENT_TIMESTAMP
    `).run('cas-' + courseId, courseId, course.semester_id, course.session_id, parsedFinalMax);

    for (const item of matrix) {
      if (!item.studentId) continue;

      const marksToSave = [
        { ctNumber: 1, val: item.ct1, max: 10.0 },
        { ctNumber: 2, val: item.ct2, max: 10.0 },
        { ctNumber: 3, val: item.ct3, max: 10.0 },
        { ctNumber: 4, val: item.attendance, max: 10.0 },
        { ctNumber: 5, val: item.finalTheory, max: parsedFinalMax }
      ];

      for (const m of marksToSave) {
        if (m.val !== undefined && m.val !== null && m.val !== '' && !isNaN(m.val)) {
          const markVal = Math.min(m.max, Math.max(0.0, parseFloat(m.val)));
          const markId = `ct-${courseId}-${item.studentId}-${m.ctNumber}`;
          upsertMark.run(
            markId,
            courseId,
            item.studentId,
            teacherIdToRecord,
            m.ctNumber,
            markVal,
            m.max,
            item.remarks || ''
          );
        } else {
          // If explicitly cleared/empty, delete previous mark so it remains distinguished from zero
          deleteMark.run(courseId, item.studentId, m.ctNumber);
        }
      }
    }
  });

  try {
    saveTx();
    return res.json({
      message: `Assessment marks for ${course.course_code} successfully saved by ${course.assigned_teacher_name || 'Assigned Teacher'}!`,
      courseId
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save assessment marks: ' + err.message });
  }
});

// 8h. SUBMIT ASSESSMENT (Teacher Submits to Authority)
router.post('/continuous-assessment/courses/:courseId/submit', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  try {
    const course = db.prepare(`
      SELECT c.*, sem.id as semester_id, sem.session_id,
             ca.teacher_id, t.user_id as teacher_user_id
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const isAssigned = Boolean(
      (user.teacherId && user.teacherId === course.teacher_id) ||
      (user.id && user.id === course.teacher_user_id) ||
      user.role === 'ADMIN'
    );

    if (!isAssigned) {
      return res.status(403).json({ error: 'Only the assigned teacher can submit this assessment.' });
    }

    db.prepare(`
      INSERT INTO course_assessments (id, course_id, semester_id, session_id, status, submitted_by, submitted_at, updated_at)
      VALUES (?, ?, ?, ?, 'Assessment Submission', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(course_id, semester_id) DO UPDATE SET
        status = 'Assessment Submission',
        submitted_by = excluded.submitted_by,
        submitted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `).run('cas-' + courseId, courseId, course.semester_id, course.session_id, user.id);

    // Audit log
    db.prepare(`
      INSERT INTO assessment_audit_logs (id, course_id, semester_id, session_id, action, performed_by, performed_by_name, previous_status, new_status, reason)
      VALUES (?, ?, ?, ?, 'SUBMIT', ?, ?, 'Running', 'Assessment Submission', 'Course teacher submitted assessment marks for review.')
    `).run('log-' + crypto.randomUUID(), courseId, course.semester_id, course.session_id, user.id, user.firstName + ' ' + user.lastName);

    return res.json({ message: 'Assessment marks submitted successfully for review.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit assessment: ' + err.message });
  }
});

// 8i. FINALIZE ASSESSMENT (Academic Authority Action)
router.post('/continuous-assessment/courses/:courseId/finalize', authenticateUser, requireAcademicAuthority, (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  try {
    const course = db.prepare('SELECT c.id, sem.id as semester_id, sem.session_id FROM courses c JOIN semesters sem ON sem.id = c.semester_id WHERE c.id = ?').get(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    db.prepare(`
      INSERT INTO course_assessments (id, course_id, semester_id, session_id, status, finalized_by, finalized_at, updated_at)
      VALUES (?, ?, ?, ?, 'Finalized', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(course_id, semester_id) DO UPDATE SET
        status = 'Finalized',
        finalized_by = excluded.finalized_by,
        finalized_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `).run('cas-' + courseId, courseId, course.semester_id, course.session_id, user.id);

    db.prepare(`
      INSERT INTO assessment_audit_logs (id, course_id, semester_id, session_id, action, performed_by, performed_by_name, previous_status, new_status, reason)
      VALUES (?, ?, ?, ?, 'FINALIZE', ?, ?, 'Assessment Submission', 'Finalized', 'Academic Authority finalized course assessment.')
    `).run('log-' + crypto.randomUUID(), courseId, course.semester_id, course.session_id, user.id, user.firstName + ' ' + user.lastName);

    return res.json({ message: 'Course assessment finalized successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to finalize assessment: ' + err.message });
  }
});

// 8j. PUBLISH RESULT (Academic Authority Action: Result Published & Synced to student_results)
router.post('/continuous-assessment/courses/:courseId/publish', authenticateUser, requireAcademicAuthority, (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  try {
    const course = db.prepare(`
      SELECT c.*, sem.id as semester_id, sem.session_id
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const publishTx = db.transaction(() => {
      // 1. Mark course_assessments as Result Published
      db.prepare(`
        INSERT INTO course_assessments (id, course_id, semester_id, session_id, status, published_by, published_at, updated_at)
        VALUES (?, ?, ?, ?, 'Result Published', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(course_id, semester_id) DO UPDATE SET
          status = 'Result Published',
          published_by = excluded.published_by,
          published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `).run('cas-' + courseId, courseId, course.semester_id, course.session_id, user.id);

      // 2. Synchronize calculated CA + Final Theory into student_results table for permanent transcript integration
      const students = db.prepare('SELECT id FROM students WHERE current_session_id = ?').all(course.session_id);
      const marks = db.prepare('SELECT student_id, ct_number, obtained_marks FROM ct_marks WHERE course_id = ?').all(courseId);

      const studentMarksMap = {};
      for (const m of marks) {
        if (!studentMarksMap[m.student_id]) studentMarksMap[m.student_id] = {};
        studentMarksMap[m.student_id][m.ct_number] = m.obtained_marks;
      }

      const upsertResult = db.prepare(`
        INSERT INTO student_results (
          id, student_id, course_id, session_id, semester_id,
          continuous_assessment_marks, final_exam_marks, total_marks,
          grade_point, letter_grade, credits_earned, is_passed, status, published_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(student_id, course_id) DO UPDATE SET
          continuous_assessment_marks = excluded.continuous_assessment_marks,
          final_exam_marks = excluded.final_exam_marks,
          total_marks = excluded.total_marks,
          grade_point = excluded.grade_point,
          letter_grade = excluded.letter_grade,
          credits_earned = excluded.credits_earned,
          is_passed = excluded.is_passed,
          status = 'PUBLISHED',
          published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const st of students) {
        const sm = studentMarksMap[st.id] || {};
        const cts = [sm[1], sm[2], sm[3]].filter(v => v !== undefined && v !== null).map(Number).sort((a, b) => b - a);
        const best2 = cts.length >= 2 ? (cts[0] + cts[1]) : (cts[0] || 0);
        const att = sm[4] !== undefined && sm[4] !== null ? Number(sm[4]) : 0;
        const ca = Math.round((best2 + att) * 10) / 10;
        const fe = sm[5] !== undefined && sm[5] !== null ? Number(sm[5]) : 0;
        const total = Math.round((ca + fe) * 10) / 10;

        const gradeObj = calculateGrade(total);
        const creditsEarned = gradeObj.isPassed ? course.credit_hours : 0.0;
        const resId = 'res-' + crypto.randomUUID();

        upsertResult.run(
          resId, st.id, courseId, course.session_id, course.semester_id,
          ca, fe, total, gradeObj.gradePoint, gradeObj.letterGrade, creditsEarned, gradeObj.isPassed ? 1 : 0
        );
      }

      // 3. Log audit event
      db.prepare(`
        INSERT INTO assessment_audit_logs (id, course_id, semester_id, session_id, action, performed_by, performed_by_name, previous_status, new_status, reason)
        VALUES (?, ?, ?, ?, 'PUBLISH', ?, ?, 'Finalized', 'Result Published', 'Academic Authority officially published course results.')
      `).run('log-' + crypto.randomUUID(), courseId, course.semester_id, course.session_id, user.id, user.firstName + ' ' + user.lastName);
    });

    publishTx();
    return res.json({ message: `Results for ${course.course_code} officially published and locked.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to publish results: ' + err.message });
  }
});

// 8k. REOPEN LOCKED ASSESSMENT (Admin / Chairman Only - Requires Explicit Reason & Audit Log)
router.post('/continuous-assessment/courses/:courseId/reopen', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const { reason } = req.body;
  const user = req.user;

  const isChair = user.email === 'chair.cse_pust@gmail.com' || user.role === 'ADMIN' || (user.designation && user.designation.toLowerCase().includes('chair'));
  if (user.role !== 'ADMIN' && !isChair) {
    return res.status(403).json({ error: 'Access Denied: Only Department Chairman or Administrator can reopen a locked assessment.' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Reason is required: An explicit administrative reason must be provided to reopen a locked assessment.' });
  }

  try {
    const course = db.prepare(`
      SELECT c.*, sem.id as semester_id, sem.session_id, cas.status as current_status
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      LEFT JOIN course_assessments cas ON cas.course_id = c.id AND cas.semester_id = sem.id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const prevStatus = course.current_status || 'Finalized';

    const reopenTx = db.transaction(() => {
      db.prepare(`
        UPDATE course_assessments
        SET status = 'Running',
            is_finalized = 0,
            is_published = 0,
            finalized_at = NULL,
            published_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE course_id = ? AND semester_id = ?
      `).run(courseId, course.semester_id);

      db.prepare(`
        INSERT INTO assessment_audit_logs (
          id, course_id, semester_id, session_id, action,
          performed_by, performed_by_name, previous_status, new_status, reason
        )
        VALUES (?, ?, ?, ?, 'REOPENED', ?, ?, ?, 'Running', ?)
      `).run(
        'log-' + crypto.randomUUID(),
        courseId,
        course.semester_id,
        course.session_id,
        user.id,
        (user.firstName || '') + ' ' + (user.lastName || ''),
        prevStatus,
        reason.trim()
      );
    });

    reopenTx();
    return res.json({ message: `Assessment for ${course.course_code} successfully reopened for correction. Reason logged in audit history.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reopen assessment: ' + err.message });
  }
});

// 8l. GET AUDIT LOGS FOR AN ASSESSMENT
router.get('/continuous-assessment/courses/:courseId/audit-logs', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  try {
    const logs = db.prepare(`
      SELECT * FROM assessment_audit_logs
      WHERE course_id = ?
      ORDER BY created_at DESC
    `).all(courseId);

    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs: ' + err.message });
  }
});

module.exports = router;
