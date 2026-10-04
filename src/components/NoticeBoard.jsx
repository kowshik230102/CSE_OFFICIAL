import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  PlusCircle, 
  Pin, 
  Sparkles, 
  Calendar, 
  BookOpen, 
  FileSpreadsheet, 
  Filter, 
  Search, 
  Share2, 
  Trash2, 
  Check, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Users, 
  Layers, 
  X,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Send,
  Zap,
  Activity
} from 'lucide-react';

export const NoticeBoard = ({ user, token }) => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL'); // ALL, DEPARTMENT_WIDE, TARGETED
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest
  
  // Notice Publish Modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Academic',
    targetType: 'DEPARTMENT_WIDE',
    targetSessionId: '',
    targetSemesterId: '',
    isPinned: false,
    attachmentUrl: ''
  });

  const categories = [
    { id: 'ALL', label: 'All Notices', icon: Bell, color: '#3b82f6', bg: '#eff6ff' },
    { id: 'Academic', label: 'Academic', icon: BookOpen, color: '#2563eb', bg: '#dbeafe' },
    { id: 'Exam', label: 'Exam & Tests', icon: FileSpreadsheet, color: '#d97706', bg: '#fef3c7' },
    { id: 'Notice', label: 'General Notices', icon: Bell, color: '#7c3aed', bg: '#ede9fe' },
    { id: 'Event', label: 'Events & Tech', icon: Sparkles, color: '#059669', bg: '#d1fae5' }
  ];

  // Fetch notices
  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setNotices(data.notices || []);
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sessions for targeted notice posting
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/academic/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  useEffect(() => {
    fetchNotices();
    fetchSessions();
  }, [token]);

  // Load semesters when target session changes
  useEffect(() => {
    if (formData.targetSessionId) {
      fetch(`/api/academic/sessions/${formData.targetSessionId}/semesters`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => r.json())
        .then((d) => setSemesters(d.semesters || []))
        .catch(console.error);
    } else {
      setSemesters([]);
    }
  }, [formData.targetSessionId]);

  // Handle Publish
  const handlePublish = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setFeedback({ type: 'error', text: 'Please fill in both title and content.' });
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to publish notice.');

      setFeedback({ type: 'success', text: 'Notice published successfully to the serial feed!' });
      setIsPublishModalOpen(false);
      setFormData({
        title: '',
        content: '',
        category: 'Academic',
        targetType: 'DEPARTMENT_WIDE',
        targetSessionId: '',
        targetSemesterId: '',
        isPinned: false,
        attachmentUrl: ''
      });
      fetchNotices();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setPublishing(false);
    }
  };

  // Handle Delete
  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Are you sure you want to permanently delete this notice?')) return;

    try {
      const res = await fetch(`/api/notices/${noticeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to delete notice.');

      setFeedback({ type: 'success', text: 'Notice removed from the feed.' });
      fetchNotices();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  // Copy notice content to clipboard
  const handleCopyLink = (notice) => {
    const textToCopy = `[CSE Notice: ${notice.title}]\n${notice.content}\nPublished by: ${notice.author_name} (${notice.created_at})`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(notice.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Helper to check if a notice is recently posted (within 72 hours or top 2 newest)
  const isRecentNotice = (notice, index) => {
    if (index < 2) return true; // Ensure visual freshness highlight on latest items
    if (!notice.created_at) return false;
    const diffMs = Date.now() - new Date(notice.created_at).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours <= 72; // within 3 days
  };

  // Get Category Badge Style
  const getCategoryStyle = (cat) => {
    switch (cat) {
      case 'Academic':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: BookOpen, glow: 'rgba(37, 99, 235, 0.25)' };
      case 'Exam':
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', icon: FileSpreadsheet, glow: 'rgba(217, 119, 6, 0.25)' };
      case 'Event':
        return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: Sparkles, glow: 'rgba(5, 150, 105, 0.25)' };
      case 'Notice':
      default:
        return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', icon: Bell, glow: 'rgba(124, 58, 237, 0.25)' };
    }
  };

  // Author Role badge style
  const getAuthorBadge = (role) => {
    switch (role) {
      case 'ADMIN': return { bg: '#f3e8ff', color: '#7e22ce', label: 'Admin', border: '#d8b4fe' };
      case 'OFFICE_STAFF': return { bg: '#e0e7ff', color: '#4338ca', label: 'Academic Office', border: '#c7d2fe' };
      case 'TEACHER': return { bg: '#e0f2fe', color: '#0284c7', label: 'Faculty Member', border: '#bae6fd' };
      case 'STUDENT': return { bg: '#dcfce7', color: '#15803d', label: 'Enrolled Student', border: '#bbf7d0' };
      default: return { bg: '#f1f5f9', color: '#475569', label: role, border: '#e2e8f0' };
    }
  };

  // Category counts
  const categoryCounts = {
    ALL: notices.length,
    Academic: notices.filter(n => n.category === 'Academic').length,
    Exam: notices.filter(n => n.category === 'Exam').length,
    Notice: notices.filter(n => (n.category === 'Notice' || !n.category)).length,
    Event: notices.filter(n => n.category === 'Event').length
  };

  // Filtered & Sorted notices
  const filteredNotices = notices
    .filter((n) => {
      // Category filter
      if (categoryFilter !== 'ALL') {
        const cat = n.category || 'Notice';
        if (cat !== categoryFilter) return false;
      }

      // Audience filter
      if (audienceFilter === 'DEPARTMENT_WIDE' && n.target_type !== 'DEPARTMENT_WIDE') return false;
      if (audienceFilter === 'TARGETED' && n.target_type !== 'SESSION_SEMESTER_SPECIFIC') return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const titleMatch = n.title?.toLowerCase().includes(q);
        const contentMatch = n.content?.toLowerCase().includes(q);
        const authorMatch = n.author_name?.toLowerCase().includes(q);
        return titleMatch || contentMatch || authorMatch;
      }

      return true;
    })
    .sort((a, b) => {
      // Always keep pinned items on top
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      // Chronological sort
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const canPinNotice = user && (user.role === 'ADMIN' || user.role === 'OFFICE_STAFF' || user.role === 'TEACHER');

  return (
    <div className="notice-board-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Dynamic Hero Banner with Live Beacon & Real-Time Stats */}
      <div style={{ 
        position: 'relative',
        background: 'linear-gradient(135deg, #09101d 0%, #0f172a 45%, #1e1b4b 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '2rem',
        color: '#ffffff',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        overflow: 'hidden'
      }}>
        {/* Subtle Ambient Radial Glows */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          right: '-80px',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(37, 99, 235, 0) 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-60px',
          left: '20%',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(139, 92, 246, 0) 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Top Pill: Live Beacon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.85rem',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}>
              <span className="live-beacon" />
              <span>LIVE CHRONOLOGICAL BROADCAST FEED</span>
            </div>

            {/* Quick Status Tag */}
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={13} style={{ color: '#38bdf8' }} />
              <span>Session 2023-2024 • Academic Sync Active</span>
            </div>
          </div>

          {/* Main Title & Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <h2 style={{ 
                fontSize: '1.85rem', 
                fontWeight: 800, 
                letterSpacing: '-0.02em', 
                lineHeight: '1.2',
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #93c5fd 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '0.4rem'
              }}>
                Department Notice Board & Bulletin Dispatch
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '650px', lineHeight: '1.5' }}>
                Verified chronological academic dispatches published by Office Staff, Faculty Members, and Enrolled Students with multi-category instant filtering.
              </p>
            </div>

            {/* Publish Action Button */}
            <button
              onClick={() => setIsPublishModalOpen(true)}
              className="btn shimmer-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1.4rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.5), 0 0 15px rgba(99, 102, 241, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <PlusCircle size={18} />
              <span>Publish New Notice</span>
            </button>
          </div>

          {/* Real-time Category Stats Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {[
              { label: 'Total Bulletins', count: categoryCounts.ALL, icon: Bell, color: '#38bdf8' },
              { label: 'Academic', count: categoryCounts.Academic, icon: BookOpen, color: '#60a5fa' },
              { label: 'Exams & CTs', count: categoryCounts.Exam, icon: FileSpreadsheet, color: '#fbbf24' },
              { label: 'Events & Tech', count: categoryCounts.Event, icon: Sparkles, color: '#34d399' },
              { label: 'General Notices', count: categoryCounts.Notice, icon: Zap, color: '#c084fc' }
            ].map((stat, idx) => {
              const IconComp = stat.icon;
              return (
                <div 
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: `${stat.color}20`,
                    color: stat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IconComp size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                      {stat.count}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1.15rem',
            borderRadius: '10px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            animation: 'fadeIn 0.2s ease'
          }}>
            {feedback.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {/* 2. Floating Filter & Real-Time Query Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem' 
        }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Filter size={13} /> Filter:
            </span>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = categoryFilter === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.95rem',
                    borderRadius: '24px',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    border: isActive ? `1.5px solid ${cat.color}` : '1px solid #e2e8f0',
                    background: isActive ? cat.color : '#ffffff',
                    color: isActive ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? `0 4px 14px ${cat.color}40` : '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '12px',
                    background: isActive ? 'rgba(255, 255, 255, 0.28)' : '#f1f5f9',
                    color: isActive ? '#ffffff' : '#64748b',
                    fontWeight: 800
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, Audience & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search headlines, content, authors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.5rem 0.85rem 0.5rem 2.2rem',
                  fontSize: '0.825rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  width: '100%',
                  background: '#ffffff',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Audience Filter Dropdown */}
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.85rem',
                fontSize: '0.825rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">🏛️ All Audiences</option>
              <option value="DEPARTMENT_WIDE">🌐 General (All Batches)</option>
              <option value="TARGETED">🎯 Session / Semester Only</option>
            </select>

            {/* Sort Toggle Button */}
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="btn btn-secondary btn-sm"
              title="Toggle sort order"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              <Clock size={14} /> {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Serial Chronological Notice Feed */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            border: '3px solid #3b82f6', 
            borderTopColor: 'transparent', 
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem' 
          }} />
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>Synchronizing Broadcast Feed</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Fetching verified academic notices from department database...
          </p>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: '#3b82f6',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.15)'
          }}>
            <Bell size={30} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>No matching notices found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem', maxWidth: '420px', margin: '0.35rem auto 1.25rem' }}>
            There are currently no notices matching your filter. Clear the category or search criteria, or post a new announcement.
          </p>
          <button 
            onClick={() => { setCategoryFilter('ALL'); setSearchTerm(''); setAudienceFilter('ALL'); }}
            className="btn btn-primary btn-sm"
            style={{ borderRadius: '10px' }}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredNotices.map((notice, index) => {
            const catStyle = getCategoryStyle(notice.category);
            const CatIcon = catStyle.icon;
            const authorBadge = getAuthorBadge(notice.author_role);
            const isRecent = isRecentNotice(notice, index);
            const isExpanded = expandedId === notice.id;
            const isAuthorOrAdmin = user && (user.role === 'ADMIN' || user.role === 'OFFICE_STAFF' || user.id === notice.author_id);
            const serialNumber = `#${String(index + 1).padStart(2, '0')}`;

            return (
              <article
                key={notice.id}
                className="card notice-feed-card"
                style={{
                  position: 'relative',
                  borderLeft: notice.is_pinned 
                    ? '6px solid #f59e0b' 
                    : (isRecent ? '6px solid #10b981' : '6px solid #3b82f6'),
                  background: notice.is_pinned ? '#fffdf7' : 'rgba(255, 255, 255, 0.95)',
                  boxShadow: notice.is_pinned 
                    ? '0 6px 20px -3px rgba(245, 158, 11, 0.15), 0 2px 6px rgba(0, 0, 0, 0.04)' 
                    : (isRecent ? '0 6px 20px -3px rgba(16, 185, 129, 0.15), 0 2px 6px rgba(0, 0, 0, 0.04)' : 'var(--shadow-sm)'),
                  padding: '1.5rem 1.75rem',
                  borderRadius: '16px'
                }}
              >
                {/* Notice Top Meta Line: Serial, Category, NEW Badge, Pin, Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {/* Serial sequence badge */}
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      background: '#09101d',
                      color: '#ffffff',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '8px',
                      letterSpacing: '0.06em',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(56, 189, 248, 0.35)'
                    }}>
                      {serialNumber}
                    </span>

                    {/* Category Pill */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '14px',
                      background: catStyle.bg,
                      color: catStyle.color,
                      border: `1px solid ${catStyle.border}`,
                      boxShadow: `0 2px 6px ${catStyle.glow}`
                    }}>
                      <CatIcon size={13} />
                      {notice.category || 'Notice'}
                    </span>

                    {/* Glowing NEW Badge with Sparkles */}
                    {isRecent && (
                      <span 
                        className="badge-new-glow"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.725rem',
                          fontWeight: 800,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          color: '#ffffff',
                          letterSpacing: '0.04em'
                        }}
                      >
                        <Sparkles size={12} /> NEW
                      </span>
                    )}

                    {/* Important Pinned Indicator */}
                    {notice.is_pinned ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '14px',
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)'
                      }}>
                        <Pin size={12} /> Important / Pinned
                      </span>
                    ) : null}

                    {/* Target Audience Badge */}
                    <span style={{
                      fontSize: '0.725rem',
                      color: '#475569',
                      background: '#f1f5f9',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      border: '1px solid #e2e8f0'
                    }}>
                      {notice.target_type === 'DEPARTMENT_WIDE' 
                        ? '🏛️ Department-Wide' 
                        : `🎯 ${notice.session_name || 'Session'} • ${notice.semester_name || 'All Semesters'}`}
                    </span>
                  </div>

                  {/* Relative Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.775rem', color: '#64748b', fontWeight: 600 }}>
                    <Clock size={13} style={{ color: '#94a3b8' }} />
                    <span>{new Date(notice.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                {/* Headline / Title */}
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 800, 
                  color: 'var(--text-main)', 
                  margin: '0.45rem 0 0.75rem',
                  lineHeight: '1.4',
                  letterSpacing: '-0.01em'
                }}>
                  {notice.title}
                </h3>

                {/* Notice Detailed Content */}
                <div style={{ 
                  fontSize: '0.925rem', 
                  color: '#334155', 
                  lineHeight: '1.7', 
                  whiteSpace: 'pre-wrap',
                  maxHeight: isExpanded ? 'none' : '160px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {notice.content}
                </div>

                {notice.content && notice.content.length > 240 && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      marginTop: '0.5rem',
                      padding: '0.2rem 0'
                    }}
                  >
                    {isExpanded ? <>Read Less <ChevronUp size={15} /></> : <>Read Full Notice <ChevronDown size={15} /></>}
                  </button>
                )}

                {/* Optional Attachment Link */}
                {notice.attachment_url && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <a
                      href={notice.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.45rem', 
                        fontSize: '0.775rem',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        background: '#eff6ff',
                        color: '#1d4ed8'
                      }}
                    >
                      <ExternalLink size={13} /> View Attached Document
                    </a>
                  </div>
                )}

                {/* Footer: Author details and card actions */}
                <div style={{
                  marginTop: '1.25rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.85rem'
                }}>
                  {/* Author Persona Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: authorBadge.bg,
                      color: authorBadge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      border: `2px solid ${authorBadge.border}`,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}>
                      {notice.author_name ? notice.author_name[0] : 'U'}
                    </div>
                    <div style={{ fontSize: '0.825rem', lineHeight: '1.3' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Published by </span>
                      <strong style={{ color: 'var(--text-main)' }}>{notice.author_name}</strong>
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '6px',
                        background: authorBadge.bg,
                        color: authorBadge.color,
                        fontWeight: 700,
                        border: `1px solid ${authorBadge.border}`
                      }}>
                        {authorBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleCopyLink(notice)}
                      className="btn btn-secondary btn-sm"
                      title="Copy notice details"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.775rem', borderRadius: '8px' }}
                    >
                      {copiedId === notice.id ? (
                        <>
                          <Check size={14} style={{ color: '#10b981' }} />
                          <span style={{ color: '#10b981', fontWeight: 700 }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={13} />
                          <span>Share / Copy</span>
                        </>
                      )}
                    </button>

                    {/* Author or Admin Delete Button */}
                    {isAuthorOrAdmin && (
                      <button
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="btn btn-sm"
                        title="Delete notice"
                        style={{
                          background: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.775rem',
                          borderRadius: '8px'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MODAL: PUBLISH NEW NOTICE (Office, Teacher & Student) */}
      {/* ========================================================= */}
      {isPublishModalOpen && (
        <div className="modal-overlay" onClick={() => !publishing && setIsPublishModalOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: '640px', borderRadius: '20px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#09101d', color: '#ffffff', borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
                }}>
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Create Official Notice</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    Publish to department feed as <strong>{user?.firstName} {user?.lastName}</strong> ({user?.role?.replace('_', ' ')})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsPublishModalOpen(false)} 
                disabled={publishing}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePublish}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.75rem' }}>
                {/* Notice Category Selection */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Notice Category / Classification *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginTop: '0.35rem' }}>
                    {[
                      { id: 'Academic', label: 'Academic', icon: BookOpen, color: '#2563eb' },
                      { id: 'Exam', label: 'Exam', icon: FileSpreadsheet, color: '#d97706' },
                      { id: 'Notice', label: 'Notice', icon: Bell, color: '#7c3aed' },
                      { id: 'Event', label: 'Event', icon: Sparkles, color: '#059669' }
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = formData.category === cat.id;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setFormData({ ...formData, category: cat.id })}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.85rem 0.5rem',
                            borderRadius: '12px',
                            border: isSelected ? `2px solid ${cat.color}` : '1px solid #e2e8f0',
                            background: isSelected ? `${cat.color}12` : '#ffffff',
                            color: isSelected ? cat.color : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            fontWeight: 700,
                            fontSize: '0.825rem',
                            boxShadow: isSelected ? `0 4px 12px ${cat.color}25` : 'none'
                          }}
                        >
                          <Icon size={20} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Audience Distribution */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Target Distribution *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
                    <div 
                      onClick={() => setFormData({ ...formData, targetType: 'DEPARTMENT_WIDE' })}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '12px',
                        border: formData.targetType === 'DEPARTMENT_WIDE' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: formData.targetType === 'DEPARTMENT_WIDE' ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem'
                      }}
                    >
                      <input
                        type="radio"
                        name="modalTargetType"
                        checked={formData.targetType === 'DEPARTMENT_WIDE'}
                        onChange={() => setFormData({ ...formData, targetType: 'DEPARTMENT_WIDE' })}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Department-Wide</div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>All Batches & Faculty</div>
                      </div>
                    </div>

                    <div 
                      onClick={() => setFormData({ ...formData, targetType: 'SESSION_SEMESTER_SPECIFIC' })}
                      style={{
                        padding: '0.85rem',
                        borderRadius: '12px',
                        border: formData.targetType === 'SESSION_SEMESTER_SPECIFIC' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: formData.targetType === 'SESSION_SEMESTER_SPECIFIC' ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem'
                      }}
                    >
                      <input
                        type="radio"
                        name="modalTargetType"
                        checked={formData.targetType === 'SESSION_SEMESTER_SPECIFIC'}
                        onChange={() => setFormData({ ...formData, targetType: 'SESSION_SEMESTER_SPECIFIC' })}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Targeted Session</div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Specific Batch / Semester</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specific Session / Semester if targeted */}
                {formData.targetType === 'SESSION_SEMESTER_SPECIFIC' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Target Session *</label>
                      <select
                        className="form-select"
                        required
                        value={formData.targetSessionId}
                        onChange={(e) => setFormData({ ...formData, targetSessionId: e.target.value })}
                        style={{ fontSize: '0.825rem', padding: '0.55rem' }}
                      >
                        <option value="">-- Choose Session --</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>{s.session_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Target Semester</label>
                      <select
                        className="form-select"
                        value={formData.targetSemesterId}
                        onChange={(e) => setFormData({ ...formData, targetSemesterId: e.target.value })}
                        style={{ fontSize: '0.825rem', padding: '0.55rem' }}
                      >
                        <option value="">All Semesters in Session</option>
                        {semesters.map((sem) => (
                          <option key={sem.id} value={sem.id}>{sem.semester_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Notice Title */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Notice Title / Headline *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Schedule Update: Midterm Database Project Guidelines"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="form-input"
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>

                {/* Notice Content */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Detailed Notice Content *</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Provide full instructions, guidelines, room numbers, or schedules..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="form-textarea"
                    style={{ fontSize: '0.875rem', lineHeight: '1.6' }}
                  />
                </div>

                {/* Optional Attachment Link */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Attachment URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or official pdf document url"
                    value={formData.attachmentUrl}
                    onChange={(e) => setFormData({ ...formData, attachmentUrl: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Pin Notice Option for Faculty / Staff / Admin */}
                {canPinNotice && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: '#fffbeb', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #fef3c7' }}>
                    <input
                      type="checkbox"
                      id="pinNoticeModal"
                      checked={formData.isPinned}
                      onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                    />
                    <label htmlFor="pinNoticeModal" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e', cursor: 'pointer' }}>
                      📌 Pin to top of feed as an Important Announcement
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', padding: '1.25rem 1.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={publishing}
                  style={{ borderRadius: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={publishing}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px', padding: '0.6rem 1.4rem' }}
                >
                  {publishing ? (
                    <>Publishing...</>
                  ) : (
                    <><Send size={15} /> Publish Announcement</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
