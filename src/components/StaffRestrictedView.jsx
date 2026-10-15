import React from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export function StaffRestrictedView() {
  return <div style={{ minHeight: 'calc(100vh - 88px)', display: 'grid', placeItems: 'center', padding: '1.25rem' }}>
    <section style={{ width: 'min(540px, 100%)', padding: '2.1rem', borderRadius: 18, background: 'linear-gradient(145deg, #1e293b, #0f172a)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,.2)', textAlign: 'center', boxShadow: '0 20px 45px rgba(15,23,42,.24)' }}>
      <div style={{ width: 58, height: 58, display: 'grid', placeItems: 'center', margin: '0 auto 16px', borderRadius: 16, color: '#c4b5fd', background: 'rgba(124,58,237,.16)' }}><LockKeyhole size={28} /></div>
      <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem' }}>Staff access is not assigned</h2>
      <p style={{ margin: '11px 0 0', color: '#94a3b8', lineHeight: 1.65 }}>This office-staff account has no operational access to academic data, routines, courses, students, or assessments.</p>
      <div style={{ marginTop: 19, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#a7f3d0', fontSize: '.82rem', fontWeight: 700 }}><ShieldCheck size={16} /> Use the account menu to change the temporary password.</div>
    </section>
  </div>;
}

export default StaffRestrictedView;
