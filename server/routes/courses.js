const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { db } = require('../db/schema');
const config = require('../config');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { verifyCourseFaculty } = require('../middleware/courseOwnership');

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${basename}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// 1. GET ALL COURSES ASSIGNED TO THE LOGGED-IN TEACHER
router.get('/my-assigned', authenticateUser, requireRoles(['TEACHER']), (req, res) => {
  const teacherId = req.user.teacherId;
  if (!teacherId) {
    return res.status(403).json({ error: 'No teacher profile found.' });
  }

  const assignedCourses = db.prepare(`
    SELECT c.*, sem.semester_name, sem.term_code, sess.session_name, sess.id as session_id,
           (SELECT COUNT(*) FROM course_materials WHERE course_id = c.id) as materials_count,
           (SELECT COUNT(DISTINCT student_id) FROM ct_marks WHERE course_id = c.id) as marked_students_count
    FROM courses c
    JOIN course_assignments ca ON ca.course_id = c.id
    JOIN semesters sem ON sem.id = c.semester_id
    JOIN academic_sessions sess ON sess.id = sem.session_id
    WHERE ca.teacher_id = ?
    ORDER BY c.course_code ASC
  `).all(teacherId);

  return res.json({ courses: assignedCourses });
});

// 1B. GET ALL DEPARTMENT COURSES FOR CHAIRMAN & ADMIN OVERSIGHT
router.get('/department-oversight', authenticateUser, (req, res) => {
  const isChair = req.user.email === 'chair.cse_pust@gmail.com' || 
                  (req.user.designation && req.user.designation.toLowerCase().includes('chair')) ||
                  ['ADMIN', 'OFFICE_STAFF'].includes(req.user.role);

  if (!isChair) {
    return res.status(403).json({ error: 'Access restricted to Department Chairman and Administrators.' });
  }

  const courses = db.prepare(`
    SELECT c.*, sem.semester_name, sem.term_code, sess.session_name, sess.id as session_id,
           ca.teacher_id as assigned_teacher_id,
           u.first_name || ' ' || u.last_name as assigned_teacher_name,
           u.email as assigned_teacher_email,
           t.designation as assigned_teacher_designation,
           t.room_number as assigned_teacher_room,
           (SELECT COUNT(*) FROM course_materials WHERE course_id = c.id) as materials_count,
           (SELECT COUNT(DISTINCT student_id) FROM ct_marks WHERE course_id = c.id) as marked_students_count,
           (SELECT COUNT(*) FROM students s WHERE s.current_session_id = sem.session_id) as enrolled_students_count
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    JOIN academic_sessions sess ON sess.id = sem.session_id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN teachers t ON t.id = ca.teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    ORDER BY c.course_code ASC
  `).all();

  return res.json({ courses });
});

// 2. GET DETAILED COURSE OVERVIEW (Open to all authenticated users)
router.get('/:courseId', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const course = db.prepare(`
    SELECT c.*, sem.id as semester_id, sem.semester_name, sem.term_code, 
           sess.id as session_id, sess.session_name,
           ca.teacher_id as assigned_teacher_id,
           u.first_name || ' ' || u.last_name as assigned_teacher_name,
           u.email as assigned_teacher_email,
           t.designation as assigned_teacher_designation,
           t.room_number as assigned_teacher_room
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    JOIN academic_sessions sess ON sess.id = sem.session_id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN teachers t ON t.id = ca.teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE c.id = ?
  `).get(courseId);

  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  // Check if current user is the assigned teacher
  const isAssignedTeacher =
    req.user.role === 'ADMIN' ||
    req.user.role === 'OFFICE_STAFF' ||
    (req.user.role === 'TEACHER' && req.user.teacherId === course.assigned_teacher_id);

  return res.json({ course, isAssignedTeacher });
});

// 3. GET COURSE MATERIALS (Open to all authenticated users)
router.get('/:courseId/materials', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const materials = db.prepare(`
    SELECT m.*, u.first_name || ' ' || u.last_name as uploader_name
    FROM course_materials m
    JOIN teachers t ON t.id = m.uploaded_by
    JOIN users u ON u.id = t.user_id
    WHERE m.course_id = ?
    ORDER BY m.created_at DESC
  `).all(courseId);

  return res.json({ materials });
});

