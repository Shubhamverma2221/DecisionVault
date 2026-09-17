/**
 * ==========================================================================
 * DecisionVault Dashboard Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Authentication Guard
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements - User & Navigation
  const navUserPill = document.getElementById('nav-user-pill');
  const btnNavLogout = document.getElementById('btn-nav-logout');
  const reminderBannerContainer = document.getElementById('reminder-banner-container');

  // Set user badge
  const currentUser = AuthToken.getUser();
  if (currentUser) {
    navUserPill.textContent = currentUser.name || 'User';
    if (currentUser.isGuest) {
      navUserPill.classList.add('guest');
      navUserPill.textContent = 'Guest Session';
    }
  }

  if (btnNavLogout) {
    btnNavLogout.addEventListener('click', () => API.logout());
  }

  // DOM Elements - KPI Metrics
  const kpiTotal = document.getElementById('kpi-total');
  const kpiDue = document.getElementById('kpi-due');
  const kpiPending = document.getElementById('kpi-pending');
  const kpiSuccessRate = document.getElementById('kpi-success-rate');
  const kpiReviewedSubtext = document.getElementById('kpi-reviewed-subtext');
  const kpiCalibrationGap = document.getElementById('kpi-calibration-gap');
  const kpiCalibrationSubtext = document.getElementById('kpi-calibration-subtext');

  // DOM Elements - Toolbar & Tabs
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const sortFilter = document.getElementById('sort-filter');
  const categoryPillsList = document.getElementById('category-pills-list');

  const tabAll = document.getElementById('tab-all');
  const tabFavorites = document.getElementById('tab-favorites');
  const tabArchived = document.getElementById('tab-archived');

  const btnExportJson = document.getElementById('btn-export-json');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // DOM Elements - Grid & States
  const loadingSpinner = document.getElementById('loading-spinner');
  const emptyState = document.getElementById('empty-state');
  const emptyStateTitle = document.getElementById('empty-state-title');
  const emptyStateDescription = document.getElementById('empty-state-description');
  const decisionGrid = document.getElementById('decision-grid');

  // State Management
  let activeCategory = 'All';
  let activeTab = 'all'; // 'all', 'favorites', 'archived'
  let searchQuery = '';
  let activeStatus = '';
  let activeSort = 'newest';

  // Debounce utility
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // 1. Fetch & Render Overview Metrics
  async function loadMetrics() {
    try {
      const res = await API.getOverviewStats();
      const m = res.data;

      kpiTotal.textContent = m.totalDecisions || 0;
      kpiDue.textContent = m.dueCount || 0;
      kpiPending.textContent = m.pendingCount || 0;
      kpiSuccessRate.textContent = `${m.successRate || 0}%`;
      kpiReviewedSubtext.textContent = `${m.reviewedCount || 0} of ${m.totalDecisions || 0} reviewed`;

      // Calibration Gap formatting
      const gap = m.calibrationGap || 0;
      if (gap > 0) {
        kpiCalibrationGap.textContent = `+${gap}%`;
        kpiCalibrationGap.style.color = '#dc2626'; // Overconfident: Red
        kpiCalibrationSubtext.textContent = `Overconfident (Avg. ${m.avgConfidence}%)`;
      } else if (gap < 0) {
        kpiCalibrationGap.textContent = `${gap}%`;
        kpiCalibrationGap.style.color = '#2563eb'; // Underconfident: Blue
        kpiCalibrationSubtext.textContent = `Underconfident (Avg. ${m.avgConfidence}%)`;
      } else {
        kpiCalibrationGap.textContent = `0%`;
        kpiCalibrationGap.style.color = '#16a34a'; // Calibrated: Green
        kpiCalibrationSubtext.textContent = `Accurate Confidence`;
      }

      // Render Review Reminders Banner
      renderReminders(m.overdueReviews || [], m.upcomingReviews || []);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  }

  function renderReminders(overdue, upcoming) {
    if (overdue.length === 0 && upcoming.length === 0) {
      reminderBannerContainer.style.display = 'none';
      return;
    }

    let bannerHTML = '';
    if (overdue.length > 0) {
      bannerHTML = `
        <div class="reminder-banner" style="background: #fef2f2; border-color: #fecaca; border-left-color: var(--outcome-failed);">
          <div class="reminder-banner-content">
            <span style="font-size: 1.5rem;">⚠️</span>
            <div>
              <strong style="color: #b91c1c; font-size: 0.95rem;">You have ${overdue.length} decision(s) ready for review!</strong>
              <p style="margin: 0; font-size: 0.85rem; color: #7f1d1d;">Compare what really happened with what you expected.</p>
            </div>
          </div>
          <a href="/review.html?id=${overdue[0]._id}" class="btn btn-danger btn-sm">Review Now: ${escapeHTML(overdue[0].title.substring(0, 30))}...</a>
        </div>
      `;
    } else if (upcoming.length > 0) {
      bannerHTML = `
        <div class="reminder-banner">
          <div class="reminder-banner-content">
            <span style="font-size: 1.5rem;">⏰</span>
            <div>
              <strong style="color: #9a3412; font-size: 0.95rem;">${upcoming.length} decision review(s) coming due this week.</strong>
              <p style="margin: 0; font-size: 0.85rem; color: #7c2d12;">Upcoming: "${escapeHTML(upcoming[0].title)}" on ${formatDate(upcoming[0].reviewDate)}.</p>
            </div>
          </div>
          <a href="/decision.html?id=${upcoming[0]._id}" class="btn btn-secondary btn-sm">View Decision</a>
        </div>
      `;
    }

    reminderBannerContainer.innerHTML = bannerHTML;
    reminderBannerContainer.style.display = 'block';
  }

  // 2. Fetch & Render Decisions Grid
  async function loadDecisions() {
    loadingSpinner.style.display = 'block';
    decisionGrid.style.display = 'none';
    emptyState.style.display = 'none';

    try {
      const filters = {
        category: activeCategory,
        status: activeStatus,
        search: searchQuery,
        sort: activeSort,
        favorite: activeTab === 'favorites',
        archived: activeTab === 'archived'
      };

      const res = await API.getDecisions(filters);
      const decisions = res.data || [];

      loadingSpinner.style.display = 'none';

      if (decisions.length === 0) {
        if (activeTab === 'favorites') {
          emptyStateTitle.textContent = 'No Favorite Decisions';
          emptyStateDescription.textContent = 'Click the star icon (⭐) on any decision card to pin your most critical decisions here.';
        } else if (activeTab === 'archived') {
          emptyStateTitle.textContent = 'No Archived Decisions';
          emptyStateDescription.textContent = 'Archived decisions are safely stored away from your active dashboard.';
        } else {
          emptyStateTitle.textContent = 'No Decisions Found';
          emptyStateDescription.textContent = 'Document the options you are weighing, your underlying reasoning, and your expected outcome.';
        }
        emptyState.style.display = 'block';
        return;
      }

      decisionGrid.innerHTML = '';
      decisionGrid.style.display = 'grid';

      decisions.forEach((d) => {
        const card = createDecisionCard(d);
        decisionGrid.appendChild(card);
      });
    } catch (error) {
      loadingSpinner.style.display = 'none';
      showToast(error.message || 'Failed to load decisions', 'error');
    }
  }

  function createDecisionCard(d) {
    const card = document.createElement('div');
    card.className = 'decision-card';

    // Status Badge determination
    let badgeClass = 'badge-pending';
    let statusText = d.status || 'Pending Review';

    if (d.isArchived) {
      badgeClass = 'badge-archived';
      statusText = 'Archived';
    } else if (d.status === 'Reviewed') {
      badgeClass = 'badge-reviewed';
      if (d.review?.result === 'Achieved') badgeClass = 'badge-achieved';
      if (d.review?.result === 'Partially Achieved') badgeClass = 'badge-partial';
      if (d.review?.result === 'Not Achieved') badgeClass = 'badge-failed';
      statusText = d.review?.result ? `${d.review.result}` : 'Reviewed';
    } else if (d.status === 'Review Due') {
      badgeClass = 'badge-due';
      statusText = 'Review Due';
    }

    const daysRemainingText = getDaysRemaining(d.reviewDate);

    // Render tags
    let tagsHTML = '';
    if (Array.isArray(d.tags) && d.tags.length > 0) {
      tagsHTML = `<div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem;">
        ${d.tags.map(t => `<span class="tag-badge">#${escapeHTML(t)}</span>`).join('')}
      </div>`;
    }

    card.innerHTML = `
      <div class="decision-card-header">
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <span class="badge ${badgeClass}">${statusText}</span>
          <span class="badge badge-category">${escapeHTML(d.category)}</span>
        </div>
        <button type="button" class="btn-star-favorite ${d.isFavorite ? 'is-favorite' : ''}" data-id="${d._id}" title="${d.isFavorite ? 'Unfavorite' : 'Favorite'}">
          ${d.isFavorite ? '⭐' : '☆'}
        </button>
      </div>

      <h3 class="decision-card-title">
        <a href="/decision.html?id=${d._id}">${escapeHTML(d.title)}</a>
      </h3>

      <div class="decision-card-meta">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Selected Choice:</span>
          <strong style="color: var(--accent-primary); font-size: 0.95rem;">${escapeHTML(d.selectedOption)}</strong>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Expected Outcome:</span>
          <span style="color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${escapeHTML(d.expectedOutcome)}
          </span>
        </div>
        ${tagsHTML}
      </div>

      <div class="decision-card-footer">
        <div>
          <span style="font-weight: 600; color: var(--accent-primary);">${d.confidence}% Confidence</span>
        </div>
        <div style="text-align: right;">
          <span style="display: block; font-size: 0.75rem;">${formatDate(d.reviewDate)}</span>
          <span style="color: ${d.status === 'Review Due' ? 'var(--status-due)' : 'var(--text-muted)'}; font-weight: 500;">
            ${daysRemainingText}
          </span>
        </div>
      </div>
    `;

    // Bind favorite button click
    const btnStar = card.querySelector('.btn-star-favorite');
    btnStar.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await API.toggleFavorite(d._id);
        d.isFavorite = !d.isFavorite;
        btnStar.classList.toggle('is-favorite');
        btnStar.textContent = d.isFavorite ? '⭐' : '☆';
        showToast(d.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
        if (activeTab === 'favorites') {
          loadDecisions();
        }
      } catch (err) {
        showToast(err.message || 'Failed to toggle favorite', 'error');
      }
    });

    return card;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 3. Tab Handlers
  function switchTab(tabName, activeBtn) {
    activeTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach((b) => b.classList.remove('active'));
    activeBtn.classList.add('active');
    loadDecisions();
  }

  tabAll.addEventListener('click', (e) => switchTab('all', e.target));
  tabFavorites.addEventListener('click', (e) => switchTab('favorites', e.target));
  tabArchived.addEventListener('click', (e) => switchTab('archived', e.target));

  // 4. Category Pills Filter
  categoryPillsList.addEventListener('click', (e) => {
    const pill = e.target.closest('.category-pill');
    if (!pill) return;

    document.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');

    activeCategory = pill.dataset.category;
    loadDecisions();
  });

  // 5. Search & Dropdown Filters
  searchInput.addEventListener(
    'input',
    debounce((e) => {
      searchQuery = e.target.value.trim();
      loadDecisions();
    }, 300)
  );

  statusFilter.addEventListener('change', (e) => {
    activeStatus = e.target.value;
    loadDecisions();
  });

  sortFilter.addEventListener('change', (e) => {
    activeSort = e.target.value;
    loadDecisions();
  });

  // 6. Export Handlers
  btnExportJson.addEventListener('click', async () => {
    try {
      btnExportJson.disabled = true;
      const res = await API.exportDecisions('json');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `decisionvault_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      btnExportJson.disabled = false;
      showToast('JSON export downloaded successfully!', 'success');
    } catch (err) {
      btnExportJson.disabled = false;
      showToast('Export failed', 'error');
    }
  });

  btnExportCsv.addEventListener('click', async () => {
    try {
      btnExportCsv.disabled = true;
      await API.exportDecisions('csv');
      btnExportCsv.disabled = false;
      showToast('CSV export downloaded successfully!', 'success');
    } catch (err) {
      btnExportCsv.disabled = false;
      showToast('CSV Export failed', 'error');
    }
  });

  // Initial Load
  loadMetrics();
  loadDecisions();
});
