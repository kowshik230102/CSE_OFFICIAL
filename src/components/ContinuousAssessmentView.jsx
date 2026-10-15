import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, BookOpen, Calendar, CheckCircle2, Edit3, FileSpreadsheet, GraduationCap, Lock, RefreshCw, Save, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const statusColor = { RUNNING: '#2563eb', UPCOMING: '#7c3aed', PASSED: '#64748b', RECENT: '#64748b' };
const statusLabel = status => ({ RUNNING: 'Running', UPCOMING: 'Upcoming', PASSED: 'Passed', RECENT: 'Passed' }[status] || status);

const gradeColor = grade => grade === 'F' ? '#f87171' : grade === '—' ? '#94a3b8' : '#34d399';

export function ContinuousAssessmentView({ user: propUser, onBackToDashboard, autoTarget, onAutoTargetHandled }) {
  const { user: authUser, token } = useAuth();
  const user = authUser || propUser;
  const [view, setView] = useState('sessions');
  const [groups, setGroups] = useState({ running: [], recent: [] });
  const [selectedSession, setSelectedSession] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');

  const headers = () => {
    const saved = token || localStorage.getItem('token') || localStorage.getItem('cse_token');
    return saved ? { Authorization: `Bearer ${saved}` } : {};
  };
  const alert = (message, type = 'success') => { setNotice({ message, type }); window.setTimeout(() => setNotice(null), 4000); };
  const api = async (path, options = {}) => {
    const response = await fetch(`/api/regular-assessment${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load Regular Assessment.');
    return data;
  };

  const loadSessions = async () => {
    setLoading(true);
    try { setGroups(await api('/sessions')); } catch (error) { alert(error.message, 'error'); } finally { setLoading(false); }
  };
  useEffect(() => { loadSessions(); }, []);

  const openSession = async session => {
    setSelectedSession(session); setView('semesters'); setLoading(true);
    try { const data = await api(`/sessions/${session.id}/semesters`); setSemesters(data.semesters); }
    catch (error) { alert(error.message, 'error'); } finally { setLoading(false); }
  };
  const openSemester = async semester => {
    setSelectedSemester(semester); setView('courses'); setLoading(true);
    try { const data = await api(`/semesters/${semester.id}/courses`); setCourses(data.courses); }
    catch (error) { alert(error.message, 'error'); } finally { setLoading(false); }
  };
  const openCourse = async (course, semester = selectedSemester) => {
    if (!course.is_assigned) return;
    setSelectedCourse(course); setLoading(true);
    try { const data = await api(`/semesters/${semester.id}/courses/${course.id}/marks`); setSheet(data); setMatrix(data.matrix || []); setView('sheet'); }
    catch (error) { alert(error.message, 'error'); } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!autoTarget?.sessionId || !autoTarget?.semesterId || !autoTarget?.courseId) return;
    let cancelled = false;
    const openAssignedAssessment = async () => {
      setLoading(true);
      try {
        const semesterData = await api(`/sessions/${autoTarget.sessionId}/semesters`);
        const semester = (semesterData.semesters || []).find(item => item.id === autoTarget.semesterId);
        if (!semester) throw new Error('This running semester is no longer available in Regular Assessment.');
        const courseData = await api(`/semesters/${semester.id}/courses`);
        const course = (courseData.courses || []).find(item => item.id === autoTarget.courseId);
        if (!course?.is_assigned) throw new Error('This course does not have a routine teacher assignment yet.');
        const sheetData = await api(`/semesters/${semester.id}/courses/${course.id}/marks`);
        if (cancelled) return;
        setSelectedSession(semesterData.session || { id: autoTarget.sessionId, session_name: autoTarget.sessionName });
        setSelectedSemester(semester);
        setCourses(courseData.courses || []);
        setSelectedCourse(course);
        setSheet(sheetData);
        setMatrix(sheetData.matrix || []);
        setView('sheet');
      } catch (error) {
        if (!cancelled) alert(error.message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
        onAutoTargetHandled?.();
      }
    };
    openAssignedAssessment();
    return () => { cancelled = true; };
  }, [autoTarget]);
  const changeMark = (studentId, field, raw) => {
    if (!sheet?.canEdit) return;
    const limit = field === 'finalMarks' ? 70 : 10;
    if (raw !== '' && (Number(raw) < 0 || Number(raw) > limit)) return;
    setMatrix(rows => rows.map(row => row.studentId === studentId ? { ...row, [field]: raw === '' ? null : Number(raw) } : row));
  };
  const save = async () => {
    setSaving(true);
    try {
      await api(`/semesters/${selectedSemester.id}/courses/${selectedCourse.id}/marks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matrix }) });
      alert('Assessment marks saved.');
      await openCourse(selectedCourse);
    } catch (error) { alert(error.message, 'error'); } finally { setSaving(false); }
  };
  const computedMatrix = useMemo(() => withComputedValues(matrix), [matrix]);
  const filteredMatrix = useMemo(() => computedMatrix.filter(row => `${row.studentRoll} ${row.studentName}`.toLowerCase().includes(search.toLowerCase())), [computedMatrix, search]);
  const panel = { background: 'linear-gradient(145deg, rgba(30,41,59,.9), rgba(15,23,42,.96))', border: '1px solid rgba(255,255,255,.09)', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,.22)' };
  const badge = status => ({ display: 'inline-block', color: '#fff', background: statusColor[status] || '#475569', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800, letterSpacing: '.03em' });

  const PageTitle = ({ title, subtitle, back }) => <div style={{ ...panel, padding: '1.25rem 1.4rem', display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 20 }}>
    <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
      {back && <button onClick={back} style={backButton}><ArrowLeft size={18} /></button>}
      <div><h2 style={{ margin: 0, color: '#fff', fontSize: '1.35rem' }}>{title}</h2><p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '.84rem' }}>{subtitle}</p></div>
    </div>
    {loading && <RefreshCw size={20} className="spin" style={{ color: '#60a5fa' }} />}
  </div>;

  return <div style={{ maxWidth: 1480, margin: '0 auto', padding: '1.2rem', color: '#e2e8f0' }}>
    {notice && <div style={{ position: 'fixed', right: 22, top: 22, zIndex: 10000, padding: '12px 16px', borderRadius: 10, color: '#fff', background: notice.type === 'error' ? '#b91c1c' : '#047857', boxShadow: '0 10px 24px rgba(0,0,0,.35)' }}>{notice.message}</div>}

    {view === 'sessions' && <>
      <PageTitle title="Regular Assessment" subtitle="Calendar-based semester assessment, routine teacher assignment and live class reports." />
      <SessionSection title="Running Sessions" icon={<Calendar size={19} />} sessions={groups.running} empty="No running or upcoming calendar session is available." open={openSession} panel={panel} badge={badge} />
      <SessionSection title="Passed Sessions" icon={<ArchiveIcon />} sessions={groups.recent} empty="No passed calendar session is available." open={openSession} panel={panel} badge={badge} />
    </>}

    {view === 'semesters' && <>
      <PageTitle title={selectedSession?.session_name} subtitle="Select a completed or currently running semester to view its assessment courses." back={() => { setView('sessions'); setSelectedSession(null); }} />
      {loading ? <Loader /> : semesters.length === 0 ? <Empty text="No started semester is available for this session yet." /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>{semesters.map(semester => <button key={semester.id} onClick={() => openSemester(semester)} style={{ ...panel, color: '#e2e8f0', textAlign: 'left', padding: 20, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><GraduationCap color="#a78bfa" /><span style={badge(semester.calendar_status)}>{statusLabel(semester.calendar_status)}</span></div>
        <h3 style={{ margin: '16px 0 6px', color: '#fff', fontSize: '1.05rem' }}>{semester.semester_name}</h3>
        <div style={{ color: '#94a3b8', fontSize: '.8rem' }}>{semester.start_date} {semester.end_date ? `— ${semester.end_date}` : '— end date pending'}</div>
        <div style={{ marginTop: 15, color: '#60a5fa', fontWeight: 800, fontSize: '.8rem' }}>Open assessment courses →</div>
      </button>)}</div>}
    </>}

    {view === 'courses' && <>
      <PageTitle title={`${selectedSession?.session_name} · ${selectedSemester?.semester_name}`} subtitle="Course teacher assignment is synced directly from Create Routine." back={() => { setView('semesters'); setSelectedSemester(null); }} />
      {loading ? <Loader /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>{courses.map(course => <div key={course.id} style={{ ...panel, padding: 19, opacity: course.is_assigned ? 1 : .7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong style={{ color: '#60a5fa' }}>{course.course_code}</strong><span style={{ fontSize: 11, color: '#c4b5fd' }}>{course.course_type} · {course.credit_hours} Cr</span></div>
        <h3 style={{ color: '#fff', minHeight: 43, fontSize: '.98rem', margin: '10px 0' }}>{course.course_title}</h3>
        <div style={{ minHeight: 38, color: course.is_assigned ? '#86efac' : '#fbbf24', fontSize: '.8rem' }}>{course.is_assigned ? `Assigned: ${course.assigned_teacher_name}` : 'No teacher assigned in routine'}</div>
        <button disabled={!course.is_assigned} onClick={() => openCourse(course)} style={{ ...mainButton, marginTop: 14, width: '100%', opacity: course.is_assigned ? 1 : .48, cursor: course.is_assigned ? 'pointer' : 'not-allowed' }}>{course.is_assigned ? <><FileSpreadsheet size={16} /> Open report</> : <><Lock size={15} /> Assignment required</>}</button>
      </div>)}</div>}
    </>}

    {view === 'sheet' && sheet && <>
      <PageTitle title={`${selectedCourse?.course_code} · Assessment Report`} subtitle={`${selectedCourse?.course_title} · ${selectedSession?.session_name} · ${selectedSemester?.semester_name}`} back={() => { setView('courses'); setSheet(null); }} />
      <div style={{ ...panel, padding: '1rem 1.2rem', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><strong style={{ color: '#fff' }}>{sheet.course.assigned_teacher_name}</strong><span style={{ color: '#94a3b8', fontSize: '.8rem' }}> · Routine-assigned teacher</span><div style={{ color: sheet.canEdit ? '#86efac' : '#fbbf24', fontSize: '.78rem', marginTop: 4 }}>{sheet.canEdit ? 'You can edit marks for this assigned course.' : 'View only — marks can be edited by the assigned teacher or an administrator.'}</div></div>
        <div style={{ display: 'flex', gap: 10 }}><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roll or student..." style={searchStyle} />{sheet.canEdit && <button onClick={save} disabled={saving} style={mainButton}><Save size={16} /> {saving ? 'Saving...' : 'Save marks'}</button>}</div>
      </div>
      <div style={{ ...panel, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1150, fontSize: '.82rem' }}><thead><tr>{['SL','Roll','Student','CT-1 /10','CT-2 /10','CT-3 /10','Att. /10','CA /30', `${/lab|sessional/i.test(selectedCourse?.course_type || '') ? 'Lab' : 'Theory'} Final /70`,'Total /100','Grade','Position'].map(label => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{filteredMatrix.map((row, i) => <tr key={row.studentId} style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}><td style={td}>{i + 1}</td><td style={td}>{row.studentRoll}</td><td style={{ ...td, color: '#fff', fontWeight: 650 }}>{row.studentName}</td>{['ct1','ct2','ct3','attendance'].map(field => <td key={field} style={td}><MarkInput value={row[field]} max={10} editable={sheet.canEdit} onChange={value => changeMark(row.studentId, field, value)} /></td>)}<td style={{ ...td, color: '#a5b4fc', fontWeight: 800 }}>{row.caMarks ?? '—'}</td><td style={td}><MarkInput value={row.finalMarks} max={70} editable={sheet.canEdit} onChange={value => changeMark(row.studentId, 'finalMarks', value)} /></td><td style={{ ...td, color: '#fff', fontWeight: 800 }}>{row.total ?? '—'}</td><td style={{ ...td, color: gradeColor(row.grade), fontWeight: 900 }}>{row.grade}</td><td style={td}>{row.position ? `${row.position}${ordinal(row.position)}` : '—'}</td></tr>)}</tbody></table>{filteredMatrix.length === 0 && <Empty text="No student found for this session." />}</div>
      <p style={{ color: '#94a3b8', fontSize: '.77rem', marginTop: 10 }}>CA is automatically calculated from the best two of three class tests (20) plus attendance (10). Final total, grade and position update from the saved report.</p>
    </>}
  </div>;
}

function SessionSection({ title, icon, sessions, empty, open, panel, badge }) { return <section style={{ marginBottom: 26 }}><h3 style={{ display: 'flex', gap: 9, alignItems: 'center', color: '#f8fafc', fontSize: '1.05rem' }}>{icon} {title} <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '.8rem' }}>({sessions.length})</span></h3>{sessions.length === 0 ? <Empty text={empty} /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 16 }}>{sessions.map(session => <button key={session.id} onClick={() => open(session)} style={{ ...panel, padding: 19, color: '#e2e8f0', textAlign: 'left', cursor: 'pointer' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><h4 style={{ margin: 0, color: '#fff', fontSize: '1.08rem' }}>{session.session_name}</h4><span style={badge(session.session_status)}>{statusLabel(session.session_status)}</span></div><div style={{ background: 'rgba(2,6,23,.42)', marginTop: 14, borderRadius: 10, padding: 11 }}><span style={{ color: '#94a3b8', fontSize: '.69rem', textTransform: 'uppercase' }}>Current semester</span><div style={{ color: '#e0e7ff', fontWeight: 800, marginTop: 3 }}>{session.current_semester?.semester_name || 'No semester'}</div></div><div style={{ display: 'flex', gap: 16, marginTop: 14, color: '#94a3b8', fontSize: '.79rem' }}><span><Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{session.student_count} students</span><span><BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{session.semester_count} semester(s)</span></div></button>)}</div>}</section>; }
function MarkInput({ value, max, editable, onChange }) { return <input type="number" min="0" max={max} step=".5" disabled={!editable} value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ width: 63, padding: '5px 4px', background: editable ? 'rgba(15,23,42,.65)' : 'transparent', border: '1px solid rgba(255,255,255,.13)', borderRadius: 6, textAlign: 'center', color: '#fff' }} />; }
function Loader() { return <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8' }}><RefreshCw className="spin" style={{ marginBottom: 10 }} /><div>Loading central academic data...</div></div>; }
function Empty({ text }) { return <div style={{ border: '1px dashed rgba(148,163,184,.38)', padding: '2rem', borderRadius: 14, color: '#94a3b8', textAlign: 'center' }}>{text}</div>; }
function ArchiveIcon() { return <CheckCircle2 size={19} />; }
function ordinal(number) { const v = number % 100; return ['th','st','nd','rd'][(v - 20) % 10] || ['th','st','nd','rd'][v] || 'th'; }
function withComputedValues(rows) {
  const updated = rows.map(row => {
    const tests = [row.ct1, row.ct2, row.ct3].filter(value => value !== null && value !== undefined && value !== '').map(Number).filter(Number.isFinite).sort((a, b) => b - a);
    const attendance = Number(row.attendance);
    const finalMarks = Number(row.finalMarks);
    const caMarks = tests.length >= 2 && Number.isFinite(attendance) ? Math.round((tests[0] + tests[1] + attendance) * 10) / 10 : null;
    const total = caMarks !== null && Number.isFinite(finalMarks) ? Math.round((caMarks + finalMarks) * 10) / 10 : null;
    return { ...row, caMarks, total, grade: total === null ? '—' : total >= 80 ? 'A+' : total >= 75 ? 'A' : total >= 70 ? 'A-' : total >= 65 ? 'B+' : total >= 60 ? 'B' : total >= 55 ? 'B-' : total >= 50 ? 'C+' : total >= 45 ? 'C' : total >= 40 ? 'D' : 'F', position: null };
  });
  let rank = 0;
  [...updated].filter(row => row.total !== null).sort((a, b) => b.total - a.total).forEach((row, index, ranked) => { if (index === 0 || row.total < ranked[index - 1].total) rank = index + 1; row.position = rank; });
  return updated;
}
const backButton = { width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', color: '#fff', background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', cursor: 'pointer' };
const mainButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 9, padding: '9px 13px', background: 'linear-gradient(135deg,#2563eb,#6366f1)', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const searchStyle = { border: '1px solid rgba(255,255,255,.13)', borderRadius: 8, padding: '9px 10px', color: '#fff', background: 'rgba(15,23,42,.75)', outline: 'none' };
const th = { background: '#0f172a', color: '#cbd5e1', padding: '12px 9px', textAlign: 'center', whiteSpace: 'nowrap' };
const td = { padding: '10px 8px', textAlign: 'center', color: '#cbd5e1', whiteSpace: 'nowrap' };
