import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Clock, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  ExternalLink, 
  Search, 
  Filter, 
  Award, 
  Layers, 
  FileText, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  Sparkles, 
  RefreshCw, 
  X,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  Radio,
  BookMarked,
  Briefcase
} from 'lucide-react';

export function TeacherCoursesView({ user, onBackToDashboard }) {
  // Faculty & Staff State
  const [facultyList, setFacultyList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [departmentGlance, setDepartmentGlance] = useState(null);
  const [syncInfo, setSyncInfo] = useState(null);
  
  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active Main Tab: 'FACULTY' or 'STAFF'
  const [mainTab, setMainTab] = useState('FACULTY');
  
  // Faculty Sub-Filter: 'ALL', 'CHAIR_PROF', 'ASSOC_PROF', 'ASST_PROF', 'ON_LEAVE', 'DEPT_ONLY', 'NON_DEPT_ONLY'
  const [facultyFilter, setFacultyFilter] = useState('ALL');
  
  // Bio Modal State
  const [selectedTeacherForBio, setSelectedTeacherForBio] = useState(null);
  const [expandedDatesCourseId, setExpandedDatesCourseId] = useState(null);
  
  // Clipboard copied feedback
  const [copiedText, setCopiedText] = useState(null);
  
  // Toast notifications
  const [toast, setToast] = useState(null);

  // Live Clock Tick state (re-renders countdowns accurately every second)
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Fetch Faculty Members, Department Staff, and Sync Metadata from Backend
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch('/api/academic/faculty-courses', { credentials: 'include', headers });
      const data = await res.json();
      if (data.faculty) {
        setFacultyList(data.faculty);
      }
      if (data.staff) {
        setStaffList(data.staff);
      }
      if (data.departmentGlance) {
        setDepartmentGlance(data.departmentGlance);
      }
      if (data.syncInfo) {
        setSyncInfo(data.syncInfo);
      }
    } catch (err) {
      console.error('Failed to load faculty courses:', err);
      showToast('Failed to load faculty records: ' + err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1-Click On-Demand Sync from PUST Official Website
  const handleTriggerSync = async () => {
    setSyncing(true);
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const res = await fetch('/api/academic/sync-pust-teachers', {
        method: 'POST',
        credentials: 'include',
        headers
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with PUST external portal.');
      }

      showToast(data.message || 'Successfully synchronized faculty members from PUST CSE Portal (D01)!', 'success');
      await loadData(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Helper: Calculate live countdown to class end date
  const calculateCountdown = (endDateStr) => {
    if (!endDateStr) return { expired: true, text: 'No Date Set' };

    const targetDate = new Date(endDateStr);
    targetDate.setHours(23, 59, 59, 999);

    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { expired: true, text: 'Semester Concluded', days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return {
      expired: false,
      days,
      hours,
      minutes,
      seconds,
      text: `${days}d ${hours}h ${minutes}m ${seconds}s`
    };
  };

  // Helper: Calculate remaining class dates before class end date based on weekly schedule
  const calculateRemainingClasses = (scheduleStr, endDateStr) => {
    if (!endDateStr) return { count: 0, dates: [] };

    const targetDate = new Date(endDateStr);
    targetDate.setHours(23, 59, 59, 999);

    const daysMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };

    const targetDays = [];
    const lowerSched = (scheduleStr || '').toLowerCase();
    for (const [dayName, dayNum] of Object.entries(daysMap)) {
      if (lowerSched.includes(dayName)) {
        targetDays.push(dayNum);
      }
    }

    if (targetDays.length === 0) {
      targetDays.push(0, 2); // Default Sunday & Tuesday if unspecified
    }

    const dates = [];
    let current = new Date(now);
    current.setHours(0, 0, 0, 0);

    while (current <= targetDate) {
      if (targetDays.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return {
      count: dates.length,
      dates: dates.slice(0, 8)
    };
  };

  // Helper format relative time
  const formatSyncTime = (isoString) => {
    if (!isoString) return 'Not yet synced';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ', ' + date.toLocaleDateString();
  };

  // Filtered Faculty Members
  const filteredFaculty = useMemo(() => {
    return facultyList.filter(f => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = f.fullName?.toLowerCase().includes(q);
        const matchDesig = f.designation?.toLowerCase().includes(q);
        const matchEmail = (f.email || f.personal_email || f.office_email)?.toLowerCase().includes(q);
        const matchPhone = (f.phone_number || f.office_phone || f.personal_phone)?.includes(q);
        const matchResearch = f.research_area?.toLowerCase().includes(q);
        const matchQual = f.qualification?.toLowerCase().includes(q);
        const matchCourse = f.currentCourses?.some(c => 
          c.course_code?.toLowerCase().includes(q) || 
          c.course_title?.toLowerCase().includes(q) || 
          c.target_dept?.toLowerCase().includes(q)
        );

        if (!matchName && !matchDesig && !matchEmail && !matchPhone && !matchResearch && !matchQual && !matchCourse) {
          return false;
        }
      }

      // 2. Sub-filters
      if (facultyFilter === 'CHAIR_PROF') {
        return f.designation?.toLowerCase().includes('chair') || (f.designation?.toLowerCase().includes('professor') && !f.designation?.toLowerCase().includes('associate') && !f.designation?.toLowerCase().includes('assistant'));
      }
      if (facultyFilter === 'ASSOC_PROF') {
        return f.designation?.toLowerCase().includes('associate professor');
      }
      if (facultyFilter === 'ASST_PROF') {
        return f.designation?.toLowerCase().includes('assistant professor');
      }
      if (facultyFilter === 'ON_LEAVE') {
        return f.on_leave === 1 || f.designation?.toLowerCase().includes('leave');
      }
      if (facultyFilter === 'DEPT_ONLY') {
        return f.deptCourses && f.deptCourses.length > 0;
      }
      if (facultyFilter === 'NON_DEPT_ONLY') {
        return f.nonDeptCourses && f.nonDeptCourses.length > 0;
      }

      return true;
    });
  }, [facultyList, searchQuery, facultyFilter]);

  // Filtered Staff Members
  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = `${s.first_name} ${s.last_name}`.toLowerCase().includes(q);
      const matchEmail = s.email?.toLowerCase().includes(q);
      const matchPhone = s.phone_number?.includes(q);
      return matchName || matchEmail || matchPhone;
    });
  }, [staffList, searchQuery]);

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1440px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: toast.type === 'error' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #10b981, #047857)',
          color: '#ffffff',
          padding: '0.9rem 1.4rem',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          border: '1px solid rgba(255, 255, 255, 0.25)',
          animation: 'slideInRight 0.25s ease'
        }}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid #334155',
              color: '#94a3b8',
              padding: '0.6rem 0.9rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#64748b'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                padding: '0.45rem',
                borderRadius: '10px',
                display: 'flex',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
              }}>
                <GraduationCap size={22} />
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Teacher & Staff Panel
              </h1>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '8px',
                fontSize: '0.725rem',
                fontWeight: 700
              }}>
                LIVE D01 SOURCE
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
              Official PUST CSE Directory • Real-time External Synchronization • Faculty Bios & Schedules • Department Staff
            </p>
          </div>
        </div>

        {/* Sync Trigger & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href="https://pust.ac.bd/academic/departments/dept_teachers/D01"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '0.6rem 0.95rem',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.borderColor = '#60a5fa'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = '#334155'; }}
          >
            <Globe size={14} />
            <span>PUST D01 Source</span>
            <ExternalLink size={12} />
          </a>

          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            style={{
              background: syncing ? 'rgba(59, 130, 246, 0.4)' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.15rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: syncing ? 'default' : 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={16} className={syncing ? 'spin-animation' : ''} />
            <span>{syncing ? 'Synchronizing Live...' : 'Sync from University Portal'}</span>
          </button>
        </div>
      </div>

      {/* 1. LIVE SYNCHRONIZATION STATUS BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: '1px solid #1e293b',
        borderRadius: '14px',
        padding: '1rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: syncInfo?.status === 'ERROR' ? '#ef4444' : '#10b981',
            boxShadow: syncInfo?.status === 'ERROR' ? '0 0 12px #ef4444' : '0 0 12px #10b981',
            animation: 'pulse 2s infinite'
          }} />

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>Live Synchronized with Official PUST CSE Portal</span>
              <span style={{ fontSize: '0.725rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                AUTO-SYNC (12H CRON ACTIVE)
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Source: <code style={{ color: '#60a5fa' }}>https://pust.ac.bd/academic/departments/dept_teachers/D01</code> • Last Synced: <strong>{formatSyncTime(syncInfo?.lastSyncedAt)}</strong>
            </div>
          </div>
        </div>

        {/* At a glance stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Official Teachers</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              {facultyList.length} Faculty Members
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: '#334155' }} />

          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Dept Office Staff</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>
              {staffList.length} Support Staff
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: '#334155' }} />

          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>General Contact</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
              +8802588844876
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVIGATION TABS: FACULTY VS STAFF */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '0.85rem'
      }}>
        {/* Left Side: Faculty vs Staff Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => { setMainTab('FACULTY'); setFacultyFilter('ALL'); }}
            style={{
              background: mainTab === 'FACULTY' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(30, 41, 59, 0.6)',
              color: mainTab === 'FACULTY' ? '#ffffff' : '#94a3b8',
              border: mainTab === 'FACULTY' ? 'none' : '1px solid #334155',
              padding: '0.55rem 1.15rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease'
            }}
          >
            <GraduationCap size={16} />
            <span>CSE Faculty Members ({facultyList.length})</span>
          </button>

          <button
            onClick={() => setMainTab('STAFF')}
            style={{
              background: mainTab === 'STAFF' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'rgba(30, 41, 59, 0.6)',
              color: mainTab === 'STAFF' ? '#ffffff' : '#94a3b8',
              border: mainTab === 'STAFF' ? 'none' : '1px solid #334155',
              padding: '0.55rem 1.15rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease'
            }}
          >
            <Briefcase size={16} />
            <span>Department Staff & Office ({staffList.length})</span>
          </button>
        </div>

        {/* Right Side: Global Search */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder={mainTab === 'FACULTY' ? "Search teacher name, research, phone..." : "Search staff name, email, role..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.25rem',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid #334155',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 3. FACULTY SUB-FILTERS (IF MAIN TAB IS FACULTY) */}
      {mainTab === 'FACULTY' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.85rem',
          marginBottom: '1.5rem'
        }}>
          {[
            { id: 'ALL', label: `All Teachers (${facultyList.length})` },
            { id: 'CHAIR_PROF', label: 'Professors & Chairman' },
            { id: 'ASSOC_PROF', label: 'Associate Professors' },
            { id: 'ASST_PROF', label: 'Assistant Professors' },
            { id: 'ON_LEAVE', label: 'On Study Leave' },
            { id: 'DEPT_ONLY', label: 'Department Courses' },
            { id: 'NON_DEPT_ONLY', label: 'Non-Department (EEE/ICE/Math)' },
          ].map(tab => {
            const isActive = facultyFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFacultyFilter(tab.id)}
                style={{
                  background: isActive ? '#3b82f6' : 'rgba(30, 41, 59, 0.6)',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  border: isActive ? '1px solid #60a5fa' : '1px solid #334155',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. CONTENT AREA */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', background: '#0f172a', borderRadius: '16px' }}>
          <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 0.75rem auto', color: '#3b82f6' }} />
          <div>Loading teacher and staff directory from database...</div>
        </div>
      ) : mainTab === 'FACULTY' ? (
        /* FACULTY CARDS GRID */
        filteredFaculty.length === 0 ? (
          <div style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '16px',
            border: '1px dashed #334155',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem'
          }}>
            <GraduationCap size={44} style={{ color: '#64748b' }} />
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#e2e8f0' }}>
              {facultyList.length === 0 ? 'No Faculty Records in Database Yet' : 'No Teachers Match Current Filter'}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '480px' }}>
              {facultyList.length === 0 
                ? 'Click below to instantly fetch and synchronize all 11 CSE teachers and staff from the official university portal.' 
                : 'Try adjusting your search keyword or switching the designation filter above.'}
            </div>
            {facultyList.length === 0 ? (
              <button
                onClick={handleTriggerSync}
                disabled={syncing}
                style={{
                  marginTop: '0.5rem',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: syncing ? 'default' : 'pointer',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)'
                }}
              >
                <RefreshCw size={18} className={syncing ? 'spin-animation' : ''} />
                <span>{syncing ? 'Fetching from pust.ac.bd...' : 'Fetch & Sync Now from PUST (D01)'}</span>
              </button>
            ) : (
              <button
                onClick={() => { setSearchQuery(''); setFacultyFilter('ALL'); }}
                style={{
                  marginTop: '0.5rem',
                  background: 'rgba(51, 65, 85, 0.6)',
                  color: '#cbd5e1',
                  border: '1px solid #475569',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  cursor: 'pointer'
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredFaculty.map(faculty => {
              const isChairman = faculty.designation?.toLowerCase().includes('chair');
              const isOnLeave = faculty.on_leave === 1 || faculty.designation?.toLowerCase().includes('leave');

              return (
                <div
                  key={faculty.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                    border: isChairman ? '2px solid #3b82f6' : '1px solid #1e293b',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: isChairman ? '0 10px 30px rgba(37, 99, 235, 0.25)' : '0 6px 20px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = '#60a5fa';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = isChairman ? '#3b82f6' : '#1e293b';
                  }}
                >
                  <div>
                    {/* Header: Photo, Status Badge & Profile Link */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                      {/* Teacher Photo with status dot */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: '72px',
                          height: '72px',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '1.5rem',
                          border: '2px solid rgba(255, 255, 255, 0.15)',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                        }}>
                          {faculty.photo_url ? (
                            <img
                              src={faculty.photo_url}
                              alt={faculty.fullName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            faculty.fullName ? faculty.fullName[0] : 'T'
                          )}
                        </div>

                        {/* Leave / Active Dot */}
                        <div
                          title={isOnLeave ? 'On Study Leave' : 'Active Faculty Member'}
                          style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: isOnLeave ? '#f59e0b' : '#10b981',
                            border: '2px solid #0f172a'
                          }}
                        />
                      </div>

                      {/* Name, Designation & Badges */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          {isChairman ? (
                            <span style={{
                              background: 'linear-gradient(135deg, #059669, #10b981)',
                              color: '#ffffff',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '20px'
                            }}>
                              CHAIRMAN
                            </span>
                          ) : isOnLeave ? (
                            <span style={{
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: '#fbbf24',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '20px'
                            }}>
                              STUDY LEAVE
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '20px'
                            }}>
                              ACTIVE FACULTY
                            </span>
                          )}

                          {faculty.profile_id && (
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.06)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              PUST #{faculty.profile_id}
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.25rem 0', lineHeight: 1.3 }}>
                          {faculty.fullName}
                        </h3>

                        <div style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
                          {faculty.designation}
                        </div>
                      </div>
                    </div>

                    {/* Academic Credentials Section */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      marginBottom: '1rem',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.775rem'
                    }}>
                      {/* Qualification */}
                      {faculty.qualification && (
                        <div style={{ marginBottom: '0.45rem', color: '#cbd5e1' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Qualification: </span>
                          <span style={{ fontWeight: 700 }}>{faculty.qualification}</span>
                        </div>
                      )}

                      {/* Research Area */}
                      {faculty.research_area && (
                        <div style={{ marginBottom: '0.45rem', color: '#cbd5e1' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Research Area: </span>
                          <span style={{ color: '#a78bfa', fontWeight: 600 }}>{faculty.research_area}</span>
                        </div>
                      )}

                      {/* Publications Pill */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Award size={13} style={{ color: '#f59e0b' }} /> Total Publications:
                        </span>
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: '6px' }}>
                          {faculty.publications_count || 0} Papers
                        </span>
                      </div>
                    </div>

                    {/* Contact Sheet (Emails & Phones with 1-click Copy) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem', fontSize: '0.775rem' }}>
                      {/* Official Email */}
                      {(faculty.email || faculty.office_email) && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                            <Mail size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
                            <span style={{ color: '#ffffff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {faculty.email || faculty.office_email}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(faculty.email || faculty.office_email, 'Official Email')}
                            title="Copy Official Email"
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            {copiedText === (faculty.email || faculty.office_email) ? <Check size={13} style={{ color: '#34d399' }} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}

                      {/* Office / Personal Phone */}
                      {(faculty.phone_number || faculty.office_phone || faculty.personal_phone) && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Phone size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                            <span style={{ color: '#cbd5e1' }}>
                              {faculty.phone_number || faculty.personal_phone || faculty.office_phone}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(faculty.phone_number || faculty.personal_phone || faculty.office_phone, 'Phone Number')}
                            title="Copy Phone Number"
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          >
                            {copiedText === (faculty.phone_number || faculty.personal_phone || faculty.office_phone) ? <Check size={13} style={{ color: '#34d399' }} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}

                      {/* Room & Dept */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
                        <MapPin size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <span>{faculty.room_number || 'Academic Bldg 3, CSE Department'}</span>
                      </div>
                    </div>

                    {/* Active Course Schedule & Countdown Accordion */}
                    {faculty.currentCourses && faculty.currentCourses.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                          Active Courses & Class Deadlines ({faculty.currentCourses.length})
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {faculty.currentCourses.slice(0, 2).map(c => {
                            const countdown = calculateCountdown(c.class_end_date);
                            const remaining = calculateRemainingClasses(c.weekly_schedule, c.class_end_date);

                            return (
                              <div
                                key={c.id}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.75)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '10px',
                                  padding: '0.75rem',
                                  fontSize: '0.775rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span style={{ fontWeight: 800, color: '#60a5fa' }}>{c.course_code}</span>
                                  <span style={{
                                    fontSize: '0.675rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    background: c.course_type === 'NON_DEPARTMENT' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                    color: c.course_type === 'NON_DEPARTMENT' ? '#fbbf24' : '#93c5fd'
                                  }}>
                                    {c.target_dept || 'CSE'}
                                  </span>
                                </div>

                                <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.course_title}
                                </div>

                                {/* Countdown pill */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', color: '#94a3b8' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Clock size={12} style={{ color: countdown.expired ? '#94a3b8' : '#34d399' }} />
                                    <span>{countdown.text}</span>
                                  </span>

                                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                                    {remaining.count} Classes Left
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA: View Profile & External URL */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <button
                      onClick={() => setSelectedTeacherForBio(faculty)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.55rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <FileText size={14} /> View Full Profile
                    </button>

                    {faculty.profile_id && (
                      <a
                        href={`https://pust.ac.bd/academic/departments/dept_teachers/dept_teachers_profile/${faculty.profile_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Official PUST Web Profile"
                        style={{
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid #334155',
                          color: '#cbd5e1',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none'
                        }}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* STAFF MEMBERS GRID ("and stuff") */
        filteredStaff.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '16px',
            border: '1px dashed #334155'
          }}>
            <Briefcase size={40} style={{ color: '#64748b', margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e2e8f0' }}>No Staff Members Found</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>
              No department support staff matches the current search query.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredStaff.map(staff => (
              <div
                key={staff.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
                  border: '1px solid #1e293b',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)',
                      flexShrink: 0
                    }}>
                      {staff.first_name?.[0]}{staff.last_name?.[0]}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        background: 'rgba(2, 132, 199, 0.15)',
                        color: '#38bdf8',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '20px',
                        display: 'inline-block',
                        marginBottom: '0.3rem'
                      }}>
                        DEPARTMENT STAFF
                      </span>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        {staff.first_name} {staff.last_name}
                      </h3>

                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        {staff.designation}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    marginBottom: '1rem',
                    fontSize: '0.8rem',
                    color: '#cbd5e1'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <Mail size={13} style={{ color: '#38bdf8' }} />
                      <span>{staff.email}</span>
                    </div>

                    {staff.phone_number && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Phone size={13} style={{ color: '#34d399' }} />
                        <span>{staff.phone_number}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={13} style={{ color: '#fbbf24' }} />
                      <span>{staff.office_location}</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: '#94a3b8'
                }}>
                  <span>Role: <strong>Office Administration</strong></span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>● Active Status</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 5. FULL FACULTY BIOGRAPHY & CREDENTIALS MODAL */}
      {selectedTeacherForBio && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 10, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #1e293b',
              background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  flexShrink: 0
                }}>
                  {selectedTeacherForBio.photo_url ? (
                    <img
                      src={selectedTeacherForBio.photo_url}
                      alt={selectedTeacherForBio.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    selectedTeacherForBio.fullName ? selectedTeacherForBio.fullName[0] : 'T'
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    {selectedTeacherForBio.fullName}
                  </h3>
                  <div style={{ fontSize: '0.825rem', color: '#60a5fa', fontWeight: 600, marginTop: '0.2rem' }}>
                    {selectedTeacherForBio.designation} • Dept of CSE, PUST
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeacherForBio(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Profile Meta Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.85rem'
              }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.85rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Publications</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
                    {selectedTeacherForBio.publications_count || 0} Peer-Reviewed Articles
                  </div>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.85rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>University Profile ID</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.2rem' }}>
                    #{selectedTeacherForBio.profile_id || 'PUST-CSE'}
                  </div>
                </div>
              </div>

              {/* Academic Qualification */}
              {selectedTeacherForBio.qualification && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Academic Qualification
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '10px', color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.5, border: '1px solid #1e293b' }}>
                    {selectedTeacherForBio.qualification}
                  </div>
                </div>
              )}

              {/* Research Interests */}
              {selectedTeacherForBio.research_area && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Research Specializations
                  </div>
                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '10px', color: '#a78bfa', fontSize: '0.85rem', lineHeight: 1.5, border: '1px solid #1e293b', fontWeight: 600 }}>
                    {selectedTeacherForBio.research_area}
                  </div>
                </div>
              )}

              {/* Complete Contact Details */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Official & Personal Contacts
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Official Email:</span>
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>{selectedTeacherForBio.email || selectedTeacherForBio.office_email || 'cse@pust.ac.bd'}</span>
                  </div>

                  {selectedTeacherForBio.personal_email && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Personal Email:</span>
                      <span style={{ color: '#cbd5e1' }}>{selectedTeacherForBio.personal_email}</span>
                    </div>
                  )}

                  {selectedTeacherForBio.phone_number && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Personal Phone:</span>
                      <span style={{ color: '#34d399', fontWeight: 700 }}>{selectedTeacherForBio.phone_number}</span>
                    </div>
                  )}

                  {selectedTeacherForBio.office_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Office Phone:</span>
                      <span style={{ color: '#cbd5e1' }}>{selectedTeacherForBio.office_phone}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Office Location:</span>
                    <span style={{ color: '#fbbf24' }}>{selectedTeacherForBio.room_number || 'Academic Bldg 3, CSE Dept'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #1e293b',
              background: '#09101d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Synced directly from PUST CSE Department Directory (D01)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {selectedTeacherForBio.profile_id && (
                  <a
                    href={`https://pust.ac.bd/academic/departments/dept_teachers/dept_teachers_profile/${selectedTeacherForBio.profile_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(37, 99, 235, 0.2)',
                      border: '1px solid #3b82f6',
                      color: '#93c5fd',
                      padding: '0.5rem 0.95rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>Open PUST Profile</span>
                    <ExternalLink size={13} />
                  </a>
                )}

                <button
                  onClick={() => setSelectedTeacherForBio(null)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
