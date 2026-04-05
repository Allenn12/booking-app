const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const logDev = (...args) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

// Fetch wrapper sa credentials (cookies)
async function apiRequest(endpoint, options = {}) {
  logDev('🔵 API Request:', API_URL+endpoint);

  const config = {
    ...options,
    credentials: 'include', // ⭐ Šalje session cookie!
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  logDev('📤 Config:', config);

  const response = await fetch(`${API_URL}${endpoint}`, config);
  logDev('📥 Response Status:', response.status); // ⭐ DEBUG LOG

  const data = await response.json();

  logDev('✅ Response Data:', data); // ⭐ DEBUG LOG

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

  // Clients
  searchClients: (businessId, query, limit = 10) =>
    apiRequest(`/business/${businessId}/clients/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  getBusinessClients: (businessId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/business/${businessId}/clients${qs ? `?${qs}` : ''}`);
  },

  getClientDetail: (businessId, clientId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/business/${businessId}/clients/${clientId}${qs ? `?${qs}` : ''}`);
  },

  updateClient: (businessId, clientId, data) =>
    apiRequest(`/business/${businessId}/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  updateClientNotes: (businessId, clientId, notes) =>
    apiRequest(`/business/${businessId}/clients/${clientId}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes })
    }),

  // Marketing
  getSegments: (businessId) => apiRequest(`/business/${businessId}/marketing/segments`),
  createSegment: (businessId, data) => apiRequest(`/business/${businessId}/marketing/segments`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteSegment: (businessId, id) => apiRequest(`/business/${businessId}/marketing/segments/${id}`, { method: 'DELETE' }),
  previewSegment: (businessId, id) => apiRequest(`/business/${businessId}/marketing/segments/${id}/preview`),

  getCampaigns: (businessId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/business/${businessId}/marketing/campaigns${qs ? `?${qs}` : ''}`);
  },
  getCampaignById: (businessId, id) => apiRequest(`/business/${businessId}/marketing/campaigns/${id}`),
  createCampaign: (businessId, data) => apiRequest(`/business/${businessId}/marketing/campaigns`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteCampaign: (businessId, id) => apiRequest(`/business/${businessId}/marketing/campaigns/${id}`, { method: 'DELETE' }),
  sendCampaign: (businessId, id) => apiRequest(`/business/${businessId}/marketing/campaigns/${id}/send`, { method: 'POST' }),
  scheduleCampaign: (businessId, id, date) => apiRequest(`/business/${businessId}/marketing/campaigns/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledAt: date })
  }),
  cancelCampaign: (businessId, id) => apiRequest(`/business/${businessId}/marketing/campaigns/${id}/cancel`, { method: 'POST' }),
  previewCampaign: (businessId, id) => apiRequest(`/business/${businessId}/marketing/campaigns/${id}/preview`),
  getCampaignRecipients: (businessId, id, page = 1) => 
    apiRequest(`/business/${businessId}/marketing/campaigns/${id}/recipients?page=${page}`),

  // ==========================================
  // MARKETING - AUTOMATIONS
  // ==========================================
  getAutomations: (businessId) =>
    apiRequest(`/business/${businessId}/marketing/automations`),
  
  createAutomation: (businessId, data) =>
    apiRequest(`/business/${businessId}/marketing/automations`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  getAutomationById: (businessId, automationId) =>
    apiRequest(`/business/${businessId}/marketing/automations/${automationId}`),
    
  updateAutomation: (businessId, automationId, data) =>
    apiRequest(`/business/${businessId}/marketing/automations/${automationId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
  deleteAutomation: (businessId, automationId) =>
    apiRequest(`/business/${businessId}/marketing/automations/${automationId}`, { method: 'DELETE' }),
    
  enableAutomation: (businessId, automationId) =>
    apiRequest(`/business/${businessId}/marketing/automations/${automationId}/enable`, { method: 'POST' }),
    
  disableAutomation: (businessId, automationId) =>
    apiRequest(`/business/${businessId}/marketing/automations/${automationId}/disable`, { method: 'POST' }),

  getAutomationStats: (businessId, automationId, days = 30) =>
    apiRequest(`/business/${businessId}/marketing/automations/${automationId}/stats?days=${days}`),

  // ==========================================
  // ANALYTICS
  // ==========================================
  getAnalyticsOverview: (businessId, period = '30d') =>
    apiRequest(`/business/${businessId}/analytics/overview?period=${period}`),

  getAnalyticsRevenue: (businessId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/business/${businessId}/analytics/revenue${qs ? `?${qs}` : ''}`);
  },

  getAnalyticsClients: (businessId, period = '30d') =>
    apiRequest(`/business/${businessId}/analytics/clients?period=${period}`),

  getAnalyticsStaff: (businessId, period = '30d') =>
    apiRequest(`/business/${businessId}/analytics/staff?period=${period}`),

  // ==========================================
  // EMPLOYEE SCHEDULING
  // ==========================================
  getSchedule: (businessId, userId) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule`),
    
  createScheduleRow: (businessId, userId, data) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  updateScheduleRow: (businessId, userId, scheduleId, data) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
  deleteScheduleRow: (businessId, userId, scheduleId) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule/${scheduleId}`, { method: 'DELETE' }),

  getExceptions: (businessId, userId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/business/${businessId}/team/${userId}/schedule/exceptions${qs ? `?${qs}` : ''}`);
  },
  
  createException: (businessId, userId, data) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule/exceptions`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  updateException: (businessId, userId, exceptionId, data) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule/exceptions/${exceptionId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
  deleteException: (businessId, userId, exceptionId) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule/exceptions/${exceptionId}`, { method: 'DELETE' }),

  getTimeOff: (businessId, userId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/business/${businessId}/team/${userId}/time-off${qs ? `?${qs}` : ''}`);
  },
  
  createTimeOff: (businessId, userId, data) => 
    apiRequest(`/business/${businessId}/team/${userId}/time-off`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  updateTimeOff: (businessId, userId, timeOffId, data) => 
    apiRequest(`/business/${businessId}/team/${userId}/time-off/${timeOffId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    
  deleteTimeOff: (businessId, userId, timeOffId) => 
    apiRequest(`/business/${businessId}/team/${userId}/time-off/${timeOffId}`, { method: 'DELETE' }),

  getScheduleOverview: (businessId, userId, from, to) => 
    apiRequest(`/business/${businessId}/team/${userId}/schedule/overview?from=${from}&to=${to}`),

  // ==========================================
  // PUBLIC BOOKING
  // ==========================================
  getPublicBusinessInfo: (slug) => 
    apiRequest(`/public/book/${slug}`),
    
  getPublicAvailability: (slug, date, serviceId) => 
    apiRequest(`/public/book/${slug}/availability?date=${date}&service_id=${serviceId}`),
    
  createPublicBooking: (slug, data) => 
    apiRequest(`/public/book/${slug}`, {
      method: 'POST', 
      body: JSON.stringify(data)
    }),

  getPublicAvailabilityRange: (slug, start, end, serviceId) => 
    apiRequest(`/public/book/${slug}/availability-range?start=${start}&end=${end}&service_id=${serviceId}`),

  // ==========================================
  // CUSTOMER PORTAL (magic link, public)
  // ==========================================

  /** Fetch portal data by token. Returns { customer, business, appointments: { upcoming, past } } */
  getPortal: (token) =>
    apiRequest(`/portal/${token}`),

  /** Cancel a specific appointment via the portal token */
  cancelPortalAppointment: (token, appointmentId) =>
    apiRequest(`/portal/${token}/cancel/${appointmentId}`, { method: 'POST' }),

  /** "Resend my link" — sends email to phone owner. Always 200. */
  lookupPortalLink: (phone) =>
    apiRequest('/portal/lookup', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
};

export default api;
