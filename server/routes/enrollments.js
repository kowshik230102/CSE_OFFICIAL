const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { CURRICULUM_COURSES } = require('../db/curriculumData');

// ==========================================
// 1. GET CURRENT LOGGED-IN STUDENT'S ENROLLMENTS
// ==========================================
router.get('/my', authenticateUser, (req, res) => {
  try {
    let studentId = req.user.studentId;

    // If user is a student but studentId not in token, look up from students table
    if (!studentId && req.user.role === 'STUDENT') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      if (st) studentId = st.id;
    }

    if (!studentId) {
      return res.status(403).json({ error: 'No student profile associated with this account.' });
    }

    const enrollments = db.prepare(`
      SELECT ce.id as enrollment_id,
             ce.enrollment_status,
             ce.enrollment_type,
             ce.enrolled_at,
             c.id as course_id,
             c.course_code,
             c.course_title,
             c.credit_hours,
             c.course_type,
             c.year,
             c.semester,
             c.term_code,
             c.is_optional,
             c.elective_group,
             c.syllabus_outline,
             sem.id as semester_id,
             sem.semester_name,
             sem.is_active as is_semester_active,
             sess.id as session_id,
             sess.session_name,
             u.first_name || ' ' || u.last_name as teacher_name,
             u.email as teacher_email,
             t.designation as teacher_designation,
             (SELECT COUNT(*) FROM course_materials WHERE course_id = c.id) as materials_count
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      JOIN semesters sem ON sem.id = ce.semester_id
      JOIN academic_sessions sess ON sess.id = ce.session_id
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE ce.student_id = ?
      ORDER BY c.year ASC, c.semester ASC, c.is_optional ASC, c.course_code ASC
    `).all(studentId);

    // Calculate summary statistics
    const totalCredits = enrollments.reduce((sum, e) => sum + (e.credit_hours || 0), 0);
    const activeCredits = enrollments
      .filter(e => e.enrollment_status === 'ENROLLED')
      .reduce((sum, e) => sum + (e.credit_hours || 0), 0);

    // Group enrollments by term_code (e.g. Y1S1, Y3S1)
    const groupedBySemester = {};
    for (const e of enrollments) {
      const term = e.term_code || `Y${e.year}S${e.semester}`;
      if (!groupedBySemester[term]) {
        groupedBySemester[term] = {
          termCode: term,
          year: e.year,
          semester: e.semester,
          semesterName: e.semester_name,
          sessionId: e.session_id,
          sessionName: e.session_name,
          isActive: Boolean(e.is_semester_active),
          totalCredits: 0,
          courses: []
        };
      }
      groupedBySemester[term].totalCredits += (e.credit_hours || 0);
      groupedBySemester[term].courses.push(e);
    }

    return res.json({
      studentId,
      totalEnrollments: enrollments.length,
      totalCredits: Math.round(totalCredits * 100) / 100,
      activeCredits: Math.round(activeCredits * 100) / 100,
      enrollments,
      groupedBySemester: Object.values(groupedBySemester)
    });
  } catch (err) {
    console.error('[Enrollments API] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch student enrollments: ' + err.message });
  }
});

// ==========================================
// 2. GET AVAILABLE COURSES FOR ENROLLMENT IN A SEMESTER
// ==========================================
router.get('/available/:semesterId', authenticateUser, (req, res) => {
  try {
    const { semesterId } = req.params;
    let studentId = req.query.studentId || req.user.studentId;

    if (!studentId && req.user.role === 'STUDENT') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      if (st) studentId = st.id;
    }

    const semester = db.prepare(`
      SELECT sem.*, sess.session_name, sess.id as session_id
      FROM semesters sem
      JOIN academic_sessions sess ON sess.id = sem.session_id
      WHERE sem.id = ?
    `).get(semesterId);

    if (!semester) {
      return res.status(404).json({ error: 'Semester not found.' });
    }

    // Fetch all courses in this semester
    const courses = db.prepare(`
      SELECT c.*,
             ca.teacher_id as assigned_teacher_id,
             u.first_name || ' ' || u.last_name as assigned_teacher_name,
             t.designation as assigned_teacher_designation,
             (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND enrollment_status = 'ENROLLED') as enrolled_count
      FROM courses c
      LEFT JOIN course_assignments ca ON ca.course_id = c.id
      LEFT JOIN teachers t ON t.id = ca.teacher_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE c.semester_id = ?
      ORDER BY c.is_optional ASC, c.course_code ASC
    `).all(semesterId);

    // If student is identified, check enrollment status for each course
    let studentEnrollments = [];
    if (studentId) {
      studentEnrollments = db.prepare(`
        SELECT course_id, enrollment_status, elective_group
        FROM course_enrollments ce
        JOIN courses c ON c.id = ce.course_id
        WHERE ce.student_id = ? AND ce.semester_id = ?
      `).all(studentId, semesterId);
    }

    const enrolledCourseIds = new Set(studentEnrollments.map(e => e.course_id));
    const enrolledElectiveGroups = {};
    for (const se of studentEnrollments) {
      if (se.elective_group && se.enrollment_status === 'ENROLLED') {
        enrolledElectiveGroups[se.elective_group] = se.course_id;
      }
    }

    const coreCourses = [];
    const optionalGroups = {};

    for (const c of courses) {
      const isEnrolled = enrolledCourseIds.has(c.id);
      const courseObj = {
        ...c,
        isEnrolled,
        isEligible: true,
        restrictionMessage: null
      };

      if (c.is_optional && c.elective_group) {
        if (!optionalGroups[c.elective_group]) {
          optionalGroups[c.elective_group] = {
            groupName: c.elective_group,
            selectedCourseId: enrolledElectiveGroups[c.elective_group] || null,
            courses: []
          };
        }
        // If student already selected a different elective in this group
        if (enrolledElectiveGroups[c.elective_group] && enrolledElectiveGroups[c.elective_group] !== c.id) {
          courseObj.isEligible = false;
          courseObj.restrictionMessage = `Already enrolled in another ${c.elective_group} course. Drop it first to switch.`;
        }
        optionalGroups[c.elective_group].courses.push(courseObj);
      } else {
        coreCourses.push(courseObj);
      }
    }

    return res.json({
      semester,
      totalCourses: courses.length,
      coreCourses,
      optionalGroups: Object.values(optionalGroups),
      allCourses: courses
    });
  } catch (err) {
    console.error('[Available Courses API] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch available courses: ' + err.message });
  }
});

