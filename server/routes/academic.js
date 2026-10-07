const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { ensureSessionWithStandardCourses, syncAllSerialSessions } = require('../utils/sessionSync');
const { syncPustTeachersToDatabase, getSyncStatus } = require('../services/pustTeacherSync');

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
function calculatePUSTGrade(percentage) {
  if (percentage >= 80) return { grade: 'A+', gpa: 4.0, status: 'EXCELLENT' };
  if (percentage >= 75) return { grade: 'A', gpa: 3.75, status: 'VERY_GOOD' };
  if (percentage >= 70) return { grade: 'A-', gpa: 3.50, status: 'GOOD' };
  if (percentage >= 65) return { grade: 'B+', gpa: 3.25, status: 'SATISFACTORY' };
  if (percentage >= 60) return { grade: 'B', gpa: 3.00, status: 'ABOVE_AVERAGE' };
  if (percentage >= 55) return { grade: 'B-', gpa: 2.75, status: 'AVERAGE' };
  if (percentage >= 50) return { grade: 'C+', gpa: 2.50, status: 'PASS' };
  if (percentage >= 45) return { grade: 'C', gpa: 2.25, status: 'PASS' };
  if (percentage >= 40) return { grade: 'D', gpa: 2.00, status: 'MARGINAL' };
  return { grade: 'F', gpa: 0.0, status: 'FAIL' };
}

