/**
 * Official PUST CSE Class Routine Schedule Configuration & Engine
 * Source of Truth: PUST Department of Computer Science & Engineering Official Class Routine
 * Reference: Effective from 15.07.2026
 */

export const SCHEDULE_DAYS = [
  { id: 'Saturday', name: 'Saturday', short: 'Sat' },
  { id: 'Sunday', name: 'Sunday', short: 'Sun' },
  { id: 'Monday', name: 'Monday', short: 'Mon' },
  { id: 'Tuesday', name: 'Tuesday', short: 'Tue' },
  { id: 'Wednesday', name: 'Wednesday', short: 'Wed' }
];

export const SCHEDULE_PERIODS = [
  {
    id: 'p1',
    periodNumber: 1,
    label: '9:00-10:00',
    startTime: '09:00',
    endTime: '10:00',
    durationHours: 1.0,
    isBreak: false
  },
  {
    id: 'p2',
    periodNumber: 2,
    label: '10:00-11:00',
    startTime: '10:00',
    endTime: '11:00',
    durationHours: 1.0,
    isBreak: false
  },
  {
    id: 'p3',
    periodNumber: 3,
    label: '11:00-12:00',
    startTime: '11:00',
    endTime: '12:00',
    durationHours: 1.0,
    isBreak: false
  },
  {
    id: 'p4',
    periodNumber: 4,
    label: '12:00-01:00',
    startTime: '12:00',
    endTime: '13:00',
    durationHours: 1.0,
    isBreak: false
  },
  {
    id: 'break',
    periodNumber: null,
    label: '01:00-02:00',
    startTime: '13:00',
    endTime: '14:00',
    durationHours: 1.0,
    isBreak: true
  },
  {
    id: 'p5',
    periodNumber: 5,
    label: '02:00-03:00',
    startTime: '14:00',
    endTime: '15:00',
    durationHours: 1.0,
    isBreak: false
  },
  {
    id: 'p6',
    periodNumber: 6,
    label: '03:00-04:00',
    startTime: '15:00',
    endTime: '16:00',
    durationHours: 1.0,
    isBreak: false
  },
  {
    id: 'p7',
    periodNumber: 7,
    label: '04:00-05:00',
    startTime: '16:00',
    endTime: '17:00',
    durationHours: 1.0,
    isBreak: false
  }
];

export const TEACHING_PERIOD_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
export const BREAK_PERIOD_ID = 'break';

export const COMMON_ROOMS = [
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
];

/**
 * Get period object by ID
 */
export function getPeriodById(periodId) {
  return SCHEDULE_PERIODS.find(p => p.id === periodId) || null;
}

/**
 * Compute the list of period IDs that a slot occupies given startPeriodId and span.
 * Returns null if invalid (e.g. overlaps break or goes out of day bounds).
 */
export function getCoveredPeriodIds(startPeriodId, span = 1) {
  const periodIndex = SCHEDULE_PERIODS.findIndex(p => p.id === startPeriodId);
  if (periodIndex === -1) return null;

  const covered = [];
  for (let i = 0; i < span; i++) {
    const idx = periodIndex + i;
    if (idx >= SCHEDULE_PERIODS.length) return null; // out of day bounds
    const p = SCHEDULE_PERIODS[idx];
    if (p.isBreak) return null; // cannot overlap break
    covered.push(p.id);
  }
  return covered;
}

/**
 * Get human-readable time range string for a slot
 * Example: '9:00-10:00' (span 1) or '10:00-12:00' (span 2) or '02:00-05:00' (span 3)
 */
export function getSlotTimeRangeLabel(startPeriodId, span = 1) {
  const pStart = getPeriodById(startPeriodId);
  if (!pStart) return '';
  if (span <= 1) return pStart.label;

  const covered = getCoveredPeriodIds(startPeriodId, span);
  if (!covered || covered.length === 0) return pStart.label;
  const pEnd = getPeriodById(covered[covered.length - 1]);
  if (!pEnd) return pStart.label;

  const startStr = pStart.label.split('-')[0];
  const endStr = pEnd.label.split('-')[1];
  return `${startStr}-${endStr}`;
}

