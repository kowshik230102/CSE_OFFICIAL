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
  Globe, 
  Building, 
  BookMarked,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';

export function TeacherCoursesView({ user, onBackToDashboard }) {
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'ACTIVE', 'ON_LEAVE', 'DEPT_ONLY', 'NON_DEPT_ONLY'
  const [selectedTeacherForBio, setSelectedTeacherForBio] = useState(null);
  const [expandedDatesCourseId, setExpandedDatesCourseId] = useState(null);

  // Live Clock Tick state (re-renders countdowns accurately every second)
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Faculty Members and Course Allocations from Server
  useEffect(() => {
    async function fetchFacultyCourses() {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const res = await fetch('/api/academic/faculty-courses', { credentials: 'include', headers });
        const data = await res.json();
        if (data.faculty) {
          setFacultyList(data.faculty);
        }
      } catch (err) {
        console.error('Failed to load faculty courses:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFacultyCourses();
  }, []);

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

    // Identify days of the week mentioned in scheduleStr
    const daysMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };

    const targetDayIndices = [];
    const lowerSched = (scheduleStr || '').toLowerCase();
    Object.keys(daysMap).forEach(d => {
      if (lowerSched.includes(d)) {
        targetDayIndices.push(daysMap[d]);
      }
    });

    // Default to Sunday & Tuesday if none matched or empty
    if (targetDayIndices.length === 0) {
      targetDayIndices.push(0, 2);
    }

    const remainingDates = [];
    const currentCursor = new Date(now);
    currentCursor.setHours(0, 0, 0, 0);

    // Step day by day from today up to class end date
    while (currentCursor <= targetDate) {
      if (targetDayIndices.includes(currentCursor.getDay())) {
        remainingDates.push(new Date(currentCursor));
      }
      currentCursor.setDate(currentCursor.getDate() + 1);
    }

    return {
      count: remainingDates.length,
      dates: remainingDates
    };
  };

  // Filtered Faculty List
  const filteredFaculty = useMemo(() => {
    return facultyList.filter(teacher => {
      // Text Search Filter
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = `${teacher.first_name} ${teacher.last_name}`.toLowerCase().includes(q);
      const desigMatch = (teacher.designation || '').toLowerCase().includes(q);
      const researchMatch = (teacher.research_area || '').toLowerCase().includes(q);

      const courseMatch = Array.isArray(teacher.currentCourses) && teacher.currentCourses.some(c =>
        c.course_code.toLowerCase().includes(q) ||
        c.course_title.toLowerCase().includes(q) ||
        (c.target_dept && c.target_dept.toLowerCase().includes(q))
      );

      const textPass = !q || nameMatch || desigMatch || researchMatch || courseMatch;

      // Category / Type Filter
      if (filterType === 'ACTIVE') return textPass && !teacher.on_leave;
      if (filterType === 'ON_LEAVE') return textPass && teacher.on_leave;
      if (filterType === 'DEPT_ONLY') return textPass && Array.isArray(teacher.deptCourses) && teacher.deptCourses.length > 0;
      if (filterType === 'NON_DEPT_ONLY') return textPass && Array.isArray(teacher.nonDeptCourses) && teacher.nonDeptCourses.length > 0;

      return textPass;
    });
  }, [facultyList, searchQuery, filterType]);

  // Aggregate stats
  const totalFacultyCount = facultyList.length;
  const activeFacultyCount = facultyList.filter(t => !t.on_leave).length;
  const onLeaveCount = facultyList.filter(t => t.on_leave).length;
  const totalCurrentCoursesCount = facultyList.reduce((acc, t) => acc + (t.currentCourses?.length || 0), 0);
  const totalNonDeptCoursesCount = facultyList.reduce((acc, t) => acc + (t.nonDeptCourses?.length || 0), 0);

  return (
    <div className="teacher-courses-workspace" style={{ paddingBottom: '4rem' }}>
      {/* Top Banner Header */}
      <div className="routine-header-card" style={{
        background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        marginBottom: '1.75rem',
        color: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="btn btn-secondary"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.5rem 0.9rem'
              }}
              title="Return to your workspace"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}>
                <GraduationCap size={24} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Faculty Profiles & Course History
              </h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.35rem 0 0 0' }}>
              Official Department of CSE, PUST faculty members, active department and non-department courses, class ending countdowns & remaining class dates.
            </p>
          </div>
        </div>

        {/* Official Website Link */}
        <div>
          <a
            href="https://pust.ac.bd/academic/departments/dept_teachers/D01"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              color: '#93c5fd',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.1rem'
            }}
          >
            <Globe size={16} />
            <span>PUST CSE Official Portal</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Quick Academic Metric Pills */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div className="card" style={{ padding: '1rem 1.25rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #2563eb' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {totalFacultyCount}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
              Total Faculty ({activeFacultyCount} Active, {onLeaveCount} Study Leave)
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {totalCurrentCoursesCount}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
              Active Ongoing Courses
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
            <Building size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {totalNonDeptCoursesCount}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
              Non-Department (Inter-Faculty)
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.85rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              Active
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
              Real-time Semester Deadlines
            </div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="card" style={{
        padding: '1.25rem',
        marginBottom: '1.75rem',
        background: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search faculty by name, course code, title, or research topic..."
            style={{
              width: '100%',
              padding: '0.65rem 1rem 0.65rem 2.4rem',
              borderRadius: '10px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#0f172a'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {[
            { id: 'ALL', label: 'All Faculty' },
            { id: 'ACTIVE', label: 'Active Teachers' },
            { id: 'ON_LEAVE', label: 'On Study Leave' },
            { id: 'DEPT_ONLY', label: 'Department Courses' },
            { id: 'NON_DEPT_ONLY', label: 'Non-Department Courses' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilterType(btn.id)}
              style={{
                border: '1px solid',
                borderColor: filterType === btn.id ? '#2563eb' : '#e2e8f0',
                background: filterType === btn.id ? '#2563eb' : '#f8fafc',
                color: filterType === btn.id ? '#ffffff' : '#475569',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teachers & Courses Feed */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', color: '#2563eb' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Synchronizing PUST CSE Faculty & Course Allocations...</h3>
        </div>
      ) : filteredFaculty.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
          <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>No faculty members matched your filter.</h4>
          <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Try clearing your search query or selecting "All Faculty".</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {filteredFaculty.map(teacher => {
            const hasCurrentCourses = Array.isArray(teacher.currentCourses) && teacher.currentCourses.length > 0;
            const hasPrevCourses = Array.isArray(teacher.previousCourses) && teacher.previousCourses.length > 0;

            return (
              <div
                key={teacher.id}
                className="card"
                style={{
                  padding: '1.75rem',
                  background: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow-md)',
                  border: teacher.designation?.includes('Chairman') ? '2px solid #3b82f6' : '1px solid var(--border)'
                }}
              >
                {/* Teacher Profile Header Card */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  {/* Photo with frame */}
                  <div style={{ position: 'relative' }}>
                    <img
                      src={teacher.photo_url || 'https://pust.ac.bd/includes/images/teachers/DSC08847 (1).jpg'}
                      alt={`${teacher.first_name} ${teacher.last_name}`}
                      style={{
                        width: '100px',
                        height: '110px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = 'https://pust.ac.bd/includes/images/pust_logo.png';
                      }}
                    />
                    {teacher.designation?.includes('Chairman') && (
                      <span style={{
                        position: 'absolute',
                        bottom: '-8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.5rem',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        CHAIRMAN
                      </span>
                    )}
                  </div>

                  {/* Identity & Contact Details */}
                  <div style={{ flex: '1', minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {teacher.first_name} {teacher.last_name}
                      </h3>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: teacher.on_leave ? '#fef3c7' : '#ecfdf5',
                        color: teacher.on_leave ? '#92400e' : '#065f46',
                        border: teacher.on_leave ? '1px solid #fde68a' : '1px solid #a7f3d0',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '6px'
                      }}>
                        {teacher.on_leave ? 'On Study Leave' : 'Active Faculty'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>
                      {teacher.designation} &bull; Dept of CSE, PUST
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem', fontWeight: 600 }}>
                      🎓 {teacher.qualification || 'Computer Science & Engineering'}
                    </div>

                    {/* Contacts row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.65rem', fontSize: '0.8rem', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', fontWeight: 700 }}>
                        <Phone size={14} />
                        <span>{teacher.phone_number || teacher.personal_phone || teacher.office_phone || '+8801700000000'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Mail size={14} color="#64748b" />
                        <span style={{ fontWeight: 600 }}>{teacher.email}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={14} color="#64748b" />
                        <span>{teacher.room_number || 'Academic Bldg 3, PUST'}</span>
                      </div>
                    </div>

                    {/* Research & Publications */}
                    {teacher.research_area && (
                      <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <strong>Research Areas:</strong> {teacher.research_area}
                        {teacher.publications_count > 0 && (
                          <span style={{ marginLeft: '0.75rem', fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                            {teacher.publications_count} Publications
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Full Bio Trigger Button */}
                  <div>
                    <button
                      onClick={() => setSelectedTeacherForBio(teacher)}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '0.5rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1'
                      }}
                    >
                      <FileText size={15} color="#2563eb" />
                      <span>Teacher Bio</span>
                    </button>
                  </div>
                </div>

                {/* ACTIVE COURSES (DEPARTMENT & NON-DEPARTMENT) WITH LIVE COUNTDOWN */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BookMarked size={18} color="#2563eb" />
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Currently Assigned Courses ({teacher.currentCourses?.length || 0})
                      </h4>
                    </div>

                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                      ⚡ Live Semester End Countdown Active
                    </span>
                  </div>

                  {!hasCurrentCourses ? (
                    <div style={{
                      padding: '1rem 1.25rem',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px dashed #cbd5e1',
                      fontSize: '0.85rem',
                      color: '#64748b'
                    }}>
                      {teacher.on_leave 
                        ? 'Faculty member is currently on Higher Study Leave (Ph.D. research abroad). No current courses assigned for this semester.'
                        : 'No active courses currently allocated in this running semester.'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                      {teacher.currentCourses.map(course => {
                        const isNonDept = course.course_type === 'NON_DEPARTMENT';
                        const countdown = calculateCountdown(course.class_end_date);
                        const remaining = calculateRemainingClasses(course.weekly_schedule, course.class_end_date);
                        const isDatesExpanded = expandedDatesCourseId === course.id;

                        return (
                          <div
                            key={course.id}
                            style={{
                              background: isNonDept ? '#faf5ff' : '#f8fafc',
                              border: isNonDept ? '1px solid #d8b4fe' : '1px solid #e2e8f0',
                              borderLeft: isNonDept ? '4px solid #7c3aed' : '4px solid #2563eb',
                              borderRadius: '12px',
                              padding: '1.1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                            }}
                          >
                            <div>
                              {/* Top Course Tag & Type */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  background: isNonDept ? '#7c3aed' : '#2563eb',
                                  color: '#ffffff',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px'
                                }}>
                                  {course.course_code}
                                </span>

                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  background: isNonDept ? '#ede9fe' : '#eff6ff',
                                  color: isNonDept ? '#6d28d9' : '#1d4ed8',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '6px'
                                }}>
                                  {isNonDept ? `🌐 ${course.target_dept}` : '🏛️ CSE DEPARTMENT'}
                                </span>
                              </div>

                              {/* Course Title */}
                              <h5 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                                {course.course_title}
                              </h5>

                              {/* Session & Semester */}
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {course.session_name} &bull; {course.semester_name} &bull; {course.credit_hours} Credits
                              </div>

                              {/* Weekly Class Schedule */}
                              <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                                <Clock size={14} color="#2563eb" />
                                <span>Schedule: {course.weekly_schedule || 'Sunday & Tuesday'}</span>
                              </div>
                            </div>

                            {/* DEADLINE COUNTDOWN & REMAINING CLASS DATES WIDGET */}
                            <div style={{
                              marginTop: '0.85rem',
                              padding: '0.75rem',
                              background: '#ffffff',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0'
                            }}>
                              {/* Ending Date & Live Countdown */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                  Class End Date: <strong style={{ color: '#0f172a' }}>{new Date(course.class_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                                </div>

                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  color: countdown.expired ? '#991b1b' : '#059669',
                                  background: countdown.expired ? '#fee2e2' : '#ecfdf5',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}>
                                  <Clock size={12} />
                                  <span>{countdown.text}</span>
                                </div>
                              </div>

                              {/* Remaining Classes Count & Toggle List */}
                              <div style={{
                                marginTop: '0.65rem',
                                paddingTop: '0.5rem',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <div style={{ fontSize: '0.775rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Calendar size={14} color="#2563eb" />
                                  <span>{remaining.count} Classes Remaining until Deadline</span>
                                </div>

                                {remaining.count > 0 && (
                                  <button
                                    onClick={() => setExpandedDatesCourseId(isDatesExpanded ? null : course.id)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '0.725rem',
                                      fontWeight: 700,
                                      color: '#2563eb',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.2rem'
                                    }}
                                  >
                                    <span>{isDatesExpanded ? 'Hide Dates' : 'View Dates'}</span>
                                    {isDatesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                )}
                              </div>

                              {/* Expandable Upcoming Class Dates List */}
                              {isDatesExpanded && remaining.dates.length > 0 && (
                                <div style={{
                                  marginTop: '0.65rem',
                                  padding: '0.5rem',
                                  background: '#f8fafc',
                                  borderRadius: '8px',
                                  maxHeight: '140px',
                                  overflowY: 'auto',
                                  fontSize: '0.725rem'
                                }}>
                                  <div style={{ fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>
                                    Upcoming Class Dates:
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {remaining.dates.map((d, dIdx) => (
                                      <span key={dIdx} style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        color: '#0f172a'
                                      }}>
                                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* PREVIOUS COURSE TEACHING HISTORY */}
                {hasPrevCourses && (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '1rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
                      <Layers size={16} color="#64748b" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Previous Course Teaching History ({teacher.previousCourses.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {teacher.previousCourses.map((pc, pIdx) => (
                        <div
                          key={pIdx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.775rem'
                          }}
                        >
                          <strong style={{ color: '#1e3a8a' }}>{pc.course_code}:</strong> {pc.course_title}
                          <span style={{ marginLeft: '0.4rem', color: '#64748b', fontSize: '0.7rem' }}>
                            ({pc.session_name} &bull; {pc.semester_name})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TEACHER FULL BIO MODAL */}
      {selectedTeacherForBio && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '680px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Faculty Academic Profile
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  Department of Computer Science & Engineering, PUST
                </p>
              </div>

              <button
                onClick={() => setSelectedTeacherForBio(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: '1', overflowY: 'auto', padding: '1.75rem' }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <img
                  src={selectedTeacherForBio.photo_url || 'https://pust.ac.bd/includes/images/teachers/DSC08847 (1).jpg'}
                  alt={selectedTeacherForBio.fullName}
                  style={{
                    width: '90px',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0'
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {selectedTeacherForBio.first_name} {selectedTeacherForBio.last_name}
                  </h3>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>
                    {selectedTeacherForBio.designation}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
                    Department of Computer Science & Engineering
                  </div>
                </div>
              </div>

              {/* Bio Summary */}
              {selectedTeacherForBio.bio && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Biography & Academic Overview
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    {selectedTeacherForBio.bio}
                  </p>
                </div>
              )}

              {/* Key Credentials Table */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.85rem',
                fontSize: '0.825rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <strong style={{ color: '#475569' }}>Academic Qualification:</strong>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                    {selectedTeacherForBio.qualification || 'B.Sc. & M.Sc. in CSE'}
                  </div>
                </div>

                <div>
                  <strong style={{ color: '#475569' }}>Total Publications:</strong>
                  <div style={{ fontWeight: 800, color: '#dc2626', marginTop: '0.15rem' }}>
                    {selectedTeacherForBio.publications_count || 0} Peer-Reviewed Articles
                  </div>
                </div>

                <div>
                  <strong style={{ color: '#475569' }}>Office Contact:</strong>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                    {selectedTeacherForBio.office_phone || '+8802588844876'}
                  </div>
                </div>

                <div>
                  <strong style={{ color: '#475569' }}>Verified Phone:</strong>
                  <div style={{ fontWeight: 800, color: '#0284c7', marginTop: '0.15rem' }}>
                    {selectedTeacherForBio.phone_number || selectedTeacherForBio.personal_phone || '+8801700000000'}
                  </div>
                </div>

                <div>
                  <strong style={{ color: '#475569' }}>Email Address:</strong>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                    {selectedTeacherForBio.email}
                  </div>
                </div>

                <div>
                  <strong style={{ color: '#475569' }}>Room / Office:</strong>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                    {selectedTeacherForBio.room_number || 'Academic Bldg 3, Room 402'}
                  </div>
                </div>
              </div>

              {/* Research Areas */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Research Interests & Specializations
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {(selectedTeacherForBio.research_area || 'Artificial Intelligence, Machine Learning, Data Science')
                    .split(',')
                    .map((item, idx) => (
                      <span key={idx} style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.775rem',
                        fontWeight: 700
                      }}>
                        {item.trim()}
                      </span>
                    ))}
                </div>
              </div>

              {/* Direct University Profile Link */}
              {selectedTeacherForBio.profile_id && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <a
                    href={`https://pust.ac.bd/academic/departments/dept_teachers/dept_teachers_profile/${selectedTeacherForBio.profile_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0.6rem 1.25rem'
                    }}
                  >
                    <span>View University Full Dossier on PUST Portal</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherCoursesView;
