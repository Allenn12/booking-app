import React from 'react';

/**
 * StatusBadge Component
 * Friendly Croatian labels and pill-style badges.
 */
const StatusBadge = ({ status, type = 'campaign' }) => {
  if (!status) return null;

  const s = status.toLowerCase();

  // Color Mapping
  const config = {
    // Campaigns
    draft: { label: 'Nacrt', className: 'badge-gray' },
    scheduled: { label: 'Zakazano', className: 'badge-orange' },
    running: { label: 'U tijeku', className: 'badge-blue' },
    completed: { label: 'Završeno', className: 'badge-green' },
    cancelled: { label: 'Otkazano', className: 'badge-gray' },
    failed: { label: 'Neuspjelo', className: 'badge-red' },
    
    // Automations (type: automation)
    enabled: { label: 'Aktivno', className: 'badge-green' },
    disabled: { label: 'Neaktivno', className: 'badge-gray' },
    
    // Default fallback
    default: { label: status, className: 'badge-gray' }
  };

  const item = config[s] || config.default;

  return (
    <span className={`mkt-badge ${item.className}`} style={{ textTransform: 'none' }}>
      {item.label}
    </span>
  );
};

export default StatusBadge;