/**
 * Intelligent room allocator that finds the first available conflict-free room
 */
export function getAvailableRoom(day, periodId, span = 1, isLab = false, existingSchedule = [], preferredRoom = null) {
  const covered = getCoveredPeriodIds(periodId, span) || [periodId];
  
  const theoryRooms = ['501', '502', '504', 'R-504', 'R-519'];
  const labRooms = ['ACL', 'S/W Lab', 'H/W Lab', 'Network Lab', 'Robotics Lab'];
  const candidateRooms = isLab 
    ? [...(preferredRoom ? [preferredRoom] : []), ...labRooms, ...theoryRooms]
    : [...(preferredRoom ? [preferredRoom] : []), ...theoryRooms, ...labRooms];

  const uniqueCandidateRooms = [...new Set(candidateRooms.filter(Boolean))];

  for (const rm of uniqueCandidateRooms) {
    const isOccupied = existingSchedule.some(s => {
      if (s.day !== day) return false;
      const sCovered = s.coveredPeriods || getCoveredPeriodIds(s.periodId, s.span || 1) || [s.periodId];
      const overlaps = covered.some(p => sCovered.includes(p));
      if (!overlaps) return false;
      return (s.room || '').trim().toLowerCase() === rm.trim().toLowerCase();
    });

    if (!isOccupied) {
      return rm;
    }
  }

  return preferredRoom || (isLab ? 'ACL' : '501');
}

/**
 * Automatically merges adjacent periods of the same class for the same semester into a continuous block (e.g. 2 adjacent 1h classes -> 2h block)
 */
