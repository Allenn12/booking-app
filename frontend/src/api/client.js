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
    const error = new Error(data.error || 'API request failed');
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
  getJobs: () => apiRequest('/jobs'),
  
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  
  // Business
  getMyBusinesses: () => apiRequest('/business/my'),
  
  getBusinessById: (id) => apiRequest(`/business/${id}`),

  getBusinessBilling: (id) => apiRequest(`/business/${id}/billing`),

  getBusinessTemplates: (id) => apiRequest(`/business/${id}/templates`),

  updateBusinessTemplates: (id, templatesData) => apiRequest(`/business/${id}/templates`, {
    method: 'POST',
    body: JSON.stringify(templatesData)
  }),
  
  createBusiness: (businessData) => apiRequest('/business', {
    method: 'POST',
    body: JSON.stringify(businessData)
  }),
  
  updateBusiness: (id, businessData) => apiRequest(`/business/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(businessData)
  }),
  
  getBusinessTeam: (id) => apiRequest(`/business/${id}/team`),

  updateTeamMemberRole: (businessId, userId, role) => apiRequest(`/business/${businessId}/team/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  }),

  removeTeamMember: (businessId, userId) => apiRequest(`/business/${businessId}/team/${userId}`, {
    method: 'DELETE'
  }),

  getBusinessServices: (id) => apiRequest(`/business/${id}/services`),

  createService: (businessId, serviceData) => apiRequest(`/business/${businessId}/services`, {
    method: 'POST',
    body: JSON.stringify(serviceData)
  }),

  updateService: (businessId, serviceId, serviceData) => apiRequest(`/business/${businessId}/services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify(serviceData)
  }),

  deleteService: (businessId, serviceId) => apiRequest(`/business/${businessId}/services/${serviceId}`, {
    method: 'DELETE'
  }),

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

  // Dashboard
  getDashboardStats: (businessId) => apiRequest(`/business/${businessId}/dashboard`),

  // Appointments
  getAppointments: (date) => apiRequest(`/appointments${date ? `?date=${date}` : ''}`),
  
  getAppointmentsRange: (dateFrom, dateTo) => apiRequest(`/appointments?date_from=${dateFrom}&date_to=${dateTo}`),
  
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

  // Public Booking
  getPublicBusinessInfo: (slug) => apiRequest(`/public/book/${slug}`),

  getPublicAvailability: (slug, date, serviceId) => apiRequest(`/public/book/${slug}/availability?date=${date}&service_id=${serviceId}`),

  createPublicBooking: (slug, bookingData) => apiRequest(`/public/book/${slug}`, {
    method: 'POST',
    body: JSON.stringify(bookingData)
  }),
};

export default api;