// 4. UPLOAD COURSE MATERIAL (STRICTLY ASSIGNED TEACHER OR OFFICE/ADMIN)
router.post(
  '/:courseId/materials',
  authenticateUser,
  verifyCourseFaculty,
  upload.single('file'),
  (req, res) => {
    const { courseId } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Material title is required.' });
    }

    let fileUrl = req.body.fileUrl || '';
    let fileType = 'link';
    let fileSize = 0;

    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Please upload a file or provide a resource URL.' });
    }

    // Determine uploader teacherId (or fallback for admin/office)
    let uploaderId = req.user.teacherId;
    if (!uploaderId) {
      // If office/admin, link to the assigned teacher of the course
      const assignment = db.prepare('SELECT teacher_id FROM course_assignments WHERE course_id = ?').get(courseId);
      uploaderId = assignment ? assignment.teacher_id : 't-1';
    }

    const materialId = 'mat-' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO course_materials (id, course_id, uploaded_by, title, description, file_url, file_type, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(materialId, courseId, uploaderId, title, description || '', fileUrl, fileType, fileSize);

    return res.status(201).json({ message: 'Course material uploaded successfully!', materialId });
  }
);

// 5. DELETE COURSE MATERIAL (STRICTLY ASSIGNED TEACHER OR OFFICE/ADMIN)
router.delete('/:courseId/materials/:materialId', authenticateUser, verifyCourseFaculty, (req, res) => {
  const { courseId, materialId } = req.params;
  const material = db.prepare('SELECT file_url FROM course_materials WHERE id = ? AND course_id = ?').get(materialId, courseId);
  
  if (!material) {
    return res.status(404).json({ error: 'Material not found.' });
  }

  // Remove physical file if in uploads
  if (material.file_url.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '..', material.file_url);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
  }

  db.prepare('DELETE FROM course_materials WHERE id = ?').run(materialId);
  return res.json({ message: 'Material removed successfully.' });
});

// 6. GET CT MARKS FOR COURSE
router.get('/:courseId/ct-marks', authenticateUser, (req, res) => {
  const { courseId } = req.params;
  const user = req.user;

  // Retrieve course session
  const courseInfo = db.prepare(`
    SELECT c.id, sem.session_id, ca.teacher_id as assigned_teacher_id
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    WHERE c.id = ?
  `).get(courseId);

  if (!courseInfo) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  // If student: return their individual marks + anonymized class stats for rank calculation
  if (user.role === 'STUDENT') {
    const studentMarks = db.prepare(`
      SELECT m.*, u.first_name || ' ' || u.last_name as teacher_name
      FROM ct_marks m
      JOIN teachers t ON t.id = m.recorded_by
      JOIN users u ON u.id = t.user_id
      WHERE m.course_id = ? AND m.student_id = ?
      ORDER BY m.ct_number ASC
    `).all(courseId, user.studentId);

    // Fetch all course marks for relative position and class metrics
    const allCourseMarks = db.prepare(`
      SELECT student_id, ct_number, obtained_marks, max_marks
      FROM ct_marks
      WHERE course_id = ?
    `).all(courseId);

    return res.json({
      role: 'STUDENT',
      marks: studentMarks,
      allCourseMarks,
    });
  }

  // For Teachers, Office Staff, and Admin: return full roster matrix
  const allStudentsInSession = db.prepare(`
    SELECT s.id as student_id, s.student_roll, s.registration_no,
           u.first_name || ' ' || u.last_name as student_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.current_session_id = ?
    ORDER BY s.student_roll ASC
  `).all(courseInfo.session_id);

  const existingMarks = db.prepare(`
    SELECT m.*, s.student_roll
    FROM ct_marks m
    JOIN students s ON s.id = m.student_id
    WHERE m.course_id = ?
  `).all(courseId);

  return res.json({
    role: user.role,
    students: allStudentsInSession,
    marks: existingMarks,
  });
});

