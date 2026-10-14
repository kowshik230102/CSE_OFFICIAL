import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, Clock3, Pencil, Plus, RefreshCw, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const emptyForm = { sessionName: '', year: '', semester: '', startDate: '', endDate: '' };

const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const bySession = (semesters) => Object.entries(semesters.reduce((groups, semester) => {
  (groups[semester.session_name] ||= []).push(semester);
  return groups;
}, {}));

function CalendarCard({ semester, onEdit, recent = false }) {
  const metrics = [
    ['Total semester days', semester.total_semester_days],
    ['Total class days', semester.total_class_days],
    ['Completed class days', semester.completed_class_days],
    ['Remaining class days', semester.remaining_class_days],
    ['Remaining semester days', semester.remaining_semester_days]
  ];
  return (
    <article className="card" style={{ borderLeft: `4px solid ${recent ? '#94a3b8' : '#16a34a'}`, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{semester.session_name}</div>
          <h3 style={{ margin: '.25rem 0 0', fontSize: '1.1rem' }}>{semester.semester_name}</h3>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <span className={`badge ${recent ? 'badge-secondary' : 'badge-active'}`}>{recent ? 'Recent' : 'Running'}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(semester)} title="Edit semester calendar"><Pencil size={14} /> Edit</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.65rem', fontSize: '.82rem' }}>
        <div><div style={{ color: 'var(--text-muted)' }}>Semester period</div><strong>{formatDate(semester.start_date)} – {formatDate(semester.end_date)}</strong></div>
        <div><div style={{ color: 'var(--text-muted)' }}>Class period</div><strong>{formatDate(semester.class_start_date)} – {formatDate(semester.class_end_date)}</strong></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '.65rem' }}>
        {metrics.map(([label, value]) => <div key={label} style={{ padding: '.65rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}><div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div><div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '.15rem' }}>{value}</div></div>)}
      </div>
    </article>
  );
}

export function RunningSemesterView() {
  const { token } = useAuth();
  const [calendar, setCalendar] = useState({ running: [], recent: [], upcoming: [] });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const calendarRes = await fetch('/api/academic/running-semesters', { headers });
      const calendarData = await calendarRes.json();
      if (!calendarRes.ok) throw new Error(calendarData.error || 'Could not load the academic calendar.');
      setCalendar({ running: calendarData.running || [], recent: calendarData.recent || [], upcoming: calendarData.upcoming || [] });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);
  const change = (event) => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const edit = (semester) => {
    const nameParts = semester.semester_name.match(/^(.*?) Year (.*?) Semester$/i);
    setEditingId(semester.id);
    setForm({ sessionName: semester.session_name, year: semester.year || nameParts?.[1] || '', semester: semester.semester || nameParts?.[2] || '', startDate: semester.start_date, endDate: semester.end_date || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => { setEditingId(null); setForm(emptyForm); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const res = await fetch(editingId ? `/api/academic/running-semesters/${editingId}` : '/api/academic/running-semesters', { method: editingId ? 'PUT' : 'POST', headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the semester calendar.');
      setMessage({ type: 'success', text: data.message }); reset(); load();
    } catch (error) { setMessage({ type: 'error', text: error.message }); } finally { setSaving(false); }
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
    <div className="card" style={{ borderTop: '3px solid #2563eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div><h3 className="card-title"><CalendarDays size={18} /> {editingId ? 'Update Semester Calendar' : 'Add New Semester'}</h3><p style={{ margin: '.35rem 0 0', color: 'var(--text-muted)', fontSize: '.85rem' }}>Class Start is automatically the same as Semester Start. Semester End can be added later by editing.</p></div>
        {editingId && <button className="btn btn-secondary btn-sm" onClick={reset}>Cancel edit</button>}
      </div>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '.9rem' }}>
          <label className="form-group"><span className="form-label">Academic Session</span><input required name="sessionName" value={form.sessionName} onChange={change} className="form-input" placeholder="e.g. Session 2026-2027" /></label>
          <label className="form-group"><span className="form-label">Year</span><input required name="year" value={form.year} onChange={change} className="form-input" placeholder="e.g. 3rd" /></label>
          <label className="form-group"><span className="form-label">Semester</span><input required name="semester" value={form.semester} onChange={change} className="form-input" placeholder="e.g. 1st" /></label>
          <label className="form-group"><span className="form-label">Semester Start Date</span><input required type="date" name="startDate" value={form.startDate} onChange={change} className="form-input" /></label>
          <label className="form-group"><span className="form-label">Semester End Date <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></span><input type="date" name="endDate" value={form.endDate} onChange={change} className="form-input" /></label>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}><button disabled={saving} className="btn btn-primary">{editingId ? <Pencil size={16} /> : <Plus size={16} />}{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add New Semester'}</button></div>
      </form>
    </div>
    {message && <div style={{ padding: '.75rem 1rem', borderRadius: '8px', color: message.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)', background: message.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)' }}>{message.text}</div>}
    <section><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}><h3 style={{ display: 'flex', gap: '.5rem', alignItems: 'center', margin: 0 }}><Clock3 size={18} color="#16a34a" /> Running Semesters</h3><button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button></div>{loading ? <div className="card">Loading calendar…</div> : calendar.running.length ? <div style={{ display: 'grid', gap: '1.25rem' }}>{bySession(calendar.running).map(([sessionName, semesters]) => <div key={sessionName}><div style={{ fontSize: '.78rem', fontWeight: 800, color: '#2563eb', marginBottom: '.5rem' }}>{sessionName}</div><div style={{ display: 'grid', gap: '1rem' }}>{semesters.map(semester => <CalendarCard key={semester.id} semester={semester} onEdit={edit} />)}</div></div>)}</div> : <div className="card" style={{ color: 'var(--text-muted)' }}>No semester is currently running. A saved semester appears here automatically on its start date.</div>}</section>
    <section><h3 style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}><CalendarClock size={18} color="#d97706" /> Upcoming Semesters</h3>{loading ? null : calendar.upcoming.length ? <div style={{ display: 'grid', gap: '1.25rem' }}>{bySession(calendar.upcoming).map(([sessionName, semesters]) => <div key={sessionName}><div style={{ fontSize: '.78rem', fontWeight: 800, color: '#b45309', marginBottom: '.5rem' }}>{sessionName}</div><div style={{ display: 'grid', gap: '1rem' }}>{semesters.map(semester => <CalendarCard key={semester.id} semester={semester} onEdit={edit} recent />)}</div></div>)}</div> : <div className="card" style={{ color: 'var(--text-muted)' }}>No upcoming semester is saved.</div>}</section>
    <section><h3 style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}><CheckCircle size={18} color="#64748b" /> Recent Semesters</h3>{loading ? null : calendar.recent.length ? <div style={{ display: 'grid', gap: '1.25rem' }}>{bySession(calendar.recent).map(([sessionName, semesters]) => <div key={sessionName}><div style={{ fontSize: '.78rem', fontWeight: 800, color: '#64748b', marginBottom: '.5rem' }}>{sessionName}</div><div style={{ display: 'grid', gap: '1rem' }}>{semesters.map(semester => <CalendarCard key={semester.id} semester={semester} onEdit={edit} recent />)}</div></div>)}</div> : <div className="card" style={{ color: 'var(--text-muted)' }}>No completed semesters yet.</div>}</section>
  </div>;
}
