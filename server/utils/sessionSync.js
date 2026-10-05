const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db/schema');

/**
 * Standard 8 Semesters in PUST CSE Undergrad Program
 */
const STANDARD_SEMESTERS = [
  { name: '1st Year 1st Semester', code: 'Y1S1' },
  { name: '1st Year 2nd Semester', code: 'Y1S2' },
  { name: '2nd Year 1st Semester', code: 'Y2S1' },
  { name: '2nd Year 2nd Semester', code: 'Y2S2' },
  { name: '3rd Year 1st Semester', code: 'Y3S1' },
  { name: '3rd Year 2nd Semester', code: 'Y3S2' },
  { name: '4th Year 1st Semester', code: 'Y4S1' },
  { name: '4th Year 2nd Semester', code: 'Y4S2' },
];

/**
 * Standard PUST CSE Courses across 8 semesters with official faculty assignments
 */
const STANDARD_CURRICULUM = {
  Y1S1: [
    {
      code: 'CSE-1101',
      title: 'Structured Programming Language',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-2', // Dr. Sadia Fatima
      syllabus: 'C syntax, pointers, control flow, functions, recursion, dynamic memory allocation, and file I/O.'
    },
    {
      code: 'CSE-1102',
      title: 'Structured Programming Language Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-2',
      syllabus: 'Hands-on C programming laboratory exercises and algorithmic implementations.'
    },
    {
      code: 'EEE-1103',
      title: 'Basic Electrical & Electronic Engineering',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100228', // Assigned faculty
      syllabus: 'DC/AC circuit theorems, semiconductors, diodes, BJT amplifiers, and op-amps.'
    },
    {
      code: 'MATH-1105',
      title: 'Differential and Integral Calculus',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100012',
      syllabus: 'Differential calculus, curvature, series expansions, definite/indefinite integrals, and multivariable calculus.'
    }
  ],
  Y1S2: [
    {
      code: 'CSE-1201',
      title: 'Discrete Mathematics',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100012', // Dr. Md. Niaz Imtiaz
      syllabus: 'Set theory, propositional logic, graph theory, combinatorics, proof methods, and recurrence relations.'
    },
    {
      code: 'CSE-1203',
      title: 'Object Oriented Programming',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100214', // Nitun Kumar Podder
      syllabus: 'OOP paradigms in Java/C++, encapsulation, inheritance, polymorphism, templates, and exception handling.'
    },
    {
      code: 'CSE-1204',
      title: 'Object Oriented Programming Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100214',
      syllabus: 'Practical Java application building, GUI design with Swing/JavaFX, and design patterns.'
    },
    {
      code: 'MATH-1205',
      title: 'Linear Algebra and Coordinate Geometry',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100002',
      syllabus: 'Matrices, vector spaces, eigenvalues, eigenvectors, 2D and 3D coordinate transformations.'
    }
  ],
  Y2S1: [
    {
      code: 'CSE-2101',
      title: 'Data Structures',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100002', // S. M. Hasan Sazzad Iqbal
      syllabus: 'Arrays, linked lists, stacks, queues, trees, AVL trees, heaps, hashing, and graphs.'
    },
    {
      code: 'CSE-2102',
      title: 'Data Structures Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100002',
      syllabus: 'C++ implementations of complex data structures and algorithmic efficiency benchmarking.'
    },
    {
      code: 'CSE-2103',
      title: 'Digital Logic Design',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100012',
      syllabus: 'Boolean algebra, Karnaugh maps, combinational logic, multiplexers, flip-flops, and sequential circuits.'
    },
    {
      code: 'CSE-2104',
      title: 'Digital Logic Design Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100012',
      syllabus: 'Hardware breadboard wiring, IC verification, and Verilog HDL simulation.'
    }
  ],
  Y2S2: [
    {
      code: 'CSE-2201',
      title: 'Algorithms Design & Analysis',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100002',
      syllabus: 'Divide and conquer, greedy algorithms, dynamic programming, network flow, and NP-completeness.'
    },
    {
      code: 'CSE-2202',
      title: 'Algorithms Design Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100214',
      syllabus: 'Competitive programming challenges, graph traversals (Dijkstra, Bellman-Ford), and DP optimization.'
    },
    {
      code: 'CSE-2203',
      title: 'Computer Architecture & Organization',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100010', // Dr. Md. Khaled Ben Islam
      syllabus: 'Instruction set architecture (MIPS/RISC-V), pipelining, hazards, cache hierarchies, and superscalar designs.'
    },
    {
      code: 'CSE-2205',
      title: 'Numerical Methods & Computation',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100228', // Nakib Aman Turzo
      syllabus: 'Root finding, interpolation, numerical differentiation/integration, and error analysis.'
    }
  ],
  Y3S1: [
    {
      code: 'CSE-3101',
      title: 'Database Management Systems',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-1', // Dr. Mahmudur Rahman
      syllabus: 'Relational algebra, SQL, E-R modeling, Normalization, transactions, concurrency, and indexing.'
    },
    {
      code: 'CSE-3102',
      title: 'Database Management Systems Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-2', // Dr. Sadia Fatima
      syllabus: 'PostgreSQL database development, triggers, stored procedures, and full-stack API integration.'
    },
    {
      code: 'CSE-3103',
      title: 'Operating Systems & System Architecture',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100003', // Md. Shafiul Azam
      syllabus: 'Processes, scheduling, IPC, semaphores, deadlocks, virtual memory, paging, and file systems.'
    },
    {
      code: 'CSE-3104',
      title: 'Operating Systems & Shell Scripting Lab',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100003',
      syllabus: 'Linux kernel system calls, pthread multithreading, and Bash automation.'
    }
  ],
  Y3S2: [
    {
      code: 'CSE-3201',
      title: 'Software Engineering & Agile Design',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100016', // Dr. Md. Toukir Ahmed
      syllabus: 'SDLC methodologies, Agile/Scrum, UML architecture, design patterns, testing, and CI/CD.'
    },
    {
      code: 'CSE-3202',
      title: 'Software Engineering Project Lab',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100016',
      syllabus: 'Semester-long team capstone software product development and deployment.'
    },
    {
      code: 'CSE-3203',
      title: 'Computer Networks & Protocols',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100016',
      syllabus: 'OSI & TCP/IP stack, routing protocols (OSPF, BGP), congestion control, DNS, and HTTP/3.'
    },
    {
      code: 'CSE-3204',
      title: 'Computer Networks Sessional (Lab)',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100016',
      syllabus: 'Socket programming, Cisco Packet Tracer routing configurations, and Wireshark packet capture.'
    }
  ],
  Y4S1: [
    {
      code: 'CSE-4101',
      title: 'Artificial Intelligence & Neural Networks',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100009', // Dr. Md. Abdur Rahim (Professor & Chairman)
      syllabus: 'Search heuristics, game playing (Minimax/Alpha-Beta), CSP, neural networks, backpropagation, and NLP.'
    },
    {
      code: 'CSE-4102',
      title: 'Artificial Intelligence & Expert Systems Lab',
      credits: 1.5,
      type: 'LAB',
      teacherId: 't-100009',
      syllabus: 'Python PyTorch deep learning models, heuristic search solvers, and computer vision classification.'
    },
    {
      code: 'CSE-4103',
      title: 'Compiler Design & Language Processing',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100228', // Nakib Aman Turzo
      syllabus: 'Lexical analysis, syntax trees, LL/LR parsing, semantic analysis, intermediate code, and code generation.'
    },
    {
      code: 'CSE-4105',
      title: 'Digital Image Processing',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100003', // Md. Shafiul Azam
      syllabus: 'Spatial/frequency filtering, edge detection, Hough transform, segmentation, and feature extraction.'
    }
  ],
  Y4S2: [
    {
      code: 'CSE-4201',
      title: 'Machine Learning & Deep Neural Networks',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100009', // Dr. Md. Abdur Rahim
      syllabus: 'Supervised/unsupervised learning, SVMs, CNNs, Transformers, attention mechanisms, and reinforcement learning.'
    },
    {
      code: 'CSE-4203',
      title: 'Cryptography, Cyber Security & Blockchain',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100010', // Dr. Md. Khaled Ben Islam
      syllabus: 'AES, RSA, ECC, digital signatures, zero-knowledge proofs, network security, and smart contracts.'
    },
    {
      code: 'CSE-4205',
      title: 'Cloud Computing & Distributed Systems',
      credits: 3.0,
      type: 'THEORY',
      teacherId: 't-100010',
      syllabus: 'Virtualization, microservices, containerization (Docker/K8s), distributed consensus (Raft/Paxos), and serverless.'
    }
  ]
};