// 7. SINGLE CT MARK UPSERT (Assigned Teacher or Admin/Office)
router.post('/:courseId/ct-marks/single', authenticateUser, verifyCourseFaculty, (req, res) => {
  const { courseId } = req.params;
  const { studentId, ctNumber, obtainedMarks, maxMarks, remarks } = req.body;

  if (!studentId || ctNumber === undefined || obtainedMarks === undefined) {
    return res.status(400).json({ error: 'Student ID, assessment number, and obtained marks are required.' });
  }

  let teacherId = req.user.teacherId;
  if (!teacherId) {
    const ca = db.prepare('SELECT teacher_id FROM course_assignments WHERE course_id = ?').get(courseId);
    teacherId = ca ? ca.teacher_id : 't-1';
  }

  const markId = 'ct-' + crypto.randomUUID();
  const upsert = db.prepare(`
    INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(course_id, student_id, ct_number) DO UPDATE SET
      obtained_marks = excluded.obtained_marks,
      max_marks = excluded.max_marks,
      recorded_by = excluded.recorded_by,
      remarks = excluded.remarks,
      updated_at = CURRENT_TIMESTAMP
  `);

  upsert.run(
    markId,
    courseId,
    studentId,
    teacherId,
    parseInt(ctNumber),
    parseFloat(obtainedMarks),
    parseFloat(maxMarks || 10.0),
    remarks || ''
  );

  return res.json({ message: 'Mark recorded successfully!' });
});

// 7b. MATRIX SAVE: BATCH UPSERT FOR FULL CONTINUOUS ASSESSMENT (CT 1, 2, 3 + Attendance)
router.post('/:courseId/ct-marks/matrix-save', authenticateUser, verifyCourseFaculty, (req, res) => {
  const { courseId } = req.params;
  const { matrix } = req.body; // Array of { studentId, ct1, ct2, ct3, attendance, remarks }

  if (!Array.isArray(matrix)) {
    return res.status(400).json({ error: 'Matrix array is required.' });
  }

  let teacherId = req.user.teacherId;
  if (!teacherId) {
    const ca = db.prepare('SELECT teacher_id FROM course_assignments WHERE course_id = ?').get(courseId);
    teacherId = ca ? ca.teacher_id : 't-1';
  }

  const upsert = db.prepare(`
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
      const assessments = [
        { ctNumber: 1, val: item.ct1 },
        { ctNumber: 2, val: item.ct2 },
        { ctNumber: 3, val: item.ct3 },
        { ctNumber: 4, val: item.attendance }, // 4 = Attendance (max 10)
      ];

      for (const a of assessments) {
        if (a.val !== undefined && a.val !== null && a.val !== '' && !isNaN(a.val)) {
          const markId = 'ct-' + crypto.randomUUID();
          upsert.run(
            markId,
            courseId,
            item.studentId,
            teacherId,
            a.ctNumber,
            Math.min(10.0, Math.max(0.0, parseFloat(a.val))),
            10.0,
            item.remarks || ''
          );
        }
      }
    }
  });

  try {
    saveTx();
    return res.json({ message: 'Continuous Assessment matrix saved successfully!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save marks matrix: ' + err.message });
  }
});

// 8. GENERATE / DOWNLOAD CSV TEMPLATE FOR BULK MARKS
router.get('/:courseId/ct-marks/template', authenticateUser, verifyCourseFaculty, (req, res) => {
  const { courseId } = req.params;
  const course = db.prepare(`
    SELECT c.course_code, sem.session_id
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    WHERE c.id = ?
  `).get(courseId);

  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }

  const students = db.prepare(`
    SELECT s.student_roll, u.first_name || ' ' || u.last_name as student_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.current_session_id = ?
    ORDER BY s.student_roll ASC
  `).all(course.session_id);

  let csvContent = 'student_roll,student_name,marks,remarks\n';
  students.forEach((s) => {
    csvContent += `"${s.student_roll}","${s.student_name}","",\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${course.course_code}_CT_Marks_Template.csv"`);
  return res.send(csvContent);
});

// 9. BULK EXCEL/CSV MARKS UPLOAD (Assigned Teacher or Admin/Office)
router.post(
  '/:courseId/ct-marks/bulk',
  authenticateUser,
  verifyCourseFaculty,
  upload.single('file'),
  (req, res) => {
    const { courseId } = req.params;
    const { ctNumber, maxMarks, rawCsvText } = req.body;

    let fileContent = '';
    if (req.file) {
      fileContent = fs.readFileSync(req.file.path, 'utf8');
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    } else if (rawCsvText) {
      fileContent = rawCsvText;
    } else {
      return res.status(400).json({ error: 'Please upload a CSV file or paste CSV text data.' });
    }

    if (!ctNumber || isNaN(ctNumber) || parseInt(ctNumber) < 1) {
      return res.status(400).json({ error: 'Valid CT number is required (e.g., 1, 2, 3).' });
    }

    const maximumMarks = parseFloat(maxMarks) || 20.0;

    let records;
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid CSV format: ' + parseErr.message });
    }

    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no valid data rows.' });
    }

    // Determine recording teacher ID
    let teacherId = req.user.teacherId;
    if (!teacherId) {
      const ca = db.prepare('SELECT teacher_id FROM course_assignments WHERE course_id = ?').get(courseId);
      teacherId = ca ? ca.teacher_id : 't-1';
    }

    // Lookup students
    const allStudents = db.prepare('SELECT id, student_roll FROM students').all();
    const studentMap = new Map(allStudents.map((s) => [s.student_roll.toUpperCase(), s.id]));

    const validEntries = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const roll = (row.student_roll || row.roll || '').toUpperCase().trim();
      const markStr = row.marks !== undefined ? row.marks : row.mark;

      if (!roll) {
        errors.push(`Row ${i + 1}: Missing student roll number.`);
        continue;
      }

      const studentId = studentMap.get(roll);
      if (!studentId) {
        errors.push(`Row ${i + 1}: Student with roll '${roll}' not found in the department database.`);
        continue;
      }

      if (markStr === '' || markStr === null || markStr === undefined) {
        // Skip empty rows without error
        continue;
      }

      const marks = parseFloat(markStr);
      if (isNaN(marks) || marks < 0 || marks > maximumMarks) {
        errors.push(`Row ${i + 1} (${roll}): Marks '${markStr}' must be a number between 0 and ${maximumMarks}.`);
        continue;
      }

      validEntries.push({
        studentId,
        roll,
        obtainedMarks: marks,
        remarks: row.remarks || '',
      });
    }

    if (errors.length > 0 && validEntries.length === 0) {
      return res.status(422).json({ error: 'Upload rejected due to errors.', details: errors });
    }

    // Perform atomic transaction
    const upsertStmt = db.prepare(`
      INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(course_id, student_id, ct_number) DO UPDATE SET
        obtained_marks = excluded.obtained_marks,
        max_marks = excluded.max_marks,
        recorded_by = excluded.recorded_by,
        remarks = excluded.remarks,
        updated_at = CURRENT_TIMESTAMP
    `);

    const commitTransaction = db.transaction(() => {
      for (const entry of validEntries) {
        const markId = 'ct-' + crypto.randomUUID();
        upsertStmt.run(
          markId,
          courseId,
          entry.studentId,
          teacherId,
          parseInt(ctNumber),
          entry.obtainedMarks,
          maximumMarks,
          entry.remarks
        );
      }
    });

    try {
      commitTransaction();
      return res.json({
        message: `Successfully uploaded CT-${ctNumber} marks for ${validEntries.length} students!`,
        totalProcessed: validEntries.length,
        errors: errors.length > 0 ? errors : null,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Database transaction error: ' + err.message });
    }
  }
);

