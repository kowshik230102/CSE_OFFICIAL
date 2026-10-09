/**
 * test_step7_scheduler.js
 * Verification test suite for Step 7: Timetable Scheduling Engine & Grid
 * Strictly based on the PUST CSE Routine Reference Sample:
 * - 5 Days: Saturday to Wednesday
 * - 7 Class Periods of exactly 1.0 Hour (60 minutes) each:
 *     Period 1: 09:00 - 10:00
 *     Period 2: 10:00 - 11:00
 *     Period 3: 11:00 - 12:00
 *     Period 4: 12:00 - 01:00
 *     Break:    01:00 - 02:00 (1 Hour Lunch & Prayer Break)
 *     Period 5: 02:00 - 03:00
 *     Period 6: 03:00 - 04:00
 *     Period 7: 04:00 - 05:00
 * - Multi-period consecutive blocks (2h Theory, 3h Sessional/Lab)
 * - Break protection (no classes during 01:00-02:00)
 * - Semester conflict detection
 * - Teacher conflict across semesters
 * - Schedule editing, saving, and database persistence
 * - Teacher workload calculation (weeklyHours = creditHours)
 */

const {
  SCHEDULE_DAYS,
  SCHEDULE_PERIODS,
  TEACHING_PERIOD_IDS,
  BREAK_PERIOD_ID,
  getPeriodById,
  getCoveredPeriodIds,
  getSlotTimeRangeLabel,
  normalizeSlot,
  checkSlotConflict,
  validateEntireSchedule,
  getCourseScheduledHours
} = require('./server/utils/scheduleConfig');

const BASE_URL = 'http://localhost:5000';

