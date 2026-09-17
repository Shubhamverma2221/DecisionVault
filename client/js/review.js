/**
 * ==========================================================================
 * DecisionVault Retrospective Review Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements
  const backLink = document.getElementById('back-link');
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorContainer = document.getElementById('error-container');
  const reviewWorkspace = document.getElementById('review-workspace');

  const headerStatusBadge = document.getElementById('header-status-badge');
  const headerCategoryBadge = document.getElementById('header-category-badge');

  const alreadyReviewedCard = document.getElementById('already-reviewed-card');
  const sealedReviewBadge = document.getElementById('sealed-review-badge');
  const sealedActualOutcome = document.getElementById('sealed-actual-outcome');
  const sealedLessonLearned = document.getElementById('sealed-lesson-learned');
  const btnViewSealedHistory = document.getElementById('btn-view-sealed-history');

  const reviewActiveContainer = document.getElementById('review-active-container');
  const contextDecisionTitle = document.getElementById('context-decision-title');
  const contextConfidenceBadge = document.getElementById('context-confidence-badge');
  const contextReviewDate = document.getElementById('context-review-date');
  const contextSelectedOption = document.getElementById('context-selected-option');
  const contextReasoning = document.getElementById('context-reasoning');
  const contextExpectedOutcome = document.getElementById('context-expected-outcome');

  const reviewForm = document.getElementById('review-form');
  const actualOutcomeInput = document.getElementById('actualOutcome');
  const outcomeScoreInput = document.getElementById('outcomeScore');
  const outcomeScoreVal = document.getElementById('outcome-score-val');
  const lessonLearnedInput = document.getElementById('lessonLearned');
  const btnSubmitReview = document.getElementById('btn-submit-review');
  const btnCancelReview = document.getElementById('btn-cancel-review');
  const btnNavLogout = document.getElementById('btn-nav-logout');

  if (btnNavLogout) btnNavLogout.addEventListener('click', () => API.logout());

  // Slider badge updater
  if (outcomeScoreInput && outcomeScoreVal) {
    outcomeScoreInput.addEventListener('input', (e) => {
      outcomeScoreVal.textContent = `${e.target.value}/10`;
    });
  }

  // Extract decisionId from URL
  const urlParams = new URLSearchParams(window.location.search);
  const decisionId = urlParams.get('id');

  if (!decisionId) {
    displayError('Missing Decision Identifier', 'No decision ID was provided in the URL query string.');
    return;
  }

  backLink.href = `/decision.html?id=${decisionId}`;
  btnCancelReview.href = `/decision.html?id=${decisionId}`;
  btnViewSealedHistory.href = `/decision.html?id=${decisionId}`;

  // Fetch decision details
  try {
    const res = await API.getDecisionById(decisionId);
    renderDecisionData(res.data);
  } catch (error) {
    displayError('Decision Not Found', error.message || 'Unable to retrieve requested decision.');
  }

  function renderDecisionData(d) {
    loadingSpinner.style.display = 'none';
    reviewWorkspace.style.display = 'block';

    headerCategoryBadge.textContent = d.category || 'General';

    const isAlreadyReviewed = d.status === 'Reviewed' || (d.review && d.review.result);

    if (isAlreadyReviewed) {
      headerStatusBadge.className = 'badge badge-reviewed';
      headerStatusBadge.textContent = 'Reviewed & Sealed';

      reviewActiveContainer.style.display = 'none';
      alreadyReviewedCard.style.display = 'block';

      const resultVal = d.review?.result || 'Completed';
      sealedReviewBadge.textContent = resultVal;
      if (resultVal === 'Achieved') sealedReviewBadge.className = 'badge badge-achieved';
      else if (resultVal === 'Partially Achieved') sealedReviewBadge.className = 'badge badge-partial';
      else sealedReviewBadge.className = 'badge badge-failed';

      sealedActualOutcome.textContent = d.review?.actualOutcome || 'No outcome recorded.';
      sealedLessonLearned.textContent = d.review?.lessonLearned || 'No lesson recorded.';
      return;
    }

    if (d.status === 'Review Due') {
      headerStatusBadge.className = 'badge badge-due';
      headerStatusBadge.textContent = 'Review Due';
    } else {
      headerStatusBadge.className = 'badge badge-pending';
      headerStatusBadge.textContent = 'Pending Review';
    }

    contextDecisionTitle.textContent = d.title;
    contextConfidenceBadge.textContent = `${d.confidence}% Initial Confidence`;
    contextReviewDate.textContent = `${formatDate(d.reviewDate)} (${getDaysRemaining(d.reviewDate)})`;
    contextSelectedOption.textContent = d.selectedOption;
    contextReasoning.textContent = d.reasoning;
    contextExpectedOutcome.textContent = d.expectedOutcome;
  }

  function displayError(title, msg) {
    loadingSpinner.style.display = 'none';
    reviewWorkspace.style.display = 'none';
    errorContainer.style.display = 'block';
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = msg;
    showToast(msg, 'error');
  }

  // Handle Review Submission
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const actualOutcome = actualOutcomeInput.value.trim();
    const lessonLearned = lessonLearnedInput.value.trim();
    const selectedRadio = document.querySelector('input[name="result"]:checked');
    const outcomeScore = Number(outcomeScoreInput.value);

    if (!actualOutcome || actualOutcome.length < 5) {
      showToast('Please document what actually happened (at least 5 characters).', 'error');
      actualOutcomeInput.focus();
      return;
    }

    if (!selectedRadio) {
      showToast('Please select an outcome evaluation: Achieved, Partially Achieved, or Not Achieved.', 'error');
      return;
    }

    if (!lessonLearned || lessonLearned.length < 5) {
      showToast('Please document lessons learned for future calibration (at least 5 characters).', 'error');
      lessonLearnedInput.focus();
      return;
    }

    const payload = {
      actualOutcome,
      result: selectedRadio.value,
      outcomeScore,
      lessonLearned
    };

    btnSubmitReview.disabled = true;
    btnSubmitReview.textContent = 'Committing & Sealing Review... 🔒';

    try {
      await API.reviewDecision(decisionId, payload);
      showToast('Retrospective review finalized! Decision is permanently locked.', 'success');

      setTimeout(() => {
        window.location.href = `/decision.html?id=${decisionId}`;
      }, 750);
    } catch (error) {
      showToast(error.message || 'Failed to submit review', 'error');
      btnSubmitReview.disabled = false;
      btnSubmitReview.textContent = 'Finalize Review & Lock Decision 🔒';
    }
  });
});
