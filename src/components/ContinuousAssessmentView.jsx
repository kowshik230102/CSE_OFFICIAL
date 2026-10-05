import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  BookOpen, 
  Calendar, 
  Clock, 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Search, 
  Filter, 
  Edit3, 
  Save, 
  Download, 
  Printer, 
  Lock, 
  Unlock, 
  Plus, 
  RefreshCw, 
  X, 
  Sparkles, 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  HelpCircle,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';

export function ContinuousAssessmentView({ user, onBackToDashboard }) {
  // Sessions & Courses State
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [courses, setCourses] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Active Semester Filter & Search
  const [activeSemesterFilter, setActiveSemesterFilter] = useState('ALL');
  const [courseSearch, setCourseSearch] = useState('');

  // Selected Course for Continuous Assessment Matrix Modal
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [marksData, setMarksData] = useState(null); // { course, canEdit, isAssignedTeacher, matrix, stats }
  const [localMatrix, setLocalMatrix] = useState([]); // Editable buffer
  const [isDirty, setIsDirty] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  // Student Filter inside Matrix
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'EVALUATED', 'PENDING', 'AT_RISK'

  // New Academic Session Modal
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({
    sessionName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isCurrent: false
  });
  const [creatingSession, setCreatingSession] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // 1. Fetch Serial Academic Sessions on Mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch('/api/academic/continuous-assessment/sessions', {
        credentials: 'include',
        headers
      });
      const data = await res.json();
      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions);
        // Default select current session or first serial session
        if (!selectedSessionId) {
          const current = data.sessions.find(s => s.is_current) || data.sessions[0];
          setSelectedSessionId(current.id);
        }
      }
    } catch (err) {
      showToast('Failed to load academic sessions: ' + err.message, 'error');
    } finally {
      setLoadingSessions(false);
    }
  };

  // 2. Fetch Courses when selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return;

    async function fetchSessionCourses() {
      setLoadingCourses(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const res = await fetch(`/api/academic/continuous-assessment/sessions/${selectedSessionId}/courses`, {
          credentials: 'include',
          headers
        });
        const data = await res.json();
        if (data.courses) {
          setCourses(data.courses);
        } else {
          setCourses([]);
        }
      } catch (err) {
        showToast('Failed to load session courses: ' + err.message, 'error');
      } finally {
        setLoadingCourses(false);
      }
    }

    fetchSessionCourses();
  }, [selectedSessionId]);

  // 3. Open Continuous Assessment Matrix for a Course
  const handleOpenCourseMarks = async (course) => {
    setSelectedCourse(course);
    setLoadingMarks(true);
    setIsDirty(false);
    setStudentSearch('');
    setStatusFilter('ALL');

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${course.id}/marks`, {
        credentials: 'include',
        headers
      });
      const data = await res.json();
      if (data.matrix) {
        setMarksData(data);
        setLocalMatrix(JSON.parse(JSON.stringify(data.matrix)));
      } else {
        showToast('No assessment data found for this course.', 'error');
      }
    } catch (err) {
      showToast('Failed to load course marks: ' + err.message, 'error');
    } finally {
      setLoadingMarks(false);
    }
  };

  // 4. Update Local Marks Buffer (Strictly if canEdit is true)
  const handleMarkChange = (studentId, field, value) => {
    if (!marksData?.canEdit) return;

    setLocalMatrix(prev => prev.map(item => {
      if (item.studentId === studentId) {
        const updated = { ...item, [field]: value === '' ? null : Number(value) };

        // Real-time recalculation of Best 2 of 3 CTs + Attendance
        const validCTs = [updated.ct1, updated.ct2, updated.ct3]
          .filter(v => v !== null && v !== undefined && !isNaN(v))
          .map(Number);

        let best2 = 0;
        let ctAvg = 0;
        if (validCTs.length > 0) {
          validCTs.sort((a, b) => b - a);
          const top2 = validCTs.slice(0, 2);
          best2 = top2.reduce((sum, v) => sum + v, 0);
          ctAvg = validCTs.reduce((sum, v) => sum + v, 0) / validCTs.length;
        }

        const att = (updated.attendance !== null && !isNaN(updated.attendance)) ? Number(updated.attendance) : 0;
        const totalCont = validCTs.length > 0 ? Number((best2 + att).toFixed(1)) : (updated.attendance !== null ? att : null);
        const pct = totalCont !== null ? Number(((totalCont / 30) * 100).toFixed(1)) : null;

        // PUST Ordinance Grade
        let gr = '-';
        let st = 'NOT_EVALUATED';
        if (pct !== null) {
          if (pct >= 80) { gr = 'A+'; st = 'EXCELLENT'; }
          else if (pct >= 75) { gr = 'A'; st = 'VERY_GOOD'; }
          else if (pct >= 70) { gr = 'A-'; st = 'GOOD'; }
          else if (pct >= 65) { gr = 'B+'; st = 'SATISFACTORY'; }
          else if (pct >= 60) { gr = 'B'; st = 'ABOVE_AVERAGE'; }
          else if (pct >= 55) { gr = 'B-'; st = 'AVERAGE'; }
          else if (pct >= 50) { gr = 'C+'; st = 'PASS'; }
          else if (pct >= 45) { gr = 'C'; st = 'PASS'; }
          else if (pct >= 40) { gr = 'D'; st = 'MARGINAL'; }
          else { gr = 'F'; st = 'FAIL'; }
        }

        return {
          ...updated,
          best2Total: validCTs.length > 0 ? Number(best2.toFixed(1)) : null,
          ctAverage: validCTs.length > 0 ? Number(ctAvg.toFixed(1)) : null,
          totalContinuous: totalCont,
          percentage: pct,
          grade: gr,
          status: st,
          isEvaluated: validCTs.length > 0 || updated.attendance !== null
        };
      }
      return item;
    }));
    setIsDirty(true);
  };

  const handleRemarksChange = (studentId, value) => {
    if (!marksData?.canEdit) return;
    setLocalMatrix(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, remarks: value };
      }
      return item;
    }));
    setIsDirty(true);
  };

  // 5. Save Continuous Assessment Matrix
  const handleSaveMatrix = async () => {
    if (!selectedCourse) return;
    if (!marksData?.canEdit) {
      showToast('You do not have permission to edit marks for this course. Only the assigned teacher can edit.', 'error');
      return;
    }

    setSavingMarks(true);
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const payload = localMatrix.map(item => ({
        studentId: item.studentId,
        ct1: item.ct1,
        ct2: item.ct2,
        ct3: item.ct3,
        attendance: item.attendance,
        remarks: item.remarks
      }));

      const res = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/marks`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ matrix: payload })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save continuous assessment marks.');
      }

      showToast(data.message || 'Continuous assessment marks saved successfully!');
      setIsDirty(false);

      // Refresh marks
      const refreshRes = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/marks`, {
        credentials: 'include',
        headers
      });
      const refreshData = await refreshRes.json();
      if (refreshData.matrix) {
        setMarksData(refreshData);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingMarks(false);
    }
  };

  // 6. Quick Action: Pre-fill realistic demo marks for quick preview
  const handleFillDemoMarks = () => {
    if (!marksData?.canEdit) return;

    setLocalMatrix(prev => prev.map((item, idx) => {
      const baseCT1 = Number((7.0 + ((idx * 0.7) % 3.0)).toFixed(1));
      const baseCT2 = Number((7.5 + ((idx * 0.5) % 2.5)).toFixed(1));
      const baseCT3 = Number((8.0 + ((idx * 0.6) % 2.0)).toFixed(1));
      const baseAtt = Number((8.5 + ((idx * 0.3) % 1.5)).toFixed(1));

      const validCTs = [baseCT1, baseCT2, baseCT3].sort((a, b) => b - a);
      const best2 = validCTs[0] + validCTs[1];
      const totalCont = Number((best2 + baseAtt).toFixed(1));
      const pct = Number(((totalCont / 30) * 100).toFixed(1));

      return {
        ...item,
        ct1: baseCT1,
        ct2: baseCT2,
        ct3: baseCT3,
        attendance: baseAtt,
        best2Total: best2,
        totalContinuous: totalCont,
        percentage: pct,
        grade: pct >= 80 ? 'A+' : pct >= 75 ? 'A' : pct >= 70 ? 'A-' : 'B+',
        status: pct >= 80 ? 'EXCELLENT' : pct >= 70 ? 'GOOD' : 'PASS',
        remarks: item.remarks || (pct >= 80 ? 'Exceptional problem solver' : 'Consistent performance'),
        isEvaluated: true
      };
    }));
    setIsDirty(true);
    showToast('Sample continuous assessment marks filled. Click Save Changes to commit!', 'success');
  };

  // 7. Create New Academic Session (Auto-creates 8 semesters, courses, and teacher allocations)
  const handleCreateNewSession = async (e) => {
    e.preventDefault();
    if (!newSessionForm.sessionName.trim()) {
      showToast('Please enter a session name.', 'error');
      return;
    }

    setCreatingSession(true);
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const res = await fetch('/api/academic/continuous-assessment/sessions', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(newSessionForm)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create academic session.');
      }

      showToast(data.message || 'Academic session created successfully!');
      setIsNewSessionModalOpen(false);
      setNewSessionForm({
        sessionName: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        isCurrent: false
      });

      // Refresh sessions and auto-select new one
      await fetchSessions();
      if (data.session && data.session.id) {
        setSelectedSessionId(data.session.id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreatingSession(false);
    }
  };

  // 8. Export to CSV
  const handleExportCSV = () => {
    if (!localMatrix.length || !selectedCourse) return;

    const headers = ['Roll No', 'Registration No', 'Student Name', 'CT-1 (10)', 'CT-2 (10)', 'CT-3 (10)', 'Best 2 CTs (20)', 'Attendance (10)', 'Continuous Total (30)', 'Percentage (%)', 'Grade', 'Remarks'];
    const rows = localMatrix.map(st => [
      `"${st.studentRoll || ''}"`,
      `"${st.registrationNo || ''}"`,
      `"${st.studentName || ''}"`,
      st.ct1 ?? '',
      st.ct2 ?? '',
      st.ct3 ?? '',
      st.best2Total ?? '',
      st.attendance ?? '',
      st.totalContinuous ?? '',
      st.percentage ?? '',
      `"${st.grade || ''}"`,
      `"${(st.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedCourse.course_code}_Continuous_Assessment_${selectedCourse.session_name || 'PUST'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Continuous assessment grade sheet exported to CSV.', 'success');
  };

  // 9. Filtered Courses for Active Semester & Search
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // Semester filter
      if (activeSemesterFilter !== 'ALL' && c.term_code !== activeSemesterFilter) {
        return false;
      }
      // Search filter
      if (courseSearch.trim()) {
        const query = courseSearch.toLowerCase();
        const matchCode = c.course_code?.toLowerCase().includes(query);
        const matchTitle = c.course_title?.toLowerCase().includes(query);
        const matchTeacher = c.assigned_teacher_name?.toLowerCase().includes(query);
        const matchDept = c.assigned_teacher_department?.toLowerCase().includes(query);
        if (!matchCode && !matchTitle && !matchTeacher && !matchDept) {
          return false;
        }
      }
      return true;
    });
  }, [courses, activeSemesterFilter, courseSearch]);

  // 10. Filtered Matrix for Student Search & Status
  const filteredMatrix = useMemo(() => {
    return localMatrix.filter(st => {
      if (studentSearch.trim()) {
        const query = studentSearch.toLowerCase();
        const matchRoll = st.studentRoll?.toLowerCase().includes(query);
        const matchName = st.studentName?.toLowerCase().includes(query);
        const matchReg = st.registrationNo?.toLowerCase().includes(query);
        if (!matchRoll && !matchName && !matchReg) return false;
      }

      if (statusFilter === 'EVALUATED') return st.isEvaluated;
      if (statusFilter === 'PENDING') return !st.isEvaluated;
      if (statusFilter === 'AT_RISK') return st.isEvaluated && (st.percentage === null || st.percentage < 40);

      return true;
    });
  }, [localMatrix, studentSearch, statusFilter]);

  // Current selected session metadata
  const currentSelectedSession = useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId);
  }, [sessions, selectedSessionId]);

  // 8 Semesters list for quick tabs
  const semesterTabs = [
    { code: 'ALL', label: 'All Semesters' },
    { code: 'Y1S1', label: '1-1 (Y1S1)' },
    { code: 'Y1S2', label: '1-2 (Y1S2)' },
    { code: 'Y2S1', label: '2-1 (Y2S1)' },
    { code: 'Y2S2', label: '2-2 (Y2S2)' },
    { code: 'Y3S1', label: '3-1 (Y3S1)' },
    { code: 'Y3S2', label: '3-2 (Y3S2)' },
    { code: 'Y4S1', label: '4-1 (Y4S1)' },
    { code: 'Y4S2', label: '4-2 (Y4S2)' }
  ];

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
        marginBottom: '2rem',
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
                background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                color: '#ffffff',
                padding: '0.45rem',
                borderRadius: '10px',
                display: 'flex',
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)'
              }}>
                <Award size={22} />
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Continuous Assessment
              </h1>
              <span style={{
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#f472b6',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '8px',
                fontSize: '0.725rem',
                fontWeight: 700
              }}>
                PUST CSE ORDINANCE
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
              Serial Session Progression • Course Allocations • CT 1-3 & Attendance Evaluation Matrix • Teacher Security Guard
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsNewSessionModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={16} />
            <span>Add Session / Start Class Date</span>
          </button>

          <button
            onClick={fetchSessions}
            title="Refresh Sessions & Course Data"
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '0.65rem',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={17} className={loadingSessions ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* 1. SERIAL SESSIONS PIPELINE (Sessions Occur Serially) */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={18} style={{ color: '#818cf8' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Academic Sessions Pipeline (Serial Occurrence)
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              • Click any session to inspect courses & assessment matrices
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>
            {sessions.length} Academic Sessions Registered
          </div>
        </div>

        {/* Horizontal Serial Session Cards */}
        {loadingSessions ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#0f172a', borderRadius: '12px' }}>
            <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 0.5rem auto', color: '#3b82f6' }} />
            <div>Loading serial academic sessions...</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem'
          }}>
            {sessions.map((sess, idx) => {
              const isSelected = sess.id === selectedSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => setSelectedSessionId(sess.id)}
                  style={{
                    background: isSelected 
                      ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(99, 102, 241, 0.25))' 
                      : 'rgba(15, 23, 42, 0.75)',
                    border: isSelected ? '2px solid #60a5fa' : '1px solid #1e293b',
                    borderRadius: '14px',
                    padding: '1.15rem 1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    boxShadow: isSelected ? '0 10px 25px rgba(37, 99, 235, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.2)',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#475569';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#1e293b';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <span style={{
                      fontSize: '0.675rem',
                      fontWeight: 800,
                      color: isSelected ? '#93c5fd' : '#94a3b8',
                      letterSpacing: '0.05em'
                    }}>
                      SERIAL #{idx + 1}
                    </span>

                    {sess.is_current ? (
                      <span style={{
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <Sparkles size={11} /> CURRENT
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(148, 163, 184, 0.12)',
                        color: '#94a3b8',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '20px'
                      }}>
                        SERIAL SESSION
                      </span>
                    )}
                  </div>

                  {/* Session Title */}
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
                    {sess.session_name}
                  </div>

                  {/* Start Date / Class Start Date */}
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={13} style={{ color: '#60a5fa' }} />
                    <span>Starts: {sess.start_date || 'Class date pending'}</span>
                  </div>

                  {/* Metrics Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.75rem'
                  }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <BookOpen size={13} style={{ color: '#818cf8' }} />
                      {sess.course_count || 31} Courses
                    </span>

                    <span style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={13} />
                      {sess.student_count || 15} Students
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. COURSES INSIDE SELECTED SESSION */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '1.75rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)'
      }}>
        {/* Banner with Selected Session Overview */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid #1e293b'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                SELECTED SESSION
              </span>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                {currentSelectedSession?.session_name || 'Academic Session'}
              </h3>
            </div>
            <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Showing all curriculum courses with assigned faculty, departments, and continuous evaluation progress. Click any course to view/grade students.
            </div>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search course code, title, teacher..."
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.9rem 0.6rem 2.25rem',
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

        {/* Semester Filter Tabs (1-1 to 4-2) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          {semesterTabs.map(tab => {
            const isActive = activeSemesterFilter === tab.code;
            return (
              <button
                key={tab.code}
                onClick={() => setActiveSemesterFilter(tab.code)}
                style={{
                  background: isActive ? '#3b82f6' : 'rgba(30, 41, 59, 0.7)',
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

        {/* Courses Cards Grid */}
        {loadingCourses ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={26} className="spin-animation" style={{ margin: '0 auto 0.75rem auto', color: '#3b82f6' }} />
            <div>Loading session courses and faculty allocations...</div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '12px',
            border: '1px dashed #334155'
          }}>
            <BookOpen size={36} style={{ color: '#64748b', margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>No Courses Found</div>
            <div style={{ fontSize: '0.825rem', color: '#94a3b8', marginTop: '0.3rem' }}>
              No courses matching the selected semester filter or search term.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.25rem'
          }}>
            {filteredCourses.map(course => {
              const isAssignedToUser = course.is_user_assigned_teacher;
              return (
                <div
                  key={course.id}
                  onClick={() => handleOpenCourseMarks(course)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: isAssignedToUser ? '1px solid #3b82f6' : '1px solid #1e293b',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.25)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = isAssignedToUser ? '#3b82f6' : '#1e293b';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  <div>
                    {/* Course Code & Credit Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px'
                        }}>
                          {course.course_code}
                        </span>

                        <span style={{
                          background: course.course_type === 'LAB' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: course.course_type === 'LAB' ? '#f472b6' : '#34d399',
                          fontWeight: 700,
                          fontSize: '0.725rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px'
                        }}>
                          {course.course_type} • {course.credit_hours} CR
                        </span>
                      </div>

                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                        {course.semester_name || course.term_code}
                      </span>
                    </div>

                    {/* Course Title */}
                    <h4 style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      margin: '0.4rem 0 0.85rem 0',
                      lineHeight: 1.35
                    }}>
                      {course.course_title}
                    </h4>

                    {/* Assigned Course Teacher Information Box */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        {/* Teacher Avatar / Photo */}
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}>
                          {course.assigned_teacher_photo ? (
                            <img
                              src={course.assigned_teacher_photo}
                              alt={course.assigned_teacher_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            course.assigned_teacher_name ? course.assigned_teacher_name[0] : 'T'
                          )}
                        </div>

                        {/* Teacher Name & Bio Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {course.assigned_teacher_name || 'Unassigned Faculty'}
                          </div>

                          <div style={{ fontSize: '0.725rem', color: '#60a5fa', fontWeight: 600 }}>
                            {course.assigned_teacher_designation || 'Faculty Member'}
                          </div>

                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                            <Building2 size={11} />
                            <span>Dept: {course.assigned_teacher_department || 'CSE'}</span>
                            {course.assigned_teacher_room && (
                              <span>• {course.assigned_teacher_room}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Security Ownership Badge */}
                      <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {isAssignedToUser ? (
                          <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Unlock size={12} /> You are Course Teacher (Full Edit)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Lock size={12} /> View-Only Access
                          </span>
                        )}

                        <span style={{ fontSize: '0.7rem', color: '#a5b4fc', fontWeight: 600 }}>
                          {course.enrolled_students_count || 12} Students
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <span style={{
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      color: course.assessed_students_count > 0 ? '#10b981' : '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      <CheckCircle2 size={13} />
                      {course.assessed_students_count > 0 
                        ? `${course.assessed_students_count} Evaluated` 
                        : 'Evaluation Pending'}
                    </span>

                    <span style={{
                      fontSize: '0.775rem',
                      fontWeight: 700,
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}>
                      Open Mark Sheet <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. CONTINUOUS ASSESSMENT GRADE SHEET MODAL (WHEN A COURSE IS CLICKED) */}
      {selectedCourse && (
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
            borderRadius: '18px',
            width: '100%',
            maxWidth: '1280px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid #1e293b',
              background: 'linear-gradient(135deg, #09101d 0%, #0f172a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px'
                  }}>
                    {selectedCourse.course_code}
                  </span>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    {selectedCourse.course_title}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    • {selectedCourse.semester_name || selectedCourse.term_code} • {selectedCourse.session_name || currentSelectedSession?.session_name}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span>
                    <strong>Teacher:</strong> {selectedCourse.assigned_teacher_name || 'Dr. Mahmudur Rahman'} ({selectedCourse.assigned_teacher_designation}, Dept: {selectedCourse.assigned_teacher_department || 'CSE'})
                  </span>
                  {selectedCourse.assigned_teacher_room && (
                    <span>• Room: {selectedCourse.assigned_teacher_room}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  onClick={handleExportCSV}
                  title="Export Grade Sheet to CSV"
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    padding: '0.55rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Download size={14} /> Export CSV
                </button>

                <button
                  onClick={() => window.print()}
                  title="Print Grade Sheet"
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    padding: '0.55rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Printer size={14} /> Print
                </button>

                <button
                  onClick={() => setSelectedCourse(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    width: '34px',
                    height: '34px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Strict Authorization Banner */}
            <div style={{
              padding: '0.75rem 1.75rem',
              background: marksData?.canEdit 
                ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))' 
                : 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08))',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {marksData?.canEdit ? (
                  <>
                    <Unlock size={18} style={{ color: '#34d399' }} />
                    <span style={{ fontSize: '0.825rem', color: '#d1fae5', fontWeight: 600 }}>
                      <strong>Authorized Course Teacher Edit Mode:</strong> You are the designated instructor for this course. You can record CT 1-3 marks, class attendance, and finalize the continuous assessment matrix.
                    </span>
                  </>
                ) : (
                  <>
                    <Lock size={18} style={{ color: '#fbbf24' }} />
                    <span style={{ fontSize: '0.825rem', color: '#fef3c7', fontWeight: 600 }}>
                      <strong>🔒 View-Only Mode:</strong> Continuous assessment marks can only be entered or modified by the assigned course teacher: <strong>{selectedCourse.assigned_teacher_name || 'Designated Faculty'}</strong>. All values below are locked.
                    </span>
                  </>
                )}
              </div>

              {/* Action Buttons for Authorized Teacher */}
              {marksData?.canEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={handleFillDemoMarks}
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid #818cf8',
                      color: '#c7d2fe',
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      fontSize: '0.775rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Sparkles size={13} /> Auto-Fill Demo Marks
                  </button>

                  <button
                    onClick={handleSaveMatrix}
                    disabled={savingMarks || !isDirty}
                    style={{
                      background: isDirty ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(30, 41, 59, 0.6)',
                      border: isDirty ? 'none' : '1px solid #334155',
                      color: isDirty ? '#ffffff' : '#64748b',
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: isDirty ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: isDirty ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none'
                    }}
                  >
                    <Save size={14} className={savingMarks ? 'spin-animation' : ''} />
                    <span>{savingMarks ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Class Aggregate Statistics Bar */}
            {marksData?.stats && (
              <div style={{
                padding: '0.85rem 1.75rem',
                background: '#09101d',
                borderBottom: '1px solid #1e293b',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
                fontSize: '0.8rem'
              }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Enrolled Cohort</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                    {marksData.stats.totalEnrolled} Students
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Evaluated Students</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34d399' }}>
                    {marksData.stats.totalEvaluated} / {marksData.stats.totalEnrolled}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Average Score (/30)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#60a5fa' }}>
                    {marksData.stats.avgScore} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({((marksData.stats.avgScore / 30) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Highest Mark (/30)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#a78bfa' }}>
                    {marksData.stats.highestScore}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Lowest Mark (/30)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f87171' }}>
                    {marksData.stats.lowestScore}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Pass Rate (&gt;40%)</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#34d399' }}>
                    {marksData.stats.totalEvaluated > 0 ? `${((marksData.stats.passCount / marksData.stats.totalEvaluated) * 100).toFixed(0)}%` : '0%'}
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar inside Modal */}
            <div style={{
              padding: '0.75rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b'
            }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Filter student roll or name..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2rem',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Filter Status:</span>
                {['ALL', 'EVALUATED', 'PENDING', 'AT_RISK'].map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    style={{
                      background: statusFilter === f ? '#2563eb' : 'rgba(30, 41, 59, 0.5)',
                      color: statusFilter === f ? '#ffffff' : '#94a3b8',
                      border: '1px solid #334155',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Student Continuous Assessment Matrix Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.75rem' }}>
              {loadingMarks ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 0.5rem auto', color: '#3b82f6' }} />
                  <div>Loading student evaluation records...</div>
                </div>
              ) : filteredMatrix.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  No students matching your filter.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.75rem 0.5rem', width: '40px' }}>#</th>
                      <th style={{ padding: '0.75rem 0.5rem', minWidth: '180px' }}>Student Roll & Name</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '90px', textAlign: 'center' }}>CT-1 (/10)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '90px', textAlign: 'center' }}>CT-2 (/10)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '90px', textAlign: 'center' }}>CT-3 (/10)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '110px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)' }}>Best 2 (/20)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '95px', textAlign: 'center' }}>Attendance (/10)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '115px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)' }}>Total (/30)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '80px', textAlign: 'center' }}>Grade</th>
                      <th style={{ padding: '0.75rem 0.5rem', minWidth: '160px' }}>Remarks / Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrix.map((st, idx) => {
                      const canEdit = marksData?.canEdit;
                      return (
                        <tr key={st.studentId} style={{ borderBottom: '1px solid #1e293b', transition: 'background 0.15s ease' }}>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#64748b' }}>{idx + 1}</td>
                          
                          {/* Student Details */}
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>
                              {st.studentRoll}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                              {st.studentName} • {st.registrationNo}
                            </div>
                          </td>

                          {/* CT 1 */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            {canEdit ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={st.ct1 ?? ''}
                                onChange={e => handleMarkChange(st.studentId, 'ct1', e.target.value)}
                                style={{
                                  width: '65px',
                                  padding: '0.35rem',
                                  textAlign: 'center',
                                  background: 'rgba(30, 41, 59, 0.8)',
                                  border: '1px solid #475569',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.825rem'
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: 700, color: st.ct1 !== null ? '#ffffff' : '#64748b' }}>
                                {st.ct1 !== null ? st.ct1 : '-'}
                              </span>
                            )}
                          </td>

                          {/* CT 2 */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            {canEdit ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={st.ct2 ?? ''}
                                onChange={e => handleMarkChange(st.studentId, 'ct2', e.target.value)}
                                style={{
                                  width: '65px',
                                  padding: '0.35rem',
                                  textAlign: 'center',
                                  background: 'rgba(30, 41, 59, 0.8)',
                                  border: '1px solid #475569',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.825rem'
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: 700, color: st.ct2 !== null ? '#ffffff' : '#64748b' }}>
                                {st.ct2 !== null ? st.ct2 : '-'}
                              </span>
                            )}
                          </td>

                          {/* CT 3 */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            {canEdit ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={st.ct3 ?? ''}
                                onChange={e => handleMarkChange(st.studentId, 'ct3', e.target.value)}
                                style={{
                                  width: '65px',
                                  padding: '0.35rem',
                                  textAlign: 'center',
                                  background: 'rgba(30, 41, 59, 0.8)',
                                  border: '1px solid #475569',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.825rem'
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: 700, color: st.ct3 !== null ? '#ffffff' : '#64748b' }}>
                                {st.ct3 !== null ? st.ct3 : '-'}
                              </span>
                            )}
                          </td>

                          {/* Best 2 Total (Max 20) */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)' }}>
                            <span style={{
                              fontWeight: 800,
                              color: st.best2Total !== null ? '#93c5fd' : '#64748b',
                              fontSize: '0.85rem'
                            }}>
                              {st.best2Total !== null ? `${st.best2Total} / 20` : '-'}
                            </span>
                          </td>

                          {/* Attendance (Max 10) */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            {canEdit ? (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={st.attendance ?? ''}
                                onChange={e => handleMarkChange(st.studentId, 'attendance', e.target.value)}
                                style={{
                                  width: '65px',
                                  padding: '0.35rem',
                                  textAlign: 'center',
                                  background: 'rgba(30, 41, 59, 0.8)',
                                  border: '1px solid #475569',
                                  borderRadius: '6px',
                                  color: '#34d399',
                                  fontWeight: 700,
                                  fontSize: '0.825rem'
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: 700, color: st.attendance !== null ? '#34d399' : '#64748b' }}>
                                {st.attendance !== null ? st.attendance : '-'}
                              </span>
                            )}
                          </td>

                          {/* Continuous Total (Max 30) */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)' }}>
                            <span style={{
                              fontWeight: 800,
                              color: st.totalContinuous !== null ? '#6ee7b7' : '#64748b',
                              fontSize: '0.9rem'
                            }}>
                              {st.totalContinuous !== null ? `${st.totalContinuous} / 30` : '-'}
                            </span>
                          </td>

                          {/* Projected Grade */}
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              background: st.grade === 'A+' ? 'rgba(16, 185, 129, 0.2)' : st.grade === 'F' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                              color: st.grade === 'A+' ? '#34d399' : st.grade === 'F' ? '#f87171' : '#60a5fa'
                            }}>
                              {st.grade || '-'}
                            </span>
                          </td>

                          {/* Remarks */}
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            {canEdit ? (
                              <input
                                type="text"
                                placeholder="Add notes..."
                                value={st.remarks || ''}
                                onChange={e => handleRemarksChange(st.studentId, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.35rem 0.5rem',
                                  background: 'rgba(30, 41, 59, 0.6)',
                                  border: '1px solid #334155',
                                  borderRadius: '6px',
                                  color: '#cbd5e1',
                                  fontSize: '0.775rem'
                                }}
                              />
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.775rem' }}>
                                {st.remarks || '-'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.75rem',
              borderTop: '1px solid #1e293b',
              background: '#09101d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                PUST CSE Continuous Assessment Breakdown: Best 2 Class Tests (20 Marks) + Class Attendance (10 Marks) = 30 Marks Total
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {marksData?.canEdit && (
                  <button
                    onClick={handleSaveMatrix}
                    disabled={savingMarks || !isDirty}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.55rem 1.25rem',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: isDirty ? 'pointer' : 'default',
                      opacity: isDirty ? 1 : 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Save size={15} />
                    <span>{savingMarks ? 'Saving Changes...' : 'Save Assessment Marks'}</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedCourse(null)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
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

      {/* 4. NEW ACADEMIC SESSION / START CLASS DATE MODAL */}
      {isNewSessionModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 10, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Calendar size={20} style={{ color: '#3b82f6' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Add Session / Start Class Date
                </h3>
              </div>

              <button
                onClick={() => setIsNewSessionModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
              When a session is created or a start class date is scheduled, the system automatically populates all 8 standard CSE semesters, curriculum courses, and assigned faculty!
            </p>

            <form onSubmit={handleCreateNewSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Session Name (e.g. Session 2025-2026) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Session 2025-2026"
                  value={newSessionForm.sessionName}
                  onChange={e => setNewSessionForm(prev => ({ ...prev, sessionName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Start Class Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSessionForm.startDate}
                    onChange={e => setNewSessionForm(prev => ({ ...prev, startDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    End Class Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newSessionForm.endDate}
                    onChange={e => setNewSessionForm(prev => ({ ...prev, endDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.35rem' }}>
                <input
                  type="checkbox"
                  id="setAsCurrentCheck"
                  checked={newSessionForm.isCurrent}
                  onChange={e => setNewSessionForm(prev => ({ ...prev, isCurrent: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="setAsCurrentCheck" style={{ fontSize: '0.825rem', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600 }}>
                  Set as Current Active Academic Session
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingSession}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    fontWeight: 800,
                    cursor: creatingSession ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  <Plus size={15} />
                  <span>{creatingSession ? 'Creating...' : 'Create & Auto-Populate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
