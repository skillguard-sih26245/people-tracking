import React, { useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Package, Target, Save } from 'lucide-react';
import { api } from '../api';

export default function TargetConfigBar({ onTargetsUpdated }) {
  const [people, setPeople] = useState(15);
  const [inventory, setInventory] = useState(20);
  const [updating, setUpdating] = useState(false);
  const [liveData, setLiveData] = useState(null);

  const loadTargets = useCallback(async () => {
    try {
      const data = await api.getTargets();
      if (data) {
        setPeople(data.expected_people || 15);
        setInventory(data.expected_inventory || 20);
      }
      const live = await api.getLiveTracking();
      setLiveData(live);
    } catch (err) {
      console.error('Failed loading targets:', err);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await api.updateTargets({
        expected_people: Number(people),
        expected_inventory: Number(inventory),
      });
      const updatedLive = await api.getLiveTracking();
      setLiveData(updatedLive);
      if (onTargetsUpdated) onTargetsUpdated();
    } catch (err) {
      console.error('Failed updating targets:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <motion.div 
      className="glass-panel" 
      style={{ padding: '20px 24px', marginBottom: '24px', border: '1px solid rgba(0, 242, 254, 0.25)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.1)' }}>
            <Target size={20} color="#00f2fe" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
              Target Inspection Parameters & Direct Tracking
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Specify target People Count & target Inventory Count to track live discrepancies
            </p>
          </div>
        </div>

        {liveData && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8' }}>People: </span>
              <strong style={{ color: '#00f2fe', fontSize: '0.95rem' }}>{liveData.people_tracking?.detected}</strong> / {liveData.people_tracking?.expected} target
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#94a3b8' }}>Inventory: </span>
              <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>{liveData.inventory_tracking?.detected}</strong> / {liveData.inventory_tracking?.expected} target
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
        
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 600 }}>
            <Users size={14} color="#00f2fe" /> Target People Count
          </label>
          <input 
            type="number" 
            min="0" 
            value={people} 
            onChange={(e) => setPeople(e.target.value)}
            style={{
              width: '100%', background: 'rgba(10, 13, 20, 0.8)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', borderRadius: '10px', padding: '10px 14px', fontSize: '1rem', fontWeight: 800
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 600 }}>
            <Package size={14} color="#34d399" /> Target Inventory Count
          </label>
          <input 
            type="number" 
            min="0" 
            value={inventory} 
            onChange={(e) => setInventory(e.target.value)}
            style={{
              width: '100%', background: 'rgba(10, 13, 20, 0.8)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', borderRadius: '10px', padding: '10px 14px', fontSize: '1rem', fontWeight: 800
            }}
          />
        </div>

        <div>
          <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem', minWidth: '140px', justifyContent: 'center' }} disabled={updating}>
            <Save size={16} /> {updating ? 'Updating...' : 'Set Targets'}
          </button>
        </div>

      </form>
    </motion.div>
  );
}
