const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');

function requireAcademicAuthority(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const isChair = req.user.email === 'chair.cse_pust@gmail.com' || req.user.role === 'ADMIN' || (req.user.designation && req.user.designation.toLowerCase().includes('chair'));
  if (['OFFICE_STAFF', 'ADMIN'].includes(req.user.role) || isChair) {
    return next();
  }
  return res.status(403).json({ error: 'Access Denied: Only Department Chairman or Academic Office Staff can perform this action.' });
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

module.exports = router;
