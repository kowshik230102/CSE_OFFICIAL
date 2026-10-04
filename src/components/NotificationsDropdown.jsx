import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Sparkles, 
  BookOpen, 
  FileSpreadsheet, 
  MessageSquare, 
  ExternalLink,
  Clock,
  Trash2,
  CheckCircle2
} from 'lucide-react';

export const NotificationsDropdown = ({ onNavigateNoticeBoard }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Sample dynamic notifications representing real university events
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: 'New Notice Published',
      message: 'Dr. Mahmudur Rahman posted guidelines for CSE-3101 Midterm Database Project.',
      type: 'Academic',
      time: '12m ago',
      read: false,
      icon: BookOpen,
      iconColor: '#2563eb',
      iconBg: '#eff6ff'
    },
    {
      id: 'notif-2',
      title: 'Exam Schedule Announced',
      message: 'Official Class Test 2 (CT-2) for 3rd Year 1st Semester has been scheduled for Room 402.',
      type: 'Exam',
      time: '1h ago',
      read: false,
      icon: FileSpreadsheet,
      iconColor: '#d97706',
      iconBg: '#fffbeb'
    },
    {
      id: 'notif-3',
      title: 'Tech Fest 2026 Registration',
      message: 'Annual CSE Hackathon registration is officially open. Theme: Scalable AI & Systems.',
      type: 'Event',
      time: '3h ago',
      read: false,
      icon: Sparkles,
      iconColor: '#059669',
      iconBg: '#ecfdf5'
    },
    {
      id: 'notif-4',
      title: 'Lab Hours Extended',
      message: 'Academic Office approved extended evening hours for Software Engineering Lab 304.',
      type: 'Notice',
      time: '1d ago',
      read: true,
      icon: Bell,
      iconColor: '#7c3aed',
      iconBg: '#f5f3ff'
    }
  ]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const markSingleAsRead = (id) => {
    setNotifications(notifications.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleNotificationClick = (item) => {
    markSingleAsRead(item.id);
    setIsOpen(false);
    if (onNavigateNoticeBoard) {
      onNavigateNoticeBoard(item.type);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Top Right Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '10px',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
          e.currentTarget.style.borderColor = '#38bdf8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }}
      >
        <Bell size={18} />

        {/* Unread Indicator Badge */}
        {unreadCount > 0 && (
          <span 
            className="notif-badge-pulse"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9999px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.675rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px #0f172a, 0 2px 5px rgba(239, 68, 68, 0.5)',
              lineHeight: 1
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '360px',
            maxWidth: '92vw',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                Notifications
              </span>
              {unreadCount > 0 ? (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#fee2e2',
                  color: '#b91c1c',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '10px'
                }}>
                  {unreadCount} unread
                </span>
              ) : (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#ecfdf5',
                  color: '#065f46',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '10px'
                }}>
                  All caught up
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <CheckCheck size={13} /> Mark read
              </button>
            )}
          </div>

          {/* List of Alerts */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', color: '#10b981' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>No new notifications</p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>You're completely up to date with departmental alerts.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '0.85rem 1.15rem',
                      display: 'flex',
                      gap: '0.85rem',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      background: item.read ? '#ffffff' : '#f8faff',
                      transition: 'background 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = item.read ? '#ffffff' : '#f8faff'}
                  >
                    {/* Unread indicator dot */}
                    {!item.read && (
                      <span style={{
                        position: 'absolute',
                        left: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#2563eb'
                      }} />
                    )}

                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: item.iconBg,
                      color: item.iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <IconComponent size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.825rem',
                          fontWeight: item.read ? 600 : 700,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Clock size={10} /> {item.time}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '0.775rem',
                        color: item.read ? '#64748b' : '#334155',
                        lineHeight: '1.4',
                        margin: '0.2rem 0 0'
                      }}>
                        {item.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '0.65rem 1.15rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                onClick={clearAllNotifications}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.725rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                <Trash2 size={12} /> Clear all
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onNavigateNoticeBoard) onNavigateNoticeBoard('ALL');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                Open Notice Board <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
