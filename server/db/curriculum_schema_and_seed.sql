-- =============================================================================
-- B.Sc. Engineering (CSE) Academic Curriculum Schema & Comprehensive Seed Data
-- Department of Computer Science & Engineering
-- Standard 4-Year Undergraduate Degree Structure (8 Semesters, ~165 Credits)
-- Compatible with SQLite, PostgreSQL, and MySQL
-- =============================================================================

-- 1. ACADEMIC SESSIONS TABLE
CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  session_name TEXT UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. SEMESTERS TABLE (8 Standard Undergraduate Semesters)
CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  semester_name TEXT NOT NULL,
  term_code TEXT NOT NULL, -- 'Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'
  year INTEGER NOT NULL,    -- 1, 2, 3, 4
  semester INTEGER NOT NULL,-- 1, 2
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, term_code)
);

-- 3. COURSES TABLE (Categorized by Year, Semester, Code, Title, Credit, Type)
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,     -- e.g. 'CSE 1101'
  course_title TEXT NOT NULL,    -- e.g. 'Computer Fundamentals'
  credit_hours REAL NOT NULL,    -- e.g. 3.0, 1.5, 0.75, 1.0, 2.0
  course_type TEXT NOT NULL,     -- 'Theory', 'Sessional', 'Viva'
  year INTEGER NOT NULL,         -- 1, 2, 3, 4
  semester INTEGER NOT NULL,     -- 1, 2
  term_code TEXT NOT NULL,       -- 'Y1S1', 'Y1S2', ...
  is_optional INTEGER DEFAULT 0, -- 0 for Mandatory Core, 1 for Elective
  elective_group TEXT,           -- 'Optional-I', 'Optional-II', or NULL
  syllabus_outline TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (semester_id, course_code)
);

-- 4. COURSE ENROLLMENTS TABLE (Student enrollment in core & elective courses)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  enrollment_status TEXT CHECK(enrollment_status IN ('ENROLLED', 'DROPPED', 'COMPLETED', 'PENDING')) DEFAULT 'ENROLLED',
  enrollment_type TEXT CHECK(enrollment_type IN ('REGULAR', 'RETAKE', 'RECIEVE', 'IMPROVEMENT')) DEFAULT 'REGULAR',
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, course_id)
);

-- 5. STUDENT RESULTS TABLE (Semester-wise result tracking, SGPA & CGPA)
CREATE TABLE IF NOT EXISTS student_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  continuous_assessment_marks REAL DEFAULT 0, -- Continuous Assessment (out of 30)
  final_exam_marks REAL DEFAULT 0,            -- Semester Final Exam (out of 70)
  total_marks REAL DEFAULT 0,                 -- Total Score (out of 100)
  grade_point REAL DEFAULT 0.00,             -- 4.00, 3.75, 3.50, ...
  letter_grade TEXT DEFAULT 'F',             -- 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'
  credits_earned REAL DEFAULT 0.0,
  is_passed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PUBLISHED',           -- 'DRAFT', 'SUBMITTED', 'PUBLISHED'
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, course_id)
);

-- 6. ROUTINES TABLE (Semester-wise routine scheduling)
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('CLASS_ROUTINE', 'EXAM_ROUTINE')) NOT NULL,
  title TEXT NOT NULL,
  session_id TEXT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL,
  routine_data TEXT NOT NULL, -- JSON structured routine slots
  status TEXT DEFAULT 'DRAFT',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_courses_semester_term ON courses(semester_id, term_code);
