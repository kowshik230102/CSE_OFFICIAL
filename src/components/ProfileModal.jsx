import React from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Building, 
  Hash, 
  Calendar, 
  GraduationCap, 
  X,
  CheckCircle2,
  Key
} from 'lucide-react';

export const ProfileModal = ({ isOpen, onClose, user, onOpenPasswordModal }) => {
  if (!isOpen || !user) return null;

  const isChair = user?.isChair || user?.email === 'chair.cse_pust@gmail.com' || (user?.designation && user.designation.toLowerCase().includes('chair'));

  const getRoleColor = (role) => {
    if (isChair) return { bg: '#fef3c7', color: '#b45309', label: 'Chairman, Dept of CSE (PUST)' };
    switch (role) {
      case 'ADMIN': return { bg: '#f3e8ff', color: '#7e22ce', label: 'System Administrator' };
      case 'OFFICE_STAFF': return { bg: '#e0e7ff', color: '#4338ca', label: 'Academic Office Staff' };
      case 'TEACHER': return { bg: '#e0f2fe', color: '#0284c7', label: 'Faculty Member' };
      case 'STUDENT': return { bg: '#dcfce7', color: '#15803d', label: 'Enrolled Student' };
      default: return { bg: '#f1f5f9', color: '#475569', label: role };
    }
  };

  const roleMeta = getRoleColor(user.role);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-dialog" 
        style={{ maxWidth: '520px', borderRadius: '16px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* University Crest Header */}
        <div style={{
          background: 'linear-gradient(135deg, #09101d 0%, #1e3a8a 100%)',
          color: '#ffffff',
          padding: '1.5rem',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: '14px',
              top: '14px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#3b82f6',
              border: '3px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}>
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
                  {user.firstName} {user.lastName}
                </h3>
                <CheckCircle2 size={16} style={{ color: '#60a5fa' }} />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#93c5fd', margin: '0.2rem 0 0' }}>
                Department of Computer Science & Engineering
              </p>
              <div style={{ marginTop: '0.4rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.18)',
                  color: '#ffffff',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase'
                }}>
                  {roleMeta.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details Body */}
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={15} style={{ color: '#3b82f6' }} /> Institutional Email
              </span>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{user.email}</strong>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={15} style={{ color: '#10b981' }} /> Phone Contact
              </span>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{user.phoneNumber || '+880 1700-000000'}</strong>
            </div>

            {/* Role-specific details */}
            {user.role === 'TEACHER' && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GraduationCap size={15} style={{ color: '#6366f1' }} /> Academic Designation
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{user.designation || 'Professor'}</strong>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building size={15} style={{ color: '#d97706' }} /> Faculty Office Room
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{user.roomNumber || 'Academic Bldg 3, Room 402'}</strong>
                </div>
              </>
            )}

            {user.role === 'STUDENT' && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Hash size={15} style={{ color: '#3b82f6' }} /> Student Roll
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                    {user.studentRoll || 'CSE-20230101'}
                  </strong>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={15} style={{ color: '#10b981' }} /> Registration & Session
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                    {user.registrationNo || 'REG-88201'} ({user.sessionName || 'Session 2023-2024'})
                  </strong>
                </div>
              </>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={15} style={{ color: '#059669' }} /> Security & Account Status
              </span>
              <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                ACTIVE VERIFIED
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between', background: '#f8fafc' }}>
          <button
            onClick={() => {
              onClose();
              if (onOpenPasswordModal) onOpenPasswordModal();
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Key size={14} /> Change Password
          </button>

          <button onClick={onClose} className="btn btn-primary btn-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