// ==========================================
// 3. ENROLL IN A COURSE (STUDENT OR OFFICE STAFF)
// ==========================================
router.post('/enroll', authenticateUser, (req, res) => {
  try {
    const { courseId, studentId: requestedStudentId, enrollmentType = 'REGULAR' } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required.' });
    }

    let targetStudentId = req.user.studentId;
    if (['ADMIN', 'OFFICE_STAFF'].includes(req.user.role) && requestedStudentId) {
      targetStudentId = requestedStudentId;
    } else if (!targetStudentId && req.user.role === 'STUDENT') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      if (st) targetStudentId = st.id;
    }

    if (!targetStudentId) {
      return res.status(403).json({ error: 'No student specified or student profile not found.' });
    }

    // Fetch course details
    const course = db.prepare(`
      SELECT c.*, sem.session_id, sem.id as semester_id, sem.semester_name, sess.session_name
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      JOIN academic_sessions sess ON sess.id = sem.session_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Check if already enrolled
    const existing = db.prepare(`
      SELECT * FROM course_enrollments WHERE student_id = ? AND course_id = ?
    `).get(targetStudentId, courseId);

    if (existing) {
      if (existing.enrollment_status === 'ENROLLED') {
        return res.status(400).json({ error: 'Student is already enrolled in this course.' });
      } else {
        // Re-activate enrollment
        db.prepare(`
          UPDATE course_enrollments
          SET enrollment_status = 'ENROLLED', enrolled_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(existing.id);
        return res.json({
          message: `Re-enrolled in ${course.course_code}: ${course.course_title} successfully!`,
          enrollmentId: existing.id
        });
      }
    }

    // Check elective limit: Only 1 course allowed per elective group in a semester
    if (course.is_optional && course.elective_group) {
      const existingElective = db.prepare(`
        SELECT ce.id, c.course_code, c.course_title
        FROM course_enrollments ce
        JOIN courses c ON c.id = ce.course_id
        WHERE ce.student_id = ? 
          AND ce.semester_id = ? 
          AND c.elective_group = ? 
          AND ce.enrollment_status = 'ENROLLED'
      `).get(targetStudentId, course.semester_id, course.elective_group);

      if (existingElective) {
        return res.status(400).json({
          error: `Student already enrolled in ${existingElective.course_code} for ${course.elective_group}. Please drop it first to select ${course.course_code}.`
        });
      }
    }

    const enrollmentId = 'enr-' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO course_enrollments (id, student_id, course_id, session_id, semester_id, enrollment_status, enrollment_type, enrolled_at)
      VALUES (?, ?, ?, ?, ?, 'ENROLLED', ?, CURRENT_TIMESTAMP)
    `).run(enrollmentId, targetStudentId, courseId, course.session_id, course.semester_id, enrollmentType);

    return res.status(201).json({
      message: `Enrolled successfully in ${course.course_code}: ${course.course_title} (${course.credit_hours} Cr)!`,
      enrollmentId,
      course: {
        id: course.id,
        code: course.course_code,
        title: course.course_title,
        credits: course.credit_hours,
        type: course.course_type,
        year: course.year,
        semester: course.semester,
        termCode: course.term_code
      }
    });
  } catch (err) {
    console.error('[Enroll API] Error:', err);
    return res.status(500).json({ error: 'Failed to complete course enrollment: ' + err.message });
  }
});

// ==========================================
// 4. DROP / UNENROLL AN ELECTIVE OR COURSE
// ==========================================
router.delete('/:enrollmentId', authenticateUser, (req, res) => {
  try {
    const { enrollmentId } = req.params;

    const enrollment = db.prepare(`
      SELECT ce.*, c.course_code, c.course_title, c.is_optional, s.user_id
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      JOIN students s ON s.id = ce.student_id
      WHERE ce.id = ?
    `).get(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment record not found.' });
    }

    const isOwnStudent = enrollment.user_id === req.user.id;
    const isAcademicStaff = ['ADMIN', 'OFFICE_STAFF'].includes(req.user.role);

    if (!isOwnStudent && !isAcademicStaff) {
      return res.status(403).json({ error: 'Unauthorized to modify this enrollment.' });
    }

    db.prepare(`
      UPDATE course_enrollments
      SET enrollment_status = 'DROPPED'
      WHERE id = ?
    `).run(enrollmentId);

    return res.json({
      message: `Dropped ${enrollment.course_code}: ${enrollment.course_title} successfully.`,
      enrollmentId
    });
  } catch (err) {
    console.error('[Drop Enrollment API] Error:', err);
    return res.status(500).json({ error: 'Failed to drop course: ' + err.message });
  }
});

// ==========================================
// 5. AUTO-ENROLL ENTIRE SESSION COHORT INTO CORE COURSES (OFFICE / ADMIN)
// ==========================================
router.post('/auto-enroll-batch', authenticateUser, requireRoles(['ADMIN', 'OFFICE_STAFF']), (req, res) => {
  try {
    const { sessionId, semesterId } = req.body;

    if (!sessionId || !semesterId) {
      return res.status(400).json({ error: 'Session ID and Semester ID are required.' });
    }

    // Fetch cohort students
    const students = db.prepare(`
      SELECT id, student_roll FROM students WHERE current_session_id = ?
    `).all(sessionId);

    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found in this academic session.' });
    }

    // Fetch core mandatory courses for this semester
    const coreCourses = db.prepare(`
      SELECT id, course_code, course_title, credit_hours
      FROM courses
      WHERE semester_id = ? AND (is_optional = 0 OR is_optional IS NULL)
    `).all(semesterId);

    if (coreCourses.length === 0) {
      return res.status(404).json({ error: 'No core courses found for this semester.' });
    }

    const insertEnrollment = db.prepare(`
      INSERT INTO course_enrollments (id, student_id, course_id, session_id, semester_id, enrollment_status, enrollment_type, enrolled_at)
      VALUES (?, ?, ?, ?, ?, 'ENROLLED', 'REGULAR', CURRENT_TIMESTAMP)
      ON CONFLICT(student_id, course_id) DO UPDATE SET
        enrollment_status = 'ENROLLED'
    `);

    let enrolledCount = 0;
    const transaction = db.transaction(() => {
      for (const st of students) {
        for (const c of coreCourses) {
          const enrId = 'enr-' + crypto.randomUUID();
          insertEnrollment.run(enrId, st.id, c.id, sessionId, semesterId);
          enrolledCount++;
        }
      }
    });

    transaction();

    return res.json({
      message: `Auto-enrolled ${students.length} students into ${coreCourses.length} mandatory core courses (${enrolledCount} total enrollments processed).`,
      totalStudents: students.length,
      totalCoreCourses: coreCourses.length,
      totalEnrollmentsProcessed: enrolledCount
    });
  } catch (err) {
    console.error('[Auto-Enroll Batch API] Error:', err);
    return res.status(500).json({ error: 'Failed to auto-enroll students: ' + err.message });
  }
});

// ==========================================
// 6. GET ENROLLED STUDENTS ROSTER FOR A COURSE (TEACHER / OFFICE)
// ==========================================
router.get('/course/:courseId', authenticateUser, (req, res) => {
  try {
    const { courseId } = req.params;

    const course = db.prepare(`
      SELECT c.*, sem.semester_name, sess.session_name
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      JOIN academic_sessions sess ON sess.id = sem.session_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const enrolledStudents = db.prepare(`
      SELECT ce.id as enrollment_id,
             ce.enrollment_status,
             ce.enrollment_type,
             ce.enrolled_at,
             s.id as student_id,
             s.student_roll,
             s.registration_no,
             u.first_name || ' ' || u.last_name as student_name,
             u.email as student_email,
             u.phone_number as student_phone,
             (SELECT COUNT(*) FROM ct_marks WHERE course_id = c.id AND student_id = s.id) as recorded_cts_count
      FROM course_enrollments ce
      JOIN students s ON s.id = ce.student_id
      JOIN users u ON u.id = s.user_id
      JOIN courses c ON c.id = ce.course_id
      WHERE ce.course_id = ? AND ce.enrollment_status = 'ENROLLED'
      ORDER BY s.student_roll ASC
    `).all(courseId);

    return res.json({
      course,
      totalEnrolled: enrolledStudents.length,
      students: enrolledStudents
    });
  } catch (err) {
    console.error('[Course Enrolled Roster API] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch enrolled students: ' + err.message });
  }
});

module.exports = router;
