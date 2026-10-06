const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');

/**
 * Standard University Grading System (UGC / Engineering Scale)
 */
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

// ==========================================
// 1. GET LOGGED-IN STUDENT'S FULL TRANSCRIPT & SGPA/CGPA TRACKING
// ==========================================
router.get('/my', authenticateUser, (req, res) => {
  try {
    let studentId = req.user.studentId;

    if (!studentId && req.user.role === 'STUDENT') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      if (st) studentId = st.id;
    }

    if (!studentId) {
      return res.status(403).json({ error: 'No student profile linked to this account.' });
    }

    return getStudentFullTranscript(studentId, res);
  } catch (err) {
    console.error('[Results API] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch student results: ' + err.message });
  }
});

// ==========================================
// 2. GET TRANSCRIPT FOR SPECIFIC STUDENT (OFFICE / TEACHER / ADMIN)
// ==========================================
router.get('/student/:studentId', authenticateUser, (req, res) => {
  try {
    const { studentId } = req.params;

    // Students can only view their own transcript
    if (req.user.role === 'STUDENT') {
      let ownStudentId = req.user.studentId;
      if (!ownStudentId) {
        const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
        if (st) ownStudentId = st.id;
      }
      if (ownStudentId !== studentId) {
        return res.status(403).json({ error: 'Unauthorized to view another student\'s transcript.' });
      }
    }

    return getStudentFullTranscript(studentId, res);
  } catch (err) {
    console.error('[Results API] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch student results: ' + err.message });
  }
});

function getStudentFullTranscript(studentId, res) {
  const student = db.prepare(`
    SELECT s.id as student_id,
           s.student_roll,
           s.registration_no,
           u.first_name || ' ' || u.last_name as student_name,
           u.email as student_email,
           sess.id as current_session_id,
           sess.session_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN academic_sessions sess ON sess.id = s.current_session_id
    WHERE s.id = ?
  `).get(studentId);

  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  // Fetch all published results for this student
  const results = db.prepare(`
    SELECT r.id as result_id,
           r.continuous_assessment_marks,
           r.final_exam_marks,
           r.total_marks,
           r.grade_point,
           r.letter_grade,
           r.credits_earned,
           r.is_passed,
           r.status as result_status,
           r.published_at,
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
           sem.id as semester_id,
           sem.semester_name,
           sem.term_code as sem_term_code,
           sess.id as session_id,
           sess.session_name
    FROM student_results r
    JOIN courses c ON c.id = r.course_id
    JOIN semesters sem ON sem.id = r.semester_id
    JOIN academic_sessions sess ON sess.id = r.session_id
    WHERE r.student_id = ?
    ORDER BY c.year ASC, c.semester ASC, c.is_optional ASC, c.course_code ASC
  `).all(studentId);

  // Group by Semester
  const semestersMap = {};
  let totalDegreeAttemptedCredits = 0;
  let totalDegreeEarnedCredits = 0;
  let totalDegreeWeightedGradePoints = 0;

  for (const r of results) {
    const termCode = r.term_code || r.sem_term_code || `Y${r.year}S${r.semester}`;
    if (!semestersMap[termCode]) {
      semestersMap[termCode] = {
        termCode,
        year: r.year,
        semester: r.semester,
        semesterName: r.semester_name,
        sessionId: r.session_id,
        sessionName: r.session_name,
        attemptedCredits: 0,
        earnedCredits: 0,
        weightedPoints: 0,
        sgpa: 0.00,
        courses: []
      };
    }

    const credits = r.credit_hours || 0;
    const gp = r.grade_point || 0;
    const isPass = Boolean(r.is_passed);

    semestersMap[termCode].attemptedCredits += credits;
    if (isPass) {
      semestersMap[termCode].earnedCredits += credits;
    }
    semestersMap[termCode].weightedPoints += (credits * gp);
    semestersMap[termCode].courses.push(r);

    totalDegreeAttemptedCredits += credits;
    if (isPass) {
      totalDegreeEarnedCredits += credits;
    }
    totalDegreeWeightedGradePoints += (credits * gp);
  }

  // Calculate SGPA for each semester
  const semesterSummaries = Object.values(semestersMap).map(sem => {
    const sgpa = sem.attemptedCredits > 0
      ? Math.round((sem.weightedPoints / sem.attemptedCredits) * 100) / 100
      : 0.00;
    return {
      ...sem,
      attemptedCredits: Math.round(sem.attemptedCredits * 100) / 100,
      earnedCredits: Math.round(sem.earnedCredits * 100) / 100,
      sgpa: sgpa.toFixed(2)
    };
  });

  // Calculate Cumulative CGPA
  const cgpa = totalDegreeAttemptedCredits > 0
    ? Math.round((totalDegreeWeightedGradePoints / totalDegreeAttemptedCredits) * 100) / 100
    : 0.00;

  let academicStanding = 'Good Standing';
  if (cgpa >= 3.75) academicStanding = 'Dean\'s Honor List';
  else if (cgpa >= 3.50) academicStanding = 'Distinction';
  else if (cgpa < 2.25 && totalDegreeAttemptedCredits > 0) academicStanding = 'Academic Warning';

  return res.json({
    student,
    summary: {
      totalCoursesCompleted: results.length,
      totalCreditsAttempted: Math.round(totalDegreeAttemptedCredits * 100) / 100,
      totalCreditsEarned: Math.round(totalDegreeEarnedCredits * 100) / 100,
      cgpa: cgpa.toFixed(2),
      academicStanding,
      graduationRequirement: '164.5 Credits'
    },
    semesters: semesterSummaries,
    allResults: results
  });
}

