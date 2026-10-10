const { app, server } = require('./server/index.js');
const http = require('http');

async function runAssessmentTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING REGULAR ASSESSMENT MANAGEMENT SYSTEM TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const makeRequest = (path, method = 'GET', data = null, token = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, text: body });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  };

  try {
    // 1. Authenticate Admin, Teacher 1 (Rahman), Teacher 2 (Fatima)
    console.log('--- 1. Authenticating Users ---');
    const adminLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@cse.univ.edu',
      password: 'Admin@123',
    });
    assert(adminLogin.status === 200, 'Admin login succeeded');
    const adminToken = adminLogin.data.token;

    const rahmanLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'rahman@cse.univ.edu',
      password: 'Teacher@123',
    });
    assert(rahmanLogin.status === 200, 'Teacher Rahman login succeeded');
    const rahmanToken = rahmanLogin.data.token;
    const rahmanId = rahmanLogin.data.user.id;

    const fatimaLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'fatima@cse.univ.edu',
      password: 'Teacher@123',
    });
    assert(fatimaLogin.status === 200, 'Teacher Fatima login succeeded');
    const fatimaToken = fatimaLogin.data.token;

    // 2. Fetch Sessions Dashboard
    console.log('\n--- 2. Regular Assessment Dashboard: Sessions Listing ---');
    const sessionsRes = await makeRequest('/api/academic/continuous-assessment/sessions', 'GET', null, adminToken);
    assert(sessionsRes.status === 200, 'Fetched sessions list');
    assert(Array.isArray(sessionsRes.data.sessions) && sessionsRes.data.sessions.length > 0, 'Found database sessions');
    const testSession = sessionsRes.data.sessions[0];
    console.log(`     Target Session: ${testSession.session_name} (ID: ${testSession.id}), Running Semester: ${testSession.runningSemester || 'None'}`);
    assert(testSession.student_count !== undefined, 'Session card has student_count');
    assert(testSession.course_count !== undefined, 'Session card has course_count');
    assert(testSession.assigned_teachers_count !== undefined, 'Session card has assigned_teachers_count');
    assert(testSession.completion_status !== undefined, 'Session card has completion_status');

    // 3. Create Semester Endpoint & Validation
    console.log('\n--- 3. Create Semester Feature & Duplicate Protection ---');
    // Try creating a test semester
    const newSemData = {
      sessionId: testSession.id,
      year: '2nd Year',
      semester: '2nd Semester',
      startDate: '2026-07-01',
      endDate: '2026-12-15',
      classEndDate: '2026-11-20',
      assessmentDeadline: '2026-12-05',
      status: 'Running',
      notes: 'Automated test created semester'
    };
    
    // First attempt or check if exists
    const createSemRes = await makeRequest('/api/academic/continuous-assessment/semesters', 'POST', newSemData, adminToken);
    console.log('     Create Semester Response:', createSemRes.status, createSemRes.data);
    if (createSemRes.status === 201) {
      assert(true, 'Semester created successfully with auto-populated courses');
      // Duplicate prevention test
      const dupRes = await makeRequest('/api/academic/continuous-assessment/semesters', 'POST', newSemData, adminToken);
      assert(dupRes.status === 400 && dupRes.data.error.includes('already exists'), 'Duplicate semester rejected with 400 error');
    } else {
      assert(createSemRes.status === 400 && createSemRes.data && createSemRes.data.error && createSemRes.data.error.includes('already exists'), `Semester response: ${JSON.stringify(createSemRes.data)}`);
    }

    // 4. Fetch Semesters for Session
    console.log('\n--- 4. Session Semesters Listing ---');
    const semListRes = await makeRequest(`/api/academic/continuous-assessment/sessions/${testSession.id}/semesters`, 'GET', null, adminToken);
    console.log('     Semesters List Response:', semListRes.status, semListRes.data);
    assert(semListRes.status === 200, 'Fetched semesters for session');
    assert(semListRes.data && Array.isArray(semListRes.data.semesters) && semListRes.data.semesters.length > 0, 'Found valid semesters');
    const targetSem = semListRes.data?.semesters?.[0];
    console.log(`     Selected Semester: ${targetSem.semester_name} (Year: ${targetSem.year}, Semester: ${targetSem.semester})`);

    // 5. Load Courses & Routine Teacher Integration
    console.log('\n--- 5. Load Courses from Routine Integration ---');
    const coursesRes = await makeRequest(`/api/academic/continuous-assessment/sessions/${testSession.id}/courses?semesterId=${targetSem.id}`, 'GET', null, adminToken);
    console.log('     Courses Res Status:', coursesRes.status, 'Data keys:', Object.keys(coursesRes.data || {}));
    if (coursesRes.status !== 200) {
      console.log('     Courses Error:', coursesRes.data || coursesRes.text);
    }
    assert(coursesRes.status === 200, 'Fetched courses for semester');
    assert(coursesRes.data && Array.isArray(coursesRes.data.courses), 'Returned assigned courses array');
    assert(coursesRes.data && Array.isArray(coursesRes.data.unassignedCourses), 'Returned unassigned courses array');
    console.log(`     Assigned Courses: ${coursesRes.data?.assignedCourses?.length || 0}, Unassigned: ${coursesRes.data?.unassignedCourses?.length || 0}`);

    // Let's ensure we have at least one assigned course to Dr. Rahman
    let targetCourse = coursesRes.data.courses.find(c => c.assigned_teacher_id === rahmanId);
    if (!targetCourse && coursesRes.data.courses.length > 0) {
      targetCourse = coursesRes.data.courses[0];
    }
    
    if (!targetCourse && coursesRes.data.unassignedCourses.length > 0) {
      // Assign Dr. Rahman via course assignments
      const courseToAssign = coursesRes.data.unassignedCourses[0];
      const db = require('./server/db/schema.js').db;
      db.prepare(`
        INSERT OR REPLACE INTO course_assignments (id, session_id, course_id, teacher_id, academic_year, semester)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`asg-test-${Date.now()}`, testSession.id, courseToAssign.id, rahmanId, targetSem.year, targetSem.semester);
      
      // Re-fetch courses
      const refreshed = await makeRequest(`/api/academic/continuous-assessment/sessions/${testSession.id}/courses?semesterId=${targetSem.id}`, 'GET', null, adminToken);
      targetCourse = refreshed.data.courses.find(c => c.id === courseToAssign.id);
      assert(targetCourse !== undefined, 'Assigned unassigned course to Dr. Rahman via Routine system');
    }

    assert(targetCourse !== undefined, `Target course resolved: ${targetCourse?.course_code} - ${targetCourse?.course_title || targetCourse?.course_name}`);
    console.log(`     Assigned Teacher: ${targetCourse?.assigned_teacher_name} (${targetCourse?.assigned_teacher_id})`);

    const isAssignedRahman = Boolean(
      targetCourse.assigned_teacher_id === rahmanId ||
      targetCourse.teacher_user_id === rahmanLogin.data.user.id ||
      (targetCourse.assigned_teacher_name && targetCourse.assigned_teacher_name.includes('Rahman'))
    );
    const assignedToken = isAssignedRahman ? rahmanToken : fatimaToken;
    const unauthorizedToken = isAssignedRahman ? fatimaToken : rahmanToken;
    const assignedName = isAssignedRahman ? 'Dr. Rahman' : 'Dr. Sadia Fatima';
    const unauthorizedName = isAssignedRahman ? 'Dr. Sadia Fatima' : 'Dr. Rahman';

    // 6. Fetch Course Assessment Sheet & Enrolled Students
    console.log('\n--- 6. Course Assessment Sheet & Students Roster ---');
    const sheetRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks?semesterId=${targetSem.id}&sessionId=${testSession.id}`, 'GET', null, assignedToken);
    assert(sheetRes.status === 200, 'Fetched assessment sheet');
    assert(sheetRes.data.course !== undefined, 'Assessment sheet has course metadata');
    assert(sheetRes.data.semester !== undefined, 'Assessment sheet has semester metadata');
    assert(Array.isArray(sheetRes.data.students), 'Assessment sheet has enrolled students roster');
    console.log(`     Enrolled Students Count: ${sheetRes.data.students.length}`);
    
    // Check uniqueness of student IDs in roster
    const studentIds = sheetRes.data.students.map(s => s.id);
    const uniqueStudentIds = new Set(studentIds);
    assert(studentIds.length === uniqueStudentIds.size, 'Every enrolled student appears exactly once (no duplicates)');

    const s1 = sheetRes.data.students[0];
    const s2 = sheetRes.data.students[1] || sheetRes.data.students[0];

    // 7. Input Mark Validation (0-10 for CTs and Attendance, > 10 rejected, negative rejected)
    console.log('\n--- 7. Input Mark Validation & Guardrails ---');
    
    // 7a. Reject CT > 10
    const invalidCT = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id,
      marks: [{ studentId: s1.id, ctNumber: 1, marks: 15 }]
    }, assignedToken);
    assert(invalidCT.status === 400 && invalidCT.data.error.includes('between 0 and 10'), 'Rejected CT marks > 10 with 400 Bad Request');

    // 7b. Reject negative mark
    const negativeCT = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id,
      marks: [{ studentId: s1.id, ctNumber: 1, marks: -3 }]
    }, assignedToken);
    assert(negativeCT.status === 400 && negativeCT.data.error.includes('between 0 and 10'), 'Rejected negative marks with 400 Bad Request');

    // 7c. Reject Attendance > 10
    const invalidAtt = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id,
      marks: [{ studentId: s1.id, ctNumber: 4, marks: 12 }]
    }, assignedToken);
    assert(invalidAtt.status === 400 && invalidAtt.data.error.includes('between 0 and 10'), 'Rejected attendance > 10 with 400 Bad Request');

    // 8. Verify Best-Two-CT CA Calculations & Incomplete Handling
    console.log('\n--- 8. CA Calculation Formula & Incomplete Handling ---');
    // Test Case 1: Student 1 => CT1=8, CT2=6, CT3=9, Att=8 => Best 2 = 9 + 8 = 17, Att = 8 => CA = 25
    // Test Case 2: Student 2 => CT1=7, CT2=8, CT3=6, Att=9 => Best 2 = 8 + 7 = 15, Att = 9 => CA = 24
    const validMarksPayload = [
      { studentId: s1.id, ctNumber: 1, marks: 8 },
      { studentId: s1.id, ctNumber: 2, marks: 6 },
      { studentId: s1.id, ctNumber: 3, marks: 9 },
      { studentId: s1.id, ctNumber: 4, marks: 8 },
      { studentId: s1.id, ctNumber: 5, marks: 60 }, // Final theory
    ];

    if (s2.id !== s1.id) {
      validMarksPayload.push(
        { studentId: s2.id, ctNumber: 1, marks: 7 },
        { studentId: s2.id, ctNumber: 2, marks: 8 },
        { studentId: s2.id, ctNumber: 3, marks: 6 },
        { studentId: s2.id, ctNumber: 4, marks: 9 },
        { studentId: s2.id, ctNumber: 5, marks: 58 }
      );
    }

    const saveMarksRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id,
      marks: validMarksPayload
    }, assignedToken);
    assert(saveMarksRes.status === 200, 'Saved valid marks successfully');

    // Re-fetch sheet to verify server calculation
    const calcSheetRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks?semesterId=${targetSem.id}&sessionId=${testSession.id}`, 'GET', null, assignedToken);
    const evaluatedS1 = calcSheetRes.data.students.find(s => s.id === s1.id);
    assert(evaluatedS1.caMarks === 25, `Student 1 Best-2 CA: Expected 25, got ${evaluatedS1.caMarks}`);
    assert(evaluatedS1.attendance === 8, `Student 1 Attendance saved: Expected 8, got ${evaluatedS1.attendance}`);
    assert(evaluatedS1.caGrade !== null && evaluatedS1.caGrade !== '—', `Student 1 CA Grade computed: ${evaluatedS1.caGrade}`);
    assert(typeof evaluatedS1.caRank === 'number' && evaluatedS1.caRank >= 1, `Student 1 Rank computed: ${evaluatedS1.caRank}`);

    if (s2.id !== s1.id) {
      const evaluatedS2 = calcSheetRes.data.students.find(s => s.id === s2.id);
      assert(evaluatedS2.caMarks === 24, `Student 2 Best-2 CA: Expected 24, got ${evaluatedS2.caMarks}`);
      assert(typeof evaluatedS2.caRank === 'number' && evaluatedS1.caRank < evaluatedS2.caRank, `Student 1 rank (${evaluatedS1.caRank}) is ahead of Student 2 rank (${evaluatedS2.caRank}) because CA 25 > 24`);
    }

    // 9. Verify Teacher-Based RBAC Security
    console.log('\n--- 9. Teacher RBAC & Security Enforcement ---');
    // Ensure unauthorized teacher is BLOCKED from editing
    const unauthAttempt = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id,
      marks: [{ studentId: s1.id, ctNumber: 1, marks: 10 }]
    }, unauthorizedToken);
    assert(unauthAttempt.status === 403, `Unauthorized teacher (${unauthorizedName}) blocked with 403 Forbidden`);

    // 10. Lifecycle Workflow: Submit -> Finalize -> Publish -> Locking
    console.log('\n--- 10. Lifecycle Workflow & Locking ---');
    
    // 10a. Teacher submits marks
    const submitRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/submit`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id
    }, assignedToken);
    assert(submitRes.status === 200, `Assigned teacher (${assignedName}) submitted assessment marks for review`);

    // 10b. Admin finalizes
    const finalizeRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/finalize`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id
    }, adminToken);
    assert(finalizeRes.status === 200, 'Administrator finalized assessment marks');

    // 10c. Admin publishes results
    const publishRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/publish`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id
    }, adminToken);
    assert(publishRes.status === 200, 'Administrator published assessment results');

    // 10d. Test that teacher editing is now strictly BLOCKED because marks are published
    const lockedAttempt = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks`, 'POST', {
      semesterId: targetSem.id,
      sessionId: testSession.id,
      marks: [{ studentId: s1.id, ctNumber: 1, marks: 10 }]
    }, assignedToken);
    assert(lockedAttempt.status === 400 && lockedAttempt.data.error.includes('read-only'), 'Editing blocked on published assessment with read-only error');

    // 11. Historical Batch Read-Only Persistence
    console.log('\n--- 11. Historical Batch Read-Only Persistence ---');
    const publishedSheet = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/marks?semesterId=${targetSem.id}&sessionId=${testSession.id}`, 'GET', null, assignedToken);
    assert(publishedSheet.status === 200, 'Published historical sheet still accessible');
    assert(publishedSheet.data.isPublished === true, 'isPublished is true');
    assert(publishedSheet.data.canEdit === false, 'canEdit is false for teacher on published sheet');
    const histS1 = publishedSheet.data.students.find(s => s.id === s1.id);
    assert(histS1.caMarks === 25, 'Historical student marks fully preserved (CA = 25)');

    // 12. Administrative Reopening with Audit Log
    console.log('\n--- 12. Admin Controlled Reopening & Audit Trail ---');
    
    // 12a. Teacher cannot reopen
    const teacherReopen = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/reopen`, 'POST', {
      semesterId: targetSem.id,
      reason: 'Teacher trying to reopen'
    }, assignedToken);
    assert(teacherReopen.status === 403, 'Teacher cannot reopen assessment (requires admin/chairman)');

    // 12b. Admin reopen requires reason
    const noReasonReopen = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/reopen`, 'POST', {
      semesterId: targetSem.id,
      reason: ''
    }, adminToken);
    assert(noReasonReopen.status === 400 && noReasonReopen.data.error.includes('Reason is required'), 'Reopening without reason rejected with 400');

    // 12c. Admin reopen with valid reason
    const validReopen = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/reopen`, 'POST', {
      semesterId: targetSem.id,
      reason: 'Department head approved re-evaluation request for Section A'
    }, adminToken);
    assert(validReopen.status === 200, 'Admin reopened assessment successfully');

    // 12d. Verify audit log recorded the action
    const auditRes = await makeRequest(`/api/academic/continuous-assessment/courses/${targetCourse.id}/audit-logs?semesterId=${targetSem.id}`, 'GET', null, adminToken);
    assert(auditRes.status === 200, 'Fetched audit logs');
    assert(Array.isArray(auditRes.data.logs) && auditRes.data.logs.length > 0, 'Audit logs contains entries');
    const reopenLog = auditRes.data.logs.find(l => l.action === 'REOPENED');
    assert(reopenLog !== undefined, `Found REOPENED audit log: "${reopenLog?.reason}" by ${reopenLog?.performed_by_name}`);

    // Summary
    console.log('\n======================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

setTimeout(runAssessmentTests, 1000);
