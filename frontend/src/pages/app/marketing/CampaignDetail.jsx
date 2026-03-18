import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StatusBadge from '../../../components/marketing/StatusBadge';
import './Marketing.css';

const CampaignDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (user?.activeBusinessId && id) {
      loadDetails();
    }
  }, [user?.activeBusinessId, id]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const campRes = await api.getCampaignById(user.activeBusinessId, id);
      setCampaign(campRes);
      
      const recRes = await api.getCampaignRecipients(user.activeBusinessId, id, 1);
      const recipientsArray = recRes.recipients || (Array.isArray(recRes) ? recRes : []);
      setRecipients(recipientsArray);
    } catch {
      toast.error('Došlo je do greške kod učitavanja podataka');
    } finally {
      setLoading(false);
    }
  };

  const cancelCampaign = async () => {
    if (!window.confirm('Želite li prekinuti slanje ove kampanje?')) return;
    try {
      setIsProcessing(true);
      await api.cancelCampaign(user.activeBusinessId, id);
      toast.success('Kampanja zaustavljena');
      loadDetails();
    } catch {
      toast.error('Zaustavljanje nije uspjelo');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendCampaignLive = async () => {
    if (!window.confirm('Želite li odmah pokrenuti slanje ove kampanje svim primateljima?')) return;
    try {
      setIsProcessing(true);
      await api.sendCampaign(user.activeBusinessId, id);
      toast.success('Slanje kampanje je pokrenuto!');
      loadDetails();
    } catch {
      toast.error('Pokretanje kampanje nije uspjelo');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteCampaign = async () => {
    if (!window.confirm('Želite li obrisati ovaj nacrt kampanje?')) return;
    try {
      setIsProcessing(true);
      await api.deleteCampaign(user.activeBusinessId, id);
      toast.success('Nacrt obrisan');
      navigate('/marketing/campaigns');
    } catch {
      toast.error('Brisanje nije uspjelo');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="mkt-container">
        <div className="mkt-spinner-container">
          <div className="mkt-spinner"></div>
          <p className="text-muted">Učitavanje detalja kampanje...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mkt-container">
        <div className="mkt-empty-state">
          <div className="mkt-empty-icon">📂</div>
          <h2 className="mkt-empty-title">Kampanja nije pronađena</h2>
          <p className="mkt-empty-subtitle">Pokušajte ponovno ili se vratite na popis kampanja.</p>
          <button className="mkt-btn mt-4" onClick={() => navigate('/marketing/campaigns')}>
            Povratak na listu
          </button>
        </div>
      </div>
    );
  }

  const progress = campaign.total_recipients > 0 
    ? ((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100 
    : 0;

  return (
    <div className="mkt-container">
      <div className="mkt-header">
         <div className="mkt-title-group">
          <h1 className="mkt-title">{campaign.name}</h1>
          <p className="mkt-subtitle">Detalji slanja i statistika kampanje.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="mkt-btn" onClick={() => navigate('/marketing/campaigns')}>
             Nazad
          </button>
          
          {campaign.status === 'draft' && (
            <>
              <button 
                className="mkt-btn" 
                style={{ color: '#d92d20', borderColor: '#fca5a5' }} 
                onClick={deleteCampaign}
                disabled={isProcessing}
              >
                Obriši nacrt
              </button>
              <button 
                className="mkt-btn mkt-btn-primary" 
                onClick={sendCampaignLive}
                disabled={isProcessing}
              >
                {isProcessing ? 'Slanje...' : 'Pokreni kampanju'}
              </button>
            </>
          )}

          {(campaign.status === 'scheduled' || campaign.status === 'running') && (
            <button 
              className="mkt-btn" 
              style={{ color: '#d92d20', borderColor: '#fca5a5' }} 
              onClick={cancelCampaign}
              disabled={isProcessing}
            >
               {isProcessing ? 'Zaustavljanje...' : 'Zaustavi slanje'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="mkt-card">
          <h2 className="mkt-card-title">Status kampanje</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div><StatusBadge status={campaign.status} /></div>
            <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <strong>Kreirano:</strong> {new Date(campaign.created_at).toLocaleString('hr-HR')}<br/>
              <strong>Započeto:</strong> {campaign.started_at ? new Date(campaign.started_at).toLocaleString('hr-HR') : '—'}<br/>
              <strong>Završeno:</strong> {campaign.completed_at ? new Date(campaign.completed_at).toLocaleString('hr-HR') : '—'}
            </div>
          </div>
        </div>

        <div className="mkt-card" style={{ gridColumn: 'span 2' }}>
          <h2 className="mkt-card-title">Napredak dostave</h2>
          <div style={{ marginTop: '24px' }}>
            {/* Progress bar */}
            <div style={{ 
              width: '100%', backgroundColor: '#f2f4f7', height: '12px', 
              borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' 
            }}>
              <div 
                style={{ 
                  backgroundColor: '#039855', height: '100%', 
                  width: `${progress}%`, transition: 'width 1s ease-in-out' 
                }}
              ></div>
            </div>
            
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '12px', fontSize: '13px', fontWeight: '500' 
            }}>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ color: '#667085' }}>Uspješno</span>
                 <span style={{ color: '#039855', fontSize: '16px' }}>{campaign.sent_count}</span>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ color: '#667085' }}>Neuspjelo</span>
                 <span style={{ color: '#d92d20', fontSize: '16px' }}>{campaign.failed_count}</span>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ color: '#667085' }}>Preostalo</span>
                 <span style={{ color: '#1d2939', fontSize: '16px' }}>
                   {Math.max(0, campaign.total_recipients - campaign.sent_count - campaign.failed_count)}
                 </span>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ color: '#667085' }}>Ukupno</span>
                 <span style={{ color: '#1a1a2e', fontSize: '16px' }}>{campaign.total_recipients}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mkt-title" style={{ fontSize: '18px', marginBottom: '16px' }}>Audit slanja / Primatelji</h2>
      <div className="mkt-table-container">
         <table className="mkt-table">
          <thead>
            <tr>
              <th>Klijent</th>
              <th>Status</th>
              <th>Vrijeme slanja</th>
              <th>Napomena sustava</th>
            </tr>
          </thead>
          <tbody>
            {recipients.length === 0 ? (
              <tr>
                <td colSpan="4">
                  <div className="mkt-empty-state" style={{ padding: '40px' }}>
                    <div className="mkt-empty-icon" style={{ fontSize: '24px' }}>⏳</div>
                    <p className="mkt-empty-subtitle">
                      Još nema podataka o primateljima. Podaci će se pojaviti kada slanje započne.
                    </p>
                  </div>
                </td>
              </tr>
            ) : recipients.map(rec => (
              <tr key={rec.id}>
                <td style={{ fontWeight: '600', color: '#1a1a2e' }}>
                  {rec.client_name || `Klijent #${rec.client_id}`}
                </td>
                <td><StatusBadge status={rec.status} /></td>
                <td className="text-muted">
                  {rec.sent_at ? new Date(rec.sent_at).toLocaleString('hr-HR') : '—'}
                </td>
                <td style={{ color: '#d92d20', fontSize: '13px' }}>
                  {rec.error_message || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default CampaignDetail;
