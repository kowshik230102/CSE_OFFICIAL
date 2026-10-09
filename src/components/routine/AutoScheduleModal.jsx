import React, { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  Users,
  Grid,
  Check,
  RefreshCw,
  Lock,
  ChevronRight
} from 'lucide-react';

export function AutoScheduleModal({
  isOpen,
  onClose,
  semesters: propSemesters,
  currentSchedule: propSchedule,
  activeRoutine,
  onApplyGeneratedSchedule,
  onApplySchedule
}) {
  if (!isOpen) return null;

  const semesters = propSemesters?.length ? propSemesters : (activeRoutine?.semesters || []);
  const currentSchedule = propSchedule?.length ? propSchedule : (activeRoutine?.schedule || []);
  const handleApply = onApplyGeneratedSchedule || onApplySchedule || (() => {});

  // Options
  const [labHoursRatio, setLabHoursRatio] = useState(2.0); // 1.5 cr lab = 3 hours
  const [preserveUnlocked, setPreserveUnlocked] = useState(false); // keep existing unlocked or generate clean
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [error, setError] = useState(null);

  // Trigger preview generation
  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('cse_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch('/api/routines/auto-generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          semesters,
          existingSlots: currentSchedule,
          options: {
            labHoursRatio,
            preserveUnlocked
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to auto-generate routine.');

      setPreviewResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAndApply = () => {
    if (!previewResult || !previewResult.schedule) return;
    handleApply(previewResult.schedule, previewResult.stats);
    onClose();
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
      zIndex: 1050,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #09101d 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
              <Sparkles size={14} /> Intelligent Scheduler Engine
            </div>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#ffffff' }}>
              Smart Timetable Generator
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              Automates slot placement for all active courses based on credits, room types, and teacher schedules.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.35rem',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#b91c1c',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Engine Parameters Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.25rem',
            marginBottom: '1.25rem'
          }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
              1. Scheduling Rules & Preferences
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {/* Rule 1: Lab Hours Ratio */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Laboratory Contact Hours Ratio
                </label>
                <select
                  value={labHoursRatio}
                  onChange={(e) => setLabHoursRatio(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#ffffff'
                  }}
                >
                  <option value={2.0}>1.5 Credits Lab = 3.0 Hours Contact Block (Standard)</option>
                  <option value={1.5}>1.5 Credits Lab = 2.0 Hours Block</option>
                  <option value={1.0}>1 Credit = 1 Hour Contact</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Theory courses strictly follow 1 Credit = 1 Hour per week rule.
                </div>
              </div>

              {/* Rule 2: Preserve Locked Slots */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Existing Timetable Handling
                </label>
                <select
                  value={preserveUnlocked ? 'preserve' : 'replace'}
                  onChange={(e) => setPreserveUnlocked(e.target.value === 'preserve')}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#ffffff'
                  }}
                >
                  <option value="replace">Preserve Locked Slots Only (Regenerate Remaining)</option>
                  <option value="preserve">Keep All Existing Slots (Fill Unscheduled Hours Only)</option>
                </select>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Slots with <strong>Lock icon</strong> are permanently protected from being moved.
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={isGenerating}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    Calculating Non-Conflicting Schedule...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Generate Schedule Preview
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview Results Display */}
          {previewResult && (
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '14px',
              padding: '1.25rem',
              animation: 'fadeIn 0.25s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#1e3a8a' }}>
                  2. Generated Timetable Preview & Metrics
                </h4>

                <span style={{
                  background: previewResult.conflicts.length === 0 ? '#ecfdf5' : '#fef2f2',
                  color: previewResult.conflicts.length === 0 ? '#059669' : '#dc2626',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  {previewResult.conflicts.length === 0 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {previewResult.conflicts.length === 0 ? '0 Conflicts (Clean Schedule)' : `${previewResult.conflicts.length} Conflict(s)`}
                </span>
              </div>

              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Required Hours</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{previewResult.stats.totalRequiredHours}h</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>Scheduled Hours</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#047857' }}>{previewResult.stats.totalScheduledHours}h</div>
                </div>
                <div style={{ background: previewResult.stats.unscheduledHours === 0 ? '#f8fafc' : '#fffbeb', padding: '0.75rem', borderRadius: '8px', border: previewResult.stats.unscheduledHours === 0 ? '1px solid #e2e8f0' : '1px solid #fde68a', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: previewResult.stats.unscheduledHours === 0 ? '#64748b' : '#b45309', fontWeight: 700 }}>Unscheduled Hours</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: previewResult.stats.unscheduledHours === 0 ? '#0f172a' : '#d97706' }}>{previewResult.stats.unscheduledHours}h</div>
                </div>
                <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', fontWeight: 700 }}>Total Class Slots</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1d4ed8' }}>{previewResult.schedule.length}</div>
                </div>
              </div>

              {/* Warnings List if any */}
              {previewResult.warnings.length > 0 && (
                <div style={{ marginBottom: '1rem', background: '#fffbeb', borderRadius: '8px', padding: '0.75rem', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#92400e', marginBottom: '0.25rem' }}>
                    Scheduling Warnings / Missing Information:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.74rem', color: '#b45309', lineHeight: 1.5 }}>
                    {previewResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sample Placed Slots Table */}
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '0.45rem 0.65rem' }}>Day & Period</th>
                      <th style={{ padding: '0.45rem 0.65rem' }}>Semester</th>
                      <th style={{ padding: '0.45rem 0.65rem' }}>Course</th>
                      <th style={{ padding: '0.45rem 0.65rem' }}>Teacher</th>
                      <th style={{ padding: '0.45rem 0.65rem' }}>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.schedule.map((slot, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.4rem 0.65rem', fontWeight: 700 }}>
                          {slot.day} • {slot.periodId.toUpperCase()} ({slot.span}h)
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem' }}>{slot.termCode || slot.semesterName}</td>
                        <td style={{ padding: '0.4rem 0.65rem', fontWeight: 800, color: '#0f172a' }}>{slot.courseCode}</td>
                        <td style={{ padding: '0.4rem 0.65rem' }}>{slot.teacherShortCode || slot.teacherName}</td>
                        <td style={{ padding: '0.4rem 0.65rem', color: '#2563eb', fontWeight: 700 }}>{slot.room}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.15rem 1.75rem',
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

          {previewResult && (
            <button
              type="button"
              onClick={handleConfirmAndApply}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.6rem 1.35rem',
                borderRadius: '10px',
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Check size={16} />
              Approve & Apply to Timetable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
