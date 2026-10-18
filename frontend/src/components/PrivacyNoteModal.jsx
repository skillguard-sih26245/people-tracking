import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, ShieldCheck, EyeOff, Server } from 'lucide-react';
import { api } from '../api';

export default function PrivacyNoteModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      api.getPrivacyNote().then((res) => {
        setContent(res.content || '');
        setLoading(false);
      }).catch(err => {
        console.error('Failed to load privacy note:', err);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 7, 13, 0.88)', backdropFilter: 'blur(16px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px'
      }}>
        <motion.div 
          className="glass-panel"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <Lock size={24} color="#34d399" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                Privacy-Preserving Design Note & Governance
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Non-biometric aggregate presence tracking architecture for government skilling schemes
              </p>
            </div>
          </div>

          {/* Privacy Guarantees Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', margin: '24px 0' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <EyeOff size={20} color="#fb7185" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>Zero Facial Recognition</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>No face detection or biometric embeddings extracted.</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <ShieldCheck size={20} color="#34d399" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>On-Edge Face Blurring</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>51x51 Gaussian blur applied to all person bounding boxes.</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Server size={20} color="#00f2fe" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>SHA-256 Audit Hashes</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>Cryptographic SHA-256 hash guarantees evidence integrity.</div>
            </div>
          </div>

          {/* Markdown Content Box */}
          <div style={{ background: 'rgba(15, 21, 35, 0.7)', padding: '24px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6' }}>
            {loading ? 'Loading design note...' : content}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