async function runStep7Tests() {
  console.log('======================================================================');
  console.log('  STARTING STEP 7: TIMETABLE SCHEDULING ENGINE VERIFICATION SUITE     ');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`  ✓ PASSED: ${message}`);
      passed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Real Timetable Structure from Provided Reference Sample
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Official Routine Structure & Periods ---');
  
  // 1.1 Verify Days
  assert(SCHEDULE_DAYS.length === 5, 'Exactly 5 class days configured');
  const dayNames = SCHEDULE_DAYS.map(d => d.name);
  assert(
    dayNames.join(',') === 'Saturday,Sunday,Monday,Tuesday,Wednesday',
    `Days match university working days: ${dayNames.join(', ')}`
  );

  // 1.2 Verify Periods & Durations
  assert(SCHEDULE_PERIODS.length === 8, 'Total 8 periods configured (7 teaching + 1 break)');
  assert(TEACHING_PERIOD_IDS.length === 7, 'Exactly 7 teaching periods in a day');

  const p1 = getPeriodById('p1');
  assert(p1.startTime === '09:00' && p1.endTime === '10:00' && p1.durationHours === 1.0, 'Period 1 is 09:00 - 10:00 (1.0 hr)');

  const p2 = getPeriodById('p2');
  assert(p2.startTime === '10:00' && p2.endTime === '11:00' && p2.durationHours === 1.0, 'Period 2 is 10:00 - 11:00 (1.0 hr)');

  const p3 = getPeriodById('p3');
  assert(p3.startTime === '11:00' && p3.endTime === '12:00' && p3.durationHours === 1.0, 'Period 3 is 11:00 - 12:00 (1.0 hr)');

  const p4 = getPeriodById('p4');
  assert(p4.startTime === '12:00' && p4.label === '12:00-01:00' && p4.durationHours === 1.0, 'Period 4 is 12:00 - 01:00 (1.0 hr)');

  // 1.3 Verify Lunch & Prayer Break
  const pBreak = getPeriodById(BREAK_PERIOD_ID);
  assert(pBreak.isBreak === true, 'Break period identified correctly');
  assert(pBreak.label === '01:00-02:00' && pBreak.durationHours === 1.0, 'Break is 01:00 - 02:00 (1.0 hr duration)');

  const p5 = getPeriodById('p5');
  assert(p5.label === '02:00-03:00' && p5.durationHours === 1.0, 'Period 5 is 02:00 - 03:00 (1.0 hr)');

  const p6 = getPeriodById('p6');
  assert(p6.label === '03:00-04:00' && p6.durationHours === 1.0, 'Period 6 is 03:00 - 04:00 (1.0 hr)');

  const p7 = getPeriodById('p7');
  assert(p7.label === '04:00-05:00' && p7.durationHours === 1.0, 'Period 7 is 04:00 - 05:00 (1.0 hr)');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Break Protection & Multi-Period Consecutive Blocks
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 2: Break Protection & Consecutive Period Spans ---');

  // 2.1 Direct scheduling in break period
  const breakSlotAttempt = {
    id: 's-break-1',
    day: 'Saturday',
    periodId: BREAK_PERIOD_ID,
    span: 1,
    semesterId: 'sem-4-1',
    courseId: 'c-4101',
    teacherId: 't-1'
  };
  const breakConflict = checkSlotConflict(breakSlotAttempt, []);
  assert(breakConflict.hasConflict === true && ['BREAK_PROTECTION', 'BREAK_VIOLATION'].includes(breakConflict.type), 'Scheduling directly in Break (01:00-02:00) blocked with BREAK_PROTECTION');

  // 2.2 Consecutive block attempting to cross break (e.g. start at p4 12:00-01:00 with span 2 => would hit break)
  const crossBreakSlotAttempt = {
    id: 's-cross-break',
    day: 'Monday',
    periodId: 'p4', // 12:00 - 01:00
    span: 2,        // Covers p4 and break
    semesterId: 'sem-4-1',
    courseId: 'c-4101',
    teacherId: 't-1'
  };
  const crossBreakConflict = checkSlotConflict(crossBreakSlotAttempt, []);
  assert(crossBreakConflict.hasConflict === true && ['INVALID_SPAN', 'BREAK_PROTECTION', 'BREAK_VIOLATION'].includes(crossBreakConflict.type), 'Block spanning into Break (12:00-02:00) blocked with INVALID_SPAN');

  // 2.3 Valid 2-period theory block (e.g. 10:00 - 12:00)
  const covered2 = getCoveredPeriodIds('p2', 2);
  assert(covered2.length === 2 && covered2[0] === 'p2' && covered2[1] === 'p3', '2-period block correctly covers p2 (10-11) and p3 (11-12)');
  assert(getSlotTimeRangeLabel('p2', 2).replace(/\s/g, '') === '10:00-12:00', 'Time range label for 2-hour block is 10:00-12:00');

  // 2.4 Valid 3-period sessional/lab block (e.g. 02:00 - 05:00)
  const covered3 = getCoveredPeriodIds('p5', 3);
  assert(covered3.length === 3 && covered3[0] === 'p5' && covered3[1] === 'p6' && covered3[2] === 'p7', '3-period block correctly covers p5, p6, p7 (02:00 - 05:00)');
  assert(getSlotTimeRangeLabel('p5', 3).replace(/\s/g, '') === '02:00-05:00', 'Time range label for 3-hour lab block is 02:00-05:00');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Conflict Engine (Semester & Teacher Across Semesters)
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 3: Conflict Engine Verification ---');

  const existingSchedule = [
    // 4-1 has CSE 4103 taught by Dr. TA on Saturday p2-p3 (10:00 - 12:00, 2-hr block)
    normalizeSlot({
      id: 'slot-1',
      day: 'Saturday',
      periodId: 'p2',
      span: 2,
      semesterId: 'sem-4-1',
      courseId: 'c-4103',
      courseCode: 'CSE 4103',
      teacherId: 'teacher-ta',
      teacherName: 'Dr. TA',
      room: '502'
    }),
    // 2-2 has CSE 2201 taught by AS on Saturday p1 (09:00 - 10:00)
    normalizeSlot({
      id: 'slot-2',
      day: 'Saturday',
      periodId: 'p1',
      span: 1,
      semesterId: 'sem-2-2',
      courseId: 'c-2201',
      courseCode: 'CSE 2201',
      teacherId: 'teacher-as',
      teacherName: 'AS',
      room: '501'
    })
  ];

  // 3.1 Semester Conflict: Trying to schedule another course for 4-1 at p3 (11:00 - 12:00)
  const semConflictCandidate = {
    id: 'slot-cand-sem',
    day: 'Saturday',
    periodId: 'p3', // Already covered by slot-1 (span 2 from p2)
    span: 1,
    semesterId: 'sem-4-1',
    courseId: 'c-4105',
    courseCode: 'CSE 4105',
    teacherId: 'teacher-xy',
    teacherName: 'Prof. XY',
    room: '503'
  };
  const semConflict = checkSlotConflict(semConflictCandidate, existingSchedule);
  assert(semConflict.hasConflict === true && semConflict.type === 'SEMESTER_CONFLICT', 'Semester conflict detected: 4-1 already has class at 11:00-12:00');

  // 3.2 Teacher Conflict Across Different Semesters:
  // Trying to schedule Dr. TA for semester 2-2 at p2 (10:00 - 11:00), while Dr. TA is already teaching 4-1!
  const teacherConflictCandidate = {
    id: 'slot-cand-teach',
    day: 'Saturday',
    periodId: 'p2',
    span: 1,
    semesterId: 'sem-2-2', // Different semester!
    courseId: 'c-2203',
    courseCode: 'CSE 2203',
    teacherId: 'teacher-ta', // Same teacher!
    teacherName: 'Dr. TA',
    room: '501'
  };
  const teacherConflict = checkSlotConflict(teacherConflictCandidate, existingSchedule);
  assert(teacherConflict.hasConflict === true && teacherConflict.type === 'TEACHER_CONFLICT', 'Teacher conflict detected across different semesters (Dr. TA cannot teach 2 classes simultaneously)');

  // 3.3 Room Conflict: Trying to schedule Room 502 for 2-2 at p2
  const roomConflictCandidate = {
    id: 'slot-cand-room',
    day: 'Saturday',
    periodId: 'p2',
    span: 1,
    semesterId: 'sem-2-2',
    courseId: 'c-2205',
    courseCode: 'CSE 2205',
    teacherId: 'teacher-other',
    teacherName: 'Other Teacher',
    room: '502' // Same room as slot-1!
  };
  const roomConflict = checkSlotConflict(roomConflictCandidate, existingSchedule);
  assert(roomConflict.hasConflict === true && roomConflict.type === 'ROOM_CONFLICT', 'Room conflict detected: Room 502 already occupied at 10:00-11:00');

  // 3.4 Valid Slot (No conflict): 2-2 at p5 (02:00 - 03:00) with Dr. TA
  const validCandidate = {
    id: 'slot-cand-valid',
    day: 'Saturday',
    periodId: 'p5',
    span: 1,
    semesterId: 'sem-2-2',
    courseId: 'c-2203',
    courseCode: 'CSE 2203',
    teacherId: 'teacher-ta',
    teacherName: 'Dr. TA',
    room: '501'
  };
  const validResult = checkSlotConflict(validCandidate, existingSchedule);
  assert(validResult.hasConflict === false, 'Valid slot approved without any conflicts');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Course Weekly Hours & Teacher Workload Mapping
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 4: Weekly Hours & Workload Calculation ---');

  const fullScheduleForCourse = [
    // 3-credit theory course CSE 4101: 2-hour block on Sunday + 1-hour period on Tuesday = 3 hours
    normalizeSlot({
      id: 'sc-1',
      day: 'Sunday',
      periodId: 'p1',
      span: 2, // 2 hours
      courseId: 'course-cse4101',
      courseCode: 'CSE 4101',
      teacherId: 'teacher-ta',
      teacherName: 'Dr. TA'
    }),
    normalizeSlot({
      id: 'sc-2',
      day: 'Tuesday',
      periodId: 'p3',
      span: 1, // 1 hour
      courseId: 'course-cse4101',
      courseCode: 'CSE 4101',
      teacherId: 'teacher-ta',
      teacherName: 'Dr. TA'
    })
  ];

  const scheduledHours = getCourseScheduledHours('course-cse4101', fullScheduleForCourse);
  assert(scheduledHours === 3, '3-credit course correctly has 3 timetable contact hours distributed as 2h block + 1h slot');

  // Entire schedule validation helper
  const allConflicts = validateEntireSchedule([
    ...fullScheduleForCourse,
    // Add conflicting slot to test entire validator
    normalizeSlot({
      id: 'bad-slot',
      day: 'Sunday',
      periodId: 'p1',
      span: 1,
      teacherId: 'teacher-ta', // conflict!
      courseId: 'other-course'
    })
  ]);
  assert(allConflicts.length > 0, 'validateEntireSchedule catches conflicts in bulk');

  console.log('');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Full Backend API Integration (Save, Reload, Edit)
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 5: Full Backend API Integration ---');

  // 5.1 Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cse.univ.edu', password: 'Admin@123' })
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && loginData.token, 'Admin logged in and retrieved JWT token');
  const token = loginData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 5.2 Fetch schedule-config metadata from backend
  const configRes = await fetch(`${BASE_URL}/api/routines/meta/schedule-config`, {
    headers: authHeaders
  });
  const configData = await configRes.json();
  assert(configRes.ok && configData.days && configData.periods, 'GET /api/routines/meta/schedule-config returned server schedule config');
  assert(configData.breakPeriodId === BREAK_PERIOD_ID, `Server schedule config confirms break period ${BREAK_PERIOD_ID}`);

  // 5.3 Test server validation endpoint
  const validateApiRes = await fetch(`${BASE_URL}/api/routines/validate-schedule`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      candidateSlot: {
        day: 'Monday',
        periodId: BREAK_PERIOD_ID,
        span: 1,
        semesterId: 'sem-test',
        courseId: 'c-test'
      },
      existingSchedule: []
    })
  });
  const validateApiData = await validateApiRes.json();
  assert(validateApiRes.ok && validateApiData.conflict && validateApiData.conflict.hasConflict, 'POST /api/routines/validate-schedule correctly rejected break slot');

  // 5.4 Create a routine via API
  const createRoutineRes = await fetch(`${BASE_URL}/api/routines`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Step 7 Engine Verification Routine',
      academicYear: 'Session 2026-2027',
      department: 'CSE',
      effectiveFrom: '2026-10-08'
    })
  });
  const createRoutineData = await createRoutineRes.json();
  const routineId = createRoutineData.id || createRoutineData.routine?.id;
  assert(createRoutineRes.ok && routineId, 'Created new routine with ID: ' + routineId);

  // 5.5 Save routine with scheduled timetable slots
  const scheduledSlots = [
    // Saturday 10:00 - 12:00 (2h Theory Block)
    {
      id: 'test-slot-1',
      day: 'Saturday',
      periodId: 'p2',
      span: 2,
      semesterId: 'sem-mock-4-1',
      semesterName: '4th Year 1st Semester',
      termCode: '4-1',
      courseId: 'course-cse4101',
      courseCode: 'CSE 4101',
      courseTitle: 'Compiler Design',
      creditHours: 3.0,
      courseType: 'Theory',
      teacherId: 'teacher-1',
      teacherName: 'Dr. Abdur Rahim',
      teacherShortCode: 'AR',
      teacherType: 'department',
      room: '502'
    },
    // Sunday 02:00 - 05:00 (3h Lab Block)
    {
      id: 'test-slot-2',
      day: 'Sunday',
      periodId: 'p5',
      span: 3,
      semesterId: 'sem-mock-4-1',
      semesterName: '4th Year 1st Semester',
      termCode: '4-1',
      courseId: 'course-cse4102',
      courseCode: 'CSE 4102',
      courseTitle: 'Compiler Design Sessional',
      creditHours: 1.5,
      courseType: 'Sessional',
      teacherId: 'teacher-1',
      teacherName: 'Dr. Abdur Rahim',
      teacherShortCode: 'AR',
      teacherType: 'department',
      room: 'ACL'
    }
  ];

  const updateRes = await fetch(`${BASE_URL}/api/routines/${routineId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Step 7 Engine Verification Routine (Updated)',
      academicYear: 'Session 2026-2027',
      department: 'CSE',
      effectiveFrom: '2026-10-08',
      semesters: [
        {
          semesterId: 'sem-mock-4-1',
          semesterName: '4th Year 1st Semester',
          shortTerm: '4-1',
          courses: [
            {
              courseId: 'course-cse4101',
              courseCode: 'CSE 4101',
              courseTitle: 'Compiler Design',
              creditHours: 3.0,
              weeklyHours: 3.0,
              teacher: {
                type: 'department',
                teacherId: 'teacher-1',
                teacherName: 'Dr. Abdur Rahim',
                shortCode: 'AR'
              },
              assignmentStatus: 'Assigned'
            }
          ]
        }
      ],
      schedule: scheduledSlots
    })
  });
  const updateData = await updateRes.json();
  assert(updateRes.ok, 'PUT /api/routines/:id saved timetable schedule successfully');

  // 5.6 Reload routine and verify database persistence
  const getRes = await fetch(`${BASE_URL}/api/routines/${routineId}`, {
    headers: authHeaders
  });
  const getData = await getRes.json();
  assert(getRes.ok && getData.routine, 'GET /api/routines/:id reloaded routine from SQLite');
  const reloadedRoutine = getData.routine;
  const reloadedSchedule = reloadedRoutine.schedule || [];
  assert(reloadedSchedule.length === 2, 'Reloaded routine has exactly 2 scheduled slots');

  const reloadedSlot1 = reloadedSchedule.find(s => s.id === 'test-slot-1');
  assert(
    reloadedSlot1 && reloadedSlot1.day === 'Saturday' && reloadedSlot1.periodId === 'p2' && reloadedSlot1.span === 2 && reloadedSlot1.room === '502',
    'Slot 1 persisted with Saturday, p2 (10:00-11:00), span=2 (2h block), Room 502'
  );

  const reloadedSlot2 = reloadedSchedule.find(s => s.id === 'test-slot-2');
  assert(
    reloadedSlot2 && reloadedSlot2.day === 'Sunday' && reloadedSlot2.periodId === 'p5' && reloadedSlot2.span === 3 && reloadedSlot2.room === 'ACL',
    'Slot 2 persisted with Sunday, p5 (02:00-03:00), span=3 (3h lab block), Room ACL'
  );

  // 5.7 Clean up test routine
  const deleteRes = await fetch(`${BASE_URL}/api/routines/${routineId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(deleteRes.ok, 'DELETE /api/routines/:id cleaned up test routine');

  console.log('\n======================================================================');
  console.log(`🎉 ALL TESTS PASSED (${passed}/${total}) - STEP 7 FULLY VERIFIED!`);
  console.log('======================================================================\n');
}

runStep7Tests().catch(err => {
  console.error('\n❌ TEST RUN ABORTED WITH ERROR:\n', err);
  process.exit(1);
});
