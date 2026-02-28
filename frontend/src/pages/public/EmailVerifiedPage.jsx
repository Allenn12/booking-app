import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../hooks/useAuth';

/**
 * EmailVerifiedPage Component
 * 
 * PURPOSE: Success page after email verification
 * 
 * FLOW:
 * 1. User clicks verification link in email
 * 2. Backend verifies → Redirects to this page
 * 3. This page sets user as authenticated (session is set by backend)
 * 4. Auto-redirect to dashboard after 3 seconds
 */
function EmailVerifiedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    /**
     * WHY delay redirect?
     * - Give user feedback (see success message)
     * - Allow session cookie to propagate
     * - Better UX (not instant redirect)
     */
    console.log('✅ Email verified! Redirecting to dashboard in 3s...');
    
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 3000); // 3 seconds delay
    
    return () => clearTimeout(timer);
  }, [navigate]);
  
  return (
    <>
      <Helmet>
        <title>Email Verified - Booking App</title>
      </Helmet>
      
      <div style={styles.container}>
        <div style={styles.card}>
          {/* Success Icon */}
          <div style={styles.successIcon}></div>
          
          <h1 style={styles.title}>✅ Email Verified!</h1>
          <p style={styles.description}>
            Your email has been successfully verified. 
            Redirecting to dashboard...
          </p>
          
          {/* Loading Spinner */}
          <div style={styles.spinner}></div>
        </div>
      </div>
    </>
  );
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  card: {
    background: 'white',
    padding: '50px 40px',
    borderRadius: '15px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    background: '#28a745',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 25px',
    animation: 'scaleIn 0.5s ease-out',
    position: 'relative'
  },
  title: {
    color: '#333',
    marginBottom: '15px',
    fontSize: '24px'
  },
  description: {
    color: '#666',
    fontSize: '16px',
    lineHeight: '1.5',
    marginBottom: '25px'
  },
  spinner: {
    margin: '0 auto',
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

// Add animations
if (!document.getElementById('email-verified-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'email-verified-styles';
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes scaleIn {
      0% { transform: scale(0); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default EmailVerifiedPage;
