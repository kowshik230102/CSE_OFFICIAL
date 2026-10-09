import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  BookOpen, 
  Layers, 
  UserCheck, 
  UserPlus, 
  Clock, 
  GripVertical, 
  CalendarPlus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Filter,
  MapPin
} from 'lucide-react';
import { calculateWeeklyHours } from '../../utils/scheduleConfig';

export function CourseDragPanel({
  semesters = [],
  selectedSemesterIndex = 0,
  onSelectSemesterIndex,
  onOpenAddSemesterModal,
  onRemoveSemester,
  onOpenTeacherModal,
  onOpenManualScheduleModal,
  currentSchedule = [],
  onDragStartCourse
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'THEORY' | 'SESSIONAL' | 'UNASSIGNED'
  const [selectedTargetRoom, setSelectedTargetRoom] = useState('AUTO');

  const activeSemester = semesters[selectedSemesterIndex] || semesters[0];
  const courses = activeSemester?.courses || [];

  // Filter courses strictly for the selected semester
  const filteredCourses = courses.filter(c => {
    const matchesSearch = 
      c.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.teacher?.teacherName && c.teacher.teacherName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'THEORY') return c.courseType === 'Theory';
    if (filterType === 'SESSIONAL') return c.courseType === 'Sessional' || c.courseTitle.toLowerCase().includes('lab');
    if (filterType === 'UNASSIGNED') return !c.teacher?.teacherName || c.teacher.teacherName === 'Not Assigned';
    return true;
  });

  // Calculate scheduled hours for a course from active routine's schedule
  const getCourseProgress = (course) => {
    const cid = course.courseId || course.id;
    const slots = currentSchedule.filter(s => {
      const matchCourse = 
        (s.courseId && (s.courseId === cid || s.courseId === course.id || s.courseId === course.courseId)) ||
        (s.courseCode && course.courseCode && s.courseCode.trim().toUpperCase() === course.courseCode.trim().toUpperCase());
      const matchSem = !s.semesterId || !activeSemester?.semesterId || s.semesterId === activeSemester?.semesterId;
      return matchCourse && matchSem;
    });
    const scheduledHours = slots.reduce((acc, s) => acc + (Number(s.span) || 1), 0);
    const requiredHours = Number(course.weeklyHours) || calculateWeeklyHours(course);
    const remainingHours = Math.max(0, requiredHours - scheduledHours);
    return {
      scheduledHours,
      requiredHours,
      remainingHours,
      isFullyScheduled: scheduledHours >= requiredHours,
      isOverScheduled: scheduledHours > requiredHours,
      slotsCount: slots.length
    };
  };

  return (
    <div 
      className="no-print"
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 170px)',
        minHeight: '620px',
        position: 'sticky',
        top: '85px',
        overflow: 'hidden'
      }}
    >
      {/* 1. Panel Header & Semester Switcher */}
      <div style={{
        padding: '1rem 1.15rem 0.85rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        color: '#ffffff',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="#818cf8" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.3px' }}>
              Semester Courses
            </h3>
          </div>
          
          <button
            type="button"
            onClick={onOpenAddSemesterModal}
            title="Add another semester to active routine"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.35rem 0.65rem',
              borderRadius: '7px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Plus size={13} /> Add Semester
          </button>
        </div>

        {/* Semester Selection Tabs / Pills */}
        <div style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin'
        }}>
          {semesters.map((sem, idx) => {
            const isSelected = idx === selectedSemesterIndex;
            return (
              <button
                key={sem.semesterId || sem.id || idx}
                type="button"
                onClick={() => onSelectSemesterIndex(idx)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '7px',
                  border: isSelected ? '1.5px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.15)',
                  background: isSelected ? '#4338ca' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: isSelected ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                {sem.shortTerm || sem.termCode || `S-${idx + 1}`}
              </button>
            );
          })}
        </div>

        {/* Active Semester Name & Quick Info */}
        {activeSemester && (
          <div style={{
            marginTop: '0.65rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>
                {activeSemester.semesterName}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                {courses.length} courses • {activeSemester.totalStudents || 0} students
              </div>
            </div>

            {semesters.length > 1 && (
              <button
                type="button"
                title={`Remove ${activeSemester.shortTerm || 'semester'} from active routine`}
                onClick={() => onRemoveSemester(selectedSemesterIndex)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  padding: '3px 6px',
                  borderRadius: '5px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <Trash2 size={11} /> Remove
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Quick Action Bar: Schedule Manually & Search */}
      <div style={{
        padding: '0.75rem 1rem 0.5rem',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <button
          type="button"
          onClick={() => onOpenManualScheduleModal(activeSemester?.semesterId)}
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1.5px dashed #6366f1',
            color: '#4f46e5',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#eef2ff'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
        >
          <CalendarPlus size={15} /> Schedule Manually
        </button>

        {/* Search input */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search code, title, teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem 0.45rem 2rem',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              boxSizing: 'border-box',
              background: '#ffffff'
            }}
          />
        </div>

        {/* Target Room Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          borderRadius: '7px',
          padding: '0.3rem 0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 800, color: '#3730a3' }}>
            <MapPin size={13} color="#4f46e5" />
            <span>Target Room:</span>
          </div>
          <select
            value={selectedTargetRoom}
            onChange={(e) => setSelectedTargetRoom(e.target.value)}
            style={{
              padding: '0.2rem 0.4rem',
              borderRadius: '5px',
              border: '1px solid #a5b4fc',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#ffffff',
              color: '#1e1b4b',
              cursor: 'pointer'
            }}
          >
            <option value="AUTO">⚡ Auto-Assign (Conflict-Free)</option>
            <option value="501">Room 501</option>
            <option value="502">Room 502</option>
            <option value="504">Room 504</option>
            <option value="R-504">Room R-504</option>
            <option value="R-519">Room R-519</option>
            <option value="ACL">ACL (Lab)</option>
            <option value="S/W Lab">S/W Lab</option>
            <option value="Hardware Lab">Hardware Lab</option>
            <option value="Robotics Lab">Robotics Lab</option>
          </select>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '2px' }}>
          {['ALL', 'THEORY', 'SESSIONAL', 'UNASSIGNED'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              style={{
                background: filterType === f ? '#0f172a' : '#ffffff',
                color: filterType === f ? '#ffffff' : '#475569',
                border: '1px solid #cbd5e1',
                padding: '2px 7px',
                borderRadius: '5px',
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {f === 'ALL' ? 'All' : f === 'THEORY' ? 'Theory' : f === 'SESSIONAL' ? 'Lab' : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Drag Instruction Banner */}
      <div style={{
        padding: '0.4rem 1rem',
        background: '#eff6ff',
        borderBottom: '1px solid #dbeafe',
        fontSize: '0.68rem',
        color: '#1e40af',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontWeight: 600
      }}>
        <GripVertical size={13} color="#3b82f6" />
        <span>Drag a course card into any timetable slot cell to schedule</span>
      </div>

      {/* 4. Course Cards List (Only Selected Semester) */}
      <div style={{
        padding: '0.85rem 1rem',
        overflowY: 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {filteredCourses.length === 0 ? (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1'
          }}>
            <BookOpen size={28} style={{ margin: '0 auto 0.5rem', color: '#94a3b8' }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              No courses found
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
              {searchQuery ? 'Try adjusting your search query' : 'This semester has no courses registered yet.'}
            </div>
          </div>
        ) : (
          filteredCourses.map((c, cIdx) => {
            const isLab = c.courseType === 'Sessional' || (c.courseTitle && c.courseTitle.toLowerCase().includes('lab'));
            const teacherName = c.teacher?.teacherName;
            const hasTeacher = teacherName && teacherName !== 'Not Assigned';
            const progress = getCourseProgress(c);
            const cardRoom = selectedTargetRoom === 'AUTO' ? (isLab ? 'ACL' : '501') : selectedTargetRoom;

            return (
              <div
                key={c.courseId || c.id || cIdx}
                draggable={true}
                onDragStart={(e) => onDragStartCourse(e, c, activeSemester, selectedTargetRoom === 'AUTO' ? null : selectedTargetRoom)}
                style={{
                  background: '#ffffff',
                  borderRadius: '11px',
                  border: progress.isFullyScheduled 
                    ? '1.5px solid #a7f3d0' 
                    : !hasTeacher 
                      ? '1.5px solid #fde68a' 
                      : '1.5px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                  padding: '0.75rem 0.85rem',
                  cursor: 'grab',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.boxShadow = '0 6px 14px rgba(99, 102, 241, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = progress.isFullyScheduled 
                    ? '#a7f3d0' 
                    : !hasTeacher 
                      ? '#fde68a' 
                      : '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Header: Course Code, Credits, Type, and Room */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <GripVertical size={14} color="#94a3b8" />
                    <strong style={{ fontSize: '0.84rem', color: '#0f172a', letterSpacing: '0.2px' }}>
                      {c.courseCode}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      background: isLab ? '#f3e8ff' : '#eff6ff',
                      color: isLab ? '#7e22ce' : '#1d4ed8'
                    }}>
                      {isLab ? 'Lab' : 'Theory'} ({c.creditHours || 3} cr)
                    </span>
                    <span 
                      title={`Target Room: ${selectedTargetRoom === 'AUTO' ? `Auto (${cardRoom})` : cardRoom}`}
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        background: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <MapPin size={10} color="#6366f1" />
                      {cardRoom}
                    </span>
                  </div>
                </div>

                {/* Course Title */}
                <div style={{
                  fontSize: '0.74rem',
                  color: '#334155',
                  fontWeight: 600,
                  marginTop: '0.35rem',
                  lineHeight: 1.3
                }}>
                  {c.courseTitle}
                </div>

                {/* Assigned Teacher Section */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '0.5rem',
                  paddingTop: '0.45rem',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {hasTeacher ? (
                      <span style={{ fontSize: '0.72rem', color: '#4338ca', fontWeight: 700 }}>
                        {c.teacher.shortCode || teacherName}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <AlertCircle size={12} color="#d97706" /> No Teacher Assigned
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    title={hasTeacher ? "Change Teacher" : "Assign Teacher"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTeacherModal(selectedSemesterIndex, cIdx, c);
                    }}
                    style={{
                      background: hasTeacher ? '#f1f5f9' : '#fef3c7',
                      border: hasTeacher ? '1px solid #cbd5e1' : '1px solid #fcd34d',
                      color: hasTeacher ? '#475569' : '#92400e',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {hasTeacher ? 'Edit' : 'Assign'}
                  </button>
                </div>

                {/* Scheduled Hours Progress Bar */}
                {/* Scheduled Hours & Time Remaining Progress */}
                <div style={{ marginTop: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.67rem', fontWeight: 700, marginBottom: '3px' }}>
                    <span style={{ color: '#334155' }}>
                      Filled: <strong style={{ color: '#0f172a' }}>{progress.scheduledHours}h</strong> / {progress.requiredHours}h
                    </span>
                    <span style={{
                      color: progress.remainingHours === 0 
                        ? '#059669' 
                        : progress.isOverScheduled 
                          ? '#dc2626' 
                          : '#d97706',
                      fontWeight: 800,
                      background: progress.remainingHours === 0 ? '#ecfdf5' : '#fffbeb',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      border: progress.remainingHours === 0 ? '1px solid #a7f3d0' : '1px solid #fde68a'
                    }}>
                      {progress.remainingHours === 0 ? '✓ Complete' : `${progress.remainingHours}h remaining`}
                    </span>
                  </div>

                  {/* Progress track */}
                  <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, (progress.scheduledHours / (progress.requiredHours || 1)) * 100)}%`,
                      height: '100%',
                      background: progress.isOverScheduled 
                        ? '#ef4444' 
                        : progress.isFullyScheduled 
                          ? '#10b981' 
                          : 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.2s'
                    }} />
                  </div>
                </div>

                {/* Drag Handle & Quick Schedule Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '0.5rem',
                  fontSize: '0.68rem',
                  color: '#94a3b8'
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <GripVertical size={12} /> Drag to drop
                  </span>

                  <button
                    type="button"
                    title="Schedule manually to a specific slot"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenManualScheduleModal(activeSemester?.semesterId, c.courseId || c.id);
                    }}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add Slot
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
