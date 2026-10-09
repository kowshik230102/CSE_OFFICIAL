import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, X, FileText, Send, Clock, Layers, Users } from 'lucide-react';
import { diffRoutines } from '../../utils/scheduleConfig';

/**
 * PublishSummaryModal:
 * Displays a clear change summary before an updated routine is published.
 * Highlights:
 * - Added courses, removed courses
 * - Teacher assignment updates
 * - Rescheduled periods
 * - Detected conflicts & unscheduled hours warnings
 * - Release note / audit description input
 */
export function PublishSummaryModal({
  isOpen,
  onClose,
  onConfirmPublish,
  currentRoutine,
  originalRoutine,
  isPublishing
}) {
  const [publishNote, setPublishNote] = useState('');

  if (!isOpen || !currentRoutine) return null;

  // Compute structured diff between original published routine and current working draft
  const diff = diffRoutines(originalRoutine, currentRoutine);

  const totalAddedCourses = diff.coursesDiff?.added?.length || 0;
  const totalRemovedCourses = diff.coursesDiff?.removed?.length || 0;
  const totalTeacherChanges = diff.teacherDiff?.length || 0;
  const totalScheduleChanges = diff.scheduleDiff?.added?.length + diff.scheduleDiff?.removed?.length || 0;

  const handlePublish = () => {
    onConfirmPublish({
      note: publishNote.trim() || 'Published updated class routine version.',
      diff
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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          animation: 'fadeInUp 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1.5rem 1.75rem',
            background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
              }}
            >
              <Send size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Review & Publish Routine
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                Summary of changes before publishing Version {((currentRoutine.version_number || 1) + 1)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '10px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Target Routine Info */}
          <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 800 }}>
                Routine Title
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
                {currentRoutine.title}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.78rem', fontWeight: 800 }}>
                ● Active Schedule
              </span>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                {currentRoutine.academicYear} • CSE
              </div>
            </div>
          </div>

          {/* Change Summary Stats */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} color="#6366f1" /> Detected Changes Summary
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div style={{ padding: '0.85rem', background: '#eff6ff', borderRadius: '10px', border: '1px solid #dbeafe', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>+{totalAddedCourses}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', marginTop: '0.15rem' }}>Courses Added</div>
              </div>

              <div style={{ padding: '0.85rem', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fee2e2', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b91c1c' }}>-{totalRemovedCourses}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', marginTop: '0.15rem' }}>Courses Removed</div>
              </div>

              <div style={{ padding: '0.85rem', background: '#faf5ff', borderRadius: '10px', border: '1px solid #f3e8ff', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7e22ce' }}>{totalTeacherChanges}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a855f7', marginTop: '0.15rem' }}>Teachers Changed</div>
              </div>

              <div style={{ padding: '0.85rem', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #dcfce7', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>{totalScheduleChanges}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22c55e', marginTop: '0.15rem' }}>Slots Altered</div>
              </div>
            </div>
          </div>

          {/* Change Details Checklist */}
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.65rem' }}>
              What happens upon publishing:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>
                <strong>Teacher Profiles Synchronized:</strong> Active course assignments will update immediately on each assigned teacher's faculty profile.
              </li>
              <li>
                <strong>Version Snapshot Saved:</strong> The previous version is archived in Routine History with full rollback capability.
              </li>
              <li>
                <strong>Notice Board Updated:</strong> The published schedule is updated across student and teacher dashboards.
              </li>
            </ul>
          </div>

          {/* Release / Audit Note */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
              Publish Description / Release Note <span style={{ color: '#64748b', fontWeight: 500 }}>(Optional)</span>
            </label>
            <input
              type="text"
              value={publishNote}
              onChange={(e) => setPublishNote(e.target.value)}
              placeholder="e.g., Added Session 2026-2027 courses and assigned Room 501 for Theory classes"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

        </div>

        {/* Footer */}
        <div 
          style={{
            padding: '1.25rem 1.75rem',
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
            disabled={isPublishing}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            style={{
              padding: '0.65rem 1.5rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: isPublishing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
            }}
          >
            {isPublishing ? (
              <>Publishing Changes...</>
            ) : (
              <>
                <CheckCircle2 size={18} /> Confirm & Publish Version
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
