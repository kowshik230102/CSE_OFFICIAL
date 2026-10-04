import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationsDropdown } from './NotificationsDropdown';
import { 
  GraduationCap, 
  User, 
  LogOut, 
  Key, 
  ShieldCheck, 
  ChevronDown,
  Menu,
  Settings
} from 'lucide-react';

export const Navbar = ({ 
  onToggleSidebar, 
  onOpenProfile, 
  onOpenSettings, 
  onOpenPasswordModal,
  onNavigateNoticeBoard 
}) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'ADMIN': return 'badge-admin';
      case 'OFFICE_STAFF': return 'badge-office';
      case 'TEACHER': return 'badge-teacher';
      case 'STUDENT': return 'badge-student';
      default: return 'badge-secondary';
    }
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="top-nav">
        {/* Top Left Corner: Collapsible Menu / Sidebar Button & Branding */}
        <div className="brand-section">
          {/* Top Left Hamburger Button */}
          <button
            onClick={onToggleSidebar}
            className="sidebar-toggle-btn"
            aria-label="Open navigation sidebar"
            title="Open navigation menu & teacher management"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginRight: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.borderColor = '#38bdf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            <Menu size={20} />
          </button>

          {/* University Crest / Logo */}
          <div className="brand-logo-icon" style={{
            background: 'linear-gradient(135deg, #2563eb, #6366f1)',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.4)'
          }}>
            <GraduationCap size={24} />
          </div>

          <div>
            <h1 className="brand-title">Department of Computer Science & Engineering</h1>
            <p className="brand-subtitle">Official Academic Operations & Course Management Platform</p>
          </div>
        </div>

        {/* Top Right Corner: Notification Bell & User Profile Menu */}
        {user ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Top Right Notification Bell with unread indicator badge */}
            <NotificationsDropdown onNavigateNoticeBoard={onNavigateNoticeBoard} />

            {/* Role Badge */}
            {(user.isChair || user.email === 'chair.cse_pust@gmail.com') ? (
              <span className="badge" style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', color: '#0f172a', fontWeight: 800, border: '1px solid rgba(254, 243, 199, 0.5)', boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)' }}>
                🏛️ CHAIRMAN (CSE)
              </span>
            ) : (
              <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ display: 'none', md: 'inline-flex' }}>
                <ShieldCheck size={12} />
                {user.role.replace('_', ' ')}
              </span>
            )}

            {/* User Profile Pill & Dropdown */}
            <div style={{ position: 'relative' }} ref={profileDropdownRef}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.6rem', 
                  cursor: 'pointer',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '10px',
                  background: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                  border: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
                  transition: 'background 0.15s ease'
                }}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onMouseEnter={(e) => e.currentTarget.style.background = (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.background = (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.08)'}
              >
                <div 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? 'linear-gradient(135deg, #d97706, #f59e0b)' : '#3b82f6', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: '800', 
                    fontSize: '0.85rem', 
                    color: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? '#0f172a' : '#ffffff',
                    boxShadow: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? '0 0 10px rgba(245, 158, 11, 0.45)' : 'none'
                  }}
                >
                  {user.firstName[0]}{user.lastName[0]}
                </div>

                <div style={{ textAlign: 'left', lineHeight: '1.2', display: 'none', md: 'block' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff' }}>
                    {user.firstName} {user.lastName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? '#fbbf24' : '#94a3b8', fontWeight: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? 700 : 400 }}>
                    {(user.isChair || user.email === 'chair.cse_pust@gmail.com') ? 'Chairman, Dept of CSE' : (user.designation || (user.studentRoll ? `Roll: ${user.studentRoll}` : user.role))}
                  </div>
                </div>

                <ChevronDown size={14} style={{ color: (user.isChair || user.email === 'chair.cse_pust@gmail.com') ? '#fbbf24' : '#94a3b8' }} />
              </div>

              {/* Profile Dropdown Menu */}
              {dropdownOpen && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '240px',
                    background: '#ffffff',
                    color: '#0f172a',
                    borderRadius: '12px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
                    border: '1px solid #e2e8f0',
                    padding: '0.5rem',
                    zIndex: 100,
                    animation: 'slideUp 0.15s ease'
                  }}
                >
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {user.email}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenProfile) onOpenProfile();
                    }}
                    className="nav-link"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  >
                    <User size={14} /> My Profile
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenSettings) onOpenSettings();
                    }}
                    className="nav-link"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  >
                    <Settings size={14} /> Settings
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenPasswordModal) onOpenPasswordModal();
                    }}
                    className="nav-link"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                  >
                    <Key size={14} /> Change Password
                  </button>

                  <div style={{ borderTop: '1px solid #f1f5f9', margin: '0.25rem 0' }} />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="nav-link"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', color: '#ef4444' }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
};

export default Navbar;
