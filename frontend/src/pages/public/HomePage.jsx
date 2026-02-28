function HomePage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>🏠 Home Page</h1>
      <p>Welcome to Booking App!</p>
      <a href="/login" style={{ color: '#007bff' }}>Login</a> | 
      <a href="/register" style={{ color: '#007bff', marginLeft: '10px' }}>Register</a>
    </div>
  );
}

export default HomePage;
