/**
 * ==========================================================================
 * DecisionVault Decision Details & History Timeline Controller
 * ==========================================================================
 * Renders the full decision context and builds the two-milestone
 * historical timeline (Genesis vs Reality).
 */

// DOM Elements
const loadingSpinner = document.getElementById('loading-spinner');
const decisionContent = document.getElementById('decision-content');
const decisionTitle = document.getElementById('decision-title');
const decisionDescription = document.getElementById('decision-description');
const badgeStatus = document.getElementById('badge-status');
const badgeOutcomeContainer = document.getElementById('badge-outcome-container');
const btnDeleteDecision = document.getElementById('btn-delete-decision');

// Milestone 1 Elements
const genesisDate = document.getElementById('genesis-date');
const genesisOptions = document.getElementById('genesis-options');
const genesisReasoning = document.getElementById('genesis-reasoning');
const genesisConfidence = document.getElementById('genesis-confidence');
const genesisConfidenceFill = document.getElementById('genesis-confidence-fill');
const genesisExpected = document.getElementById('genesis-expected');

// Milestone 2 Elements
const nodeReview = document.getElementById('node-review');
const reviewCardContent = document.getElementById('review-card-content');

let currentDecision = null;

/**
 * Parses query parameters to extract decision ID
 */
function getDecisionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * Loads decision details from API and populates the DOM
 */
async function loadDecisionDetails() {
  const id = getDecisionIdFromUrl();

  if (!id) {
    showToast('No decision ID provided.', 'error');
    setTimeout(() => { window.location.href = '/'; }, 1500);
    return;
  }

  try {
    loadingSpinner.style.display = 'block';
    decisionContent.style.display = 'none';

    const res = await API.getDecisionById(id);
    currentDecision = res.data;

    renderDecisionView(currentDecision);

    loadingSpinner.style.display = 'none';
    decisionContent.style.display = 'block';
  } catch (error) {
    loadingSpinner.style.display = 'none';
    console.error('Failed to load decision:', error);
    showToast(error.message, 'error');
  }
}

/**
 * Renders all sections of the decision details & timeline
 */
function renderDecisionView(decision) {
  // 1. Hero Metadata
  document.title = `${decision.title} — DecisionVault`;
  decisionTitle.textContent = decision.title;
  decisionDescription.textContent = decision.description || 'No background description provided.';

  // Status Badge
  badgeStatus.textContent = decision.status;
  badgeStatus.className = 'badge';
  if (decision.status === 'Review Due') badgeStatus.classList.add('badge-due');
  else if (decision.status === 'Reviewed') badgeStatus.classList.add('badge-reviewed');
  else badgeStatus.classList.add('badge-pending');

  // Outcome Badge (if reviewed)
  badgeOutcomeContainer.innerHTML = '';
  if (decision.review && decision.review.result) {
    const outcomeBadge = document.createElement('span');
    outcomeBadge.className = 'badge';
    if (decision.review.result === 'Achieved') outcomeBadge.classList.add('badge-achieved');
    else if (decision.review.result === 'Partially Achieved') outcomeBadge.classList.add('badge-partial');
    else outcomeBadge.classList.add('badge-failed');
    outcomeBadge.textContent = decision.review.result;
    badgeOutcomeContainer.appendChild(outcomeBadge);
  }

  // 2. Milestone 1: Decision Genesis
  genesisDate.textContent = `Recorded: ${formatDate(decision.createdAt)}`;
  genesisReasoning.textContent = decision.reasoning;
  genesisConfidence.textContent = `${decision.confidence}%`;
  genesisConfidenceFill.style.width = `${decision.confidence}%`;
  genesisExpected.textContent = `"${decision.expectedOutcome}"`;

  // Render Options List
  genesisOptions.innerHTML = '';
  decision.options.forEach((opt, idx) => {
    const li = document.createElement('li');
    const isSelected = opt === decision.selectedOption;
    if (isSelected) li.className = 'selected-option';

    li.innerHTML = `
      <span>${idx + 1}. ${escapeHtml(opt)}</span>
      ${isSelected ? '<span style="float: right; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">✓ Selected</span>' : ''}
    `;
    genesisOptions.appendChild(li);
  });

  // 3. Milestone 2: Retrospective Reflection
  renderReviewMilestone(decision);
}

