import React from 'react';
import { motion } from 'framer-motion';
import { Users, HardDrive, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function CentreCard({ centre, onSelect }) {
  const { id, name, region, risk_level, reported_attendance, observed_attendance, infra_compliance_score, alert_count } = centre;

  const attendanceDiff = Math.abs(reported_attendance - observed_attendance);
  const attendanceDevRatio = reported_attendance > 0 ? (attendanceDiff / reported_attendance * 100).toFixed(0) : 0;

  const getBadge = () => {
    if (risk_level === 'critical') {
      return <span className="badge badge-critical"><ShieldAlert size={14} /> Critical Risk</span>;
    }
    if (risk_level === 'warning') {
      return <span className="badge badge-warning"><AlertTriangle size={14} /> Warning</span>;
    }
    return <span className="badge badge-normal"><CheckCircle2 size={14} /> Compliant</span>;
  };

  return (
    <motion.div 
      className="glass-panel glass-card-interactive" 
      onClick={() => onSelect(centre)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
    >
      <div>
        {/* Card Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              CAM-{id.toString().padStart(2, '0')} • {region}
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>{name}</h2>
          </div>
          {getBadge()}
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '20px 0' }}>
          
          {/* Attendance metric */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
              <Users size={14} color="#00f2fe" /> Attendance (p90)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              {observed_attendance} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>/ {reported_attendance} rep</span>
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: attendanceDevRatio > 20 ? '#fb7185' : '#34d399' }}>
              {attendanceDevRatio}% deviation
            </div>
          </div>

          {/* Infra metric */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
              <HardDrive size={14} color="#a855f7" /> Infra Score
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              {(infra_compliance_score * 100).toFixed(0)}%
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${infra_compliance_score * 100}%`, 
                height: '100%', 
                background: infra_compliance_score < 0.6 ? '#f43f5e' : infra_compliance_score < 0.8 ? '#f59e0b' : '#10b981'
              }} />
            </div>
          </div>

        </div>
      </div>

      {/* Card Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          {alert_count > 0 ? `${alert_count} active alert${alert_count > 1 ? 's' : ''}` : 'No active alerts'}
        </span>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
          Inspect Audit <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}