export function mergeAdjacentSameCourseSlots(schedule = []) {
  if (!Array.isArray(schedule) || schedule.length <= 1) return schedule;

  let merged = [...schedule];
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i++) {
      const a = merged[i];
      const aSpan = Number(a.span) || 1;
      const aCovered = a.coveredPeriods || getCoveredPeriodIds(a.periodId, aSpan);
      if (!aCovered || aCovered.length === 0) continue;
      const lastCoveredPeriod = aCovered[aCovered.length - 1];
      const lastPeriodIdx = SCHEDULE_PERIODS.findIndex(p => p.id === lastCoveredPeriod);

      for (let j = 0; j < merged.length; j++) {
        if (i === j) continue;
        const b = merged[j];

        // Must be same day, same semester, same course
        if (a.day !== b.day || a.semesterId !== b.semesterId) continue;
        if (a.courseCode !== b.courseCode && a.courseId !== b.courseId) continue;

        // Check if b immediately follows a
        const bPeriodIdx = SCHEDULE_PERIODS.findIndex(p => p.id === b.periodId);
        if (bPeriodIdx === lastPeriodIdx + 1) {
          // Cannot cross break
          const betweenPeriod = SCHEDULE_PERIODS[bPeriodIdx];
          if (betweenPeriod && betweenPeriod.isBreak) continue;

          const combinedSpan = aSpan + (Number(b.span) || 1);
          const combinedCovered = getCoveredPeriodIds(a.periodId, combinedSpan);
          if (combinedCovered) {
            // Valid merge!
            const mergedSlot = {
              ...a,
              span: combinedSpan,
              coveredPeriods: combinedCovered,
              room: a.room || b.room || '501'
            };

            merged = merged.filter((_, idx) => idx !== i && idx !== j);
            merged.push(mergedSlot);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }
  }

  return merged;
}

/**
 * Normalizes a schedule slot object
 */
export function normalizeSlot(slot) {
  const span = Math.max(1, parseInt(slot.span, 10) || 1);
  const coveredPeriods = getCoveredPeriodIds(slot.periodId, span) || [slot.periodId];

  return {
    id: slot.id || 'slot-' + Math.random().toString(36).substring(2, 9),
    day: slot.day,
    periodId: slot.periodId,
    span,
    coveredPeriods,
    semesterId: slot.semesterId,
    semesterName: slot.semesterName || '',
    termCode: slot.termCode || '',
    courseId: slot.courseId,
    courseCode: slot.courseCode,
    courseTitle: slot.courseTitle || '',
    creditHours: Number(slot.creditHours) || 3.0,
    courseType: slot.courseType || 'Theory',
    teacherId: slot.teacherId || null,
    teacherName: slot.teacherName || 'Not Assigned',
    teacherShortCode: slot.teacherShortCode || '',
    teacherType: slot.teacherType || 'department',
    room: slot.room || '501'
  };
}

/**
 * Comprehensive Conflict Detection
 * Checks candidate slot against existing slots in the schedule
 */
export function checkSlotConflict(candidateSlot, existingSlots, excludeSlotId = null) {
  const candidate = normalizeSlot(candidateSlot);

  // 1. Break Check
  if (candidate.periodId === BREAK_PERIOD_ID) {
    return {
      hasConflict: true,
      type: 'BREAK_PROTECTION',
      message: 'Classes cannot be scheduled during the official university break period (01:00-02:00).'
    };
  }

  const candidatePeriods = getCoveredPeriodIds(candidate.periodId, candidate.span);
  if (!candidatePeriods) {
    return {
      hasConflict: true,
      type: 'INVALID_SPAN',
      message: 'Selected block duration extends beyond available day hours or crosses the break period.'
    };
  }

  for (const existing of existingSlots) {
    if (excludeSlotId && existing.id === excludeSlotId) continue;
    if (existing.day !== candidate.day) continue;

    const existingPeriods = existing.coveredPeriods || getCoveredPeriodIds(existing.periodId, existing.span || 1) || [existing.periodId];
    
    // Check period overlap
    const hasOverlap = candidatePeriods.some(p => existingPeriods.includes(p));
    if (!hasOverlap) continue;

    const overlapPeriods = candidatePeriods.filter(p => existingPeriods.includes(p));
    const overlapLabels = overlapPeriods.map(pid => getPeriodById(pid)?.label || pid).join(', ');

    // 2. Semester Conflict (Same semester cannot have two simultaneous courses)
    if (existing.semesterId === candidate.semesterId) {
      return {
        hasConflict: true,
        type: 'SEMESTER_CONFLICT',
        conflictingSlot: existing,
        message: `Semester ${candidate.termCode || candidate.semesterName} already has "${existing.courseCode}" scheduled on ${candidate.day} at ${overlapLabels}.`
      };
    }

    // 3. Teacher Conflict (Same teacher cannot teach in two semesters at the same time)
    const isSameTeacher = (candidate.teacherId && existing.teacherId && candidate.teacherId === existing.teacherId) ||
      (candidate.teacherName && candidate.teacherName !== 'Not Assigned' &&
       existing.teacherName && existing.teacherName !== 'Not Assigned' &&
       candidate.teacherName.toLowerCase().trim() === existing.teacherName.toLowerCase().trim());

    if (isSameTeacher) {
      const teacherDisplay = candidate.teacherShortCode || candidate.teacherName;
      return {
        hasConflict: true,
        type: 'TEACHER_CONFLICT',
        conflictingSlot: existing,
        message: `Teacher ${teacherDisplay} is already scheduled to teach "${existing.courseCode}" (${existing.termCode || existing.semesterName}) on ${candidate.day} at ${overlapLabels}.`
      };
    }

    // 4. Room Conflict (Same room cannot host two different classes)
    if (candidate.room && existing.room && candidate.room.trim().toLowerCase() === existing.room.trim().toLowerCase()) {
      return {
        hasConflict: true,
        type: 'ROOM_CONFLICT',
        conflictingSlot: existing,
        message: `Room/Lab "${candidate.room}" is already occupied by "${existing.courseCode}" (${existing.termCode || existing.semesterName}) on ${candidate.day} at ${overlapLabels}.`
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Scan entire schedule array and return all conflicts
 */
export function validateEntireSchedule(slots) {
  const conflicts = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];

      if (a.day !== b.day) continue;

      const aPeriods = a.coveredPeriods || getCoveredPeriodIds(a.periodId, a.span || 1) || [a.periodId];
      const bPeriods = b.coveredPeriods || getCoveredPeriodIds(b.periodId, b.span || 1) || [b.periodId];

      const overlap = aPeriods.filter(p => bPeriods.includes(p));
      if (overlap.length === 0) continue;

      const overlapLabels = overlap.map(pid => getPeriodById(pid)?.label || pid).join(', ');

      if (a.semesterId === b.semesterId) {
        conflicts.push({
          type: 'SEMESTER_CONFLICT',
          slotA: a,
          slotB: b,
          day: a.day,
          message: `Semester conflict on ${a.day} (${overlapLabels}): "${a.courseCode}" and "${b.courseCode}" overlap.`
        });
      }

      const isSameTeacher = (a.teacherId && b.teacherId && a.teacherId === b.teacherId) ||
        (a.teacherName && a.teacherName !== 'Not Assigned' &&
         b.teacherName && b.teacherName !== 'Not Assigned' &&
         a.teacherName.toLowerCase().trim() === b.teacherName.toLowerCase().trim());

      if (isSameTeacher) {
        conflicts.push({
          type: 'TEACHER_CONFLICT',
          slotA: a,
          slotB: b,
          day: a.day,
          message: `Teacher conflict on ${a.day} (${overlapLabels}): ${a.teacherShortCode || a.teacherName} is scheduled for both "${a.courseCode}" (${a.termCode}) and "${b.courseCode}" (${b.termCode}).`
        });
      }

      if (a.room && b.room && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) {
        conflicts.push({
          type: 'ROOM_CONFLICT',
          slotA: a,
          slotB: b,
          day: a.day,
          message: `Room conflict on ${a.day} (${overlapLabels}): Room "${a.room}" is double-booked for "${a.courseCode}" and "${b.courseCode}".`
        });
      }
    }
  }

  return conflicts;
}

/**
 * Calculate scheduled hours per course in the routine
 */
export function getCourseScheduledHours(courseOrId, slots = []) {
  if (!courseOrId || !Array.isArray(slots)) return 0;
  const courseId = typeof courseOrId === 'object' ? (courseOrId.courseId || courseOrId.id) : courseOrId;
  const courseCode = typeof courseOrId === 'object' ? courseOrId.courseCode : null;

  let totalHours = 0;
  for (const s of slots) {
    const matchId = courseId && (s.courseId === courseId);
    const matchCode = courseCode && s.courseCode && s.courseCode.trim().toUpperCase() === courseCode.trim().toUpperCase();
    if (matchId || matchCode) {
      totalHours += Number(s.span || 1);
    }
  }
  return totalHours;
}

export function calculateWeeklyHours(course, options = {}) {
  const credit = Number(course.creditHours) || 3.0;
  const isLab = course.courseType === 'Sessional' || course.courseType === 'Lab' || 
    (course.courseTitle && course.courseTitle.toLowerCase().includes('sessional')) ||
    (course.courseTitle && course.courseTitle.toLowerCase().includes('lab'));
  
  if (isLab) {
    const ratio = options.labHoursRatio !== undefined ? Number(options.labHoursRatio) : 2.0;
    return Math.max(1, Math.round(credit * ratio));
  }
  return Math.max(1, Math.round(credit));
}

/**
 * Intelligent Smart Schedule Generator
 * Generates non-conflicting time slots for all active courses across all semesters
 */
export function generateSmartSchedule({ semesters = [], existingSlots = [], options = {} }) {
  const labHoursRatio = options.labHoursRatio !== undefined ? Number(options.labHoursRatio) : 2.0;
  const preserveUnlocked = Boolean(options.preserveUnlocked);

  // Separate locked slots vs replaceable slots
  const preservedSlots = existingSlots.filter(s => s.isLocked || (preserveUnlocked && !s.isConflict));
  const newSchedule = [...preservedSlots];

  const theoryRooms = ['501', '502', '504', 'R-504', 'R-519'];
  const labRooms = ['ACL', 'S/W Lab', 'Robotics Lab', 'Hardware Lab'];

  // Valid teaching periods for blocks:
  // Morning block: p1 (09:00), p2 (10:00), p3 (11:00), p4 (12:00)
  // Afternoon block: p5 (14:00), p6 (15:00), p7 (16:00)
  const days = SCHEDULE_DAYS.map(d => d.name); // Saturday to Wednesday

  const warnings = [];
  const courseProgress = {};

  // Build course queue
  const coursesToSchedule = [];

  for (const sem of semesters) {
    const semId = sem.semesterId || sem.id;
    const courses = Array.isArray(sem.courses) ? sem.courses : [];

    for (const c of courses) {
      // Check if course is included and active
      if (c.isIncluded === false || c.status === 'ARCHIVED' || c.status === 'COMPLETED') {
        continue;
      }

      const reqHours = calculateWeeklyHours(c, { labHoursRatio });
      const currentSched = newSchedule
        .filter(s => s.courseId === (c.courseId || c.id) && s.semesterId === semId)
        .reduce((sum, s) => sum + (s.span || 1), 0);

      const remaining = Math.max(0, reqHours - currentSched);

      courseProgress[c.courseCode] = {
        courseCode: c.courseCode,
        courseTitle: c.courseTitle,
        creditHours: c.creditHours,
        requiredHours: reqHours,
        scheduledHours: currentSched,
        remainingHours: remaining,
        semesterId: semId,
        termCode: sem.termCode || sem.shortTerm
      };

      if (remaining > 0) {
        const isLab = c.courseType === 'Sessional' || c.courseType === 'Lab' ||
          (c.courseTitle && c.courseTitle.toLowerCase().includes('sessional')) ||
          (c.courseTitle && c.courseTitle.toLowerCase().includes('lab'));

        coursesToSchedule.push({
          semesterId: semId,
          semesterName: sem.semesterName,
          termCode: sem.termCode,
          shortTerm: sem.shortTerm || sem.termCode,
          courseId: c.courseId || c.id,
          courseCode: c.courseCode,
          courseTitle: c.courseTitle,
          creditHours: Number(c.creditHours) || 3.0,
          courseType: isLab ? 'Sessional' : 'Theory',
          isLab,
          teacher: c.teacher || { type: 'none', teacherName: 'Not Assigned' },
          remainingHours: remaining,
          requiredHours: reqHours,
          preferredRooms: Array.isArray(c.preferredRooms) && c.preferredRooms.length > 0 ? c.preferredRooms : (isLab ? labRooms : theoryRooms)
        });
      }
    }
  }

  // Sort queue: Labs first (need 3 consecutive slots), then courses with assigned teachers
  coursesToSchedule.sort((a, b) => {
    if (a.isLab && !b.isLab) return -1;
    if (!a.isLab && b.isLab) return 1;
    const aHasTeacher = a.teacher && a.teacher.teacherName && a.teacher.teacherName !== 'Not Assigned';
    const bHasTeacher = b.teacher && b.teacher.teacherName && b.teacher.teacherName !== 'Not Assigned';
    if (aHasTeacher && !bHasTeacher) return -1;
    if (!aHasTeacher && bHasTeacher) return 1;
    return b.remainingHours - a.remainingHours;
  });

  // Scheduling loop
  for (const item of coursesToSchedule) {
    let hoursNeeded = item.remainingHours;

    if (item.isLab) {
      // Labs are placed in blocks of 3 periods (or 2 if remaining is 2)
      const span = Math.min(3, hoursNeeded);
      let placed = false;

      // Candidate start periods for lab: p1 (morning block: p1-p3) or p5 (afternoon block: p5-p7)
      const labCandidateStarts = ['p1', 'p5', 'p2'];

      for (const day of days) {
        if (placed) break;
        for (const startPid of labCandidateStarts) {
          if (placed) break;
          // Verify covered periods don't hit break
          const covered = getCoveredPeriodIds(startPid, span);
          if (!covered) continue;

          for (const room of item.preferredRooms) {
            const candidate = {
              id: 'slot-' + Math.random().toString(36).substring(2, 9),
              day,
              periodId: startPid,
              span,
              coveredPeriods: covered,
              semesterId: item.semesterId,
              semesterName: item.semesterName,
              termCode: item.termCode,
              courseId: item.courseId,
              courseCode: item.courseCode,
              courseTitle: item.courseTitle,
              creditHours: item.creditHours,
              courseType: 'Sessional',
              teacherId: item.teacher?.teacherId || null,
              teacherName: item.teacher?.teacherName || 'Not Assigned',
              teacherShortCode: item.teacher?.shortCode || '',
              teacherType: item.teacher?.type || 'department',
              room,
              isLocked: false
            };

            const conflict = checkSlotConflict(candidate, newSchedule);
            if (!conflict.hasConflict) {
              newSchedule.push(candidate);
              hoursNeeded -= span;
              placed = true;
              break;
            }
          }
        }
      }

      if (!placed) {
        warnings.push(`Could not automatically find an open 3-hour lab block for ${item.courseCode} (${item.termCode}). Please assign manually.`);
      }
    } else {
      // Theory courses: break into 1-hour sessions across different days
      const daysUsedForThisCourse = new Set(
        newSchedule
          .filter(s => s.courseId === item.courseId && s.semesterId === item.semesterId)
          .map(s => s.day)
      );

      while (hoursNeeded > 0) {
        let placedThisUnit = false;
        const span = 1;

        const dayCandidates = [...days].sort((d1, d2) => {
          const u1 = daysUsedForThisCourse.has(d1) ? 1 : 0;
          const u2 = daysUsedForThisCourse.has(d2) ? 1 : 0;
          return u1 - u2;
        });

        const periodCandidates = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

        for (const day of dayCandidates) {
          if (placedThisUnit) break;
          for (const pid of periodCandidates) {
            if (placedThisUnit) break;
            const covered = getCoveredPeriodIds(pid, span);
            if (!covered) continue;

            for (const room of item.preferredRooms) {
              const candidate = {
                id: 'slot-' + Math.random().toString(36).substring(2, 9),
                day,
                periodId: pid,
                span,
                coveredPeriods: covered,
                semesterId: item.semesterId,
                semesterName: item.semesterName,
                termCode: item.termCode,
                courseId: item.courseId,
                courseCode: item.courseCode,
                courseTitle: item.courseTitle,
                creditHours: item.creditHours,
                courseType: 'Theory',
                teacherId: item.teacher?.teacherId || null,
                teacherName: item.teacher?.teacherName || 'Not Assigned',
                teacherShortCode: item.teacher?.shortCode || '',
                teacherType: item.teacher?.type || 'department',
                room,
                isLocked: false
              };

              const conflict = checkSlotConflict(candidate, newSchedule);
              if (!conflict.hasConflict) {
                newSchedule.push(candidate);
                daysUsedForThisCourse.add(day);
                hoursNeeded -= span;
                placedThisUnit = true;
                break;
              }
            }
          }
        }

        if (!placedThisUnit) {
          warnings.push(`Could not schedule ${hoursNeeded}h remaining for ${item.courseCode} (${item.termCode}). Free slots or rooms may be exhausted.`);
          break;
        }
      }
    }
  }

  // Recalculate stats
  let totalRequiredHours = 0;
  let totalScheduledHours = 0;

  for (const sem of semesters) {
    const semId = sem.semesterId || sem.id;
    const courses = Array.isArray(sem.courses) ? sem.courses : [];
    for (const c of courses) {
      if (c.isIncluded === false || c.status === 'ARCHIVED' || c.status === 'COMPLETED') continue;
      const req = calculateWeeklyHours(c, { labHoursRatio });
      const sched = newSchedule
        .filter(s => s.courseId === (c.courseId || c.id) && s.semesterId === semId)
        .reduce((sum, s) => sum + (s.span || 1), 0);

      totalRequiredHours += req;
      totalScheduledHours += sched;

      courseProgress[c.courseCode] = {
        courseCode: c.courseCode,
        courseTitle: c.courseTitle,
        creditHours: c.creditHours,
        requiredHours: req,
        scheduledHours: sched,
        remainingHours: Math.max(0, req - sched)
      };
    }
  }

  const conflicts = validateEntireSchedule(newSchedule);

  return {
    schedule: newSchedule,
    stats: {
      totalRequiredHours,
      totalScheduledHours,
      unscheduledHours: Math.max(0, totalRequiredHours - totalScheduledHours),
      totalSlots: newSchedule.length
    },
    courseProgress,
    warnings,
    conflicts
  };
}

/**
 * Routine Version Diff Generator
 * Produces structured change list and summary between two routine snapshots
 */
export function diffRoutines(oldData = {}, newData = {}) {
  const oldSemesters = Array.isArray(oldData.semesters) ? oldData.semesters : [];
  const newSemesters = Array.isArray(newData.semesters) ? newData.semesters : [];

  const oldCoursesMap = new Map();
  const newCoursesMap = new Map();

  oldSemesters.forEach(s => {
    (s.courses || []).forEach(c => oldCoursesMap.set(`${s.semesterId || s.id}_${c.courseCode}`, { ...c, semTerm: s.shortTerm || s.termCode }));
  });

  newSemesters.forEach(s => {
    (s.courses || []).forEach(c => newCoursesMap.set(`${s.semesterId || s.id}_${c.courseCode}`, { ...c, semTerm: s.shortTerm || s.termCode }));
  });

  const coursesAdded = [];
  const coursesRemoved = [];
  const teachersChanged = [];

  newCoursesMap.forEach((newC, key) => {
    if (!oldCoursesMap.has(key)) {
      coursesAdded.push(`${newC.courseCode} (${newC.semTerm || ''})`);
    } else {
      const oldC = oldCoursesMap.get(key);
      const oldTeacher = oldC.teacher?.teacherName || 'Not Assigned';
      const newTeacher = newC.teacher?.teacherName || 'Not Assigned';
      if (oldTeacher !== newTeacher) {
        teachersChanged.push(`${newC.courseCode}: "${oldTeacher}" → "${newTeacher}"`);
      }
    }
  });

  oldCoursesMap.forEach((oldC, key) => {
    if (!newCoursesMap.has(key)) {
      coursesRemoved.push(`${oldC.courseCode} (${oldC.semTerm || ''})`);
    }
  });

  const oldSchedule = Array.isArray(oldData.schedule) ? oldData.schedule : [];
  const newSchedule = Array.isArray(newData.schedule) ? newData.schedule : [];

  const slotsRescheduled = [];
  if (oldSchedule.length !== newSchedule.length) {
    slotsRescheduled.push(`Total scheduled class slots changed: ${oldSchedule.length} → ${newSchedule.length}`);
  }

  const summaryParts = [];
  if (coursesAdded.length > 0) summaryParts.push(`${coursesAdded.length} new course(s) added`);
  if (coursesRemoved.length > 0) summaryParts.push(`${coursesRemoved.length} course(s) archived`);
  if (teachersChanged.length > 0) summaryParts.push(`${teachersChanged.length} teacher assignment(s) updated`);
  if (slotsRescheduled.length > 0) summaryParts.push(`${slotsRescheduled.length} timetable modification(s)`);
  if (summaryParts.length === 0) summaryParts.push('Routine refreshed with updated timetable preferences');

  return {
    coursesAdded,
    coursesRemoved,
    teachersChanged,
    slotsRescheduled,
    changeSummary: summaryParts.join(', '),
    changesData: {
      coursesAdded,
      coursesRemoved,
      teachersChanged,
      slotsRescheduled
    }
  };
}
