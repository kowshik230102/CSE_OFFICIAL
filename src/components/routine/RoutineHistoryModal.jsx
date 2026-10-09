import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Calendar,
  Clock,
  User,
  RotateCcw,
  Eye,
  Download,
  Printer,
  ChevronRight,
  ArrowRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { exportOfficialRoutineToWord } from '../../utils/routineExport';

export function RoutineHistoryModal({
  isOpen,
  onClose,
  routineId,
  routineTitle,
  onRestoreVersion
}) {
  if (!isOpen) return null;

  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comparingVersions, setComparingVersions] = useState(null); // { vA, vB }
  const [restoringId, setRestoringId] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchVersions();
  }, [routineId]);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('cse_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`/api/routines/${routineId}/versions`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load routine history.');

      setVersions(data.versions || []);
      if (data.versions && data.versions.length > 0) {
        // Load details of the latest version by default
        loadVersionDetail(data.versions[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionDetail = async (versionId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('cse_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`/api/routines/${routineId}/versions/${versionId}`, { headers });
      const data = await res.json();
      if (data.version) {
        setSelectedVersion(data.version);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async (version) => {
    if (!window.confirm(`Are you sure you want to restore timetable to version ${version.versionNumber}? This will create a new audit version preserving all history.`)) {
      return;
    }

    setRestoringId(version.id);
    setError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('cse_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`/api/routines/${routineId}/restore-version/${version.id}`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore version.');

      setSuccessMessage(data.message || 'Routine restored successfully!');
      if (onRestoreVersion) {
        onRestoreVersion(data.restoredData);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  };

  const handleExportHistoricalWord = (version) => {
    if (!version || !version.routineSnapshot) return;
    const snap = version.routineSnapshot;
    exportOfficialRoutineToWord({
      routine: {
        title: `${version.title} (${version.versionNumber})`,
        academicYear: version.academicYear || snap.academicYear,
        effectiveFrom: version.effectiveFrom || snap.effectiveFrom,
        department: version.department || 'CSE',
        semesters: snap.semesters || [],
        schedule: snap.schedule || []
      }
    });
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
        maxWidth: '880px',
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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a5b4fc', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
              <History size={14} /> Routine Audit Trail
            </div>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#ffffff' }}>
              Routine Version History & Comparison
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#c7d2fe', marginTop: '0.15rem' }}>
              Every published version is preserved. Restore previous configurations safely without losing history.
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
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left Column: Version History List */}
          <div style={{
            borderRight: '1px solid #e2e8f0',
            background: '#fafbfc',
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Preserved Versions ({versions.length})
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Loading routine history...
              </div>
            ) : versions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No historical versions recorded yet. Versions are automatically generated when routine is published or saved.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {versions.map(v => {
                  const isSelected = selectedVersion?.id === v.id;
                  const dateStr = new Date(v.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={v.id}
                      onClick={() => loadVersionDetail(v.id)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        background: isSelected ? '#ffffff' : '#ffffff',
                        boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.15)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{
                          fontWeight: 900,
                          fontSize: '0.85rem',
                          color: isSelected ? '#4338ca' : '#0f172a'
                        }}>
                          {v.versionNumber}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {dateStr}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.35, marginBottom: '0.4rem' }}>
                        {v.changeSummary || 'Routine snapshot'}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <User size={12} />
                        {v.creatorName || 'Authority Member'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Version Snapshot & Actions */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{
                background: '#fee2e2',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700
              }}>
                {error}
              </div>
            )}

            {successMessage && (
              <div style={{
                background: '#ecfdf5',
                color: '#065f46',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} />
                {successMessage}
              </div>
            )}

            {selectedVersion ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        background: '#e0e7ff',
                        color: '#3730a3',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px'
                      }}>
                        {selectedVersion.versionNumber}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        {selectedVersion.title}
                      </h4>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Recorded on {new Date(selectedVersion.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} by {selectedVersion.creatorName || 'Authority'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleExportHistoricalWord(selectedVersion)}
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
                      <Download size={14} /> Export Word
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRestore(selectedVersion)}
                      disabled={restoringId === selectedVersion.id}
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: restoringId === selectedVersion.id ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                      }}
                    >
                      <RotateCcw size={14} className={restoringId === selectedVersion.id ? 'spin' : ''} />
                      Restore Version
                    </button>
                  </div>
                </div>

                {/* Change Summary Box */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>
                    Change Summary Description:
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>
                    {selectedVersion.changeSummary || 'Official routine publication snapshot.'}
                  </div>
                </div>

                {/* Structured Changes Breakdown if available */}
                {selectedVersion.changesData && (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '0.5rem' }}>
                      Detailed Audit Changes Breakdown:
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {/* Courses Added */}
                      {Array.isArray(selectedVersion.changesData.coursesAdded) && selectedVersion.changesData.coursesAdded.length > 0 && (
                        <div style={{ background: '#ecfdf5', padding: '0.65rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#065f46' }}>Courses Added ({selectedVersion.changesData.coursesAdded.length})</div>
                          <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '0.2rem' }}>
                            {selectedVersion.changesData.coursesAdded.join(', ')}
                          </div>
                        </div>
                      )}

                      {/* Courses Removed */}
                      {Array.isArray(selectedVersion.changesData.coursesRemoved) && selectedVersion.changesData.coursesRemoved.length > 0 && (
                        <div style={{ background: '#fee2e2', padding: '0.65rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#991b1b' }}>Courses Archived ({selectedVersion.changesData.coursesRemoved.length})</div>
                          <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.2rem' }}>
                            {selectedVersion.changesData.coursesRemoved.join(', ')}
                          </div>
                        </div>
                      )}

                      {/* Teachers Changed */}
                      {Array.isArray(selectedVersion.changesData.teachersChanged) && selectedVersion.changesData.teachersChanged.length > 0 && (
                        <div style={{ background: '#eff6ff', padding: '0.65rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af' }}>Teacher Assignments Changed</div>
                          <div style={{ fontSize: '0.72rem', color: '#1d4ed8', marginTop: '0.2rem' }}>
                            {selectedVersion.changesData.teachersChanged.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timetable Slots in this Snapshot */}
                {selectedVersion.routineSnapshot && Array.isArray(selectedVersion.routineSnapshot.schedule) && (
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '0.5rem' }}>
                      Timetable Snapshot ({selectedVersion.routineSnapshot.schedule.length} class slots):
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Day & Slot</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Sem.</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Course</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Teacher</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Room</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVersion.routineSnapshot.schedule.map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.4rem 0.65rem', fontWeight: 700 }}>
                                {s.day} • {s.periodId.toUpperCase()} ({s.span}h)
                              </td>
                              <td style={{ padding: '0.4rem 0.65rem' }}>{s.termCode || s.semesterName}</td>
                              <td style={{ padding: '0.4rem 0.65rem', fontWeight: 800, color: '#0f172a' }}>{s.courseCode}</td>
                              <td style={{ padding: '0.4rem 0.65rem' }}>{s.teacherShortCode || s.teacherName}</td>
                              <td style={{ padding: '0.4rem 0.65rem', color: '#2563eb', fontWeight: 700 }}>{s.room}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                Select a version from the left panel to inspect snapshot details.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}
