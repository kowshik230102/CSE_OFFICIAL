import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

const emptyDraft = (number = 1) => ({
  coCode: `CO ${number}`,
  topic: '',
  theoryContactHours: '',
  labContactHours: ''
});

const normalizeEntries = (entries = []) => entries.map((entry, index) => ({
  id: entry.id || `draft-${index}`,
  coCode: entry.coCode ?? entry.co_code ?? `CO ${index + 1}`,
  topic: entry.topic || '',
  theoryContactHours: entry.theoryContactHours ?? entry.theory_contact_hours ?? 0,
  labContactHours: entry.labContactHours ?? entry.lab_contact_hours ?? 0
}));

const contactHours = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

export default function CourseOutlineModal({ course, semesterName, canManage, onClose, onSave }) {
  const [generalOverview, setGeneralOverview] = useState('');
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingIndex, setEditingIndex] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!course) return;
    const nextEntries = normalizeEntries(course.outline_entries);
    setGeneralOverview(course.syllabus_outline || '');
    setEntries(nextEntries);
    setDraft(emptyDraft(nextEntries.length + 1));
    setEditingIndex(null);
    setFeedback(null);
    setIsSaving(false);
  }, [course]);

  const totals = useMemo(() => entries.reduce((summary, entry) => ({
    theory: summary.theory + contactHours(entry.theoryContactHours),
    lab: summary.lab + contactHours(entry.labContactHours)
  }), { theory: 0, lab: 0 }), [entries]);

  if (!course) return null;

  const resetDraft = (nextNumber = entries.length + 1) => {
    setDraft(emptyDraft(nextNumber));
    setEditingIndex(null);
  };

  const addOrUpdateEntry = (event) => {
    event.preventDefault();
    const coCode = draft.coCode.trim().toUpperCase();
    const topic = draft.topic.trim();
    const theory = contactHours(draft.theoryContactHours);
    const lab = contactHours(draft.labContactHours);

    if (!coCode || !topic) {
      setFeedback({ type: 'error', text: 'Enter the CO label and the course topics before adding this item.' });
      return;
    }
    if (theory < 0 || lab < 0 || theory + lab <= 0) {
      setFeedback({ type: 'error', text: 'Add at least one theory or lab contact hour.' });
      return;
    }

    const nextEntry = {
      id: editingIndex === null ? `draft-${Date.now()}` : entries[editingIndex].id,
      coCode,
      topic,
      theoryContactHours: theory,
      labContactHours: lab
    };

    if (editingIndex === null) {
      const nextEntries = [...entries, nextEntry];
      setEntries(nextEntries);
      setDraft(emptyDraft(nextEntries.length + 1));
    } else {
      const nextEntries = entries.map((entry, index) => index === editingIndex ? nextEntry : entry);
      setEntries(nextEntries);
      setDraft(emptyDraft(nextEntries.length + 1));
      setEditingIndex(null);
    }
    setFeedback(null);
  };

  const editEntry = (index) => {
    const entry = entries[index];
    setDraft({
      coCode: entry.coCode,
      topic: entry.topic,
      theoryContactHours: entry.theoryContactHours,
      labContactHours: entry.labContactHours
    });
    setEditingIndex(index);
    setFeedback(null);
  };

  const removeEntry = (index) => {
    const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index);
    setEntries(nextEntries);
    if (editingIndex === index) resetDraft(nextEntries.length + 1);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
    setFeedback(null);
  };

  const finishOutline = async () => {
    if (!canManage) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await onSave({
        syllabusOutline: generalOverview,
        outlineEntries: entries.map((entry) => ({
          coCode: entry.coCode,
          topic: entry.topic,
          theoryContactHours: contactHours(entry.theoryContactHours),
          labContactHours: contactHours(entry.labContactHours)
        }))
      });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The course content could not be saved.' });
      setIsSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.7rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    color: '#0f172a',
    background: '#ffffff',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: '0.88rem'
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-content-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}
    >
      <div style={{
        width: 'min(1120px, 100%)', maxHeight: '92vh', overflowY: 'auto', background: '#ffffff', borderRadius: '18px',
        boxShadow: '0 24px 65px rgba(15, 23, 42, 0.3)'
      }}>
        <div style={{
          padding: '1.35rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: '1rem', position: 'sticky', top: 0, background: '#ffffff', zIndex: 2
        }}>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: '#dbeafe', color: '#1d4ed8', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
              <FileText size={20} />
            </div>
            <div>
              <p style={{ margin: '0 0 0.2rem', color: '#2563eb', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {semesterName || 'Curriculum'} · {course.course_code}
              </p>
              <h2 id="course-content-title" style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', lineHeight: 1.35 }}>
                Course Content: {course.course_title}
              </h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close course content" style={{ border: 'none', background: '#f1f5f9', color: '#475569', width: '34px', height: '34px', borderRadius: '8px', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.15rem' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.8rem 0.9rem', color: '#1e3a8a', fontSize: '0.84rem', lineHeight: 1.5 }}>
            {canManage
              ? 'Add one CO-wise content item at a time. Use Finish & Save when the table is complete.'
              : 'This table shows course topics, their CO mapping, and the assigned theory and lab contact hours.'}
          </div>

          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <label htmlFor="general-course-overview" style={{ color: '#334155', fontWeight: 800, fontSize: '0.9rem' }}>General course overview</label>
              {canManage && <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Optional · preserved separately from the table</span>}
            </div>
            {canManage ? (
              <textarea
                id="general-course-overview"
                rows={3}
                maxLength={12000}
                value={generalOverview}
                onChange={(event) => setGeneralOverview(event.target.value)}
                placeholder="Add an overall description, prerequisites, or other syllabus notes..."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
              />
            ) : (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px', padding: '0.8rem 0.9rem', color: generalOverview ? '#334155' : '#64748b', lineHeight: 1.55, fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                {generalOverview || 'No general overview has been provided.'}
              </div>
            )}
          </section>

          {canManage && (
            <form onSubmit={addOrUpdateEntry} style={{ background: '#f8fafc', border: '1px solid #dbeafe', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem', color: '#1e3a8a' }}>
                {editingIndex === null ? <Plus size={17} /> : <Pencil size={16} />}
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{editingIndex === null ? 'Add course-content item' : `Edit content item ${editingIndex + 1}`}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.45fr) minmax(230px, 2.2fr) minmax(120px, 0.6fr) minmax(120px, 0.6fr)', gap: '0.75rem', alignItems: 'end' }}>
                <label style={{ display: 'grid', gap: '0.35rem', color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>
                  CO
                  <input value={draft.coCode} onChange={(event) => setDraft({ ...draft, coCode: event.target.value })} maxLength={30} placeholder="CO 1" style={inputStyle} />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>
                  Course topics
                  <textarea value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} rows={2} maxLength={8000} placeholder="Write the unit topics, methods, or laboratory activities..." style={{ ...inputStyle, resize: 'vertical', minHeight: '68px' }} />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>
                  Theory hours
                  <input type="number" min="0" max="999" step="0.5" value={draft.theoryContactHours} onChange={(event) => setDraft({ ...draft, theoryContactHours: event.target.value })} placeholder="e.g. 6" style={inputStyle} />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>
                  Lab hours
                  <input type="number" min="0" max="999" step="0.5" value={draft.labContactHours} onChange={(event) => setDraft({ ...draft, labContactHours: event.target.value })} placeholder="e.g. 6" style={inputStyle} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                {editingIndex !== null && <button type="button" onClick={() => { resetDraft(); setFeedback(null); }} style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.56rem 0.85rem', cursor: 'pointer', fontWeight: 700 }}>Cancel edit</button>}
                <button type="submit" style={{ background: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.56rem 0.9rem', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {editingIndex === null ? <Plus size={15} /> : <CheckCircle2 size={15} />}
                  {editingIndex === null ? 'Add to outline' : 'Update item'}
                </button>
              </div>
            </form>
          )}

          {feedback && (
            <div role="alert" style={{ background: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4', color: feedback.type === 'error' ? '#b91c1c' : '#15803d', border: `1px solid ${feedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`, borderRadius: '9px', padding: '0.75rem 0.85rem', fontSize: '0.85rem', display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
              {feedback.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{feedback.text}
            </div>
          )}

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>Course content table</h3>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.28rem 0.55rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800 }}>{entries.length} CO item{entries.length === 1 ? '' : 's'}</span>
                <span style={{ padding: '0.28rem 0.55rem', background: '#f0fdf4', color: '#047857', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock3 size={12} /> {totals.theory} Theory · {totals.lab} Lab</span>
              </div>
            </div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: canManage ? '760px' : '650px', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#eaf1fb', color: '#1e293b' }}>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.8rem', borderBottom: '1px solid #cbd5e1', minWidth: '360px' }}>Course Topics</th>
                    <th scope="col" style={{ textAlign: 'center', padding: '0.8rem', borderBottom: '1px solid #cbd5e1', width: '90px' }}>CO</th>
                    <th scope="col" style={{ textAlign: 'center', padding: '0.8rem', borderBottom: '1px solid #cbd5e1', width: '130px' }}>Contact Hours<br />(Theory)</th>
                    <th scope="col" style={{ textAlign: 'center', padding: '0.8rem', borderBottom: '1px solid #cbd5e1', width: '120px' }}>Contact Hours<br />(Lab)</th>
                    {canManage && <th scope="col" style={{ textAlign: 'center', padding: '0.8rem', borderBottom: '1px solid #cbd5e1', width: '104px' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr><td colSpan={canManage ? 5 : 4} style={{ padding: '1.2rem', color: '#64748b', textAlign: 'center' }}>No structured course content has been added yet.</td></tr>
                  ) : entries.map((entry, index) => (
                    <tr key={entry.id || index} style={{ background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '0.85rem', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #e2e8f0', color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{entry.topic}</td>
                      <td style={{ padding: '0.85rem', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #e2e8f0', textAlign: 'center', color: '#1e3a8a', fontWeight: 800, verticalAlign: 'middle' }}>{entry.coCode}</td>
                      <td style={{ padding: '0.85rem', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #e2e8f0', textAlign: 'center', color: '#0f172a', fontWeight: 700, verticalAlign: 'middle' }}>{contactHours(entry.theoryContactHours)}</td>
                      <td style={{ padding: '0.85rem', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #e2e8f0', textAlign: 'center', color: '#0f172a', fontWeight: 700, verticalAlign: 'middle' }}>{contactHours(entry.labContactHours)}</td>
                      {canManage && <td style={{ padding: '0.65rem', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}><div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button type="button" onClick={() => editEntry(index)} title="Edit item" style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '7px', cursor: 'pointer' }}><Pencil size={14} /></button>
                        <button type="button" onClick={() => removeEntry(index)} title="Remove item" style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '7px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </div></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.7rem', paddingTop: '0.15rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.66rem 1rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>{canManage ? 'Close without saving' : 'Close'}</button>
            {canManage && <button type="button" disabled={isSaving} onClick={finishOutline} style={{ padding: '0.66rem 1rem', border: 'none', background: isSaving ? '#93c5fd' : '#16a34a', color: '#ffffff', borderRadius: '8px', cursor: isSaving ? 'wait' : 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Save size={16} />{isSaving ? 'Saving...' : 'Finish & Save Course Content'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
