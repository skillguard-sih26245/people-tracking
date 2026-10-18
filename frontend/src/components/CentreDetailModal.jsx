import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, HardDrive, ShieldCheck, CheckCircle, Lock, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { api, evidenceUrl } from '../api';

export default function CentreDetailModal({ centre, onClose }) {
  const [activeTab, setActiveTab] = useState('attendance');
  const [summary, setSummary] = useState(null);
  const [samples, setSamples] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!centre) return;
    setLoading(true);
    setError('');
    try {
      const [sumRes, sampRes, alRes] = await Promise.all([
        api.getCentreSummary(centre.id),
        api.getCentreSamples(centre.id),
        api.getCentreAlerts(centre.id),
      ]);
      setSummary(sumRes);
      setSamples(sampRes);
      setAlerts(alRes);
    } catch (err) {
      console.error('Failed to fetch centre details:', err);
      setError(err?.response?.data?.detail || 'Centre details could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [centre]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!centre) return null;

  const chartData = samples.map((s, idx) => ({
    time: s.ts ? s.ts.split(' ')[1] : `T-${idx}`,
    persons: s.person_count,
    laptops: s.equipment_counts?.computer || 0,
  }));

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
          style={{ width: '100%', maxWidth: '960px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' }}
        >
          {/* Close Button */}
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

          {/* Modal Title Bar */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '0.8rem', color: '#00f2fe', fontWeight: 600, textTransform: 'uppercase' }}>
              CENTRE AUDIT DOSSIER • CAM-{centre.id.toString().padStart(2, '0')}
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{centre.name}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '2px' }}>{centre.region} • Automated AI Video Compliance Audit</p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
            <button 
              onClick={() => setActiveTab('attendance')}
              style={{
                padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === 'attendance' ? '#00f2fe' : '#94a3b8',
                fontWeight: activeTab === 'attendance' ? 700 : 500,
                borderBottom: activeTab === 'attendance' ? '2px solid #00f2fe' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <Users size={18} /> Attendance p90
            </button>

            <button 
              onClick={() => setActiveTab('inventory')}
              style={{
                padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === 'inventory' ? '#00f2fe' : '#94a3b8',
                fontWeight: activeTab === 'inventory' ? 700 : 500,
                borderBottom: activeTab === 'inventory' ? '2px solid #00f2fe' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <HardDrive size={18} /> Infra & Operability
            </button>

            <button 
              onClick={() => setActiveTab('evidence')}
              style={{
                padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === 'evidence' ? '#00f2fe' : '#94a3b8',
                fontWeight: activeTab === 'evidence' ? 700 : 500,
                borderBottom: activeTab === 'evidence' ? '2px solid #00f2fe' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <ShieldCheck size={18} /> Evidence & SHA-256 Audit ({alerts.length})
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Loading audit details...
            </div>
          ) : (
            <div>
              {error && <div role="alert" style={{ padding: '16px', marginBottom: '16px', borderRadius: '10px', color: '#fb7185', background: 'rgba(244, 63, 94, 0.12)' }}>{error}</div>}
              {/* TAB 1: ATTENDANCE */}
              {activeTab === 'attendance' && summary && (
                <div>
                  {/* Summary Stat Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Reported Attendance</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{summary.reported_attendance}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>From Attendance Log CSV</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Observed p90 Count</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00f2fe' }}>{summary.observed_attendance_p90}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>YOLO Person Count (p90)</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Deviation Ratio</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: summary.attendance_status === 'normal' ? '#34d399' : '#fb7185' }}>
                        {(summary.attendance_deviation_ratio * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Status: <strong style={{ textTransform: 'uppercase' }}>{summary.attendance_status}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Recharts Time Series */}
                  <div style={{ background: 'rgba(15, 21, 35, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>Session Person Count Timeline (Sampling Interval = 3s)</h4>
                      <span style={{ fontSize: '0.75rem', color: '#00f2fe', background: 'rgba(0,242,254,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                        Reference p90 line: {summary.observed_attendance_p90}
                      </span>
                    </div>

                    <div style={{ height: '240px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ background: '#121824', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            labelStyle={{ color: '#00f2fe' }}
                          />
                          <ReferenceLine y={summary.observed_attendance_p90} stroke="#00f2fe" strokeDasharray="3 3" label={{ value: 'p90', fill: '#00f2fe', fontSize: 12 }} />
                          <ReferenceLine y={summary.reported_attendance} stroke="#f43f5e" strokeDasharray="5 5" label={{ value: 'Reported', fill: '#f43f5e', fontSize: 12 }} />
                          <Line type="monotone" dataKey="persons" stroke="#38bdf8" strokeWidth={2} dot={false} name="Person Count" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INVENTORY & OPERABILITY */}
              {activeTab === 'inventory' && summary && (
                <div>
                  <div style={{ marginBottom: '16px', background: 'rgba(168, 85, 247, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.2)', fontSize: '0.82rem', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Lock size={18} color="#c084fc" />
                    <div>
                      <strong>Note on Apparent Operability (Probabilistic):</strong> Computed via bounding-box spatial proximity and motion delta factors. CCTV confirms visual presence and human interaction; mechanical function is not evaluated.
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'left' }}>
                        <th style={{ padding: '12px' }}>Equipment Class</th>
                        <th style={{ padding: '12px' }}>Required Inventory</th>
                        <th style={{ padding: '12px' }}>Observed (p90)</th>
                        <th style={{ padding: '12px' }}>Missing Count</th>
                        <th style={{ padding: '12px' }}>Apparent Operability</th>
                        <th style={{ padding: '12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.inventory.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '14px 12px', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>{item.class}</td>
                          <td style={{ padding: '14px 12px', color: '#94a3b8' }}>{item.required}</td>
                          <td style={{ padding: '14px 12px', fontWeight: 700, color: '#00f2fe' }}>{item.observed_p90}</td>
                          <td style={{ padding: '14px 12px', color: item.missing > 0 ? '#fb7185' : '#34d399', fontWeight: 700 }}>
                            {item.missing > 0 ? `-${item.missing}` : '0'}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: item.apparent_operability < 0.5 ? '#f59e0b' : '#34d399' }}>
                                {(item.apparent_operability * 100).toFixed(0)}%
                              </span>
                              <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${item.apparent_operability * 100}%`, height: '100%', background: item.apparent_operability < 0.5 ? '#f59e0b' : '#34d399' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {item.missing > 0 || item.apparent_operability < 0.5 ? (
                              <span className="badge badge-warning">Shortfall</span>
                            ) : (
                              <span className="badge badge-normal">Compliant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: EVIDENCE & AUDIT */}
              {activeTab === 'evidence' && (
                <div>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      <CheckCircle size={32} color="#34d399" style={{ margin: '0 auto 12px' }} />
                      No compliance breach alerts logged for this centre.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                      {alerts.map((al, idx) => (
                        <div key={idx} style={{ background: 'rgba(15, 21, 35, 0.6)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          
                          {/* Evidence Thumbnail */}
                          {al.evidence_url ? (
                            <div style={{ position: 'relative', background: '#000' }}>
                              <img 
                                src={evidenceUrl(al.evidence_url)}
                                alt="Privacy Safe Evidence" 
                                style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{ 
                                position: 'absolute', bottom: '8px', left: '8px', right: '8px', 
                                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                                padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: '#34d399',
                                display: 'flex', alignItems: 'center', gap: '6px'
                              }}>
                                <Lock size={12} /> Privacy Blur Verified
                              </div>
                            </div>
                          ) : (
                            <div style={{ height: '140px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                              Simulated Event Proof
                            </div>
                          )}

                          {/* Alert details */}
                          <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{al.ts}</span>
                              <span className={`badge badge-${al.level}`}>{al.level}</span>
                            </div>

                            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem', textTransform: 'capitalize' }}>
                              {al.type} Violation Alert
                            </div>

                            {/* SHA-256 Stamp */}
                            {al.evidence_hash && (
                              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>SHA-256 Integrity Hash:</div>
                                <div className="mono" style={{ fontSize: '0.65rem', color: '#00f2fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {al.evidence_hash}
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
