import React from 'react';
import {
  CalendarCheck,
  BookOpen,
  Users,
  Clock,
  Sparkles,
  History,
  Grid,
  Edit3,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building2,
  RefreshCw
} from 'lucide-react';

export function ClassRoutineDashboard({
  activeRoutine,
  dashboardStats,
  loading,
  onOpenUpdateRoutine,
  onUpdateRoutine,
  onOpenViewRoutine,
  onViewRoutine,
  onOpenRoutineHistory,
  onRoutineHistory,
  onOpenManageCourses,
  onManageCourses,
  onOpenManageTeachers,
  onManageTeachers,
  onExportWord,
  onPrint,
  onRefresh,
  onCreateRoutine
}) {
  const handleUpdate = onOpenUpdateRoutine || onUpdateRoutine || (() => {});
  const handleView = onOpenViewRoutine || onViewRoutine || (() => {});
  const handleHistory = onOpenRoutineHistory || onRoutineHistory || (() => {});
  const handleCourses = onOpenManageCourses || onManageCourses || (() => {});
  const handleTeachers = onOpenManageTeachers || onManageTeachers || (() => {});

  const assignedTeacherCount = new Set(
    (activeRoutine?.semesters || []).flatMap(s => (s.courses || []))
      .filter(c => c.teacher && c.teacher.teacherName && c.teacher.teacherName !== 'Not Assigned')
      .map(c => c.teacher.teacherId || c.teacher.teacherName)
  ).size;

  const stats = dashboardStats || {
    department: activeRoutine?.department || 'CSE',
    academicYear: activeRoutine?.academicYear || 'Session 2026-2027',
    semestersCount: activeRoutine?.semesters?.length || 0,
    semesterNames: (activeRoutine?.semesters || []).map(s => s.shortTerm || s.termCode).join(', ') || 'All Semesters',
    totalActiveCourses: (activeRoutine?.semesters || []).reduce((acc, s) => acc + (s.courses?.length || 0), 0),
    totalAssignedTeachers: assignedTeacherCount,
    totalWeeklyClassHours: (activeRoutine?.schedule || []).reduce((acc, s) => acc + (s.span || 1), 0),
    lastUpdated: activeRoutine?.updatedAt || activeRoutine?.updated_at || new Date().toISOString()
  };

  const formattedDate = stats.lastUpdated
    ? new Date(stats.lastUpdated).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recently Updated';

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Active Routine Spotlight Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #09101d 0%, #0f172a 50%, #1e293b 100%)',
        borderRadius: '20px',
        padding: '1.75rem 2rem',
        color: '#ffffff',
        border: '1px solid #334155',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '1.5rem'
      }}>
        {/* Glowing Background Mesh Accent */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '280px',
          height: '280px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(59, 130, 246, 0.05) 70%, transparent 100%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          position: 'relative',
          zIndex: 2
        }}>
          {/* Left Hero Details */}
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '0.2rem 0.65rem',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <CheckCircle2 size={12} />
                CURRENT ACTIVE ROUTINE ({activeRoutine?.versionNumber || 'v1.0'})
              </span>
              <span style={{
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {stats.department || 'CSE'} Department
              </span>
            </div>

            <h2 style={{
              margin: '0 0 0.4rem 0',
              fontSize: '1.65rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#ffffff'
            }}>
              {activeRoutine?.title || 'Official Undergraduate Class Routine'}
            </h2>

            <div style={{
              fontSize: '0.85rem',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem',
              flexWrap: 'wrap',
              marginBottom: '1rem'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} style={{ color: '#60a5fa' }} />
                <strong>Session:</strong> {stats.academicYear}
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={14} style={{ color: '#818cf8' }} />
                <strong>Semesters:</strong> {stats.semesterNames || 'All Active Semesters'}
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} style={{ color: '#34d399' }} />
                <strong>Last Updated:</strong> {formattedDate}
              </span>
            </div>

            {/* Quick action buttons row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleUpdate}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.15s'
                }}
              >
                <Sparkles size={16} />
                Update Routine
              </button>

              <button
                type="button"
                onClick={handleView}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '0.65rem 1.15rem',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s'
                }}
              >
                <Grid size={16} style={{ color: '#38bdf8' }} />
                View Timetable
              </button>

              <button
                type="button"
                onClick={handleHistory}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '0.65rem 1.1rem',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s'
                }}
              >
                <History size={16} style={{ color: '#c084fc' }} />
                Routine History
              </button>
            </div>
          </div>

          {/* Right Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))',
            gap: '0.75rem',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '1rem',
            backdropFilter: 'blur(8px)'
          }}>
            {/* Metric 1: Total Courses */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              padding: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#93c5fd', fontSize: '0.74rem', fontWeight: 700 }}>
                <BookOpen size={14} /> Active Courses
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
                {stats.totalActiveCourses}
              </div>
            </div>

            {/* Metric 2: Assigned Teachers */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              padding: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a7f3d0', fontSize: '0.74rem', fontWeight: 700 }}>
                <Users size={14} /> Assigned Teachers
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
                {stats.totalAssignedTeachers || '11+'}
              </div>
            </div>

            {/* Metric 3: Weekly Class Hours */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              padding: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fed7aa', fontSize: '0.74rem', fontWeight: 700 }}>
                <Clock size={14} /> Weekly Hours
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
                {stats.totalWeeklyClassHours} hrs
              </div>
            </div>

            {/* Metric 4: Semesters Attached */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              padding: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#e9d5ff', fontSize: '0.74rem', fontWeight: 700 }}>
                <Layers size={14} /> Semesters
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '0.2rem' }}>
                {stats.semestersCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Quick-Action Toolbar (5 Actions from Section 3) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Action 1: Update Routine */}
        <div
          onClick={handleUpdate}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            transition: 'all 0.2s',
            borderLeft: '4px solid #2563eb'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Update Routine</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>Auto-schedule & edit slots</div>
          </div>
        </div>

        {/* Action 2: View Routine */}
        <div
          onClick={handleView}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            transition: 'all 0.2s',
            borderLeft: '4px solid #10b981'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Grid size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>View Routine</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>Full timetable & Word export</div>
          </div>
        </div>

        {/* Action 3: Manage Courses */}
        <div
          onClick={handleCourses}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            transition: 'all 0.2s',
            borderLeft: '4px solid #f59e0b'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#fffbeb',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Manage Courses</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>Add, archive & copy semesters</div>
          </div>
        </div>

        {/* Action 4: Manage Teachers */}
        <div
          onClick={handleTeachers}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            transition: 'all 0.2s',
            borderLeft: '4px solid #6366f1'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#eef2ff',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Manage Teachers</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>Dept & external faculty load</div>
          </div>
        </div>

        {/* Action 5: Routine History */}
        <div
          onClick={handleHistory}
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            transition: 'all 0.2s',
            borderLeft: '4px solid #8b5cf6'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#f5f3ff',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <History size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>Routine History</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>Audit versions & restore</div>
          </div>
        </div>
      </div>
    </div>
  );
}
