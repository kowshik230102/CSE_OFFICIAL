import React from 'react';
import { 
  GraduationCap, 
  LayoutDashboard, 
  Bell, 
  BookOpen, 
  FileSpreadsheet, 
  MessageSquareWarning, 
  Users, 
  Calendar, 
  Award, 
  FileText, 
  User, 
  Settings, 
  Key, 
  LogOut, 
  X, 
  Sparkles, 
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  UserPlus
} from 'lucide-react';

export const CollapsibleSidebar = ({
  isOpen,
  onClose,
  user,
  activeNavTab,
  onSelectNavTab,
  onOpenProfile,
  onOpenSettings,
  onOpenTeacherManagement,
  onOpenPasswordModal,
  onLogout
}) => {
  if (!isOpen) return null;

  const handleNavClick = (tabId) => {
    if (onSelectNavTab) {
      onSelectNavTab(tabId);
    }
    onClose();
  };

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
      {/* Backdrop Overlay */}
      <div 
        className="sidebar-drawer-overlay" 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 90,
          animation: 'fadeIn 0.2s ease'
        }}
      />

      {/* Sliding Drawer Container */}
      <aside 
        className="sidebar-drawer"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '320px',
          maxWidth: '85vw',
          background: '#0f172a',
          color: '#ffffff',
          zIndex: 95,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '10px 0 35px rgba(0, 0, 0, 0.4)',
          borderRight: '1px solid #1e293b',
          animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top Header & University Crest */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
            }}>
              <GraduationCap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                Department of CSE
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Academic Operations Portal
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation sidebar"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#cbd5e1'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* User Identity Card Preview */}
        {user && (
          <div style={{
            padding: '1rem 1.25rem',
            margin: '0.85rem 1rem 0.5rem',
            background: 'rgba(30, 41, 59, 0.7)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'background 0.15s ease'
          }}
          onClick={() => { onClose(); onOpenProfile(); }}
          title="Click to view full academic profile"
          >
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              flexShrink: 0
            }}>
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.firstName} {user.lastName}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
              <div style={{ marginTop: '0.3rem' }}>
                <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                  <ShieldCheck size={10} /> {user.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Navigation Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Main Navigation Section */}
          <div>
            <div style={{
              fontSize: '0.675rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#64748b',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
              paddingLeft: '0.5rem'
            }}>
              Core Workspace
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => handleNavClick('dashboard')}
                className={`sidebar-nav-btn ${activeNavTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard Overview</span>
              </button>

              <button
                onClick={() => handleNavClick('notices')}
                className={`sidebar-nav-btn ${activeNavTab === 'notices' ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <Bell size={16} />
                <span>Notice Board (Feed)</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  background: '#059669',
                  color: '#ffffff',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px'
                }}>
                  LIVE
                </span>
              </button>

              {/* Course Information (Organized 1-1 to 4-2 + Add Course) */}
              <button
                onClick={() => handleNavClick('course-info')}
                className={`sidebar-nav-btn ${activeNavTab === 'course-info' ? 'active' : ''}`}
              >
                <BookOpen size={16} />
                <span>Course Information</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '8px'
                }}>
                  8 SEM
                </span>
              </button>

              {/* Student Information (40 Seats Capacity + Add Session / Student) */}
              <button
                onClick={() => handleNavClick('student-info')}
                className={`sidebar-nav-btn ${activeNavTab === 'student-info' ? 'active' : ''}`}
              >
                <Users size={16} />
                <span>Student Information</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '8px'
                }}>
                  40 SEATS
                </span>
              </button>

              {/* Chairman Exclusive: Create Account Feature */}
              {(user?.isChair || user?.email === 'chair.cse_pust@gmail.com' || user?.role === 'ADMIN') && (
                <button
                  onClick={() => handleNavClick('create-account')}
                  className={`sidebar-nav-btn ${activeNavTab === 'create-account' ? 'active' : ''}`}
                  style={{
                    background: activeNavTab === 'create-account' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))' : 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#fef08a'
                  }}
                >
                  <UserPlus size={16} style={{ color: '#fbbf24' }} />
                  <span>Create Account</span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    background: '#f59e0b',
                    color: '#0f172a',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '8px'
                  }}>
                    CHAIR
                  </span>
                </button>
              )}

              {/* Only show student-specific views if user is Student */}
              {user?.role === 'STUDENT' && (
                <>
                  <button
                    onClick={() => handleNavClick('materials')}
                    className={`sidebar-nav-btn ${activeNavTab === 'materials' ? 'active' : ''}`}
                  >
                    <BookOpen size={16} />
                    <span>Course Materials & Notes</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('marks')}
                    className={`sidebar-nav-btn ${activeNavTab === 'marks' ? 'active' : ''}`}
                  >
                    <FileSpreadsheet size={16} />
                    <span>CT Marks & Assessments</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Account & System Preferences */}
          <div>
            <div style={{
              fontSize: '0.675rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#64748b',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
              paddingLeft: '0.5rem'
            }}>
              System & Account
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => { onClose(); onOpenProfile(); }}
                className="sidebar-nav-btn"
              >
                <User size={16} />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => { onClose(); onOpenSettings(); }}
                className="sidebar-nav-btn"
              >
                <Settings size={16} />
                <span>Portal Settings</span>
              </button>

              <button
                onClick={() => { onClose(); onOpenPasswordModal(); }}
                className="sidebar-nav-btn"
              >
                <Key size={16} />
                <span>Change Password</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Logout */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #1e293b',
          background: 'rgba(15, 23, 42, 0.95)'
        }}>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to sign out of the university portal?')) {
                onClose();
                onLogout();
              }
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#f87171';
            }}
          >
            <LogOut size={16} />
            <span>Sign Out Session</span>
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#64748b', marginTop: '0.65rem' }}>
            CSE Operations Engine v2.4 • High Concurrency Architecture
          </div>
        </div>
      </aside>
    </>
  );
};

export default CollapsibleSidebar;
