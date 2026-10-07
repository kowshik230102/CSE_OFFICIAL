import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  Plus, 
  PlusCircle, 
  Search, 
  Edit2, 
  Check, 
  X, 
  Trash2, 
  Printer, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Save
} from 'lucide-react';

export function StudentInfoView({ onBackToDashboard }) {
  const { token: authToken, user } = useAuth();

  // Helper to ensure freshest auth headers on every fetch
  const getAuthHeaders = () => {
    const curToken = authToken || localStorage.getItem('cse_token') || localStorage.getItem('token');
    return curToken ? { Authorization: `Bearer ${curToken}` } : {};
  };

  // Safe fetch helper that handles JSON vs HTML errors cleanly
  const safeFetchJson = async (url, options = {}) => {
    const defaultHeaders = getAuthHeaders();
    const mergedHeaders = {
      ...defaultHeaders,
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders
    });

    const contentType = res.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server returned status ${res.status}: ${text.slice(0, 120) || res.statusText}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `Request failed with HTTP status ${res.status}`);
    }

    return data;
  };

  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Student Sheet State
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [sheetRows, setSheetRows] = useState([]); // 40 or more rows
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [editingRowSl, setEditingRowSl] = useState(null); // SL of currently edited row
  const [editFormData, setEditFormData] = useState({}); // Form buffer for the active editing row
  const [savingRowSl, setSavingRowSl] = useState(null); // Loading state for saving row

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications & Feedback
  const [feedback, setFeedback] = useState(null);

  // Create Session Modal State
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({
    sessionName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isCurrent: false
  });
  const [creatingSession, setCreatingSession] = useState(false);

  // Delete / Clear Student Confirmation Modal
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Capacity target: initial 40 rows
  const [totalRowsTarget, setTotalRowsTarget] = useState(40);

  // 1. Initial Load: Fetch All Sessions
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async (autoSelectId = null) => {
    setLoadingSessions(true);
    try {
      const data = await safeFetchJson('/api/academic/sessions');
      const list = data.sessions || [];
      setSessions(list);

      // Select session: preferred autoSelectId -> or current session -> or first session
      let targetId = autoSelectId;
      if (!targetId) {
        const active = list.find(s => s.is_current) || list[0];
        targetId = active ? active.id : '';
      }
      if (targetId) {
        setSelectedSessionId(targetId);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      showFeedback('error', 'Failed to load academic sessions: ' + err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  // 2. Fetch Student Sheet whenever selectedSessionId changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchStudentSheet(selectedSessionId);
    } else {
      setCurrentSessionData(null);
      setSheetRows([]);
    }
  }, [selectedSessionId]);

  const fetchStudentSheet = async (sessionId) => {
    if (!sessionId) return;
    setLoadingSheet(true);
    setEditingRowSl(null);
    setEditFormData({});

    try {
      const data = await safeFetchJson(`/api/academic/sessions/${sessionId}/student-sheet`);
      setCurrentSessionData(data.session);

      // Build 40-slot student sheet array
      const dbStudents = data.students || [];
      const rows = [];
      const targetCount = Math.max(40, dbStudents.length, totalRowsTarget);
      setTotalRowsTarget(targetCount);

      // Map existing students by serial_no (1-indexed) or sequential fill
      const assignedMap = {};
      const unassignedStudents = [];

      dbStudents.forEach(st => {
        if (st.serial_no && st.serial_no >= 1 && st.serial_no <= targetCount && !assignedMap[st.serial_no]) {
          assignedMap[st.serial_no] = st;
        } else {
          unassignedStudents.push(st);
        }
      });

      for (let sl = 1; sl <= targetCount; sl++) {
        let studentRecord = assignedMap[sl];
        if (!studentRecord && unassignedStudents.length > 0) {
          studentRecord = unassignedStudents.shift();
        }

        if (studentRecord) {
          rows.push({
            sl,
            studentId: studentRecord.student_id,
            userId: studentRecord.user_id,
            studentRoll: studentRecord.student_roll || '',
            registrationNo: studentRecord.registration_no || '',
            studentName: studentRecord.student_name || '',
            contactNo: studentRecord.contact_no || '',
            fatherName: studentRecord.father_name || '',
            fatherContact: studentRecord.father_contact || '',
            motherName: studentRecord.mother_name || '',
            address: studentRecord.address || '',
            isSaved: true
          });
        } else {
          // Empty placeholder row
          rows.push({
            sl,
            studentId: null,
            userId: null,
            studentRoll: '',
            registrationNo: '',
            studentName: '',
            contactNo: '',
            fatherName: '',
            fatherContact: '',
            motherName: '',
            address: '',
            isSaved: false
          });
        }
      }

      setSheetRows(rows);
    } catch (err) {
      console.error('Error fetching student sheet:', err);
      showFeedback('error', 'Failed to load student sheet: ' + err.message);
    } finally {
      setLoadingSheet(false);
    }
  };

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(prev => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // 3. Create New Academic Session (e.g. 2022-2023, 2024-2025)
  const handleCreateSession = async (e) => {
    e.preventDefault();
    const name = newSessionForm.sessionName.trim();
    if (!name) {
      return alert('Please enter a session name (e.g., 2024-2025).');
    }

    setCreatingSession(true);
    try {
      const data = await safeFetchJson('/api/academic/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: name,
          startDate: newSessionForm.startDate || new Date().toISOString().split('T')[0],
          endDate: newSessionForm.endDate || null,
          isCurrent: newSessionForm.isCurrent
        })
      });

      showFeedback('success', `Session "${name}" created successfully! 40-seat student sheet is ready.`);
      setIsCreateSessionModalOpen(false);
      setNewSessionForm({
        sessionName: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        isCurrent: false
      });

      // Refresh and switch to newly created session
      await fetchSessions(data.sessionId);
    } catch (err) {
      alert('Error creating session: ' + err.message);
    } finally {
      setCreatingSession(false);
    }
  };

  // 4. Start Editing a Row
  const handleStartEditRow = (row) => {
    setEditingRowSl(row.sl);
    setEditFormData({
      studentId: row.studentId,
      serialNo: row.sl,
      studentRoll: row.studentRoll || '',
      registrationNo: row.registrationNo || '',
      studentName: row.studentName || '',
      contactNo: row.contactNo || '',
      fatherName: row.fatherName || '',
      fatherContact: row.fatherContact || '',
      motherName: row.motherName || '',
      address: row.address || ''
    });
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingRowSl(null);
    setEditFormData({});
  };

  // Handle Edit Input Change
  const handleInputChange = (field, val) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: val
    }));
  };

  // 5. Save Single Row to Database
  const handleSaveRow = async (sl) => {
    if (!selectedSessionId) {
      showFeedback('error', 'Please select or create an academic session first.');
      return;
    }

    const roll = (editFormData.studentRoll || '').trim();
    if (!roll) {
      showFeedback('error', `Row SL #${sl}: Roll number is required.`);
      return;
    }

    setSavingRowSl(sl);
    try {
      const payload = {
        studentId: editFormData.studentId || null,
        serialNo: sl,
        studentRoll: roll,
        registrationNo: (editFormData.registrationNo || '').trim(),
        studentName: (editFormData.studentName || '').trim(),
        contactNo: (editFormData.contactNo || '').trim(),
        fatherName: (editFormData.fatherName || '').trim(),
        fatherContact: (editFormData.fatherContact || '').trim(),
        motherName: (editFormData.motherName || '').trim(),
        address: (editFormData.address || '').trim()
      };

      const data = await safeFetchJson(`/api/academic/sessions/${selectedSessionId}/student-sheet/row`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const saved = data.student;

      // Update state locally immediately
      setSheetRows(prevRows => prevRows.map(r => {
        if (r.sl === sl) {
          return {
            ...r,
            studentId: saved.student_id,
            userId: saved.user_id,
            studentRoll: saved.student_roll,
            registrationNo: saved.registration_no,
            studentName: saved.student_name,
            contactNo: saved.contact_no,
            fatherName: saved.father_name,
            fatherContact: saved.father_contact,
            motherName: saved.mother_name,
            address: saved.address,
            isSaved: true
          };
        }
        return r;
      }));

      showFeedback('success', `SL #${sl} (${saved.student_roll} - ${saved.student_name}) saved to database successfully!`);
      setEditingRowSl(null);
      setEditFormData({});
    } catch (err) {
      showFeedback('error', `Failed to save Row #${sl}: ${err.message}`);
    } finally {
      setSavingRowSl(null);
    }
  };

  // 6. Delete / Clear Student Row
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget || !selectedSessionId) return;
    setIsDeleting(true);

    try {
      const data = await safeFetchJson(`/api/academic/sessions/${selectedSessionId}/student-sheet/${deleteConfirmTarget.studentId}`, {
        method: 'DELETE'
      });

      // Reset row in sheet to empty slot
      setSheetRows(prevRows => prevRows.map(r => {
        if (r.sl === deleteConfirmTarget.sl) {
          return {
            sl: r.sl,
            studentId: null,
            userId: null,
            studentRoll: '',
            registrationNo: '',
            studentName: '',
            contactNo: '',
            fatherName: '',
            fatherContact: '',
            motherName: '',
            address: '',
            isSaved: false
          };
        }
        return r;
      }));

      showFeedback('success', data.message || `Student cleared from SL #${deleteConfirmTarget.sl}.`);
      setDeleteConfirmTarget(null);
    } catch (err) {
      showFeedback('error', 'Error deleting student: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // 7. Add More Rows (Scalability beyond 40)
  const handleAddMoreRows = (count = 10) => {
    setSheetRows(prev => {
      const startSl = prev.length + 1;
      const newRows = [];
      for (let i = 0; i < count; i++) {
        newRows.push({
          sl: startSl + i,
          studentId: null,
          userId: null,
          studentRoll: '',
          registrationNo: '',
          studentName: '',
          contactNo: '',
          fatherName: '',
          fatherContact: '',
          motherName: '',
          address: '',
          isSaved: false
        });
      }
      return [...prev, ...newRows];
    });
    setTotalRowsTarget(prev => prev + count);
    showFeedback('success', `Added ${count} additional rows to the student sheet.`);
  };

  // Filtered rows for Search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return sheetRows;
    const q = searchQuery.toLowerCase().trim();
    return sheetRows.filter(r => {
      // If currently editing this row, always keep visible
      if (editingRowSl === r.sl) return true;
      return (
        (r.studentRoll && r.studentRoll.toLowerCase().includes(q)) ||
        (r.registrationNo && r.registrationNo.toLowerCase().includes(q)) ||
        (r.studentName && r.studentName.toLowerCase().includes(q)) ||
        (r.contactNo && r.contactNo.toLowerCase().includes(q)) ||
        (r.fatherName && r.fatherName.toLowerCase().includes(q)) ||
        (r.motherName && r.motherName.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q))
      );
    });
  }, [sheetRows, searchQuery, editingRowSl]);

  // Enrolled student count
  const enrolledCount = useMemo(() => {
    return sheetRows.filter(r => r.studentRoll && r.studentRoll.trim() !== '').length;
  }, [sheetRows]);

  // Selected session object
  const activeSessionObj = useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId) || currentSessionData;
  }, [sessions, selectedSessionId, currentSessionData]);

  // Browser Print trigger
  const handlePrint = () => {
    setEditingRowSl(null);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="student-info-page" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ========================================================================= */}
      {/* TOP HEADER & SESSION SELECTOR BANNER */}
      {/* ========================================================================= */}
      <div 
        className="no-print" 
        style={{
          background: 'linear-gradient(135deg, #09101d 0%, #0f172a 50%, #064e3b 100%)',
          borderRadius: '16px',
          padding: '1.5rem 1.75rem',
          color: '#ffffff',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#10b981', color: '#ffffff', fontWeight: 800, padding: '0.25rem 0.65rem' }}>
                🎓 Department Intake: 40 Seats
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Pabna University of Science and Technology • Dept of CSE
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
              Session-wise Student Information System
            </h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '720px' }}>
              Permanent database sheet for undergraduate student intake roster. Changes here automatically synchronize to marks, courses, and semester records.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="btn btn-secondary"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={16} /> Dashboard
              </button>
            )}

            <button
              type="button"
              id="btn-print-student-sheet"
              onClick={handlePrint}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#93c5fd',
                border: '1px solid rgba(96, 165, 250, 0.4)',
                padding: '0.6rem 1.15rem',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Print official student sheet or save as PDF"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>

            <button
              type="button"
              id="btn-open-create-session"
              onClick={() => setIsCreateSessionModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              <PlusCircle size={18} /> + Create New Session
            </button>
          </div>
        </div>

        {/* Sessions Tabs / Selector */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Academic Sessions / Batches:
            </span>
            <span style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
              Click any session to open its 40-Student Information Sheet
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {loadingSessions ? (
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RefreshCw size={14} className="spin" /> Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>
                No academic sessions registered yet. Click <strong>+ Create New Session</strong> to start!
              </div>
            ) : (
              sessions.map(sess => {
                const isSelected = selectedSessionId === sess.id;
                return (
                  <button
                    key={sess.id}
                    type="button"
                    onClick={() => setSelectedSessionId(sess.id)}
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      border: isSelected ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Calendar size={14} style={{ color: isSelected ? '#ffffff' : '#94a3b8' }} />
                    <span>{sess.session_name}</span>
                    {sess.is_current ? (
                      <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.25)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 800 }}>
                        CURRENT
                      </span>
                    ) : null}
                    <span style={{
                      fontSize: '0.7rem',
                      background: isSelected ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '6px',
                      fontWeight: 700
                    }}>
                      {sess.student_count ?? (selectedSessionId === sess.id ? enrolledCount : 0)}/40
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FEEDBACK ALERT */}
      {/* ========================================================================= */}
      {feedback && (
        <div 
          className="no-print" 
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: feedback.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca',
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 40-STUDENT INFORMATION SHEET CONTAINER */}
      {/* ========================================================================= */}
      <div 
        className="student-sheet-card card" 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Printable Official University Header (Visible only when Printing) */}
        <div className="print-only print-sheet-header">
          <div className="univ-title">
            Pabna University of Science and Technology
          </div>
          <div className="dept-title">
            Department of Computer Science & Engineering
          </div>
          <div className="sheet-title">
            Official Student Information & Roster Sheet
          </div>
          <div className="meta-bar">
            <span>Session: <strong>{activeSessionObj?.session_name || 'Selected Session'}</strong></span>
            <span>Intake Capacity: <strong>40 Seats</strong></span>
            <span>Enrolled Students: <strong>{enrolledCount}</strong></span>
            <span>Date Printed: <strong>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></span>
          </div>
        </div>

        {/* Sheet Controls Bar (Search, Capacity Stats, Add More Rows) */}
        <div 
          className="no-print" 
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            background: '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          {/* Active Session Identity Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {activeSessionObj ? activeSessionObj.session_name : 'Student Sheet'}
                </h3>
                <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: '0.72rem' }}>
                  Session Sheet
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                Total 40 Standard Seats • Showing SL 1 to {sheetRows.length}
              </div>
            </div>

            {/* Quick Progress Badge */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.82rem'
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Enrolled: </span>
                <strong style={{ color: '#059669' }}>{enrolledCount}</strong>
                <span style={{ color: '#94a3b8' }}> / 40</span>
              </div>
              <div style={{ width: '1px', height: '14px', background: '#cbd5e1' }} />
              <div>
                <span style={{ color: '#64748b' }}>Available: </span>
                <strong style={{ color: enrolledCount >= 40 ? '#ef4444' : '#2563eb' }}>
                  {Math.max(0, 40 - enrolledCount)}
                </strong>
              </div>
            </div>
          </div>

          {/* Search Bar & Extra Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search Roll, Name, Reg, Address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2rem', paddingRight: '1.5rem', fontSize: '0.82rem', height: '36px', width: '100%', borderRadius: '8px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchStudentSheet(selectedSessionId)}
              className="btn btn-secondary"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
              title="Refresh sheet data"
            >
              <RefreshCw size={14} className={loadingSheet ? 'spin' : ''} /> Refresh
            </button>

            <button
              type="button"
              onClick={() => handleAddMoreRows(10)}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
              title="Expand capacity with 10 more rows"
            >
              <Plus size={14} /> + Add 10 Rows
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BUG 2 FIX: GENEROUS COLUMN WIDTHS & HORIZONTAL SCROLLABLE TABLE */}
        {/* ========================================================================= */}
        {loadingSheet ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={32} className="spin" style={{ margin: '0 auto 0.75rem', color: '#10b981' }} />
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Loading Session Student Information Sheet...</div>
            <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Fetching database records for {activeSessionObj?.session_name || 'session'}...</p>
          </div>
        ) : (
          <div 
            className="table-responsive student-sheet-responsive" 
            style={{ 
              overflowX: 'auto', 
              width: '100%',
              maxWidth: '100%',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <table 
              className="student-sheet-table" 
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.84rem',
                textAlign: 'left'
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', color: '#1e293b', borderBottom: '2px solid #cbd5e1', fontWeight: 800 }}>
                  <th className="th-col-sl" style={{ padding: '0.85rem 0.65rem', textAlign: 'center' }}>SL</th>
                  <th className="th-col-roll" style={{ padding: '0.85rem 0.85rem' }}>Roll</th>
                  <th className="th-col-reg" style={{ padding: '0.85rem 0.85rem' }}>Registration</th>
                  <th className="th-col-name" style={{ padding: '0.85rem 0.85rem' }}>Student Name</th>
                  <th className="th-col-contact" style={{ padding: '0.85rem 0.85rem' }}>Contact No.</th>
                  <th className="th-col-father" style={{ padding: '0.85rem 0.85rem' }}>Father Name</th>
                  <th className="th-col-father-contact" style={{ padding: '0.85rem 0.85rem' }}>Father Contact</th>
                  <th className="th-col-mother" style={{ padding: '0.85rem 0.85rem' }}>Mother Name</th>
                  <th className="th-col-address" style={{ padding: '0.85rem 0.85rem' }}>Address</th>
                  <th className="th-col-actions no-print" style={{ padding: '0.85rem 0.85rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isEditing = editingRowSl === row.sl;
                  const isSaving = savingRowSl === row.sl;
                  const hasData = Boolean(row.studentRoll && row.studentRoll.trim());

                  return (
                    <tr 
                      key={`row-${row.sl}`}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: isEditing 
                          ? '#f0fdf4' 
                          : hasData 
                          ? '#ffffff' 
                          : (row.sl % 2 === 0 ? '#fafafa' : '#ffffff'),
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* 1. SL */}
                      <td className="td-col-sl" style={{
                        padding: '0.75rem 0.65rem',
                        textAlign: 'center',
                        fontWeight: 800,
                        color: hasData ? '#0f172a' : '#94a3b8',
                        background: hasData ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                        borderRight: '1px solid #f1f5f9'
                      }}>
                        {row.sl}
                      </td>

                      {/* 2. Roll */}
                      <td className="td-col-roll" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            required
                            placeholder="e.g. 20230101"
                            value={editFormData.studentRoll || ''}
                            onChange={(e) => handleInputChange('studentRoll', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 800,
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                            autoFocus
                          />
                        ) : (
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            color: hasData ? '#1e40af' : '#94a3b8',
                            display: 'block'
                          }}>
                            {row.studentRoll || '—'}
                          </span>
                        )}
                      </td>

                      {/* 3. Registration */}
                      <td className="td-col-reg" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="e.g. 19010101"
                            value={editFormData.registrationNo || ''}
                            onChange={(e) => handleInputChange('registrationNo', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              fontFamily: 'var(--font-mono)',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', color: hasData ? '#334155' : '#94a3b8', display: 'block' }}>
                            {row.registrationNo || '—'}
                          </span>
                        )}
                      </td>

                      {/* 4. Student Name (Generous 280px) */}
                      <td className="td-col-name" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Full Student Name"
                            value={editFormData.studentName || ''}
                            onChange={(e) => handleInputChange('studentName', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span 
                            style={{ 
                              fontWeight: hasData ? 700 : 400, 
                              color: hasData ? '#0f172a' : '#94a3b8',
                              display: 'block',
                              wordBreak: 'break-word',
                              lineHeight: 1.45
                            }}
                            title={row.studentName}
                          >
                            {row.studentName || '—'}
                          </span>
                        )}
                      </td>

                      {/* 5. Contact No. */}
                      <td className="td-col-contact" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="017xxxxxxxx"
                            value={editFormData.contactNo || ''}
                            onChange={(e) => handleInputChange('contactNo', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span style={{ color: hasData ? '#334155' : '#94a3b8', display: 'block' }}>
                            {row.contactNo || '—'}
                          </span>
                        )}
                      </td>

                      {/* 6. Father Name (Generous 260px) */}
                      <td className="td-col-father" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Father's Full Name"
                            value={editFormData.fatherName || ''}
                            onChange={(e) => handleInputChange('fatherName', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span 
                            style={{ 
                              color: hasData ? '#334155' : '#94a3b8',
                              display: 'block',
                              wordBreak: 'break-word',
                              lineHeight: 1.45
                            }}
                            title={row.fatherName}
                          >
                            {row.fatherName || '—'}
                          </span>
                        )}
                      </td>

                      {/* 7. Father Contact */}
                      <td className="td-col-father-contact" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Father Phone"
                            value={editFormData.fatherContact || ''}
                            onChange={(e) => handleInputChange('fatherContact', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span style={{ color: hasData ? '#334155' : '#94a3b8', display: 'block' }}>
                            {row.fatherContact || '—'}
                          </span>
                        )}
                      </td>

                      {/* 8. Mother Name (Generous 260px) */}
                      <td className="td-col-mother" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Mother's Full Name"
                            value={editFormData.motherName || ''}
                            onChange={(e) => handleInputChange('motherName', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span 
                            style={{ 
                              color: hasData ? '#334155' : '#94a3b8',
                              display: 'block',
                              wordBreak: 'break-word',
                              lineHeight: 1.45
                            }}
                            title={row.motherName}
                          >
                            {row.motherName || '—'}
                          </span>
                        )}
                      </td>

                      {/* 9. Address (Significantly wider 380px) */}
                      <td className="td-col-address" style={{ padding: '0.6rem 0.85rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Present / Permanent Address"
                            value={editFormData.address || ''}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="form-input"
                            style={{
                              width: '100%',
                              minWidth: '100%',
                              boxSizing: 'border-box',
                              fontSize: '0.84rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '6px',
                              border: '1.5px solid #2563eb'
                            }}
                          />
                        ) : (
                          <span 
                            style={{ 
                              color: hasData ? '#334155' : '#94a3b8', 
                              fontSize: '0.82rem',
                              display: 'block',
                              wordBreak: 'break-word',
                              lineHeight: 1.45
                            }}
                            title={row.address}
                          >
                            {row.address || '—'}
                          </span>
                        )}
                      </td>

                      {/* 10. Actions (Edit / Save / Cancel / Clear) */}
                      <td className="td-col-actions no-print" style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => handleSaveRow(row.sl)}
                              disabled={isSaving}
                              style={{
                                background: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                              }}
                              title="Save to Database"
                            >
                              {isSaving ? <RefreshCw size={12} className="spin" /> : <Save size={12} />} Save
                            </button>

                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.78rem',
                                cursor: 'pointer'
                              }}
                              title="Cancel Edits"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditRow(row)}
                              style={{
                                background: hasData ? '#eff6ff' : '#f8fafc',
                                color: hasData ? '#2563eb' : '#64748b',
                                border: hasData ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '0.35rem 0.7rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                              title={hasData ? 'Edit Student Information' : 'Enter Student Information'}
                            >
                              <Edit2 size={12} /> {hasData ? 'Edit' : 'Add'}
                            </button>

                            {hasData && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmTarget(row)}
                                style={{
                                  background: '#fff1f2',
                                  color: '#e11d48',
                                  border: '1px solid #fecdd3',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer'
                                }}
                                title="Clear Student Record"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Printable Official Signatures (Visible only when Printing) */}
        <div className="print-only print-sheet-signatures">
          <table className="sig-table">
            <tbody>
              <tr>
                <td style={{ width: '33%', verticalAlign: 'bottom', textAlign: 'center' }}>
                  <div className="sig-line">
                    <strong>Prepared By</strong><br />
                    Academic Office Assistant
                  </div>
                </td>
                <td style={{ width: '33%', verticalAlign: 'bottom', textAlign: 'center' }}>
                  <div className="sig-line">
                    <strong>Verified By</strong><br />
                    Session / Batch Coordinator
                  </div>
                </td>
                <td style={{ width: '33%', verticalAlign: 'bottom', textAlign: 'center' }}>
                  <div className="sig-line">
                    <strong>Approved By</strong><br />
                    Chairman, Department of CSE
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW ACADEMIC SESSION */}
      {/* ========================================================================= */}
      {isCreateSessionModalOpen && (
        <div 
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div 
            className="modal-card" 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              animation: 'scaleUp 0.2s ease'
            }}
          >
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #09101d, #1e293b)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <PlusCircle size={20} style={{ color: '#10b981' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Create Academic Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSessionModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSession} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                Creating a session automatically initializes a <strong>40-Seat Student Cell</strong> and pre-populates all standard 8 undergraduate semesters.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>
                  Session Name / Batch <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2024-2025 or Session 2024-2025"
                  value={newSessionForm.sessionName}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, sessionName: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', borderRadius: '8px' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newSessionForm.startDate}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, startDate: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem', display: 'block' }}>
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newSessionForm.endDate}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, endDate: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.85rem', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="chk-current-session"
                  checked={newSessionForm.isCurrent}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, isCurrent: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="chk-current-session" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Set as Current Active Session for Department
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateSessionModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSession}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {creatingSession ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                  Create & Open Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE / CLEAR STUDENT CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteConfirmTarget && (
        <div 
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e11d48' }}>
              <Trash2 size={24} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Clear Student Slot?</h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to clear <strong>SL #{deleteConfirmTarget.sl} ({deleteConfirmTarget.studentRoll} - {deleteConfirmTarget.studentName})</strong> from this session?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="btn btn-secondary"
                style={{ padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  background: '#e11d48',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                {isDeleting ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default StudentInfoView;
