import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import SegmentModal from './SegmentModal';

/**
 * SegmentSelector Component
 * Dropdown to pick a segment, refactored for salon owners.
 */
const SegmentSelector = ({ value, onChange }) => {
  const { user } = useAuth();
  const [segments, setSegments] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (user?.activeBusinessId) loadSegments();
  }, [user?.activeBusinessId]);

  const loadSegments = async () => {
    try {
      const res = await api.getSegments(user.activeBusinessId);
      setSegments(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    if (e.target.value === 'NEW') {
      setModalOpen(true);
    } else {
      onChange(e.target.value === 'NULL' ? null : Number(e.target.value));
    }
  };

  const getFriendlyType = (type) => {
    const types = {
      all: 'Svi',
      lapsed: 'Neaktivni',
      new_clients: 'Novi',
      frequent: 'Česti',
      upcoming: 'Nadolazeći'
    };
    return types[type.toLowerCase()] || type;
  };

  return (
    <div>
      <select 
        className="mkt-input"
        value={value === null ? 'NULL' : value || ''} 
        onChange={handleChange}
      >
        <option value="" disabled>-- Odaberite grupu klijenata --</option>
        <option value="NULL">Svi klijenti (cijela baza)</option>
        {segments.map(s => (
          <option key={s.id} value={s.id}>
            {s.name} ({getFriendlyType(s.type)})
          </option>
        ))}
        <option disabled>────────────────────</option>
        <option value="NEW" style={{ fontWeight: 'bold', color: '#0d6efd' }}>+ Kreiraj novu grupu (segment)</option>
      </select>

      {isModalOpen && (
        <SegmentModal 
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); loadSegments(); }}
        />
      )}
    </div>
  );
};

export default SegmentSelector;
