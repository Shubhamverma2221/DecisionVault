/**
 * ==========================================================================
 * DecisionVault Frontend API Client & Auth Bridge
 * ==========================================================================
 * Centralized HTTP service utilizing native Fetch API.
 * Automatically injects Bearer JWT authentication tokens and handles error envelopes.
 */

const API_BASE_URL = '/api';

/**
 * Storage helpers for authentication token and user session
 */
const AuthToken = {
  get() {
    return localStorage.getItem('dv_token');
  },
  set(token) {
    localStorage.setItem('dv_token', token);
  },
  remove() {
    localStorage.removeItem('dv_token');
    localStorage.removeItem('dv_user');
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('dv_user') || 'null');
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('dv_user', JSON.stringify(user));
  }
};

/**
 * Core HTTP client using native Fetch API.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const token = AuthToken.get();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, config);

    // If unauthorized, redirect to login unless already on auth pages
    if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/guest')) {
      AuthToken.remove();
      if (!window.location.pathname.includes('/login.html') && !window.location.pathname.includes('/register.html')) {
        window.location.href = '/login.html';
      }
    }

    // Handle CSV or text exports
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      return response.blob();
    }

    const json = await response.json();

    if (!response.ok) {
      const errorMessage = json.error || `HTTP Error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return json;
  } catch (error) {
    console.error(`[API Client Error] ${config.method || 'GET'} ${url}:`, error.message);
    throw error;
  }
}

/**
 * Centralized API Service Object
 */
const API = {
  // 1. Health Check
  async getHealth() {
    return request('/health');
  },

  // 2. Auth Endpoints
  async register(name, email, password, confirmPassword) {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirmPassword })
    });
    if (res.token) {
      AuthToken.set(res.token);
      AuthToken.setUser(res.user);
    }
    return res;
  },

  async login(email, password) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) {
      AuthToken.set(res.token);
      AuthToken.setUser(res.user);
    }
    return res;
  },

  async guestLogin() {
    const res = await request('/auth/guest', {
      method: 'POST'
    });
    if (res.token) {
      AuthToken.set(res.token);
      AuthToken.setUser(res.user);
    }
    return res;
  },

  async googleAuth(payload) {
    const res = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.token) {
      AuthToken.set(res.token);
      AuthToken.setUser(res.user);
    }
    return res;
  },

  async getMe() {
    const res = await request('/auth/me');
    if (res.user) {
      AuthToken.setUser(res.user);
    }
    return res;
  },

  async convertGuest(name, email, password, confirmPassword) {
    const res = await request('/auth/convert-guest', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirmPassword })
    });
    if (res.token) {
      AuthToken.set(res.token);
      AuthToken.setUser(res.user);
    }
    return res;
  },

  logout() {
    AuthToken.remove();
    window.location.href = '/login.html';
  },

  // 3. Decision Endpoints
  async getDecisions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'All') {
      params.append('category', filters.category);
    }
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.sort) {
      params.append('sort', filters.sort);
    }
    if (filters.favorite) {
      params.append('favorite', 'true');
    }
    if (filters.archived) {
      params.append('archived', 'true');
    }
    if (filters.tag) {
      params.append('tag', filters.tag);
    }
    if (filters.outcome) {
      params.append('outcome', filters.outcome);
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(`/decisions${queryString}`);
  },

  async getDecisionById(id) {
    return request(`/decisions/${id}`);
  },

  async createDecision(decisionData) {
    return request('/decisions', {
      method: 'POST',
      body: JSON.stringify(decisionData)
    });
  },

  async updateDecision(id, updateData) {
    return request(`/decisions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  async deleteDecision(id) {
    return request(`/decisions/${id}`, {
      method: 'DELETE'
    });
  },

  async toggleFavorite(id) {
    return request(`/decisions/${id}/favorite`, {
      method: 'PATCH'
    });
  },

  async toggleArchive(id) {
    return request(`/decisions/${id}/archive`, {
      method: 'PATCH'
    });
  },

  async reviewDecision(id, reviewData) {
    return request(`/decisions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },

  async getLessons(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'All') {
      params.append('category', filters.category);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/decisions/lessons${qs}`);
  },

  async getCalendarEvents() {
    return request('/decisions/calendar');
  },

  async exportDecisions(format = 'json') {
    if (format === 'csv') {
      const blob = await request('/decisions/export?format=csv');
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `decisionvault_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { success: true };
    }
    return request('/decisions/export?format=json');
  },

  // 4. Analytics Endpoints
  async getOverviewStats() {
    return request('/analytics/overview');
  },

  async getConfidenceStats() {
    return request('/analytics/confidence');
  }
};

/**
 * Universal Toast Notification Function
 */
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-weight: 700; color: ${type === 'success' ? 'var(--outcome-achieved)' : 'var(--outcome-failed)'};">${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Date Formatter Utility
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Calculate human-readable days remaining or overdue
 */
function getDaysRemaining(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const target = new Date(dateString);
  const diffTime = target - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays > 1) return `${diffDays} days remaining`;
  if (diffDays === -1) return '1 day overdue';
  return `${Math.abs(diffDays)} days overdue`;
}
