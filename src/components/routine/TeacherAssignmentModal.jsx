import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  Check,
  Building2,
  Phone,
  Briefcase,
  AlertCircle,
  Sparkles,
  UserCheck,
  ExternalLink
} from 'lucide-react';

export function TeacherAssignmentModal({
  isOpen,
  onClose,
  targetCourse,
  course,
  targetSemester,
  semester,
  deptTeachers = [],
  nonDeptTeachers = [],
  initialTeacher,
  onSaveAssignment,
  onSaveTeacherAssignment
}) {
  const currentCourse = targetCourse || course;
  if (!isOpen || !currentCourse) return null;

  const currentTeacher = initialTeacher || currentCourse.teacher || { type: 'none', teacherName: 'Not Assigned' };

  // Tab: 'DEPARTMENT' or 'NON_DEPARTMENT'
  const [activeTab, setActiveTab] = useState(
    currentTeacher.type === 'non_department' ? 'NON_DEPARTMENT' : 'DEPARTMENT'
  );

  // Department Teacher Search
  const [deptSearch, setDeptSearch] = useState('');
  const [selectedDeptTeacherId, setSelectedDeptTeacherId] = useState(
    currentTeacher.type === 'department' ? currentTeacher.teacherId : null
  );

  // Non-Department Teacher Fields
  const [nonDeptForm, setNonDeptForm] = useState({
    name: currentTeacher.type === 'non_department' ? currentTeacher.teacherName : '',
    department: currentTeacher.type === 'non_department' ? (currentTeacher.department || 'EEE') : '',
    phoneNumber: currentTeacher.type === 'non_department' ? (currentTeacher.phoneNumber || currentTeacher.departmentNumber || '') : '',
    designation: currentTeacher.type === 'non_department' ? (currentTeacher.designation || 'Faculty Member') : 'Assistant Professor'
  });

  const [formError, setFormError] = useState(null);

  // Filter department teachers
  const filteredDeptTeachers = deptTeachers.filter(t => {
    const q = deptSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      t.fullName?.toLowerCase().includes(q) ||
      t.designation?.toLowerCase().includes(q) ||
      t.shortCode?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q)
    );
  });

  // Handle department teacher selection
  const handleSelectDept = (teacher) => {
    setSelectedDeptTeacherId(teacher.teacherId);
  };

  // Quick select an existing non-dept teacher from auto-suggestions
  const handleSelectExistingNonDept = (ndt) => {
    setNonDeptForm({
      name: ndt.name,
      department: ndt.department,
      phoneNumber: ndt.phone_number || '',
      designation: ndt.designation || 'Faculty Member'
    });
  };

  const handleSave = () => {
    setFormError(null);
    const saveFunc = onSaveAssignment || onSaveTeacherAssignment || (() => {});

    if (activeTab === 'DEPARTMENT') {
      if (!selectedDeptTeacherId) {
        setFormError('Please select a Department Faculty Teacher from the list.');
        return;
      }
      const teacherObj = deptTeachers.find(t => t.teacherId === selectedDeptTeacherId);
      if (!teacherObj) {
        setFormError('Selected teacher profile not found.');
        return;
      }

      const teacherPayload = {
        type: 'department',
        teacherId: teacherObj.teacherId,
        teacherName: teacherObj.fullName,
        designation: teacherObj.designation,
        department: teacherObj.department || 'CSE',
        departmentNumber: teacherObj.roomNumber || '',
        phoneNumber: teacherObj.phoneNumber || '',
        shortCode: teacherObj.shortCode
      };

      saveFunc({
        ...teacherPayload,
        course: currentCourse,
        teacher: teacherPayload,
        mode: 'department'
      });
      onClose();
    } else {
      // Non-Department Teacher
      if (!nonDeptForm.name.trim()) {
        setFormError('Teacher Name is required.');
        return;
      }
      if (!nonDeptForm.department.trim()) {
        setFormError('Department name is required (e.g. EEE, Mathematics, Physics).');
        return;
      }
      if (nonDeptForm.phoneNumber.trim() && !/^[+0-9\s-]{6,20}$/.test(nonDeptForm.phoneNumber.trim())) {
        setFormError('Please enter a valid phone number.');
        return;
      }

      // Generate clean shortCode from department or initials
      const cleanDept = nonDeptForm.department.trim().toUpperCase();
      const initials = nonDeptForm.name.split(/\s+/).map(p => p[0]?.toUpperCase()).join('').slice(0, 3);
      const shortCode = cleanDept || initials || 'EXT';

      const teacherPayload = {
        type: 'non_department',
        teacherId: null,
        teacherName: nonDeptForm.name.trim(),
        designation: nonDeptForm.designation.trim() || 'External Faculty',
        department: nonDeptForm.department.trim(),
        departmentNumber: nonDeptForm.phoneNumber.trim(),
        phoneNumber: nonDeptForm.phoneNumber.trim(),
        shortCode
      };

      saveFunc({
        ...teacherPayload,
        course: currentCourse,
        teacher: teacherPayload,
        mode: 'non_department'
      });
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>
              Course Teacher Assignment
            </div>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              {targetCourse.courseCode}: {targetCourse.courseTitle}
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
              Semester: {targetSemester?.shortTerm || targetSemester?.semesterName} • {targetCourse.creditHours} Credits ({targetCourse.courseType || 'Theory'})
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.35rem',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher: Department Teacher vs Non-Department Teacher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('DEPARTMENT'); setFormError(null); }}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              border: 'none',
              background: activeTab === 'DEPARTMENT' ? '#ffffff' : '#f8fafc',
              borderBottom: activeTab === 'DEPARTMENT' ? '2.5px solid #2563eb' : 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              color: activeTab === 'DEPARTMENT' ? '#2563eb' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Users size={16} />
            Department Teacher (PUST CSE)
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('NON_DEPARTMENT'); setFormError(null); }}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              border: 'none',
              background: activeTab === 'NON_DEPARTMENT' ? '#ffffff' : '#f8fafc',
              borderBottom: activeTab === 'NON_DEPARTMENT' ? '2.5px solid #2563eb' : 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              color: activeTab === 'NON_DEPARTMENT' ? '#2563eb' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Building2 size={16} />
            Non-Department Teacher (External)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {formError && (
            <div style={{
              background: '#fee2e2',
              color: '#b91c1c',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <AlertCircle size={16} />
              {formError}
            </div>
          )}

          {activeTab === 'DEPARTMENT' ? (
            <div>
              {/* Search Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0.55rem 0.85rem',
                marginBottom: '1rem',
                background: '#ffffff'
              }}>
                <Search size={16} style={{ color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search faculty by name, designation, or code..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Teacher Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                {filteredDeptTeachers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                    No matching department teachers found.
                  </div>
                ) : (
                  filteredDeptTeachers.map(teacher => {
                    const isSelected = selectedDeptTeacherId === teacher.teacherId;
                    return (
                      <div
                        key={teacher.teacherId}
                        onClick={() => handleSelectDept(teacher)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 0.95rem',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: isSelected ? '#2563eb' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.78rem'
                          }}>
                            {teacher.shortCode || teacher.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                              {teacher.fullName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              {teacher.designation} • Dept. of {teacher.department || 'CSE'}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '22px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Auto-suggest previous non-department teachers */}
              {nonDeptTeachers.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>
                    Quick Suggestion from Registered External Teachers:
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {nonDeptTeachers.slice(0, 4).map(ndt => (
                      <button
                        key={ndt.id}
                        type="button"
                        onClick={() => handleSelectExistingNonDept(ndt)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        {ndt.name} ({ndt.department})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Fields for Non-Department Teacher */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Teacher Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Md. Ashraful Islam"
                    value={nonDeptForm.name}
                    onChange={(e) => setNonDeptForm({ ...nonDeptForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Department Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EEE, Mathematics"
                      value={nonDeptForm.department}
                      onChange={(e) => setNonDeptForm({ ...nonDeptForm, department: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                      Designation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Assistant Professor"
                      value={nonDeptForm.designation}
                      onChange={(e) => setNonDeptForm({ ...nonDeptForm, designation: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    Contact Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +8801700000000"
                    value={nonDeptForm.phoneNumber}
                    onChange={(e) => setNonDeptForm({ ...nonDeptForm, phoneNumber: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
            }}
          >
            <UserCheck size={16} />
            Assign Teacher & Sync Profile
          </button>
        </div>
      </div>
    </div>
  );
}
