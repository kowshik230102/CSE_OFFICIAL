/**
 * Continuous Assessment (CA) System Utilities
 * Policy:
 *  - 3 Class Tests (CT-1, CT-2, CT-3), each out of 10 max marks.
 *  - Attendance mark, out of 10 max marks.
 *  - Final CA = Best 2 of 3 CTs (max 20) + Attendance (max 10) = 30 marks total.
 *  - Grade is assigned based on standard university percentage scale of 30 marks.
 *  - Position / Rank is computed based on Total CA score across enrolled students.
 */

export const parseMark = (v) => {
  if (v === '' || v === null || v === undefined || isNaN(v)) return null;
  const num = parseFloat(v);
  return Math.min(10.0, Math.max(0.0, Math.round(num * 10) / 10));
};

export const computeStudentCA = (ct1, ct2, ct3, attendance) => {
  const c1 = parseMark(ct1);
  const c2 = parseMark(ct2);
  const c3 = parseMark(ct3);
  const att = parseMark(attendance);

  const availableCTs = [];
  if (c1 !== null) availableCTs.push({ num: 1, val: c1 });
  if (c2 !== null) availableCTs.push({ num: 2, val: c2 });
  if (c3 !== null) availableCTs.push({ num: 3, val: c3 });

  // Sort descending to find best 2
  availableCTs.sort((a, b) => b.val - a.val);

  const isAttendanceEntered = att !== null && att !== undefined && !isNaN(att);
  const isCAComplete = availableCTs.length >= 2 && isAttendanceEntered;

  let best2Sum = null;
  const countedCTs = new Set();
  if (availableCTs.length >= 2) {
    best2Sum = Math.round((availableCTs[0].val + availableCTs[1].val) * 10) / 10;
    countedCTs.add(availableCTs[0].num);
    countedCTs.add(availableCTs[1].num);
  }

  const attScore = isAttendanceEntered ? att : null;
  const hasAnyData = availableCTs.length > 0 || isAttendanceEntered;
  const totalCA = isCAComplete ? Math.round((best2Sum + attScore) * 10) / 10 : null;

  // Grade calculation (out of 30 marks)
  let grade = '—';
  let gradeClass = 'grade-none';
  let gpa = '0.00';

  if (isCAComplete && totalCA !== null) {
    if (totalCA >= 24.0) { grade = 'A+'; gradeClass = 'grade-aplus'; gpa = '4.00'; }
    else if (totalCA >= 22.5) { grade = 'A'; gradeClass = 'grade-a'; gpa = '3.75'; }
    else if (totalCA >= 21.0) { grade = 'A-'; gradeClass = 'grade-aminus'; gpa = '3.50'; }
    else if (totalCA >= 19.5) { grade = 'B+'; gradeClass = 'grade-bplus'; gpa = '3.25'; }
    else if (totalCA >= 18.0) { grade = 'B'; gradeClass = 'grade-b'; gpa = '3.00'; }
    else if (totalCA >= 16.5) { grade = 'B-'; gradeClass = 'grade-bminus'; gpa = '2.75'; }
    else if (totalCA >= 15.0) { grade = 'C+'; gradeClass = 'grade-cplus'; gpa = '2.50'; }
    else if (totalCA >= 13.5) { grade = 'C'; gradeClass = 'grade-c'; gpa = '2.25'; }
    else if (totalCA >= 12.0) { grade = 'D'; gradeClass = 'grade-d'; gpa = '2.00'; }
    else { grade = 'F'; gradeClass = 'grade-f'; gpa = '0.00'; }
  } else if (hasAnyData) {
    grade = 'Incomplete';
    gradeClass = 'grade-incomplete';
  }

  return {
    c1,
    c2,
    c3,
    att,
    best2Sum,
    attScore,
    totalCA,
    grade,
    gradeClass,
    gpa,
    countedCTs,
    hasAnyData,
    isCAComplete,
    isIncomplete: !isCAComplete && hasAnyData
  };
};

export const computeClassRanks = (studentsWithCA) => {
  // studentsWithCA: array of { studentId, totalCA, isCAComplete }
  const valid = studentsWithCA.filter((s) => s.totalCA !== null && (s.isCAComplete !== false));
  valid.sort((a, b) => b.totalCA - a.totalCA);

  const rankMap = {};
  let currentRank = 1;
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i].totalCA < valid[i - 1].totalCA) {
      currentRank = i + 1;
    }
    rankMap[valid[i].studentId] = currentRank;
  }
  return rankMap;
};

export const formatOrdinal = (n) => {
  if (!n) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
