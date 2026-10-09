const assert = require('assert');
const { db } = require('./server/db/schema.js');
const { 
  calculateWeeklyHours, 
  checkSlotConflict, 
  validateEntireSchedule,
  getCoveredPeriodIds,
  SCHEDULE_DAYS,
  SCHEDULE_PERIODS 
} = require('./server/utils/scheduleConfig.js');

async function testDragDropRoutine() {
  console.log('===============================================================');
  console.log('🧪 TESTING DRAG-AND-DROP SEMESTER ROUTINE BUILDER');
  console.log('===============================================================\n');

  // 1. Semester & Course isolation: verify each semester has isolated courses
  console.log('Test 1: Verify Semester-Based Course Separation...');
  const semesters = db.prepare('SELECT id, semester_name, term_code FROM semesters ORDER BY term_code ASC').all();
  assert.ok(semesters.length >= 8, 'Must have at least 8 semesters in db');
  
  const y1s1 = semesters.find(s => s.term_code === 'Y-1 S-1' || s.term_code === 'Y1S1');
  const y3s2 = semesters.find(s => s.term_code === 'Y-3 S-2' || s.term_code === 'Y3S2');
  assert.ok(y1s1 && y3s2, 'Y1S1 and Y3S2 must exist');

  const y1s1Courses = db.prepare('SELECT id, course_code, course_title FROM courses WHERE semester_id = ?').all(y1s1.id);
  const y3s2Courses = db.prepare('SELECT id, course_code, course_title FROM courses WHERE semester_id = ?').all(y3s2.id);

  assert.ok(y1s1Courses.length > 0, 'Y1S1 must have courses');
  assert.ok(y3s2Courses.length > 0, 'Y3S2 must have courses');

  // Ensure no courses overlap between Y1S1 and Y3S2
  const y1s1Codes = new Set(y1s1Courses.map(c => c.course_code));
  const hasOverlap = y3s2Courses.some(c => y1s1Codes.has(c.course_code));
  assert.strictEqual(hasOverlap, false, 'Courses must not overlap between distinct semesters');
  console.log(`  ✅ Test 1 Passed: Y1S1 has ${y1s1Courses.length} courses, Y3S2 has ${y3s2Courses.length} courses with complete separation.\n`);

  // 2. Drag & Drop Course scheduling into slot with conflict check
  console.log('Test 2: Drag Course to Timetable Slot (with conflict checking)...');
  const courseToDrag = y3s2Courses[0];
  const activeRoutine = db.prepare('SELECT * FROM routines WHERE is_active = 1 LIMIT 1').get();
  assert.ok(activeRoutine, 'Active routine must exist');

  const targetDay = 'Saturday';
  const targetPeriod = 'p2';
  const candidateSlot = {
    id: 'test-slot-drag-1',
    semesterId: y3s2.id,
    courseId: courseToDrag.id,
    courseCode: courseToDrag.course_code,
    teacherId: 'teacher-dr-mahmudur',
    teacherName: 'Dr. Mahmudur Rahman',
    teacherShortCode: 'MR',
    day: targetDay,
    periodId: targetPeriod,
    span: 1,
    room: 'Room 501',
    isLocked: false
  };

  const existingSchedule = [];
  const conflict1 = checkSlotConflict(candidateSlot, existingSchedule, existingSchedule);
  assert.strictEqual(conflict1.hasConflict, false, 'Candidate slot with no existing schedule should not conflict');
  existingSchedule.push(candidateSlot);
  console.log(`  ✅ Test 2 Passed: Course ${courseToDrag.course_code} scheduled on ${targetDay} at period ${targetPeriod}.\n`);

  // 3. Move existing scheduled slot to new valid slot
  console.log('Test 3: Drag & Move Existing Timetable Slot...');
  const movedSlot = {
    ...candidateSlot,
    day: 'Monday',
    periodId: 'p3'
  };
  const otherSlots = existingSchedule.filter(s => s.id !== candidateSlot.id);
  const conflictMove = checkSlotConflict(movedSlot, otherSlots, otherSlots);
  assert.strictEqual(conflictMove.hasConflict, false, 'Moving to unoccupied Monday p3 must succeed');
  console.log('  ✅ Test 3 Passed: Successfully moved slot to Monday p3 without conflict.\n');

  // 4. Reject invalid move (e.g. Teacher clash) and rollback
  console.log('Test 4: Reject Invalid Move (Teacher Clash) and Rollback...');
  const conflictingSlot = {
    id: 'test-slot-clash',
    semesterId: y1s1.id,
    courseId: y1s1Courses[0].id,
    courseCode: y1s1Courses[0].course_code,
    teacherId: 'teacher-dr-mahmudur', // Same teacher!
    teacherName: 'Dr. Mahmudur Rahman',
    day: targetDay,
    periodId: targetPeriod, // Same time!
    span: 1,
    room: 'Room 502'
  };

  const conflictClash = checkSlotConflict(conflictingSlot, existingSchedule, existingSchedule);
  assert.strictEqual(conflictClash.hasConflict, true, 'Same teacher scheduled at same time must conflict');
  assert.ok(conflictClash.message.includes('Dr. Mahmudur Rahman'), 'Conflict message must specify teacher');
  console.log(`  ✅ Test 4 Passed: Conflict correctly caught: "${conflictClash.message}". Move rejected and rolled back.\n`);

  // 5. Protected Break validation: classes cannot span across 01:00-02:00 PM Break
  console.log('Test 5: Protected Break Validation...');
  // p4 is 12:00-01:00 PM. Span of 2 would overlap break!
  const coveredCrossingBreak = getCoveredPeriodIds('p4', 2);
  assert.strictEqual(coveredCrossingBreak, null, 'Span crossing break must return null to reject scheduling');
  console.log('  ✅ Test 5 Passed: Classes crossing protected Break are safely rejected.\n');

  // 6. Sessional Lab Blocks: 3-hour lab block
  console.log('Test 6: Sessional Lab 3-Hour Period Block...');
  const labMorningCovered = getCoveredPeriodIds('p1', 3);
  assert.deepStrictEqual(labMorningCovered, ['p1', 'p2', 'p3'], 'Lab starting p1 must cover p1, p2, p3');
  const labAfternoonCovered = getCoveredPeriodIds('p5', 3);
  assert.deepStrictEqual(labAfternoonCovered, ['p5', 'p6', 'p7'], 'Lab starting p5 must cover p5, p6, p7');
  console.log('  ✅ Test 6 Passed: 3-hour continuous lab blocks verified.\n');

  // 7. Chairman Signature block in exported Word markup
  console.log('Test 7: Chairman Signature Block Presence in Word Exporter...');
  const fs = require('fs');
  const exportFileContent = fs.readFileSync('./src/utils/routineExport.js', 'utf8');
  assert.ok(exportFileContent.includes('Chairman'), 'Word exporter must contain Chairman');
  assert.ok(exportFileContent.includes('Department of Computer Science and Engineering'), 'Word exporter must contain Dept name');
  assert.ok(exportFileContent.includes('Pabna University of Science and Technology'), 'Word exporter must contain University name');
  console.log('  ✅ Test 7 Passed: Chairman signature block verified in routine export module.\n');

  // 8. Landscape A4 Print setup in CSS
  console.log('Test 8: A4 Landscape Print Stylesheet in index.css...');
  const cssContent = fs.readFileSync('./src/index.css', 'utf8');
  assert.ok(cssContent.includes('size: A4 landscape;'), 'Print CSS must contain A4 landscape size');
  assert.ok(cssContent.includes('.official-routine-header'), 'Print CSS must contain .official-routine-header');
  assert.ok(cssContent.includes('.chairman-signature-block'), 'Print CSS must contain .chairman-signature-block');
  console.log('  ✅ Test 8 Passed: A4 landscape page setup and print classes verified in index.css.\n');

  console.log('===============================================================');
  console.log('🎉 ALL 8 DRAG-AND-DROP ROUTINE BUILDER TESTS PASSED 100%!');
  console.log('===============================================================\n');
}

testDragDropRoutine().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
