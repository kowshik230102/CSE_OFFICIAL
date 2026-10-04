import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeBoard } from './NoticeBoard';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  Building,
  RefreshCw,
  Bell
} from 'lucide-react';

export const AdminView = ({ initialTab = 'users' }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState(null);

  // New User Form State
  const [newUser, setNewUser] = useState({
    role: 'TEACHER',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    designation: 'Assistant Professor',
    roomNumber: 'Academic Bldg 3, Room 405',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = roleFilter === 'ALL' ? '/api/auth/users' : `/api/auth/users?role=${roleFilter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleToggleStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      fetchUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setIsModalOpen(false);
      setNewUser({
        role: 'TEACHER',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        designation: 'Assistant Professor',
        roomNumber: 'Academic Bldg 3, Room 405',
      });
      fetchUsers();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert('Error creating user: ' + err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchTerm.toLowerCase();
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return fullName.includes(query) || u.email.toLowerCase().includes(query) || (u.student_roll && u.student_roll.toLowerCase().includes(query));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Superuser Admin Hero Command Banner */}
      <div className="role-hero-banner hero-admin">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <span className="live-beacon" style={{ marginRight: '4px' }}></span> Root Administrator Mode
            </span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
              Engine Status: <strong>5,000+ Active Users Engine</strong> • 99.99% Uptime
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            System Administration & RBAC Master Console
          </h2>
          <p style={{ fontSize: '0.88rem', opacity: 0.9, marginTop: '0.3rem', maxWidth: '650px' }}>
            Multi-role governance, instant account provisioning, security state lockouts, and department broadcasts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="hero-stat-widget">
              <div className="hero-stat-val">{users.length}</div>
              <div className="hero-stat-lbl">Total Users</div>
            </div>
            <div className="hero-stat-widget">
              <div className="hero-stat-val" style={{ color: '#34d399' }}>
                {users.filter(u => u.status === 'ACTIVE').length}
              </div>
              <div className="hero-stat-lbl">Active Verified</div>
            </div>
            <div className="hero-stat-widget">
              <div className="hero-stat-val">
                {users.filter(u => u.role === 'TEACHER').length}
              </div>
              <div className="hero-stat-lbl">Faculty Staff</div>
            </div>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="btn btn-gradient-primary shimmer-btn" style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}>
            <UserPlus size={18} /> Provision Faculty / Staff
          </button>
        </div>
      </div>

      {/* Dynamic Segmented Tab Switcher */}
      <div className="segmented-nav-wrapper">
        <button
          onClick={() => setActiveTab('users')}
          className={`segmented-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
        >
          <Users size={16} style={{ color: activeTab === 'users' ? '#2563eb' : '#64748b' }} /> 
          <span>1. User Directory & Security Controls</span>
          <span style={{ 
            fontSize: '0.7rem', 
            background: activeTab === 'users' ? '#eff6ff' : '#f1f5f9', 
            color: activeTab === 'users' ? '#2563eb' : '#64748b', 
            padding: '0.1rem 0.5rem', 
            borderRadius: '999px',
            fontWeight: 700 
          }}>
            {users.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('notices')}
          className={`segmented-tab-btn ${activeTab === 'notices' ? 'active' : ''}`}
        >
          <Bell size={16} style={{ color: activeTab === 'notices' ? '#2563eb' : '#64748b' }} /> 
          <span>2. Department Notice Board Feed</span>
        </button>
      </div>

      {activeTab === 'notices' && (
        <NoticeBoard user={user} token={token} />
      )}

      {activeTab === 'users' && (
        <>
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
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#eff6ff', color: '#2563eb' }}>
                <Users size={24} />
              </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL REGISTERED USERS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{users.length}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>FACULTY MEMBERS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {users.filter((u) => u.role === 'TEACHER').length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#fdf4ff', color: '#9333ea' }}>
            <Building size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OFFICE STAFF</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {users.filter((u) => u.role === 'OFFICE_STAFF').length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#f0f9ff', color: '#0284c7' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE STUDENTS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {users.filter((u) => u.role === 'STUDENT').length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Role Filter:</span>
            {['ALL', 'TEACHER', 'OFFICE_STAFF', 'STUDENT', 'ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              >
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by name, email, roll..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '32px' }}
              />
            </div>
            <button onClick={fetchUsers} className="btn btn-secondary btn-sm" title="Refresh Table">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* User Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Designation / Academic Details</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Security Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${u.role.toLowerCase().replace('_', '')}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {u.role === 'TEACHER' && (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{u.designation || 'Faculty'}</div>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{u.room_number || 'Room TBD'}</div>
                        </div>
                      )}
                      {u.role === 'STUDENT' && (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Roll: {u.student_roll}</div>
                          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{u.session_name || 'Session 2023-24'}</div>
                        </div>
                      )}
                      {u.role === 'OFFICE_STAFF' && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Academic Affairs & Records</span>
                      )}
                      {u.role === 'ADMIN' && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Full Root Control</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`btn btn-sm ${u.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Provision Account Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="card-title">
                <UserPlus size={18} /> Provision Staff or Faculty Account
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <XCircle size={20} style={{ color: '#64748b' }} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">System Role</label>
                  <select
                    className="form-select"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="TEACHER">Faculty Member (Teacher)</option>
                    <option value="OFFICE_STAFF">Office Staff (Academic Data Admin)</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Tariq"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Al-Mansoor"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Official University Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. tariq@cse.univ.edu"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Password</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="form-input"
                  />
                </div>

                {newUser.role === 'TEACHER' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Academic Designation</label>
                      <select
                        className="form-select"
                        value={newUser.designation}
                        onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                      >
                        <option value="Professor">Professor</option>
                        <option value="Associate Professor">Associate Professor</option>
                        <option value="Assistant Professor">Assistant Professor</option>
                        <option value="Lecturer">Lecturer</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Office Room</label>
                      <input
                        type="text"
                        placeholder="e.g. Room 402, Bldg 3"
                        value={newUser.roomNumber}
                        onChange={(e) => setNewUser({ ...newUser, roomNumber: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create & Authorize Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
