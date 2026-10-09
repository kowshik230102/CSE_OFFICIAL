const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/schema');
const { authenticateUser, requireRoles } = require('../middleware/auth');
const { ensureSessionWithStandardCourses } = require('../utils/sessionSync');
const {
  SCHEDULE_DAYS,
  SCHEDULE_PERIODS,
  TEACHING_PERIOD_IDS,
  BREAK_PERIOD_ID,
  checkSlotConflict,
  validateEntireSchedule,
  calculateWeeklyHours,
  generateSmartSchedule,
  diffRoutines
} = require('../utils/scheduleConfig');

// Helper to convert term code (e.g. Y1S1) to short notation (1-1)
function getShortTerm(termCode, semesterName) {
  if (!termCode) return semesterName || '';
  const tc = termCode.toUpperCase().trim();
  if (tc === 'Y1S1') return '1-1';
  if (tc === 'Y1S2') return '1-2';
  if (tc === 'Y2S1') return '2-1';
  if (tc === 'Y2S2') return '2-2';
  if (tc === 'Y3S1') return '3-1';
  if (tc === 'Y3S2') return '3-2';
  if (tc === 'Y4S1') return '4-1';
  if (tc === 'Y4S2') return '4-2';
  return termCode;
}

// Helper to determine teacher short code / initials for PUST CSE
function getTeacherShortCode(name) {
  if (!name) return '';
  const n = name.trim();
  if (n.includes('Abdur Rahim')) return 'Dr. AR';
  if (n.includes('Shafiul Azam')) return 'MSA';
  if (n.includes('Hasan Sazzad Iqbal')) return 'HSI';
  if (n.includes('Toukir Ahmed')) return 'Dr. TA';
  if (n.includes('Khaled Ben Islam')) return 'KBI';
  if (n.includes('Niaz Imtiaz')) return 'Dr. NI';
  if (n.includes('Nitun Kumar Podder')) return 'NKP';
  if (n.includes('Nakib Aman')) return 'NA';
  if (n.includes('Mahmudur Rahman')) return 'Dr. MR';
  if (n.includes('Sadia Fatima')) return 'Dr. SF';
  // Generic fallback:
  const cleaned = n.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '');
  const prefix = n.toLowerCase().startsWith('dr.') ? 'Dr. ' : '';
  const parts = cleaned.split(/\s+/);
  const initials = parts.map(p => p[0]?.toUpperCase()).join('');
  return prefix + (initials || n.slice(0, 3).toUpperCase());
}

// Helper to automatically load all semesters & courses for a session
function loadFullSessionSemesters(sessionId = null) {
  try {
    const curSession = sessionId
      ? db.prepare(`SELECT id, session_name FROM academic_sessions WHERE id = ?`).get(sessionId)
      : (db.prepare(`SELECT id, session_name FROM academic_sessions WHERE is_current = 1`).get()
         || db.prepare(`SELECT id, session_name FROM academic_sessions ORDER BY session_name DESC LIMIT 1`).get());

    if (!curSession) return [];

    const sems = db.prepare(`
      SELECT id, semester_name, term_code
      FROM semesters
      WHERE session_id = ?
      ORDER BY term_code ASC
    `).all(curSession.id);

    // Fetch existing teacher assignments for this session/department to pre-populate
    const teacherCourses = db.prepare(`
      SELECT tc.course_code, tc.teacher_id, t.designation, t.department_code, t.room_number,
             u.first_name || ' ' || u.last_name as full_name
      FROM teacher_courses tc
      JOIN teachers t ON t.id = tc.teacher_id
      JOIN users u ON u.id = t.user_id
      WHERE tc.session_name = ? OR tc.is_current = 1
    `).all(curSession.session_name);

    const teacherMap = new Map();
    for (const tc of teacherCourses) {
      if (tc.course_code && !teacherMap.has(tc.course_code.toUpperCase())) {
        teacherMap.set(tc.course_code.toUpperCase(), {
          type: 'department',
          teacherId: tc.teacher_id,
          teacherName: tc.full_name,
          designation: tc.designation || 'Faculty Member',
          department: tc.department_code || 'CSE',
          departmentNumber: tc.room_number || '',
          phoneNumber: '',
          shortCode: getTeacherShortCode(tc.full_name)
        });
      }
    }

    return sems.map(s => {
      const courses = db.prepare(`
        SELECT id, course_code, course_title, credit_hours, course_type, year, semester
        FROM courses
        WHERE semester_id = ?
        ORDER BY course_code ASC
      `).all(s.id).map(c => {
        const codeKey = (c.course_code || '').trim().toUpperCase();
        const existingTeacher = teacherMap.get(codeKey);

        return {
          id: c.id,
          courseId: c.id,
          courseCode: c.course_code,
          courseTitle: c.course_title,
          creditHours: Number(c.credit_hours) || 3.0,
          weeklyHours: Number(c.credit_hours) || 3.0,
          courseType: c.course_type || 'Theory',
          year: c.year,
          semester: c.semester,
          assignmentStatus: existingTeacher ? 'Assigned' : 'Pending',
          status: 'ACTIVE',
          lifecycle_status: 'ACTIVE',
          isIncluded: true,
          inRoutine: true,
          teacher: existingTeacher || {
            type: 'none',
            teacherId: null,
            teacherName: 'Not Assigned',
            designation: '',
            department: 'CSE',
            departmentNumber: '',
            shortCode: ''
          }
        };
      });

      const studentCount = db.prepare(`
        SELECT count(*) as count
        FROM students
        WHERE current_session_id = ?
      `).get(curSession.id)?.count || 0;

      return {
        semesterId: s.id,
        semesterName: s.semester_name,
        termCode: s.term_code,
        shortTerm: getShortTerm(s.term_code, s.semester_name),
        sessionId: curSession.id,
        sessionName: curSession.session_name,
        totalStudents: studentCount,
        excludedStudentIds: [],
        courses
      };
    });
  } catch (err) {
    console.error('Error loading session semesters:', err);
    return [];
  }
}