CREATE INDEX IF NOT EXISTS idx_courses_year_sem ON courses(year, semester);
CREATE INDEX IF NOT EXISTS idx_courses_type ON courses(course_type);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student ON course_enrollments(student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_student_results_student ON student_results(student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_student_results_course ON student_results(course_id);

-- =============================================================================
-- SEED DATA: OFFICIAL CURRICULUM COURSES (SAMPLE SESSION: sess-2023-24)
-- =============================================================================

-- Ensure Session 2023-2024
INSERT INTO academic_sessions (id, session_name, start_date, end_date, is_current)
VALUES ('sess-2023-24', 'Session 2023-2024', '2023-07-01', '2024-06-30', 1)
ON CONFLICT(session_name) DO UPDATE SET is_current = 1;

-- Ensure 8 Standard Semesters
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y1s1', 'sess-2023-24', '1st Year 1st Semester', 'Y1S1', 1, 1, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y1s2', 'sess-2023-24', '1st Year 2nd Semester', 'Y1S2', 1, 2, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y2s1', 'sess-2023-24', '2nd Year 1st Semester', 'Y2S1', 2, 1, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y2s2', 'sess-2023-24', '2nd Year 2nd Semester', 'Y2S2', 2, 2, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y3s1', 'sess-2023-24', '3rd Year 1st Semester', 'Y3S1', 3, 1, 1)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y3s2', 'sess-2023-24', '3rd Year 2nd Semester', 'Y3S2', 3, 2, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y4s1', 'sess-2023-24', '4th Year 1st Semester', 'Y4S1', 4, 1, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;
INSERT INTO semesters (id, session_id, semester_name, term_code, year, semester, is_active)
VALUES ('sem-202324-y4s2', 'sess-2023-24', '4th Year 2nd Semester', 'Y4S2', 4, 2, 0)
ON CONFLICT(session_id, term_code) DO NOTHING;

-- Insert All 92 Official Curriculum Courses
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1101', 'sem-202324-y1s1', 'CSE 1101', 'Computer Fundamentals', 3, 'Theory', 1, 1, 'Y1S1', 0, NULL, 'Introduction to computer systems, hardware architectures, CPU organization, memory hierarchy, system software, number systems, computer arithmetic, and network essentials.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1102', 'sem-202324-y1s1', 'CSE 1102', 'Computer Fundamentals Sessional', 1.5, 'Sessional', 1, 1, 'Y1S1', 0, NULL, 'Hands-on hardware troubleshooting, PC assembly, operating system installation, terminal operations, shell commands, and office productivity tools.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1103', 'sem-202324-y1s1', 'CSE 1103', 'Structured Programming Language', 3, 'Theory', 1, 1, 'Y1S1', 0, NULL, 'Algorithm formulation, flowcharts, pseudo-code, C programming fundamentals, control structures, functions, recursion, arrays, pointers, memory allocation, and file I/O.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1104', 'sem-202324-y1s1', 'CSE 1104', 'Structured Programming Language Sessional', 1.5, 'Sessional', 1, 1, 'Y1S1', 0, NULL, 'Laboratory problem solving in C: programming logic, algorithmic puzzles, debugging, pointer manipulation, structured project implementation, and competitive programming basics.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-math1101', 'sem-202324-y1s1', 'MATH 1101', 'Differential Calculus and Co-ordinate Geometry', 3, 'Theory', 1, 1, 'Y1S1', 0, NULL, 'Functions, limits, continuity, differentiation, successive differentiation, Leibniz theorem, Taylor series, maxima/minima, 2D/3D coordinate transformations, straight lines, and conic sections.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-phy1101', 'sem-202324-y1s1', 'PHY 1101', 'Physics', 3, 'Theory', 1, 1, 'Y1S1', 0, NULL, 'Waves and oscillations, physical optics, interference, diffraction, polarization, quantum physics, relativity, atomic models, and semiconductor physics principles.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-hum1101', 'sem-202324-y1s1', 'HUM 1101', 'Communicative English', 3, 'Theory', 1, 1, 'Y1S1', 0, NULL, 'Grammar in context, reading comprehension, vocabulary expansion, professional writing, technical reports, presentation skills, and academic discourse.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-hum1102', 'sem-202324-y1s1', 'HUM 1102', 'Communicative English Sessional', 0.75, 'Sessional', 1, 1, 'Y1S1', 0, NULL, 'Listening comprehension drills, phonetics, oral presentation sessions, group discussions, debate exercises, and interview preparedness.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1150', 'sem-202324-y1s1', 'CSE 1150', 'Viva Voce', 0.75, 'Viva', 1, 1, 'Y1S1', 0, NULL, 'Comprehensive oral examination assessing theoretical knowledge, sessional competence, and conceptual grasp across all courses of Year 1 Semester 1.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-me1200', 'sem-202324-y1s2', 'ME 1200', 'Engineering Drawing', 1, 'Sessional', 1, 2, 'Y1S2', 0, NULL, 'Orthographic projections, isometric views, drafting instruments, CAD fundamentals, engineering scales, sectional views, and dimensioning standards.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1200', 'sem-202324-y1s2', 'CSE 1200', 'Analytical Programming Sessional', 0.75, 'Sessional', 1, 2, 'Y1S2', 0, NULL, 'Analytical thinking, mathematical programming, problem solving on online judge platforms, algorithmic efficiency, time and space complexity evaluation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1201', 'sem-202324-y1s2', 'CSE 1201', 'Object Oriented Programming', 3, 'Theory', 1, 2, 'Y1S2', 0, NULL, 'Object-oriented programming paradigm, encapsulation, inheritance, polymorphism, abstraction, classes and objects, exception handling, templates/generics, and I/O streams.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1202', 'sem-202324-y1s2', 'CSE 1202', 'Object Oriented Programming Sessional', 1.5, 'Sessional', 1, 2, 'Y1S2', 0, NULL, 'Practical implementation of OOP concepts in C++/Java: class design, dynamic memory management, design patterns, event-driven programming, and term mini-project.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1203', 'sem-202324-y1s2', 'CSE 1203', 'Discrete Mathematics', 3, 'Theory', 1, 2, 'Y1S2', 0, NULL, 'Set theory, propositional and predicate logic, proof techniques, mathematical induction, relations and functions, combinatorics, recurrence relations, and graph fundamentals.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-eee1201', 'sem-202324-y1s2', 'EEE 1201', 'Basic Electrical Engineering', 3, 'Theory', 1, 2, 'Y1S2', 0, NULL, 'DC circuit analysis, Kirchhoff''s laws, mesh and nodal analysis, Thevenin''s & Norton''s theorems, sinusoidal AC circuits, phasors, RLC circuits, resonance, and magnetic circuits.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-eee1202', 'sem-202324-y1s2', 'EEE 1202', 'Basic Electrical Engineering Sessional', 1.5, 'Sessional', 1, 2, 'Y1S2', 0, NULL, 'Laboratory experiments verifying electrical circuit laws, oscilloscope measurements, RLC impedance characteristics, power factor correction, and transformer tests.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-math1201', 'sem-202324-y1s2', 'MATH 1201', 'Integral Calculus, Differential Equation and Series Solutions', 3, 'Theory', 1, 2, 'Y1S2', 0, NULL, 'Definite and indefinite integrals, integration techniques, improper integrals, ordinary differential equations of first and higher orders, power series solutions, and Bessel functions.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-hum1201', 'sem-202324-y1s2', 'HUM 1201', 'Economics', 2, 'Theory', 1, 2, 'Y1S2', 0, NULL, 'Microeconomics, demand and supply theory, elasticity, consumer behavior, market structures, macroeconomics principles, national income, inflation, and development economics.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse1250', 'sem-202324-y1s2', 'CSE 1250', 'Viva Voce', 0.75, 'Viva', 1, 2, 'Y1S2', 0, NULL, 'Comprehensive oral board examination covering all subjects, labs, and foundational engineering concepts studied in Year 1 Semester 2.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2100', 'sem-202324-y2s1', 'CSE 2100', 'Mobile Application Development Project', 1.5, 'Sessional', 2, 1, 'Y2S1', 0, NULL, 'Mobile application architecture, Android/Flutter development, UI components, state management, REST API integration, local SQLite storage, and mobile application release.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2101', 'sem-202324-y2s1', 'CSE 2101', 'Data Structures', 3, 'Theory', 2, 1, 'Y2S1', 0, NULL, 'Linear and non-linear data structures: arrays, stacks, queues, linked lists, binary trees, binary search trees, AVL trees, B-trees, heaps, hashing, and priority queues.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2102', 'sem-202324-y2s1', 'CSE 2102', 'Data Structures Sessional', 1.5, 'Sessional', 2, 1, 'Y2S1', 0, NULL, 'Implementation and complexity analysis of data structures in C++/Java: balanced search trees, collision resolution hashing, graph models, and memory optimization.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2103', 'sem-202324-y2s1', 'CSE 2103', 'Design Pattern and Java Programming', 3, 'Theory', 2, 1, 'Y2S1', 0, NULL, 'Creational, structural, and behavioral design patterns (Singleton, Factory, Observer, MVC), Java advanced features, multi-threading, reflection, streams, and enterprise architectures.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2104', 'sem-202324-y2s1', 'CSE 2104', 'Design Pattern and Java Programming Sessional', 0.75, 'Sessional', 2, 1, 'Y2S1', 0, NULL, 'Practical implementation of Gang of Four (GoF) design patterns, robust software refactoring, modular Java applications, and desktop/web GUI development.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-eee2101', 'sem-202324-y2s1', 'EEE 2101', 'Electronic Devices and Circuits', 3, 'Theory', 2, 1, 'Y2S1', 0, NULL, 'Semiconductor physics, PN junction diodes, BJT characteristics, biasing, small-signal models, FETs/MOSFETs, operational amplifiers (op-amps), feedback amplifiers, and oscillators.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-eee2102', 'sem-202324-y2s1', 'EEE 2102', 'Electronic Devices and Circuits Sessional', 0.75, 'Sessional', 2, 1, 'Y2S1', 0, NULL, 'Hardware laboratory testing of diode clippers/clampers, transistor amplification characteristics, op-amp configurations, active filters, and circuit simulations.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-math2101', 'sem-202324-y2s1', 'MATH 2101', 'Vector, Matrices and Linear Algebra', 3, 'Theory', 2, 1, 'Y2S1', 0, NULL, 'Vector algebra and calculus, gradient, divergence, curl, line and surface integrals, matrices, Gaussian elimination, determinants, vector spaces, linear transformations, eigenvalues, and eigenvectors.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-stat2101', 'sem-202324-y2s1', 'STAT 2101', 'Elementary Statistics and Probability', 3, 'Theory', 2, 1, 'Y2S1', 0, NULL, 'Descriptive statistics, probability theory, random variables, probability distributions (Binomial, Poisson, Normal), sampling theory, estimation, and hypothesis testing.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2150', 'sem-202324-y2s1', 'CSE 2150', 'Viva Voce', 0.75, 'Viva', 2, 1, 'Y2S1', 0, NULL, 'Oral board examination evaluating comprehensive conceptual understanding of all courses studied in Year 2 Semester 1.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2200', 'sem-202324-y2s2', 'CSE 2200', 'Hardware Project', 1.5, 'Sessional', 2, 2, 'Y2S2', 0, NULL, 'Embedded hardware project design using Arduino, ESP32, or Raspberry Pi, sensor integration, actuator interfacing, PCB prototyping, and hardware-software co-design.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2201', 'sem-202324-y2s2', 'CSE 2201', 'Algorithms', 3, 'Theory', 2, 2, 'Y2S2', 0, NULL, 'Algorithm design strategies: divide-and-conquer, greedy method, dynamic programming, graph algorithms (Dijkstra, Bellman-Ford, Kruskal, Prim), network flow, string algorithms, and NP-completeness.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2202', 'sem-202324-y2s2', 'CSE 2202', 'Algorithms Sessional', 1.5, 'Sessional', 2, 2, 'Y2S2', 0, NULL, 'Algorithmic problem-solving implementations, competitive programming, benchmarking time/space complexity, shortest path optimizations, and maximum flow algorithms.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2203', 'sem-202324-y2s2', 'CSE 2203', 'Theory of Computation', 2, 'Theory', 2, 2, 'Y2S2', 0, NULL, 'Finite automata (DFA, NFA), regular languages, regular expressions, context-free grammars, pushdown automata, Turing machines, decidability, and Church-Turing thesis.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2205', 'sem-202324-y2s2', 'CSE 2205', 'Digital Systems', 3, 'Theory', 2, 2, 'Y2S2', 0, NULL, 'Number systems, Boolean algebra, logic gate minimization, combinational circuits (adders, multiplexers, decoders), sequential circuits (flip-flops, counters, registers), finite state machines, and programmable logic.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2206', 'sem-202324-y2s2', 'CSE 2206', 'Digital Systems Sessional', 1.5, 'Sessional', 2, 2, 'Y2S2', 0, NULL, 'Hardware lab experiments with TTL/CMOS ICs, breadboard circuit implementations, sequential state machine testing, and digital logic simulation tools (Logisim/Verilog).')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-math2201', 'sem-202324-y2s2', 'MATH 2201', 'Complex analysis, Laplace and Fourier Transforms', 3, 'Theory', 2, 2, 'Y2S2', 0, NULL, 'Complex variables, Cauchy-Riemann equations, contour integration, Cauchy integral formula, Laplace transforms and inverse transforms, Fourier series, and Fourier transforms.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-stat2201', 'sem-202324-y2s2', 'STAT 2201', 'Theory of Statistics', 3, 'Theory', 2, 2, 'Y2S2', 0, NULL, 'Probability distributions, sampling distributions, Chi-square, t, and F distributions, point and interval estimation, maximum likelihood estimation, regression analysis, and ANOVA.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse2250', 'sem-202324-y2s2', 'CSE 2250', 'Viva Voce', 0.75, 'Viva', 2, 2, 'Y2S2', 0, NULL, 'Comprehensive oral examination assessing the full spectrum of academic topics and project competencies from Year 2 Semester 2.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3100', 'sem-202324-y3s1', 'CSE 3100', 'Software Project I', 1.5, 'Sessional', 3, 1, 'Y3S1', 0, NULL, 'End-to-end full-stack software application engineering: requirements gathering, system modeling, database design, REST API implementation, automated testing, and team sprint demos.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3101', 'sem-202324-y3s1', 'CSE 3101', 'Computer Architecture and Organization', 3, 'Theory', 3, 1, 'Y3S1', 0, NULL, 'Instruction set architecture (MIPS/RISC-V), ALU design, processor datapath and control unit, pipelining hazards, cache memory hierarchy, virtual memory, and multicore processors.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3103', 'sem-202324-y3s1', 'CSE 3103', 'Compiler Design', 3, 'Theory', 3, 1, 'Y3S1', 0, NULL, 'Compiler architecture: lexical analysis, syntax analysis (top-down and bottom-up parsing), syntax-directed translation, intermediate code generation, code optimization, and target code generation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3104', 'sem-202324-y3s1', 'CSE 3104', 'Compiler Design Sessional', 0.75, 'Sessional', 3, 1, 'Y3S1', 0, NULL, 'Hands-on compiler construction with Flex and Bison (Lex & Yacc), symbol table management, syntax tree generation, semantic checks, and mini-compiler project.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3105', 'sem-202324-y3s1', 'CSE 3105', 'Numerical Methods', 3, 'Theory', 3, 1, 'Y3S1', 0, NULL, 'Error analysis, roots of non-linear equations (Bisection, Newton-Raphson), systems of linear equations (Gauss-Seidel), interpolation, numerical differentiation, integration (Simpson''s rule), and ODE solvers (Runge-Kutta).')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3106', 'sem-202324-y3s1', 'CSE 3106', 'Numerical Methods Sessional', 0.75, 'Sessional', 3, 1, 'Y3S1', 0, NULL, 'Implementation of numerical algorithms in Python/C++: root finding, matrix factorizations, polynomial interpolations, numerical integration, and convergence tests.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3107', 'sem-202324-y3s1', 'CSE 3107', 'Database Management Systems', 3, 'Theory', 3, 1, 'Y3S1', 0, NULL, 'Relational model, relational algebra, SQL, E-R data modeling, Normalization (1NF to BCNF), transaction processing, ACID properties, concurrency control, and database recovery mechanisms.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3108', 'sem-202324-y3s1', 'CSE 3108', 'Database Management Systems Sessional', 1.5, 'Sessional', 3, 1, 'Y3S1', 0, NULL, 'PostgreSQL/MySQL database design, complex SQL queries, index optimization, stored procedures, triggers, view definitions, transaction isolation testing, and full-stack integration.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-ece3101', 'sem-202324-y3s1', 'ECE 3101', 'Data Communication', 3, 'Theory', 3, 1, 'Y3S1', 0, NULL, 'Data transmission concepts, signal encoding techniques, transmission media, multiplexing (FDM, TDM), modulation (ASK, FSK, PSK, QAM), error detection and correction, and data link control protocols.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-ece3102', 'sem-202324-y3s1', 'ECE 3102', 'Data Communication Sessional', 0.75, 'Sessional', 3, 1, 'Y3S1', 0, NULL, 'Signal analysis using MATLAB/Oscilloscopes, analog-to-digital conversions, line coding simulations, Hamming codes, CRC error detection, and communication lab experiments.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3150', 'sem-202324-y3s1', 'CSE 3150', 'Viva Voce', 0.75, 'Viva', 3, 1, 'Y3S1', 0, NULL, 'Comprehensive oral examination assessing the curriculum competencies, projects, and theoretical depth of Year 3 Semester 1.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3200', 'sem-202324-y3s2', 'CSE 3200', 'Software Project II', 1.5, 'Sessional', 3, 2, 'Y3S2', 0, NULL, 'Advanced software development project: cloud-native systems, microservices architecture, Docker containerization, CI/CD pipeline deployment, and comprehensive technical documentation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3201', 'sem-202324-y3s2', 'CSE 3201', 'System Analysis and Design', 3, 'Theory', 3, 2, 'Y3S2', 0, NULL, 'System development life cycle, feasibility studies, requirements engineering, object-oriented modeling with UML (Use Case, Activity, Sequence, Class diagrams), system architecture, and UI/UX design principles.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3203', 'sem-202324-y3s2', 'CSE 3203', 'Operating Systems', 3, 'Theory', 3, 2, 'Y3S2', 0, NULL, 'OS architectures, process management, CPU scheduling algorithms, inter-process communication, semaphores, deadlock detection and prevention, memory management, virtual memory, paging, and file systems.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3204', 'sem-202324-y3s2', 'CSE 3204', 'Operating Systems Sessional', 1.5, 'Sessional', 3, 2, 'Y3S2', 0, NULL, 'Linux kernel system calls, multi-threaded C programming with POSIX threads, process synchronization, custom shell implementation, and page replacement algorithm benchmarks.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3205', 'sem-202324-y3s2', 'CSE 3205', 'Web Engineering', 3, 'Theory', 3, 2, 'Y3S2', 0, NULL, 'Web protocols (HTTP/HTTPS, WebSockets), client-side architectures, server-side frameworks, RESTful APIs, authentication (JWT, OAuth), web performance, security (CORS, CSRF, XSS), and modern web stacks.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3206', 'sem-202324-y3s2', 'CSE 3206', 'Web Engineering Sessional', 1, 'Sessional', 3, 2, 'Y3S2', 0, NULL, 'Development of responsive web applications: modern JavaScript/TypeScript, React frontend, Node/Express backend, database integration, API authorization, and cloud hosting.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3207', 'sem-202324-y3s2', 'CSE 3207', 'Digital Signal Processing', 3, 'Theory', 3, 2, 'Y3S2', 0, NULL, 'Discrete-time signals and systems, Z-transform, Discrete Fourier Transform (DFT), Fast Fourier Transform (FFT), FIR and IIR digital filter design, filter realization, and DSP applications.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3208', 'sem-202324-y3s2', 'CSE 3208', 'Digital Signal Processing Sessional', 0.75, 'Sessional', 3, 2, 'Y3S2', 0, NULL, 'Signal processing experiments using MATLAB/Python: sampling theorem verification, FFT spectrum analysis, FIR/IIR filter implementation, audio filtering, and noise cancellation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3209', 'sem-202324-y3s2', 'CSE 3209', 'Microprocessors and Assembly Language', 3, 'Theory', 3, 2, 'Y3S2', 0, NULL, 'Intel 8086 microprocessor architecture, register organization, memory segmentation, addressing modes, 8086 assembly language programming, interrupts, and hardware bus cycles.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3210', 'sem-202324-y3s2', 'CSE 3210', 'Microprocessors and Assembly Language Sessional', 1.5, 'Sessional', 3, 2, 'Y3S2', 0, NULL, 'Assembly language programming with EMU8086/MASM: arithmetic operations, loops, string processing, BIOS/DOS interrupts, macro definitions, and hardware interfacing experiments.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse3250', 'sem-202324-y3s2', 'CSE 3250', 'Viva Voce', 0.75, 'Viva', 3, 2, 'Y3S2', 0, NULL, 'Comprehensive oral examination assessing the curriculum courses and software/hardware projects of Year 3 Semester 2.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4100', 'sem-202324-y4s1', 'CSE 4100', 'Thesis', 1.5, 'Sessional', 4, 1, 'Y4S1', 0, NULL, 'Undergraduate research thesis (evaluated combined with CSE 4200): literature review, research methodology, formulation of research problem, preliminary experiments, and progress defense.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4101', 'sem-202324-y4s1', 'CSE 4101', 'Software Engineering', 3, 'Theory', 4, 1, 'Y4S1', 0, NULL, 'Software processes (Agile, Scrum, Kanban), software requirements specification, architectural patterns, design patterns, testing strategies (unit, integration, regression), code quality metrics, and DevOps.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4102', 'sem-202324-y4s1', 'CSE 4102', 'Software Project III', 1.5, 'Sessional', 4, 1, 'Y4S1', 0, NULL, 'Enterprise software capstone project: microservices architecture, automated CI/CD pipelines, container orchestration with Docker/Kubernetes, performance testing, and production deployment.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4103', 'sem-202324-y4s1', 'CSE 4103', 'Artificial Intelligence', 3, 'Theory', 4, 1, 'Y4S1', 0, NULL, 'Intelligent agents, uninformed and heuristic search (A*, IDA*), adversarial search (Minimax, Alpha-Beta pruning), constraint satisfaction problems, propositional and first-order logic, probabilistic reasoning, and reinforcement learning.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4104', 'sem-202324-y4s1', 'CSE 4104', 'Artificial Intelligence Sessional', 0.75, 'Sessional', 4, 1, 'Y4S1', 0, NULL, 'Hands-on AI problem solving in Python: state-space graph search algorithms, game-playing engines, constraint satisfaction solvers, probabilistic inference, and expert systems.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4105', 'sem-202324-y4s1', 'CSE 4105', 'Digital Image Processing', 3, 'Theory', 4, 1, 'Y4S1', 0, NULL, 'Digital image fundamentals, image enhancement in spatial and frequency domains, image restoration, color image processing, wavelets, image compression, morphological processing, and image segmentation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4106', 'sem-202324-y4s1', 'CSE 4106', 'Digital Image Processing Sessional', 1.5, 'Sessional', 4, 1, 'Y4S1', 0, NULL, 'Implementation of image processing algorithms in Python/OpenCV: histogram equalization, spatial convolution filters, edge detection (Sobel, Canny), morphological operations, and object segmentation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-hum4101', 'sem-202324-y4s1', 'HUM 4101', 'Sociology and Bangladesh Studies', 3, 'Theory', 4, 1, 'Y4S1', 0, NULL, 'Sociological theories, social institutions, urbanization, industrial sociology, history of Bangladesh, Liberation War of 1971, constitution, governance, and socioeconomic development.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4150', 'sem-202324-y4s1', 'CSE 4150', 'Viva Voce', 0.75, 'Viva', 4, 1, 'Y4S1', 0, NULL, 'Comprehensive oral examination assessing theoretical competence, thesis progress, and coursework knowledge of Year 4 Semester 1.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4107', 'sem-202324-y4s1', 'CSE 4107', 'Computer Simulation and Modeling', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'System simulation concepts, continuous and discrete-event simulation, random number generation, input modeling, verification and validation of simulation models, and queuing models.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4109', 'sem-202324-y4s1', 'CSE 4109', 'Multimedia Technology', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'Multimedia data representations (text, audio, image, video), compression standards (JPEG, MPEG), streaming multimedia protocols, synchronization, and multimedia authoring systems.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4111', 'sem-202324-y4s1', 'CSE 4111', 'Basic Graph Theory', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'Graphs and subgraphs, trees, connectivity, Euler tours, Hamilton cycles, matchings, vertex and edge colorings, planar graphs, directed graphs, and extremal graph theory.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4113', 'sem-202324-y4s1', 'CSE 4113', 'Parallel and Distributed Processing', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'Parallel computer architectures, Flynn''s taxonomy, shared-memory vs distributed-memory programming (OpenMP, MPI), parallel algorithm design, synchronization, and cluster computing.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4115', 'sem-202324-y4s1', 'CSE 4115', 'Data Mining', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'Data warehousing, OLAP, association rule mining (Apriori, FP-Growth), classification algorithms (Decision Trees, Naive Bayes, SVM), clustering (K-Means, DBSCAN), and outlier detection.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4117', 'sem-202324-y4s1', 'CSE 4117', 'Computer Vision', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'Camera models, geometry of multiple views, feature extraction (SIFT, SURF, ORB), optical flow, object detection, convolutional neural networks (CNNs) for vision, and image segmentation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4119', 'sem-202324-y4s1', 'CSE 4119', 'Machine Learning', 3, 'Theory', 4, 1, 'Y4S1', 1, 'Optional-I', 'Supervised learning (Linear/Logistic Regression, SVM, Random Forests), unsupervised learning (PCA, Clustering), deep neural networks, loss optimization (SGD, Adam), regularization, and model evaluation.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4200', 'sem-202324-y4s2', 'CSE 4200', 'Thesis', 3, 'Sessional', 4, 2, 'Y4S2', 0, NULL, 'Undergraduate graduation thesis: experimental design, algorithmic implementations, result evaluation, academic paper drafting, final thesis dissertation book submission, and board defense.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4201', 'sem-202324-y4s2', 'CSE 4201', 'Computer Networks', 3, 'Theory', 4, 2, 'Y4S2', 0, NULL, 'OSI and TCP/IP protocol stacks, IPv4/IPv6 addressing, subnetting, routing protocols (OSPF, BGP), transport protocols (TCP flow and congestion control, UDP), DNS, HTTP, and SDN architectures.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4202', 'sem-202324-y4s2', 'CSE 4202', 'Computer Networks Sessional', 1.5, 'Sessional', 4, 2, 'Y4S2', 0, NULL, 'Network packet analysis using Wireshark, socket programming in Python/C, Cisco Packet Tracer router/switch topology configurations, VLANs, NAT, and network firewall configurations.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4203', 'sem-202324-y4s2', 'CSE 4203', 'Computer Graphics', 3, 'Theory', 4, 2, 'Y4S2', 0, NULL, 'Graphics hardware, rasterization algorithms (Bresenham, midpoint), 2D and 3D affine transformations, viewing pipelines, clipping, 3D projections, hidden surface removal, shading, and ray tracing.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4204', 'sem-202324-y4s2', 'CSE 4204', 'Computer Graphics Sessional', 1.5, 'Sessional', 4, 2, 'Y4S2', 0, NULL, 'Implementation of interactive 2D and 3D graphics in OpenGL/WebGL: shaders, transformation matrices, lighting, texture mapping, camera controls, and 3D simulation projects.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4205', 'sem-202324-y4s2', 'CSE 4205', 'Interfacing and Microcontrollers', 3, 'Theory', 4, 2, 'Y4S2', 0, NULL, 'Microcontroller architectures (PIC/AVR/ARM), programmable peripheral interfaces (8255 PPI, 8254 Timer, 8259 PIC), serial communication protocols (I2C, SPI, UART), ADC/DAC interfacing, and real-time systems.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4206', 'sem-202324-y4s2', 'CSE 4206', 'Interfacing and Microcontrollers Sessional', 0.75, 'Sessional', 4, 2, 'Y4S2', 0, NULL, 'Hardware laboratory interfacing with microcontrollers: sensor reading, LCD/OLED displays, motor drivers, PWM control, interrupt handling, and embedded system project design.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-hum4201', 'sem-202324-y4s2', 'HUM 4201', 'Industrial Management and Accounting', 3, 'Theory', 4, 2, 'Y4S2', 0, NULL, 'Principles of management, organizational behavior, operations research, total quality management, financial accounting, cost accounting, budgeting, project appraisal, and engineering ethics.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4250', 'sem-202324-y4s2', 'CSE 4250', 'Viva Voce', 0.75, 'Viva', 4, 2, 'Y4S2', 0, NULL, 'Comprehensive grand viva voce evaluating all 4 years of undergraduate engineering coursework, thesis research, and technical readiness for industry or higher studies.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4207', 'sem-202324-y4s2', 'CSE 4207', 'Cryptography and Network Security', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'Classical ciphers, symmetric cryptography (AES, DES), asymmetric cryptography (RSA, ECC), hash functions (SHA-256), digital signatures, PKI, SSL/TLS, firewalls, and intrusion detection systems.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4209', 'sem-202324-y4s2', 'CSE 4209', 'VLSI Design', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'MOS transistor theory, CMOS inverter characteristics, combinational and sequential CMOS circuit design, stick diagrams, physical layout design, Verilog HDL synthesis, and FPGA architectures.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4211', 'sem-202324-y4s2', 'CSE 4211', 'Wireless Communication', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'Cellular wireless concepts, channel fading models, multiple access techniques (CDMA, OFDMA), wireless networks (Wi-Fi, 4G LTE, 5G NR), MIMO systems, and mobile ad-hoc networks (MANET).')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4213', 'sem-202324-y4s2', 'CSE 4213', 'Computational Geometry', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'Geometric primitives, convex hulls (Graham scan, Jarvis march), line segment intersections, polygon triangulations, Voronoi diagrams, Delaunay triangulations, and range searching.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4215', 'sem-202324-y4s2', 'CSE 4215', 'Bioinformatics', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'Biological sequence analysis (DNA/RNA/Protein), pairwise and multiple sequence alignment (Needleman-Wunsch, Smith-Waterman, BLAST), phylogenetic trees, Hidden Markov Models, and structural genomics.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4217', 'sem-202324-y4s2', 'CSE 4217', 'Human Computer Interaction', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'User-centered design, usability engineering, psychological foundations of interaction, user research, wireframing, heuristic evaluation, usability testing, and accessibility (a11y) standards.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;
INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, year, semester, term_code, is_optional, elective_group, syllabus_outline)
VALUES ('c-cse4219', 'sem-202324-y4s2', 'CSE 4219', 'Knowledge Engineering', 3, 'Theory', 4, 2, 'Y4S2', 1, 'Optional-II', 'Knowledge acquisition, representation using ontologies (OWL, RDF), semantic web technologies, knowledge graph construction, rule-based reasoning engines, and inference mechanisms.')
ON CONFLICT(semester_id, course_code) DO UPDATE SET
  course_title = excluded.course_title,
  credit_hours = excluded.credit_hours,
  course_type = excluded.course_type,
  year = excluded.year,
  semester = excluded.semester,
  term_code = excluded.term_code,
  is_optional = excluded.is_optional,
  elective_group = excluded.elective_group,
  syllabus_outline = excluded.syllabus_outline;

