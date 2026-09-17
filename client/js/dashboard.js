/**
 * ==========================================================================
 * DecisionVault Dashboard Controller
 * ==========================================================================
 * Manages DOM interaction, real-time filtering, search debouncing,
 * aggregate stats rendering, and decision card grid population.
 */

// Global Dashboard Filter State
const state = {
  category: 'All',
  status: '',
  search: '',
  sort: 'newest'
};

// DOM Element References
const elements = {
  // Stats
  statTotal: document.getElementById('stat-total'),
  statDue: document.getElementById('stat-due'),
  statPending: document.getElementById('stat-pending'),
  statSuccessRate: document.getElementById('stat-success-rate'),
  statCalibrationGap: document.getElementById('stat-calibration-gap'),
  statCalibrationSub: document.getElementById('stat-calibration-sub'),

  // Filters & Controls
  searchInput: document.getElementById('search-input'),
  statusFilter: document.getElementById('status-filter'),
  sortFilter: document.getElementById('sort-filter'),
  categoryPills: document.getElementById('category-pills'),

  // Container Elements
  decisionsGrid: document.getElementById('decisions-grid'),
  loadingSpinner: document.getElementById('loading-spinner'),
  emptyState: document.getElementById('empty-state')
};

/**
 * Fetches and populates the 5 analytics cards from GET /api/decisions/stats
 */
async function loadStats() {
  try {
    const res = await API.getDecisionStats();
    const stats = res.data;

    elements.statTotal.textContent = stats.totalDecisions;
    elements.statDue.textContent = stats.dueCount;
    elements.statPending.textContent = stats.pendingCount;
    elements.statSuccessRate.textContent = `${stats.successRate}%`;

    // Calibration Gap Interpretation
    if (stats.reviewedCount === 0) {
      elements.statCalibrationGap.textContent = 'N/A';
      elements.statCalibrationSub.textContent = 'Awaiting reviewed decisions';
    } else {
      const gap = stats.calibrationGap;
      if (gap > 5) {
        elements.statCalibrationGap.textContent = `+${gap}%`;
        elements.statCalibrationGap.className = 'stat-value gap-positive';
        elements.statCalibrationSub.textContent = 'Tendency towards overconfidence';
      } else if (gap < -5) {
        elements.statCalibrationGap.textContent = `${gap}%`;
        elements.statCalibrationGap.className = 'stat-value gap-neutral';
        elements.statCalibrationSub.textContent = 'Cautious / underestimated ability';
      } else {
        elements.statCalibrationGap.textContent = 'Well Calibrated';
        elements.statCalibrationGap.className = 'stat-value gap-neutral';
        elements.statCalibrationSub.textContent = 'Expectations match reality';
      }
    }
  } catch (error) {
    console.error('Failed to load decision statistics:', error);
    showToast('Failed to refresh statistics', 'error');
  }
}

/**
 * Fetches and renders decision cards into the grid based on active filters
 */
async function loadDecisions() {
  // Show spinner, hide grid and empty state
  elements.loadingSpinner.style.display = 'block';
  elements.decisionsGrid.innerHTML = '';
  elements.emptyState.style.display = 'none';

  try {
    const res = await API.getDecisions(state);
    const decisions = res.data;

    elements.loadingSpinner.style.display = 'none';

    if (decisions.length === 0) {
      elements.emptyState.style.display = 'block';
      return;
    }

    // Populate decision cards
    decisions.forEach((decision) => {
      const card = createDecisionCardElement(decision);
      elements.decisionsGrid.appendChild(card);
    });
  } catch (error) {
    elements.loadingSpinner.style.display = 'none';
    console.error('Failed to load decisions:', error);
    showToast('Failed to load decisions. Please try again.', 'error');
  }
}

/**
 * Constructs a single DOM decision card element
 */
function createDecisionCardElement(decision) {
  const card = document.createElement('a');
  card.href = `/decision.html?id=${decision._id}`;
  card.className = 'decision-card';
  card.id = `decision-card-${decision._id}`;

  // Resolve status badge class & label
  let statusBadgeClass = 'badge-pending';
  if (decision.status === 'Review Due') statusBadgeClass = 'badge-due';
  if (decision.status === 'Reviewed') statusBadgeClass = 'badge-reviewed';

  // Format outcome badge if already reviewed
  let outcomeBadgeHtml = '';
  if (decision.review && decision.review.result) {
    const result = decision.review.result;
    let resultClass = 'badge-achieved';
    if (result === 'Partially Achieved') resultClass = 'badge-partial';
    if (result === 'Not Achieved') resultClass = 'badge-failed';

    outcomeBadgeHtml = `<span class="badge ${resultClass}" style="margin-left: 0.5rem;">${result}</span>`;
  }

  // Calculate review timeline subtitle
  let reviewTimeText = '';
  if (decision.status === 'Reviewed') {
    reviewTimeText = `Reviewed on ${formatDate(decision.review.reviewedAt)}`;
  } else {
    reviewTimeText = getDaysRemaining(decision.reviewDate);
  }

  card.innerHTML = `
    <div>
      <div class="card-header">
        <span class="card-category">${escapeHtml(decision.category)}</span>
        <div>
          <span class="badge ${statusBadgeClass}">${escapeHtml(decision.status)}</span>
          ${outcomeBadgeHtml}
        </div>
      </div>

      <h3 class="card-title">${escapeHtml(decision.title)}</h3>
      
      <p class="card-expected">
        <strong>Expected:</strong> ${escapeHtml(decision.expectedOutcome)}
      </p>

      <div class="confidence-meter">
        <div class="meter-header">
          <span>Confidence</span>
          <span style="font-weight: 700; color: var(--accent-primary);">${decision.confidence}%</span>
        </div>
        <div class="meter-bar">
          <div class="meter-fill" style="width: ${decision.confidence}%;"></div>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <span>📅 ${reviewTimeText}</span>
      <span style="color: var(--accent-primary); font-weight: 600;">View History →</span>
    </div>
  `;

  return card;
}

/**
 * Basic HTML escaping utility to prevent XSS injection
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Attaches interactive listeners to filter and search controls
 */
function setupEventListeners() {
  // 1. Debounced Search Input
  let debounceTimeout = null;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.search = e.target.value.trim();
      loadDecisions();
    }, 300);
  });

  // 2. Lifecycle Status Filter Dropdown
  elements.statusFilter.addEventListener('change', (e) => {
    state.status = e.target.value;
    loadDecisions();
  });

  // 3. Sorting Dropdown
  elements.sortFilter.addEventListener('change', (e) => {
    state.sort = e.target.value;
    loadDecisions();
  });

  // 4. Category Filter Buttons (Pills)
  elements.categoryPills.addEventListener('click', (e) => {
    if (e.target.classList.contains('pill-btn')) {
      // Remove active class from all pills
      elements.categoryPills.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked pill
      e.target.classList.add('active');

      state.category = e.target.getAttribute('data-category');
      loadDecisions();
    }
  });
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadStats();
  loadDecisions();
});