// ==========================================
// 3. GET COURSE RESULT SHEET (TEACHER / OFFICE)
// ==========================================
router.get('/course/:courseId', authenticateUser, (req, res) => {
  try {
    const { courseId } = req.params;

    const course = db.prepare(`
      SELECT c.*, sem.semester_name, sess.session_name, sess.id as session_id
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      JOIN academic_sessions sess ON sess.id = sem.session_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Fetch all enrolled students and any existing results for this course
    const studentResults = db.prepare(`
      SELECT s.id as student_id,
             s.student_roll,
             s.registration_no,
             u.first_name || ' ' || u.last_name as student_name,
             r.id as result_id,
             COALESCE(r.continuous_assessment_marks, 0) as continuous_assessment_marks,
             COALESCE(r.final_exam_marks, 0) as final_exam_marks,
             COALESCE(r.total_marks, 0) as total_marks,
             COALESCE(r.grade_point, 0.00) as grade_point,
             COALESCE(r.letter_grade, 'F') as letter_grade,
             COALESCE(r.credits_earned, 0.0) as credits_earned,
             COALESCE(r.is_passed, 0) as is_passed,
             r.status as result_status,
             r.updated_at
      FROM course_enrollments ce
      JOIN students s ON s.id = ce.student_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN student_results r ON r.course_id = ce.course_id AND r.student_id = ce.student_id
      WHERE ce.course_id = ? AND ce.enrollment_status = 'ENROLLED'
      ORDER BY s.student_roll ASC
    `).all(courseId);

    return res.json({
      course,
      totalEnrolled: studentResults.length,
      results: studentResults
    });
  } catch (err) {
    console.error('[Course Results API] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch course results: ' + err.message });
  }
});

// ==========================================
// 4. SUBMIT / UPDATE MARKS & RESULT ENTRY (TEACHER OR OFFICE)
// ==========================================
router.post('/entry', authenticateUser, (req, res) => {
  try {
    const { courseId, studentId, continuousAssessmentMarks, finalExamMarks, status = 'PUBLISHED' } = req.body;

    if (!courseId || !studentId) {
      return res.status(400).json({ error: 'Course ID and Student ID are required.' });
    }

    // Fetch course details
    const course = db.prepare(`
      SELECT c.*, sem.session_id, sem.id as semester_id
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const caMarks = Math.max(0, Math.min(30, parseFloat(continuousAssessmentMarks) || 0));
    const feMarks = Math.max(0, Math.min(70, parseFloat(finalExamMarks) || 0));
    const totalMarks = Math.round((caMarks + feMarks) * 10) / 10;

    const { letterGrade, gradePoint, isPassed } = calculateGrade(totalMarks);
    const creditsEarned = isPassed ? course.credit_hours : 0.0;

    const resultId = 'res-' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO student_results (
        id, student_id, course_id, session_id, semester_id,
        continuous_assessment_marks, final_exam_marks, total_marks,
        grade_point, letter_grade, credits_earned, is_passed, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(student_id, course_id) DO UPDATE SET
        continuous_assessment_marks = excluded.continuous_assessment_marks,
        final_exam_marks = excluded.final_exam_marks,
        total_marks = excluded.total_marks,
        grade_point = excluded.grade_point,
        letter_grade = excluded.letter_grade,
        credits_earned = excluded.credits_earned,
        is_passed = excluded.is_passed,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      resultId, studentId, courseId, course.session_id, course.semester_id,
      caMarks, feMarks, totalMarks, gradePoint, letterGrade, creditsEarned, isPassed ? 1 : 0, status
    );

    return res.json({
      message: `Result recorded for ${course.course_code}: Total ${totalMarks}/100, Grade ${letterGrade} (${gradePoint.toFixed(2)})`,
      result: {
        courseId,
        studentId,
        continuousAssessmentMarks: caMarks,
        finalExamMarks: feMarks,
        totalMarks,
        letterGrade,
        gradePoint,
        creditsEarned,
        isPassed
      }
    });
  } catch (err) {
    console.error('[Result Entry API] Error:', err);
    return res.status(500).json({ error: 'Failed to record student result: ' + err.message });
  }
});

// ==========================================
// 5. BATCH SUBMIT RESULTS (TEACHER OR OFFICE)
// ==========================================
router.post('/batch-entry', authenticateUser, (req, res) => {
  try {
    const { courseId, entries = [], status = 'PUBLISHED' } = req.body;

    if (!courseId || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Course ID and entries array are required.' });
    }

    const course = db.prepare(`
      SELECT c.*, sem.session_id, sem.id as semester_id
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const upsertStmt = db.prepare(`
      INSERT INTO student_results (
        id, student_id, course_id, session_id, semester_id,
        continuous_assessment_marks, final_exam_marks, total_marks,
        grade_point, letter_grade, credits_earned, is_passed, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(student_id, course_id) DO UPDATE SET
        continuous_assessment_marks = excluded.continuous_assessment_marks,
        final_exam_marks = excluded.final_exam_marks,
        total_marks = excluded.total_marks,
        grade_point = excluded.grade_point,
        letter_grade = excluded.letter_grade,
        credits_earned = excluded.credits_earned,
        is_passed = excluded.is_passed,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `);

    let processedCount = 0;
    const transaction = db.transaction(() => {
      for (const entry of entries) {
        if (!entry.studentId) continue;
        const caMarks = Math.max(0, Math.min(30, parseFloat(entry.continuousAssessmentMarks) || 0));
        const feMarks = Math.max(0, Math.min(70, parseFloat(entry.finalExamMarks) || 0));
        const totalMarks = Math.round((caMarks + feMarks) * 10) / 10;
        const { letterGrade, gradePoint, isPassed } = calculateGrade(totalMarks);
        const creditsEarned = isPassed ? course.credit_hours : 0.0;
        const resId = 'res-' + crypto.randomUUID();

        upsertStmt.run(
          resId, entry.studentId, courseId, course.session_id, course.semester_id,
          caMarks, feMarks, totalMarks, gradePoint, letterGrade, creditsEarned, isPassed ? 1 : 0, status
        );
        processedCount++;
      }
    });

    transaction();

    return res.json({
      message: `Successfully processed results for ${processedCount} students in ${course.course_code}!`,
      totalProcessed: processedCount
    });
  } catch (err) {
    console.error('[Batch Results API] Error:', err);
    return res.status(500).json({ error: 'Failed to record batch results: ' + err.message });
  }
});

module.exports = router;
