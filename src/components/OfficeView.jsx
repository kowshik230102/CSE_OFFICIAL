import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeBoard } from './NoticeBoard';
import { 
  Calendar, 
  BookOpen, 
  UserCheck, 
  Bell, 
  MessageSquareWarning, 
  PlusCircle, 
  Check, 
  AlertCircle, 
  Layers, 
  CheckCircle2, 
  XCircle,
  Clock,
  Pin
} from 'lucide-react';

export const OfficeView = ({ initialTab = 'sessions' }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [message, setMessage] = useState(null);

  // Data states
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [grievanceQueue, setGrievanceQueue] = useState([]);

  // Forms
  const [newSession, setNewSession] = useState({ sessionName: '', startDate: '', isCurrent: false });
  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    courseTitle: '',
    creditHours: '3.0',
    courseType: 'THEORY',
    syllabusOutline: '',
    assignedTeacherId: '',
  });
  const [newStudent, setNewStudent] = useState({
    studentRoll: '',
    registrationNo: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
  });
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    targetType: 'DEPARTMENT_WIDE',
    targetSessionId: '',
    targetSemesterId: '',
    isPinned: false,
  });

  // Moderator modal
  const [moderatingItem, setModeratingItem] = useState(null);
  const [moderatorRemarks, setModeratorRemarks] = useState('');

  // 1. Fetch Sessions & Teachers on mount
  useEffect(() => {
    fetchSessions();
    fetchTeachers();
    fetchGrievanceQueue();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/academic/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
      if (data.sessions && data.sessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data.sessions[0].id);
      }
    } catch (e) { console.error(e); }
  };

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/auth/teachers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTeachers(data.teachers || []);
    } catch (e) { console.error(e); }
  };

  const fetchGrievanceQueue = async () => {
    try {
      const res = await fetch('/api/grievances/queue', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGrievanceQueue(data.queue || []);
    } catch (e) { console.error(e); }
  };

  // 2. Fetch Semesters when Session Changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchSemesters(selectedSessionId);
      fetchStudents(selectedSessionId);
    }
  }, [selectedSessionId]);

  const fetchSemesters = async (sessId) => {
    try {
      const res = await fetch(`/api/academic/sessions/${sessId}/semesters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSemesters(data.semesters || []);
      if (data.semesters && data.semesters.length > 0) {
        setSelectedSemesterId(data.semesters[0].id);
      } else {
        setSelectedSemesterId('');
      }
    } catch (e) { console.error(e); }
  };

  const fetchStudents = async (sessId) => {
    try {
      const res = await fetch(`/api/academic/sessions/${sessId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStudents(data.students || []);
    } catch (e) { console.error(e); }
  };

  // 3. Fetch Courses when Semester Changes
  useEffect(() => {
    if (selectedSemesterId) {
      fetchCourses(selectedSemesterId);
    } else {
      setCourses([]);
    }
  }, [selectedSemesterId]);

  const fetchCourses = async (semId) => {
    try {
      const res = await fetch(`/api/academic/semesters/${semId}/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (e) { console.error(e); }
  };

  // --- Handlers ---
  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/academic/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSession),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setNewSession({ sessionName: '', startDate: '', isCurrent: false });
      fetchSessions();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Error creating session: ' + err.message);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!selectedSemesterId) return alert('Please select a semester first.');
    try {
      const res = await fetch(`/api/academic/semesters/${selectedSemesterId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCourse),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setNewCourse({
        courseCode: '',
        courseTitle: '',
        creditHours: '3.0',
        courseType: 'THEORY',
        syllabusOutline: '',
        assignedTeacherId: '',
      });
      fetchCourses(selectedSemesterId);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Error creating course: ' + err.message);
    }
  };

  const handleAssignTeacher = async (courseId, teacherId) => {
    try {
      const res = await fetch(`/api/academic/courses/${courseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Faculty assignment updated successfully!' });
      fetchCourses(selectedSemesterId);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Error assigning teacher: ' + err.message);
    }
  };

  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) return alert('Select session first.');
    try {
      const res = await fetch(`/api/academic/sessions/${selectedSessionId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newStudent),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setNewStudent({
        studentRoll: '',
        registrationNo: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phoneNumber: '',
      });
      fetchStudents(selectedSessionId);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Error enrolling student: ' + err.message);
    }
  };

  const handlePublishNotice = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newNotice),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Notice published successfully!' });
      setNewNotice({
        title: '',
        content: '',
        targetType: 'DEPARTMENT_WIDE',
        targetSessionId: '',
        targetSemesterId: '',
        isPinned: false,
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Error posting notice: ' + err.message);
    }
  };

  const handleModerateGrievance = async (action) => {
    if (!moderatingItem) return;
    try {
      const res = await fetch(`/api/grievances/${moderatingItem.id}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, remarks: moderatorRemarks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setModeratingItem(null);
      setModeratorRemarks('');
      fetchGrievanceQueue();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Moderation failed: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Office Operations Hero Banner */}
      <div className="role-hero-banner hero-office">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <span className="live-beacon" style={{ marginRight: '4px' }}></span> Academic Operations Hub
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
              Staff Operator: <strong>{user.firstName} {user.lastName}</strong> ({user.email})
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            Academic Administration & Scheduling Suite
          </h2>
          <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '0.3rem', maxWidth: '650px' }}>
            Hierarchical session provisioning, course-faculty allocations, verified student enrollment roster, and moderation queue.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">{sessions.length}</div>
            <div className="hero-stat-lbl">Sessions</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">{courses.length}</div>
            <div className="hero-stat-lbl">Active Courses</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val">{students.length}</div>
            <div className="hero-stat-lbl">Enrolled Students</div>
          </div>
          <div className="hero-stat-widget">
            <div className="hero-stat-val" style={{ color: grievanceQueue.filter(g => g.status === 'PENDING_MODERATION').length > 0 ? '#fde047' : '#ffffff' }}>
              {grievanceQueue.filter(g => g.status === 'PENDING_MODERATION').length}
            </div>
            <div className="hero-stat-lbl">Pending Queue</div>
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: message.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={16} /> {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="segmented-nav-wrapper">
        {[
          { id: 'sessions', label: '1. Sessions & Semesters', icon: Calendar },
          { id: 'courses', label: '2. Courses & Teacher Assignment', icon: BookOpen },
          { id: 'students', label: '3. Student Roster', icon: UserCheck },
          { id: 'notices', label: '4. Post Notices', icon: Bell },
          { id: 'grievances', label: `5. Grievances Queue (${grievanceQueue.filter(g => g.status === 'PENDING_MODERATION').length})`, icon: MessageSquareWarning },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`segmented-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            >
              <Icon size={16} style={{ color: activeTab === t.id ? '#2563eb' : '#64748b' }} /> 
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ACADEMIC SESSIONS & SEMESTERS */}
      {/* ========================================================= */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Create Session Form */}
          <div className="card">
            <h3 className="card-title"><PlusCircle size={18} /> Create Academic Session</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Creating a session automatically generates standard semesters (Y1S1 to Y4S2).
            </p>

            <form onSubmit={handleCreateSession}>
              <div className="form-group">
                <label className="form-label">Session Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Session 2024-2025"
                  value={newSession.sessionName}
                  onChange={(e) => setNewSession({ ...newSession, sessionName: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  required
                  value={newSession.startDate}
                  onChange={(e) => setNewSession({ ...newSession, startDate: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={newSession.isCurrent}
                  onChange={(e) => setNewSession({ ...newSession, isCurrent: e.target.checked })}
                />
                <label htmlFor="isCurrent" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                  Set as Current Active Session
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Create Academic Session
              </button>
            </form>
          </div>

          {/* Sessions List */}
          <div className="card">
            <h3 className="card-title"><Calendar size={18} /> Department Academic Sessions</h3>
            <div className="table-container" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session Name</th>
                    <th>Start Date</th>
                    <th>Students</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} style={{ background: selectedSessionId === s.id ? '#eff6ff' : 'transparent' }}>
                      <td style={{ fontWeight: 700 }}>{s.session_name}</td>
                      <td>{s.start_date}</td>
                      <td>{s.student_count} enrolled</td>
                      <td>
                        {s.is_current ? (
                          <span className="badge badge-active">Current Session</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Archived / Upcoming</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedSessionId(s.id)}
                          className={`btn btn-sm ${selectedSessionId === s.id ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Select Session
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Session Semesters Explorer */}
            {selectedSessionId && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                  Semesters inside selected session:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {semesters.map((sem) => (
                    <div
                      key={sem.id}
                      onClick={() => setSelectedSemesterId(sem.id)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '10px',
                        border: selectedSemesterId === sem.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: selectedSemesterId === sem.id ? 'var(--primary-light)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{sem.term_code}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{sem.semester_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {sem.course_count} courses provided
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: COURSES & FACULTY ASSIGNMENTS */}
      {/* ========================================================= */}
      {activeTab === 'courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Add Course Form */}
          <div className="card">
            <h3 className="card-title"><BookOpen size={18} /> Pre-populate New Course</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Add official course under the selected semester and assign designated faculty.
            </p>

            <div className="form-group">
              <label className="form-label">Active Session</label>
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

            <form onSubmit={handleCreateCourse}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Course Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE-3101"
                    value={newCourse.courseCode}
                    onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="3.0"
                    value={newCourse.creditHours}
                    onChange={(e) => setNewCourse({ ...newCourse, creditHours: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Database Management Systems"
                  value={newCourse.courseTitle}
                  onChange={(e) => setNewCourse({ ...newCourse, courseTitle: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Course Type</label>
                <select
                  className="form-select"
                  value={newCourse.courseType}
                  onChange={(e) => setNewCourse({ ...newCourse, courseType: e.target.value })}
                >
                  <option value="THEORY">THEORY (Lectures & Class Tests)</option>
                  <option value="LAB">LAB / SESSIONAL (Hands-on & Lab Exams)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Designated Course Faculty (Assigned by Office)</label>
                <select
                  className="form-select"
                  value={newCourse.assignedTeacherId}
                  onChange={(e) => setNewCourse({ ...newCourse, assignedTeacherId: e.target.value })}
                >
                  <option value="">-- Select Teacher to Assign --</option>
                  {teachers.map((t) => (
                    <option key={t.teacher_id} value={t.teacher_id}>
                      {t.first_name} {t.last_name} ({t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Syllabus Outline (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Course modules, textbook references, topics..."
                  value={newCourse.syllabusOutline}
                  onChange={(e) => setNewCourse({ ...newCourse, syllabusOutline: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Add Course to Semester
              </button>
            </form>
          </div>

          {/* Courses Table & Quick Teacher Assignment */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                Courses in: {semesters.find(s => s.id === selectedSemesterId)?.semester_name || 'Select Semester'}
              </h3>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code & Title</th>
                    <th>Type</th>
                    <th>Credits</th>
                    <th>Assigned Faculty (Teacher)</th>
                    <th>Materials</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No courses added for this semester yet. Use the form on the left to add one!
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.course_code}</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.course_title}</div>
                        </td>
                        <td>
                          <span className={`badge ${c.course_type === 'LAB' ? 'badge-lab' : 'badge-theory'}`}>
                            {c.course_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.credit_hours}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <select
                              value={c.assigned_teacher_id || ''}
                              onChange={(e) => handleAssignTeacher(c.id, e.target.value)}
                              className="form-select"
                              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                            >
                              <option value="">-- No Teacher Assigned --</option>
                              {teachers.map((t) => (
                                <option key={t.teacher_id} value={t.teacher_id}>
                                  {t.first_name} {t.last_name} ({t.designation})
                                </option>
                              ))}
                            </select>
                            {c.assigned_teacher_name && (
                              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                                ✓ Assigned: {c.assigned_teacher_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {c.material_count} notes
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: STUDENT ROSTER & ENROLLMENT */}
      {/* ========================================================= */}
      {activeTab === 'students' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Enroll Student Form */}
          <div className="card">
            <h3 className="card-title"><UserCheck size={18} /> Enroll Student in Session</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Enrolls student into the selected session and generates academic credentials.
            </p>

            <form onSubmit={handleEnrollStudent}>
              <div className="form-group">
                <label className="form-label">Academic Session</label>
                <select
                  className="form-select"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.session_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Student Roll</label>
                  <input
                    type="text"
                    required
                    placeholder="CSE-20230105"
                    value={newStudent.studentRoll}
                    onChange={(e) => setNewStudent({ ...newStudent, studentRoll: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Registration No</label>
                  <input
                    type="text"
                    required
                    placeholder="REG-88205"
                    value={newStudent.registrationNo}
                    onChange={(e) => setNewStudent({ ...newStudent, registrationNo: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arafat"
                    value={newStudent.firstName}
                    onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hossain"
                    value={newStudent.lastName}
                    onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="arafat@cse.univ.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  className="form-input"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Enroll Student
              </button>
            </form>
          </div>

          {/* Student Roster Table */}
          <div className="card">
            <h3 className="card-title">
              Enrolled Students: {sessions.find(s => s.id === selectedSessionId)?.session_name} ({students.length})
            </h3>
            <div className="table-container" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Registration No</th>
                    <th>Email</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.student_id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{st.student_roll}</td>
                      <td style={{ fontWeight: 600 }}>{st.first_name} {st.last_name}</td>
                      <td>{st.registration_no}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{st.email}</td>
                      <td>
                        <span className="badge badge-active">{st.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: NOTICE BOARD & PUBLISHER */}
      {/* ========================================================= */}
      {activeTab === 'notices' && (
        <NoticeBoard user={user} token={token} />
      )}

      {/* ========================================================= */}
      {/* TAB 5: STUDENT GRIEVANCE & FEEDBACK MODERATION QUEUE */}
      {/* ========================================================= */}
      {activeTab === 'grievances' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <MessageSquareWarning size={18} /> Student Grievance & Feedback Moderation Queue
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Review, filter, and approve student feedback before making it visible on the public student community feed.
              </p>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Subject & Details</th>
                  <th>Submitted By</th>
                  <th>Session</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Moderation</th>
                </tr>
              </thead>
              <tbody>
                {grievanceQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No submissions in moderation queue.
                    </td>
                  </tr>
                ) : (
                  grievanceQueue.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <span className="badge badge-secondary">{g.category}</span>
                      </td>
                      <td style={{ maxWidth: '350px' }}>
                        <div style={{ fontWeight: 700 }}>{g.subject}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
                          {g.description}
                        </div>
                        {g.moderation_remarks && (
                          <div style={{ fontSize: '0.75rem', color: '#0369a1', background: '#f0f9ff', padding: '0.4rem', borderRadius: '6px', marginTop: '0.4rem' }}>
                            <strong>Official Response:</strong> {g.moderation_remarks}
                          </div>
                        )}
                      </td>
                      <td>
                        {g.is_anonymous ? (
                          <span style={{ fontStyle: 'italic', color: '#64748b', fontSize: '0.8rem' }}>
                            Anonymous Student
                          </span>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.student_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Roll: {g.student_roll}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{g.session_name}</td>
                      <td>
                        <span className={`badge ${
                          g.status === 'APPROVED' ? 'badge-active' :
                          g.status === 'PENDING_MODERATION' ? 'badge-suspended' : 'badge-danger'
                        }`}>
                          {g.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {g.status === 'PENDING_MODERATION' ? (
                          <button
                            onClick={() => {
                              setModeratingItem(g);
                              setModeratorRemarks('');
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            Review & Decide
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Moderated
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Moderation Action Modal */}
      {moderatingItem && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="card-title">Moderate Student Grievance</h3>
              <button onClick={() => setModeratingItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <XCircle size={20} style={{ color: '#64748b' }} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  {moderatingItem.category} • {moderatingItem.is_anonymous ? 'Anonymous' : moderatingItem.student_roll}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, margin: '0.25rem 0' }}>{moderatingItem.subject}</div>
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>{moderatingItem.description}</div>
              </div>

              <div className="form-group">
                <label className="form-label">Official Department Resolution / Moderator Remarks</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Approved. Maintenance scheduled for Monday / Escalated to Lab In-Charge..."
                  value={moderatorRemarks}
                  onChange={(e) => setModeratorRemarks(e.target.value)}
                  className="form-textarea"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => handleModerateGrievance('REJECTED')}
                className="btn btn-danger"
              >
                Reject & Archive
              </button>
              <button
                type="button"
                onClick={() => handleModerateGrievance('APPROVED')}
                className="btn btn-success"
              >
                Approve & Publish to Community Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
