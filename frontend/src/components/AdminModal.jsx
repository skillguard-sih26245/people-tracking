import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Cpu } from 'lucide-react';
import { api } from '../api';

export default function AdminModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  if (!isOpen) return null;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const res = await api.uploadAttendanceCsv(file);
      setMessage({ type: 'success', text: res.message || 'Reported attendance CSV successfully processed!' });
      onUploadSuccess();
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to upload CSV file. Please check file format.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(16px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px'
      }}>
        <motion.div 
          className="glass-panel"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          style={{ width: '100%', maxWidth: '640px', padding: '32px', position: 'relative' }}
        >
          <button 
            onClick={onClose}
            style={{
              position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Admin Control & Edge Deployment
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '24px' }}>
            Upload reported attendance CSV logs & review bandwidth optimization metrics.
          </p>

          {/* CSV Upload Form */}
          <form onSubmit={handleUpload} style={{ marginBottom: '28px' }}>
            <div style={{
              border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '14px', padding: '28px',
              textAlign: 'center', background: 'rgba(255,255,255,0.02)', cursor: 'pointer',
              marginBottom: '16px'
            }}>
              <Upload size={32} color="#00f2fe" style={{ margin: '0 auto 12px' }} />
              <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem' }}>
                {file ? file.name : 'Select or drop reported_attendance.csv'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>
                CSV format: centre_id, session_start, session_end, reported_count
              </div>
              <input 
                type="file" 
                accept=".csv" 
                onChange={(e) => setFile(e.target.files[0])}
                style={{ marginTop: '14px', color: '#94a3b8', fontSize: '0.8rem' }}
              />
            </div>

            {message && (
              <div style={{ 
                padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '16px',
                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: message.type === 'success' ? '#34d399' : '#fb7185',
                border: message.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)'
              }}>
                {message.text}
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!file || uploading}>
              {uploading ? 'Processing CSV...' : 'Upload & Sync Attendance Logs'}
            </button>
          </form>

          {/* Edge Bandwidth & Privacy Assurance Box */}
          <div style={{ background: 'rgba(15, 21, 35, 0.7)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} color="#a855f7" /> Low-Bandwidth Edge Architecture Story
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ color: '#fb7185', fontWeight: 700 }}>Raw Video Streaming</div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>~450 MB / hour / camera</div>
              </div>
              <div style={{ background: 'rgba(0, 242, 254, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                <div style={{ color: '#00f2fe', fontWeight: 700 }}>Edge Sink Metadata</div>
                <div style={{ color: '#e2e8f0', fontSize: '0.75rem', marginTop: '2px' }}>~0.25 MB / hour metadata</div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
