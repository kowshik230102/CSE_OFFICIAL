import React, { useState } from 'react';
import { 
  Users, 
  Award, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle, 
  Sparkles, 
  X, 
  Layers, 
  ShieldCheck, 
  ArrowRight,
  Send
} from 'lucide-react';

export const TeacherManagementModal = ({ isOpen, onClose, selectedFeature = null }) => {
  const [subscribed, setSubscribed] = useState(false);
  const [activeTab, setActiveTab] = useState(selectedFeature || 'workload');

  if (!isOpen) return null;

  const features = [
    {
      id: 'workload',
      title: 'Faculty Workload & Allocation',
      icon: Layers,
      color: '#2563eb',
      status: 'Q1 2027 Roadmap',
      desc: 'Automated AI-assisted distribution of theory and laboratory courses based on faculty research specialization, credit hours, and university syndicate norms.',
      specs: [
        'Weekly teaching load calculation (Contact hours vs Prep hours)',
        'Sessional/Lab batch splitting & TA allocation',
        'Automatic timetable collision detection'
      ]
    },
    {
      id: 'evaluation',
      title: 'Teacher Performance & Evaluations',
      icon: Award,
      color: '#d97706',
      status: 'In Architecture Review',
      desc: 'End-of-semester anonymous student feedback processing, outcome-based education (OBE) course metric tracking, and peer observation reports.',
      specs: [
        'Confidential student course exit survey analysis',
        'OBE Bloom’s taxonomy attainment metrics',
        'Department chair annual performance appraisal reports'
      ]
    },
    {
      id: 'office-hours',
      title: 'Office Hours & Mentorship',
      icon: Calendar,
      color: '#059669',
      status: 'Prototyping Phase',
      desc: 'Interactive appointment scheduling for undergraduate thesis advising, course consultations, and student counseling slots.',
      specs: [
        'Weekly recurring consultation slot calendar',
        '1-click Google Meet / Zoom link dispatch',
        'Student thesis milestone tracking and approvals'
      ]
    },
    {
      id: 'leave',
      title: 'Leave & Duty Sanctioning',
      icon: FileText,
      color: '#7c3aed',
      status: 'Workflow Specification',
      desc: 'Paperless digital sabbatical, conference leave, and substitute teacher assignment workflow with multi-level approval from Head of Department and Dean.',
      specs: [
        'Casual, medical, and duty leave applications',
        'Automatic substitute teacher assignment & syllabus handoff',
        'Sync with university payroll & registry clearance'
      ]
    }
  ];

  const current = features.find((f) => f.id === activeTab) || features[0];
  const CurrentIcon = current.icon;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-dialog" 
        style={{ maxWidth: '720px', borderRadius: '16px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: '#0f172a', color: '#ffffff', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Users size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Teacher Management System
                </h3>
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.25)',
                  color: '#60a5fa',
                  fontWeight: 800,
                  border: '1px solid rgba(59, 130, 246, 0.4)'
                }}>
                  STRUCTURAL EXPANSION MODULE
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                Enterprise faculty administration blueprints prepared for institutional rollout
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Feature Nav Tabs */}
        <div style={{
          display: 'flex',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.35rem 0.75rem',
          gap: '0.35rem',
          overflowX: 'auto'
        }}>
          {features.map((feat) => {
            const Icon = feat.icon;
            const isActive = activeTab === feat.id;
            return (
              <button
                key={feat.id}
                onClick={() => setActiveTab(feat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? feat.color : '#64748b',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} />
                <span>{feat.title.split(' ')[0]} {feat.title.split(' ')[1]}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            padding: '1.25rem',
            borderRadius: '12px',
            background: `${current.color}08`,
            border: `1px solid ${current.color}25`,
            marginBottom: '1.25rem'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: current.color,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CurrentIcon size={24} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {current.title}
                </h4>
                <span style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1'
                }}>
                  Status: {current.status}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.45rem', lineHeight: '1.55' }}>
                {current.desc}
              </p>
            </div>
          </div>

          <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.65rem' }}>
            Planned Architectural Specifications:
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {current.specs.map((spec, i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.6rem', 
                  padding: '0.6rem 0.85rem', 
                  borderRadius: '8px', 
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.825rem',
                  color: '#334155'
                }}
              >
                <CheckCircle size={15} style={{ color: current.color, flexShrink: 0 }} />
                <span>{spec}</span>
              </div>
            ))}
          </div>

          {/* Interactive Notify/Beta Subscribe */}
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                Department of CSE Teacher Management Beta Program
              </span>
            </div>

            <button
              onClick={() => setSubscribed(!subscribed)}
              className="btn btn-sm"
              style={{
                background: subscribed ? '#ecfdf5' : '#2563eb',
                color: subscribed ? '#065f46' : '#ffffff',
                border: subscribed ? '1px solid #a7f3d0' : 'none',
                fontWeight: 700,
                fontSize: '0.775rem'
              }}
            >
              {subscribed ? (
                <>✓ Subscribed to Updates</>
              ) : (
                <>Notify When Module Deploys</>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ background: '#f8fafc' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Blueprint
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherManagementModal;