/**
 * Standard student roster template for generating authentic enrolled students per session
 */
const SAMPLE_STUDENT_NAMES = [
  { first: 'Kowshik', last: 'Ahmed' },
  { first: 'Tanvir', last: 'Hasan' },
  { first: 'Nusrat', last: 'Jahan' },
  { first: 'Fahim', last: 'Hossain' },
  { first: 'Ayesha', last: 'Siddiqua' },
  { first: 'Raihan', last: 'Kabir' },
  { first: 'Farhana', last: 'Yasmin' },
  { first: 'Mehedi', last: 'Hasan' },
  { first: 'Tasnim', last: 'Anjum' },
  { first: 'Ashikur', last: 'Rahman' },
  { first: 'Sanjida', last: 'Akter' },
  { first: 'Shakil', last: 'Mahmud' },
  { first: 'Mahfuzur', last: 'Rahman' },
  { first: 'Sadia', last: 'Afrin' },
  { first: 'Zubair', last: 'Hasan' }
];

/**
 * Ensure a given session exists in academic_sessions, has all 8 standard semesters,
 * has standard courses populated, assigned teachers, enrolled student cohort, and initial marks.
 */
function ensureSessionWithStandardCourses(sessionNameInput, startDateInput, endDateInput, isCurrent = false) {
  if (!sessionNameInput) return null;

  let sessionName = sessionNameInput.trim();
  if (!sessionName.toLowerCase().startsWith('session ') && /^\d{4}-\d{4}/.test(sessionName)) {
    sessionName = 'Session ' + sessionName;
  }

  // Extract years if possible
  const yearMatch = sessionName.match(/(\d{4})-(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1]) : 2024;
  const endYear = yearMatch ? parseInt(yearMatch[2]) : startYear + 1;

  const startDate = startDateInput || `${startYear}-07-01`;
  const endDate = endDateInput || `${endYear}-06-30`;

  // 1. Check if session already exists
  let session = db.prepare('SELECT * FROM academic_sessions WHERE session_name = ?').get(sessionName);

  if (!session) {
    const sessionId = `sess-${startYear}-${String(endYear).slice(-2)}`;
    // Check if id taken
    const existingById = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(sessionId);
    const finalSessionId = existingById ? 'sess-' + crypto.randomUUID() : sessionId;

    db.prepare(`
      INSERT INTO academic_sessions (id, session_name, start_date, end_date, is_current)
      VALUES (?, ?, ?, ?, ?)
    `).run(finalSessionId, sessionName, startDate, endDate, isCurrent ? 1 : 0);

    session = db.prepare('SELECT * FROM academic_sessions WHERE id = ?').get(finalSessionId);
  } else if (startDateInput && (!session.start_date || session.start_date !== startDateInput)) {
    db.prepare('UPDATE academic_sessions SET start_date = ? WHERE id = ?').run(startDateInput, session.id);
    session.start_date = startDateInput;
  }

  // 2. Ensure 8 standard semesters exist
  const existingSemesters = db.prepare('SELECT * FROM semesters WHERE session_id = ?').all(session.id);
  const semesterMap = {};
  for (const s of existingSemesters) {
    semesterMap[s.term_code] = s.id;
  }

  const insertSemester = db.prepare(`
    INSERT INTO semesters (id, session_id, semester_name, term_code, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const semDef of STANDARD_SEMESTERS) {
    if (!semesterMap[semDef.code]) {
      const semId = `sem-${session.id}-${semDef.code.toLowerCase()}`;
      insertSemester.run(semId, session.id, semDef.name, semDef.code, semDef.code === 'Y3S1' ? 1 : 0);
      semesterMap[semDef.code] = semId;
    }
  }

  // 3. Ensure standard courses exist under each semester
  const insertCourse = db.prepare(`
    INSERT INTO courses (id, semester_id, course_code, course_title, credit_hours, course_type, syllabus_outline)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAssignment = db.prepare(`
    INSERT INTO course_assignments (id, course_id, teacher_id, assigned_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(course_id, teacher_id) DO NOTHING
  `);

  const existingCourses = db.prepare(`
    SELECT c.id, c.course_code, sem.term_code
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    WHERE sem.session_id = ?
  `).all(session.id);

  const courseCodeMap = {};
  for (const c of existingCourses) {
    courseCodeMap[c.course_code] = c.id;
  }

  for (const [termCode, courseList] of Object.entries(STANDARD_CURRICULUM)) {
    const semId = semesterMap[termCode];
    if (!semId) continue;

    for (const cDef of courseList) {
      let courseId = courseCodeMap[cDef.code];
      if (!courseId) {
        courseId = `c-${session.id}-${cDef.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        try {
          insertCourse.run(
            courseId,
            semId,
            cDef.code,
            cDef.title,
            cDef.credits,
            cDef.type,
            cDef.syllabus
          );
          courseCodeMap[cDef.code] = courseId;
        } catch (e) {
          // If id collision, generate random
          courseId = 'c-' + crypto.randomUUID();
          insertCourse.run(
            courseId,
            semId,
            cDef.code,
            cDef.title,
            cDef.credits,
            cDef.type,
            cDef.syllabus
          );
          courseCodeMap[cDef.code] = courseId;
        }
      }

      // Assign teacher if designated and not yet assigned
      if (cDef.teacherId) {
        const hasAssignment = db.prepare('SELECT id FROM course_assignments WHERE course_id = ?').get(courseId);
        if (!hasAssignment) {
          insertAssignment.run('ca-' + crypto.randomUUID(), courseId, cDef.teacherId, 'u-office');
        }
      }
    }
  }

  // 4. Ensure students exist in this session
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE current_session_id = ?').get(session.id);
  if (!studentCount || studentCount.count < 10) {
    const rollYear = String(startYear).slice(-2);
    const passHash = bcrypt.hashSync('Student@123', 8);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone_number, status)
      VALUES (?, ?, ?, 'STUDENT', ?, ?, ?, 'ACTIVE')
      ON CONFLICT(email) DO NOTHING
    `);

    const insertStudent = db.prepare(`
      INSERT INTO students (id, user_id, student_roll, registration_no, current_session_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_roll) DO NOTHING
    `);

    for (let i = 0; i < SAMPLE_STUDENT_NAMES.length; i++) {
      const sNum = String(i + 1).padStart(2, '0');
      const roll = `CSE-${rollYear}01${sNum}`;
      const reg = `REG-${startYear}${sNum}`;
      const email = `student.${rollYear}01${sNum}@cse.pust.ac.bd`;
      const name = SAMPLE_STUDENT_NAMES[i];
      const userId = `u-stud-${rollYear}-${sNum}`;
      const studentId = `s-${rollYear}-${sNum}`;

      insertUser.run(
        userId,
        email,
        passHash,
        name.first,
        name.last,
        `+8801700${rollYear}${sNum}1`
      );

      const activeUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (activeUser) {
        insertStudent.run(
          studentId,
          activeUser.id,
          roll,
          reg,
          session.id
        );
      }
    }
  }

  // 5. Seed some initial continuous assessment marks for first 3 students on key courses so it displays immediately
  seedSampleMarksForSession(session.id);

  return session;
}

/**
 * Seed realistic Class Test marks and Attendance for previewing
 */
function seedSampleMarksForSession(sessionId) {
  const students = db.prepare(`
    SELECT s.id, s.student_roll
    FROM students s
    WHERE s.current_session_id = ?
    LIMIT 6
  `).all(sessionId);

  if (students.length === 0) return;

  const keyCourses = db.prepare(`
    SELECT c.id, ca.teacher_id
    FROM courses c
    JOIN semesters sem ON sem.id = c.semester_id
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    WHERE sem.session_id = ? AND c.course_code IN ('CSE-3101', 'CSE-3103', 'CSE-4101', 'CSE-1101')
  `).all(sessionId);

  const upsertMark = db.prepare(`
    INSERT INTO ct_marks (id, course_id, student_id, recorded_by, ct_number, obtained_marks, max_marks, remarks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(course_id, student_id, ct_number) DO NOTHING
  `);

  for (const c of keyCourses) {
    const teacherId = c.teacher_id || 't-1';
    students.forEach((st, idx) => {
      // CT 1
      const ct1Val = Number((7.5 + (idx * 0.4) % 2.5).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-1`, c.id, st.id, teacherId, 1, ct1Val, 10.0, 'Good conceptual clarity');
      // CT 2
      const ct2Val = Number((8.0 + (idx * 0.3) % 2.0).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-2`, c.id, st.id, teacherId, 2, ct2Val, 10.0, 'Strong problem solving');
      // CT 3
      const ct3Val = Number((7.0 + (idx * 0.5) % 3.0).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-3`, c.id, st.id, teacherId, 3, ct3Val, 10.0, 'Review test case edge cases');
      // Attendance (max 10)
      const attVal = Number((8.5 + (idx * 0.3) % 1.5).toFixed(1));
      upsertMark.run(`ct-${c.id}-${st.id}-4`, c.id, st.id, teacherId, 4, attVal, 10.0, 'Consistent attendance');
    });
  }
}

/**
 * Synchronize all serial academic sessions
 * e.g., 2024-2025, 2023-2024, 2022-2023, 2021-2022, 2020-2021
 */
function syncAllSerialSessions() {
  const serialSessions = [
    { name: 'Session 2024-2025', startDate: '2024-07-01', endDate: '2025-06-30', isCurrent: false },
    { name: 'Session 2023-2024', startDate: '2023-07-01', endDate: '2024-06-30', isCurrent: true },
    { name: 'Session 2022-2023', startDate: '2022-07-01', endDate: '2023-06-30', isCurrent: false },
    { name: 'Session 2021-2022', startDate: '2021-07-01', endDate: '2022-06-30', isCurrent: false },
    { name: 'Session 2020-2021', startDate: '2020-07-01', endDate: '2021-06-30', isCurrent: false },
  ];

  for (const s of serialSessions) {
    ensureSessionWithStandardCourses(s.name, s.startDate, s.endDate, s.isCurrent);
  }
}

module.exports = {
  ensureSessionWithStandardCourses,
  syncAllSerialSessions,
  STANDARD_CURRICULUM,
  STANDARD_SEMESTERS
};
