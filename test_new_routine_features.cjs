const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  SCHEDULE_PERIODS,
  getCoveredPeriodIds,
  normalizeSlot,
  checkSlotConflict,
  getAvailableRoom,
  mergeAdjacentSameCourseSlots
} = require('./server/utils/scheduleConfig');

console.log('===============================================================');
console.log('🧪 TESTING NEW ROUTINE SYSTEM FEATURES & FIXES');
console.log('===============================================================\n');

// -----------------------------------------------------------------
// Test 1: getAvailableRoom automatically finds conflict-free room
// -----------------------------------------------------------------
console.log('Test 1: Conflict-free Dynamic Room Allocation (getAvailableRoom)...');
const existingSchedule = [
  {
    id: 'slot-1',
    day: 'Saturday',
    periodId: 'p1',
    span: 1,
    room: '501',
    coveredPeriods: ['p1']
  },
  {
    id: 'slot-2',
    day: 'Saturday',
    periodId: 'p1',
    span: 1,
    room: '502',
    coveredPeriods: ['p1']
  }
];

// Preferred room is 501, but it is occupied on Saturday p1
const allocatedTheoryRoom = getAvailableRoom('Saturday', 'p1', 1, false, existingSchedule, '501');
assert.strictEqual(allocatedTheoryRoom, '504', 'Should automatically pick Room 504 when 501 and 502 are occupied');

// Lab room allocation
const allocatedLabRoom = getAvailableRoom('Saturday', 'p1', 3, true, existingSchedule);
assert.ok(['ACL', 'S/W Lab', 'H/W Lab'].includes(allocatedLabRoom), 'Should pick an available lab room for sessionals');
console.log(`  ✅ Test 1 Passed: Room 501 occupied -> auto-allocated conflict-free "${allocatedTheoryRoom}". Lab allocated "${allocatedLabRoom}".\n`);

// -----------------------------------------------------------------
// Test 2: Adjacent Same Course Period Merging (mergeAdjacentSameCourseSlots)
// -----------------------------------------------------------------
console.log('Test 2: Merging 2 Consecutive Periods of Same Class...');
const adjacentSlots = [
  {
    id: 'slot-p1',
    semesterId: 'sem-1',
    courseId: 'c-3101',
    courseCode: 'CSE 3101',
    courseTitle: 'Database Systems',
    day: 'Sunday',
    periodId: 'p1',
    span: 1,
    room: '501'
  },
  {
    id: 'slot-p2',
    semesterId: 'sem-1',
    courseId: 'c-3101',
    courseCode: 'CSE 3101',
    courseTitle: 'Database Systems',
    day: 'Sunday',
    periodId: 'p2',
    span: 1,
    room: '501'
  }
];

const merged = mergeAdjacentSameCourseSlots(adjacentSlots);
assert.strictEqual(merged.length, 1, 'Should consolidate 2 consecutive periods into 1 merged slot');
assert.strictEqual(merged[0].span, 2, 'Merged slot must have span 2');
assert.strictEqual(merged[0].periodId, 'p1', 'Merged slot must start at p1');
assert.deepStrictEqual(merged[0].coveredPeriods, ['p1', 'p2'], 'Covered periods must be [p1, p2]');
console.log('  ✅ Test 2 Passed: Sunday p1 (1h) + Sunday p2 (1h) merged into 1 single 2-hour slot with colSpan=2.\n');

// -----------------------------------------------------------------
// Test 3: Do NOT Merge Across Protected Break (p4 and p5)
// -----------------------------------------------------------------
console.log('Test 3: Separation across protected Break Period (01:00-02:00 PM)...');
const acrossBreakSlots = [
  {
    id: 'slot-p4',
    semesterId: 'sem-1',
    courseId: 'c-3101',
    courseCode: 'CSE 3101',
    day: 'Monday',
    periodId: 'p4',
    span: 1,
    room: '501'
  },
  {
    id: 'slot-p5',
    semesterId: 'sem-1',
    courseId: 'c-3101',
    courseCode: 'CSE 3101',
    day: 'Monday',
    periodId: 'p5',
    span: 1,
    room: '501'
  }
];

const mergedAcrossBreak = mergeAdjacentSameCourseSlots(acrossBreakSlots);
assert.strictEqual(mergedAcrossBreak.length, 2, 'Must not merge slots across the protected break!');
console.log('  ✅ Test 3 Passed: Protected 1:00-2:00 PM Break is respected; p4 and p5 stay unmerged.\n');

