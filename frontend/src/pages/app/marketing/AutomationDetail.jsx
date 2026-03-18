import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StatusBadge from '../../../components/marketing/StatusBadge';
import SegmentSelector from '../../../components/marketing/SegmentSelector';
import './Marketing.css';

const AutomationDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [automation, setAutomation] = useState(null);
  const [stats, setStats] = useState({ history: [], total_sent: 0 });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Editable fields
  const [formData, setFormData] = useState({
    name: '',
    template_id: '',
    inline_message: '',
    segment_id: null,
    config: {}
  });

  useEffect(() => {
    if (user?.activeBusinessId && id) {
      loadData();
    }
  }, [user?.activeBusinessId, id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [autoRes, statRes] = await Promise.all([
        api.getAutomationById(user.activeBusinessId, id),
        api.getAutomationStats(user.activeBusinessId, id, 30)
      ]);
      
      setAutomation(autoRes);
      setStats(statRes || { history: [], total_sent: 0 });

      setFormData({
        name: autoRes.name || '',
        template_id: autoRes.template_id || '',
        inline_message: autoRes.inline_message || '',
        segment_id: autoRes.segment_id,
        config: autoRes.config || {}
      });

    } catch {
      toast.error('Došlo je do greške kod učitavanja podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = {
        name: formData.name,
        template_id: formData.template_id || null,
        inline_message: formData.inline_message,
        segment_id: formData.segment_id,
        config: formData.config
      };
      
      await api.updateAutomation(user.activeBusinessId, id, payload);
      toast.success('Promjene su uspješno spremljene');
      loadData();
    } catch {
      toast.error('Spremanje nije uspjelo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      const isEnabling = automation.status !== 'enabled';
      if (isEnabling) {
        await api.enableAutomation(user.activeBusinessId, id);
        toast.success('Automatizacija je sada aktivna');
      } else {
        await api.disableAutomation(user.activeBusinessId, id);
        toast.success('Automatizacija je isključena');
      }
      loadData();
    } catch {
      toast.error('Promjena statusa nije uspjela');
    }
  };

  const getFriendlyTypeDescription = (type) => {
    switch (type) {
      case 'post_visit': return 'Ova poruka se šalje klijentu automatski nakon završenog termina.';
      case 'lapsed_clients': return 'Ova poruka se šalje klijentima koji nisu bili kod vas duže vrijeme.';
      case 'birthday': return 'Ova poruka se šalje klijentu točno na njegov rođendan.';
      default: return 'Automatska poruka temeljena na radnjama klijenta.';
    }
  };

  if (loading) {
    return (
      <div className="mkt-container">
        <div className="mkt-spinner-container">
          <div className="mkt-spinner"></div>
          <p className="text-muted">Učitavanje postavki automatizacije...</p>
        </div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="mkt-container">
        <div className="mkt-empty-state">
          <div className="mkt-empty-icon">⚠️</div>
          <h2 className="mkt-empty-title">Postavka nije pronađena</h2>
          <p className="mkt-empty-subtitle">Kliknite ispod za povratak na popis svih automatizacija.</p>
          <button className="mkt-btn mt-4" onClick={() => navigate('/marketing/automations')}>
            Povratak na listu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mkt-container">
      <div className="mkt-header">
        <div className="mkt-title-group">
          <h1 className="mkt-title">{automation.name}</h1>
          <p className="mkt-subtitle">{getFriendlyTypeDescription(automation.type)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="mkt-btn" onClick={() => navigate('/marketing/automations')}>
             Nazad
          </button>
          <button 
            className="mkt-btn" 
            style={{ 
              borderColor: automation.status === 'enabled' ? '#fecaca' : '#d1fae5',
              color: automation.status === 'enabled' ? '#dc2626' : '#059669',
              backgroundColor: automation.status === 'enabled' ? '#fef2f2' : '#f0fdf4'
            }}
            onClick={handleToggle}
          >
             {automation.status === 'enabled' ? 'Isključi automatizaciju' : 'Aktiviraj odmah'}
          </button>
          <button className="mkt-btn mkt-btn-primary" onClick={handleSave} disabled={isSaving}>
             {isSaving ? 'Spremanje...' : 'Spremi promjene'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        
        {/* LJEVA STRANA: FORMULA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="mkt-card">
            <h2 className="mkt-card-title">Glavne postavke</h2>
            
            <div className="mb-4">
              <label className="mkt-label">Naziv (samo za vas)</label>
              <input 
                type="text" 
                className="mkt-input" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="npr. Zahvala nakon posjete"
              />
            </div>

            {automation.type === 'lapsed_clients' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="mb-4">
                <div>
                  <label className="mkt-label">Dani bez posjete</label>
                  <input 
                    type="number" className="mkt-input" 
                    value={formData.config.lapsed_days || ''}
                    onChange={e => setFormData({ ...formData, config: { ...formData.config, lapsed_days: Number(e.target.value) } })}
                  />
                  <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Nakon koliko dana šaljemo?</p>
                </div>
                <div>
                  <label className="mkt-label">Mirovanje (u danima)</label>
                  <input 
                    type="number" className="mkt-input" 
                    value={formData.config.cooldown_days || ''}
                    onChange={e => setFormData({ ...formData, config: { ...formData.config, cooldown_days: Number(e.target.value) } })}
                  />
                  <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Koliko čekati do iduće poruke klijentu?</p>
                </div>
              </div>
            )}

            {automation.type === 'post_visit' && (
              <div className="mb-4">
                <label className="mkt-label">Odgoda slanja (u satima)</label>
                <input 
                  type="number" className="mkt-input" 
                  style={{ maxWidth: '150px' }}
                  value={formData.config.delay_hours || ''}
                  onChange={e => setFormData({ ...formData, config: { ...formData.config, delay_hours: Number(e.target.value) } })}
                />
                <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                  Koliko sati nakon završetka termina poslati poruku?
                </p>
              </div>
            )}

            <div className="mb-4">
               <label className="mkt-label">Ograniči na grupu klijenta (opcionalno)</label>
               <SegmentSelector 
                  value={formData.segment_id} 
                  onChange={val => setFormData({ ...formData, segment_id: val })} 
               />
               <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                 Ako odaberete grupu, poruka će se slati samo klijentima u toj grupi.
               </p>
            </div>
          </div>

          <div className="mkt-card">
            <h2 className="mkt-card-title">Sadržaj poruke (SMS)</h2>
            <textarea 
              className="mkt-input" 
              style={{ minHeight: '150px' }}
              placeholder="npr. Bok {{clientName}}, hvala vam na posjeti. Vidimo se opet!"
              value={formData.inline_message}
              onChange={e => setFormData({ ...formData, inline_message: e.target.value })}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <span className="text-muted">
                Znakova: {formData.inline_message.length}
              </span>
            </div>
          </div>
        </div>

        {/* DESNA STRANA: STATISTIKA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="mkt-card">
            <h2 className="mkt-card-title">Statistika slanja</h2>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
               <div style={{ fontSize: '48px', fontWeight: '700', color: '#1a1a2e', lineHeight: '1' }}>
                  {stats.total_sent}
               </div>
               <div className="text-muted" style={{ paddingBottom: '8px', fontWeight: '500' }}>
                 ukupno poslanih poruka
               </div>
            </div>
            
            <div style={{ 
              marginTop: '32px', border: '1px solid #eaecf0', borderRadius: '8px', 
              padding: '16px', backgroundColor: '#f9fafb' 
            }}>
               <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: '#475467' }}>
                 AKTIVNOST U ZADNJIH 30 DANA
               </h3>
               
               {(!stats.history || stats.history.length === 0) ? (
                 <div className="mkt-empty-state" style={{ padding: '40px' }}>
                    <div className="mkt-empty-icon" style={{ fontSize: '24px' }}>📉</div>
                    <p className="mkt-empty-subtitle" style={{ fontSize: '13px' }}>
                       Još nema zabilježene aktivnosti za zadnjih 30 dana.
                    </p>
                 </div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stats.history.map((day, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                        <span style={{ minWidth: '80px', color: '#667085' }}>
                          {new Date(day.date).toLocaleDateString('hr-HR', { day: 'numeric', month: 'short' })}
                        </span>
                        <div style={{ flex: 1, height: '8px', backgroundColor: '#e4e7ec', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', backgroundColor: '#039855', 
                            width: `${Math.min((day.sent_count / (Math.max(...stats.history.map(d => d.sent_count)) || 1)) * 100, 100)}%` 
                          }}></div>
                        </div>
                        <span style={{ minWidth: '20px', fontWeight: '600', color: '#101828', textAlign: 'right' }}>
                          {day.sent_count}
                        </span>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            <div style={{ marginTop: '24px', padding: '12px', borderRadius: '8px', border: '1px solid #d1e9ff', backgroundColor: '#eff8ff' }}>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ fontSize: '18px' }}>ℹ️</div>
                  <div style={{ fontSize: '12px', color: '#175cd3', lineHeight: '1.5' }}>
                    <strong>Savjet:</strong> Automatske poruke su odličan način za zadržavanje klijenata bez dodatnog truda. Pripazite da tekst bude srdačan i osoban.
                  </div>
               </div>
            </div>
          </div>

          <div className="mkt-card" style={{ backgroundColor: '#fff' }}>
             <h2 className="mkt-card-title">Status okidača</h2>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <StatusBadge status={automation.status} />
                <span className="text-muted">
                   Zadnji put pokrenuto: {automation.last_run_at ? new Date(automation.last_run_at).toLocaleString('hr-HR') : 'Nikad'}
                </span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AutomationDetail;