/**
 * Builds Milestone 2: either completed review or pending review call-to-action
 */
function renderReviewMilestone(decision) {
  if (decision.status === 'Reviewed' && decision.review) {
    nodeReview.classList.add('reviewed');

    let resultBadgeClass = 'badge-achieved';
    if (decision.review.result === 'Partially Achieved') resultBadgeClass = 'badge-partial';
    if (decision.review.result === 'Not Achieved') resultBadgeClass = 'badge-failed';

    reviewCardContent.innerHTML = `
      <div class="timeline-card-header">
        <span style="font-weight: 700; color: var(--outcome-achieved);">2. Retrospective Reality</span>
        <span class="timeline-date">Evaluated: ${formatDate(decision.review.reviewedAt)}</span>
      </div>

      <div class="timeline-section-title">What Actually Happened?</div>
      <p class="timeline-content">${escapeHtml(decision.review.actualOutcome)}</p>

      <div class="timeline-section-title">Outcome Evaluation</div>
      <div style="margin: 0.5rem 0;">
        <span class="badge ${resultBadgeClass}" style="font-size: 0.85rem; padding: 0.35rem 0.85rem;">
          ${escapeHtml(decision.review.result)}
        </span>
      </div>

      <div class="timeline-section-title">Lesson Learned (Calibrating Future Judgment)</div>
      <div style="background: var(--bg-input); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid var(--outcome-achieved); margin-top: 0.5rem;">
        <p class="timeline-content" style="font-style: italic; color: var(--text-primary);">
          "${escapeHtml(decision.review.lessonLearned)}"
        </p>
      </div>
    `;
  } else if (decision.status === 'Review Due') {
    // Review Date Arrived!
    reviewCardContent.innerHTML = `
      <div class="timeline-card-header">
        <span style="font-weight: 700; color: var(--status-due-text);">2. Retrospective Review Due!</span>
        <span class="timeline-date">Scheduled for: ${formatDate(decision.reviewDate)}</span>
      </div>
      <p class="timeline-content" style="margin-bottom: 1.25rem;">
        The target review date has arrived! It's time to measure what actually happened against your original hypothesis.
      </p>
      <a href="/review.html?id=${decision._id}" class="btn btn-primary" id="btn-conduct-review">
        Conduct Review Now →
      </a>
    `;
  } else {
    // Pending Review (Future date)
    reviewCardContent.innerHTML = `
      <div class="timeline-card-header">
        <span style="font-weight: 700; color: var(--status-pending-text);">2. Retrospective Review Pending</span>
        <span class="timeline-date">${getDaysRemaining(decision.reviewDate)}</span>
      </div>
      <p class="timeline-content" style="margin-bottom: 1.25rem;">
        This decision is in its verification window. The hypothesis will be reviewed on <strong>${formatDate(decision.reviewDate)}</strong>.
      </p>
      <a href="/review.html?id=${decision._id}" class="btn btn-secondary" style="font-size: 0.85rem;" id="btn-early-review">
        Outcome already known? Review Early →
      </a>
    `;
  }
}

/**
 * Deletes the decision with confirmation
 */
async function handleDeleteDecision() {
  if (!currentDecision) return;

  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${currentDecision.title}"? This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    btnDeleteDecision.disabled = true;
    btnDeleteDecision.textContent = 'Deleting...';

    await API.deleteDecision(currentDecision._id);

    showToast('Decision deleted successfully', 'success');

    setTimeout(() => {
      window.location.href = '/';
    }, 800);
  } catch (error) {
    btnDeleteDecision.disabled = false;
    btnDeleteDecision.textContent = 'Delete Decision';
    showToast(error.message, 'error');
  }
}

/**
 * Basic HTML escaping utility
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

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  btnDeleteDecision.addEventListener('click', handleDeleteDecision);
  loadDecisionDetails();
});
