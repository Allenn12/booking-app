import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../../api/client';

/**
 * RegisterPage Component
 * 
 * PURPOSE: User registration with email verification
 * 
 * FLOW:
 * 1. User fills form (8 fields)
 * 2. Submit → POST /api/v1/auth/register
 * 3. Backend creates user + sends verification email
 * 4. Redirect → /verify-email (polling starts)
 */
function RegisterPage() {
  // ============================================
  // STATE - Form Fields
  // ============================================
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: ''
  });
  
  // ============================================
  // STATE - UI States
  // ============================================
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState([]);
  
  const navigate = useNavigate();
  
  // ============================================
  // EFFECT - Fetch Countries on Mount
  // ============================================
  
  /* useEffect(() => {

    async function fetchCountries() {
      try {
        const response = await api.getCountries();
        setCountries(response.data);
        console.log('✅ Countries loaded:', response.data.countries.length);
      } catch (err) {
        console.error('❌ Failed to load countries:', err);
        setError('Failed to load countries. Please refresh.');
      }
    }
    
    fetchCountries();
  }, []); */
  
  function handleChange(e) {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value 
    }));
    
    // Clear error when user starts typing (better UX)
    if (error) setError('');
  }
  
  // ============================================
  // HANDLER - Form Submit
  // ============================================

  async function handleSubmit(e) {
    e.preventDefault();
    
    setError('');
    setLoading(true);
    
    // Frontend validation
    if (!validateForm()) {
      setLoading(false);
      return;
    }
    
    try {
      console.log('📤 Submitting registration:', formData);
      
      const response = await api.register(formData);
      
      console.log('✅ Registration successful:', response);
      
      // Backend returns: { success: true, redirectTo: '/verify-email' }
      if (response.success && response.redirectTo) {
        navigate(response.redirectTo);
      }
      
    } catch (err) {
      console.error('❌ Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  // ============================================
  // VALIDATION
  // ============================================

  function validateForm() {
    // Check required fields
    const requiredFields = ['first_name', 'last_name', 'email', 'password', 
                           'phone_number'];
    
    for (const field of requiredFields) {
      if (!formData[field] || formData[field].trim() === '') {
        setError(`Field "${field.replace('_', ' ')}" is required`);
        return false;
      }
    }
    
    // Email validation
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }
    
    // Password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    
    // Phone number format (basic check)
    if (!/^\+?\d{10,15}$/.test(formData.phone_number.replace(/\s/g, ''))) {
      setError('Invalid phone number format (e.g., +385912345678)');
      return false;
    }
    
    return true;
  }
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <>
      <Helmet>
        <title>Register - Booking App</title>
        <meta name="description" content="Create your Booking App account" />
      </Helmet>
      
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Create Account</h1>
          <p style={styles.subtitle}>Start managing your appointments today</p>
          
          <form onSubmit={handleSubmit} style={styles.form}>
            
            {/* First Name & Last Name (Row) */}
            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label style={styles.label}>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="John"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  style={styles.input}
                  placeholder="Doe"
                />
              </div>
            </div>
            
            {/* Email */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="john@example.com"
              />
            </div>
            
            {/* Password */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                style={styles.input}
                placeholder="••••••••"
              />
              <small style={styles.hint}>Minimum 8 characters</small>
            </div>
            
            {/* Phone Number */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number *</label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="+385912345678"
              />
            </div>
             
            {/* Error Message */}
            {error && (
              <div style={styles.error}>{error}</div>
            )}
            
            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          
          <p style={styles.footer}>
            Already have an account? <Link to="/login" style={styles.link}>Login</Link>
          </p>
        </div>
      </div>
    </>
  );
}

// ============================================
// STYLES (Inline for now - later move to CSS modules)
// ============================================

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    padding: '20px'
  },
  card: {
    background: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '600px'
  },
  title: {
    marginBottom: '10px',
    textAlign: 'center',
    color: '#333'
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: '30px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  row: {
    display: 'flex',
    gap: '15px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    flex: 1
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: '14px'
  },
  input: {
    padding: '10px',
    border: '1px solid #3a3030',
    borderRadius: '4px',
    fontSize: '14px'
  },
  select: {
    padding: '10px',
    border: '1px solid #331010',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'white'
  },
  hint: {
    fontSize: '12px',
    color: '#999'
  },
  button: {
    padding: '12px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '10px'
  },
  error: {
    color: 'white',
    padding: '12px',
    background: '#dc3545',
    borderRadius: '4px',
    textAlign: 'center'
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    color: '#666'
  },
  link: {
    color: '#007bff',
    textDecoration: 'none'
  }
};

export default RegisterPage;
