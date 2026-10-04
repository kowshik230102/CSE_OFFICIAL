import React, { useState } from 'react';
import { 
  Settings, 
  Bell, 
  Shield, 
  Eye, 
  Smartphone, 
  Sliders, 
  Check, 
  X,
  Lock,
  Moon,
  Volume2
} from 'lucide-react';

export const SettingsModal = ({ isOpen, onClose, onOpenPasswordModal }) => {
  const [settings, setSettings] = useState({
    noticeAlerts: true,
    examAlerts: true,
    emailDigest: false,
    density: 'comfortable',
    highContrast: false,
    soundEffects: true
  });
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-dialog" 
        style={{ maxWidth: '540px', borderRadius: '16px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>System & Dashboard Settings</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Personalize portal notifications and display preferences</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. Notification Preferences */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
              <Bell size={15} style={{ color: '#2563eb' }} /> Notification Preferences
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Push Alert on New Notices</strong>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Show red indicator badge when notices are published</div>
                </span>
                <input
                  type="checkbox"
                  checked={settings.noticeAlerts}
                  onChange={(e) => setSettings({ ...settings, noticeAlerts: e.target.checked })}
                />
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Exam & Class Test Schedules</strong>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Immediate alert for CT marks submission and exam dates</div>
                </span>
                <input
                  type="checkbox"
                  checked={settings.examAlerts}
                  onChange={(e) => setSettings({ ...settings, examAlerts: e.target.checked })}
                />
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Weekly Institutional Email Digest</strong>
                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Receive consolidated academic summaries every Sunday</div>
                </span>
                <input
                  type="checkbox"
                  checked={settings.emailDigest}
                  onChange={(e) => setSettings({ ...settings, emailDigest: e.target.checked })}
                />
              </label>
            </div>
          </div>

          {/* 2. Display & Accessibility */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
              <Eye size={15} style={{ color: '#059669' }} /> Display & Accessibility
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div 
                onClick={() => setSettings({ ...settings, density: 'comfortable' })}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: settings.density === 'comfortable' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: settings.density === 'comfortable' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: settings.density === 'comfortable' ? '#1d4ed8' : '#334155' }}>
                  Comfortable
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Standard university spacing</div>
              </div>

              <div 
                onClick={() => setSettings({ ...settings, density: 'compact' })}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: settings.density === 'compact' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: settings.density === 'compact' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: settings.density === 'compact' ? '#1d4ed8' : '#334155' }}>
                  Compact
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>High information density</div>
              </div>
            </div>
          </div>

          {/* 3. Security Quick Link */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
              <Shield size={15} style={{ color: '#7c3aed' }} /> Account Security
            </h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>Portal Access Password</div>
                <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Update institutional login credentials</div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  if (onOpenPasswordModal) onOpenPasswordModal();
                }}
                className="btn btn-secondary btn-sm"
              >
                <Lock size={13} /> Change
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ background: '#f8fafc' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {saved ? <><Check size={16} /> Saved Preferences!</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