// 10. AI AUTOMATIC MARKS EXTRACTION & CALCULATION (ANY FILE: PDF, EXCEL, CSV, TEXT)
const { extractMarksFromFile } = require('../utils/aiMarkExtractor');
router.post(
  '/:courseId/ct-marks/auto-detect',
  authenticateUser,
  verifyCourseFaculty,
  upload.single('file'),
  async (req, res) => {
    const { courseId } = req.params;
    const { rawText } = req.body;

    const courseInfo = db.prepare(`
      SELECT c.id, c.course_code, c.course_title, sem.session_id
      FROM courses c
      JOIN semesters sem ON sem.id = c.semester_id
      WHERE c.id = ?
    `).get(courseId);

    if (!courseInfo) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const enrolledStudents = db.prepare(`
      SELECT s.id as student_id, s.student_roll, s.registration_no,
             u.first_name || ' ' || u.last_name as student_name
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.current_session_id = ?
      ORDER BY s.student_roll ASC
    `).all(courseInfo.session_id);

    let buffer = null;
    let fileName = '';
    let mimeType = '';

    if (req.file) {
      buffer = fs.readFileSync(req.file.path);
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    } else if (rawText) {
      fileName = 'pasted_marks.txt';
      mimeType = 'text/plain';
    } else {
      return res.status(400).json({ error: 'Please upload a PDF, Excel (.xlsx/.xls), CSV, or paste text data.' });
    }

    try {
      const extractionResult = await extractMarksFromFile({
        buffer,
        fileName,
        mimeType,
        rawText,
        enrolledStudents,
      });

      return res.json(extractionResult);
    } catch (err) {
      console.error('[AI Mark Auto-Detect] Error:', err);
      return res.status(500).json({ error: 'Failed to auto-detect marks: ' + err.message });
    }
  }
);

module.exports = router;

