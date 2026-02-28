import { useAuth } from '../../hooks/useAuth';

function Dashboard() {
  const { logout, user } = useAuth();
  
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>🎉 Dashboard</h1>
      <p>You are logged in!</p>
      <p>User: {JSON.stringify(user)}</p>
      <button 
        onClick={logout}
        style={{
          padding: '10px 20px',
          marginTop: '20px',
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
