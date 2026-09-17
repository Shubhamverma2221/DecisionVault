/**
 * ==========================================================================
 * DecisionVault Frontend API Client & Utility Functions
 * ==========================================================================
 * Centralized, asynchronous HTTP bridge connecting Vanilla JS DOM logic
 * to the Express REST API endpoints.
 */

const API_BASE_URL = '/api';

/**
 * Core HTTP client using native Fetch API.
 * Automatically serializes JSON payloads, manages HTTP headers, and normalizes error envelopes.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, config);
    const json = await response.json();

    // Check for HTTP error status codes (4xx, 5xx)
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

  // 2. Fetch decisions with dynamic query parameters
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

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(`/decisions${queryString}`);
  },

  // 3. Fetch aggregate metrics and calibration gap
  async getDecisionStats() {
    return request('/decisions/stats');
  },

  // 4. Fetch single decision details by ID
  async getDecisionById(id) {
    return request(`/decisions/${id}`);
  },

  // 5. Create new decision
  async createDecision(decisionData) {
    return request('/decisions', {
      method: 'POST',
      body: JSON.stringify(decisionData)
    });
  },

  // 6. Update unreviewed decision
  async updateDecision(id, updateData) {
    return request(`/decisions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  // 7. Delete decision
  async deleteDecision(id) {
    return request(`/decisions/${id}`, {
      method: 'DELETE'
    });
  },

  // 8. Submit retrospective review
  async reviewDecision(id, reviewData) {
    return request(`/decisions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  }
};

/**
 * Renders an animated toast notification in the DOM
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
    <span>${type === 'success' ? '✓' : '⚠'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Formats an ISO timestamp into a human-readable date string (e.g. "Oct 17, 2026")
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculates humanized remaining days or overdue status
 */
function getDaysRemaining(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diffMs = target - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days overdue`;
  } else if (diffDays === 0) {
    return 'Review due today';
  } else if (diffDays === 1) {
    return '1 day remaining';
  }
  return `${diffDays} days remaining`;
}

// Attach utilities to window object for global availability across browser scripts
window.API = API;
window.showToast = showToast;
window.formatDate = formatDate;
window.getDaysRemaining = getDaysRemaining;
