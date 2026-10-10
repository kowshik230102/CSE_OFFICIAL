import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
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
  PlusCircle, 
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
  ChevronDown,
  ShieldCheck, 
  Check,
  RotateCcw,
  History,
  Send,
  Eye,
  Archive,
  SlidersHorizontal,
  AlertTriangle
} from 'lucide-react';

import { computeStudentCA, computeClassRanks, formatOrdinal, parseMark } from '../utils/assessment';

export function ContinuousAssessmentView({ user: propUser, onBackToDashboard }) {
  const { user: contextUser, token: contextToken } = useAuth();
  const user = contextUser || propUser;

  const getAuthHeaders = () => {
    const curToken = contextToken || localStorage.getItem('token') || localStorage.getItem('cse_token');
    return curToken ? { Authorization: `Bearer ${curToken}` } : {};
  };

  // View Navigation: 'DASHBOARD' | 'SESSION_COURSES' | 'ASSESSMENT_SHEET'
  const [viewMode, setViewMode] = useState('DASHBOARD');

  // Master Data State
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Selected Session & Semesters
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionSemesters, setSessionSemesters] = useState([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('ALL');

  // Courses in selected session
  const [coursesData, setCoursesData] = useState({ courses: [], assignedCourses: [], unassignedCourses: [] });
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');

  // Selected Course & Sheet Matrix
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [marksSheetData, setMarksSheetData] = useState(null); // { course, canEdit, isAssignedTeacher, matrix, stats, finalMaxMarks, status }
  const [localMatrix, setLocalMatrix] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [finalTheoryMaxMarks, setFinalTheoryMaxMarks] = useState(70.0);

  // Sheet filter & search
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [sheetStatusFilter, setSheetStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETE' | 'INCOMPLETE' | 'AT_RISK'

  // Dashboard Filters & Sorting
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('ALL'); // 'ALL' | 'RUNNING' | 'PUBLISHED' | 'ARCHIVED' | 'CURRENT'
  const [dashboardSortBy, setDashboardSortBy] = useState('YEAR_DESC'); // 'YEAR_DESC' | 'YEAR_ASC' | 'STUDENTS_DESC' | 'COURSES_DESC'

  // Modals State
  const [isCreateSemesterModalOpen, setIsCreateSemesterModalOpen] = useState(false);
  const [createSemesterForm, setCreateSemesterForm] = useState({
    sessionId: '',
    academicYear: '',
    year: '1',
    semester: '1',
    startDate: new Date().toISOString().split('T')[0],
    classEndDate: '',
    assessmentDeadline: '',
    status: 'Running',
    notes: ''
  });
  const [submittingSemester, setSubmittingSemester] = useState(false);

  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [createSessionForm, setCreateSessionForm] = useState({
    sessionName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isCurrent: false
  });
  const [submittingSession, setSubmittingSession] = useState(false);

  // Reopen Modal
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Audit Logs Modal
  const [isAuditLogsModalOpen, setIsAuditLogsModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const isAuthority = Boolean(
    user?.role === 'ADMIN' ||
    user?.role === 'OFFICE_STAFF' ||
    user?.email === 'chair.cse_pust@gmail.com' ||
    (user?.designation && user.designation.toLowerCase().includes('chair'))
  );

  // 1. Initial Load: Fetch All Sessions
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/academic/continuous-assessment/sessions', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load assessment sessions.');
      setSessions(data.sessions || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingSessions(false);
    }
  };

  // 2. Open a Session
  const handleOpenSession = async (session) => {
    setSelectedSession(session);
    setViewMode('SESSION_COURSES');
    setSelectedSemesterFilter('ALL');
    setCourseSearchQuery('');

    // Fetch semesters and courses for this session
    fetchSessionSemesters(session.id);
    fetchSessionCourses(session.id, 'ALL');
  };

  const fetchSessionSemesters = async (sessionId) => {
    setLoadingSemesters(true);
    try {
      const res = await fetch(`/api/academic/continuous-assessment/sessions/${sessionId}/semesters`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load session semesters.');
      setSessionSemesters(data.semesters || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingSemesters(false);
    }
  };

  const fetchSessionCourses = async (sessionId, semesterId = 'ALL') => {
    setLoadingCourses(true);
    try {
      const url = semesterId && semesterId !== 'ALL'
        ? `/api/academic/continuous-assessment/sessions/${sessionId}/courses?semesterId=${semesterId}`
        : `/api/academic/continuous-assessment/sessions/${sessionId}/courses`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load courses.');
      setCoursesData({
        courses: data.courses || [],
        assignedCourses: data.assignedCourses || [],
        unassignedCourses: data.unassignedCourses || []
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingCourses(false);
    }
  };

  // 3. Open Course Assessment Sheet
  const handleOpenAssessmentSheet = async (course) => {
    setSelectedCourse(course);
    setLoadingSheet(true);
    setIsDirty(false);
    setSheetSearchQuery('');
    setSheetStatusFilter('ALL');

    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${course.id}/marks`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load assessment sheet.');

      setMarksSheetData(data);
      setLocalMatrix(JSON.parse(JSON.stringify(data.matrix || [])));
      setFinalTheoryMaxMarks(data.finalMaxMarks || 70.0);
      setViewMode('ASSESSMENT_SHEET');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingSheet(false);
    }
  };

  // 4. Update Local Marks Cell
  const handleCellChange = (studentId, field, rawValue) => {
    if (!marksSheetData?.canEdit) return;

    let value = null;
    if (rawValue !== '' && rawValue !== null && rawValue !== undefined) {
      const num = parseFloat(rawValue);
      if (isNaN(num)) return;
      
      const maxVal = field === 'finalTheory' ? finalTheoryMaxMarks : 10.0;
      if (num < 0 || num > maxVal) {
        showToast(`Mark must be between 0 and ${maxVal}`, 'error');
        return;
      }
      value = num;
    }

    setIsDirty(true);

    setLocalMatrix(prev => {
      const next = prev.map(row => {
        if (row.studentId !== studentId) return row;

        const updated = { ...row, [field]: value };

        // Recalculate CA Marks, Grade, and Rank dynamically
        const enteredCTs = [updated.ct1, updated.ct2, updated.ct3]
          .filter(v => v !== null && v !== undefined && !isNaN(v))
          .map(Number);
        const hasAttendance = updated.attendance !== null && updated.attendance !== undefined && !isNaN(updated.attendance);

        if (enteredCTs.length >= 2 && hasAttendance) {
          const sorted = [...enteredCTs].sort((a, b) => b - a);
          const best2 = Math.round((sorted[0] + sorted[1]) * 10) / 10;
          const ca = Math.round((best2 + Number(updated.attendance)) * 10) / 10;
          const pct = (ca / 30.0) * 100;
          const gradeCalc = computeStudentCA(updated.ct1, updated.ct2, updated.ct3, updated.attendance);

          return {
            ...updated,
            best2Total: best2,
            caMarks: ca,
            caGrade: gradeCalc.grade,
            isCAComplete: true
          };
        } else {
          return {
            ...updated,
            best2Total: null,
            caMarks: null,
            caGrade: enteredCTs.length > 0 || hasAttendance ? 'Incomplete' : '—',
            isCAComplete: false
          };
        }
      });

      // Recalculate competition ranks across all rows
      const rankMap = computeClassRanks(next);
      return next.map(r => ({
        ...r,
        caRank: r.caMarks !== null ? (rankMap[r.studentId] || null) : null
      }));
    });
  };

  // Keyboard navigation for spreadsheet cells
  const handleKeyDown = (e, rowIndex, colName) => {
    const columns = ['ct1', 'ct2', 'ct3', 'attendance', 'finalTheory'];
    const colIndex = columns.indexOf(colName);
    if (colIndex === -1) return;

    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      targetRow = Math.min(localMatrix.length - 1, rowIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
      targetCol = Math.min(columns.length - 1, colIndex + 1);
    } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      targetCol = Math.max(0, colIndex - 1);
    } else {
      return;
    }

    const nextId = `cell-${targetRow}-${columns[targetCol]}`;
    const nextElem = document.getElementById(nextId);
    if (nextElem) {
      nextElem.focus();
      nextElem.select();
    }
  };

  // 5. Save Assessment Marks
  const handleSaveMarks = async () => {
    if (!selectedCourse) return;
    setSavingSheet(true);

    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/marks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          matrix: localMatrix,
          finalMaxMarks: finalTheoryMaxMarks
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save assessment marks.');

      setIsDirty(false);
      showToast(data.message || 'Assessment marks successfully saved!', 'success');

      // Refresh sheet to keep full consistency
      handleOpenAssessmentSheet(selectedCourse);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingSheet(false);
    }
  };

  // 6. Submit Assessment for Review
  const handleSubmitAssessment = async () => {
    if (!selectedCourse) return;
    if (!window.confirm(`Submit assessment marks for ${selectedCourse.course_code} for departmental review?`)) return;

    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit assessment.');
      showToast(data.message, 'success');
      handleOpenAssessmentSheet(selectedCourse);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 7. Publish Results (Admin / Authority)
  const handlePublishResults = async () => {
    if (!selectedCourse) return;
    if (!window.confirm(`Officially finalize & publish results for ${selectedCourse.course_code}? Once published, marks will be synchronized to official transcripts and permanently locked.`)) return;

    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish results.');
      showToast(data.message, 'success');
      handleOpenAssessmentSheet(selectedCourse);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 8. Reopen Locked Assessment (Admin / Authority)
  const handleReopenAssessment = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !reopenReason.trim()) {
      showToast('An explicit administrative reason is required to reopen this assessment.', 'error');
      return;
    }

    setSubmittingReopen(true);
    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ reason: reopenReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reopen assessment.');

      setIsReopenModalOpen(false);
      setReopenReason('');
      showToast(data.message, 'success');
      handleOpenAssessmentSheet(selectedCourse);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingReopen(false);
    }
  };

  // 9. View Audit Logs
  const handleOpenAuditLogs = async () => {
    if (!selectedCourse) return;
    setIsAuditLogsModalOpen(true);
    setLoadingAuditLogs(true);

    try {
      const res = await fetch(`/api/academic/continuous-assessment/courses/${selectedCourse.id}/audit-logs`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch audit logs.');
      setAuditLogs(data.logs || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // 10. Create Semester Handler
  const handleCreateSemesterSubmit = async (e) => {
    e.preventDefault();
    setSubmittingSemester(true);

    try {
      const res = await fetch('/api/academic/continuous-assessment/semesters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(createSemesterForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create semester.');

      showToast(data.message, 'success');
      setIsCreateSemesterModalOpen(false);

      // Refresh current views
      fetchSessions();
      if (selectedSession && selectedSession.id === createSemesterForm.sessionId) {
        fetchSessionSemesters(selectedSession.id);
        fetchSessionCourses(selectedSession.id, selectedSemesterFilter);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingSemester(false);
    }
  };

  // 11. Create Session Handler
  const handleCreateSessionSubmit = async (e) => {
    e.preventDefault();
    setSubmittingSession(true);

    try {
      const res = await fetch('/api/academic/continuous-assessment/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(createSessionForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create academic session.');

      showToast(data.message, 'success');
      setIsCreateSessionModalOpen(false);
      fetchSessions();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingSession(false);
    }
  };

  // 12. Trigger Official A4 Landscape Print
  const handlePrintAssessmentSheet = () => {
    window.print();
  };

  // Filtered & Sorted Sessions for Dashboard
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchesSearch = s.session_name.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                            (s.running_semester_name && s.running_semester_name.toLowerCase().includes(dashboardSearch.toLowerCase()));

      let matchesStatus = true;
      if (dashboardStatusFilter === 'CURRENT') matchesStatus = Boolean(s.is_current);
      else if (dashboardStatusFilter === 'RUNNING') matchesStatus = s.running_semester_status === 'Running';
      else if (dashboardStatusFilter === 'PUBLISHED') matchesStatus = s.publication_status === 'Result Published';
      else if (dashboardStatusFilter === 'ARCHIVED') matchesStatus = s.publication_status === 'Archived';

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (dashboardSortBy === 'YEAR_ASC') {
        const yA = parseInt((a.session_name.match(/(\d{4})/) || [0, 0])[1]) || 0;
        const yB = parseInt((b.session_name.match(/(\d{4})/) || [0, 0])[1]) || 0;
        return yA - yB;
      }
      if (dashboardSortBy === 'STUDENTS_DESC') return (b.student_count || 0) - (a.student_count || 0);
      if (dashboardSortBy === 'COURSES_DESC') return (b.course_count || 0) - (a.course_count || 0);
      // Default: YEAR_DESC
      const yA = parseInt((a.session_name.match(/(\d{4})/) || [0, 0])[1]) || 0;
      const yB = parseInt((b.session_name.match(/(\d{4})/) || [0, 0])[1]) || 0;
      return yB - yA;
    });
  }, [sessions, dashboardSearch, dashboardStatusFilter, dashboardSortBy]);

  // Filtered Sheet Matrix
  const filteredMatrix = useMemo(() => {
    return localMatrix.filter(row => {
      const matchesSearch = row.studentRoll.toLowerCase().includes(sheetSearchQuery.toLowerCase()) ||
                            row.studentName.toLowerCase().includes(sheetSearchQuery.toLowerCase());

      let matchesStatus = true;
      if (sheetStatusFilter === 'COMPLETE') matchesStatus = Boolean(row.isCAComplete);
      else if (sheetStatusFilter === 'INCOMPLETE') matchesStatus = !row.isCAComplete;
      else if (sheetStatusFilter === 'AT_RISK') matchesStatus = row.caMarks !== null && row.caMarks < 12.0;

      return matchesSearch && matchesStatus;
    });
  }, [localMatrix, sheetSearchQuery, sheetStatusFilter]);

  return (
    <div className="regular-assessment-container" style={{ padding: '1.5rem', minHeight: '100vh', background: '#0b1120', color: '#f8fafc' }}>
      
      {/* Toast Feedback */}
      {toast && (
        <div 
          className="no-print"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            background: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DASHBOARD VIEW: SESSION-WISE CARDS & SEMESTER METADATA */}
      {/* ========================================================================= */}
      {viewMode === 'DASHBOARD' && (
        <div className="assessment-dashboard-view">
          {/* Header Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)'
                }}>
                  <Award size={22} />
                </div>
                <div>
                  <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    Regular Assessment Management System
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                    Department of Computer Science & Engineering, PUST • Centralized Session & Semester Operations
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={onBackToDashboard}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.85rem',
                  padding: '0.6rem 1rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={16} />
                <span>Dashboard</span>
              </button>

              <button
                onClick={fetchSessions}
                disabled={loadingSessions}
                title="Refresh sessions from database"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} className={loadingSessions ? 'spin' : ''} />
              </button>

              {isAuthority && (
                <>
                  <button
                    onClick={() => {
                      if (sessions.length > 0) {
                        setCreateSemesterForm(prev => ({ ...prev, sessionId: sessions[0].id }));
                      }
                      setIsCreateSemesterModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0.6rem 1.15rem',
                      background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)'
                    }}
                  >
                    <PlusCircle size={17} />
                    <span>Create Semester</span>
                  </button>

                  <button
                    onClick={() => setIsCreateSessionModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0.6rem 1.15rem',
                      background: 'rgba(236, 72, 153, 0.15)',
                      border: '1px solid rgba(236, 72, 153, 0.4)',
                      color: '#f472b6',
                      borderRadius: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={17} />
                    <span>New Session</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Controls: Search, Filters & Sorters */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '420px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search session name or running semester..."
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.85rem 0.6rem 2.25rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Batches' },
                { id: 'CURRENT', label: 'Current Batch' },
                { id: 'RUNNING', label: 'Running Semesters' },
                { id: 'PUBLISHED', label: 'Results Published' },
                { id: 'ARCHIVED', label: 'Archived' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardStatusFilter(tab.id)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: dashboardStatusFilter === tab.id ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                    color: dashboardStatusFilter === tab.id ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sorter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SlidersHorizontal size={15} style={{ color: '#94a3b8' }} />
              <select
                value={dashboardSortBy}
                onChange={(e) => setDashboardSortBy(e.target.value)}
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  padding: '0.45rem 0.65rem',
                  outline: 'none'
                }}
              >
                <option value="YEAR_DESC">Newest Session</option>
                <option value="YEAR_ASC">Oldest Session</option>
                <option value="STUDENTS_DESC">Most Students</option>
                <option value="COURSES_DESC">Most Courses</option>
              </select>
            </div>
          </div>

          {/* Session Cards Grid */}
          {loadingSessions ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
              <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', color: '#6366f1' }} />
              <p style={{ fontSize: '0.95rem' }}>Loading dynamic academic sessions from database...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.15)'
            }}>
              <Calendar size={48} style={{ color: '#64748b', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#ffffff' }}>
                No Academic Sessions Found
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                No batches match your search criteria. As semesters are created and completed, their assessment history is automatically preserved.
              </p>
              {isAuthority && (
                <button
                  onClick={() => setIsCreateSemesterModalOpen(true)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Create First Semester
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.25rem'
            }}>
              {filteredSessions.map(sess => {
                const isCurrent = Boolean(sess.is_current);
                const runningStatus = sess.running_semester_status || 'Running';

                return (
                  <div
                    key={sess.id}
                    style={{
                      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
                      borderRadius: '16px',
                      border: isCurrent ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '1.35rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = isCurrent ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)'; }}
                  >
                    {/* Top Accent Line */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: isCurrent 
                        ? 'linear-gradient(90deg, #6366f1, #ec4899)'
                        : sess.publication_status === 'Result Published'
                          ? 'linear-gradient(90deg, #10b981, #059669)'
                          : 'rgba(255, 255, 255, 0.15)'
                    }} />

                    <div>
                      {/* Header Row: Session Name & Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                            {sess.session_name}
                          </h3>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            Academic Batch • 4-Year B.Sc. Engineering
                          </span>
                        </div>

                        {isCurrent ? (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.4)'
                          }}>
                            CURRENT BATCH
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: '#94a3b8'
                          }}>
                            PREVIOUS BATCH
                          </span>
                        )}
                      </div>

                      {/* Running Semester Banner (Dynamic from DB) */}
                      <div style={{
                        padding: '0.75rem 0.95rem',
                        background: runningStatus === 'Result Published' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : runningStatus === 'Running'
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.2rem' }}>
                          Current Semester State
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9' }}>
                            {sess.running_semester_name}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: runningStatus === 'Result Published'
                              ? '#059669'
                              : runningStatus === 'Running'
                                ? '#2563eb'
                                : '#475569',
                            color: '#ffffff'
                          }}>
                            {runningStatus}
                          </span>
                        </div>

                        {/* Dates */}
                        {(sess.running_semester_start_date || sess.running_semester_end_date) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                            <Calendar size={12} />
                            <span>
                              {sess.running_semester_start_date || 'Start'} to {sess.running_semester_end_date || 'End'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Stat Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.65rem',
                        marginBottom: '1.25rem'
                      }}>
                        <div style={{ padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', textAlign: 'center' }}>
                          <Users size={16} style={{ color: '#38bdf8', margin: '0 auto 0.2rem' }} />
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                            {sess.student_count || 0}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Students</div>
                        </div>

                        <div style={{ padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', textAlign: 'center' }}>
                          <BookOpen size={16} style={{ color: '#a78bfa', margin: '0 auto 0.2rem' }} />
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                            {sess.course_count || 0}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Courses</div>
                        </div>

                        <div style={{ padding: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', textAlign: 'center' }}>
                          <GraduationCap size={16} style={{ color: '#34d399', margin: '0 auto 0.2rem' }} />
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                            {sess.teacher_count || 0}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Teachers</div>
                        </div>
                      </div>

                      {/* Status Badges Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '1.25rem' }}>
                        <span style={{ color: '#94a3b8' }}>Publication Status:</span>
                        <span style={{
                          fontWeight: 700,
                          color: sess.publication_status === 'Result Published' ? '#34d399' : '#e2e8f0'
                        }}>
                          {sess.publication_status}
                        </span>
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <button
                      onClick={() => handleOpenSession(sess)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.2))',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb, #6366f1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.2))'; }}
                    >
                      <span>Explore Assessment & Courses</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SESSION COURSES EXPLORER: SEMESTER TABS & ROUTINE-LINKED COURSES */}
      {/* ========================================================================= */}
      {viewMode === 'SESSION_COURSES' && selectedSession && (
        <div className="session-courses-view">
          {/* Top Session Breadcrumb Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <button
                onClick={() => setViewMode('DASHBOARD')}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Back to Sessions Dashboard"
              >
                <ArrowLeft size={18} />
              </button>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    {selectedSession.session_name}
                  </h2>
                  {selectedSession.is_current ? (
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '8px', background: '#2563eb', color: '#ffffff' }}>
                      CURRENT BATCH
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
                      HISTORICAL BATCH
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  4-Year Curriculum Courses • Assigned Faculty from Routine Module • Continuous Assessment
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isAuthority && (
                <button
                  onClick={() => {
                    setCreateSemesterForm(prev => ({ ...prev, sessionId: selectedSession.id }));
                    setIsCreateSemesterModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '0.6rem 1.15rem',
                    background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <PlusCircle size={16} />
                  <span>Add Semester</span>
                </button>
              )}
            </div>
          </div>

          {/* Semester Selector Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.75rem',
            marginBottom: '1.25rem'
          }}>
            <button
              onClick={() => {
                setSelectedSemesterFilter('ALL');
                fetchSessionCourses(selectedSession.id, 'ALL');
              }}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selectedSemesterFilter === 'ALL' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                color: selectedSemesterFilter === 'ALL' ? '#ffffff' : '#94a3b8',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: selectedSemesterFilter === 'ALL' ? '#60a5fa' : 'rgba(255, 255, 255, 0.06)'
              }}
            >
              All Semesters ({coursesData.courses.length})
            </button>

            {sessionSemesters.map(sem => {
              const isSelected = selectedSemesterFilter === sem.id;
              const status = sem.status || 'Running';

              return (
                <button
                  key={sem.id}
                  onClick={() => {
                    setSelectedSemesterFilter(sem.id);
                    fetchSessionCourses(selectedSession.id, sem.id);
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: isSelected ? '#818cf8' : 'rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                    color: isSelected ? '#ffffff' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{sem.semester_name}</span>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '6px',
                    background: status === 'Result Published' ? '#059669' : status === 'Running' ? '#2563eb' : '#475569',
                    color: '#ffffff'
                  }}>
                    {status}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar inside courses */}
          <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: '380px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search course code or title..."
              value={courseSearchQuery}
              onChange={(e) => setCourseSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Unassigned Courses Tray / Administrative Alert (Requirement 3) */}
          {coursesData.unassignedCourses.length > 0 && (
            <div style={{
              padding: '1.15rem 1.35rem',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '14px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#fbbf24', marginBottom: '0.45rem' }}>
                <AlertTriangle size={18} />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>
                  Administrative Notice: {coursesData.unassignedCourses.length} Courses Pending Teacher Assignment in Routine Module
                </h4>
              </div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                According to departmental policy, assessment marks can only be entered by assigned course teachers. 
                These courses currently have no teacher allocated in the Routine module. Please assign faculty through the Routine builder to enable marks evaluation.
              </p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {coursesData.unassignedCourses.map(uc => (
                  <span
                    key={uc.id}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fef08a',
                      border: '1px solid rgba(245, 158, 11, 0.25)'
                    }}
                  >
                    {uc.course_code}: {uc.course_title} ({uc.credit_hours} Cr)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Courses Grid (Ready for Teacher Assessment) */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
              Assigned Courses for Assessment ({coursesData.assignedCourses.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Showing courses with verified faculty allocation
            </span>
          </div>

          {loadingCourses ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.75rem', color: '#3b82f6' }} />
              <p style={{ fontSize: '0.85rem' }}>Loading course allocations from database...</p>
            </div>
          ) : coursesData.assignedCourses.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '14px',
              border: '1px dashed rgba(255, 255, 255, 0.12)'
            }}>
              <BookOpen size={40} style={{ color: '#64748b', margin: '0 auto 0.75rem' }} />
              <h4 style={{ margin: '0 0 0.35rem', color: '#ffffff', fontSize: '1rem' }}>No Assigned Courses Available</h4>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                No courses currently have teachers assigned in the Routine module for this semester.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.25rem'
            }}>
              {coursesData.assignedCourses
                .filter(c => c.course_code.toLowerCase().includes(courseSearchQuery.toLowerCase()) || c.course_title.toLowerCase().includes(courseSearchQuery.toLowerCase()))
                .map(course => {
                  const isUserAssigned = Boolean(course.is_user_assigned_teacher);
                  const isLocked = Boolean(course.is_locked);

                  return (
                    <div
                      key={course.id}
                      style={{
                        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                        borderRadius: '14px',
                        border: isUserAssigned ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
                        position: 'relative'
                      }}
                    >
                      <div>
                        {/* Course Code & Type Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.01em' }}>
                            {course.course_code}
                          </span>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: course.course_type === 'Theory' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                            color: course.course_type === 'Theory' ? '#60a5fa' : '#c084fc'
                          }}>
                            {course.course_type || 'Theory'} • {course.credit_hours} Cr
                          </span>
                        </div>

                        {/* Title */}
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.85rem', color: '#f1f5f9', lineHeight: 1.35 }}>
                          {course.course_title}
                        </h4>

                        {/* Assigned Teacher Card */}
                        <div style={{
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(15, 23, 42, 0.6)',
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          marginBottom: '0.85rem'
                        }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            flexShrink: 0
                          }}>
                            {course.assigned_teacher_name?.[0] || 'T'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {course.assigned_teacher_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {course.assigned_teacher_designation || 'Faculty Member'} • {course.assigned_teacher_department || 'CSE'}
                            </div>
                          </div>
                        </div>

                        {/* Status & Assessment Progress */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '1rem' }}>
                          <span style={{ color: '#94a3b8' }}>Status:</span>
                          <span style={{
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: isLocked ? 'rgba(100, 116, 139, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                            color: isLocked ? '#94a3b8' : '#34d399'
                          }}>
                            {course.status}
                          </span>
                        </div>
                      </div>

                      {/* Open Assessment Sheet Button */}
                      <button
                        onClick={() => handleOpenAssessmentSheet(course)}
                        style={{
                          width: '100%',
                          padding: '0.7rem',
                          borderRadius: '10px',
                          background: isUserAssigned 
                            ? 'linear-gradient(135deg, #059669, #10b981)' 
                            : 'rgba(255, 255, 255, 0.08)',
                          border: isUserAssigned ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer'
                        }}
                      >
                        <FileSpreadsheet size={16} />
                        <span>{isUserAssigned && !isLocked ? 'Enter Assessment Marks' : 'View Assessment Sheet'}</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SPREADSHEET ASSESSMENT SHEET VIEW (Interactive Mark Entry & A4 Print) */}
      {/* ========================================================================= */}
      {viewMode === 'ASSESSMENT_SHEET' && marksSheetData && selectedCourse && (
        <div className="course-assessment-sheet-view">
          
          {/* Action Toolbar (Hidden during print) */}
          <div className="no-print" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.15rem 1.35rem',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.35)'
          }}>
            {/* Left Info: Back & Course Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <button
                onClick={() => setViewMode('SESSION_COURSES')}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Back to Courses"
              >
                <ArrowLeft size={16} />
              </button>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    {selectedCourse.course_code} — {selectedCourse.course_title}
                  </h2>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background: marksSheetData.isLocked ? '#475569' : '#059669',
                    color: '#ffffff'
                  }}>
                    {marksSheetData.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                  Faculty: <strong style={{ color: '#ffffff' }}>{selectedCourse.assigned_teacher_name}</strong> • Session: {selectedCourse.session_name} • {selectedCourse.semester_name}
                </div>
              </div>
            </div>

            {/* Right Buttons: Save, Print, Publish, Reopen */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              
              {/* Print Assessment Sheet Button (Requirement 13) */}
              <button
                onClick={handlePrintAssessmentSheet}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '0.55rem 1rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Printer size={16} />
                <span>Print Assessment Sheet</span>
              </button>

              {/* Save Marks Button */}
              {marksSheetData.canEdit && (
                <button
                  onClick={handleSaveMarks}
                  disabled={savingSheet || !isDirty}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '0.55rem 1.15rem',
                    background: isDirty ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: isDirty ? '#ffffff' : '#64748b',
                    borderRadius: '8px',
                    cursor: isDirty ? 'pointer' : 'default',
                    boxShadow: isDirty ? '0 4px 15px rgba(16, 185, 129, 0.35)' : 'none'
                  }}
                >
                  <Save size={16} className={savingSheet ? 'spin' : ''} />
                  <span>{savingSheet ? 'Saving...' : isDirty ? 'Save Marks' : 'Saved'}</span>
                </button>
              )}

              {/* Submit Assessment Button (Teacher) */}
              {marksSheetData.canEdit && marksSheetData.status === 'Running' && (
                <button
                  onClick={handleSubmitAssessment}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '0.55rem 1rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#a5b4fc',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Send size={15} />
                  <span>Submit for Review</span>
                </button>
              )}

              {/* Publish Results Button (Admin / Authority) */}
              {isAuthority && marksSheetData.status !== 'Result Published' && (
                <button
                  onClick={handlePublishResults}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '0.55rem 1rem',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Publish Results</span>
                </button>
              )}

              {/* Reopen Locked Assessment (Admin / Authority) */}
              {isAuthority && marksSheetData.isLocked && (
                <button
                  onClick={() => setIsReopenModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '0.55rem 1rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Reopen Assessment</span>
                </button>
              )}

              {/* Audit Logs Button */}
              <button
                onClick={handleOpenAuditLogs}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="View Assessment Audit Logs"
              >
                <History size={16} />
              </button>
            </div>
          </div>

          {/* Sub-bar: Search, Filter & Final Max Marks configuration */}
          <div className="no-print" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search student roll or name..."
                value={sheetSearchQuery}
                onChange={(e) => setSheetSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem 0.45rem 2rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {[
                { id: 'ALL', label: `All (${localMatrix.length})` },
                { id: 'COMPLETE', label: `Complete (${localMatrix.filter(m => m.isCAComplete).length})` },
                { id: 'INCOMPLETE', label: `Incomplete (${localMatrix.filter(m => !m.isCAComplete).length})` },
                { id: 'AT_RISK', label: 'At Risk (<40%)' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSheetStatusFilter(f.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: sheetStatusFilter === f.id ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                    color: sheetStatusFilter === f.id ? '#ffffff' : '#94a3b8'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Final Theory Max Marks Configuration */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
              <span>Final Theory Max:</span>
              <input
                type="number"
                min="10"
                max="100"
                value={finalTheoryMaxMarks}
                disabled={!marksSheetData.canEdit}
                onChange={(e) => setFinalTheoryMaxMarks(parseFloat(e.target.value) || 70.0)}
                style={{
                  width: '60px',
                  padding: '0.35rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  textAlign: 'center'
                }}
              />
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SPREADSHEET TABLE: ON SCREEN & PRINT READY */}
          {/* ===================================================================== */}
          <div 
            id="printable-assessment-sheet"
            style={{
              background: '#0f172a',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* PRINT-ONLY OFFICIAL HEADER BLOCK (Visible Only During Window Print) */}
            <div 
              className="print-only"
              style={{
                display: 'none',
                padding: '1.25rem 1.5rem',
                borderBottom: '2px solid #000000',
                textAlign: 'center',
                color: '#000000',
                background: '#ffffff'
              }}
            >
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: '0 0 0.2rem', textTransform: 'uppercase', color: '#000000' }}>
                Pabna University of Science & Technology
              </h2>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.2rem', color: '#000000' }}>
                Department of Computer Science & Engineering
              </h3>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#333333' }}>
                Official Academic Assessment & Continuous Evaluation Sheet
              </h4>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
                fontSize: '0.78rem',
                textAlign: 'left',
                borderTop: '1px solid #cccccc',
                paddingTop: '0.5rem',
                color: '#000000'
              }}>
                <div><strong>Course Code:</strong> {selectedCourse.course_code}</div>
                <div><strong>Course Title:</strong> {selectedCourse.course_title}</div>
                <div><strong>Credit Hours:</strong> {selectedCourse.credit_hours} Cr ({selectedCourse.course_type})</div>
                <div><strong>Session / Batch:</strong> {selectedCourse.session_name}</div>
                <div><strong>Semester:</strong> {selectedCourse.semester_name}</div>
                <div><strong>Course Teacher:</strong> {selectedCourse.assigned_teacher_name}</div>
                <div><strong>Status:</strong> {marksSheetData.status}</div>
                <div><strong>Printed Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
            </div>

            {/* Spreadsheet Table Container */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(30, 41, 59, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem 0.85rem', width: '50px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '0.75rem 0.85rem', minWidth: '130px' }}>Student Roll</th>
                    <th style={{ padding: '0.75rem 0.85rem', minWidth: '180px' }}>Student Name</th>
                    <th style={{ padding: '0.75rem 0.5rem', width: '85px', textAlign: 'center' }}>CT-1 (/10)</th>
                    <th style={{ padding: '0.75rem 0.5rem', width: '85px', textAlign: 'center' }}>CT-2 (/10)</th>
                    <th style={{ padding: '0.75rem 0.5rem', width: '85px', textAlign: 'center' }}>CT-3 (/10)</th>
                    <th style={{ padding: '0.75rem 0.5rem', width: '85px', textAlign: 'center' }}>Att (/10)</th>
                    <th style={{ padding: '0.75rem 0.75rem', width: '100px', textAlign: 'center', background: 'rgba(99, 102, 241, 0.12)', color: '#c7d2fe' }}>
                      CA (/30)
                    </th>
                    <th style={{ padding: '0.75rem 0.65rem', width: '80px', textAlign: 'center' }}>CA Grade</th>
                    <th style={{ padding: '0.75rem 0.65rem', width: '80px', textAlign: 'center' }}>CA Rank</th>
                    <th style={{ padding: '0.75rem 0.5rem', width: '100px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', color: '#bfdbfe' }}>
                      Final Theory (/{finalTheoryMaxMarks})
                    </th>
                    <th style={{ padding: '0.75rem 0.85rem', width: '100px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        No enrolled students match your search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map((row, idx) => {
                      const isComplete = Boolean(row.isCAComplete);
                      const isAtRisk = row.caMarks !== null && row.caMarks < 12.0;

                      return (
                        <tr 
                          key={row.studentId}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent',
                            transition: 'background 0.1s ease'
                          }}
                        >
                          {/* Row Index */}
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                            {idx + 1}
                          </td>

                          {/* Student Roll */}
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                            {row.studentRoll}
                          </td>

                          {/* Student Name */}
                          <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                            {row.studentName}
                          </td>

                          {/* CT-1 Input */}
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}>
                            <input
                              id={`cell-${idx}-ct1`}
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              disabled={!marksSheetData.canEdit}
                              placeholder="—"
                              value={row.ct1 !== null && row.ct1 !== undefined ? row.ct1 : ''}
                              onChange={(e) => handleCellChange(row.studentId, 'ct1', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, idx, 'ct1')}
                              style={{
                                width: '65px',
                                padding: '0.4rem',
                                background: marksSheetData.canEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                textAlign: 'center',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                          </td>

                          {/* CT-2 Input */}
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}>
                            <input
                              id={`cell-${idx}-ct2`}
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              disabled={!marksSheetData.canEdit}
                              placeholder="—"
                              value={row.ct2 !== null && row.ct2 !== undefined ? row.ct2 : ''}
                              onChange={(e) => handleCellChange(row.studentId, 'ct2', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, idx, 'ct2')}
                              style={{
                                width: '65px',
                                padding: '0.4rem',
                                background: marksSheetData.canEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                textAlign: 'center',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                          </td>

                          {/* CT-3 Input */}
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}>
                            <input
                              id={`cell-${idx}-ct3`}
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              disabled={!marksSheetData.canEdit}
                              placeholder="—"
                              value={row.ct3 !== null && row.ct3 !== undefined ? row.ct3 : ''}
                              onChange={(e) => handleCellChange(row.studentId, 'ct3', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, idx, 'ct3')}
                              style={{
                                width: '65px',
                                padding: '0.4rem',
                                background: marksSheetData.canEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                textAlign: 'center',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                          </td>

                          {/* Attendance Input */}
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}>
                            <input
                              id={`cell-${idx}-attendance`}
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              disabled={!marksSheetData.canEdit}
                              placeholder="—"
                              value={row.attendance !== null && row.attendance !== undefined ? row.attendance : ''}
                              onChange={(e) => handleCellChange(row.studentId, 'attendance', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, idx, 'attendance')}
                              style={{
                                width: '65px',
                                padding: '0.4rem',
                                background: marksSheetData.canEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                textAlign: 'center',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                          </td>

                          {/* Computed CA Marks (/30) */}
                          <td style={{
                            padding: '0.65rem 0.75rem',
                            textAlign: 'center',
                            fontWeight: 800,
                            background: 'rgba(99, 102, 241, 0.08)',
                            color: isComplete ? '#a5b4fc' : '#64748b'
                          }}>
                            {isComplete ? (
                              <span title={`Best 2: ${row.best2Total} + Att: ${row.attendance}`}>
                                {row.caMarks}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontStyle: 'italic' }}>
                                Incomplete
                              </span>
                            )}
                          </td>

                          {/* CA Grade */}
                          <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center' }}>
                            {row.caGrade === 'Incomplete' ? (
                              <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>
                                Pending
                              </span>
                            ) : row.caGrade === '—' ? (
                              <span style={{ color: '#64748b' }}>—</span>
                            ) : (
                              <span style={{
                                fontWeight: 800,
                                fontSize: '0.82rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                background: isAtRisk ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                color: isAtRisk ? '#f87171' : '#34d399'
                              }}>
                                {row.caGrade}
                              </span>
                            )}
                          </td>

                          {/* CA Rank */}
                          <td style={{ padding: '0.65rem 0.65rem', textAlign: 'center', fontWeight: 700, color: row.caRank ? '#f59e0b' : '#64748b' }}>
                            {formatOrdinal(row.caRank)}
                          </td>

                          {/* Final Theory Marks Input */}
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.05)' }}>
                            <input
                              id={`cell-${idx}-finalTheory`}
                              type="number"
                              step="0.5"
                              min="0"
                              max={finalTheoryMaxMarks}
                              disabled={!marksSheetData.canEdit}
                              placeholder="—"
                              value={row.finalTheory !== null && row.finalTheory !== undefined ? row.finalTheory : ''}
                              onChange={(e) => handleCellChange(row.studentId, 'finalTheory', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, idx, 'finalTheory')}
                              style={{
                                width: '75px',
                                padding: '0.4rem',
                                background: marksSheetData.canEdit ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                textAlign: 'center',
                                fontSize: '0.82rem',
                                outline: 'none'
                              }}
                            />
                          </td>

                          {/* Status */}
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '6px',
                              background: marksSheetData.isLocked ? 'rgba(100, 116, 139, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                              color: marksSheetData.isLocked ? '#94a3b8' : '#34d399'
                            }}>
                              {marksSheetData.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PRINT-ONLY SIGNATURE BLOCK (Requirement 13) */}
            <div
              className="print-only"
              style={{
                display: 'none',
                marginTop: '3.5rem',
                padding: '2rem 3rem 1rem',
                color: '#000000',
                background: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ textAlign: 'center', width: '240px' }}>
                  <div style={{ borderTop: '1px solid #000000', paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.82rem' }}>
                    Signature of Course Teacher
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#444444' }}>
                    {selectedCourse.assigned_teacher_name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666666' }}>
                    {selectedCourse.assigned_teacher_designation || 'Faculty Member'}, Dept of CSE
                  </div>
                </div>

                <div style={{ textAlign: 'center', width: '240px' }}>
                  <div style={{ borderTop: '1px solid #000000', paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.82rem' }}>
                    Chairman, Department of CSE
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#444444' }}>
                    Dr. Md. Abdur Rahim
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666666' }}>
                    Pabna University of Science & Technology
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS */}
      {/* ========================================================================= */}

      {/* Create Semester Modal (Requirement 2) */}
      {isCreateSemesterModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsCreateSemesterModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <PlusCircle size={20} style={{ color: '#6366f1' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Create New Semester</h3>
              </div>
              <button
                onClick={() => setIsCreateSemesterModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSemesterSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Session / Batch */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Academic Session / Batch *
                </label>
                <select
                  required
                  value={createSemesterForm.sessionId}
                  onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, sessionId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">Select an Academic Session</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.session_name} {s.is_current ? '(Current Batch)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year & Semester Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Year (1-4) *
                  </label>
                  <select
                    value={createSemesterForm.year}
                    onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, year: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Semester (1-2) *
                  </label>
                  <select
                    value={createSemesterForm.semester}
                    onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, semester: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="1">1st Semester</option>
                    <option value="2">2nd Semester</option>
                  </select>
                </div>
              </div>

              {/* Dates Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Semester Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={createSemesterForm.startDate}
                    onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, startDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Class Ending Date
                  </label>
                  <input
                    type="date"
                    value={createSemesterForm.classEndDate}
                    onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, classEndDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              {/* Assessment Deadline & Initial Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Assessment Deadline
                  </label>
                  <input
                    type="date"
                    value={createSemesterForm.assessmentDeadline}
                    onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, assessmentDeadline: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Semester Status *
                  </label>
                  <select
                    value={createSemesterForm.status}
                    onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Running">Running (Active)</option>
                    <option value="Assessment Submission">Assessment Submission</option>
                    <option value="Finalized">Finalized</option>
                    <option value="Result Published">Result Published</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Optional Academic Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Notes, evaluation deadlines or specific semester instructions..."
                  value={createSemesterForm.notes}
                  onChange={(e) => setCreateSemesterForm({ ...createSemesterForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateSemesterModalOpen(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSemester}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {submittingSemester ? 'Saving...' : 'Create & Populate Courses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {isCreateSessionModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsCreateSessionModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Start New Academic Session</h3>
              <button onClick={() => setIsCreateSessionModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSessionSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Session Name (e.g. Session 2026-2027) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Session 2026-2027"
                  value={createSessionForm.sessionName}
                  onChange={(e) => setCreateSessionForm({ ...createSessionForm, sessionName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Session Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={createSessionForm.startDate}
                  onChange={(e) => setCreateSessionForm({ ...createSessionForm, startDate: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="chkCurrent"
                  checked={createSessionForm.isCurrent}
                  onChange={(e) => setCreateSessionForm({ ...createSessionForm, isCurrent: e.target.checked })}
                />
                <label htmlFor="chkCurrent" style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  Set as Current Department Academic Session
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsCreateSessionModalOpen(false)} style={{ padding: '0.6rem 1rem', background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submittingSession} style={{ padding: '0.6rem 1.25rem', background: '#ec4899', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>{submittingSession ? 'Initializing...' : 'Initialize Session'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Assessment Modal */}
      {isReopenModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsReopenModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), #0f172a)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#f87171' }}>
                <RotateCcw size={18} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Authorized Reopening</h3>
              </div>
              <button onClick={() => setIsReopenModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReopenAssessment} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                You are about to reopen assessment for <strong style={{ color: '#ffffff' }}>{selectedCourse?.course_code}</strong>. 
                According to university compliance, reopening a locked assessment requires an explicit reason and is recorded in the permanent audit trail.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Administrative Reason *
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="State the reason for reopening (e.g. mark revision following student grievance resolution)..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsReopenModalOpen(false)} style={{ padding: '0.6rem 1rem', background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submittingReopen} style={{ padding: '0.6rem 1.25rem', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                  {submittingReopen ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {isAuditLogsModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsAuditLogsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              overflow: 'hidden'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <History size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Assessment Audit Trail</h3>
              </div>
              <button onClick={() => setIsAuditLogsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', maxHeight: '420px', overflowY: 'auto' }}>
              {loadingAuditLogs ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.82rem' }}>Loading audit logs...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <Clock size={32} style={{ margin: '0 auto 0.5rem', color: '#64748b' }} />
                  <p style={{ fontSize: '0.85rem' }}>No audit history records recorded for this course yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {auditLogs.map((log, i) => (
                    <div 
                      key={log.id || i}
                      style={{
                        padding: '0.85rem',
                        background: 'rgba(30, 41, 59, 0.6)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#818cf8' }}>
                          {log.action}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#f1f5f9', fontWeight: 600 }}>
                        {log.reason}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        By: {log.performed_by_name || 'System Authority'} ({log.previous_status || '—'} → {log.new_status})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContinuousAssessmentView;
