const API_URL = 'http://localhost:3000/api/v1';

// Fetch wrapper sa credentials (cookies)
async function apiRequest(endpoint, options = {}) {
  console.log('🔵 API Request:', API_URL+endpoint);

  const config = {
    ...options,
    credentials: 'include', // ⭐ Šalje session cookie!
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  console.log('📤 Config:', config)

  const response = await fetch(`${API_URL}${endpoint}`, config);
  console.log('📥 Response Status:', response.status); // ⭐ DEBUG LOG
  console.log('📥 Response Headers:', response.headers); // ⭐ DEBUG LOG

  const data = await response.json();

  console.log('✅ Response Data:', data); // ⭐ DEBUG LOG

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.code = data.code;   // ⭐ Proslijedi code!
    error.status = response.status;
    throw error;  
  }


  return data;
}

// API methods
export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),

  register: (userData) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),
  
  checkVerification: () => apiRequest('/auth/check-verification'),
  
  resendVerification: () => apiRequest('/auth/resend-verification', {
    method: 'POST'
  }),

  checkSession: () => apiRequest('/auth/check-session'),
  
  
  getCountries: () => apiRequest('/countries'),
  
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  
  // Business
  getMyBusinesses: () => apiRequest('/business/my'),
  
  getBusinessById: (id) => apiRequest(`/business/${id}`),
  
  createBusiness: (businessData) => apiRequest('/business', {
    method: 'POST',
    body: JSON.stringify(businessData)
  }),
  
  updateBusiness: (id, businessData) => apiRequest(`/business/${id}`, {
    method: 'PUT',
    body: JSON.stringify(businessData)
  }),
  
  getBusinessTeam: (id) => apiRequest(`/business/${id}/team`),

  selectBusiness: (businessId) => apiRequest('/business/select', {
    method: 'POST',
    body: JSON.stringify({ businessId })
  }),

  // Invitations
  validateInvite: (code) => apiRequest('/invitations/validate', {
    method: 'POST',
    body: JSON.stringify({ code })
  }),

  joinBusiness: (token) => apiRequest('/invitations/join', {
    method: 'POST',
    body: JSON.stringify({ token })
  }),

  regenerateInviteCode: (businessId) => apiRequest('/invitations/regenerate', {
    method: 'POST',
    body: JSON.stringify({ businessId })
  }),

  requestCode: (businessCode) => apiRequest('/invitations/request-code', {
    method: 'POST',
    body: JSON.stringify({ businessCode })
  }),

  // Appointments
  getAppointments: (date) => apiRequest(`/appointments${date ? `?date=${date}` : ''}`),
  
  getAppointmentById: (id) => apiRequest(`/appointments/${id}`),
  
  createAppointment: (data) => apiRequest('/appointments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  updateAppointment: (id, data) => apiRequest(`/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  deleteAppointment: (id) => apiRequest(`/appointments/${id}`, {
    method: 'DELETE'
  }),
};

export default api;
