import React from 'react';
import { 
  CalendarCheck, 
  FlaskConical, 
  FileText, 
  Sparkles, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export function RoutineLandingHeader({ 
  selectedRoutineType, 
  activeCategory,
  onSelectRoutineType,
  onSelectCategory
}) {
  const currentType = activeCategory || selectedRoutineType || 'CLASS_ROUTINE';
  const handleSelect = onSelectCategory || onSelectRoutineType || (() => {});
  const routineTypes = [
    {
      id: 'CLASS_ROUTINE',
      title: 'Class Routine',
      subtitle: 'Semester Academic Timetable',
      description: 'Smart credit-based weekly lecture & lab schedule with automated teacher clash prevention and room allocation.',
      icon: CalendarCheck,
      badge: 'ACTIVE & FULLY POWERED',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #6366f1 100%)',
      accentColor: '#3b82f6',
      isAvailable: true
    },
    {
      id: 'LAB_EXAM_ROUTINE',
      title: 'Lab Exam Routine',
      subtitle: 'Practical & Sessional Examination',
      description: 'Scheduled computer lab sessions, hardware experiment slots, external examiners, and batch-wise student rosters.',
      icon: FlaskConical,
      badge: 'EXAM MODULE READY',
      badgeColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      gradient: 'linear-gradient(135deg, #854d0e 0%, #d97706 100%)',
      accentColor: '#f59e0b',
      isAvailable: false
    },
    {
      id: 'THEORY_EXAM_ROUTINE',
      title: 'Theory Exam Routine',
      subtitle: 'Semester Final Examinations',
      description: 'Comprehensive exam date sheets, hall invigilator allocation, question moderation timings, and seat-plan generator.',
      icon: FileText,
      badge: 'SEMESTER FINAL READY',
      badgeColor: '#8b5cf6',
      badgeBg: 'rgba(139, 92, 246, 0.15)',
      gradient: 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)',
      accentColor: '#8b5cf6',
      isAvailable: false
    }
  ];

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Institutional Top Heading */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#3b82f6',
              background: '#eff6ff',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              border: '1px solid #bfdbfe'
            }}>
              Department Operations
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              PUST Computer Science & Engineering
            </span>
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            Smart Routine Management System
            <Sparkles size={22} style={{ color: '#6366f1' }} />
          </h1>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>
            Official university timetable scheduling, automated credit-hour verification, and teacher workload synchronization.
          </p>
        </div>
      </div>

      {/* 3 Premium Routine Options Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '1rem'
      }}>
        {routineTypes.map(rt => {
          const isSelected = currentType === rt.id;
          const IconComp = rt.icon;

          return (
            <div
              key={rt.id}
              onClick={() => handleSelect(rt.id)}
              style={{
                position: 'relative',
                background: isSelected 
                  ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' 
                  : '#ffffff',
                color: isSelected ? '#ffffff' : '#0f172a',
                borderRadius: '16px',
                padding: '1.25rem 1.35rem',
                border: isSelected 
                  ? `2px solid ${rt.accentColor}` 
                  : '1px solid #e2e8f0',
                boxShadow: isSelected 
                  ? `0 10px 25px -5px rgba(59, 130, 246, 0.25)` 
                  : '0 2px 8px rgba(0, 0, 0, 0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '160px'
              }}
            >
              {/* Card Top */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.85rem'
                }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: isSelected ? rt.gradient : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? '#ffffff' : rt.accentColor,
                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                  }}>
                    <IconComp size={22} />
                  </div>

                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    color: rt.badgeColor,
                    background: rt.badgeBg,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    border: `1px solid ${rt.badgeColor}33`
                  }}>
                    {rt.badge}
                  </span>
                </div>

                <h3 style={{
                  margin: '0 0 0.2rem 0',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: isSelected ? '#ffffff' : '#0f172a'
                }}>
                  {rt.title}
                </h3>

                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: isSelected ? '#93c5fd' : '#475569',
                  marginBottom: '0.5rem'
                }}>
                  {rt.subtitle}
                </div>

                <p style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  lineHeight: 1.45,
                  color: isSelected ? '#cbd5e1' : '#64748b'
                }}>
                  {rt.description}
                </p>
              </div>

              {/* Card Bottom Indicator */}
              <div style={{
                marginTop: '1rem',
                paddingTop: '0.65rem',
                borderTop: isSelected ? '1px solid #334155' : '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: isSelected ? '#38bdf8' : '#64748b'
              }}>
                <span>
                  {rt.isAvailable ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? '#34d399' : '#059669' }}>
                      <CheckCircle2 size={13} /> Active Working Portal
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: isSelected ? '#fbbf24' : '#d97706' }}>
                      <Clock size={13} /> Architecture Ready
                    </span>
                  )}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  {isSelected ? 'Opened' : 'Open'} <ArrowRight size={12} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