// 0. GET ALL DEPARTMENT FACULTY TEACHERS (Meta for Teacher Assignment)
router.get('/meta/teachers', authenticateUser, (req, res) => {
  try {
    const teachers = db.prepare(`
      SELECT t.id as teacher_id, t.designation, t.department_code, t.room_number,
             u.id as user_id, u.first_name, u.last_name, u.email, u.phone_number
      FROM teachers t
      JOIN users u ON u.id = t.user_id
      WHERE u.status = 'ACTIVE'
      ORDER BY u.first_name ASC
    `).all();

    const formatted = teachers.map(t => {
      const fullName = `${t.first_name} ${t.last_name}`.trim();
      return {
        teacherId: t.teacher_id,
        userId: t.user_id,
        fullName,
        designation: t.designation || 'Faculty Member',
        department: t.department_code || 'CSE',
        roomNumber: t.room_number || '',
        shortCode: getTeacherShortCode(fullName),
        email: t.email,
        phoneNumber: t.phone_number || ''
      };
    });

    return res.json({ teachers: formatted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch teachers: ' + err.message });
  }
});

// 0.5 GET OFFICIAL SCHEDULE CONFIG (Meta for Timetable Grid)
router.get('/meta/schedule-config', authenticateUser, (req, res) => {
  return res.json({
    days: SCHEDULE_DAYS,
    periods: SCHEDULE_PERIODS,
    teachingPeriodIds: TEACHING_PERIOD_IDS,
    breakPeriodId: BREAK_PERIOD_ID,
    commonRooms: [
      '501',
      '502',
      '504',
      'R-504',
      'R-519',
      'ACL',
      'S/W Lab',
      'Robotics Lab',
      'Hardware Lab',
      'Project'
    ]
  });
});

// 0.6 VALIDATE TIMETABLE SCHEDULE FOR CONFLICTS
router.post('/validate-schedule', authenticateUser, (req, res) => {
  const { candidateSlot, existingSchedule, excludeSlotId, slots } = req.body;

  // Mode A: Single candidate slot validation
  if (candidateSlot) {
    const conflict = checkSlotConflict(candidateSlot, existingSchedule || [], excludeSlotId || null);
    return res.json({
      hasConflict: conflict.hasConflict,
      conflict
    });
  }

  // Mode B: Full schedule validation
  const scheduleSlots = Array.isArray(slots) ? slots : (Array.isArray(existingSchedule) ? existingSchedule : []);
  const conflicts = validateEntireSchedule(scheduleSlots);
  return res.json({
    isValid: conflicts.length === 0,
    conflictCount: conflicts.length,
    conflicts
  });
});

// 1. GET ACADEMIC SESSIONS & SEMESTERS TREE (Meta for Add Semester)
router.get('/meta/academic-tree', authenticateUser, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT id, session_name, start_date, end_date, is_current
      FROM academic_sessions
      ORDER BY session_name DESC
    `).all();

    const academicTree = sessions.map(sess => {
      const semesters = db.prepare(`
        SELECT id, semester_name, term_code
        FROM semesters
        WHERE session_id = ?
        ORDER BY term_code ASC
      `).all(sess.id);

      const studentCount = db.prepare(`
        SELECT count(*) as count
        FROM students
        WHERE current_session_id = ?
      `).get(sess.id)?.count || 0;

      return {
        id: sess.id,
        sessionName: sess.session_name,
        isCurrent: Boolean(sess.is_current),
        totalStudents: studentCount,
        semesters: semesters.map(sem => {
          const courseCount = db.prepare(`
            SELECT count(*) as count
            FROM courses
            WHERE semester_id = ?
          `).get(sem.id)?.count || 0;

          return {
            id: sem.id,
            semesterName: sem.semester_name,
            termCode: sem.term_code,
            shortTerm: getShortTerm(sem.term_code, sem.semester_name),
            courseCount
          };
        })
      };
    });

    return res.json({ academicTree, sessions: academicTree });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch academic tree: ' + err.message });
  }
});

// 2. GET FULL SEMESTER DETAILS (Auto-loads Courses & Enrolled Students from DB)
router.get('/meta/semester/:semesterId', authenticateUser, (req, res) => {
  try {
    const sem = db.prepare(`
      SELECT sem.id, sem.semester_name, sem.term_code, sem.session_id,
             s.session_name
      FROM semesters sem
      JOIN academic_sessions s ON s.id = sem.session_id
      WHERE sem.id = ?
    `).get(req.params.semesterId);

    if (!sem) {
      return res.status(404).json({ error: 'Semester not found.' });
    }

    // Auto-load registered courses from courses table
    const courses = db.prepare(`
      SELECT id, course_code, course_title, credit_hours, course_type,
             year, semester
      FROM courses
      WHERE semester_id = ?
      ORDER BY course_code ASC
    `).all(sem.id);

    // Auto-load students belonging to this semester's academic session
    const students = db.prepare(`
      SELECT st.id as student_id, st.user_id, st.serial_no, st.student_roll, st.registration_no,
             u.first_name || ' ' || u.last_name as student_name,
             u.phone_number as contact_no
      FROM students st
      JOIN users u ON u.id = st.user_id
      WHERE st.current_session_id = ?
      ORDER BY st.serial_no ASC, st.student_roll ASC
    `).all(sem.session_id);

    return res.json({
      semester: {
        id: sem.id,
        semesterName: sem.semester_name,
        termCode: sem.term_code,
        shortTerm: getShortTerm(sem.term_code, sem.semester_name),
        sessionId: sem.session_id,
        sessionName: sem.session_name
      },
      courses: courses.map(c => ({
        id: c.id,
        courseId: c.id,
        courseCode: c.course_code,
        courseTitle: c.course_title,
        creditHours: Number(c.credit_hours) || 3.0,
        weeklyHours: Number(c.credit_hours) || 3.0,
        courseType: c.course_type || 'Theory',
        year: c.year,
        semester: c.semester,
        assignmentStatus: 'Pending',
        teacher: {
          type: 'none',
          teacherId: null,
          teacherName: 'Not Assigned',
          designation: '',
          department: 'CSE',
          departmentNumber: '',
          shortCode: ''
        }
      })),
      students: students.map(st => ({
        studentId: st.student_id,
        userId: st.user_id,
        serialNo: st.serial_no,
        studentRoll: st.student_roll,
        registrationNo: st.registration_no,
        studentName: st.student_name,
        contactNo: st.contact_no || ''
      })),
      totalStudents: students.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load semester details: ' + err.message });
  }
});

// 2.5 GET CURRENT ACTIVE / LATEST PUBLISHED CLASS ROUTINE & DASHBOARD STATS
router.get('/active', authenticateUser, (req, res) => {
  try {
    let routine = db.prepare(`
      SELECT r.*,
             s.session_name,
             sem.semester_name, sem.term_code,
             u.first_name || ' ' || u.last_name as creator_name
      FROM routines r
      LEFT JOIN academic_sessions s ON s.id = r.session_id
      LEFT JOIN semesters sem ON sem.id = r.semester_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.type = 'CLASS_ROUTINE' AND (r.is_active = 1 OR r.status = 'PUBLISHED')
      ORDER BY r.is_active DESC, r.updated_at DESC
      LIMIT 1
    `).get();

    if (!routine) {
      routine = db.prepare(`
        SELECT r.*,
               s.session_name,
               sem.semester_name, sem.term_code,
               u.first_name || ' ' || u.last_name as creator_name
        FROM routines r
        LEFT JOIN academic_sessions s ON s.id = r.session_id
        LEFT JOIN semesters sem ON sem.id = r.semester_id
        LEFT JOIN users u ON u.id = r.created_by
        WHERE r.type = 'CLASS_ROUTINE'
        ORDER BY r.updated_at DESC
        LIMIT 1
      `).get();
    }

    if (!routine) {
      const curSession = db.prepare(`SELECT id, session_name FROM academic_sessions WHERE is_current = 1`).get()
        || db.prepare(`SELECT id, session_name FROM academic_sessions ORDER BY session_name DESC LIMIT 1`).get();
      const adminUser = db.prepare(`SELECT id, first_name, last_name FROM users WHERE role = 'ADMIN' LIMIT 1`).get()
        || db.prepare(`SELECT id, first_name, last_name FROM users LIMIT 1`).get();

      const newRoutineId = 'rtn-' + crypto.randomUUID();
      const fullSemesters = loadFullSessionSemesters(curSession ? curSession.id : null);
      
      const newRoutineData = {
        routineName: 'Department of CSE Official Class Routine',
        department: 'CSE',
        academicYear: curSession ? curSession.session_name : 'Session 2026-2027',
        effectiveFrom: new Date().toISOString().split('T')[0],
        semesters: fullSemesters,
        schedule: []
      };

      db.prepare(`
        INSERT INTO routines (
          id, type, title, department, effective_from, academic_year,
          session_id, routine_data, status, is_active, created_by
        )
        VALUES (?, 'CLASS_ROUTINE', ?, 'CSE', ?, ?, ?, ?, 'DRAFT', 1, ?)
      `).run(
        newRoutineId,
        newRoutineData.routineName,
        newRoutineData.effectiveFrom,
        newRoutineData.academicYear,
        curSession ? curSession.id : null,
        JSON.stringify(newRoutineData),
        adminUser ? adminUser.id : null
      );

      routine = db.prepare(`
        SELECT r.*,
               s.session_name,
               sem.semester_name, sem.term_code,
               u.first_name || ' ' || u.last_name as creator_name
        FROM routines r
        LEFT JOIN academic_sessions s ON s.id = r.session_id
        LEFT JOIN semesters sem ON sem.id = r.semester_id
        LEFT JOIN users u ON u.id = r.created_by
        WHERE r.id = ?
      `).get(newRoutineId);
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(routine.routine_data);
    } catch (e) {
      parsedData = {};
    }

    let semesters = Array.isArray(parsedData.semesters) ? parsedData.semesters : [];
    let schedule = Array.isArray(parsedData.schedule) ? parsedData.schedule : [];

    if (semesters.length === 0) {
      semesters = loadFullSessionSemesters(routine.session_id);
      parsedData.semesters = semesters;
      try {
        db.prepare('UPDATE routines SET routine_data = ? WHERE id = ?').run(JSON.stringify(parsedData), routine.id);
      } catch (e) { /* ignore */ }
    }

    let totalActiveCourses = 0;
    const assignedTeacherSet = new Set();
    let totalWeeklyClassHours = 0;

    semesters.forEach(sem => {
      const courses = Array.isArray(sem.courses) ? sem.courses : [];
      courses.forEach(c => {
        if (c.status !== 'ARCHIVED' && c.status !== 'COMPLETED' && c.isIncluded !== false) {
          totalActiveCourses++;
          const tName = c.teacher?.teacherName;
          if (tName && tName !== 'Not Assigned') {
            assignedTeacherSet.add(c.teacher?.teacherId || tName);
          }
        }
      });
    });

    schedule.forEach(slot => {
      totalWeeklyClassHours += Number(slot.span || 1);
    });

    return res.json({
      routine: {
        id: routine.id,
        type: routine.type,
        title: routine.title,
        department: routine.department || parsedData.department || 'CSE',
        effectiveFrom: routine.effective_from || parsedData.effectiveFrom || null,
        academicYear: routine.academic_year || parsedData.academicYear || routine.session_name || '',
        status: routine.status,
        versionNumber: routine.version_number || parsedData.version || 'v1.0',
        isActive: Boolean(routine.is_active),
        sessionId: routine.session_id,
        sessionName: routine.session_name,
        semesterId: routine.semester_id,
        semesterName: routine.semester_name,
        termCode: routine.term_code,
        creatorName: routine.creator_name,
        createdAt: routine.created_at,
        updatedAt: routine.updated_at,
        semesters,
        schedule,
        routineData: parsedData
      },
      stats: {
        department: routine.department || 'CSE',
        academicYear: routine.academic_year || routine.session_name || 'Session 2026-2027',
        semestersCount: semesters.length,
        semesterNames: semesters.map(s => s.shortTerm || s.termCode || s.semesterName).join(', ') || 'Department Wide',
        totalActiveCourses,
        totalAssignedTeachers: assignedTeacherSet.size,
        totalWeeklyClassHours,
        lastUpdated: routine.updated_at
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve active routine: ' + err.message });
  }
});

// 2.6 SMART AUTOMATIC TIMETABLE GENERATION
router.post('/auto-generate', authenticateUser, (req, res) => {
  try {
    const { semesters, existingSlots, options } = req.body;
    const result = generateSmartSchedule({
      semesters: semesters || [],
      existingSlots: existingSlots || [],
      options: options || {}
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Auto-generation error: ' + err.message });
  }
});

// 2.7 GET SAVED NON-DEPARTMENT TEACHERS (Prevent duplicate entries)
router.get('/non-dept-teachers', authenticateUser, (req, res) => {
  try {
    const teachers = db.prepare(`
      SELECT * FROM non_dept_teachers
      ORDER BY name ASC
    `).all();

    return res.json({ teachers });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch non-department teachers: ' + err.message });
  }
});

// 2.8 SAVE OR UPDATE NON-DEPARTMENT TEACHER RECORD
router.post('/non-dept-teachers', authenticateUser, (req, res) => {
  try {
    const { name, department, phoneNumber, designation, email } = req.body;
    if (!name || !name.trim() || !department || !department.trim()) {
      return res.status(400).json({ error: 'Teacher Name and Department are required.' });
    }

    const cleanName = name.trim();
    const cleanDept = department.trim();
    const cleanPhone = (phoneNumber || '').trim();

    if (cleanPhone && !/^[+0-9\s-]{6,20}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }

    const existing = db.prepare('SELECT id FROM non_dept_teachers WHERE LOWER(name) = LOWER(?) AND LOWER(department) = LOWER(?)').get(cleanName, cleanDept);

    let teacherId = existing ? existing.id : 'ndt-' + crypto.randomUUID();

    if (existing) {
      db.prepare(`
        UPDATE non_dept_teachers
        SET phone_number = COALESCE(?, phone_number),
            designation = COALESCE(?, designation),
            email = COALESCE(?, email)
        WHERE id = ?
      `).run(cleanPhone || null, designation || null, email || null, teacherId);
    } else {
      db.prepare(`
        INSERT INTO non_dept_teachers (id, name, department, phone_number, designation, email)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(teacherId, cleanName, cleanDept, cleanPhone || null, designation || null, email || null);
    }

    return res.json({
      message: 'Non-department teacher saved successfully.',
      teacher: {
        id: teacherId,
        name: cleanName,
        department: cleanDept,
        phoneNumber: cleanPhone,
        designation: designation || '',
        email: email || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save non-department teacher: ' + err.message });
  }
});

// 2.9 SYNCHRONIZE TEACHER PROFILES FROM ROUTINE ASSIGNMENTS
router.post('/sync-teachers', authenticateUser, (req, res) => {
  try {
    const { routineId, semesters, schedule } = req.body;
    if (!Array.isArray(semesters)) {
      return res.status(400).json({ error: 'Semesters list is required.' });
    }

    const routine = routineId ? db.prepare('SELECT * FROM routines WHERE id = ?').get(routineId) : null;
    const sessionName = routine?.academic_year || 'Session 2026-2027';

    let syncedCount = 0;

    const upsertTeacherCourse = db.prepare(`
      INSERT INTO teacher_courses (
        id, teacher_id, course_code, course_title, course_type,
        target_dept, session_name, semester_name, credit_hours,
        weekly_schedule, class_end_date, is_current
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now', '+4 months'), 1)
      ON CONFLICT(id) DO UPDATE SET
        weekly_schedule = excluded.weekly_schedule,
        is_current = 1
    `);

    const upsertCourseAssignment = db.prepare(`
      INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by, assigned_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(course_id, teacher_id) DO UPDATE SET
        assigned_at = CURRENT_TIMESTAMP
    `);

    const slotsByCourse = {};
    if (Array.isArray(schedule)) {
      schedule.forEach(s => {
        const key = `${s.semesterId}_${s.courseCode}`;
        if (!slotsByCourse[key]) slotsByCourse[key] = [];
        slotsByCourse[key].push(`${s.day.slice(0, 3)} ${s.periodId?.toUpperCase()} (${s.room})`);
      });
    }

    const transaction = db.transaction(() => {
      semesters.forEach(sem => {
        const courses = Array.isArray(sem.courses) ? sem.courses : [];
        courses.forEach(c => {
          const t = c.teacher;
          if (!t || t.type === 'none' || !t.teacherName || t.teacherName === 'Not Assigned') {
            return;
          }

          const slotKey = `${sem.semesterId || sem.id}_${c.courseCode}`;
          const scheduleStr = (slotsByCourse[slotKey] || []).join(', ') || 'Scheduled in routine';

          if (t.type === 'department' && t.teacherId) {
            const dbCourse = db.prepare('SELECT id FROM courses WHERE UPPER(course_code) = UPPER(?)').get(c.courseCode);
            if (dbCourse) {
              const caId = 'ca-' + crypto.randomUUID();
              try {
                upsertCourseAssignment.run(caId, dbCourse.id, t.teacherId, req.user.id);
              } catch (e) { /* ignore */ }
            }

            const tcExisting = db.prepare(`
              SELECT id, teacher_id FROM teacher_courses
              WHERE UPPER(course_code) = UPPER(?) AND session_name = ?
            `).get(c.courseCode, sessionName);

            if (tcExisting && tcExisting.teacher_id !== t.teacherId) {
              db.prepare('UPDATE teacher_courses SET is_current = 0 WHERE id = ?').run(tcExisting.id);
            }

            const tcId = tcExisting && tcExisting.teacher_id === t.teacherId ? tcExisting.id : 'tc-' + crypto.randomUUID();
            upsertTeacherCourse.run(
              tcId,
              t.teacherId,
              c.courseCode,
              c.courseTitle,
              'DEPARTMENT',
              'CSE',
              sessionName,
              sem.semesterName || sem.shortTerm || 'Current Semester',
              Number(c.creditHours) || 3.0,
              scheduleStr
            );
            syncedCount++;
          } else if (t.type === 'non_department') {
            const ndtName = t.teacherName.trim();
            const ndtDept = (t.department || 'External').trim();
            const ndtPhone = (t.departmentNumber || t.phoneNumber || '').trim();
            const ndtDesig = (t.designation || 'External Faculty').trim();

            const existingNdt = db.prepare('SELECT id FROM non_dept_teachers WHERE LOWER(name) = LOWER(?) AND LOWER(department) = LOWER(?)').get(ndtName, ndtDept);
            const ndtId = existingNdt ? existingNdt.id : 'ndt-' + crypto.randomUUID();
            if (!existingNdt) {
              db.prepare(`
                INSERT INTO non_dept_teachers (id, name, department, phone_number, designation)
                VALUES (?, ?, ?, ?, ?)
              `).run(ndtId, ndtName, ndtDept, ndtPhone || null, ndtDesig);
            }
            syncedCount++;
          }
        });
      });
    });

    transaction();

    return res.json({
      message: `Teacher profiles synchronized successfully for ${syncedCount} course assignment(s)!`,
      syncedCount
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to sync teacher profiles: ' + err.message });
  }
});

// 2.95 COURSE LIFECYCLE STATUS (ACTIVE, COMPLETED, ARCHIVED)
router.patch('/courses/:courseId/status', authenticateUser, (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE, COMPLETED, or ARCHIVED.' });
    }

    db.prepare(`
      UPDATE courses
      SET lifecycle_status = ?
      WHERE id = ?
    `).run(status, req.params.courseId);

    return res.json({
      message: `Course status updated to ${status}.`,
      courseId: req.params.courseId,
      status
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update course status: ' + err.message });
  }
});

// 2.96 COPY SEMESTER CONFIGURATION (Courses, Teachers, Timetable)
router.post('/copy-semester', authenticateUser, (req, res) => {
  try {
    const { sourceSemesterId, targetSemesterId, copyCourses } = req.body;

    const sourceSem = db.prepare('SELECT * FROM semesters WHERE id = ?').get(sourceSemesterId);
    const targetSem = db.prepare('SELECT * FROM semesters WHERE id = ?').get(targetSemesterId);

    if (!sourceSem || !targetSem) {
      return res.status(404).json({ error: 'Source or target semester not found.' });
    }

    const sourceCourses = db.prepare('SELECT * FROM courses WHERE semester_id = ?').all(sourceSemesterId);

    let copiedCoursesCount = 0;
    if (copyCourses !== false) {
      const insertCourse = db.prepare(`
        INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline, lifecycle_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        ON CONFLICT(semester_id, course_code) DO UPDATE SET
          course_title = excluded.course_title,
          credit_hours = excluded.credit_hours,
          course_type = excluded.course_type
      `);

      sourceCourses.forEach(sc => {
        const newCId = 'c-' + crypto.randomUUID();
        insertCourse.run(
          newCId,
          targetSemesterId,
          sc.course_code,
          sc.course_title,
          sc.credit_hours,
          sc.course_type,
          targetSem.year || sc.year,
          targetSem.semester || sc.semester,
          targetSem.term_code,
          sc.is_optional,
          sc.elective_group,
          sc.syllabus_outline
        );
        copiedCoursesCount++;
      });
    }

    return res.json({
      message: `Semester configuration copied successfully! (${copiedCoursesCount} courses processed)`,
      copiedCoursesCount
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to copy semester configuration: ' + err.message });
  }
});

// 3. GET ALL SAVED ROUTINES
router.get('/', authenticateUser, (req, res) => {
  try {
    const routines = db.prepare(`
      SELECT r.id, r.type, r.title, r.department, r.effective_from, r.academic_year,
             r.status, r.session_id, r.semester_id, r.created_at, r.updated_at,
             s.session_name,
             sem.semester_name, sem.term_code,
             u.first_name || ' ' || u.last_name as creator_name,
             u.role as creator_role,
             r.routine_data
      FROM routines r
      LEFT JOIN academic_sessions s ON s.id = r.session_id
      LEFT JOIN semesters sem ON sem.id = r.semester_id
      LEFT JOIN users u ON u.id = r.created_by
      ORDER BY r.updated_at DESC
    `).all();

    const formatted = routines.map(r => {
      let parsed = {};
      try {
        parsed = JSON.parse(r.routine_data);
      } catch (e) {
        parsed = {};
      }

      const semestersList = Array.isArray(parsed?.semesters) ? parsed.semesters : [];
      const semesterCount = semestersList.length > 0 ? semestersList.length : (r.semester_id ? 1 : 0);
      const semesterNames = semestersList.map(s => s.shortTerm || s.termCode || s.semesterName).filter(Boolean).join(', ');

      return {
        id: r.id,
        type: r.type,
        title: r.title,
        department: r.department || parsed.department || 'CSE',
        effectiveFrom: r.effective_from || parsed.effectiveFrom || null,
        academicYear: r.academic_year || parsed.academicYear || r.session_name || '',
        status: r.status,
        sessionId: r.session_id,
        sessionName: r.session_name,
        semesterId: r.semester_id,
        semesterName: r.semester_name,
        termCode: r.term_code,
        semesterCount,
        semesterNames,
        creatorName: r.creator_name,
        creatorRole: r.creator_role,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });

    return res.json({ routines: formatted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch routines: ' + err.message });
  }
});

// 3.5 GET TEACHER WORKLOAD FOR A SPECIFIC ROUTINE
router.get('/:id/teacher-workload', authenticateUser, (req, res) => {
  try {
    const routine = db.prepare('SELECT id, title, routine_data FROM routines WHERE id = ?').get(req.params.id);
    if (!routine) {
      return res.status(404).json({ error: 'Routine not found.' });
    }

    let parsed = {};
    try {
      parsed = JSON.parse(routine.routine_data);
    } catch (e) {
      parsed = {};
    }

    const semesters = Array.isArray(parsed?.semesters) ? parsed.semesters : [];

    // 1. Fetch all active department teachers as the baseline
    const deptTeachers = db.prepare(`
      SELECT t.id as teacher_id, t.designation, t.department_code, t.room_number,
             u.id as user_id, u.first_name, u.last_name, u.email
      FROM teachers t
      JOIN users u ON u.id = t.user_id
      WHERE u.status = 'ACTIVE'
      ORDER BY u.first_name ASC
    `).all();

    // Workload map keyed by teacher identifier
    const workloadMap = {};

    // Initialize all department teachers
    for (const dt of deptTeachers) {
      const fullName = `${dt.first_name} ${dt.last_name}`.trim();
      workloadMap[`dept_${dt.teacher_id}`] = {
        teacherId: dt.teacher_id,
        userId: dt.user_id,
        teacherName: fullName,
        type: 'department',
        designation: dt.designation || 'Faculty Member',
        department: dt.department_code || 'CSE',
        shortCode: getTeacherShortCode(fullName),
        courseCount: 0,
        weeklyHours: 0,
        assignedCourses: []
      };
    }

    // 2. Scan all courses across all semesters in this routine
    semesters.forEach(sem => {
      const courses = Array.isArray(sem.courses) ? sem.courses : [];
      courses.forEach(course => {
        const teacher = course.teacher;
        const status = course.assignmentStatus;

        // Skip unassigned or pending courses
        if (!teacher || teacher.type === 'none' || status === 'Pending' || teacher.teacherName === 'Not Assigned') {
          return;
        }

        const weeklyHrs = Number(course.weeklyHours || course.creditHours || 3);
        const courseSummary = {
          courseId: course.courseId || course.id,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          creditHours: Number(course.creditHours || 3),
          weeklyHours: weeklyHrs,
          courseType: course.courseType || 'Theory',
          semesterId: sem.semesterId || sem.id,
          semesterName: sem.semesterName,
          termCode: sem.termCode,
          shortTerm: sem.shortTerm || sem.termCode
        };

        if (teacher.type === 'department' && teacher.teacherId) {
          const key = `dept_${teacher.teacherId}`;
          if (!workloadMap[key]) {
            workloadMap[key] = {
              teacherId: teacher.teacherId,
              userId: null,
              teacherName: teacher.teacherName,
              type: 'department',
              designation: teacher.designation || '',
              department: teacher.department || 'CSE',
              shortCode: teacher.shortCode || getTeacherShortCode(teacher.teacherName),
              courseCount: 0,
              weeklyHours: 0,
              assignedCourses: []
            };
          }
          workloadMap[key].courseCount += 1;
          workloadMap[key].weeklyHours += weeklyHrs;
          workloadMap[key].assignedCourses.push(courseSummary);
        } else if (teacher.type === 'non_department') {
          const cleanName = (teacher.teacherName || 'Unknown Non-Dept Teacher').trim();
          const cleanDept = (teacher.department || 'External').trim();
          const key = `non_dept_${cleanName.toLowerCase()}_${cleanDept.toLowerCase()}`;
          if (!workloadMap[key]) {
            workloadMap[key] = {
              teacherId: null,
              userId: null,
              teacherName: cleanName,
              type: 'non_department',
              designation: teacher.designation || 'External Faculty',
              department: cleanDept,
              departmentNumber: teacher.departmentNumber || '',
              shortCode: teacher.shortCode || cleanDept,
              courseCount: 0,
              weeklyHours: 0,
              assignedCourses: []
            };
          }
          workloadMap[key].courseCount += 1;
          workloadMap[key].weeklyHours += weeklyHrs;
          workloadMap[key].assignedCourses.push(courseSummary);
        }
      });
    });

    const teacherWorkloads = Object.values(workloadMap);

    return res.json({
      routineId: routine.id,
      routineTitle: routine.title,
      workloads: teacherWorkloads
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to calculate teacher workload: ' + err.message });
  }
});

// 4. GET SINGLE ROUTINE BY ID
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

    if (!Array.isArray(parsedData.semesters) || parsedData.semesters.length === 0) {
      parsedData.semesters = loadFullSessionSemesters(routine.session_id);
      try {
        db.prepare('UPDATE routines SET routine_data = ? WHERE id = ?').run(JSON.stringify(parsedData), routine.id);
      } catch (e) { /* ignore */ }
    }

    return res.json({
      routine: {
        id: routine.id,
        type: routine.type,
        title: routine.title,
        department: routine.department || parsedData.department || 'CSE',
        effectiveFrom: routine.effective_from || parsedData.effectiveFrom || null,
        academicYear: routine.academic_year || parsedData.academicYear || routine.session_name || '',
        status: routine.status,
        sessionId: routine.session_id,
        sessionName: routine.session_name,
        semesterId: routine.semester_id,
        semesterName: routine.semester_name,
        termCode: routine.term_code,
        creatorName: routine.creator_name,
        createdAt: routine.created_at,
        updatedAt: routine.updated_at,
        semesters: parsedData.semesters || [],
        schedule: parsedData.schedule || [],
        routineData: parsedData
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve routine: ' + err.message });
  }
});

// 5. CREATE / SAVE NEW ROUTINE
router.post('/', authenticateUser, (req, res) => {
  const { 
    type, 
    title, 
    department, 
    effectiveFrom, 
    academicYear, 
    sessionId, 
    semesterId, 
    routineData, 
    status 
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Routine title is required.' });
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

  // Ensure metadata is synchronized in parsedData
  parsedData.routineName = title.trim();
  parsedData.department = department || parsedData.department || 'CSE';
  parsedData.effectiveFrom = effectiveFrom || parsedData.effectiveFrom || null;
  parsedData.academicYear = academicYear || parsedData.academicYear || '';
  if (req.body.semesters !== undefined) parsedData.semesters = req.body.semesters;
  if (req.body.schedule !== undefined) parsedData.schedule = req.body.schedule;

  if (!Array.isArray(parsedData.semesters) || parsedData.semesters.length === 0) {
    parsedData.semesters = loadFullSessionSemesters(sessionId);
  }

  const routineType = type === 'EXAM_ROUTINE' ? 'EXAM_ROUTINE' : 'CLASS_ROUTINE';
  const routineId = 'rtn-' + crypto.randomUUID();
  const dataString = JSON.stringify(parsedData);
  const routineStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

  try {
    db.prepare(`
      INSERT INTO routines (
        id, type, title, department, effective_from, academic_year,
        session_id, semester_id, routine_data, status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      routineId,
      routineType,
      title.trim(),
      parsedData.department,
      parsedData.effectiveFrom,
      parsedData.academicYear,
      sessionId || null,
      semesterId || null,
      dataString,
      routineStatus,
      req.user.id
    );

    return res.status(201).json({
      message: 'Routine created successfully!',
      id: routineId,
      status: routineStatus
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save routine: ' + err.message });
  }
});

// 6. UPDATE EXISTING ROUTINE
router.put('/:id', authenticateUser, (req, res) => {
  const { 
    title, 
    department, 
    effectiveFrom, 
    academicYear, 
    sessionId, 
    semesterId, 
    routineData, 
    status 
  } = req.body;
  const routineId = req.params.id;

  const existing = db.prepare('SELECT id, routine_data FROM routines WHERE id = ?').get(routineId);
  if (!existing) {
    return res.status(404).json({ error: 'Routine not found.' });
  }

  let parsedData = {};
  if (typeof routineData === 'object' && routineData !== null) {
    parsedData = routineData;
  } else if (typeof routineData === 'string') {
    try {
      parsedData = JSON.parse(routineData);
    } catch (e) {
      parsedData = {};
    }
  } else {
    try {
      parsedData = JSON.parse(existing.routine_data);
    } catch (e) {
      parsedData = {};
    }
  }

  if (title) parsedData.routineName = title.trim();
  if (department) parsedData.department = department;
  if (effectiveFrom !== undefined) parsedData.effectiveFrom = effectiveFrom;
  if (academicYear !== undefined) parsedData.academicYear = academicYear;
  if (req.body.semesters !== undefined) parsedData.semesters = req.body.semesters;
  if (req.body.schedule !== undefined) parsedData.schedule = req.body.schedule;

  const dataString = JSON.stringify(parsedData);

  try {
    db.prepare(`
      UPDATE routines
      SET title = COALESCE(?, title),
          department = COALESCE(?, department),
          effective_from = COALESCE(?, effective_from),
          academic_year = COALESCE(?, academic_year),
          session_id = COALESCE(?, session_id),
          semester_id = COALESCE(?, semester_id),
          routine_data = ?,
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      department || null,
      effectiveFrom !== undefined ? effectiveFrom : null,
      academicYear !== undefined ? academicYear : null,
      sessionId !== undefined ? sessionId : null,
      semesterId !== undefined ? semesterId : null,
      dataString,
      status || null,
      routineId
    );

    return res.json({ message: 'Routine updated successfully!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update routine: ' + err.message });
  }
});

// 7. DELETE ROUTINE
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

// 7.5 GET ROUTINE VERSION HISTORY
router.get('/:id/versions', authenticateUser, (req, res) => {
  try {
    const versions = db.prepare(`
      SELECT rv.*,
             u.first_name || ' ' || u.last_name as creator_name
      FROM routine_versions rv
      LEFT JOIN users u ON u.id = rv.created_by
      WHERE rv.routine_id = ?
      ORDER BY rv.created_at DESC
    `).all(req.params.id);

    const formatted = versions.map(v => {
      let changesData = {};
      try { changesData = JSON.parse(v.changes_data || '{}'); } catch (e) {}
      return {
        id: v.id,
        routineId: v.routine_id,
        versionNumber: v.version_number,
        title: v.title,
        department: v.department,
        sessionName: v.session_name,
        semesterNames: v.semester_names,
        effectiveFrom: v.effective_from,
        academicYear: v.academic_year,
        changeSummary: v.change_summary,
        changesData,
        creatorName: v.creator_name,
        createdAt: v.created_at
      };
    });

    return res.json({ versions: formatted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch routine versions: ' + err.message });
  }
});

// 7.6 GET SPECIFIC ROUTINE VERSION SNAPSHOT
router.get('/:id/versions/:versionId', authenticateUser, (req, res) => {
  try {
    const version = db.prepare(`
      SELECT rv.*,
             u.first_name || ' ' || u.last_name as creator_name
      FROM routine_versions rv
      LEFT JOIN users u ON u.id = rv.created_by
      WHERE rv.id = ? AND rv.routine_id = ?
    `).get(req.params.versionId, req.params.id);

    if (!version) {
      return res.status(404).json({ error: 'Routine version snapshot not found.' });
    }

    let routineSnapshot = {};
    try {
      routineSnapshot = JSON.parse(version.routine_snapshot || '{}');
    } catch (e) {}

    let changesData = {};
    try {
      changesData = JSON.parse(version.changes_data || '{}');
    } catch (e) {}

    return res.json({
      version: {
        id: version.id,
        routineId: version.routine_id,
        versionNumber: version.version_number,
        title: version.title,
        department: version.department,
        sessionName: version.session_name,
        semesterNames: version.semester_names,
        effectiveFrom: version.effective_from,
        academicYear: version.academic_year,
        changeSummary: version.change_summary,
        changesData,
        routineSnapshot,
        creatorName: version.creator_name,
        createdAt: version.created_at
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch version snapshot: ' + err.message });
  }
});

// 7.7 SAVE A NEW VERSION SNAPSHOT OF ROUTINE
router.post('/:id/save-version', authenticateUser, (req, res) => {
  try {
    const routineId = req.params.id;
    const { changeSummary, versionNumber, routineData } = req.body;

    const routine = db.prepare('SELECT * FROM routines WHERE id = ?').get(routineId);
    if (!routine) return res.status(404).json({ error: 'Routine not found.' });

    let oldData = {};
    try { oldData = JSON.parse(routine.routine_data); } catch (e) {}

    const newData = routineData || oldData;

    // Diff routines
    const diff = diffRoutines(oldData, newData);

    const count = db.prepare('SELECT count(*) as count FROM routine_versions WHERE routine_id = ?').get(routineId).count;
    const nextVer = versionNumber || `v${count + 1}.0`;

    const versionId = 'ver-' + crypto.randomUUID();
    const semNames = (newData.semesters || []).map(s => s.shortTerm || s.termCode).join(', ');

    db.prepare(`
      INSERT INTO routine_versions (
        id, routine_id, version_number, title, department,
        session_name, semester_names, effective_from, academic_year,
        change_summary, changes_data, routine_snapshot, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      routineId,
      nextVer,
      routine.title,
      routine.department || 'CSE',
      routine.academic_year || '',
      semNames,
      routine.effective_from || null,
      routine.academic_year || '',
      changeSummary || diff.changeSummary,
      JSON.stringify(diff.changesData),
      JSON.stringify(newData),
      req.user.id
    );

    db.prepare('UPDATE routines SET version_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextVer, routineId);

    return res.json({
      message: `Version ${nextVer} saved to Routine History!`,
      versionId,
      versionNumber: nextVer,
      changeSummary: changeSummary || diff.changeSummary
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save routine version: ' + err.message });
  }
});

// 7.8 RESTORE HISTORICAL VERSION (Creates a new audit version preserving all history)
router.post('/:id/restore-version/:versionId', authenticateUser, (req, res) => {
  try {
    const { id: routineId, versionId } = req.params;
    const targetVer = db.prepare('SELECT * FROM routine_versions WHERE id = ? AND routine_id = ?').get(versionId, routineId);
    if (!targetVer) {
      return res.status(404).json({ error: 'Historical version not found.' });
    }

    const routine = db.prepare('SELECT * FROM routines WHERE id = ?').get(routineId);
    if (!routine) return res.status(404).json({ error: 'Routine not found.' });

    const count = db.prepare('SELECT count(*) as count FROM routine_versions WHERE routine_id = ?').get(routineId).count;
    const restoredVerNum = `v${count + 1}.0 (Restored from ${targetVer.version_number})`;

    const newVerId = 'ver-' + crypto.randomUUID();
    const restoreSummary = `Restored timetable configuration from version ${targetVer.version_number} (original date: ${new Date(targetVer.created_at).toLocaleDateString()})`;

    db.prepare(`
      INSERT INTO routine_versions (
        id, routine_id, version_number, title, department,
        session_name, semester_names, effective_from, academic_year,
        change_summary, changes_data, routine_snapshot, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newVerId,
      routineId,
      restoredVerNum,
      targetVer.title,
      targetVer.department,
      targetVer.session_name,
      targetVer.semester_names,
      targetVer.effective_from,
      targetVer.academic_year,
      restoreSummary,
      JSON.stringify({ restoredFromVersion: targetVer.version_number }),
      targetVer.routine_snapshot,
      req.user.id
    );

    db.prepare(`
      UPDATE routines
      SET routine_data = ?,
          version_number = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetVer.routine_snapshot, restoredVerNum, routineId);

    let restoredData = {};
    try { restoredData = JSON.parse(targetVer.routine_snapshot); } catch (e) {}

    return res.json({
      message: `Successfully restored routine from version ${targetVer.version_number}!`,
      restoredVersionNumber: restoredVerNum,
      restoredData
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to restore routine version: ' + err.message });
  }
});

// 8. PUBLISH ROUTINE AS OFFICIAL NOTICE & ACTIVE ROUTINE
router.post('/:id/publish', authenticateUser, (req, res) => {
  const routineId = req.params.id;
  const { customNote, changeSummary } = req.body;

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

    let formattedContent = `### Official ${isClassRoutine ? 'Class' : 'Exam'} Timetable\n`;
    formattedContent += `**Department of ${routine.department || 'Computer Science & Engineering'}**\n`;
    if (routine.academic_year) formattedContent += `**Academic Year / Session:** ${routine.academic_year} | `;
    if (routine.effective_from) formattedContent += `**Effective From:** ${routine.effective_from}\n\n`;

    if (customNote && customNote.trim()) {
      formattedContent += `> *Notice Note:* ${customNote.trim()}\n\n`;
    }

    if (changeSummary && changeSummary.trim()) {
      formattedContent += `**Publication Summary:** ${changeSummary.trim()}\n\n`;
    }

    formattedContent += `\n*Published officially by the Routine Committee & Department of CSE.*`;

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

    // Set as active routine for this type
    if (isClassRoutine) {
      db.prepare("UPDATE routines SET is_active = 0 WHERE type = 'CLASS_ROUTINE'").run();
    }

    const count = db.prepare('SELECT count(*) as count FROM routine_versions WHERE routine_id = ?').get(routineId).count;
    const publishedVersion = `v${count + 1}.0`;

    db.prepare(`
      UPDATE routines
      SET status = 'PUBLISHED',
          is_active = 1,
          version_number = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(publishedVersion, routineId);

    // Save automatic version record in routine_versions
    const versionId = 'ver-' + crypto.randomUUID();
    const semNames = (routineData.semesters || []).map(s => s.shortTerm || s.termCode).join(', ');
    db.prepare(`
      INSERT INTO routine_versions (
        id, routine_id, version_number, title, department,
        session_name, semester_names, effective_from, academic_year,
        change_summary, changes_data, routine_snapshot, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      routineId,
      publishedVersion,
      routine.title,
      routine.department || 'CSE',
      routine.academic_year || '',
      semNames,
      routine.effective_from || null,
      routine.academic_year || '',
      changeSummary || `Published official ${isClassRoutine ? 'class' : 'exam'} routine (${publishedVersion})`,
      JSON.stringify({ publishedNoticeId: noticeId, customNote: customNote || '' }),
      routine.routine_data,
      req.user.id
    );

    // Auto-sync teacher profiles if semesters are present
    if (Array.isArray(routineData.semesters)) {
      try {
        const sessionName = routine.academic_year || 'Session 2026-2027';
        const slotsByCourse = {};
        if (Array.isArray(routineData.schedule)) {
          routineData.schedule.forEach(s => {
            const key = `${s.semesterId}_${s.courseCode}`;
            if (!slotsByCourse[key]) slotsByCourse[key] = [];
            slotsByCourse[key].push(`${s.day.slice(0, 3)} ${s.periodId?.toUpperCase()} (${s.room})`);
          });
        }

        const upsertTeacherCourse = db.prepare(`
          INSERT INTO teacher_courses (
            id, teacher_id, course_code, course_title, course_type,
            target_dept, session_name, semester_name, credit_hours,
            weekly_schedule, class_end_date, is_current
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now', '+4 months'), 1)
          ON CONFLICT(id) DO UPDATE SET
            weekly_schedule = excluded.weekly_schedule,
            is_current = 1
        `);

        routineData.semesters.forEach(sem => {
          (sem.courses || []).forEach(c => {
            const t = c.teacher;
            if (t && t.type === 'department' && t.teacherId) {
              const tcExisting = db.prepare(`
                SELECT id, teacher_id FROM teacher_courses
                WHERE UPPER(course_code) = UPPER(?) AND session_name = ?
              `).get(c.courseCode, sessionName);

              if (tcExisting && tcExisting.teacher_id !== t.teacherId) {
                db.prepare('UPDATE teacher_courses SET is_current = 0 WHERE id = ?').run(tcExisting.id);
              }

              const tcId = tcExisting && tcExisting.teacher_id === t.teacherId ? tcExisting.id : 'tc-' + crypto.randomUUID();
              const slotKey = `${sem.semesterId || sem.id}_${c.courseCode}`;
              const scheduleStr = (slotsByCourse[slotKey] || []).join(', ') || 'Scheduled in routine';

              upsertTeacherCourse.run(
                tcId,
                t.teacherId,
                c.courseCode,
                c.courseTitle,
                'DEPARTMENT',
                'CSE',
                sessionName,
                sem.semesterName || sem.shortTerm || 'Current Semester',
                Number(c.creditHours) || 3.0,
                scheduleStr
              );
            }
          });
        });
      } catch (syncErr) {
        console.error('[Publish Teacher Sync Warning]', syncErr.message);
      }
    }

    return res.json({
      message: `Routine published successfully to Notice Board & set as Active Routine (${publishedVersion})!`,
      noticeId,
      publishedVersion
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to publish routine: ' + err.message });
  }
});

module.exports = router;
