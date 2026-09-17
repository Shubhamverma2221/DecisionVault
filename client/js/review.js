/**
 * ==========================================================================
 * DecisionVault Retrospective Review Controller (Vanilla JS)
 * ==========================================================================
 * Orchestrates the review execution workflow:
 * 1. Reads decisionId from URL query parameters (?id=...)
 * 2. Fetches and displays the original premises for direct cognitive comparison
 * 3. Enforces client-side validation against empty/hasty reviews
 * 4. Submits empirical reality payload to POST /api/decisions/:id/review
 * 5. Handles locked/already-reviewed decisions defensively
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Navigation & Feedback
  const backLink = document.getElementById('back-link');
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorContainer = document.getElementById('error-container');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const reviewWorkspace = document.getElementById('review-workspace');

  // DOM Elements - Hero Badges
  const headerStatusBadge = document.getElementById('header-status-badge');
  const headerCategoryBadge = document.getElementById('header-category-badge');

  // DOM Elements - Sealed/Already Reviewed View
  const alreadyReviewedCard = document.getElementById('already-reviewed-card');
  const sealedReviewBadge = document.getElementById('sealed-review-badge');
  const sealedActualOutcome = document.getElementById('sealed-actual-outcome');
  const sealedLessonLearned = document.getElementById('sealed-lesson-learned');
  const btnViewSealedHistory = document.getElementById('btn-view-sealed-history');

  // DOM Elements - Active Review Form & Context
  const reviewActiveContainer = document.getElementById('review-active-container');
  const contextDecisionTitle = document.getElementById('context-decision-title');
  const contextConfidenceBadge = document.getElementById('context-confidence-badge');
  const contextReviewDate = document.getElementById('context-review-date');
  const contextSelectedOption = document.getElementById('context-selected-option');
  const contextReasoning = document.getElementById('context-reasoning');
  const contextExpectedOutcome = document.getElementById('context-expected-outcome');

  const reviewForm = document.getElementById('review-form');
  const actualOutcomeInput = document.getElementById('actualOutcome');
  const lessonLearnedInput = document.getElementById('lessonLearned');
  const btnSubmitReview = document.getElementById('btn-submit-review');
  const btnCancelReview = document.getElementById('btn-cancel-review');

  // Step 1: Extract and validate decisionId from URL query string
  const urlParams = new URLSearchParams(window.location.search);
  const decisionId = urlParams.get('id');

  if (!decisionId) {
    displayError('Missing Decision Identifier', 'No decision ID was provided in the URL query string. Please navigate from the dashboard or select a decision to review.');
    return;
  }

  // Configure navigation buttons with the active decision ID
  backLink.href = `/decision.html?id=${decisionId}`;
  btnCancelReview.href = `/decision.html?id=${decisionId}`;
  btnViewSealedHistory.href = `/decision.html?id=${decisionId}`;

  // Step 2: Fetch decision details from backend API
  let currentDecision = null;
  try {
    currentDecision = await API.getDecisionById(decisionId);
    renderDecisionData(currentDecision);
  } catch (error) {
    displayError('Decision Not Found', error.message || 'Unable to retrieve the requested decision from the server.');
    return;
  }

  /**
   * Populates the review interface with decision data
   */
  function renderDecisionData(decision) {
    loadingSpinner.style.display = 'none';
    reviewWorkspace.style.display = 'block';

    // Set Category badge
    headerCategoryBadge.textContent = decision.category || 'General';

    // Check if the decision is ALREADY reviewed (Historical Immutability Guard)
    const isAlreadyReviewed = decision.status === 'Reviewed' || (decision.review && decision.review.result);

    if (isAlreadyReviewed) {
      // Configure Status badge
      headerStatusBadge.className = 'badge badge-reviewed';
      headerStatusBadge.textContent = 'Reviewed & Locked';

      // Hide active form, show sealed confirmation card
      reviewActiveContainer.style.display = 'none';
      alreadyReviewedCard.style.display = 'block';

      // Populate sealed review details
      const resultValue = decision.review?.result || 'Completed';
      sealedReviewBadge.textContent = resultValue;
      if (resultValue === 'Achieved') {
        sealedReviewBadge.className = 'badge badge-achieved';
      } else if (resultValue === 'Partially Achieved') {
        sealedReviewBadge.className = 'badge badge-partial';
      } else {
        sealedReviewBadge.className = 'badge badge-failed';
      }

      sealedActualOutcome.textContent = decision.review?.actualOutcome || 'No actual outcome text recorded.';
      sealedLessonLearned.textContent = decision.review?.lessonLearned || 'No lessons learned recorded.';

      showToast('This decision has already been finalized and cannot be modified.', 'error', 4000);
      return;
    }

    // Configure Active Status badge based on review date
    if (decision.status === 'Review Due') {
      headerStatusBadge.className = 'badge badge-due';
      headerStatusBadge.textContent = 'Review Due';
    } else {
      headerStatusBadge.className = 'badge badge-pending';
      headerStatusBadge.textContent = 'Pending Review';
    }

    // Populate Original Premise Context Card (Milestone 1)
    contextDecisionTitle.textContent = decision.title;
    contextConfidenceBadge.textContent = `${decision.confidence}% Initial Confidence`;
    
    const formattedDate = formatDate(decision.reviewDate);
    const daysRemaining = getDaysRemaining(decision.reviewDate);
    contextReviewDate.textContent = `${formattedDate} (${daysRemaining})`;

    contextSelectedOption.textContent = decision.selectedOption;
    contextReasoning.textContent = decision.reasoning;
    contextExpectedOutcome.textContent = decision.expectedOutcome;
  }

  /**
   * Displays fatal error state
   */
  function displayError(title, msg) {
    loadingSpinner.style.display = 'none';
    reviewWorkspace.style.display = 'none';
    errorContainer.style.display = 'block';
    errorTitle.textContent = title;
    errorMessage.textContent = msg;
    showToast(msg, 'error');
  }

  /**
   * Step 3: Handle Review Form Submission
   */
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Harvest form values
    const actualOutcome = actualOutcomeInput.value.trim();
    const lessonLearned = lessonLearnedInput.value.trim();
    const selectedRadio = document.querySelector('input[name="result"]:checked');

    // Client-side defensive validation
    if (!actualOutcome || actualOutcome.length < 5) {
      showToast('Please document what actually materialized (at least 5 characters).', 'error');
      actualOutcomeInput.focus();
      return;
    }

    if (!selectedRadio) {
      showToast('Please select an outcome evaluation: Achieved, Partially Achieved, or Not Achieved.', 'error');
      return;
    }

    if (!lessonLearned || lessonLearned.length < 5) {
      showToast('Please document lessons learned for future decision calibration (at least 5 characters).', 'error');
      lessonLearnedInput.focus();
      return;
    }

    const payload = {
      actualOutcome,
      result: selectedRadio.value,
      lessonLearned
    };

    // User Interface Lockdown during network request
    btnSubmitReview.disabled = true;
    btnSubmitReview.textContent = 'Committing & Locking Review... 🔒';

    try {
      await API.reviewDecision(decisionId, payload);
      showToast('Retrospective review finalized! Decision is permanently locked.', 'success', 3000);

      // Brief delay to allow toast visual completion before redirecting to timeline
      setTimeout(() => {
        window.location.href = `/decision.html?id=${decisionId}`;
      }, 750);
    } catch (error) {
      showToast(error.message || 'Failed to finalize review. Please try again.', 'error');
      btnSubmitReview.disabled = false;
      btnSubmitReview.textContent = 'Finalize Review & Lock Decision 🔒';
    }
  });
});
