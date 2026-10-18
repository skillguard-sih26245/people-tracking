import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, BarChart2, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function AccuracyModal({ isOpen, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      api.getAccuracyReport().then((data) => {
        setReport(data);
        setLoading(false);
      }).catch(err => {
        console.error('Failed to load accuracy report:', err);
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
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
              <Target size={24} color="#00f2fe" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                False Positive / False Negative Accuracy Assessment
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Evaluation report on sample demonstration footage against ground truth annotations
              </p>
            </div>
          </div>

          {loading || !report ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading evaluation metrics...</div>
          ) : (
            <div style={{ marginTop: '24px' }}>
              
              {/* Top Overall Score Card */}
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.1), rgba(79, 172, 254, 0.1))',
                border: '1px solid rgba(0, 242, 254, 0.3)', borderRadius: '16px', padding: '20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#00f2fe', textTransform: 'uppercase', fontWeight: 700 }}>Overall Pipeline Accuracy</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', marginTop: '2px' }}>
                    {(report.overall_system_accuracy * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                    Evaluated across person detection (attendance) & equipment detection (infrastructure).
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-normal" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                    <CheckCircle2 size={16} /> Verified Model Performance
                  </span>
                </div>
              </div>

              {/* Attendance Model Performance Grid */}
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} color="#34d399" /> Trainee Attendance Analytics Performance
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Precision</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>
                    {(report.attendance_model_performance.precision * 100).toFixed(0)}%
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Recall</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#00f2fe' }}>
                    {(report.attendance_model_performance.recall * 100).toFixed(0)}%
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>False Positive Rate</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fb7185' }}>
                    {(report.attendance_model_performance.false_positive_rate * 100).toFixed(1)}%
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>False Negative Rate</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>
                    {(report.attendance_model_performance.false_negative_rate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Confusion Matrix Visualization */}
              <div style={{ background: 'rgba(15, 21, 35, 0.7)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px' }}>Confusion Matrix (Demonstration Dataset)</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>TRUE POSITIVES (TP)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                      {report.attendance_model_performance.true_positives} samples
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Accurate count within ±1 tolerance</div>
                  </div>

                  <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#fb7185', fontWeight: 700 }}>FALSE POSITIVES (FP)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                      {report.attendance_model_performance.false_positives} samples
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Over-counting (spurious detections)</div>
                  </div>

                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700 }}>FALSE NEGATIVES (FN)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                      {report.attendance_model_performance.false_negatives} samples
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Under-counting due to desk occlusion</div>
                  </div>

                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700 }}>F1-SCORE</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                      {report.attendance_model_performance.f1_score}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Harmonic mean of precision & recall</div>
                  </div>
                </div>
              </div>

              {/* Explanatory Notes */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>Optimization Insights:</div>
                <ul style={{ paddingLeft: '20px', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {report.notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>

            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
