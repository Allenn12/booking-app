import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';
import { toast } from 'sonner';

function Dashboard() {
  const { logout, user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🎉 Dashboard</h1>
      <p>Welcome back, {user?.firstName || 'User'}!</p>

      <div style={{ marginTop: '30px' }}>
        <h2>Your Businesses</h2>
        {loading ? (
          <p>Loading businesses...</p>
        ) : businesses.length > 0 ? (
          <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
            {businesses.map((biz) => (
              <div key={biz.business_id} style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'left' }}>
                <h3>{biz.business_name}</h3>
                <p>Role: <strong>{biz.role.toUpperCase()}</strong></p>

                {(biz.role === 'owner' || biz.role === 'admin') && (
                  <div style={{ marginTop: '15px' }}>
                    <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                      Navigate to the <strong>Team</strong> page to manage members and invites.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>You don't have any businesses yet.</p>
        )}
      </div>

      <button
        onClick={logout}
        style={{
          padding: '10px 30px',
          marginTop: '40px',
          background: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
