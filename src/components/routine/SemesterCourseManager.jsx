import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Archive,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ChevronDown
} from 'lucide-react';

export function SemesterCourseManager({
  semesters = [],
  activeSemesterIndex = 0,
  selectedSemesterIndex,
  currentSchedule = [],
  onSelectSemesterIndex,
  onSelectSemester,
  onAddCourse,
  onOpenAddCourseModal,
  onEditCourse,
  onOpenEditCourseModal,
  onDeleteCourse,
  onUpdateCourseStatus,
  onToggleCourseStatus,
  onToggleIncludeCourse,
  onToggleCourseInRoutine,
  onOpenTeacherModal,
  onOpenCopySemesterModal,
  onAddSemesterModalOpen,
  onOpenStudentModal
}) {
  const currentSemIdx = selectedSemesterIndex !== undefined ? selectedSemesterIndex : activeSemesterIndex;
  const activeSemester = semesters[currentSemIdx] || semesters[0];
  const courses = activeSemester?.courses || [];

  const handleSelectSem = onSelectSemester || onSelectSemesterIndex || (() => {});
  const handleAddCourse = onOpenAddCourseModal || onAddCourse || (() => {});
  
  const handleEditCourse = (course, idx, sIdx) => {
    if (onOpenEditCourseModal) onOpenEditCourseModal(course, idx, sIdx ?? currentSemIdx);
    else if (onEditCourse) onEditCourse(sIdx ?? currentSemIdx, idx, course);
  };

  const handleDelete = (idx, sIdx, course) => {
    if (onDeleteCourse) onDeleteCourse(idx, sIdx ?? currentSemIdx, course);
  };

  const handleUpdateStatus = (idx, newStatus, sIdx) => {
    if (onToggleCourseStatus) onToggleCourseStatus(idx, newStatus, sIdx ?? currentSemIdx);
    else if (onUpdateCourseStatus) onUpdateCourseStatus(sIdx ?? currentSemIdx, idx, newStatus);
  };

  const handleToggleInclude = (idx, isIncluded, sIdx) => {
    if (onToggleCourseInRoutine) onToggleCourseInRoutine(idx, isIncluded, sIdx ?? currentSemIdx);
    else if (onToggleIncludeCourse) onToggleIncludeCourse(sIdx ?? currentSemIdx, idx, isIncluded);
  };

  const handleTeacherModal = (course, idx, sIdx) => {
    if (onOpenTeacherModal) {
      // Pass both formats: (cIdx, course) and (course, idx, sIdx)
      onOpenTeacherModal(course, idx, sIdx ?? currentSemIdx);
    }
  };

  const handleCopySemester = onOpenCopySemesterModal || (() => {});
  const handleAddSemester = onAddSemesterModalOpen || (() => {});

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'COMPLETED', 'ARCHIVED'

  // Filter courses
  const filteredCourses = courses.filter(c => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || c.courseCode?.toLowerCase().includes(q) || c.courseTitle?.toLowerCase().includes(q);
    const courseStatus = c.lifecycle_status || c.status || 'ACTIVE';
    const matchesStatus = statusFilter === 'ALL' || courseStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
      overflow: 'hidden'
    }}>
      {/* Top Semester Switcher Bar */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #f1f5f9',
        background: '#fafbfc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Select Semester:
          </span>
          {semesters.map((sem, idx) => {
            const isSelected = currentSemIdx === idx;
            return (
              <button
                key={`sem-tab-${sem.semesterId || idx}`}
                type="button"
                onClick={() => handleSelectSem(idx)}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  color: isSelected ? '#1d4ed8' : '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s'
                }}
              >
                <Layers size={14} />
                <span>{sem.shortTerm || sem.termCode}</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>({sem.courses?.length || 0})</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleAddSemester}
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              color: '#4f46e5',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Plus size={14} /> Add Semester
          </button>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={handleCopySemester}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <Copy size={14} /> Copy from Previous
          </button>

          <button
            type="button"
            onClick={handleAddCourse}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Plus size={14} /> Add New Course
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        padding: '0.85rem 1.5rem',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.4rem 0.75rem',
          background: '#ffffff',
          width: '280px'
        }}>
          <Search size={14} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '0.82rem'
            }}
          />
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, marginRight: '0.2rem' }}>
            Filter Status:
          </span>
          {['ALL', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#1e293b' : '#f1f5f9',
                color: statusFilter === st ? '#ffffff' : '#475569',
                border: 'none',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Course Roster Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '0.85rem 1.25rem' }}>Course Code & Title</th>
              <th style={{ padding: '0.85rem 1rem' }}>Type & Credits</th>
              <th style={{ padding: '0.85rem 1rem' }}>Weekly Class Load</th>
              <th style={{ padding: '0.85rem 1rem' }}>Assigned Teacher</th>
              <th style={{ padding: '0.85rem 1rem' }}>Routine Inclusion</th>
              <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {semesters.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
                  <div style={{ maxWidth: '420px', margin: '0 auto' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.85rem' }}>
                      <Layers size={24} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                      No Semesters in Routine
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
                      Add an academic semester session to automatically populate courses, assign teachers, and start building the timetable.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddSemester}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.6rem 1.25rem',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                      }}
                    >
                      <Plus size={16} /> Add Semester Session
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredCourses.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  No courses found in this semester matching your filter.
                </td>
              </tr>
            ) : (
              filteredCourses.map((course, idx) => {
                const isLab = course.courseType === 'Sessional' || course.courseType === 'Lab' ||
                  (course.courseTitle && course.courseTitle.toLowerCase().includes('sessional')) ||
                  (course.courseTitle && course.courseTitle.toLowerCase().includes('lab'));
                const reqHours = Number(course.weeklyHours) || (isLab ? Math.round(Number(course.creditHours || 3) * 2) : Math.round(Number(course.creditHours || 3)));
                
                // Calculate filled (scheduled) hours from currentSchedule for both department & non-department courses
                const cid = course.courseId || course.id;
                const semSlots = (currentSchedule || []).filter(s => {
                  const matchCourse = 
                    (s.courseId && (s.courseId === cid || s.courseId === course.id || s.courseId === course.courseId)) ||
                    (s.courseCode && course.courseCode && s.courseCode.trim().toUpperCase() === course.courseCode.trim().toUpperCase());
                  const matchSem = !s.semesterId || !activeSemester?.semesterId || s.semesterId === activeSemester?.semesterId;
                  return matchCourse && matchSem;
                });
                const schedHours = semSlots.reduce((acc, s) => acc + (Number(s.span) || 1), 0);
                const remainingHours = Math.max(0, reqHours - schedHours);
                const teacherAssigned = course.teacher && course.teacher.teacherName && course.teacher.teacherName !== 'Not Assigned';
                const status = course.status || 'ACTIVE';

                return (
                  <tr 
                    key={`course-row-${course.courseCode}-${idx}`}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: status === 'ARCHIVED' ? '#fcfcfd' : '#ffffff',
                      opacity: status === 'ARCHIVED' ? 0.65 : 1
                    }}
                  >
                    {/* Course Code & Title */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontWeight: 800,
                          color: '#0f172a',
                          fontSize: '0.9rem'
                        }}>
                          {course.courseCode}
                        </span>
                        {course.isOptional && (
                          <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                            Elective
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                        {course.courseTitle}
                      </div>
                    </td>

                    {/* Type & Credits */}
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        background: isLab ? '#ecfdf5' : '#eff6ff',
                        color: isLab ? '#065f46' : '#1e40af',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px'
                      }}>
                        {isLab ? 'Sessional / Lab' : 'Theory'} • {course.creditHours} cr
                      </span>
                    </td>

                    {/* Weekly Class Load */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                        <Clock size={13} style={{ color: '#64748b' }} />
                        <span><strong>{reqHours} hrs</strong> / week</span>
                      </div>
                      <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: schedHours >= reqHours ? '#059669' : '#2563eb',
                          background: schedHours >= reqHours ? '#ecfdf5' : '#eff6ff',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          Filled: {schedHours}h
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: remainingHours === 0 ? '#059669' : '#d97706',
                          background: remainingHours === 0 ? '#ecfdf5' : '#fffbeb',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {remainingHours === 0 ? '✓ Complete' : `${remainingHours}h remaining`}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Teacher */}
                    <td style={{ padding: '1rem' }}>
                      {teacherAssigned ? (
                        <div 
                          onClick={() => handleTeacherModal(course, idx, currentSemIdx)}
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, color: '#1e293b', fontSize: '0.82rem' }}>
                            <span style={{
                              background: '#e0e7ff',
                              color: '#3730a3',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontSize: '0.68rem'
                            }}>
                              {course.teacher.shortCode || 'CSE'}
                            </span>
                            <span>{course.teacher.teacherName}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {course.teacher.designation || course.teacher.department}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTeacherModal(course, idx, currentSemIdx)}
                          style={{
                            background: '#fffbeb',
                            border: '1px dashed #f59e0b',
                            color: '#b45309',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Users size={12} /> Assign Teacher
                        </button>
                      )}
                    </td>

                    {/* Routine Inclusion Toggle */}
                    <td style={{ padding: '1rem' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={course.isIncluded !== false && (course.inRoutine !== false) && status === 'ACTIVE'}
                          disabled={status === 'ARCHIVED' || status === 'COMPLETED'}
                          onChange={(e) => handleToggleInclude(idx, e.target.checked, currentSemIdx)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: course.isIncluded !== false && (course.inRoutine !== false) ? '#0f172a' : '#94a3b8' }}>
                          {course.isIncluded !== false && (course.inRoutine !== false) && status === 'ACTIVE' ? 'In Routine' : 'Excluded'}
                        </span>
                      </label>
                    </td>

                    {/* Status Dropdown */}
                    <td style={{ padding: '1rem' }}>
                      <select
                        value={status}
                        onChange={(e) => handleUpdateStatus(idx, e.target.value, currentSemIdx)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          border: '1px solid #cbd5e1',
                          background: status === 'ACTIVE' ? '#ecfdf5' : status === 'COMPLETED' ? '#eff6ff' : '#f1f5f9',
                          color: status === 'ACTIVE' ? '#065f46' : status === 'COMPLETED' ? '#1e40af' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleEditCourse(course, idx, currentSemIdx)}
                          title="Edit Course Code / Title / Credits"
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '0.35rem',
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(idx, currentSemIdx, course)}
                          title="Archive or Remove Course"
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '0.35rem',
                            color: '#b91c1c',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
