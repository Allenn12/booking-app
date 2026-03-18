import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

/**
 * SegmentModal Component
 * Light theme refactor for creating/editing a segment.
 */
const SegmentModal = ({ isOpen, onClose, onSuccess, initialData = null }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'all_clients',
    rules: {}
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ name: '', description: '', type: 'all_clients', rules: {} });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (e) => {
    const type = e.target.value;
    let rules = {};
    if (type === 'lapsed') rules = { lapsed_days: 90 };
    if (type === 'new_clients') rules = { within_days: 30 };
    if (type === 'frequent') rules = { min_visits: 5 };

    setFormData({ ...formData, type, rules });
  };

  const handleRuleChange = (key, val) => {
    setFormData({
      ...formData,
      rules: { ...formData.rules, [key]: Number(val) }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.activeBusinessId) return;

    try {
      if (initialData?.id) {
         // Placeholder for update API
         toast.success("Segment ažuriran");
      } else {
         await api.createSegment(user.activeBusinessId, formData);
         toast.success("Novi segment uspješno kreiran");
      }
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Greška kod spremanja segmenta');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(4px)', padding: '16px'
    }} onClick={onClose}>
      <div className="mkt-card" style={{ width: '100%', maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="flex-between mb-6">
          <h2 className="mkt-card-title" style={{ margin: 0 }}>
            {initialData ? 'Uredi segment' : 'Novi segment klijenata'}
          </h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#667085' }}
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div>
            <label className="mkt-label">Naziv segmenta (npr. Česti posjetitelji)</label>
            <input 
              required
              className="mkt-input"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="npr. VIP klijenti"
            />
          </div>

          <div>
            <label className="mkt-label">Vrsta filtriranja</label>
            <select 
              className="mkt-input"
              value={formData.type}
              onChange={handleTypeChange}
            >
              <option value="all_clients">Svi klijenti (Bez posebnog filtra)</option>
              <option value="lapsed">Neaktivni klijenti (Koji dugo nisu bili)</option>
              <option value="new_clients">Novi klijenti (Nedavno dodani)</option>
              <option value="frequent">Česti klijenti (Velik broj posjeta)</option>
            </select>
          </div>

          {/* Dynamic Rule Inputs */}
          {formData.type === 'lapsed' && (
            <div>
              <label className="mkt-label">Broj dana od zadnje posjete</label>
              <input 
                type="number" className="mkt-input" required min="1"
                value={formData.rules.lapsed_days || ''}
                onChange={e => handleRuleChange('lapsed_days', e.target.value)}
              />
              <span className="text-muted" style={{ fontSize: '12px' }}>Klijenti koji nisu bili u salonu više od {formData.rules.lapsed_days || 0} dana.</span>
            </div>
          )}
          {formData.type === 'new_clients' && (
            <div>
              <label className="mkt-label">Broj dana od registracije</label>
              <input 
                type="number" className="mkt-input" required min="1"
                value={formData.rules.within_days || ''}
                onChange={e => handleRuleChange('within_days', e.target.value)}
              />
              <span className="text-muted" style={{ fontSize: '12px' }}>Klijenti koji su se prvi put pojavili u zadnjih {formData.rules.within_days || 0} dana.</span>
            </div>
          )}
          {formData.type === 'frequent' && (
            <div>
              <label className="mkt-label">Minimalni broj ukupnih dolazaka</label>
              <input 
                type="number" className="mkt-input" required min="1"
                value={formData.rules.min_visits || ''}
                onChange={e => handleRuleChange('min_visits', e.target.value)}
              />
              <span className="text-muted" style={{ fontSize: '12px' }}>Klijenti koji su do sada bili barem {formData.rules.min_visits || 0} puta.</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} className="mkt-btn">Odustani</button>
            <button type="submit" className="mkt-btn mkt-btn-primary">
              {initialData ? 'Spremi promjene' : 'Kreiraj segment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SegmentModal;
