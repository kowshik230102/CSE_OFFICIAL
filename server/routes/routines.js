const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { ensureSessionWithStandardCourses } = require('../utils/sessionSync');

// 1. GET ALL SAVED ROUTINES
router.get('/', authenticateUser, (req, res) => {
  try {
    const routines = db.prepare(`
      SELECT r.id, r.type, r.title, r.status, r.session_id, r.semester_id, r.created_at, r.updated_at,
             s.session_name,
             sem.semester_name, sem.term_code,
             u.first_name || ' ' || u.last_name as creator_name,
             u.role as creator_role
      FROM routines r
      LEFT JOIN academic_sessions s ON s.id = r.session_id
      LEFT JOIN semesters sem ON sem.id = r.semester_id
      LEFT JOIN users u ON u.id = r.created_by
      ORDER BY r.updated_at DESC
    `).all();

    return res.json({ routines });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch routines: ' + err.message });
  }
});

// 2. GET TEACHER BUSY SLOTS ACROSS ALL ROUTINES (For Smart Conflict Prevention & Auto-Schedule)
router.get('/teacher-busy-slots', authenticateUser, (req, res) => {
  try {
    const routines = db.prepare(`
      SELECT r.id, r.session_id, r.routine_data, s.session_name
      FROM routines r
      LEFT JOIN academic_sessions s ON s.id = r.session_id
      WHERE r.type = 'CLASS_ROUTINE'
    `).all();

    // Map: teacher_id or teacher_name -> array of occupied slots
    const teacherSchedules = {};

    for (const r of routines) {
      try {
        const data = JSON.parse(r.routine_data);
        if (data && Array.isArray(data.sessions)) {
          for (const sess of data.sessions) {
            const sessName = sess.sessionName || r.session_name || 'Unknown Session';
            if (Array.isArray(sess.courses)) {
              for (const course of sess.courses) {
                const teacherKey = course.teacherId || course.teacherName?.trim().toLowerCase();
                if (teacherKey && Array.isArray(course.timeSlots)) {
                  if (!teacherSchedules[teacherKey]) {
                    teacherSchedules[teacherKey] = [];
                  }
                  for (const slot of course.timeSlots) {
                    teacherSchedules[teacherKey].push({
                      day: slot.day,
                      timeSlot: slot.timeSlot,
                      courseCode: course.courseCode,
                      courseTitle: course.courseTitle,
                      sessionName: sessName,
                      roomNumber: slot.roomNumber || course.roomNumber || ''
                    });
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }

    return res.json({ teacherSchedules });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to aggregate teacher schedules: ' + err.message });
  }
});

// 3. GET SINGLE ROUTINE BY ID
router.get('/:id', authenticateUser, (req, res) => {
  try {
    const routine = db.prepare(`
      SELECT r.*,
             s.session_name,
             sem.semester_name, sem.term_code,
             u.first_name || ' ' || u.last_name as creator_name
      FROM routines r
      LEFT JOIN academic_sessions s ON s.id = r.session_id
      LEFT JOIN semesters sem ON sem.id = r.semester_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = ?
    `).get(req.params.id);

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found.' });
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(routine.routine_data);
    } catch (e) {
      parsedData = {};
    }

    return res.json({
      routine: {
        ...routine,
        routineData: parsedData
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve routine: ' + err.message });
  }
});

// 4. CREATE / SAVE NEW ROUTINE
router.post('/', authenticateUser, (req, res) => {
  const { type, title, sessionId, semesterId, routineData, status, sessionName, startClassDate } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Routine title is required.' });
  }

  // Parse routineData if provided as object or JSON string
  let parsedData = {};
  if (typeof routineData === 'object' && routineData !== null) {
    parsedData = routineData;
  } else if (typeof routineData === 'string') {
    try {
      parsedData = JSON.parse(routineData);
    } catch (e) {
      parsedData = {};
    }
  }

  // Auto-create or ensure session exists if added in routine or start class date is given
  let finalSessionId = sessionId;
  const targetSessionName = sessionName || parsedData.sessionName || parsedData.session_name;
  const targetStartDate = startClassDate || parsedData.startClassDate || parsedData.start_date;
  const targetEndDate = parsedData.endClassDate || parsedData.end_date;

  if (targetSessionName) {
    const ensured = ensureSessionWithStandardCourses(targetSessionName, targetStartDate, targetEndDate);
    if (ensured) finalSessionId = ensured.id;
  } else if (sessionId) {
    const existing = db.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!existing) {
      const ensured = ensureSessionWithStandardCourses(sessionId, targetStartDate, targetEndDate);
      if (ensured) finalSessionId = ensured.id;
    }
  }

  const routineType = type === 'EXAM_ROUTINE' ? 'EXAM_ROUTINE' : 'CLASS_ROUTINE';
  const routineId = 'rtn-' + crypto.randomUUID();
  const dataString = typeof routineData === 'string' ? routineData : JSON.stringify(parsedData);
  const routineStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

  try {
    db.prepare(`
      INSERT INTO routines (id, type, title, session_id, semester_id, routine_data, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      routineId,
      routineType,
      title.trim(),
      finalSessionId || null,
      semesterId || null,
      dataString,
      routineStatus,
      req.user.id
    );

    return res.status(201).json({
      message: 'Routine saved successfully!',
      id: routineId,
      sessionId: finalSessionId,
      status: routineStatus
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save routine: ' + err.message });
  }
});

// 5. UPDATE EXISTING ROUTINE
router.put('/:id', authenticateUser, (req, res) => {
  const { title, sessionId, semesterId, routineData, status, sessionName, startClassDate } = req.body;
  const routineId = req.params.id;

  const existing = db.prepare('SELECT id FROM routines WHERE id = ?').get(routineId);
  if (!existing) {
    return res.status(404).json({ error: 'Routine not found.' });
  }

  // Parse routineData
  let parsedData = {};
  if (typeof routineData === 'object' && routineData !== null) {
    parsedData = routineData;
  } else if (typeof routineData === 'string') {
    try {
      parsedData = JSON.parse(routineData);
    } catch (e) {
      parsedData = {};
    }
  }

  let finalSessionId = sessionId;
  const targetSessionName = sessionName || parsedData.sessionName || parsedData.session_name;
  const targetStartDate = startClassDate || parsedData.startClassDate || parsedData.start_date;
  const targetEndDate = parsedData.endClassDate || parsedData.end_date;

  if (targetSessionName) {
    const ensured = ensureSessionWithStandardCourses(targetSessionName, targetStartDate, targetEndDate);
    if (ensured) finalSessionId = ensured.id;
  } else if (sessionId) {
    const existingSess = db.prepare('SELECT id FROM academic_sessions WHERE id = ?').get(sessionId);
    if (!existingSess) {
      const ensured = ensureSessionWithStandardCourses(sessionId, targetStartDate, targetEndDate);
      if (ensured) finalSessionId = ensured.id;
    }
  }

  try {
    const dataString = routineData ? (typeof routineData === 'string' ? routineData : JSON.stringify(routineData)) : undefined;

    db.prepare(`
      UPDATE routines
      SET title = COALESCE(?, title),
          session_id = COALESCE(?, session_id),
          semester_id = COALESCE(?, semester_id),
          routine_data = COALESCE(?, routine_data),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      sessionId !== undefined ? sessionId : null,
      semesterId !== undefined ? semesterId : null,
      dataString || null,
      status || null,
      routineId
    );

    return res.json({ message: 'Routine updated successfully!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update routine: ' + err.message });
  }
});

// 6. DELETE ROUTINE
router.delete('/:id', authenticateUser, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM routines WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Routine not found.' });
    }
    return res.json({ message: 'Routine deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete routine: ' + err.message });
  }
});

// 7. PUBLISH ROUTINE AS OFFICIAL NOTICE (Notice Board Integration)
router.post('/:id/publish', authenticateUser, (req, res) => {
  const routineId = req.params.id;
  const { customNote } = req.body;

  try {
    const routine = db.prepare(`
      SELECT r.*,
             s.session_name,
             sem.semester_name, sem.term_code
      FROM routines r
      LEFT JOIN academic_sessions s ON s.id = r.session_id
      LEFT JOIN semesters sem ON sem.id = r.semester_id
      WHERE r.id = ?
    `).get(routineId);

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found.' });
    }

    let routineData = {};
    try {
      routineData = JSON.parse(routine.routine_data);
    } catch (e) {
      routineData = {};
    }

    const isClassRoutine = routine.type === 'CLASS_ROUTINE';
    const noticeCategory = isClassRoutine ? 'Academic' : 'Exam';

    // Format content nicely into clean markdown representation
    let formattedContent = `### Official ${isClassRoutine ? 'Class' : 'Exam'} Timetable\n`;
    formattedContent += `**Department of Computer Science & Engineering**\n`;
    if (routine.session_name) formattedContent += `**Session:** ${routine.session_name} | `;
    if (routine.semester_name) formattedContent += `**Semester:** ${routine.semester_name}\n\n`;

    if (customNote && customNote.trim()) {
      formattedContent += `> *Notice Note:* ${customNote.trim()}\n\n`;
    }

    if (isClassRoutine) {
      formattedContent += `| Day | Time Slot | Course Code & Title | Teacher | Department | Phone | Room |\n`;
      formattedContent += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      if (Array.isArray(routineData.sessions)) {
        for (const sess of routineData.sessions) {
          if (Array.isArray(sess.courses)) {
            for (const c of sess.courses) {
              const teacherDept = c.teacherDept || 'CSE';
              const teacherPhone = c.teacherPhone || 'N/A';
              const teacherName = c.teacherName || 'TBA';
              if (Array.isArray(c.timeSlots) && c.timeSlots.length > 0) {
                for (const slot of c.timeSlots) {
                  formattedContent += `| **${slot.day}** | ${slot.timeSlot} | **${c.courseCode}** - ${c.courseTitle} | ${teacherName} | ${teacherDept} | ${teacherPhone} | ${slot.roomNumber || c.roomNumber || 'TBA'} |\n`;
                }
              } else {
                formattedContent += `| TBA | TBA | **${c.courseCode}** - ${c.courseTitle} | ${teacherName} | ${teacherDept} | ${teacherPhone} | ${c.roomNumber || 'TBA'} |\n`;
              }
            }
          }
        }
      }
    } else {
      // Exam Routine format
      formattedContent += `| Sl | Date & Day | Time Slot | Course Code & Title | Room / Hall | Invigilator / Teacher | Contact |\n`;
      formattedContent += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      if (Array.isArray(routineData.exams)) {
        for (let i = 0; i < routineData.exams.length; i++) {
          const ex = routineData.exams[i];
          formattedContent += `| ${ex.serial || (i + 1)} | **${ex.date || 'TBA'}** (${ex.day || ''}) | ${ex.timeSlot || '10:00 AM - 01:00 PM'} | **${ex.courseCode}** - ${ex.courseTitle} | ${ex.roomNumber || 'TBA'} | ${ex.invigilatorName || ex.teacherName || 'Faculty Member'} | ${ex.teacherPhone || 'N/A'} |\n`;
        }
      }
    }

    formattedContent += `\n*Published officially by the Routine Committee & Department of CSE.*`;

    // Create Notice
    const noticeId = 'not-' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO notices (id, author_id, title, content, category, target_type, target_session_id, target_semester_id, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      noticeId,
      req.user.id,
      routine.title,
      formattedContent,
      noticeCategory,
      routine.session_id ? 'SESSION_SEMESTER_SPECIFIC' : 'DEPARTMENT_WIDE',
      routine.session_id || null,
      routine.semester_id || null
    );

    // Update routine status to PUBLISHED
    db.prepare(`
      UPDATE routines
      SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(routineId);

    return res.json({
      message: 'Routine published successfully to Notice Board!',
      noticeId
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to publish routine: ' + err.message });
  }
});

module.exports = router;
