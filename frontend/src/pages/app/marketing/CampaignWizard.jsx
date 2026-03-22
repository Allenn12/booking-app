import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import SegmentSelector from '../../../components/marketing/SegmentSelector';
import './Marketing.css';

/**
 * CampaignWizard Component - Refactored for Salon Owners
 */
const CampaignWizard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [prefillClient, setPrefillClient] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    segment_id: null,
    template_id: '',
    inline_message: '',
    scheduledAt: ''
  });

  const [templates, setTemplates] = useState([]);
  const [previewCount, setPreviewCount] = useState(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.activeBusinessId) {
      loadTemplates();
    }
    // Read prefill from Analytics → at-risk client flow
    const fromAnalytics = location.search.includes('source=analytics');
    if (fromAnalytics) {
      const stored = sessionStorage.getItem('prefillClient');
      if (stored) {
        try {
          const client = JSON.parse(stored);
          setPrefillClient(client);
          setFormData(fd => ({ 
            ...fd, 
            name: `Poruka za ${client.name}`,
            // Use sentinel value -1 to indicate single-client mode
            segment_id: -1,
            inline_message: `Dragi/a ${client.name.split(' ')[0]}, dugo Vas nismo vidjeli! Zakažite termin i dobijte popust na sljedeću posjetu.`
          }));
          sessionStorage.removeItem('prefillClient');
        } catch { /* ignore */ }
      }
    }
  }, [user?.activeBusinessId, location.search]);

  useEffect(() => {
    if (!user?.activeBusinessId) return;
    // When targeting a single client, skip the segment count API call
    if (formData.segment_id === -1) {
      setPreviewCount(1);
      return;
    }
    const fetchCount = async () => {
      setLoadingCount(true);
      try {
        if (formData.segment_id === null) {
           const res = await api.getBusinessClients(user.activeBusinessId, { limit: 1 });
           setPreviewCount(res.meta?.total || res.pagination?.total || 0);
        } else {
           const res = await api.previewSegment(user.activeBusinessId, formData.segment_id);
           setPreviewCount(res.count);
        }
      } catch {
        setPreviewCount('—');
      } finally {
        setLoadingCount(false);
      }
    };

    fetchCount();
  }, [formData.segment_id, user?.activeBusinessId]);

  const loadTemplates = async () => {
    try {
      const res = await api.getBusinessTemplates(user.activeBusinessId);
      // The API might return { templates: [...] } or just [...]
      const templatesArray = Array.isArray(res) ? res : (res?.templates || []);
      setTemplates(templatesArray);
    } catch {
      toast.error('Greška kod dohvaćanja predložaka');
      setTemplates([]);
    }
  };

  const handleCreateAndSend = async (action) => {
    if (!formData.name.trim()) return toast.error('Kampanja mora imati naziv');
    if (!formData.inline_message.trim() && !formData.template_id) return toast.error('Unesite poruku ili odaberite predložak');
    
    setIsSubmitting(true);
    try {
      const isSingleClient = formData.segment_id === -1 && prefillClient;
      const createRes = await api.createCampaign(user.activeBusinessId, {
        name: formData.name,
        channel: 'sms',
        segment_id: isSingleClient ? null : formData.segment_id,
        client_id: isSingleClient ? prefillClient.id : undefined,
        template_id: formData.template_id || null,
        inline_message: formData.inline_message || null
      });

      const campaignId = createRes.insertId || createRes.id;

      if (action === 'send') {
        await api.sendCampaign(user.activeBusinessId, campaignId);
        toast.success('Kampanja pokrenuta!');
        navigate(`/marketing/campaigns/${campaignId}`);
      } else if (action === 'schedule') {
        if (!formData.scheduledAt) throw new Error('Unesite vrijeme slanja');
        await api.scheduleCampaign(user.activeBusinessId, campaignId, formData.scheduledAt);
        toast.success('Kampanja uspješno zakazana');
        navigate(`/marketing/campaigns/${campaignId}`);
      } else {
        toast.success('Nacrt spremljen');
        navigate(`/marketing/campaigns/${campaignId}`);
      }
    } catch (err) {
      const errorMsg = err?.message || 'Došlo je do greške prilikom obrade';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mkt-container" style={{ maxWidth: '800px' }}>
      <div className="mkt-header">
        <div className="mkt-title-group">
          <h1 className="mkt-title">Nova kampanja</h1>
          <p className="mkt-subtitle">Pošaljite masovnu poruku svojim klijentima u par jednostavnih koraka.</p>
        </div>
      </div>

      {/* Analytics → at-risk client banner */}
      {prefillClient && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={{ fontSize: 14, color: '#92400e' }}>
            Kreiranje kampanje za klijenta <strong>{prefillClient.name}</strong> ({prefillClient.phone}) iz Analitike. 
            Poruka je predpopunjena — uredite je po potrebi.
          </span>
          <button onClick={() => setPrefillClient(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}
      <div style={{ paddingBottom: '100px' }}>
        
        {/* STEP 1: OSNOVNO */}
        <div className="mkt-card">
          <h2 className="mkt-card-title">1. Osnovne informacije</h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label className="mkt-label">Naziv kampanje (interni naziv)</label>
              <input 
                className="mkt-input" 
                placeholder="npr. Akcija za Dan žena"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="mkt-label">Kome šaljemo? (Ciljna grupa)</label>
              {prefillClient && formData.segment_id === -1 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px',
                  background: '#f0fdf4', border: '1px solid #bbf7d0'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#16a34a', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 14, flexShrink: 0
                  }}>
                    {prefillClient.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#14532d' }}>{prefillClient.name}</div>
                    <div style={{ fontSize: 12, color: '#16a34a' }}>{prefillClient.phone}</div>
                  </div>
                  <button
                    onClick={() => { setPrefillClient(null); setFormData(fd => ({ ...fd, segment_id: null })); }}
                    title="Promijeni primatelja"
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontSize: 18 }}
                  >×</button>
                </div>
              ) : (
                <SegmentSelector 
                  value={formData.segment_id} 
                  onChange={val => setFormData({...formData, segment_id: val})} 
                />
              )}
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#039855', fontWeight: '500' }}>
                {formData.segment_id === -1
                  ? 'Doseg: 1 klijent'
                  : loadingCount ? 'Računam broj primatelja...' : `Doseg: ~${previewCount} klijenata`
                }
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: PORUKA */}
        <div className="mkt-card">
          <h2 className="mkt-card-title">2. Sadržaj poruke (SMS)</h2>
          <div style={{ display: 'grid', gap: '20px' }}>
             <div>
              <label className="mkt-label">Odaberi predložak (opcionalno)</label>
              <select 
                className="mkt-input"
                value={formData.template_id}
                onChange={e => setFormData({...formData, template_id: e.target.value, inline_message: ''})}
              >
                <option value="">-- Bez predloška (upišite vlastiti tekst) --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name || t.type}</option>
                ))}
              </select>
            </div>

            {!formData.template_id && (
              <div>
                <label className="mkt-label">Tekst poruke</label>
                <textarea 
                  className="mkt-input"
                  style={{ minHeight: '120px' }}
                  placeholder="Upišite sadržaj poruke. Primjer: Dragi {{clientName}}, posjetite nas..."
                  value={formData.inline_message}
                  onChange={e => setFormData({...formData, inline_message: e.target.value})}
                ></textarea>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <span className="text-muted">
                    Znakova: {formData.inline_message.length} / 160 ({Math.ceil(Math.max(1, formData.inline_message.length)/160)} kredita po klijentu)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: VRIJEME */}
        <div className="mkt-card">
          <h2 className="mkt-card-title">3. Vrijeme slanja</h2>
          <div>
            <label className="mkt-label">Zakažite slanje (ostavite prazno za odmah)</label>
            <input 
              type="datetime-local" 
              className="mkt-input" 
              style={{ maxWidth: '300px' }}
              value={formData.scheduledAt}
              onChange={e => setFormData({...formData, scheduledAt: e.target.value})}
            />
          </div>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        backgroundColor: '#fff', borderTop: '1px solid #eaecf0',
        padding: '16px 32px', display: 'flex', justifyContent: 'flex-end',
        gap: '12px', zIndex: 100
      }}>
        <button 
          className="mkt-btn" 
          onClick={() => navigate('/marketing/campaigns')}
          disabled={isSubmitting}
        >
          Odustani
        </button>
        <button 
          className="mkt-btn" 
          style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
          onClick={() => handleCreateAndSend('draft')}
          disabled={isSubmitting}
        >
          Spremi kao nacrt
        </button>
        <button 
          className="mkt-btn mkt-btn-primary" 
          onClick={() => handleCreateAndSend(formData.scheduledAt ? 'schedule' : 'send')}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Slanje...' : (formData.scheduledAt ? 'Zakaži kampanju' : 'Pošalji odmah')}
        </button>
      </div>

    </div>
  );
};

export default CampaignWizard;
