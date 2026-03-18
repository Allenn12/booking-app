import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'sonner';
import SegmentModal from '../../../components/marketing/SegmentModal';
import './Marketing.css';

/**
 * Segments Page - Refactored for Salon Owners
 */
const Segments = () => {
  const { user } = useAuth();
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState({});

  useEffect(() => {
    if (user?.activeBusinessId) {
      loadSegments();
    }
  }, [user?.activeBusinessId]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const res = await api.getSegments(user.activeBusinessId);
      setSegments(res || []);
      (res || []).forEach(s => fetchPreview(s.id));
    } catch {
      toast.error('Greška kod dohvaćanja segmenata');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async (id) => {
    try {
      const res = await api.previewSegment(user.activeBusinessId, id);
      setPreviewData(prev => ({ ...prev, [id]: res.count }));
    } catch {
      setPreviewData(prev => ({ ...prev, [id]: '—' }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Jeste li sigurni da želite obrisati ovaj segment? Ovu radnju nije moguće poništiti.')) return;
    try {
      await api.deleteSegment(user.activeBusinessId, id);
      toast.success('Segment uspješno obrisan');
      loadSegments();
    } catch {
      toast.error('Brisanje nije uspjelo');
    }
  };

  // Helper to localize types
  const getFriendlyType = (type) => {
    const types = {
      all: 'Svi klijenti',
      lapsed: 'Neaktivni klijenti',
      new_clients: 'Novi klijenti',
      frequent: 'Česti klijenti',
      upcoming: 'Nadolazeći termini'
    };
    return types[type.toLowerCase()] || type;
  };

  if (loading) {
    return (
      <div className="mkt-container">
        <div className="mkt-spinner-container">
          <div className="mkt-spinner"></div>
          <p className="text-muted">Učitavanje segmenata...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mkt-container">
      <div className="mkt-header">
        <div className="mkt-title-group">
          <h1 className="mkt-title">Segmenti klijenata</h1>
          <p className="mkt-subtitle">Definirajte grupe klijenata koje ćete kasnije koristiti u kampanjama.</p>
        </div>
        <button className="mkt-btn mkt-btn-primary" onClick={() => setIsModalOpen(true)}>
          + Novi segment
        </button>
      </div>

      <div className="mkt-table-container">
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Naziv segmenta</th>
              <th>Tip</th>
              <th>Procijenjeni broj</th>
              <th style={{ textAlign: 'right' }}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 ? (
              <tr>
                <td colSpan="4">
                  <div className="mkt-empty-state">
                    <div className="mkt-empty-icon">👥</div>
                    <h3 className="mkt-empty-title">Nema definiranih grupa</h3>
                    <p className="mkt-empty-subtitle">Kreirajte svoju prvu grupu klijenta klikom na gumb iznad.</p>
                  </div>
                </td>
              </tr>
            ) : segments.map(seg => (
              <tr key={seg.id}>
                <td style={{ fontWeight: '600', color: '#1a1a2e' }}>{seg.name}</td>
                <td>
                  <span className="mkt-badge badge-gray">
                    {getFriendlyType(seg.type)}
                  </span>
                </td>
                <td style={{ fontWeight: '600', color: '#039855' }}>
                  {previewData[seg.id] !== undefined ? `~${previewData[seg.id]} klijenta` : 'Računam...'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    className="mkt-btn" 
                    style={{ color: '#d92d20', border: 'none', background: 'none', padding: '4px 8px' }}
                    onClick={() => handleDelete(seg.id)}
                  >
                    Obriši
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <SegmentModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => { setIsModalOpen(false); loadSegments(); }}
        />
      )}
    </div>
  );
};

export default Segments;
