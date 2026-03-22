import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StatusBadge from '../../../components/marketing/StatusBadge';
import './Marketing.css';

/**
 * Campaigns List Page - Light Theme Refactor
 */
const Campaigns = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.activeBusinessId) {
      loadCampaigns();
    }
  }, [user?.activeBusinessId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.getCampaigns(user.activeBusinessId);
      const campaignsArray = res.campaigns || (Array.isArray(res) ? res : []);
      setCampaigns(campaignsArray);
    } catch {
      toast.error('Greška kod dohvaćanja kampanja');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="mkt-container">
        <div className="mkt-spinner-container">
          <div className="mkt-spinner"></div>
          <p className="text-muted">Učitavanje kampanja...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mkt-container">
      <div className="mkt-header">
        <div className="mkt-title-group">
          <h1 className="mkt-title">Kampanje</h1>
          <p className="mkt-subtitle">
            Povijest marketinških poruka koje ste slali svojim klijentima.
          </p>
        </div>
        <button 
          className="mkt-btn mkt-btn-primary" 
          onClick={() => navigate('/marketing/campaigns/new')}
        >
          + Kreiraj novu kampanju
        </button>
      </div>

      <div className="mkt-table-container">
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Naziv kampanje</th>
              <th>Ciljna grupa</th>
              <th>Status</th>
              <th>Uspjeh / Ukupno</th>
              <th>Vrijeme</th>
              <th style={{ textAlign: 'right' }}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="mkt-empty-state">
                    <div className="mkt-empty-icon">📢</div>
                    <h3 className="mkt-empty-title">Nema pronađenih kampanja</h3>
                    <p className="mkt-empty-subtitle">Započnite svoju prvu kampanju klikom na gumb gore desno.</p>
                  </div>
                </td>
              </tr>
            ) : campaigns.map(camp => (
              <tr 
                key={camp.id} 
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/marketing/campaigns/${camp.id}`)}
              >
                <td style={{ fontWeight: '600', color: '#1a1a2e' }}>{camp.name}</td>
                <td>
                  {camp.segment_name ? (
                    <span className="mkt-badge badge-gray">{camp.segment_name}</span>
                  ) : camp.total_recipients === 1 && camp.target_client_name ? (
                    <span className="mkt-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                      👤 {camp.target_client_name}
                    </span>
                  ) : (
                    <span className="mkt-badge badge-gray">Svi klijenti</span>
                  )}
                </td>
                <td><StatusBadge status={camp.status} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#039855', fontWeight: '600' }}>{camp.sent_count}</span>
                    <span style={{ color: '#667085' }}>/</span>
                    <span style={{ color: '#1d2939', fontWeight: '600' }}>{camp.total_recipients}</span>
                    {camp.failed_count > 0 && (
                      <span style={{ color: '#d92d20', fontSize: '11px', marginLeft: '4px' }}>
                        ({camp.failed_count} neuspjelo)
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-muted">
                  {camp.scheduled_at 
                    ? new Date(camp.scheduled_at).toLocaleString('hr-HR') 
                    : new Date(camp.created_at).toLocaleString('hr-HR')}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="text-muted" style={{ fontSize: '13px', fontWeight: '500' }}>Pregledaj</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Campaigns;
