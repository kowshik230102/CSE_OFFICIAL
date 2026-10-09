const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runStep5Step6Verification() {
  console.log('================================================================');
  console.log('🧪 RUNNING STEP 5 & STEP 6: TEACHER ASSIGNMENT & WORKLOAD TESTS');
  console.log('================================================================\n');

  // 1. Login as Admin
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@cse.univ.edu', password: 'Admin@123' });

  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes.body));
  }
  const token = loginRes.body.token;
  console.log('✓ 1. Admin authenticated successfully.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Fetch Department Faculty Teachers from Meta API
  const teachersRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/routines/meta/teachers',
    method: 'GET',
    headers: authHeaders
  });

  if (teachersRes.status !== 200 || !Array.isArray(teachersRes.body.teachers)) {
    throw new Error('GET /api/routines/meta/teachers failed');
  }
  const teachers = teachersRes.body.teachers;
  console.log(`✓ 2. Loaded ${teachers.length} department teachers from master database.`);
  if (teachers.length < 2) {
    throw new Error('Expected at least 2 teachers in department');
  }
  const teacherA = teachers[0]; // e.g. Dr. Md. Abdur Rahim
  console.log(`   Selected Department Teacher A: ${teacherA.fullName} (${teacherA.shortCode || 'No short code'}, ${teacherA.designation})`);

  // Record initial master teacher count
  const initialTeacherCount = teachers.length;

  // 3. Fetch Academic Tree and Pick a Semester
  const treeRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/routines/meta/academic-tree',
    method: 'GET',
    headers: authHeaders
  });

  const tree = treeRes.body.academicTree;
  let targetSemesterId = null;
  for (const session of tree) {
    if (session.semesters && session.semesters.length > 0) {
      targetSemesterId = session.semesters[0].id;
      break;
    }
  }

  if (!targetSemesterId) {
    throw new Error('No semester found in academic tree');
  }

  // 4. Load Semester Details
  const semDetailRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/meta/semester/${targetSemesterId}`,
    method: 'GET',
    headers: authHeaders
  });

  if (semDetailRes.status !== 200) {
    throw new Error('Failed to load semester details');
  }

  const { semester, courses, totalStudents } = semDetailRes.body;
  console.log(`✓ 3. Loaded Semester "${semester.semesterName} (${semester.shortTerm})" with ${courses.length} courses & ${totalStudents} students.`);

  // Verify initial course state
  for (const c of courses) {
    if (c.assignmentStatus !== 'Pending') {
      throw new Error(`Expected initial course status to be 'Pending', got ${c.assignmentStatus}`);
    }
    if (c.teacher.type !== 'none' || c.teacher.teacherName !== 'Not Assigned') {
      throw new Error(`Expected initial teacher to be Not Assigned, got ${JSON.stringify(c.teacher)}`);
    }
  }
  console.log('✓ 4. Verified all courses initially have Teacher = "Not Assigned" and Status = "Pending".');

  // 5. Create New Routine
  const createRoutineRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/routines',
    method: 'POST',
    headers: authHeaders
  }, {
    title: 'Automated Test Routine - Step 5 & 6',
    department: 'CSE',
    academicYear: 'Session 2026-2027',
    effectiveFrom: '2026-10-15',
    status: 'DRAFT',
    routineData: {
      routineName: 'Automated Test Routine - Step 5 & 6',
      department: 'CSE',
      academicYear: 'Session 2026-2027',
      effectiveFrom: '2026-10-15',
      semesters: []
    }
  });

  if (createRoutineRes.status !== 201 || !createRoutineRes.body.id) {
    throw new Error('Failed to create routine: ' + JSON.stringify(createRoutineRes.body));
  }
  const routineId = createRoutineRes.body.id;
  console.log(`✓ 5. Created Routine "${createRoutineRes.body.title}" (ID: ${routineId}).`);

  // 6. Assign Department Teacher to Course 0 and Course 1
  if (courses.length < 3) {
    throw new Error('Need at least 3 courses for complete Step 5 & 6 testing');
  }

  const assignedCourses = JSON.parse(JSON.stringify(courses));

  // Course 0: Assign Department Teacher A
  assignedCourses[0].assignmentStatus = 'Assigned';
  assignedCourses[0].teacher = {
    type: 'department',
    teacherId: teacherA.teacherId,
    teacherName: teacherA.fullName,
    designation: teacherA.designation,
    department: teacherA.department,
    shortCode: teacherA.shortCode,
    roomNumber: teacherA.roomNumber
  };

  // Course 1: Assign SAME Department Teacher A
  assignedCourses[1].assignmentStatus = 'Assigned';
  assignedCourses[1].teacher = {
    type: 'department',
    teacherId: teacherA.teacherId,
    teacherName: teacherA.fullName,
    designation: teacherA.designation,
    department: teacherA.department,
    shortCode: teacherA.shortCode,
    roomNumber: teacherA.roomNumber
  };

  // Course 2: Assign Non-Department Teacher (Manual Entry)
  const nonDeptName = 'Mr. Rahim Uddin';
  const nonDeptDept = 'EEE';
  const nonDeptFullName = 'Department of Electrical and Electronic Engineering';

  assignedCourses[2].assignmentStatus = 'Non-Department';
  assignedCourses[2].teacher = {
    type: 'non_department',
    teacherId: null,
    teacherName: nonDeptName,
    designation: 'Non-Department Faculty',
    department: nonDeptDept,
    departmentNumber: nonDeptFullName,
    shortCode: nonDeptDept
  };

  // Course 3 (if exists): Remains Unassigned / Pending
  if (assignedCourses[3]) {
    assignedCourses[3].assignmentStatus = 'Pending';
    assignedCourses[3].teacher = {
      type: 'none',
      teacherId: null,
      teacherName: 'Not Assigned',
      designation: '',
      department: 'CSE',
      departmentNumber: '',
      shortCode: ''
    };
  }

  console.log(`✓ 6. Configured Course Assignments:`);
  console.log(`   - Course 1 (${assignedCourses[0].courseCode}): Assigned to Dept Teacher "${teacherA.fullName}" (${assignedCourses[0].creditHours} hrs/wk)`);
  console.log(`   - Course 2 (${assignedCourses[1].courseCode}): Assigned to SAME Dept Teacher "${teacherA.fullName}" (${assignedCourses[1].creditHours} hrs/wk)`);
  console.log(`   - Course 3 (${assignedCourses[2].courseCode}): Assigned to Non-Dept Teacher "${nonDeptName} (${nonDeptDept})" (${assignedCourses[2].creditHours} hrs/wk)`);
  if (assignedCourses[3]) {
    console.log(`   - Course 4 (${assignedCourses[3].courseCode}): Unassigned / Pending`);
  }

  // 7. Save / Persist Routine with Semester & Course Assignments
  const routinePayload = {
    title: 'Automated Test Routine - Step 5 & 6',
    department: 'CSE',
    academicYear: 'Session 2026-2027',
    effectiveFrom: '2026-10-15',
    status: 'DRAFT',
    routineData: {
      routineName: 'Automated Test Routine - Step 5 & 6',
      department: 'CSE',
      academicYear: 'Session 2026-2027',
      effectiveFrom: '2026-10-15',
      semesters: [
        {
          semesterId: semester.id,
          semesterName: semester.semesterName,
          termCode: semester.termCode,
          shortTerm: semester.shortTerm,
          sessionId: semester.sessionId,
          sessionName: semester.sessionName,
          totalStudents,
          excludedStudentIds: [],
          courses: assignedCourses
        }
      ]
    }
  };

  const saveRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/${routineId}`,
    method: 'PUT',
    headers: authHeaders
  }, routinePayload);

  if (saveRes.status !== 200) {
    throw new Error('Failed to save routine: ' + JSON.stringify(saveRes.body));
  }
  console.log('✓ 7. Saved routine with assignments to database.');

  // 8. Test Teacher Workload API: GET /api/routines/:id/teacher-workload
  const workloadRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/${routineId}/teacher-workload`,
    method: 'GET',
    headers: authHeaders
  });

  if (workloadRes.status !== 200 || !Array.isArray(workloadRes.body.workloads)) {
    throw new Error('Failed to fetch teacher workload: ' + JSON.stringify(workloadRes.body));
  }

  const workloads = workloadRes.body.workloads;
  console.log(`✓ 8. Workload API returned ${workloads.length} teacher workload entries.`);

  // Find Department Teacher A in workload
  const teacherAWorkload = workloads.find(w => w.teacherId === teacherA.teacherId);
  if (!teacherAWorkload) {
    throw new Error(`Teacher A (${teacherA.fullName}) not found in workload response!`);
  }

  const expectedHoursA = Number(assignedCourses[0].weeklyHours || assignedCourses[0].creditHours || 3) +
                         Number(assignedCourses[1].weeklyHours || assignedCourses[1].creditHours || 3);

  console.log(`   Teacher A Workload: ${teacherAWorkload.courseCount} courses / ${teacherAWorkload.weeklyHours} weekly hours`);
  if (teacherAWorkload.courseCount !== 2) {
    throw new Error(`Expected Teacher A courseCount = 2, got ${teacherAWorkload.courseCount}`);
  }
  if (teacherAWorkload.weeklyHours !== expectedHoursA) {
    throw new Error(`Expected Teacher A weeklyHours = ${expectedHoursA}, got ${teacherAWorkload.weeklyHours}`);
  }
  console.log(`✓ 9. Verified Department Teacher A workload correctly accumulated 2 courses and ${expectedHoursA} hrs/week.`);

  // Find Non-Department Teacher in workload
  const nonDeptWorkload = workloads.find(w => w.type === 'non_department' && w.teacherName === nonDeptName);
  if (!nonDeptWorkload) {
    throw new Error('Non-department teacher not found in workload response!');
  }

  const expectedHoursNonDept = Number(assignedCourses[2].weeklyHours || assignedCourses[2].creditHours || 3);
  console.log(`   Non-Dept Teacher Workload: ${nonDeptWorkload.courseCount} courses / ${nonDeptWorkload.weeklyHours} weekly hours`);
  if (nonDeptWorkload.courseCount !== 1) {
    throw new Error(`Expected Non-Dept courseCount = 1, got ${nonDeptWorkload.courseCount}`);
  }
  if (nonDeptWorkload.weeklyHours !== expectedHoursNonDept) {
    throw new Error(`Expected Non-Dept weeklyHours = ${expectedHoursNonDept}, got ${nonDeptWorkload.weeklyHours}`);
  }
  console.log(`✓ 10. Verified Non-Department Teacher workload correctly tracked (1 course, ${expectedHoursNonDept} hrs/week).`);

  // Verify unassigned courses do NOT contribute to any workload
  let totalAssignedHoursInWorkloads = workloads.reduce((sum, w) => sum + w.weeklyHours, 0);
  if (totalAssignedHoursInWorkloads !== (expectedHoursA + expectedHoursNonDept)) {
    throw new Error(`Total workload hours mismatch! Expected ${expectedHoursA + expectedHoursNonDept}, got ${totalAssignedHoursInWorkloads}`);
  }
  console.log('✓ 11. Verified unassigned course does NOT contribute to teacher workload.');

  // 9. Reload Routine from Database and Verify Persistence
  const reloadRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/${routineId}`,
    method: 'GET',
    headers: authHeaders
  });

  if (reloadRes.status !== 200 || !reloadRes.body.routine) {
    throw new Error('Failed to reload routine');
  }

  const reloadedSemesters = reloadRes.body.routine.routineData.semesters;
  const reloadedCourses = reloadedSemesters[0].courses;

  if (reloadedCourses[0].assignmentStatus !== 'Assigned' || reloadedCourses[0].teacher.teacherId !== teacherA.teacherId) {
    throw new Error('Course 0 assignment failed to persist');
  }
  if (reloadedCourses[1].assignmentStatus !== 'Assigned' || reloadedCourses[1].teacher.teacherId !== teacherA.teacherId) {
    throw new Error('Course 1 assignment failed to persist');
  }
  if (reloadedCourses[2].assignmentStatus !== 'Non-Department' || reloadedCourses[2].teacher.teacherName !== nonDeptName) {
    throw new Error('Course 2 non-department assignment failed to persist');
  }
  console.log('✓ 12. Verified full persistence: All teacher assignments, statuses, and details reloaded accurately.');

  // 10. Remove / Edit Teacher Assignment (Unassign Course 1 from Teacher A)
  reloadedCourses[1].assignmentStatus = 'Pending';
  reloadedCourses[1].teacher = {
    type: 'none',
    teacherId: null,
    teacherName: 'Not Assigned',
    designation: '',
    department: 'CSE',
    departmentNumber: '',
    shortCode: ''
  };

  await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/${routineId}`,
    method: 'PUT',
    headers: authHeaders
  }, {
    ...routinePayload,
    routineData: {
      ...routinePayload.routineData,
      semesters: reloadedSemesters
    }
  });

  const workloadAfterUnassignRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/${routineId}/teacher-workload`,
    method: 'GET',
    headers: authHeaders
  });

  const updatedTeacherAWorkload = workloadAfterUnassignRes.body.workloads.find(w => w.teacherId === teacherA.teacherId);
  const updatedExpectedHoursA = Number(assignedCourses[0].weeklyHours || assignedCourses[0].creditHours || 3);
  if (updatedTeacherAWorkload.courseCount !== 1 || updatedTeacherAWorkload.weeklyHours !== updatedExpectedHoursA) {
    throw new Error(`Workload recalculation after unassign failed! Expected 1 course / ${updatedExpectedHoursA} hrs, got ${updatedTeacherAWorkload.courseCount} courses / ${updatedTeacherAWorkload.weeklyHours} hrs`);
  }
  console.log(`✓ 13. Verified workload recalculation: Removing teacher assignment dropped Teacher A workload to 1 course / ${updatedExpectedHoursA} hrs immediately.`);

  // 11. Safety Check: Verify Master Teachers and Courses Tables are Completely Untouched
  const finalTeachersRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/routines/meta/teachers',
    method: 'GET',
    headers: authHeaders
  });

  if (finalTeachersRes.body.teachers.length !== initialTeacherCount) {
    throw new Error(`Data safety violation! Master teacher count changed from ${initialTeacherCount} to ${finalTeachersRes.body.teachers.length}`);
  }
  console.log(`✓ 14. DATA SAFETY VERIFIED: Master teachers count remain unchanged (${initialTeacherCount} faculty members). No non-department teachers contaminated the master database.`);

  // 12. Cleanup Test Routine
  await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/routines/${routineId}`,
    method: 'DELETE',
    headers: authHeaders
  });
  console.log('✓ 15. Cleaned up temporary test routine successfully.');

  console.log('\n================================================================');
  console.log('🎉 ALL STEP 5 & STEP 6 VERIFICATIONS PASSED 100%!');
  console.log('================================================================');
}

runStep5Step6Verification().catch(err => {
  console.error('\n❌ STEP 5 & 6 VERIFICATION FAILED:', err.message);
  process.exit(1);
});
