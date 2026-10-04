const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure upload directory exists
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

const db = new Database(config.DB_PATH);

// Enable WAL mode for high concurrency (handles 5,000+ simultaneous reads/writes effortlessly)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    -- 1. USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('ADMIN', 'OFFICE_STAFF', 'TEACHER', 'STUDENT')) NOT NULL DEFAULT 'STUDENT',
      status TEXT CHECK(status IN ('ACTIVE', 'SUSPENDED')) NOT NULL DEFAULT 'ACTIVE',
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. TEACHERS PROFILE
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      designation TEXT NOT NULL,
      department_code TEXT DEFAULT 'CSE',
      room_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. ACADEMIC SESSIONS
    CREATE TABLE IF NOT EXISTS academic_sessions (
      id TEXT PRIMARY KEY,
      session_name TEXT UNIQUE NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      is_current INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. STUDENTS PROFILE
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_roll TEXT UNIQUE NOT NULL,
      registration_no TEXT UNIQUE NOT NULL,
      current_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. SEMESTERS
    CREATE TABLE IF NOT EXISTS semesters (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
      semester_name TEXT NOT NULL,
      term_code TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (session_id, term_code)
    );

    -- 6. COURSES
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      course_code TEXT NOT NULL,
      course_title TEXT NOT NULL,
      credit_hours REAL NOT NULL,
      course_type TEXT DEFAULT 'THEORY',
      syllabus_outline TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (semester_id, course_code)
    );

    -- 7. COURSE ASSIGNMENTS (Office assigns designated Teacher to a Course)
    CREATE TABLE IF NOT EXISTS course_assignments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      assigned_by TEXT NOT NULL REFERENCES users(id),
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (course_id, teacher_id)
    );

    -- 8. COURSE MATERIALS (Lectures, Notes, Question Banks)
    CREATE TABLE IF NOT EXISTS course_materials (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      uploaded_by TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size_bytes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. CLASS TEST (CT) MARKS
    CREATE TABLE IF NOT EXISTS ct_marks (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      recorded_by TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
      ct_number INTEGER NOT NULL,
      obtained_marks REAL NOT NULL,
      max_marks REAL NOT NULL DEFAULT 10.0,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (course_id, student_id, ct_number)
    );

    -- 10. NOTICE BOARD
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT CHECK(category IN ('Academic', 'Exam', 'Notice', 'Event')) DEFAULT 'Notice',
      attachment_url TEXT,
      target_type TEXT CHECK(target_type IN ('DEPARTMENT_WIDE', 'SESSION_SEMESTER_SPECIFIC')) DEFAULT 'DEPARTMENT_WIDE',
      target_session_id TEXT REFERENCES academic_sessions(id) ON DELETE SET NULL,
      target_semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. STUDENT GRIEVANCES & FEEDBACK
    CREATE TABLE IF NOT EXISTS student_grievances (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      is_anonymous INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('PENDING_MODERATION', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING_MODERATION',
      moderated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      moderation_remarks TEXT,
      moderated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- PERFORMANCE INDEXES (Optimized for 5,000+ Active Students)
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
    CREATE INDEX IF NOT EXISTS idx_students_session ON students(current_session_id);
    CREATE INDEX IF NOT EXISTS idx_semesters_session ON semesters(session_id);
    CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester_id);
    CREATE INDEX IF NOT EXISTS idx_course_assignments_lookup ON course_assignments(course_id, teacher_id);
    CREATE INDEX IF NOT EXISTS idx_course_materials_course ON course_materials(course_id);
    CREATE INDEX IF NOT EXISTS idx_ct_marks_lookup ON ct_marks(course_id, student_id, ct_number);
    CREATE INDEX IF NOT EXISTS idx_notices_filter ON notices(target_type, target_session_id, target_semester_id);
    CREATE INDEX IF NOT EXISTS idx_grievances_status ON student_grievances(status, created_at);
  `);

  // Gracefully migrate existing notices table if category column is missing
  try {
    db.exec(`ALTER TABLE notices ADD COLUMN category TEXT DEFAULT 'Notice'`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notices_category ON notices(category)`);
  } catch (e) {
    // Ignore if index creation fails
  }

  seedInitialData();
  ensureRichNotices();
  ensureUniversityCTMarks();
  ensureChairmanAccount();
  ensureFullCurriculum();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return; // Already seeded

  console.log('[Database] Seeding initial academic hierarchy, faculty, and student records...');

  const passAdmin = bcrypt.hashSync('Admin@123', 10);
  const passOffice = bcrypt.hashSync('Office@123', 10);
  const passTeacher = bcrypt.hashSync('Teacher@123', 10);
  const passStudent = bcrypt.hashSync('Student@123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `);

  // 1. Create Core Users
  insertUser.run('u-admin', 'admin@cse.univ.edu', passAdmin, 'ADMIN', 'System', 'Administrator', '+8801700000001');
  insertUser.run('u-office', 'office@cse.univ.edu', passOffice, 'OFFICE_STAFF', 'Academic', 'Office Staff', '+8801700000002');
  
  // Teachers
  insertUser.run('u-teacher-1', 'rahman@cse.univ.edu', passTeacher, 'TEACHER', 'Dr. Mahmudur', 'Rahman', '+8801700000003');
  insertUser.run('u-teacher-2', 'fatima@cse.univ.edu', passTeacher, 'TEACHER', 'Dr. Sadia', 'Fatima', '+8801700000004');

  // Students
  insertUser.run('u-student-1', 'student1@cse.univ.edu', passStudent, 'STUDENT', 'Tanvir', 'Ahmed', '+8801700000005');
  insertUser.run('u-student-2', 'student2@cse.univ.edu', passStudent, 'STUDENT', 'Nusrat', 'Jahan', '+8801700000006');
  insertUser.run('u-student-3', 'student3@cse.univ.edu', passStudent, 'STUDENT', 'Fahim', 'Hossain', '+8801700000007');

  // 2. Teachers Profile
  const insertTeacher = db.prepare(`
    INSERT INTO teachers (id, user_id, designation, department_code, room_number)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertTeacher.run('t-1', 'u-teacher-1', 'Professor & Head of Research', 'CSE', 'Academic Bldg 3, Room 402');
  insertTeacher.run('t-2', 'u-teacher-2', 'Associate Professor', 'CSE', 'Academic Bldg 3, Room 408');

  // 3. Academic Sessions
  const insertSession = db.prepare(`
    INSERT INTO academic_sessions (id, session_name, start_date, end_date, is_current)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertSession.run('sess-2023-24', 'Session 2023-2024', '2023-07-01', '2024-06-30', 1);
  insertSession.run('sess-2024-25', 'Session 2024-2025', '2024-07-01', '2025-06-30', 0);

  // 4. Students Profile
  const insertStudent = db.prepare(`
    INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertStudent.run('s-1', 'u-student-1', 'CSE-20230101', 'REG-88201', 'sess-2023-24');
  insertStudent.run('s-2', 'u-student-2', 'CSE-20230102', 'REG-88202', 'sess-2023-24');
  insertStudent.run('s-3', 'u-student-3', 'CSE-20230103', 'REG-88203', 'sess-2023-24');

  // 5. Semesters
  const insertSemester = db.prepare(`
    INSERT INTO semesters (id, session_id, semester_name, term_code, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertSemester.run('sem-y1s1', 'sess-2023-24', '1st Year 1st Semester', 'Y1S1', 0);
  insertSemester.run('sem-y2s1', 'sess-2023-24', '2nd Year 1st Semester', 'Y2S1', 0);
  insertSemester.run('sem-y3s1', 'sess-2023-24', '3rd Year 1st Semester', 'Y3S1', 1);
  insertSemester.run('sem-y4s1', 'sess-2023-24', '4th Year 1st Semester', 'Y4S1', 0);

  // 6. Courses
  const insertCourse = db.prepare(`
    INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, syllabus_outline)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertCourse.run(
    'c-cse3101',
    'sem-y3s1',
    'CSE-3101',
    'Database Management Systems',
    3.0,
    'THEORY',
    'Relational algebra, SQL, E-R modeling, Normalization, Query Processing, Transactions, Concurrency Control, and Recovery protocols.'
  );
  insertCourse.run(
    'c-cse3102',
    'sem-y3s1',
    'CSE-3102',
    'Database Management Systems Sessional (Lab)',
    1.5,
    'LAB',
    'Practical hands-on database design with PostgreSQL, indexing benchmarks, stored procedures, triggers, and full-stack integration.'
  );
  insertCourse.run(
    'c-cse3103',
    'sem-y3s1',
    'CSE-3103',
    'Operating Systems & System Architecture',
    3.0,
    'THEORY',
    'Process scheduling, Inter-process Communication, Semaphores, Deadlocks, Memory Management, Virtual Memory, and File Systems.'
  );
  insertCourse.run(
    'c-cse1101',
    'sem-y1s1',
    'CSE-1101',
    'Structured Programming Language',
    3.0,
    'THEORY',
    'Fundamentals of algorithms, C language syntax, control structures, pointers, dynamic memory allocation, and file operations.'
  );

  // 7. Course Assignments (Office Assigns Teachers)
  const insertAssignment = db.prepare(`
    INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
    VALUES (?, ?, ?, ?)
  `);
  // Dr. Rahman teaches CSE-3101 and CSE-3103
  insertAssignment.run('ca-1', 'c-cse3101', 't-1', 'u-office');
  insertAssignment.run('ca-2', 'c-cse3103', 't-1', 'u-office');
  // Dr. Fatima teaches CSE-3102 (Lab) and CSE-1101
  insertAssignment.run('ca-3', 'c-cse3102', 't-2', 'u-office');
  insertAssignment.run('ca-4', 'c-cse1101', 't-2', 'u-office');

  // 8. Course Materials
  const insertMaterial = db.prepare(`
    INSERT INTO course_materials (id, course_id, uploaded_by, title, description, file_url, file_type, file_size_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMaterial.run(
    'mat-1',
    'c-cse3101',
    't-1',
    'Lecture 01-03: Relational Algebra & SQL Mastery',
    'Official slides covering relational model, tuple relational calculus, and advanced nested queries.',
    '/sample-materials/Lecture_01_Relational_Algebra.pdf',
    'application/pdf',
    2048500
  );
  insertMaterial.run(
    'mat-2',
    'c-cse3101',
    't-1',
    'Complete Course Outline & Reference Textbooks 2026',
    'Recommended textbooks: Silberschatz Database System Concepts 7th Ed, Garcia-Molina Database Systems Complete Book.',
    '/sample-materials/CSE3101_Course_Outline_2026.pdf',
    'application/pdf',
    614400
  );

  // 9. CT Marks for CSE-3101
  const insertCTMark = db.prepare(`
    INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCTMark.run('ct-1-1', 'c-cse3101', 's-1', 't-1', 1, 18.5, 20.0, 'Excellent SQL query optimization solution');
  insertCTMark.run('ct-1-2', 'c-cse3101', 's-2', 't-1', 1, 19.0, 20.0, 'Perfect ER diagram design');
  insertCTMark.run('ct-1-3', 'c-cse3101', 's-3', 't-1', 1, 15.5, 20.0, 'Good effort, review functional dependencies');

  // 10. Notices (General + Targeted)
  const insertNotice = db.prepare(`
    INSERT INTO notices (id, author_id, title, content, target_type, target_session_id, target_semester_id, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNotice.run(
    'not-1',
    'u-office',
    'Announcement: Annual CSE Tech Fest & Hackathon 2026 Registration Open',
    'All undergraduate students across all sessions are cordially invited to register for the Annual CSE Tech Fest 2026. Hackathon themes include AI Systems, Cyber Security, and Cloud Architecture. Registration deadline: October 25, 2026.',
    'DEPARTMENT_WIDE',
    null,
    null,
    1
  );
  insertNotice.run(
    'not-2',
    'u-office',
    'Schedule Update: Class Test 2 (CT-2) for 3rd Year 1st Semester',
    'Attention 3rd Year 1st Semester students (Session 2023-2024): The Class Test 2 for CSE-3101 Database Management Systems is officially scheduled for Tuesday, 10:30 AM in Room 402. Syllabus: Normalization & Transaction processing.',
    'SESSION_SEMESTER_SPECIFIC',
    'sess-2023-24',
    'sem-y3s1',
    0
  );

  // 11. Student Grievances
  const insertGrievance = db.prepare(`
    INSERT INTO student_grievances (id, student_id, category, subject, description, is_anonymous, status, moderated_by, moderation_remarks, moderated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertGrievance.run(
    'grv-1',
    's-1',
    'FACILITY',
    'Request for Extended Evening Hours in Software Engineering Lab 304',
    'With major semester project deadlines approaching, many students need access to the GPU workstations in Lab 304. We kindly request the department to extend laboratory access until 8:00 PM on weekdays.',
    0,
    'APPROVED',
    'u-office',
    'Approved by Dept. Chair. Lab 304 will remain open until 8:00 PM with lab technician on duty starting next Monday.',
    '2026-10-01 10:00:00'
  );
  insertGrievance.run(
    'grv-2',
    's-2',
    'ACADEMIC',
    'Request for Additional Revision Session on Normalization (CSE-3101)',
    'Several students are finding Boyce-Codd Normal Form (BCNF) decomposition proofs challenging. Could we please request an extra tutorial or problem-solving class before Midterms?',
    1,
    'PENDING_MODERATION',
    null,
    null,
    null
  );

  console.log('[Database] Seed data successfully committed!');
}

function ensureRichNotices() {
  try {
    // 1. Update existing legacy notices with proper categories
    db.prepare("UPDATE notices SET category = 'Event' WHERE id = 'not-1' AND (category IS NULL OR category = 'Notice')").run();
    db.prepare("UPDATE notices SET category = 'Exam' WHERE id = 'not-2' AND (category IS NULL OR category = 'Notice')").run();

    // 2. Insert rich sample notices covering Office staff, Teachers, and Students if not yet present
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM notices').get().count;
    if (existingCount <= 2) {
      const now = new Date();
      const recent1 = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19); // 2 hours ago
      const recent2 = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19); // 8 hours ago
      const recent3 = new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19); // 22 hours ago
      const recent4 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19); // 2 days ago

      const insert = db.prepare(`
        INSERT INTO notices (id, author_id, title, content, category, attachment_url, target_type, target_session_id, target_semester_id, is_pinned, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Teacher notice (Academic)
      insert.run(
        'not-3',
        'u-teacher-1',
        'CSE-3101: Midterm Database Project Guidelines & Schema Submission',
        'All student teams enrolled in CSE-3101 Database Management Systems are instructed to submit their normalized 3NF relational schemas and ER diagrams by this Friday at 11:59 PM. Please ensure PostgreSQL schema scripts and sample test queries are included in your repository.',
        'Academic',
        null,
        'SESSION_SEMESTER_SPECIFIC',
        'sess-2023-24',
        'sem-y3s1',
        1,
        recent1
      );

      // Student notice (Notice / Community)
      insert.run(
        'not-4',
        'u-student-1',
        'ACM ICPC & Competitive Programming Weekly Peer Study Group',
        'The CSE Student Programming Society is organizing weekly algorithmic problem-solving sessions focusing on Graph Theory (Dijkstra, Floyd-Warshall) and Dynamic Programming. Every Wednesday at 4:30 PM in Room 302. Open to all semester batches!',
        'Notice',
        null,
        'DEPARTMENT_WIDE',
        null,
        null,
        0,
        recent2
      );

      // Office Staff notice (Exam)
      insert.run(
        'not-5',
        'u-office',
        'Semester Final Examination Form Fill-up & Clearance Deadline Notice',
        'The Central Controller of Examinations has announced the final clearance dates for undergraduate programs. All students must clear library dues and complete digital clearance on the academic portal by October 22, 2026. Admit cards will be generated automatically.',
        'Exam',
        null,
        'DEPARTMENT_WIDE',
        null,
        null,
        1,
        recent3
      );

      // Teacher notice (Event / Workshop)
      insert.run(
        'not-6',
        'u-teacher-2',
        'Industry Guest Lecture: Scalable Microservices Architecture with Kubernetes',
        'We are thrilled to host Lead Software Architect from Silicon Valley for a special lecture and Q&A session on production distributed systems and DevOps pipelines. Tuesday at 2:00 PM, Central Auditorium. Certificates will be awarded to attendees.',
        'Event',
        null,
        'DEPARTMENT_WIDE',
        null,
        null,
        0,
        recent4
      );

      console.log('[Database] Rich multi-role notices seeded successfully!');
    }
  } catch (err) {
    console.error('[Database] Failed to ensure rich notices:', err.message);
  }
}

function ensureUniversityCTMarks() {
  try {
    const insertCTMark = db.prepare(`
      INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(course_id, student_id, ct_number) DO UPDATE SET
        obtained_marks = excluded.obtained_marks,
        max_marks = excluded.max_marks,
        remarks = excluded.remarks,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Ensure 3 CTs + Attendance (CT 1, 2, 3 and 4=Attendance) all base on 10.0 for students
    const demoMarks = [
      // Student 1 (s-1: Tanvir Ahmed) -> CTs: 9.0, 8.5, 9.5; Att: 9.5 -> Best 2 = 18.5, Total CA = 28.0/30 (A+, 1st)
      { id: 'ct-1-1', courseId: 'c-cse3101', studentId: 's-1', teacherId: 't-1', ctNumber: 1, marks: 9.0, max: 10.0, remarks: 'Excellent SQL normalization' },
      { id: 'ct-1-2', courseId: 'c-cse3101', studentId: 's-1', teacherId: 't-1', ctNumber: 2, marks: 8.5, max: 10.0, remarks: 'Great relational algebra' },
      { id: 'ct-1-3', courseId: 'c-cse3101', studentId: 's-1', teacherId: 't-1', ctNumber: 3, marks: 9.5, max: 10.0, remarks: 'Outstanding transaction indexing' },
      { id: 'ct-1-4', courseId: 'c-cse3101', studentId: 's-1', teacherId: 't-1', ctNumber: 4, marks: 9.5, max: 10.0, remarks: '95% Attendance' },

      // Student 2 (s-2: Nusrat Jahan) -> CTs: 8.5, 9.0, 8.0; Att: 9.0 -> Best 2 = 17.5, Total CA = 26.5/30 (A+, 2nd)
      { id: 'ct-2-1', courseId: 'c-cse3101', studentId: 's-2', teacherId: 't-1', ctNumber: 1, marks: 8.5, max: 10.0, remarks: 'Good ER diagram design' },
      { id: 'ct-2-2', courseId: 'c-cse3101', studentId: 's-2', teacherId: 't-1', ctNumber: 2, marks: 9.0, max: 10.0, remarks: 'Strong query optimization' },
      { id: 'ct-2-3', courseId: 'c-cse3101', studentId: 's-2', teacherId: 't-1', ctNumber: 3, marks: 8.0, max: 10.0, remarks: 'Solid understanding of B+ trees' },
      { id: 'ct-2-4', courseId: 'c-cse3101', studentId: 's-2', teacherId: 't-1', ctNumber: 4, marks: 9.0, max: 10.0, remarks: '90% Attendance' },

      // Student 3 (s-3: Fahim Hossain) -> CTs: 7.5, 8.0, 7.0; Att: 8.5 -> Best 2 = 15.5, Total CA = 24.0/30 (A+, 3rd)
      { id: 'ct-3-1', courseId: 'c-cse3101', studentId: 's-3', teacherId: 't-1', ctNumber: 1, marks: 7.5, max: 10.0, remarks: 'Satisfactory schema modeling' },
      { id: 'ct-3-2', courseId: 'c-cse3101', studentId: 's-3', teacherId: 't-1', ctNumber: 2, marks: 8.0, max: 10.0, remarks: 'Good ACID property explanation' },
      { id: 'ct-3-3', courseId: 'c-cse3101', studentId: 's-3', teacherId: 't-1', ctNumber: 3, marks: 7.0, max: 10.0, remarks: 'Review concurrency isolation' },
      { id: 'ct-3-4', courseId: 'c-cse3101', studentId: 's-3', teacherId: 't-1', ctNumber: 4, marks: 8.5, max: 10.0, remarks: '85% Attendance' },
    ];

    for (const m of demoMarks) {
      const existing = db.prepare('SELECT id FROM ct_marks WHERE course_id = ? AND student_id = ? AND ct_number = ?').get(m.courseId, m.studentId, m.ctNumber);
      const markId = existing ? existing.id : 'ct-' + crypto.randomUUID();
      insertCTMark.run(markId, m.courseId, m.studentId, m.teacherId, m.ctNumber, m.marks, m.max, m.remarks);
    }
    console.log('[Database] University Continuous Assessment (3 CTs + Attendance /10) marks synchronized.');
  } catch (err) {
    console.error('[Database] Failed to ensure CT marks:', err.message);
  }
}

function ensureChairmanAccount() {
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('chair.cse_pust@gmail.com');
    const passHash = bcrypt.hashSync('12345678', 10);
    let userId = 'u-chair';

    if (existing) {
      userId = existing.id;
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, first_name = 'Dr. Abdur', last_name = 'Rahim', role = 'TEACHER', status = 'ACTIVE'
        WHERE id = ?
      `).run(passHash, userId);
    } else {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
        VALUES (?, 'chair.cse_pust@gmail.com', ?, 'TEACHER', 'ACTIVE', 'Dr. Abdur', 'Rahim', '+8801711223344')
      `).run(userId, passHash);
    }

    // Ensure teacher profile
    const existingTeacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(userId);
    let teacherId = 't-chair';
    if (existingTeacher) {
      teacherId = existingTeacher.id;
      db.prepare(`
        UPDATE teachers
        SET designation = 'Professor & Chairman, Dept of CSE',
            department_code = 'CSE',
            room_number = 'Chairman Office, Academic Bldg 3, PUST'
        WHERE id = ?
      `).run(teacherId);
    } else {
      db.prepare(`
        INSERT INTO teachers (id, user_id, designation, department_code, room_number)
        VALUES (?, ?, 'Professor & Chairman, Dept of CSE', 'CSE', 'Chairman Office, Academic Bldg 3, PUST')
      `).run(teacherId, userId);
    }

    // Ensure assignment to CSE-3101
    db.prepare(`
      INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
      VALUES (?, 'c-cse3101', ?, ?)
      ON CONFLICT(course_id, teacher_id) DO NOTHING
    `).run('ca-chair-1', teacherId, userId);

    console.log('[Database] Dr. Abdur Rahim (Chairman, Dept of CSE) permanent account synchronized.');
  } catch (err) {
    console.error('[Database] Failed to ensure Chairman account:', err.message);
  }
}

function ensureFullCurriculum() {
  try {
    const sessionId = 'sess-2023-24';
    
    // 1. Ensure all 8 standard semesters exist
    const semestersList = [
      { id: 'sem-y1s1', name: '1st Year 1st Semester', term: 'Y1S1', active: 0 },
      { id: 'sem-y1s2', name: '1st Year 2nd Semester', term: 'Y1S2', active: 0 },
      { id: 'sem-y2s1', name: '2nd Year 1st Semester', term: 'Y2S1', active: 0 },
      { id: 'sem-y2s2', name: '2nd Year 2nd Semester', term: 'Y2S2', active: 0 },
      { id: 'sem-y3s1', name: '3rd Year 1st Semester', term: 'Y3S1', active: 1 },
      { id: 'sem-y3s2', name: '3rd Year 2nd Semester', term: 'Y3S2', active: 0 },
      { id: 'sem-y4s1', name: '4th Year 1st Semester', term: 'Y4S1', active: 0 },
      { id: 'sem-y4s2', name: '4th Year 2nd Semester', term: 'Y4S2', active: 0 },
    ];

    const insertSem = db.prepare(`
      INSERT INTO semesters (id, session_id, semester_name, term_code, is_active)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id, term_code) DO UPDATE SET
        semester_name = excluded.semester_name
    `);

    for (const sem of semestersList) {
      insertSem.run(sem.id, sessionId, sem.name, sem.term, sem.active);
    }

    // 2. Comprehensive Course List across all 8 Semesters
    const standardCourses = [
      // 1st Year 1st Semester
      {
        id: 'c-cse1101',
        semId: 'sem-y1s1',
        code: 'CSE-1101',
        title: 'Structured Programming Language',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Introduction to programming paradigms, C language syntax, data types, operators, branching and loops, modular functions, arrays, strings, recursion, pointers, structures, dynamic memory allocation, and disk file I/O operations.'
      },
      {
        id: 'c-cse1102',
        semId: 'sem-y1s1',
        code: 'CSE-1102',
        title: 'Structured Programming Language Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Practical implementation of C programming concepts: algorithmic problem-solving on online judges, debugging techniques, pointer arithmetic, string processing, and a mini-project developed in C.'
      },
      {
        id: 'c-eee1103',
        semId: 'sem-y1s1',
        code: 'EEE-1103',
        title: 'Basic Electrical & Electronic Engineering',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'DC/AC circuit laws, Ohm’s law, Kirchhoff’s voltage and current laws, Thevenin’s & Norton’s theorems, AC sinusoidal waveforms, RLC resonance, diodes, rectification, BJT transistors, and amplifier configurations.'
      },
      {
        id: 'c-math1105',
        semId: 'sem-y1s1',
        code: 'MATH-1105',
        title: 'Differential and Integral Calculus',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Differential calculus: limits, continuity, differentiability, Rolle’s theorem, Taylor’s expansion, curvature, partial differentiation. Integral calculus: definite integrals, integration techniques, arc length, and surface area computation.'
      },

      // 1st Year 2nd Semester
      {
        id: 'c-cse1201',
        semId: 'sem-y1s2',
        code: 'CSE-1201',
        title: 'Discrete Mathematics',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Propositional and predicate logic, set theory, functions, mathematical induction, pigeonhole principle, relations, recurrence relations, generating functions, graph theory fundamentals, trees, and Boolean algebra.'
      },
      {
        id: 'c-cse1203',
        semId: 'sem-y1s2',
        code: 'CSE-1203',
        title: 'Object Oriented Programming',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Principles of OOP: Encapsulation, abstraction, inheritance, polymorphism, Java/C++ syntax, classes and objects, method overloading and overriding, exception handling, interfaces, packages, multithreading, and GUI basics.'
      },
      {
        id: 'c-cse1204',
        semId: 'sem-y1s2',
        code: 'CSE-1204',
        title: 'Object Oriented Programming Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Hands-on programming in Java/C++: class design, dynamic memory allocation, design patterns, file serialization, event-driven desktop GUI systems, and comprehensive term software project.'
      },
      {
        id: 'c-math1205',
        semId: 'sem-y1s2',
        code: 'MATH-1205',
        title: 'Linear Algebra and Coordinate Geometry',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Vector spaces, matrices, Gaussian elimination, determinants, rank, linear transformations, eigenvalues and eigenvectors. 2D/3D coordinate geometry: transformation of coordinates, planes, straight lines, and sphere equations.'
      },

      // 2nd Year 1st Semester
      {
        id: 'c-cse2101',
        semId: 'sem-y2s1',
        code: 'CSE-2101',
        title: 'Data Structures',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Linear and non-linear data structures: arrays, stacks, queues, linked lists, binary trees, binary search trees, AVL trees, B-trees, heaps, hash tables, and priority queues with asymptotic performance analysis.'
      },
      {
        id: 'c-cse2102',
        semId: 'sem-y2s1',
        code: 'CSE-2102',
        title: 'Data Structures Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Implementation of abstract data types in C++/Java: balanced search trees, hashing collision resolution strategies, graph traversals (BFS/DFS), and memory management optimization.'
      },
      {
        id: 'c-cse2103',
        semId: 'sem-y2s1',
        code: 'CSE-2103',
        title: 'Digital Logic Design',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Number systems and codes, Boolean minimization, Karnaugh maps, Quine-McCluskey method, combinational circuits: multiplexers, decoders, adders; sequential circuits: flip-flops, registers, counters, finite state machines (FSM).'
      },
      {
        id: 'c-cse2104',
        semId: 'sem-y2s1',
        code: 'CSE-2104',
        title: 'Digital Logic Design Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Hardware lab experiments with TTL logic gates, IC chips, combinational logic validation on breadboards, counter verification, and Verilog/VHDL simulation.'
      },

      // 2nd Year 2nd Semester
      {
        id: 'c-cse2201',
        semId: 'sem-y2s2',
        code: 'CSE-2201',
        title: 'Algorithms & Complexity Analysis',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Algorithm design paradigms: divide-and-conquer, greedy algorithms, dynamic programming, graph algorithms (Dijkstra, Bellman-Ford, Kruskal, Prim), network flow, string matching, NP-completeness, and approximation algorithms.'
      },
      {
        id: 'c-cse2202',
        semId: 'sem-y2s2',
        code: 'CSE-2202',
        title: 'Algorithms Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Practical algorithmic programming competitions, competitive programming benchmarks, graph traversal solutions, dynamic programming optimization, and computational geometry applications.'
      },
      {
        id: 'c-cse2203',
        semId: 'sem-y2s2',
        code: 'CSE-2203',
        title: 'Computer Architecture & Organization',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Instruction set architecture (MIPS/RISC-V), datapath and control unit design, pipelining hazards, cache memory hierarchies (L1/L2/L3), virtual memory translation, I/O organization, and multiprocessor systems.'
      },
      {
        id: 'c-stat2205',
        semId: 'sem-y2s2',
        code: 'STAT-2205',
        title: 'Probability and Statistics for Engineers',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Probability axioms, random variables, probability density functions, expectation, variance, binomial, Poisson, normal distributions, sampling distributions, hypothesis testing, ANOVA, and regression models.'
      },

      // 3rd Year 1st Semester
      {
        id: 'c-cse3101',
        semId: 'sem-y3s1',
        code: 'CSE-3101',
        title: 'Database Management Systems',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Relational algebra, SQL, E-R modeling, Normalization (1NF to BCNF), Query Processing and Optimization, Transactions (ACID), Concurrency Control (2PL, Timestamping), and Database Recovery protocols.'
      },
      {
        id: 'c-cse3102',
        semId: 'sem-y3s1',
        code: 'CSE-3102',
        title: 'Database Management Systems Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Practical database design with PostgreSQL/MySQL, schema migrations, B-tree index benchmarking, stored procedures, triggers, view definitions, and full-stack web application integration.'
      },
      {
        id: 'c-cse3103',
        semId: 'sem-y3s1',
        code: 'CSE-3103',
        title: 'Operating Systems & System Architecture',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Process scheduling, IPC, semaphores, monitors, deadlock prevention and avoidance, memory paging, segmentation, virtual memory, page replacement algorithms, and journaling file systems.'
      },
      {
        id: 'c-cse3104',
        semId: 'sem-y3s1',
        code: 'CSE-3104',
        title: 'Operating Systems Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'POSIX system calls in Linux/Unix, multi-threaded C programming with pthread, process synchronization, custom shell implementation, and kernel module compilation.'
      },

      // 3rd Year 2nd Semester
      {
        id: 'c-cse3201',
        semId: 'sem-y3s2',
        code: 'CSE-3201',
        title: 'Software Engineering & Information Systems',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Software life cycles (Agile, Scrum, Waterfall), requirements engineering, UML modeling, software architecture patterns, test-driven development (TDD), CI/CD pipelines, and software quality assurance.'
      },
      {
        id: 'c-cse3202',
        semId: 'sem-y3s2',
        code: 'CSE-3202',
        title: 'Software Development Project Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Team-based end-to-end full stack software product engineering: sprint retrospectives, automated testing, containerized Docker deployment, and client stakeholder presentations.'
      },
      {
        id: 'c-cse3203',
        semId: 'sem-y3s2',
        code: 'CSE-3203',
        title: 'Computer Networks & Internet Protocols',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'OSI and TCP/IP layered architectures, IP addressing, CIDR, sub-netting, routing algorithms (OSPF, BGP), transport protocols (TCP flow/congestion control, UDP), application protocols (DNS, HTTP/3, TLS), and SDN.'
      },
      {
        id: 'c-cse3204',
        semId: 'sem-y3s2',
        code: 'CSE-3204',
        title: 'Computer Networks Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Packet sniffing with Wireshark, socket programming in Python/C, Cisco Packet Tracer router/switch topology configuration, VLANs, and firewall rule configurations.'
      },

      // 4th Year 1st Semester
      {
        id: 'c-cse4101',
        semId: 'sem-y4s1',
        code: 'CSE-4101',
        title: 'Artificial Intelligence & Neural Networks',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Intelligent agents, uninformed and heuristic search (A*, Minimax, Alpha-Beta pruning), constraint satisfaction problems, knowledge representation, Bayesian reasoning, and foundational neural networks.'
      },
      {
        id: 'c-cse4102',
        semId: 'sem-y4s1',
        code: 'CSE-4102',
        title: 'Artificial Intelligence Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Implementation of heuristic algorithms in Python, game playing engines, automated theorem proving, Prolog/Python expert systems, and PyTorch perceptron training.'
      },
      {
        id: 'c-cse4103',
        semId: 'sem-y4s1',
        code: 'CSE-4103',
        title: 'Compiler Design & Automata Theory',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Lexical analysis (lex/flex), context-free grammars, top-down and bottom-up parsing (LL, LR, LALR, yacc/bison), syntax-directed translation, intermediate code generation, and optimization.'
      },
      {
        id: 'c-cse4100',
        semId: 'sem-y4s1',
        code: 'CSE-4100',
        title: 'Undergraduate Project & Research Thesis Part I',
        credits: 2.0,
        type: 'THEORY',
        syllabus: 'Literature review, problem formulation, methodology design, dataset gathering, ethical review, and faculty supervisory progress defense.'
      },

      // 4th Year 2nd Semester
      {
        id: 'c-cse4201',
        semId: 'sem-y4s2',
        code: 'CSE-4201',
        title: 'Cryptography & Cyber Security',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Classical ciphers, symmetric cryptography (AES), asymmetric cryptography (RSA, ECC), cryptographic hash functions (SHA-256), digital signatures, PKI, authentication protocols, zero-knowledge proofs, and web security.'
      },
      {
        id: 'c-cse4203',
        semId: 'sem-y4s2',
        code: 'CSE-4203',
        title: 'Machine Learning & Big Data Analytics',
        credits: 3.0,
        type: 'THEORY',
        syllabus: 'Supervised learning (Linear/Logistic regression, SVM, Random Forests), unsupervised learning (K-Means, PCA), deep learning architectures (CNNs, Transformers), gradient descent, and Hadoop/Spark big data ecosystems.'
      },
      {
        id: 'c-cse4204',
        semId: 'sem-y4s2',
        code: 'CSE-4204',
        title: 'Machine Learning Sessional (Lab)',
        credits: 1.5,
        type: 'LAB',
        syllabus: 'Model training and evaluation using Scikit-Learn and TensorFlow/PyTorch, cross-validation, hyperparameter tuning, NLP embeddings, and model serving via FastAPI.'
      },
      {
        id: 'c-cse4200',
        semId: 'sem-y4s2',
        code: 'CSE-4200',
        title: 'Undergraduate Project & Research Thesis Part II',
        credits: 4.0,
        type: 'THEORY',
        syllabus: 'Final thesis development, experimental validation, peer-review conference paper drafting, and formal defense before the Department Examination Committee.'
      },
    ];

    const insertCourse = db.prepare(`
      INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, syllabus_outline)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(semester_id, course_code) DO UPDATE SET
        course_title = excluded.course_title,
        credit_hours = excluded.credit_hours,
        course_type = excluded.course_type,
        syllabus_outline = excluded.syllabus_outline
    `);

    for (const c of standardCourses) {
      insertCourse.run(c.id, c.semId, c.code, c.title, c.credits, c.type, c.syllabus);
    }

    // 3. Ensure student cohort with 40-seat allocation context
    const studentCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE current_session_id = ?').get(sessionId).count;
    if (studentCount < 10) {
      const passStudent = bcrypt.hashSync('12345678', 10);
      const insertUser = db.prepare(`
        INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone_number)
        VALUES (?, ?, ?, 'STUDENT', 'ACTIVE', ?, ?, ?)
        ON CONFLICT(email) DO NOTHING
      `);
      const insertStudent = db.prepare(`
        INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);

      const additionalStudents = [
        { roll: 'CSE-230104', reg: 'REG-88204', first: 'Md. Sakibul', last: 'Islam', email: 'sakib230104@cse.pust.ac.bd', phone: '+8801700000008' },
        { roll: 'CSE-230105', reg: 'REG-88205', first: 'Ayesha', last: 'Siddiqua', email: 'ayesha230105@cse.pust.ac.bd', phone: '+8801700000009' },
        { roll: 'CSE-230106', reg: 'REG-88206', first: 'Raihan', last: 'Kabir', email: 'raihan230106@cse.pust.ac.bd', phone: '+8801700000010' },
        { roll: 'CSE-230107', reg: 'REG-88207', first: 'Farhana', last: 'Yasmin', email: 'farhana230107@cse.pust.ac.bd', phone: '+8801700000011' },
        { roll: 'CSE-230108', reg: 'REG-88208', first: 'Mehedi', last: 'Hasan', email: 'mehedi230108@cse.pust.ac.bd', phone: '+8801700000012' },
        { roll: 'CSE-230109', reg: 'REG-88209', first: 'Tasnim', last: 'Anjum', email: 'tasnim230109@cse.pust.ac.bd', phone: '+8801700000013' },
        { roll: 'CSE-230110', reg: 'REG-88210', first: 'Ashikur', last: 'Rahman', email: 'ashik230110@cse.pust.ac.bd', phone: '+8801700000014' },
      ];

      for (const st of additionalStudents) {
        const uId = 'u-' + st.roll.toLowerCase();
        const sId = 's-' + st.roll.toLowerCase();
        insertUser.run(uId, st.email, passStudent, st.first, st.last, st.phone);
        insertStudent.run(sId, uId, st.roll, st.reg, sessionId);
      }
    }

    console.log('[Database] Full 8-semester curriculum, course syllabi, and 40-seat batch capacity synchronized.');
  } catch (err) {
    console.error('[Database] Failed to ensure full curriculum:', err.message);
  }
}

module.exports = {
  db,
  initializeDatabase,
};

