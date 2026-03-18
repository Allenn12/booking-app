import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StatusBadge from '../../../components/marketing/StatusBadge';
import './Marketing.css';

/**
 * Automations Page - Light Theme Refactor
 */
const Automations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Simple modal state for creating new automation
  const [isCreating, setIsCreating] = useState(false);
  const [newAutoRef, setNewAutoRef] = useState({ name: '', type: 'post_visit' });

  useEffect(() => {
    if (user?.activeBusinessId) {
      loadAutomations();
    }
  }, [user?.activeBusinessId]);

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const res = await api.getAutomations(user.activeBusinessId);
      setAutomations(res || []);
    } catch {
      toast.error('Greška kod dohvaćanja automatizacija');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e, id, currentStatus) => {
    e.stopPropagation();
    try {
      if (currentStatus === 'enabled') {
        await api.disableAutomation(user.activeBusinessId, id);
        toast.success('Aktivacija isključena');
      } else {
        await api.enableAutomation(user.activeBusinessId, id);
        toast.success('Aktivacija uključena');
      }
      loadAutomations();
    } catch {
      toast.error('Promjena statusa nije uspjela');
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Jeste li sigurni da želite obrisati ovu automatsku poruku?')) return;
    try {
      await api.deleteAutomation(user.activeBusinessId, id);
      toast.success('Uspješno obrisano');
      loadAutomations();
    } catch {
      toast.error('Brisanje nije uspjelo');
    }
  };

  const handleCreate = async () => {
    if (!newAutoRef.name || !newAutoRef.type) return;
    try {
      const payload = {
        name: newAutoRef.name,
        type: newAutoRef.type,
        channel: 'sms',
        config: {} 
      };
      const res = await api.createAutomation(user.activeBusinessId, payload);
      toast.success('Automatizacija kreirana');
      setIsCreating(false);
      navigate(`/marketing/automations/${res.id || res.data?.id}`);
    } catch {
      toast.error('Kreiranje nije uspjelo');
    }
  };

  const getFriendlyType = (type) => {
    const types = {
      post_visit: 'Nakon posjete',
      lapsed_clients: 'Neaktivni klijenti',
      birthday: 'Rođendanska čestitka'
    };
    return types[type.toLowerCase()] || type;
  };

  if (loading) {
    return (
      <div className="mkt-container">
        <div className="mkt-spinner-container">
          <div className="mkt-spinner"></div>
          <p className="text-muted">Učitavanje automatizacija...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mkt-container relative">
      <div className="mkt-header">
        <div className="mkt-title-group">
          <h1 className="mkt-title">Automatske poruke</h1>
          <p className="mkt-subtitle">
            Sustav automatski šalje ove poruke klijentima prema zadanim pravilima.
          </p>
        </div>
        <button 
          className="mkt-btn mkt-btn-primary" 
          onClick={() => setIsCreating(true)}
        >
          + Kreiraj automatizaciju
        </button>
      </div>

      {isCreating && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setIsCreating(false)}>
          <div className="mkt-card" style={{ width: '100%', maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
             <h2 className="mkt-card-title">Nova automatska poruka</h2>
             
             <div className="mb-4">
               <label className="mkt-label">Naziv poruke</label>
               <input 
                 autoFocus
                 type="text" 
                 className="mkt-input" 
                 value={newAutoRef.name}
                 onChange={e => setNewAutoRef(prev => ({ ...prev, name: e.target.value }))}
                 placeholder="npr. Rođendanski popust"
               />
             </div>

             <div className="mb-4">
               <label className="mkt-label">Kada slati?</label>
               <select 
                 className="mkt-input" 
                 value={newAutoRef.type}
                 onChange={e => setNewAutoRef(prev => ({ ...prev, type: e.target.value }))}
               >
                 <option value="post_visit">Nakon posjete klijenta</option>
                 <option value="lapsed_clients">Kada klijent dugo nije bio</option>
                 <option value="birthday">Na klijentov rođendan</option>
               </select>
             </div>

             <div className="flex-between mt-4">
               <button className="mkt-btn" style={{ border: 'none' }} onClick={() => setIsCreating(false)}>
                 Odustani
               </button>
               <button className="mkt-btn mkt-btn-primary" onClick={handleCreate}>
                 Kreiraj i konfiguriraj
               </button>
             </div>
          </div>
        </div>
      )}

      <div className="mkt-table-container">
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Naziv poruke</th>
              <th>Tip</th>
              <th>Status</th>
              <th>Zadnje slanje</th>
              <th style={{ textAlign: 'right' }}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {automations.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="mkt-empty-state">
                    <div className="mkt-empty-icon">🤖</div>
                    <h3 className="mkt-empty-title">Nema aktivnih automatizacija</h3>
                    <p className="mkt-empty-subtitle">Neka sustav radi za vas. Kreirajte prvu automatsku poruku klikom na gumb iznad.</p>
                  </div>
                </td>
              </tr>
            ) : automations.map(auto => (
              <tr 
                key={auto.id} 
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/marketing/automations/${auto.id}`)}
              >
                <td style={{ fontWeight: '600', color: '#1a1a2e' }}>{auto.name}</td>
                <td>
                   <span className="mkt-badge badge-gray">
                     {getFriendlyType(auto.type)}
                   </span>
                </td>
                <td>
                  <StatusBadge status={auto.status} />
                </td>
                <td className="text-muted">
                  {auto.last_run_at ? new Date(auto.last_run_at).toLocaleString('hr-HR') : 'Nikad'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="mkt-btn"
                      style={{ 
                        fontSize: '12px', 
                        borderColor: auto.status === 'enabled' ? '#fecaca' : '#d1fae5',
                        color: auto.status === 'enabled' ? '#dc2626' : '#059669',
                        background: auto.status === 'enabled' ? '#fef2f2' : '#f0fdf4'
                      }}
                      onClick={(e) => handleToggle(e, auto.id, auto.status)}
                    >
                      {auto.status === 'enabled' ? 'Isključi' : 'Uključi'}
                    </button>
                    <button 
                      className="mkt-btn" 
                      style={{ color: '#d92d20', border: 'none', background: 'none' }}
                      onClick={(e) => handleDelete(e, auto.id)}
                    >
                      Obriši
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Automations;
