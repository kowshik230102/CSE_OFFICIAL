import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { CollapsibleSidebar } from './components/CollapsibleSidebar';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { TeacherManagementModal } from './components/TeacherManagementModal';
import { LoginPage } from './components/LoginPage';
import { AdminView } from './components/AdminView';
import { OfficeView } from './components/OfficeView';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';
import { PasswordModal } from './components/AuthModals';
import { GraduationCap } from 'lucide-react';

export function App() {
  const { user, loading, logout } = useAuth();
  
  // Navigation & Drawer States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('dashboard');

  // Modal States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [teacherModalFeature, setTeacherModalFeature] = useState(null);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09101d', color: '#ffffff' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>
          <GraduationCap size={28} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Department of Computer Science & Engineering</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>Loading verified RBAC session...</p>
      </div>
    );
  }

  // If user is not logged in, render the gorgeous 3-option login page
  if (!user) {
    return <LoginPage />;
  }

  const handleSelectNavTab = (tabId) => {
    setActiveNavTab(tabId);
  };

  const handleOpenTeacherManagement = (featureKey) => {
    setTeacherModalFeature(featureKey);
    setIsTeacherModalOpen(true);
  };

  // Convert generic sidebar tab to role-specific tab if appropriate
  const getRoleTab = () => {
    if (activeNavTab === 'dashboard') return 'my-courses';
    if (activeNavTab === 'notices') return 'notices';
    if (activeNavTab === 'dept-info') return 'dept-info';
    if (activeNavTab === 'course-info') return 'course-info';
    if (activeNavTab === 'student-info') return 'student-info';
    if (activeNavTab === 'create-account') return 'create-account';
    if (activeNavTab === 'materials') {
      if (user.role === 'STUDENT') return 'courses';
      if (user.role === 'TEACHER') return 'my-courses';
      if (user.role === 'OFFICE_STAFF') return 'courses';
    }
    if (activeNavTab === 'marks') {
      if (user.role === 'STUDENT') return 'marks';
      if (user.role === 'TEACHER') return 'my-courses';
    }
    if (activeNavTab === 'grievances') {
      return 'grievances';
    }
    return undefined; // default initial tab of the role view
  };

  // Render Logged-In Application Layout
  return (
    <div className="app-container">
      {/* Universal Top Navigation & Role Switcher */}
      <Navbar 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onNavigateNoticeBoard={() => setActiveNavTab('notices')}
      />

      {/* Collapsible Sliding Sidebar Drawer */}
      <CollapsibleSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        activeNavTab={activeNavTab}
        onSelectNavTab={handleSelectNavTab}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenTeacherManagement={handleOpenTeacherManagement}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onLogout={logout}
      />

      {/* Main Content Area Displaying Role-Specific Workspace */}
      <main className="content-area">
        {user.role === 'ADMIN' && <AdminView initialTab={getRoleTab() || 'users'} />}
        {user.role === 'OFFICE_STAFF' && <OfficeView initialTab={getRoleTab() || 'sessions'} />}
        {user.role === 'TEACHER' && <TeacherView initialTab={getRoleTab() || 'my-courses'} />}
        {user.role === 'STUDENT' && <StudentView initialTab={getRoleTab() || 'courses'} />}
      </main>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onOpenPasswordModal={() => {
          setIsProfileModalOpen(false);
          setIsPasswordModalOpen(true);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenPasswordModal={() => {
          setIsSettingsModalOpen(false);
          setIsPasswordModalOpen(true);
        }}
      />

      {/* Teacher Management Roadmap Blueprint Modal */}
      <TeacherManagementModal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        selectedFeature={teacherModalFeature}
      />

      {/* Global Password Change Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}

export default App;
