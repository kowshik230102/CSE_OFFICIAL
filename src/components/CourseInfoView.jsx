import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Calendar, 
  Search, 
  Filter, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  PlusCircle, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  Download, 
  GraduationCap,
  Award,
  ChevronDown,
  Info
} from 'lucide-react';

export function CourseInfoView({ user, onBackToDashboard }) {
  const [curriculumData, setCurriculumData] = useState({ semesters: [], total_courses: 0, total_credits: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTermFilter, setActiveTermFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'Theory' | 'Sessional' | 'Viva' | 'Elective'
  const [copiedCode, setCopiedCode] = useState(null);

  // Add Course Modal (For Teachers, Office Staff, Admin)
  const isFacultyOrAdmin = user?.role === 'TEACHER' || user?.role === 'OFFICE_STAFF' || user?.role === 'ADMIN';
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFeedback, setAddFeedback] = useState(null);
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({
    semesterId: '',
    courseCode: '',
    courseTitle: '',
    creditHours: '3.0',
    courseType: 'Theory',
    syllabusOutline: ''
  });

  useEffect(() => {
    fetchCurriculum();
  }, []);

  const fetchCurriculum = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('cse_token') || localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // First try /api/academic/curriculum
      const res = await fetch('/api/academic/curriculum', { headers });
      const data = await res.json();
      if (data.semesters && data.semesters.length > 0) {
        setCurriculumData(data);
        if (data.semesters[0]?.semester_id || data.semesters[0]?.id) {
          setCourseForm(prev => ({ ...prev, semesterId: data.semesters[0]?.semester_id || data.semesters[0]?.id }));
        }
      } else {
        // Fallback to /api/courses/curriculum
        const res2 = await fetch('/api/courses/curriculum');
        const data2 = await res2.json();
        if (data2.curriculum) {
          // Format curriculum response to semesters format
          const formattedSemesters = [];
          Object.keys(data2.curriculum).forEach(yearKey => {
            const yr = data2.curriculum[yearKey];
            Object.keys(yr.semesters).forEach(termKey => {
              const sem = yr.semesters[termKey];
              formattedSemesters.push({
                id: `sem-${termKey.toLowerCase()}`,
                semester_id: `sem-${termKey.toLowerCase()}`,
                term_code: termKey,
                semester_name: sem.name,
                total_credits: sem.totalCredits,
                courses: sem.courses.map(c => ({
                  id: `c-${termKey}-${c.courseCode.replace(/[^a-z0-9]/gi, '')}`,
                  course_code: c.courseCode,
                  course_title: c.courseTitle,
                  credit_hours: c.creditHours,
                  course_type: c.courseType,
                  is_optional: c.isOptional ? 1 : 0,
                  elective_group: c.electiveGroup,
                  syllabus_outline: c.syllabusOutline
                }))
              });
            });
          });
          setCurriculumData({
            semesters: formattedSemesters,
            total_courses: data2.summary?.totalCourses || 92,
            total_credits: data2.summary?.totalCredits || 164.75
          });
        }
      }
    } catch (err) {
      console.error('Failed to load curriculum:', err);
      setError('Could not connect to the academic curriculum database. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.courseCode || !courseForm.courseTitle || !courseForm.semesterId) {
      setAddFeedback({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    setSubmittingCourse(true);
    setAddFeedback(null);
    const token = localStorage.getItem('cse_token') || localStorage.getItem('token');

    try {
      const res = await fetch('/api/academic/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(courseForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create course');

      setAddFeedback({ type: 'success', text: `Course ${courseForm.courseCode} added successfully!` });
      setCourseForm({
        semesterId: curriculumData.semesters[0]?.semester_id || curriculumData.semesters[0]?.id || '',
        courseCode: '',
        courseTitle: '',
        creditHours: '3.0',
        courseType: 'Theory',
        syllabusOutline: ''
      });
      await fetchCurriculum();
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddFeedback(null);
      }, 1500);
    } catch (err) {
      setAddFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmittingCourse(false);
    }
  };

  // Filtered Semesters and Courses
  const filteredSemesters = useMemo(() => {
    const list = curriculumData.semesters || [];
    return list
      .filter(sem => activeTermFilter === 'ALL' || sem.term_code === activeTermFilter)
      .map(sem => {
        const filteredCourses = (sem.courses || []).filter(c => {
          // Search query check
          const q = searchQuery.toLowerCase().trim();
          const matchQuery = !q || 
            (c.course_code && c.course_code.toLowerCase().includes(q)) ||
            (c.course_title && c.course_title.toLowerCase().includes(q)) ||
            (c.syllabus_outline && c.syllabus_outline.toLowerCase().includes(q));

          // Type filter check
          let matchType = true;
          if (typeFilter === 'Theory') {
            matchType = c.course_type === 'Theory';
          } else if (typeFilter === 'Sessional') {
            matchType = c.course_type === 'Sessional' || c.course_type === 'LAB';
          } else if (typeFilter === 'Viva') {
            matchType = c.course_type === 'Viva';
          } else if (typeFilter === 'Elective') {
            matchType = c.is_optional === 1 || !!c.elective_group;
          }

          return matchQuery && matchType;
        });

        return {
          ...sem,
          courses: filteredCourses,
          displayCount: filteredCourses.length
        };
      })
      .filter(sem => sem.courses.length > 0 || !searchQuery);
  }, [curriculumData, activeTermFilter, searchQuery, typeFilter]);

  const totalFilteredCourses = useMemo(() => {
    return filteredSemesters.reduce((sum, sem) => sum + (sem.courses?.length || 0), 0);
  }, [filteredSemesters]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ========================================================= */}
      {/* 1. HERO HEADER WITH DEPARTMENT BRANDING & STATS */}
      {/* ========================================================= */}
      <div className="role-hero-banner hero-teacher" style={{
        background: 'linear-gradient(135deg, #09101d 0%, #1e1b4b 45%, #1e3a8a 100%)',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ 
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)', 
              color: '#ffffff', 
              fontWeight: 800, 
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
            }}>
              📚 Official Undergraduate Curriculum
            </span>
            <span style={{ 
              fontSize: '0.8rem', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '0.2rem 0.65rem', 
              borderRadius: '6px', 
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1'
            }}>
              B.Sc. Engineering (CSE) • 4 Years (8 Semesters)
            </span>
          </div>

          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)', margin: 0 }}>
            Curriculum & Course Information System
          </h2>
          <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '0.35rem', maxWidth: '750px', color: '#e2e8f0', lineHeight: 1.5 }}>
            Explore complete department course distributions from Year 1 Semester 1 through Year 4 Semester 2. Inspect credit breakdowns, syllabi, elective groups, and designated course teachers.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s ease'
                }}
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
            )}

            {isFacultyOrAdmin && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1.15rem',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                <PlusCircle size={16} /> + Add New Course
              </button>
            )}

            <button
              onClick={fetchCurriculum}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0.5rem 0.9rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Catalog
            </button>
          </div>
        </div>

        {/* Hero Statistics Widgets */}
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">92</div>
            <div className="hero-stat-lbl">Total Courses</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">8</div>
            <div className="hero-stat-lbl">Semesters</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">164.75</div>
            <div className="hero-stat-lbl">Total Credits</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">14</div>
            <div className="hero-stat-lbl">Electives</div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SEARCH & FILTER CONTROLS */}
      {/* ========================================================= */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Live Search Input */}
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by course code, title, or syllabus keyword (e.g., CSE 1101, Algorithms, Database)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.65rem',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* Course Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Type:</span>
            {[
              { id: 'ALL', label: 'All Types' },
              { id: 'Theory', label: '📖 Theory' },
              { id: 'Sessional', label: '🔬 Sessional' },
              { id: 'Viva', label: '🗣️ Viva' },
              { id: 'Elective', label: '⭐ Electives' }
            ].map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setTypeFilter(type.id)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  background: typeFilter === type.id ? '#2563eb' : '#f8fafc',
                  color: typeFilter === type.id ? '#ffffff' : '#475569',
                  borderColor: typeFilter === type.id ? '#2563eb' : '#e2e8f0',
                  transition: 'all 0.15s ease'
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Semester Term Navigation Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', flexShrink: 0, marginRight: '0.25rem' }}>
            Term Jump:
          </span>
          <button
            type="button"
            onClick={() => setActiveTermFilter('ALL')}
            style={{
              padding: '0.4rem 0.95rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: '1.5px solid',
              whiteSpace: 'nowrap',
              background: activeTermFilter === 'ALL' ? '#0f172a' : '#ffffff',
              color: activeTermFilter === 'ALL' ? '#ffffff' : '#334155',
              borderColor: activeTermFilter === 'ALL' ? '#0f172a' : '#cbd5e1'
            }}
          >
            All 8 Semesters
          </button>

          {(curriculumData.semesters || []).map(sem => (
            <button
              key={sem.semester_id || sem.id}
              type="button"
              onClick={() => setActiveTermFilter(sem.term_code)}
              style={{
                padding: '0.4rem 0.95rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1.5px solid',
                whiteSpace: 'nowrap',
                background: activeTermFilter === sem.term_code ? '#2563eb' : '#ffffff',
                color: activeTermFilter === sem.term_code ? '#ffffff' : '#475569',
                borderColor: activeTermFilter === sem.term_code ? '#2563eb' : '#cbd5e1',
                transition: 'all 0.15s ease'
              }}
            >
              {sem.term_code} • {sem.semester_name?.replace('Semester', 'Sem')}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CURRICULUM SEMESTERS & COURSE CARDS */}
      {/* ========================================================= */}
      {loading ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '4rem 2rem',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <RefreshCw className="spin" size={32} style={{ margin: '0 auto 0.75rem', color: '#2563eb' }} />
          <h4 style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem' }}>Loading Official Curriculum Courses...</h4>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>Fetching 92 verified courses from database...</p>
        </div>
      ) : error ? (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          color: '#991b1b'
        }}>
          <AlertCircle size={32} style={{ margin: '0 auto 0.5rem', color: '#dc2626' }} />
          <h4 style={{ fontWeight: 800, margin: '0 0 0.35rem' }}>Failed to Load Curriculum Data</h4>
          <p style={{ fontSize: '0.85rem' }}>{error}</p>
          <button
            onClick={fetchCurriculum}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            Try Again
          </button>
        </div>
      ) : filteredSemesters.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <BookOpen size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
          <h4 style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>No Courses Found</h4>
          <p style={{ fontSize: '0.85rem' }}>No course matches "{searchQuery}". Try clearing filters or search terms.</p>
          <button
            onClick={() => { setSearchQuery(''); setActiveTermFilter('ALL'); setTypeFilter('ALL'); }}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {filteredSemesters.map((sem) => (
            <div
              key={sem.semester_id || sem.id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              {/* Semester Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #f1f5f9',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
                  }}>
                    {sem.term_code}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                      {sem.semester_name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb' }}>
                        {sem.courses?.length || 0} Courses
                      </span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {sem.total_credits || 0} Total Credits
                      </span>
                    </div>
                  </div>
                </div>

                {isFacultyOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setCourseForm(prev => ({ ...prev, semesterId: sem.semester_id || sem.id }));
                      setIsAddModalOpen(true);
                      setAddFeedback(null);
                    }}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'background 0.2s'
                    }}
                  >
                    <PlusCircle size={15} /> Add Course to {sem.term_code}
                  </button>
                )}
              </div>

              {/* Course Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                gap: '1.15rem'
              }}>
                {(sem.courses || []).map((c) => {
                  const isSessional = c.course_type === 'Sessional' || c.course_type === 'LAB';
                  const isViva = c.course_type === 'Viva';
                  const isElective = c.is_optional === 1 || !!c.elective_group;

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#93c5fd';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Top Row: Course Code badge + Type Badge + Credit */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.course_code)}
                              title="Click to copy course code"
                              style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontWeight: 800,
                                fontSize: '0.825rem',
                                color: '#1e40af',
                                background: '#dbeafe',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              {c.course_code}
                              {copiedCode === c.course_code ? <Check size={12} color="#16a34a" /> : <Copy size={11} color="#60a5fa" />}
                            </button>

                            {/* Course Type Badge */}
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: isSessional ? '#6d28d9' : isViva ? '#b45309' : '#0369a1',
                              background: isSessional ? '#f5f3ff' : isViva ? '#fef3c7' : '#e0f2fe',
                              border: `1px solid ${isSessional ? '#ddd6fe' : isViva ? '#fde68a' : '#bae6fd'}`,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px'
                            }}>
                              {isSessional ? '🔬 Sessional' : isViva ? '🗣️ Viva Voce' : '📖 Theory'}
                            </span>

                            {/* Optional / Elective Group Tag */}
                            {isElective && (
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                color: '#be185d',
                                background: '#fdf2f8',
                                border: '1px solid #fbcfe8',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px'
                              }}>
                                ⭐ {c.elective_group || 'Elective'}
                              </span>
                            )}
                          </div>

                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                            {c.course_title}
                          </h4>
                        </div>

                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          color: '#047857',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '8px',
                          whiteSpace: 'nowrap'
                        }}>
                          {c.credit_hours} Cr
                        </span>
                      </div>

                      {/* Syllabus Outline Box */}
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                        color: '#334155',
                        lineHeight: 1.45,
                        flex: 1
                      }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                          Syllabus Specification:
                        </div>
                        {c.syllabus_outline || 'Comprehensive course syllabus outline, laboratory benchmarks, and evaluation criteria.'}
                      </div>

                      {/* Footer: Designated Faculty */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.76rem',
                        color: '#64748b',
                        borderTop: '1px dashed #cbd5e1',
                        paddingTop: '0.5rem',
                        flexWrap: 'wrap',
                        gap: '0.35rem'
                      }}>
                        <span>
                          Faculty: <strong style={{ color: '#1e293b' }}>{c.assigned_teacher_name || 'Department Faculty'}</strong>
                        </span>
                        {c.assigned_teacher_designation && (
                          <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>
                            {c.assigned_teacher_designation}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ADD COURSE MODAL (TEACHER / OFFICE / ADMIN) */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Add New Curriculum Course</h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setAddFeedback(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            {addFeedback && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: addFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: addFeedback.type === 'success' ? '#15803d' : '#b91c1c'
              }}>
                {addFeedback.text}
              </div>
            )}

            <form onSubmit={handleCreateCourse} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                  Target Semester *
                </label>
                <select
                  required
                  value={courseForm.semesterId}
                  onChange={(e) => setCourseForm({ ...courseForm, semesterId: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  {(curriculumData.semesters || []).map(sem => (
                    <option key={sem.semester_id || sem.id} value={sem.semester_id || sem.id}>
                      {sem.term_code} — {sem.semester_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE 4101"
                    value={courseForm.courseCode}
                    onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                    Credit Hours *
                  </label>
                  <select
                    value={courseForm.creditHours}
                    onChange={(e) => setCourseForm({ ...courseForm, creditHours: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="3.0">3.0 Credits (Theory)</option>
                    <option value="1.5">1.5 Credits (Sessional/Lab)</option>
                    <option value="1.0">1.0 Credits (Engineering Drawing)</option>
                    <option value="0.75">0.75 Credits (Sessional / Viva)</option>
                    <option value="2.0">2.0 Credits</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software Engineering"
                  value={courseForm.courseTitle}
                  onChange={(e) => setCourseForm({ ...courseForm, courseTitle: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                  Course Type *
                </label>
                <select
                  value={courseForm.courseType}
                  onChange={(e) => setCourseForm({ ...courseForm, courseType: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Theory">Theory Course</option>
                  <option value="Sessional">Sessional / Laboratory</option>
                  <option value="Viva">Viva Voce</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                  Syllabus Outline (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline core topics, lecture units, and laboratory benchmarks..."
                  value={courseForm.syllabusOutline}
                  onChange={(e) => setCourseForm({ ...courseForm, syllabusOutline: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '0.65rem 1.15rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCourse}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#ffffff', cursor: 'pointer', fontWeight: 700 }}
                >
                  {submittingCourse ? 'Saving...' : 'Add Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
