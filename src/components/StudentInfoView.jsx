import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit2, Plus, Printer, RefreshCw, Save, Search, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const blankRow = (sl) => ({ sl, studentId: null, studentRoll: '', registrationNo: '', studentName: '', contactNo: '', fatherName: '', fatherContact: '', motherName: '', address: '' });
const fields = ['studentRoll', 'registrationNo', 'studentName', 'contactNo', 'fatherName', 'fatherContact', 'motherName', 'address'];

export function StudentInfoView({ onBackToDashboard }) {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState([]);
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionForm, setSessionForm] = useState({ sessionName: '', startDate: '', endDate: '' });
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [notice, setNotice] = useState(null);

  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  };
  const message = (type, text) => { setNotice({ type, text }); setTimeout(() => setNotice(null), 4000); };
  const makeRows = (students, minimum = 40) => {
    const size = Math.max(minimum, students.length);
    const bySerial = new Map(students.map((student, index) => [Number(student.serial_no) || index + 1, student]));
    return Array.from({ length: size }, (_, index) => {
      const student = bySerial.get(index + 1);
      return student ? { sl: index + 1, studentId: student.student_id, studentRoll: student.student_roll || '', registrationNo: student.registration_no || '', studentName: student.student_name || '', contactNo: student.contact_no || '', fatherName: student.father_name || '', fatherContact: student.father_contact || '', motherName: student.mother_name || '', address: student.address || '' } : blankRow(index + 1);
    });
  };
  const loadSessions = async (selectId) => {
    try {
      const data = await request('/api/academic/sessions?studentInfoOnly=1');
      setSessions(data.sessions || []);
      if (selectId) setSelectedId(selectId);
    } catch (error) { message('error', error.message); }
  };
  const loadSheet = async (id) => {
    if (!id) { setRows([]); setSession(null); return; }
    try {
      const data = await request(`/api/academic/sessions/${id}/student-sheet`);
      setSession(data.session); setRows(makeRows(data.students || [])); setEditing(false);
    } catch (error) { message('error', error.message); }
  };
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { loadSheet(selectedId); }, [selectedId]);
  const enrolled = rows.filter(row => row.studentRoll.trim()).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? rows : rows.filter(row => [row.studentRoll, row.registrationNo, row.studentName, row.contactNo, row.fatherName, row.fatherContact, row.motherName, row.address].some(value => value.toLowerCase().includes(q)));
  }, [rows, query]);
  const updateCell = (sl, field, value) => setRows(current => current.map(row => row.sl === sl ? { ...row, [field]: value } : row));
  const addRows = () => setRows(current => [...current, ...Array.from({ length: 5 }, (_, index) => blankRow(current.length + index + 1))]);
  const createSession = async (event) => {
    event.preventDefault();
    if (!sessionForm.sessionName.trim() || !sessionForm.startDate) return message('error', 'Session name and start date are required.');
    try {
      const data = await request('/api/academic/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sessionForm, studentInfoEnabled: true }) });
      setShowSessionForm(false); setSessionForm({ sessionName: '', startDate: '', endDate: '' }); await loadSessions(data.sessionId); message('success', 'New session created. Its 40-row student grid is ready.');
    } catch (error) { message('error', error.message); }
  };
  const saveAll = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const payloadRows = rows.filter(row => row.studentRoll.trim()).map(row => ({ studentId: row.studentId, serialNo: row.sl, ...Object.fromEntries(fields.map(field => [field, row[field]])) }));
      if (payloadRows.length) await request(`/api/academic/sessions/${selectedId}/student-sheet/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: payloadRows }) });
      await loadSheet(selectedId); message('success', 'All student information was saved to the central database.');
    } catch (error) { message('error', error.message); } finally { setSaving(false); }
  };
  const deleteStudent = async (row) => {
    if (!row.studentId || !window.confirm(`Delete ${row.studentName || row.studentRoll} from this session?`)) return;
    try { await request(`/api/academic/sessions/${selectedId}/student-sheet/${row.studentId}`, { method: 'DELETE' }); await loadSheet(selectedId); message('success', 'Student removed from this session.'); } catch (error) { message('error', error.message); }
  };
  const printRows = rows.filter(row => row.studentRoll.trim());
  return <div className="student-info-page" style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>
    <style>{`@media print { @page { size: A4 landscape; margin: 9mm; } body * { visibility:hidden; } .student-print, .student-print * { visibility:visible; } .student-print { position:absolute; left:0; top:0; width:100%; color:#000; } .student-print table { width:100%; border-collapse:collapse; font-size:8.5pt; } .student-print th,.student-print td { border:1px solid #333; padding:4px; vertical-align:top; } .student-print th { background:#eee; } .no-print { display:none !important; } } @media screen { .student-print { display:none; } }`}</style>
    <div className="no-print" style={{ padding: '1.4rem 1.6rem', borderRadius: 16, color: '#fff', background: 'linear-gradient(135deg,#09101d,#064e3b)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div><h1 style={{ margin: 0, fontSize: '1.55rem' }}>Session-wise Student Information</h1><p style={{ margin: '.4rem 0 0', color: '#cbd5e1' }}>Central session roster. Create a session, then manage its full student grid in one place.</p></div>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>{onBackToDashboard && <button className="btn btn-secondary" onClick={onBackToDashboard}><ArrowLeft size={16} /> Dashboard</button>}<button className="btn btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print A4</button><button className="btn btn-primary" onClick={() => setShowSessionForm(true)}><Plus size={16} /> New Session</button></div>
    </div>
    {notice && <div className="no-print" style={{ padding: '.75rem 1rem', borderRadius: 8, background: notice.type === 'error' ? '#fef2f2' : '#ecfdf5', color: notice.type === 'error' ? '#b91c1c' : '#047857' }}>{notice.text}</div>}
    {showSessionForm && <form className="card no-print" onSubmit={createSession}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 className="card-title"><Plus size={18} /> Create New Session</h3><button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSessionForm(false)}><X size={15} /></button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.8rem' }}><label className="form-group"><span className="form-label">Session Name</span><input required className="form-input" value={sessionForm.sessionName} onChange={e => setSessionForm({ ...sessionForm, sessionName: e.target.value })} placeholder="e.g. Session 2026-2027" /></label><label className="form-group"><span className="form-label">Start Date</span><input required type="date" className="form-input" value={sessionForm.startDate} onChange={e => setSessionForm({ ...sessionForm, startDate: e.target.value })} /></label><label className="form-group"><span className="form-label">End Date (optional)</span><input type="date" className="form-input" value={sessionForm.endDate} onChange={e => setSessionForm({ ...sessionForm, endDate: e.target.value })} /></label></div><div style={{ textAlign: 'right' }}><button className="btn btn-primary"><Save size={16} /> Create Session</button></div></form>}
    <div className="no-print card" style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}><strong>Sessions:</strong>{sessions.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No session created yet.</span>}{sessions.map(item => <button key={item.id} className={`btn btn-sm ${selectedId === item.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelectedId(item.id)}>{item.session_name}</button>)}</div>
    {selectedId && <section className="card no-print" style={{ display: 'grid', gap: '1rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0 }}>{session?.session_name || 'Student Grid'}</h2><span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{enrolled} student{enrolled === 1 ? '' : 's'} in this session · {rows.length} grid rows</span></div><div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><button className="btn btn-secondary btn-sm" onClick={() => loadSheet(selectedId)}><RefreshCw size={14} /> Refresh</button><button className="btn btn-secondary btn-sm" onClick={addRows}><Plus size={14} /> Add 5 rows</button>{editing ? <><button className="btn btn-primary btn-sm" disabled={saving} onClick={saveAll}><Save size={14} /> {saving ? 'Saving…' : 'Save All'}</button><button className="btn btn-secondary btn-sm" onClick={() => loadSheet(selectedId)}>Cancel</button></> : <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}><Edit2 size={14} /> Edit Session Grid</button>}</div></div><div style={{ position: 'relative', maxWidth: 360 }}><Search size={15} style={{ position: 'absolute', top: 10, left: 10, color: '#64748b' }} /><input className="form-input" style={{ paddingLeft: 32 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this session's students..." /></div><div style={{ overflowX: 'auto' }}><table className="data-table" style={{ minWidth: 1370 }}><thead><tr>{['SL','Roll','Registration','Name','Contact','Father name','Father cont.','Mother name','Address',''].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row.sl}><td>{row.sl}</td>{fields.map(field => <td key={field}>{editing ? <input className="form-input" value={row[field]} onChange={e => updateCell(row.sl, field, e.target.value)} /> : <span>{row[field] || '—'}</span>}</td>)}<td>{row.studentId && <button className="btn btn-danger btn-sm" onClick={() => deleteStudent(row)} title="Delete student"><Trash2 size={14} /></button>}</td></tr>)}</tbody></table></div></section>}
    {!selectedId && <div className="card no-print" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><Users size={34} style={{ marginBottom: '.6rem' }} /><div>Create a new session or select an existing one to open its student grid.</div></div>}
    <div className="student-print"><h2 style={{ textAlign: 'center', margin: '0 0 6px' }}>Department of CSE — Student Information Sheet</h2><div style={{ textAlign: 'center', marginBottom: 8 }}>{session?.session_name || ''}</div><table><thead><tr><th>SL</th><th>Roll</th><th>Registration</th><th>Student, Parents, Contacts & Address</th></tr></thead><tbody>{printRows.map(row => <tr key={row.sl}><td>{row.sl}</td><td>{row.studentRoll}</td><td>{row.registrationNo}</td><td><strong>{row.studentName}</strong><br />Student: {row.contactNo || '—'}<br />Father: {row.fatherName || '—'} ({row.fatherContact || '—'})<br />Mother: {row.motherName || '—'}<br />Address: {row.address || '—'}</td></tr>)}</tbody></table></div>
  </div>;
}
