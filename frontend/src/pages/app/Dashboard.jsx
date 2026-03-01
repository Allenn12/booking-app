import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';

function Dashboard() {
  const { logout, user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await api.getMyBusinesses();
        if (res.success) {
          console.log('Fetched businesses:', res.data); // DEBUG
          setBusinesses(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch businesses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, []);

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
                  <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>Invite Team Members:</p>
                    {biz.invite_token ? (
                      <>
                        <p style={{ margin: '5px 0' }}>Invite Link: <code style={{ color: '#007bff' }}>{window.location.origin.replace('5173', '3000')}/join/{biz.invite_token}</code></p>
                        <p style={{ margin: '5px 0' }}>Invite Code: <strong>{biz.invite_code}</strong></p>
                      </>
                    ) : (
                      <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>No active invitation link found for this business. Please contact support or check if invitations are enabled.</p>
                    )}
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
