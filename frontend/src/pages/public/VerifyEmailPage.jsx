import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; // ⭐ useSearchParams!
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';

function VerifyEmailPage() {

  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { checkSession } = useAuth();

  // ⭐ Čitaj URL query params
  const [searchParams] = useSearchParams();
  const verifiedViaLink = searchParams.get('verified') === 'true';

  // ============================================
  // EFFECT #1: Ako je ?verified=true u URL-u
  // ============================================
  useEffect(() => {
    /**
     * WHY: User je kliknuo link u emailu
     * Backend je verificirao i redirectao na:
     * /verify-email?verified=true
     * 
     * Detektiramo query param i odmah
     * prikazujemo success + redirect
     */
    if (!verifiedViaLink) return; // Normalni flow, idi na polling

    async function handleVerifiedViaLink() {
      console.log('✅ Verificiran putem linka, refresham session...');
      setIsVerified(true);
      await checkSession(); // Refresh React session state

      setTimeout(() => {
        navigate('/onboarding');
      }, 2000); // 2 sekunde da vidi success poruku
    }

    handleVerifiedViaLink();
  }, [verifiedViaLink]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // EFFECT #2: POLLING (samo ako NIJE verified via link)
  // ============================================
  useEffect(() => {
    if (verifiedViaLink) return; // ⭐ Ne startaj polling ako je već verified!

    let stopped = false;

    async function checkVerification() {
      if (stopped) return;

      try {
        console.log('🔍 Checking verification status...');
        const response = await api.checkVerification();

        if (response.verified && !stopped) {
          console.log('✅ Polling detektirao verifikaciju!');
          setIsVerified(true);
          await checkSession();

          setTimeout(() => {
            if (!stopped) navigate('/onboarding');
          }, 2000); // ⭐ 2 sekunde da vidi success poruku!
        }
      } catch (err) {
        if (!stopped) console.error('❌ Polling error:', err.message);
      }
    }

    checkVerification();
    const pollingInterval = setInterval(checkVerification, 3000);

    return () => {
      stopped = true;
      clearInterval(pollingInterval);
      console.log('🔴 Polling stopped');
    };
  }, [verifiedViaLink]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // EFFECT #3: COUNTDOWN
  // ============================================
  useEffect(() => {
    if (isVerified) return; // Ne trebamo countdown ako je verified
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isVerified]);

  // ============================================
  // HANDLER: Resend
  // ============================================
  async function handleResend() {
    setResendLoading(true);
    setResendMessage('');
    setError('');

    try {
      const response = await api.resendVerification();
      setResendMessage(response.message || 'New verification email sent!');
      setCountdown(30);
      setCanResend(false);
    } catch (err) {
      setError(err.message || 'Failed to resend email.');
    } finally {
      setResendLoading(false);
    }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={styles.card}>

        {/* Icon - mijenja se ovisno o stanju */}
        <div style={styles.icon}>
          {isVerified ? '✅' : '📧'}
        </div>

        {/* SUCCESS STATE */}
        {isVerified ? (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <h1 style={{ ...styles.title, color: '#28a745' }}>
              Email uspješno verificiran!
            </h1>
            <p style={styles.description}>
              Preusmjeravamo te na dashboard...
            </p>
            <div style={styles.spinner} />
          </div>

        ) : (
          /* WAITING STATE */
          <>
            <h1 style={styles.title}>Provjeri Email</h1>
            <p style={styles.description}>
              Poslali smo verifikacijski link na tvoj email.
              Klikni na link u emailu za verifikaciju.
            </p>

            {/* Waiting indicator */}
            <div style={styles.status}>
              <div style={styles.spinner} />
              <span>Čekamo potvrdu...</span>
            </div>

            {/* Resend Section */}
            <div style={styles.resendSection}>
              <p style={styles.resendText}>Nisi primio email?</p>

              <button
                onClick={handleResend}
                disabled={!canResend || resendLoading}
                style={{
                  ...styles.resendButton,
                  opacity: !canResend || resendLoading ? 0.5 : 1,
                  cursor: !canResend || resendLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {resendLoading
                  ? 'Šaljem...'
                  : canResend
                    ? 'Pošalji ponovno'
                    : `Pošalji za ${countdown}s`}
              </button>

              {resendMessage && (
                <div style={styles.successMsg}>{resendMessage}</div>
              )}
              {error && (
                <div style={styles.errorMsg}>{error}</div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px'
  },
  card: {
    background: 'white',
    padding: '50px 40px',
    borderRadius: '15px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center'
  },
  icon: {
    fontSize: '70px',
    marginBottom: '20px'
  },
  title: {
    color: '#333',
    marginBottom: '15px',
    fontSize: '26px'
  },
  description: {
    color: '#666',
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '30px'
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '8px',
    marginBottom: '20px',
    color: '#555'
  },
  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #eee',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto'
  },
  resendSection: {
    marginTop: '30px',
    paddingTop: '25px',
    borderTop: '1px solid #eee'
  },
  resendText: {
    color: '#666',
    marginBottom: '15px'
  },
  resendButton: {
    padding: '12px 30px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 'bold'
  },
  successMsg: {
    marginTop: '15px',
    padding: '10px 15px',
    background: '#d4edda',
    color: '#155724',
    borderRadius: '6px',
    fontSize: '14px'
  },
  errorMsg: {
    marginTop: '15px',
    padding: '10px 15px',
    background: '#f8d7da',
    color: '#721c24',
    borderRadius: '6px',
    fontSize: '14px'
  }
};

export default VerifyEmailPage;
