import React, { useState, useEffect } from 'react';
import { BookOpen, X, Check, AlertCircle, Sparkles } from 'lucide-react';
import { calculateWeeklyHours } from '../../utils/scheduleConfig';

/**
 * CourseFormModal:
 * Allows adding or editing a course for a semester.
 * Validates course code, credit hours, and calculates required weekly class hours in real time.
 */
export function CourseFormModal({
  isOpen,
  onClose,
  onSaveCourse,
  editingCourse = null,
  semesterName = ''
}) {
  const isEditing = Boolean(editingCourse);

  const [formData, setFormData] = useState({
    courseCode: '',
    courseTitle: '',
    creditHours: 3.0,
    courseType: 'Theory',
    isElective: false,
    description: ''
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (editingCourse) {
      setFormData({
        courseCode: editingCourse.courseCode || '',
        courseTitle: editingCourse.courseTitle || '',
        creditHours: Number(editingCourse.creditHours) || 3.0,
        courseType: editingCourse.courseType || (editingCourse.courseTitle?.toLowerCase().includes('sessional') ? 'Sessional' : 'Theory'),
        isElective: Boolean(editingCourse.isElective),
        description: editingCourse.description || ''
      });
    } else {
      setFormData({
        courseCode: '',
        courseTitle: '',
        creditHours: 3.0,
        courseType: 'Theory',
        isElective: false,
        description: ''
      });
    }
    setError('');
  }, [editingCourse, isOpen]);

  if (!isOpen) return null;

  // Real-time calculation of weekly hours based on credit and type
  const weeklyHours = calculateWeeklyHours({
    creditHours: formData.creditHours,
    courseType: formData.courseType,
    courseTitle: formData.courseTitle
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.courseCode.trim()) {
      setError('Please provide a course code (e.g., CSE 1101)');
      return;
    }
    if (!formData.courseTitle.trim()) {
      setError('Please provide a course title (e.g., Structured Programming Language)');
      return;
    }
    if (formData.creditHours <= 0) {
      setError('Credit hours must be greater than 0.');
      return;
    }

    const payload = {
      ...(editingCourse || {}),
      id: editingCourse?.id || 'crs-' + Math.random().toString(36).substring(2, 9),
      courseId: editingCourse?.courseId || editingCourse?.id || 'crs-' + Math.random().toString(36).substring(2, 9),
      courseCode: formData.courseCode.trim().toUpperCase(),
      courseTitle: formData.courseTitle.trim(),
      creditHours: Number(formData.creditHours),
      courseType: formData.courseType,
      isElective: formData.isElective,
      description: formData.description.trim(),
      lifecycle_status: editingCourse?.lifecycle_status || 'ACTIVE'
    };

    onSaveCourse(payload);
    onClose();
  };

  return (
    <div 
      className="modal-backdrop-custom"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
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
          maxWidth: '540px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          animation: 'fadeInUp 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                {isEditing ? 'Edit Semester Course' : 'Add Course to Semester'}
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                {semesterName ? `Target Semester: ${semesterName}` : 'CSE Academic Curriculum'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Course Code */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Course Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CSE 1101"
                value={formData.courseCode}
                onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Course Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Course Type *
              </label>
              <select
                value={formData.courseType}
                onChange={(e) => {
                  const newType = e.target.value;
                  const newCredit = newType === 'Sessional' ? 1.5 : (formData.creditHours === 1.5 ? 3.0 : formData.creditHours);
                  setFormData({ ...formData, courseType: newType, creditHours: newCredit });
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Theory">Theory Class</option>
                <option value="Sessional">Sessional / Laboratory</option>
              </select>
            </div>
          </div>

          {/* Course Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              Course Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Structured Programming Language"
              value={formData.courseTitle}
              onChange={(e) => setFormData({ ...formData, courseTitle: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
            {/* Credit Hours */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                Credit Hours *
              </label>
              <input
                type="number"
                step="0.25"
                min="0.5"
                max="6"
                required
                value={formData.creditHours}
                onChange={(e) => setFormData({ ...formData, creditHours: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Computed Weekly Class Hours Badge */}
            <div style={{ padding: '0.65rem 0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                Weekly Schedule Rule
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#15803d', marginTop: '0.15rem' }}>
                ⏱ {weeklyHours} Hours / Week
              </div>
            </div>
          </div>

          {/* Optional / Elective checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <input
              type="checkbox"
              id="isElectiveCheckbox"
              checked={formData.isElective}
              onChange={(e) => setFormData({ ...formData, isElective: e.target.checked })}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="isElectiveCheckbox" style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
              Elective / Optional Course
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
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
              style={{
                padding: '0.55rem 1.35rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
              }}
            >
              <Check size={16} /> {isEditing ? 'Save Changes' : 'Add Course'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
