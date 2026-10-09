import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Calendar, 
  Clock, 
  Building2, 
  BookOpen, 
  User, 
  AlertTriangle, 
  Lock 
} from 'lucide-react';
import { 
  SCHEDULE_DAYS, 
  SCHEDULE_PERIODS, 
  COMMON_ROOMS, 
  checkSlotConflict,
  getPeriodById 
} from '../../utils/scheduleConfig';

export function ManualScheduleModal({
  isOpen,
  onClose,
  semesters = [],
  currentSchedule = [],
  initialSemesterId = null,
  initialCourseId = null,
  initialDay = 'Saturday',
  initialPeriodId = 'p1',
  onSaveSlot
}) {
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDay, setSelectedDay] = useState(initialDay || 'Saturday');
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialPeriodId || 'p1');
  const [selectedSpan, setSelectedSpan] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState('Room 501');
  const [isLocked, setIsLocked] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);

  // Sync initial selections when opened
  useEffect(() => {
    if (!isOpen) return;

    const defaultSemId = initialSemesterId || (semesters[0]?.semesterId || semesters[0]?.id || '');
    setSelectedSemesterId(defaultSemId);

    const sem = semesters.find(s => (s.semesterId || s.id) === defaultSemId);
    const courses = sem?.courses || [];
    
    if (initialCourseId && courses.some(c => (c.courseId || c.id) === initialCourseId)) {
      setSelectedCourseId(initialCourseId);
    } else if (courses.length > 0) {
      setSelectedCourseId(courses[0].courseId || courses[0].id);
    } else {
      setSelectedCourseId('');
    }

    setSelectedDay(initialDay || 'Saturday');
    setSelectedPeriodId(initialPeriodId || 'p1');
    setSelectedRoom('Room 501');
    setIsLocked(false);
  }, [isOpen, initialSemesterId, initialCourseId, initialDay, initialPeriodId, semesters]);

  // When selected semester changes, adjust courses
  const handleSemesterChange = (newSemId) => {
    setSelectedSemesterId(newSemId);
    const sem = semesters.find(s => (s.semesterId || s.id) === newSemId);
    const courses = sem?.courses || [];
    if (courses.length > 0) {
      setSelectedCourseId(courses[0].courseId || courses[0].id);
      const isLab = courses[0].courseType === 'Sessional' || (courses[0].courseTitle && courses[0].courseTitle.toLowerCase().includes('lab'));
      setSelectedSpan(isLab ? 3 : 1);
      setSelectedRoom(isLab ? 'Lab 1' : 'Room 501');
    } else {
      setSelectedCourseId('');
    }
  };

  // When selected course changes, auto-set default span & room
  const handleCourseChange = (newCourseId) => {
    setSelectedCourseId(newCourseId);
    const currentSem = semesters.find(s => (s.semesterId || s.id) === selectedSemesterId);
    const crs = (currentSem?.courses || []).find(c => (c.courseId || c.id) === newCourseId);
    if (crs) {
      const isLab = crs.courseType === 'Sessional' || (crs.courseTitle && crs.courseTitle.toLowerCase().includes('lab'));
      setSelectedSpan(isLab ? 3 : 1);
      setSelectedRoom(isLab ? 'Lab 1' : 'Room 501');
    }
  };

  // Get active course object
  const currentSem = semesters.find(s => (s.semesterId || s.id) === selectedSemesterId);
  const currentCourses = currentSem?.courses || [];
  const activeCourse = currentCourses.find(c => (c.courseId || c.id) === selectedCourseId);

  // Live conflict evaluation
  useEffect(() => {
    if (!isOpen || !activeCourse || !selectedSemesterId) {
      setConflictWarning(null);
      return;
    }

    const candidate = {
      semesterId: selectedSemesterId,
      termCode: currentSem?.shortTerm || currentSem?.termCode || 'Sem',
      courseId: activeCourse.courseId || activeCourse.id,
      courseCode: activeCourse.courseCode,
      courseTitle: activeCourse.courseTitle,
      creditHours: activeCourse.creditHours,
      courseType: activeCourse.courseType,
      teacherId: activeCourse.teacher?.teacherId || null,
      teacherName: activeCourse.teacher?.teacherName || 'Not Assigned',
      teacherShortCode: activeCourse.teacher?.shortCode || activeCourse.teacher?.teacherName || '',
      day: selectedDay,
      periodId: selectedPeriodId,
      span: Number(selectedSpan) || 1,
      room: selectedRoom,
      isLocked: isLocked
    };

    const conflict = checkSlotConflict(candidate, currentSchedule, currentSchedule);
    setConflictWarning(conflict);
  }, [isOpen, selectedSemesterId, selectedCourseId, selectedDay, selectedPeriodId, selectedSpan, selectedRoom, isLocked, currentSchedule, activeCourse, currentSem]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeCourse || !selectedSemesterId) return;

    if (conflictWarning && conflictWarning.hasConflict) {
      const confirmOverride = window.confirm(`Scheduling Conflict Detected:\n${conflictWarning.message}\n\nDo you want to proceed and save anyway?`);
      if (!confirmOverride) return;
    }

    const newSlot = {
      id: `slot-manual-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      semesterId: selectedSemesterId,
      termCode: currentSem?.shortTerm || currentSem?.termCode || 'Sem',
      semesterName: currentSem?.semesterName || 'Semester',
      courseId: activeCourse.courseId || activeCourse.id,
      courseCode: activeCourse.courseCode,
      courseTitle: activeCourse.courseTitle,
      creditHours: activeCourse.creditHours,
      courseType: activeCourse.courseType,
      teacherId: activeCourse.teacher?.teacherId || null,
      teacherName: activeCourse.teacher?.teacherName || 'Not Assigned',
      teacherShortCode: activeCourse.teacher?.shortCode || activeCourse.teacher?.teacherName || '',
      teacherType: activeCourse.teacher?.type || 'department',
      day: selectedDay,
      periodId: selectedPeriodId,
      span: Number(selectedSpan) || 1,
      room: selectedRoom,
      isLocked: Boolean(isLocked)
    };

    onSaveSlot(newSlot);
    onClose();
  };

  const teachingPeriods = SCHEDULE_PERIODS.filter(p => !p.isBreak);

  return (
    <div 
      className="modal-backdrop-custom"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '580px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1px solid #e2e8f0',
          animation: 'fadeInUp 0.2s ease-out'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Calendar size={20} color="#818cf8" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Schedule Class Manually
              </h3>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                Non-drag timetable placement synchronized with database
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Conflict Alert Warning */}
          {conflictWarning && conflictWarning.hasConflict && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#fee2e2',
              border: '1.5px solid #fca5a5',
              borderRadius: '10px',
              color: '#991b1b',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{conflictWarning.message}</span>
            </div>
          )}

          {/* Row 1: Semester & Course Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Semester *
              </label>
              <select
                value={selectedSemesterId}
                onChange={(e) => handleSemesterChange(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {semesters.map(s => (
                  <option key={s.semesterId || s.id} value={s.semesterId || s.id}>
                    {s.semesterName} ({s.shortTerm || s.termCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Course *
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {currentCourses.length === 0 ? (
                  <option value="">No courses in this semester</option>
                ) : (
                  currentCourses.map(c => (
                    <option key={c.courseId || c.id} value={c.courseId || c.id}>
                      {c.courseCode} - {c.courseTitle}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Teacher Assignment Display */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} color="#6366f1" />
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Assigned Course Teacher</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: activeCourse?.teacher?.teacherName ? '#0f172a' : '#d97706' }}>
                  {activeCourse?.teacher?.teacherName || '⚠️ No Teacher Assigned'}
                  {activeCourse?.teacher?.shortCode && ` (${activeCourse.teacher.shortCode})`}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              background: activeCourse?.teacher?.teacherName ? '#e0e7ff' : '#fef3c7',
              color: activeCourse?.teacher?.teacherName ? '#3730a3' : '#b45309'
            }}>
              {activeCourse?.courseType || 'Theory'} ({activeCourse?.creditHours || 3} cr)
            </span>
          </div>

          {/* Row 2: Day, Starting Period & Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.3fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Day *
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {SCHEDULE_DAYS.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Starting Period *
              </label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {teachingPeriods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.startTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Duration / Span *
              </label>
              <select
                value={selectedSpan}
                onChange={(e) => setSelectedSpan(parseInt(e.target.value) || 1)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                <option value={1}>1 Period (1 Hour)</option>
                <option value={2}>2 Periods (2 Hours)</option>
                <option value={3}>3 Periods (3h Lab Block)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Room Allocation */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              Room Allocation *
            </label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            >
              {COMMON_ROOMS.map(rm => (
                <option key={rm} value={rm}>{rm}</option>
              ))}
            </select>
          </div>

          {/* Lock Slot Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            <input
              type="checkbox"
              id="manualSlotLockCheckbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label 
              htmlFor="manualSlotLockCheckbox" 
              style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Lock size={14} color="#d97706" /> Lock this slot (Preserves slot when auto-scheduling)
            </label>
          </div>

          {/* Modal Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            marginTop: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!activeCourse}
              style={{
                padding: '0.55rem 1.35rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: activeCourse ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Check size={16} /> Save to Timetable
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
