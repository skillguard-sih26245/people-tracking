import React from 'react';
import { ShieldCheck, Server, Play, Upload, Activity, Database, Lock, Target } from 'lucide-react';

export default function Header({ centres, onRunAll, onOpenAdmin, onOpenAccuracy, onOpenPrivacy, isRunning }) {
  const totalCentres = centres.length;
  const totalAlerts = centres.reduce((acc, c) => acc + (c.alert_count || 0), 0);
  const criticalCount = centres.filter(c => c.risk_level === 'critical').length;
  
  const avgInfraScore = totalCentres > 0
    ? (centres.reduce((acc, c) => acc + (c.infra_compliance_score || 0), 0) / totalCentres * 100).toFixed(0)
    : 100;

  return (
    <header className="glass-panel" style={{ padding: '24px 32px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        
        {/* Title & Live Status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ 
              width: '42px', height: '42px', borderRadius: '12px', 
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0,242,254,0.4)'
            }}>
              <ShieldCheck size={24} color="#040914" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Skilling Scheme Video Analytics
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                AI Trainee Attendance & Sanctioned Infrastructure Compliance Monitoring Engine
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          <button className="btn-secondary" onClick={onOpenAccuracy}>
            <Target size={16} color="#00f2fe" /> Accuracy Metrics
          </button>

          <button className="btn-secondary" onClick={onOpenPrivacy}>
            <Lock size={16} color="#34d399" /> Privacy Note
          </button>

          <button className="btn-secondary" onClick={onOpenAdmin}>
            <Upload size={16} /> Admin & Logs
          </button>

          <button className="btn-primary" onClick={onRunAll} disabled={isRunning}>
            <Play size={16} /> {isRunning ? 'Running Analysis...' : 'Run All Simulations'}
          </button>
        </div>
      </div>

      {/* Global Metrics Bar */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginTop: '24px', 
        paddingTop: '20px', 
        borderTop: '1px solid rgba(255,255,255,0.06)' 
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Server size={20} color="#00f2fe" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Empaneled Centres</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>{totalCentres} Monitored</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
            <Activity size={20} color="#fb7185" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Compliance Discrepancies</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: criticalCount > 0 ? '#fb7185' : '#f8fafc' }}>
              {totalAlerts} ({criticalCount} Critical)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Database size={20} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Avg Infra Score</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>{avgInfraScore}%</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <Lock size={20} color="#c084fc" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Edge Bandwidth Savings</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c084fc' }}>99.9% (0.25 MB/h)</div>
          </div>
        </div>

      </div>
    </header>
  );
}
