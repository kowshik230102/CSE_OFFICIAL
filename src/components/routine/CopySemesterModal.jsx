import React, { useState } from 'react';
import { Copy, X, Check, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * CopySemesterModal:
 * Allows copying courses, teacher assignments, and timetable slots
 * from an existing semester/session template into the current semester.
 */
export function CopySemesterModal({
  isOpen,
  onClose,
  onConfirmCopy,
  currentSemester,
  availableSemesters = [],
  isCopying = false
}) {
  const [sourceSemesterId, setSourceSemesterId] = useState('');
  const [includeTeachers, setIncludeTeachers] = useState(true);
  const [includeTimetable, setIncludeTimetable] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !currentSemester) return null;

  // Filter out the current semester itself from source options
  const eligibleSources = availableSemesters.filter(s => s.semesterId !== currentSemester.semesterId);

  const handleCopy = () => {
    if (!sourceSemesterId) {
      setError('Please select a source semester to copy from.');
      return;
    }

    const sourceSem = availableSemesters.find(s => s.semesterId === sourceSemesterId);
    if (!sourceSem) {
      setError('Selected semester not found.');
      return;
    }

    onConfirmCopy({
      sourceSemesterId,
      sourceSemesterName: sourceSem.semesterName,
      includeTeachers,
      includeTimetable
    });
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
          maxWidth: '560px',
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
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Copy size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Copy Previous Semester Configuration
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Target: {currentSemester.semesterName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isCopying}
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

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
              Select Source Semester to Copy From *
            </label>
            <select
              value={sourceSemesterId}
              onChange={(e) => {
                setSourceSemesterId(e.target.value);
                setError('');
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            >
              <option value="">-- Choose a Semester / Session --</option>
              {eligibleSources.map(s => (
                <option key={s.semesterId} value={s.semesterId}>
                  {s.semesterName} ({s.courses?.length || 0} courses)
                </option>
              ))}
            </select>
          </div>

          {/* Options checkboxes */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
              Configuration Options
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeTeachers}
                onChange={(e) => setIncludeTeachers(e.target.checked)}
                style={{ marginTop: '0.2rem', width: '16px', height: '16px' }}
              />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Reuse Teacher Assignments
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Preserve faculty assignments for matching courses.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeTimetable}
                onChange={(e) => setIncludeTimetable(e.target.checked)}
                style={{ marginTop: '0.2rem', width: '16px', height: '16px' }}
              />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Copy Previous Timetable Slots
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Load previous day/period slots as a draft starting template.
                </div>
              </div>
            </label>
          </div>

          <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Safe Operation:</strong> Copying creates new course records for this semester and will not overwrite other semesters.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div 
          style={{
            padding: '1.25rem 1.5rem',
            background: '#fafbfc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isCopying}
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
            type="button"
            onClick={handleCopy}
            disabled={isCopying}
            style={{
              padding: '0.55rem 1.35rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: isCopying ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
            }}
          >
            <Copy size={16} /> {isCopying ? 'Copying...' : 'Copy Configuration'}
          </button>
        </div>

      </div>
    </div>
  );
}