// 8a. GET ALL SESSIONS SERIALLY
router.get('/continuous-assessment/sessions', authenticateUser, (req, res) => {
  try {
    // Retrieve all sessions
    const sessions = db.prepare(`
      SELECT s.id, s.session_name, s.start_date, s.end_date, s.is_current,
             (SELECT COUNT(DISTINCT c.id) FROM courses c JOIN semesters sem ON sem.id = c.semester_id WHERE sem.session_id = s.id) as course_count,
             (SELECT COUNT(DISTINCT st.id) FROM students st WHERE st.current_session_id = s.id) as student_count,
             (SELECT COUNT(DISTINCT ca.teacher_id) FROM courses c JOIN semesters sem ON sem.id = c.semester_id JOIN course_assignments ca ON ca.course_id = c.id WHERE sem.session_id = s.id) as teacher_count,
             (SELECT COUNT(DISTINCT m.id) FROM ct_marks m JOIN courses c ON c.id = m.course_id JOIN semesters sem ON sem.id = c.semester_id WHERE sem.session_id = s.id) as assessed_marks_count
      FROM academic_sessions s
    `).all();

    // Sort sessions in strict serial order:
    // Extract 4-digit start year from session_name or start_date, descending (e.g. 2024-2025, 2023-2024, 2022-2023)
    const sorted = [...sessions].sort((a, b) => {
      // Prioritize current session
      if (a.is_current && !b.is_current) return -1;
      if (!a.is_current && b.is_current) return 1;

      const yearA = parseInt((a.session_name.match(/(\d{4})/) || [0, 0])[1]) || (a.start_date ? parseInt(a.start_date.slice(0, 4)) : 0);
      const yearB = parseInt((b.session_name.match(/(\d{4})/) || [0, 0])[1]) || (b.start_date ? parseInt(b.start_date.slice(0, 4)) : 0);
      return yearB - yearA;
    });

    return res.json({ sessions: sorted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch continuous assessment sessions: ' + err.message });
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
      message: `Academic Session '${session.session_name}' initialized with 8 standard semesters, courses, and teacher allocations!`,
      session
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create session: ' + err.message });
  }
});

// 8c. GET ALL COURSES INSIDE A SESSION WITH ASSIGNED TEACHER DETAILS
router.get('/continuous-assessment/sessions/:sessionId/courses', authenticateUser, (req, res) => {
  const { sessionId } = req.params;
  const user = req.user;

  try {
    const session = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const termOrder = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];

    const courses = db.prepare(`
      SELECT c.id, c.course_code, c.course_title, c.credit_hours, c.course_type, c.syllabus_outline,
             sem.id as semester_id, sem.semester_name, sem.term_code,
             ca.teacher_id as assigned_teacher_id,
             t.user_id as teacher_user_id,
             u.first_name || ' ' || u.last_name as assigned_teacher_name,
             u.email as assigned_teacher_email,
             u.phone_number as assigned_teacher_phone,
             t.designation as assigned_teacher_designation,
             COALESCE(t.department_code, 'CSE') as assigned_teacher_department,
             t.room_number as assigned_teacher_room,
             t.photo_url as assigned_teacher_photo,
             t.qualification as assigned_teacher_qualification,
             t.research_area as assigned_teacher_research,
             t.bio as assigned_teacher_bio,
             t.profile_id as assigned_teacher_profile_id,
             t.on_leave as assigned_teacher_on_leave,
             (SELECT COUNT(*) FROM students WHERE current_session_id = sem.session_id) as enrolled_students_count,
             (SELECT COUNT(DISTINCT student_id) FROM ct_marks WHERE course_id = c.id) as assessed_students_count,
             (SELECT AVG(obtained_marks) FROM ct_marks WHERE course_id = c.id) as avg_mark
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE sem.session_id = ?
    `).all(sessionId);

    // Sort by semester termOrder and course_code
    courses.sort((a, b) => {
      const idxA = termOrder.indexOf(a.term_code);
      const idxB = termOrder.indexOf(b.term_code);
      if (idxA !== idxB && idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.course_code.localeCompare(b.course_code);
    });

    const coursesWithAuth = courses.map(c => {
      const isAssigned = (user.teacherId && user.teacherId === c.assigned_teacher_id) ||
                         (user.id && user.id === c.teacher_user_id);
      return {
        ...c,
        is_user_assigned_teacher: Boolean(isAssigned),
        can_edit: Boolean(isAssigned || user.role === 'ADMIN')
      };
    });

    return res.json({
      session,
      courses: coursesWithAuth,
      total_courses: coursesWithAuth.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch session courses: ' + err.message });
  }
});

// 8d. GET STUDENT REGULAR ASSESSMENT MARKS WITH FULL DETAILS FOR A COURSE
router.get('/continuous-assessment/courses/:courseId/marks', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  try {
    const course = db.prepare(`
      SELECT c.*,
             sem.session_id, sem.semester_name, sem.term_code,
             s.session_name,
             ca.teacher_id as assigned_teacher_id,
             t.user_id as teacher_user_id,
             u.first_name || ' ' || u.last_name as assigned_teacher_name,
             u.email as assigned_teacher_email,
             u.phone_number as assigned_teacher_phone,
             t.designation as assigned_teacher_designation,
             COALESCE(t.department_code, 'CSE') as assigned_teacher_department,
             t.room_number as assigned_teacher_room,
             t.photo_url as assigned_teacher_photo,
             t.bio as assigned_teacher_bio,
             t.research_area as assigned_teacher_research
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      JOIN academic_sessions s ON s.id = sem.session_id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Strict Authorization check: only the assigned course teacher can edit
    const isAssigned = (user.teacherId && user.teacherId === course.assigned_teacher_id) ||
                       (user.id && user.id === course.teacher_user_id);
    const canEdit = Boolean(isAssigned || user.role === 'ADMIN');

    // Fetch all students in this session
    const students = db.prepare(`
      SELECT st.id as student_id, st.student_roll, st.registration_no,
             u.first_name || ' ' || u.last_name as student_name,
             u.email as student_email
      FROM students st
      JOIN users u ON u.id = st.user_id
      WHERE st.current_session_id = ?
      ORDER BY st.student_roll ASC
    `).all(course.session_id);

    // Fetch all marks for this course
    const marks = db.prepare(`
      SELECT m.*, u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ct_marks m
      LEFT JOIN teachers t ON t.id = m.recorded_by
      LEFT JOIN users u ON u.id = t.user_id
      WHERE m.course_id = ?
    `).all(courseId);

    // Group marks by student
    const marksByStudent = {};
    for (const m of marks) {
      if (!marksByStudent[m.student_id]) {
        marksByStudent[m.student_id] = {};
      }
      marksByStudent[m.student_id][m.ct_number] = {
        obtained: m.obtained_marks,
        max: m.max_marks || 10.0,
        remarks: m.remarks || ''
      };
    }

    // Build comprehensive roster matrix
    const matrix = students.map(st => {
      const studentMarks = marksByStudent[st.student_id] || {};
      const ct1 = studentMarks[1] !== undefined ? studentMarks[1].obtained : null;
      const ct2 = studentMarks[2] !== undefined ? studentMarks[2].obtained : null;
      const ct3 = studentMarks[3] !== undefined ? studentMarks[3].obtained : null;
      const attendance = studentMarks[4] !== undefined ? studentMarks[4].obtained : null;
      const remarks = (studentMarks[1]?.remarks || studentMarks[2]?.remarks || studentMarks[3]?.remarks || studentMarks[4]?.remarks || '');

      // Calculate Best 2 of 3 Class Tests (PUST Ordinance: Best 2 CTs = 20 Marks)
      const validCTs = [ct1, ct2, ct3].filter(v => v !== null && !isNaN(v)).map(Number);
      let best2Total = 0;
      let ctAverage = 0;
      if (validCTs.length > 0) {
        validCTs.sort((a, b) => b - a);
        const top2 = validCTs.slice(0, 2);
        best2Total = top2.reduce((sum, v) => sum + v, 0);
        // If CTs out of 10 each, best 2 sum = out of 20
        ctAverage = validCTs.reduce((sum, v) => sum + v, 0) / validCTs.length;
      }

      const attMarks = (attendance !== null && !isNaN(attendance)) ? Number(attendance) : 0;
      // Total Continuous Assessment = Best 2 CTs (20) + Attendance (10) = 30 Marks Total
      const totalContinuous = validCTs.length > 0 ? Number((best2Total + attMarks).toFixed(1)) : (attendance !== null ? attMarks : null);
      const percentage = totalContinuous !== null ? Number(((totalContinuous / 30) * 100).toFixed(1)) : null;
      const gradeInfo = percentage !== null ? calculatePUSTGrade(percentage) : { grade: '-', gpa: 0, status: 'NOT_EVALUATED' };

      return {
        studentId: st.student_id,
        studentRoll: st.student_roll,
        registrationNo: st.registration_no,
        studentName: st.student_name,
        studentEmail: st.student_email,
        ct1,
        ct2,
        ct3,
        best2Total: validCTs.length > 0 ? Number(best2Total.toFixed(1)) : null,
        ctAverage: validCTs.length > 0 ? Number(ctAverage.toFixed(1)) : null,
        attendance,
        totalContinuous,
        percentage,
        grade: gradeInfo.grade,
        gpa: gradeInfo.gpa,
        status: gradeInfo.status,
        remarks,
        isEvaluated: validCTs.length > 0 || attendance !== null
      };
    });

    // Summary statistics
    const evaluatedList = matrix.filter(m => m.isEvaluated && m.totalContinuous !== null);
    const avgScore = evaluatedList.length > 0
      ? Number((evaluatedList.reduce((sum, m) => sum + m.totalContinuous, 0) / evaluatedList.length).toFixed(1))
      : 0;
    const highestScore = evaluatedList.length > 0 ? Math.max(...evaluatedList.map(m => m.totalContinuous)) : 0;
    const lowestScore = evaluatedList.length > 0 ? Math.min(...evaluatedList.map(m => m.totalContinuous)) : 0;
    const passCount = evaluatedList.filter(m => m.percentage >= 40).length;
    const distinctionCount = evaluatedList.filter(m => m.percentage >= 80).length;

    return res.json({
      course,
      canEdit,
      isAssignedTeacher: Boolean(isAssigned),
      matrix,
      stats: {
        totalEnrolled: students.length,
        totalEvaluated: evaluatedList.length,
        avgScore,
        highestScore,
        lowestScore,
        passCount,
        distinctionCount
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch course assessment marks: ' + err.message });
  }
});

// 8e. SAVE CONTINUOUS ASSESSMENT MARKS (Strict: Only Assigned Course Teacher)
router.post('/continuous-assessment/courses/:courseId/marks', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const { matrix } = req.body; // Array of { studentId, ct1, ct2, ct3, attendance, remarks }
  const user = req.user;

  if (!Array.isArray(matrix)) {
    return res.status(400).json({ error: 'Invalid matrix data. Array expected.' });
  }

  // 1. Verify Course and Assigned Teacher
  const course = db.prepare(`
    SELECT c.id, c.course_code, c.course_title,
           ca.teacher_id as assigned_teacher_id,
           t.user_id as teacher_user_id,
           u.first_name || ' ' || u.last_name as assigned_teacher_name,
           t.department_code as assigned_teacher_department
    FROM courses c
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN teachers t ON t.id = ca.teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE c.id = ?
  `).get(courseId);

  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  const isAssigned = (user.teacherId && user.teacherId === course.assigned_teacher_id) ||
                     (user.id && user.id === course.teacher_user_id);

  // STRICT REQUIREMENT: Only the assigned course teacher can edit!
  if (!isAssigned && user.role !== 'ADMIN') {
    return res.status(403).json({
      error: `Access Denied: Continuous assessment marks can only be entered or modified by the assigned course teacher: ${course.assigned_teacher_name || 'Assigned Faculty'}.`
    });
  }

  const teacherIdToRecord = user.teacherId || course.assigned_teacher_id || 't-1';

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

  const saveTx = db.transaction(() => {
    for (const item of matrix) {
      if (!item.studentId) continue;

      const assessments = [
        { ctNumber: 1, val: item.ct1 },
        { ctNumber: 2, val: item.ct2 },
        { ctNumber: 3, val: item.ct3 },
        { ctNumber: 4, val: item.attendance } // 4 = Class Attendance (Max 10)
      ];

      for (const a of assessments) {
        if (a.val !== undefined && a.val !== null && a.val !== '' && !isNaN(a.val)) {
          const markVal = Math.min(10.0, Math.max(0.0, parseFloat(a.val)));
          const markId = `ct-${courseId}-${item.studentId}-${a.ctNumber}`;
          upsertMark.run(
            markId,
            courseId,
            item.studentId,
            teacherIdToRecord,
            a.ctNumber,
            markVal,
            10.0,
            item.remarks || ''
          );
        }
      }
    }
  });

  try {
    saveTx();
    return res.json({
      message: `Continuous Assessment marks for ${course.course_code} successfully saved by ${course.assigned_teacher_name}!`,
      courseId
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save marks matrix: ' + err.message });
  }
});

module.exports = router;
