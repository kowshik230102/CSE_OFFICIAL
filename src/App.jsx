import React, { lazy, Suspense, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { CollapsibleSidebar } from './components/CollapsibleSidebar';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { GraduationCap } from 'lucide-react';

const named = (loader, exportName) => lazy(() => loader().then(module => ({ default: module[exportName] || module.default })));
const ProfileModal = named(() => import('./components/ProfileModal'), 'ProfileModal');
const SettingsModal = named(() => import('./components/SettingsModal'), 'SettingsModal');
const TeacherManagementModal = named(() => import('./components/TeacherManagementModal'), 'TeacherManagementModal');
const LoginPage = named(() => import('./components/LoginPage'), 'LoginPage');
const AdminView = named(() => import('./components/AdminView'), 'AdminView');
const TeacherView = named(() => import('./components/TeacherView'), 'TeacherView');
const TeacherDashboardView = named(() => import('./components/TeacherDashboardView'), 'TeacherDashboardView');
const StaffRestrictedView = named(() => import('./components/StaffRestrictedView'), 'StaffRestrictedView');
const StudentView = named(() => import('./components/StudentView'), 'StudentView');
const PasswordModal = named(() => import('./components/AuthModals'), 'PasswordModal');
const RoutineGeneratorView = named(() => import('./components/RoutineGeneratorView'), 'RoutineGeneratorView');
const TeacherCoursesView = named(() => import('./components/TeacherCoursesView'), 'TeacherCoursesView');
const ContinuousAssessmentView = named(() => import('./components/ContinuousAssessmentView'), 'ContinuousAssessmentView');
const CourseInfoView = named(() => import('./components/CourseInfoView'), 'CourseInfoView');
const StudentInfoView = named(() => import('./components/StudentInfoView'), 'StudentInfoView');

function WorkspaceLoader() {
  return <div className="app-loading-state" role="status" aria-live="polite">
    <div className="app-loading-mark"><GraduationCap size={26} /></div>
    <strong>Preparing your workspace</strong>
    <span>Loading the selected academic module…</span>
  </div>;
}

export function App() {
  const { user, loading, logout } = useAuth();
  
  // Navigation & Drawer States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('dashboard');
  const [assessmentTarget, setAssessmentTarget] = useState(null);

  // Modal States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [teacherModalFeature, setTeacherModalFeature] = useState(null);

  if (loading) {
    return (
      <div className="app-loading-state" role="status" aria-live="polite">
        <div className="app-loading-mark">
          <GraduationCap size={28} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Department of Computer Science & Engineering</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Loading verified RBAC session…</p>
      </div>
    );
  }

  // If user is not logged in, render the gorgeous 3-option login page
  if (!user) {
    return <AppErrorBoundary><Suspense fallback={<WorkspaceLoader />}><LoginPage /></Suspense></AppErrorBoundary>;
  }

  const handleSelectNavTab = (tabId) => {
    if (user.role === 'OFFICE_STAFF' && tabId !== 'dashboard') return;
    setActiveNavTab(tabId);
  };

  const openTeacherAssessment = (course) => {
    setAssessmentTarget(course);
    setActiveNavTab('continuous-assessment');
  };

  const handleOpenTeacherManagement = (featureKey) => {
    setTeacherModalFeature(featureKey);
    setIsTeacherModalOpen(true);
  };

  // Convert generic sidebar tab to role-specific tab if appropriate
  const getRoleTab = () => {
    if (activeNavTab === 'dashboard') return 'my-courses';
    if (activeNavTab === 'notices') return 'notices';
    if (activeNavTab === 'running-semester') return 'running-semester';
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
    <AppErrorBoundary><Suspense fallback={<WorkspaceLoader />}>
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

      {/* Main Content Area Displaying Role-Specific Workspace, Dedicated Routine Generator or Teacher Courses */}
      <main className="content-area">
        {activeNavTab === 'make-routine' ? (
          <RoutineGeneratorView 
            user={user} 
            onBackToDashboard={() => setActiveNavTab('dashboard')} 
            onNavigateNoticeBoard={() => setActiveNavTab('notices')} 
          />
        ) : activeNavTab === 'teacher-courses' ? (
          <TeacherCoursesView
            user={user}
            onBackToDashboard={() => setActiveNavTab('dashboard')}
          />
        ) : activeNavTab === 'continuous-assessment' ? (
          <ContinuousAssessmentView
            user={user}
            onBackToDashboard={() => setActiveNavTab('dashboard')}
            autoTarget={assessmentTarget}
            onAutoTargetHandled={() => setAssessmentTarget(null)}
          />
        ) : activeNavTab === 'course-info' ? (
          <CourseInfoView
            user={user}
            onBackToDashboard={() => setActiveNavTab('dashboard')}
          />
        ) : activeNavTab === 'student-info' ? (
          <StudentInfoView
            user={user}
            onBackToDashboard={() => setActiveNavTab('dashboard')}
          />
        ) : (
          <>
            {user.role === 'ADMIN' && <AdminView initialTab={getRoleTab() || 'users'} />}
            {user.role === 'OFFICE_STAFF' && <StaffRestrictedView />}
            {user.role === 'TEACHER' && activeNavTab === 'dashboard' && <TeacherDashboardView onOpenAssessment={openTeacherAssessment} />}
            {user.role === 'TEACHER' && activeNavTab !== 'dashboard' && <TeacherView initialTab={getRoleTab() || 'my-courses'} />}
            {user.role === 'STUDENT' && <StudentView initialTab={getRoleTab() || 'courses'} />}
          </>
        )}
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
    </Suspense></AppErrorBoundary>
  );
}

export default App;
