import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarClock, Clock3, GraduationCap, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const panel = {
  background: 'linear-gradient(145deg, rgba(30,41,59,.96), rgba(15,23,42,.98))',
  border: '1px solid rgba(148,163,184,.18)',
  borderRadius: 16,
  boxShadow: '0 12px 28px rgba(2,6,23,.18)'
};

export function TeacherDashboardView({ onOpenAssessment }) {
  const { token, user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/routines/my-running-courses', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load your running routine courses.');
      setCourses(data.courses || []);
    } catch (loadError) {
      setCourses([]);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  return <div style={{ maxWidth: 1420, margin: '0 auto', padding: '1.25rem', color: '#e2e8f0' }}>
    <section style={{ ...panel, padding: '1.35rem 1.45rem', marginBottom: 20, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#a5b4fc', fontSize: '.78rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}><GraduationCap size={16} /> Faculty dashboard</div>
        <h2 style={{ margin: '8px 0 5px', color: '#fff', fontSize: '1.45rem' }}>Welcome, {user?.firstName} {user?.lastName}</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '.88rem' }}>Your currently running courses, calculated directly from the active department routine.</p>
      </div>
      <button onClick={load} disabled={loading} style={{ ...secondaryButton, opacity: loading ? .7 : 1 }}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh routine</button>
    </section>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 13px', color: '#cbd5e1' }}><BookOpen size={20} color="#818cf8" /><strong>Running assigned courses</strong><span style={{ color: '#94a3b8', fontSize: '.82rem' }}>({courses.length})</span></div>
    {loading ? <Status text="Loading your central routine assignments…" /> : error ? <Status text={error} danger /> : courses.length === 0 ? <Status text="No running course is assigned to this teacher in the active routine yet." /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(315px, 1fr))', gap: 16 }}>
      {courses.map(course => <article key={`${course.semesterId}-${course.courseId}`} style={{ ...panel, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div><div style={{ color: '#93c5fd', fontWeight: 900, fontSize: '.83rem' }}>{course.courseCode}</div><h3 style={{ margin: '6px 0 0', color: '#fff', fontSize: '1.02rem', lineHeight: 1.4 }}>{course.courseTitle}</h3></div>
          <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(99,102,241,.2)', color: '#c7d2fe', fontSize: '.68rem', fontWeight: 800 }}>{course.courseType} · {course.creditHours} Cr</span>
        </div>
        <div style={{ padding: '10px 11px', borderRadius: 10, background: 'rgba(2,6,23,.38)', color: '#cbd5e1', fontSize: '.8rem' }}><strong style={{ color: '#fff' }}>{course.sessionName}</strong><br />{course.semesterName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Metric icon={<CalendarClock size={16} />} label="Course ends" value={course.classEndDate ? `${course.remainingDays} day${course.remainingDays === 1 ? '' : 's'} left` : 'End date pending'} />
          <Metric icon={<Clock3 size={16} />} label="Routine classes left" value={course.remainingMeetings === null ? 'End date pending' : `${course.remainingMeetings} class${course.remainingMeetings === 1 ? '' : 'es'}`} />
        </div>
        <div style={{ color: '#94a3b8', fontSize: '.78rem' }}>Routine: {course.routineDays.length ? `${course.routineDays.join(', ')} · ${course.weeklyMeetings} class slot${course.weeklyMeetings === 1 ? '' : 's'}/week` : 'No class slot has been placed yet.'}</div>
        {course.nextClasses?.length > 0 && <div style={{ color: '#a5b4fc', fontSize: '.76rem' }}>Next routine day: {course.nextClasses.map(item => `${item.day} ${item.time}${item.room ? ` · ${item.room}` : ''}`).join(', ')}</div>}
        <button onClick={() => onOpenAssessment?.(course)} style={{ ...primaryButton, marginTop: 'auto' }}>Open Regular Assessment <ArrowRight size={16} /></button>
      </article>)}
    </div>}
  </div>;
}

function Metric({ icon, label, value }) {
  return <div style={{ padding: 11, borderRadius: 10, background: 'rgba(15,23,42,.7)', border: '1px solid rgba(148,163,184,.13)' }}><div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, fontSize: '.69rem' }}>{icon} {label}</div><strong style={{ display: 'block', marginTop: 6, color: '#f8fafc', fontSize: '.87rem' }}>{value}</strong></div>;
}

function Status({ text, danger = false }) {
  return <div style={{ ...panel, padding: '2.5rem 1.25rem', textAlign: 'center', color: danger ? '#fca5a5' : '#94a3b8' }}>{text}</div>;
}

const primaryButton = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, border: 0, borderRadius: 9, padding: '10px 13px', background: 'linear-gradient(135deg,#4f46e5,#2563eb)', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const secondaryButton = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, border: '1px solid rgba(148,163,184,.28)', borderRadius: 9, padding: '9px 12px', background: 'rgba(255,255,255,.05)', color: '#e2e8f0', fontWeight: 800, cursor: 'pointer' };

export default TeacherDashboardView;
