/**
 * ==========================================================================
 * DecisionVault Lessons Library Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements
  const searchInput = document.getElementById('search-lessons-input');
  const categoryPills = document.getElementById('category-pills');
  const loadingSpinner = document.getElementById('loading-spinner');
  const emptyState = document.getElementById('empty-state');
  const lessonsGrid = document.getElementById('lessons-grid');
  const btnNavLogout = document.getElementById('btn-nav-logout');

  if (btnNavLogout) btnNavLogout.addEventListener('click', () => API.logout());

  let activeCategory = 'All';
  let searchQuery = '';

  // Debounced search helper
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Fetch and render lessons
  async function loadLessons() {
    loadingSpinner.style.display = 'block';
    lessonsGrid.style.display = 'none';
    emptyState.style.display = 'none';

    try {
      const res = await API.getLessons({
        category: activeCategory,
        search: searchQuery
      });

      const lessons = res.data || [];
      loadingSpinner.style.display = 'none';

      if (lessons.length === 0) {
        emptyState.style.display = 'block';
        return;
      }

      lessonsGrid.innerHTML = '';
      lessonsGrid.style.display = 'grid';

      lessons.forEach((l) => {
        const card = document.createElement('div');
        card.className = 'lesson-card';

        let badgeClass = 'badge-achieved';
        if (l.result === 'Partially Achieved') badgeClass = 'badge-partial';
        if (l.result === 'Not Achieved') badgeClass = 'badge-failed';

        const scoreText = l.outcomeScore ? ` • Score: ${l.outcomeScore}/10` : '';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 0.5rem;">
            <span class="badge ${badgeClass}">${l.result}${scoreText}</span>
            <span class="badge badge-category">${l.category}</span>
          </div>
          <div class="lesson-card-quote">“${escapeHTML(l.lessonLearned)}”</div>
          <div style="margin-bottom: 0.75rem; font-size: 0.85rem;">
            <span style="color: var(--text-muted);">From Decision:</span>
            <a href="/decision.html?id=${l.decisionId}" style="font-weight: 600; display: block; margin-top: 0.15rem;">
              ${escapeHTML(l.title)}
            </a>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 0.65rem; display: flex; justify-content: space-between;">
            <span>Reviewed: ${formatDate(l.reviewedAt)}</span>
            <span>${l.confidence}% Confidence</span>
          </div>
        `;

        lessonsGrid.appendChild(card);
      });
    } catch (error) {
      loadingSpinner.style.display = 'none';
      showToast(error.message || 'Failed to load lessons', 'error');
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Category Pill Selection
  if (categoryPills) {
    categoryPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;

      document.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');

      activeCategory = pill.dataset.category;
      loadLessons();
    });
  }

  // Search Input Handler
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce((e) => {
        searchQuery = e.target.value.trim();
        loadLessons();
      }, 300)
    );
  }

  // Initial load
  loadLessons();
});