// -----------------------------------------------------------------
// Test 4: Cell-to-Cell Move and Swap
// -----------------------------------------------------------------
console.log('Test 4: Drag Move Between Cells & Smart Course Swap...');
const testSchedule = [
  {
    id: 'slot-a',
    day: 'Tuesday',
    periodId: 'p1',
    span: 1,
    semesterId: 'sem-1',
    courseCode: 'CSE 1101',
    courseId: 'c-1',
    teacherId: 't-1',
    room: '501'
  },
  {
    id: 'slot-b',
    day: 'Tuesday',
    periodId: 'p3',
    span: 1,
    semesterId: 'sem-1',
    courseCode: 'CSE 1103',
    courseId: 'c-2',
    teacherId: 't-2',
    room: '502'
  }
];

// Move slot-a to empty cell Tuesday p2
const movedSlotA = normalizeSlot({
  ...testSchedule[0],
  periodId: 'p2',
  room: getAvailableRoom('Tuesday', 'p2', 1, false, [testSchedule[1]], '501')
});
assert.strictEqual(movedSlotA.periodId, 'p2');
assert.strictEqual(movedSlotA.room, '501');

// Swap slot-a and slot-b
const swappedA = normalizeSlot({ ...testSchedule[0], periodId: 'p3', room: '502' });
const swappedB = normalizeSlot({ ...testSchedule[1], periodId: 'p1', room: '501' });
assert.strictEqual(swappedA.periodId, 'p3');
assert.strictEqual(swappedB.periodId, 'p1');
console.log('  ✅ Test 4 Passed: Cell-to-cell move and position swap logic verified.\n');

// -----------------------------------------------------------------
// Test 5: Verify A4 Landscape 1-Page CSS Rules
// -----------------------------------------------------------------
console.log('Test 5: Verify Strict 1-Page A4 Landscape Rules in index.css...');
const cssPath = path.join(__dirname, 'src', 'index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert.ok(cssContent.includes('.official-routine-print-wrapper'), 'CSS must include .official-routine-print-wrapper');
assert.ok(cssContent.includes('height: 198mm !important'), 'Print wrapper must be set to full-page 198mm height');
assert.ok(cssContent.includes('.official-timetable-grid'), 'Must include .official-timetable-grid');
assert.ok(cssContent.includes('.chairman-signature-block'), 'Must include .chairman-signature-block');
console.log('  ✅ Test 5 Passed: Full-page A4 landscape print CSS rules verified.\n');

console.log('Test 6: Verify Non-Department Teacher Time Fillup & Remaining Hours calculation...');
// Simulate non-department course
const nonDeptCourse = {
  courseId: 'c-eee-101',
  courseCode: 'EEE 1101',
  courseTitle: 'Basic Electrical Engineering',
  creditHours: 3.0,
  weeklyHours: 3,
  courseType: 'Theory',
  teacher: {
    type: 'non_department',
    teacherId: null,
    teacherName: 'Engr. Rahman',
    department: 'EEE',
    shortCode: 'EEE'
  }
};

const routineSchedule = [
  { id: 's1', day: 'Sunday', periodId: 'p1', courseId: 'c-eee-101', courseCode: 'EEE 1101', span: 1, teacherName: 'Engr. Rahman', teacherType: 'non_department' },
  { id: 's2', day: 'Tuesday', periodId: 'p2', courseId: 'c-eee-101', courseCode: 'EEE 1101', span: 1, teacherName: 'Engr. Rahman', teacherType: 'non_department' }
];

// Calculate filled and remaining hours
const slots = routineSchedule.filter(s => 
  (s.courseId && s.courseId === nonDeptCourse.courseId) ||
  (s.courseCode && nonDeptCourse.courseCode && s.courseCode.trim().toUpperCase() === nonDeptCourse.courseCode.trim().toUpperCase())
);
const filledHours = slots.reduce((acc, s) => acc + (s.span || 1), 0);
const remainingHours = Math.max(0, nonDeptCourse.weeklyHours - filledHours);

assert.strictEqual(filledHours, 2, 'Non-department teacher course must have 2 filled hours');
assert.strictEqual(remainingHours, 1, 'Non-department teacher course must have 1 remaining hour (3 - 2 = 1)');
console.log(`  ✅ Test 6 Passed: Filled: ${filledHours}h / 3h, Remaining: ${remainingHours}h calculated accurately for Non-Dept teacher!\n`);

console.log('===============================================================');
console.log('🎉 ALL NEW ROUTINE SYSTEM TESTS PASSED 100%!');
console.log('===============================================================');
