import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeBoard } from './NoticeBoard';
import { computeStudentCA, computeClassRanks, formatOrdinal } from '../utils/assessment';
import { 
  BookOpen, 
  Award, 
  Bell, 
  MessageSquare, 
  Download, 
  User, 
  Pin, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Send, 
  Calendar,
  Layers,
  Sparkles,
  Medal
} from 'lucide-react';

export const StudentView = ({ initialTab = 'courses' }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Academic data
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseMaterials, setCourseMaterials] = useState([]);

  // CT Marks
  const [myMarks, setMyMarks] = useState([]);
  const [allCourseMarks, setAllCourseMarks] = useState([]);

  // Notices
  const [notices, setNotices] = useState([]);
  const [noticeFilter, setNoticeFilter] = useState('ALL');

  // Grievance / Feedback
  const [publicFeed, setPublicFeed] = useState([]);
  const [newGrievance, setNewGrievance] = useState({
    category: 'ACADEMIC',
    subject: '',
    description: '',
    isAnonymous: false,
  });
  const [submissionStatus, setSubmissionStatus] = useState(null);

  // 1. Initial Load
  useEffect(() => {
    fetchSessions();
    fetchNotices();
    fetchPublicGrievances();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/academic/sessions', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSessions(data.sessions || []);
      // Default to student's current session or first current
      const active = data.sessions?.find(s => s.is_current) || data.sessions?.[0];
      if (active) setSelectedSessionId(active.id);
    } catch (e) { console.error(e); }
  };

  const fetchNotices = async () => {
    try {
      const res = await fetch('/api/notices', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setNotices(data.notices || []);
    } catch (e) { console.error(e); }
  };

  const fetchPublicGrievances = async () => {
    try {
      const res = await fetch('/api/grievances/public-feed', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setPublicFeed(data.grievances || []);
    } catch (e) { console.error(e); }
  };

  // 2. Fetch Semesters on Session Selection
  useEffect(() => {
    if (selectedSessionId) {
      fetch(`/api/academic/sessions/${selectedSessionId}/semesters`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          setSemesters(data.semesters || []);
          const active = data.semesters?.find(s => s.is_active) || data.semesters?.[0];
          if (active) setSelectedSemesterId(active.id);
        });
    }
  }, [selectedSessionId]);

  // 3. Fetch Courses on Semester Selection
  useEffect(() => {
    if (selectedSemesterId) {
      fetch(`/api/academic/semesters/${selectedSemesterId}/courses`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          setCourses(data.courses || []);
          if (data.courses?.length > 0) {
            handleSelectCourse(data.courses[0]);
          } else {
            setSelectedCourse(null);
            setCourseMaterials([]);
          }
        });
    }
  }, [selectedSemesterId]);

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    // Fetch materials
    fetch(`/api/courses/${course.id}/materials`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setCourseMaterials(data.materials || []));

    // Fetch marks for this student + relative session marks for rank calculation
    fetch(`/api/courses/${course.id}/ct-marks`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setMyMarks(data.marks || []);
        setAllCourseMarks(data.allCourseMarks || []);
      });
  };

  // Grievance Submit Handler
  const handleSubmitGrievance = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newGrievance),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSubmissionStatus({ type: 'success', text: data.message });
      setNewGrievance({ category: 'ACADEMIC', subject: '', description: '', isAnonymous: false });
      setTimeout(() => setSubmissionStatus(null), 5000);
    } catch (err) {
      setSubmissionStatus({ type: 'error', text: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Student Profile Hero Banner */}
      <div className="role-hero-banner hero-student">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <span className="live-beacon" style={{ marginRight: '4px' }}></span> Undergraduate Student
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
              Roll: <strong style={{ fontFamily: 'var(--font-mono)' }}>{user.studentRoll}</strong> • Reg: <strong style={{ fontFamily: 'var(--font-mono)' }}>{user.registrationNo}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            Welcome, {user.firstName} {user.lastName}
          </h2>
          <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '0.3rem', maxWidth: '650px' }}>
            Enrolled in {user.sessionName || 'Session 2023-2024'} • Department of Computer Science & Engineering
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">{courses.length}</div>
            <div className="hero-stat-lbl">Enrolled Courses</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">{notices.length}</div>
            <div className="hero-stat-lbl">Notice Feed</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">{myMarks.length}</div>
            <div className="hero-stat-lbl">CT Scores</div>
          </div>
        </div>
      </div>

      {/* Main Dynamic Segmented Tab Navigation */}
      <div className="segmented-nav-wrapper">
        <button
          onClick={() => setActiveTab('courses')}
          className={`segmented-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
        >
          <BookOpen size={16} style={{ color: activeTab === 'courses' ? '#2563eb' : '#64748b' }} /> 
          <span>1. Academic Courses & Materials</span>
        </button>
        <button
          onClick={() => setActiveTab('marks')}
          className={`segmented-tab-btn ${activeTab === 'marks' ? 'active' : ''}`}
        >
          <Award size={16} style={{ color: activeTab === 'marks' ? '#2563eb' : '#64748b' }} /> 
          <span>2. My Class Test (CT) Marks</span>
        </button>
        <button
          onClick={() => setActiveTab('notices')}
          className={`segmented-tab-btn ${activeTab === 'notices' ? 'active' : ''}`}
        >
          <Bell size={16} style={{ color: activeTab === 'notices' ? '#2563eb' : '#64748b' }} /> 
          <span>3. Department Notice Board</span>
          <span style={{ 
            fontSize: '0.7rem', 
            background: activeTab === 'notices' ? '#eff6ff' : '#f1f5f9', 
            color: activeTab === 'notices' ? '#2563eb' : '#64748b', 
            padding: '0.1rem 0.5rem', 
            borderRadius: '999px',
            fontWeight: 700 
          }}>
            {notices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('grievances')}
          className={`segmented-tab-btn ${activeTab === 'grievances' ? 'active' : ''}`}
        >
          <MessageSquare size={16} style={{ color: activeTab === 'grievances' ? '#2563eb' : '#64748b' }} /> 
          <span>4. Student Voice & Grievances</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ACADEMIC EXPLORER & MATERIALS */}
      {/* ========================================================= */}
      {activeTab === 'courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Left: Session & Semester Selectors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card">
              <h3 className="card-title"><Calendar size={18} /> Select Academic Term</h3>
              
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Academic Session</label>
                <select
                  className="form-select"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.session_name} {s.is_current ? '(Current)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Semester</label>
                <select
                  className="form-select"
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                >
                  {semesters.map((sem) => (
                    <option key={sem.id} value={sem.id}>{sem.semester_name} ({sem.term_code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Course List under this semester */}
            <div className="card">
              <h3 className="card-title">Offered Courses ({courses.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.85rem' }}>
                {courses.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>
                    No courses scheduled for this semester yet.
                  </div>
                ) : (
                  courses.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCourse(c)}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '12px',
                        border: selectedCourse?.id === c.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: selectedCourse?.id === c.id ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: selectedCourse?.id === c.id ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCourse?.id !== c.id) {
                          e.currentTarget.style.borderColor = '#93c5fd';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCourse?.id !== c.id) {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#2563eb', fontFamily: 'var(--font-mono)' }}>{c.course_code}</span>
                        <span className={`badge ${c.course_type === 'LAB' ? 'badge-lab' : 'badge-theory'}`}>{c.course_type}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, marginTop: '0.25rem', color: '#0f172a' }}>{c.course_title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>Faculty:</span>
                        <strong style={{ color: '#334155' }}>{c.assigned_teacher_name || 'TBA'}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Selected Course Details & Materials */}
          {selectedCourse ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span className="badge badge-teacher">{selectedCourse.course_code}</span>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0.5rem 0 0.25rem', letterSpacing: '-0.01em' }}>
                      {selectedCourse.course_title}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {selectedCourse.credit_hours} Credit Hours • {selectedCourse.course_type}
                    </div>
                  </div>

                  {selectedCourse.assigned_teacher_name && (
                    <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Designated Faculty</div>
                      <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#0f172a' }}>{selectedCourse.assigned_teacher_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{selectedCourse.assigned_teacher_designation}</div>
                    </div>
                  )}
                </div>

                {selectedCourse.syllabus_outline && (
                  <div style={{ marginTop: '1rem', padding: '0.9rem', background: '#f8fafc', borderRadius: '10px', fontSize: '0.85rem', border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>Course Outline & Syllabus:</strong> {selectedCourse.syllabus_outline}
                  </div>
                )}
              </div>

              {/* Course Materials */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Download size={18} /> Official Lecture Materials ({courseMaterials.length})
                  </h3>
                  <span className="badge badge-active">Verified Faculty Uploads</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {courseMaterials.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      No lecture notes or slides uploaded by the faculty yet. Check back soon.
                    </div>
                  ) : (
                    courseMaterials.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '1rem 1.25rem',
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#93c5fd';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#0f172a' }}>{m.title}</div>
                          {m.description && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                              {m.description}
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                            Uploaded by {m.uploader_name} on {new Date(m.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: '8px', padding: '0.45rem 0.85rem' }}
                        >
                          <Download size={14} /> Download
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
              <BookOpen size={40} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Select a Course to View Materials</h4>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.3rem' }}>Please select a semester and course from the left to view syllabus and lecture notes.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CONTINUOUS ASSESSMENT (CA) & CT MARKS */}
      {/* ========================================================= */}
      {activeTab === 'marks' && (() => {
        // Calculate Continuous Assessment (30 Marks total)
        const studentCt1 = myMarks.find(m => m.ct_number === 1)?.obtained_marks ?? '';
        const studentCt2 = myMarks.find(m => m.ct_number === 2)?.obtained_marks ?? '';
        const studentCt3 = myMarks.find(m => m.ct_number === 3)?.obtained_marks ?? '';
        const studentAttendance = myMarks.find(m => m.ct_number === 4)?.obtained_marks ?? '';

        const studentCA = computeStudentCA(studentCt1, studentCt2, studentCt3, studentAttendance);

        // Group all course marks by student_id to calculate relative position / rank in class
        const studentMarksMap = {};
        allCourseMarks.forEach(m => {
          if (!studentMarksMap[m.student_id]) {
            studentMarksMap[m.student_id] = { ct1: '', ct2: '', ct3: '', attendance: '' };
          }
          if (m.ct_number === 1) studentMarksMap[m.student_id].ct1 = m.obtained_marks;
          else if (m.ct_number === 2) studentMarksMap[m.student_id].ct2 = m.obtained_marks;
          else if (m.ct_number === 3) studentMarksMap[m.student_id].ct3 = m.obtained_marks;
          else if (m.ct_number === 4) studentMarksMap[m.student_id].attendance = m.obtained_marks;
        });

        // Ensure current student is evaluated even if only in myMarks
        if (user.studentId && !studentMarksMap[user.studentId]) {
          studentMarksMap[user.studentId] = {
            ct1: studentCt1,
            ct2: studentCt2,
            ct3: studentCt3,
            attendance: studentAttendance,
          };
        }

        const studentsWithCA = Object.entries(studentMarksMap).map(([sId, marks]) => ({
          studentId: sId,
          totalCA: computeStudentCA(marks.ct1, marks.ct2, marks.ct3, marks.attendance).totalCA,
        }));

        const classRankMap = computeClassRanks(studentsWithCA);
        const myRank = classRankMap[user.studentId];
        const rankClass = myRank === 1 ? 'rank-1' : myRank === 2 ? 'rank-2' : myRank === 3 ? 'rank-3' : myRank ? 'rank-other' : 'rank-none';

        return (
          <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Course Selector Dropdown for Tab 2 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#ffffff', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Selected Course Grade Sheet</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedCourse ? `${selectedCourse.course_code}: ${selectedCourse.course_title}` : 'No Course Selected'}
                </div>
              </div>

              {courses.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>Switch Course:</span>
                  <select
                    className="form-select"
                    value={selectedCourse?.id || ''}
                    onChange={(e) => {
                      const c = courses.find(item => item.id === e.target.value);
                      if (c) handleSelectCourse(c);
                    }}
                    style={{ minWidth: '220px', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.course_code} - {c.course_title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Continuous Assessment Summary Card */}
            <div className="student-ca-summary-card">
              <div className="student-ca-hero">
                <div>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.22)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)', marginBottom: '0.4rem' }}>
                    Continuous Assessment (CA) System
                  </span>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0' }}>
                    {selectedCourse?.course_code} Continuous Assessment Score
                  </h3>
                  <p style={{ fontSize: '0.85rem', opacity: 0.9, margin: 0 }}>
                    Evaluation Formula: Best 2 of 3 Class Tests (20 Marks) + Attendance (10 Marks) = 30 Marks Total
                  </p>
                </div>

                <div className="student-ca-score-display">
                  <div className="score-circle-badge">
                    <span className="score-circle-num">{studentCA.totalCA !== null ? studentCA.totalCA : '—'}</span>
                    <span className="score-circle-max">/ 30 Marks</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Letter Grade:</span>
                      <span className={`grade-badge ${studentCA.gradeClass}`}>
                        {studentCA.grade}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Class Position:</span>
                      <span className={`rank-pill ${rankClass}`} style={{ background: myRank === 1 ? '#fef08a' : 'rgba(255,255,255,0.25)', color: myRank === 1 ? '#713f12' : '#ffffff', border: '1px solid rgba(255,255,255,0.4)' }}>
                        {myRank === 1 && <Medal size={13} />}
                        {formatOrdinal(myRank)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assessment Breakdown Metric Widgets */}
              <div className="student-ca-stats-grid">
                <div className="student-ca-stat-item">
                  <span className="lbl">Class Test 1</span>
                  <span className="val">{studentCA.c1 !== null ? studentCA.c1 : '—'} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ 10</span></span>
                </div>
                <div className="student-ca-stat-item">
                  <span className="lbl">Class Test 2</span>
                  <span className="val">{studentCA.c2 !== null ? studentCA.c2 : '—'} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ 10</span></span>
                </div>
                <div className="student-ca-stat-item">
                  <span className="lbl">Class Test 3</span>
                  <span className="val">{studentCA.c3 !== null ? studentCA.c3 : '—'} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ 10</span></span>
                </div>
                <div className="student-ca-stat-item" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <span className="lbl" style={{ color: '#1e40af' }}>Best 2 CTs Sum</span>
                  <span className="val" style={{ color: '#1d4ed8' }}>{studentCA.best2Sum} <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>/ 20</span></span>
                </div>
                <div className="student-ca-stat-item" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                  <span className="lbl" style={{ color: '#065f46' }}>Attendance Score</span>
                  <span className="val" style={{ color: '#047857' }}>{studentCA.att !== null ? studentCA.att : '—'} <span style={{ fontSize: '0.75rem', color: '#34d399' }}>/ 10</span></span>
                </div>
                <div className="student-ca-stat-item" style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}>
                  <span className="lbl" style={{ color: '#6b21a8' }}>Class Standing</span>
                  <span className="val" style={{ color: '#7e22ce' }}>{formatOrdinal(myRank)} <span style={{ fontSize: '0.75rem', color: '#a855f7' }}>Rank</span></span>
                </div>
              </div>
            </div>

            {/* Detailed Itemized Assessment Table */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title"><Award size={18} /> Itemized Continuous Assessment Breakdown</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Official evaluation records submitted by course teachers for Roll: <strong style={{ fontFamily: 'var(--font-mono)' }}>{user.studentRoll}</strong>.
                  </p>
                </div>
              </div>

              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Assessment Component</th>
                      <th>Max Score</th>
                      <th>Obtained Score</th>
                      <th>Evaluation Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Class Test 1 (CT-1)', num: 1, val: studentCA.c1, isCt: true },
                      { label: 'Class Test 2 (CT-2)', num: 2, val: studentCA.c2, isCt: true },
                      { label: 'Class Test 3 (CT-3)', num: 3, val: studentCA.c3, isCt: true },
                      { label: 'Attendance', num: 4, val: studentCA.att, isCt: false },
                    ].map((row) => {
                      const markEntry = myMarks.find(m => m.ct_number === row.num);
                      const isCountedInBest2 = row.isCt && studentCA.countedCTs.has(row.num);
                      const isDropped = row.isCt && row.val !== null && !studentCA.countedCTs.has(row.num);

                      return (
                        <tr key={row.num}>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>
                            {row.label}
                          </td>
                          <td style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                            10.0 Marks
                          </td>
                          <td>
                            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: row.val !== null ? '#16a34a' : '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                              {row.val !== null ? row.val : '—'}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}> / 10.0</span>
                          </td>
                          <td>
                            {row.val === null ? (
                              <span className="badge badge-secondary">Pending Entry</span>
                            ) : !row.isCt ? (
                              <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                                Mandatory Attendance
                              </span>
                            ) : isCountedInBest2 ? (
                              <span className="badge badge-active" style={{ background: '#ecfdf5', color: '#047857' }}>
                                ★ Counted in Best 2
                              </span>
                            ) : (
                              <span className="badge badge-secondary" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                Lowest Mark (Dropped)
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#334155' }}>
                            {markEntry?.remarks || '—'}
                            {markEntry?.teacher_name && (
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                Evaluated by {markEntry.teacher_name}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* TAB 3: DEPARTMENT NOTICE BOARD */}
      {/* ========================================================= */}
      {activeTab === 'notices' && (
        <NoticeBoard user={user} token={token} />
      )}

      {/* ========================================================= */}
      {/* TAB 4: STUDENT FEEDBACK & GRIEVANCE FEED */}
      {/* ========================================================= */}
      {activeTab === 'grievances' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Submit Grievance Form */}
          <div className="card">
            <h3 className="card-title"><MessageSquare size={18} /> Submit Feedback / Grievance</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Your concerns are reviewed by the Department Office moderation queue before public display.
            </p>

            {submissionStatus && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: submissionStatus.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: submissionStatus.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                {submissionStatus.text}
              </div>
            )}

            <form onSubmit={handleSubmitGrievance}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={newGrievance.category}
                  onChange={(e) => setNewGrievance({ ...newGrievance, category: e.target.value })}
                >
                  <option value="ACADEMIC">Academic / Course Syllabus</option>
                  <option value="FACILITY">Laboratory & Computing Facility</option>
                  <option value="EXAMINATION">Examinations & Schedules</option>
                  <option value="GENERAL">General Student Affairs</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="Summary of concern..."
                  value={newGrievance.subject}
                  onChange={(e) => setNewGrievance({ ...newGrievance, subject: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Description</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain your grievance clearly and constructively..."
                  value={newGrievance.description}
                  onChange={(e) => setNewGrievance({ ...newGrievance, description: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="anon"
                  checked={newGrievance.isAnonymous}
                  onChange={(e) => setNewGrievance({ ...newGrievance, isAnonymous: e.target.checked })}
                />
                <label htmlFor="anon" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                  Post Anonymously (Hide Name & Roll Number)
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                <Send size={14} /> Submit to Moderation Queue
              </button>
            </form>
          </div>

          {/* Public Approved Grievances & Department Responses */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <ShieldCheck size={18} /> Approved Student Voice & Resolutions ({publicFeed.length})
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Official grievances reviewed and cleared by Department Office moderators.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {publicFeed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No approved grievances currently on public display.
                </div>
              ) : (
                publicFeed.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-secondary">{g.category}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(g.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.5rem 0 0.25rem' }}>
                      {g.subject}
                    </h4>

                    <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.5' }}>
                      {g.description}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Submitted by: <strong>{g.submitter_name}</strong> {g.student_roll ? `(${g.student_roll})` : ''}</span>
                    </div>

                    {g.moderation_remarks && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                        fontSize: '0.825rem',
                      }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <CheckCircle size={14} /> Official Department Action Taken:
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>{g.moderation_remarks}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