-- =============================================================================
-- SAMPLE ENROLLMENTS & RESULTS SEED DATA
-- =============================================================================
-- Auto-enroll student s-1 into Y3S1 Core Courses
INSERT INTO course_enrollments (id, student_id, course_id, session_id, semester_id, enrollment_status, enrollment_type)
SELECT 'enr-s1-' || c.id, 's-1', c.id, 'sess-2023-24', c.semester_id, 'ENROLLED', 'REGULAR'
FROM courses c
WHERE c.term_code = 'Y3S1' AND c.semester_id = 'sem-202324-y3s1'
ON CONFLICT(student_id, course_id) DO NOTHING;

-- Sample Final Exam Results for s-1
INSERT INTO student_results (id, student_id, course_id, session_id, semester_id, continuous_assessment_marks, final_exam_marks, total_marks, grade_point, letter_grade, credits_earned, is_passed, status)
SELECT 'res-s1-' || c.id, 's-1', c.id, 'sess-2023-24', c.semester_id, 28.0, 58.0, 86.0, 4.00, 'A+', c.credit_hours, 1, 'PUBLISHED'
FROM courses c
WHERE c.term_code = 'Y3S1' AND c.course_code = 'CSE 3107'
ON CONFLICT(student_id, course_id) DO NOTHING;
