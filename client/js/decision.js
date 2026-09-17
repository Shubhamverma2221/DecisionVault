/**
 * ==========================================================================
 * DecisionVault Decision Details & Timeline Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Extract ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const decisionId = urlParams.get('id');

  if (!decisionId) {
    window.location.href = '/';
    return;
  }

  // DOM Elements
  const loadingSpinner = document.getElementById('loading-spinner');
  const decisionContent = document.getElementById('decision-content');

  const badgeStatus = document.getElementById('badge-status');
  const badgeCategory = document.getElementById('badge-category');
  const badgeConfidence = document.getElementById('badge-confidence');
  const decisionTitle = document.getElementById('decision-title');
  const decisionDescription = document.getElementById('decision-description');
  const decisionTags = document.getElementById('decision-tags');

  const btnToggleFavorite = document.getElementById('btn-toggle-favorite');
  const btnToggleArchive = document.getElementById('btn-toggle-archive');
  const btnTriggerReplay = document.getElementById('btn-trigger-replay');
  const btnDelete = document.getElementById('btn-delete-decision');
  const btnNavLogout = document.getElementById('btn-nav-logout');

  const genesisDate = document.getElementById('genesis-date');
  const genesisOptions = document.getElementById('genesis-options');
  const genesisCriteriaBox = document.getElementById('genesis-criteria-box');
  const genesisCriteriaTableContainer = document.getElementById('genesis-criteria-table-container');
  const genesisReasoning = document.getElementById('genesis-reasoning');
  const genesisExpectedOutcome = document.getElementById('genesis-expected-outcome');

  const realityCard = document.getElementById('reality-card');
  const auditHistoryList = document.getElementById('audit-history-list');

  // Replay Modal Elements
  const replayModal = document.getElementById('replay-modal');
  const btnCloseReplay = document.getElementById('btn-close-replay');
  const btnReplayPrev = document.getElementById('btn-replay-prev');
  const btnReplayNext = document.getElementById('btn-replay-next');
  const replayStepIndicator = document.getElementById('replay-step-indicator');
  const replayStepTitle = document.getElementById('replay-step-title');
  const replayStepContent = document.getElementById('replay-step-content');

  if (btnNavLogout) btnNavLogout.addEventListener('click', () => API.logout());

  let activeDecision = null;
  let replayStep = 1;

  // 1. Fetch Decision Details
  try {
    const res = await API.getDecisionById(decisionId);
    activeDecision = res.data;
    renderDecision(activeDecision);
  } catch (error) {
    loadingSpinner.style.display = 'none';
    showToast(error.message || 'Failed to load decision details', 'error');
  }

  function renderDecision(d) {
    loadingSpinner.style.display = 'none';
    decisionContent.style.display = 'block';

    // Header Details
    decisionTitle.textContent = d.title;
    decisionDescription.textContent = d.description || 'No additional description provided.';
    badgeCategory.textContent = d.category;
    badgeConfidence.textContent = `${d.confidence}% Confidence`;

    // Status Badge
    let statusClass = 'badge-pending';
    let statusText = d.status || 'Pending Review';

    if (d.isArchived) {
      statusClass = 'badge-archived';
      statusText = 'Archived';
    } else if (d.status === 'Reviewed') {
      statusClass = 'badge-reviewed';
      if (d.review?.result === 'Achieved') statusClass = 'badge-achieved';
      if (d.review?.result === 'Partially Achieved') statusClass = 'badge-partial';
      if (d.review?.result === 'Not Achieved') statusClass = 'badge-failed';
      statusText = d.review?.result ? `${d.review.result}` : 'Reviewed';
    } else if (d.status === 'Review Due') {
      statusClass = 'badge-due';
      statusText = 'Review Due';
    }

    badgeStatus.className = `badge ${statusClass}`;
    badgeStatus.textContent = statusText;

    // Action buttons state
    btnToggleFavorite.textContent = d.isFavorite ? '⭐ Favorited' : '☆ Favorite';
    btnToggleArchive.textContent = d.isArchived ? '📂 Restore' : '📦 Archive';

    // Tags
    decisionTags.innerHTML = '';
    if (Array.isArray(d.tags) && d.tags.length > 0) {
      d.tags.forEach((t) => {
        const span = document.createElement('span');
        span.className = 'tag-badge';
        span.textContent = `#${t}`;
        decisionTags.appendChild(span);
      });
    }

    // Milestone 1: Genesis
    genesisDate.textContent = `Recorded: ${formatDate(d.createdAt)}`;
    genesisReasoning.textContent = d.reasoning;
    genesisExpectedOutcome.textContent = d.expectedOutcome;

    // Options List
    genesisOptions.innerHTML = '';
    d.options.forEach((opt) => {
      const isSelected = opt === d.selectedOption;
      const li = document.createElement('li');
      li.style.padding = '0.65rem 1rem';
      li.style.borderRadius = 'var(--radius-md)';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';

      if (isSelected) {
        li.style.background = '#eef2ff';
        li.style.border = '1.5px solid var(--accent-primary)';
        li.innerHTML = `
          <strong style="color: var(--accent-primary);">✓ ${escapeHTML(opt)}</strong>
          <span class="badge" style="background: var(--accent-primary); color: #fff;">Chosen Option</span>
        `;
      } else {
        li.style.background = '#f8fafc';
        li.style.border = '1px solid var(--border-subtle)';
        li.innerHTML = `<span>${escapeHTML(opt)}</span>`;
      }
      genesisOptions.appendChild(li);
    });

    // Criteria & Weighted Scores
    if (Array.isArray(d.criteria) && d.criteria.length > 0) {
      genesisCriteriaBox.style.display = 'block';
      renderCriteriaTable(d);
    }

    // Milestone 2: Reality Card
    renderRealityMilestone(d);

    // Audit History List
    renderAuditHistory(d.auditHistory || []);
  }

  function renderCriteriaTable(d) {
    let html = `
      <table class="criteria-table">
        <thead>
          <tr>
            <th style="text-align: left;">Criterion</th>
            <th>Weight</th>
            ${d.options.map(o => `<th>${escapeHTML(o)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    d.criteria.forEach((crit) => {
      html += `
        <tr>
          <td style="text-align: left; font-weight: 600;">${escapeHTML(crit.name)}</td>
          <td>${crit.weight}%</td>
          ${d.options.map(opt => {
            const scoreObj = (crit.scores || []).find(s => s.option === opt);
            return `<td>${scoreObj ? scoreObj.score : '-'}/10</td>`;
          }).join('')}
        </tr>
      `;
    });

    // Calculated weighted totals row
    if (Array.isArray(d.calculatedScores) && d.calculatedScores.length > 0) {
      html += `
        <tr style="background: #f1f5f9; font-weight: 700;">
          <td style="text-align: left;" colspan="2">Weighted Score (Out of 10)</td>
          ${d.options.map(opt => {
            const calc = d.calculatedScores.find(c => c.option === opt);
            const isWinner = opt === d.selectedOption;
            return `<td style="${isWinner ? 'color: var(--accent-primary); font-weight: 800;' : ''}">${calc ? calc.totalScore : '-'}</td>`;
          }).join('')}
        </tr>
      `;
    }

    html += `</tbody></table>`;
    genesisCriteriaTableContainer.innerHTML = html;
  }

  function renderRealityMilestone(d) {
    const isReviewed = d.review && d.review.result;

    if (isReviewed) {
      document.getElementById('node-reality').classList.add('reviewed');
      const scoreBadge = d.review.outcomeScore ? `<span class="badge badge-category">Score: ${d.review.outcomeScore}/10</span>` : '';

      let resultBadgeClass = 'badge-achieved';
      if (d.review.result === 'Partially Achieved') resultBadgeClass = 'badge-partial';
      if (d.review.result === 'Not Achieved') resultBadgeClass = 'badge-failed';

      realityCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 700; color: var(--outcome-achieved); font-size: 1.1rem;">2. Empirical Reality</span>
            <span class="badge ${resultBadgeClass}">${d.review.result}</span>
            ${scoreBadge}
          </div>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Reviewed: ${formatDate(d.review.reviewedAt)}</span>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.35rem;">Actual Empirical Outcome</div>
          <p style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.875rem; margin: 0; line-height: 1.5;">
            ${escapeHTML(d.review.actualOutcome)}
          </p>
        </div>

        <div>
          <div style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.35rem;">Lessons Learned & Mental Model Calibration</div>
          <p style="background: #f0fdf4; border-left: 3px solid var(--outcome-achieved); padding: 0.875rem; margin: 0; line-height: 1.5; color: #14532d; font-style: italic; border-radius: 0 var(--radius-md) var(--radius-md) 0;">
            “${escapeHTML(d.review.lessonLearned)}”
          </p>
        </div>
      `;
    } else {
      const daysText = getDaysRemaining(d.reviewDate);
      const isDue = d.status === 'Review Due';

      realityCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
          <span style="font-weight: 700; color: var(--status-due); font-size: 1.1rem;">2. Empirical Reality</span>
          <span class="badge ${isDue ? 'badge-due' : 'badge-pending'}">${isDue ? 'Review Due' : 'Pending Review'}</span>
        </div>

        <div style="text-align: center; padding: 1.5rem 1rem;">
          <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Target Review Date: <strong>${formatDate(d.reviewDate)}</strong> (${daysText})
          </p>
          <a href="/review.html?id=${d._id}" class="btn btn-primary" style="padding: 0.75rem 1.5rem;">
            ${isDue ? 'Confront Reality & Conduct Review Now 🔒' : 'Conduct Early Retrospective Review 🔒'}
          </a>
        </div>
      `;
    }
  }

  function renderAuditHistory(logs) {
    auditHistoryList.innerHTML = '';
    if (logs.length === 0) {
      auditHistoryList.innerHTML = '<li style="color: var(--text-muted); font-size: 0.85rem;">No modifications recorded yet.</li>';
      return;
    }

    logs.slice().reverse().forEach((entry) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.fontSize = '0.85rem';
      li.style.padding = '0.5rem 0';
      li.style.borderBottom = '1px solid #f1f5f9';

      li.innerHTML = `
        <div>
          <strong style="color: var(--text-primary);">${escapeHTML(entry.action)}</strong>
          ${entry.details ? `<span style="color: var(--text-muted); margin-left: 0.5rem;">— ${escapeHTML(entry.details)}</span>` : ''}
        </div>
        <span style="color: var(--text-muted); font-size: 0.8rem;">${formatDate(entry.timestamp)}</span>
      `;
      auditHistoryList.appendChild(li);
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 2. Action Button Handlers
  btnToggleFavorite.addEventListener('click', async () => {
    try {
      await API.toggleFavorite(decisionId);
      activeDecision.isFavorite = !activeDecision.isFavorite;
      btnToggleFavorite.textContent = activeDecision.isFavorite ? '⭐ Favorited' : '☆ Favorite';
      showToast(activeDecision.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to toggle favorite', 'error');
    }
  });

  btnToggleArchive.addEventListener('click', async () => {
    try {
      await API.toggleArchive(decisionId);
      activeDecision.isArchived = !activeDecision.isArchived;
      btnToggleArchive.textContent = activeDecision.isArchived ? '📂 Restore' : '📦 Archive';
      showToast(activeDecision.isArchived ? 'Decision archived' : 'Decision restored', 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      showToast(err.message || 'Failed to toggle archive', 'error');
    }
  });

  btnDelete.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to permanently delete this decision?')) return;
    try {
      await API.deleteDecision(decisionId);
      showToast('Decision deleted successfully', 'success');
      setTimeout(() => window.location.href = '/', 600);
    } catch (err) {
      showToast(err.message || 'Failed to delete decision', 'error');
    }
  });

  // 3. Decision Replay Experience
  btnTriggerReplay.addEventListener('click', () => {
    replayStep = 1;
    updateReplayModal();
    replayModal.style.display = 'flex';
  });

  btnCloseReplay.addEventListener('click', () => {
    replayModal.style.display = 'none';
  });

  btnReplayPrev.addEventListener('click', () => {
    if (replayStep > 1) {
      replayStep--;
      updateReplayModal();
    }
  });

  btnReplayNext.addEventListener('click', () => {
    if (replayStep < 4) {
      replayStep++;
      updateReplayModal();
    } else {
      replayModal.style.display = 'none';
    }
  });

  function updateReplayModal() {
    replayStepIndicator.textContent = `Step ${replayStep} of 4`;
    btnReplayPrev.disabled = replayStep === 1;
    btnReplayNext.textContent = replayStep === 4 ? 'Finish Replay' : 'Next Step →';

    const d = activeDecision;
    const isReviewed = d.review && d.review.result;

    if (replayStep === 1) {
      replayStepTitle.textContent = '1. What You Thought';
      replayStepContent.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
          <p style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Chosen Alternative:</p>
          <h3 style="color: var(--accent-primary); margin-bottom: 1rem;">${escapeHTML(d.selectedOption)}</h3>
          <p style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Initial Confidence:</p>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-primary); margin-bottom: 1rem;">${d.confidence}%</div>
          <p style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Your Reasoning:</p>
          <p style="font-size: 0.95rem; line-height: 1.4; color: var(--text-primary);">${escapeHTML(d.reasoning)}</p>
        </div>
      `;
    } else if (replayStep === 2) {
      replayStepTitle.textContent = '2. What Actually Happened';
      if (isReviewed) {
        replayStepContent.innerHTML = `
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
            <p style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Empirical Reality:</p>
            <p style="font-size: 1rem; line-height: 1.5; color: var(--text-primary); font-weight: 500;">
              ${escapeHTML(d.review.actualOutcome)}
            </p>
          </div>
        `;
      } else {
        replayStepContent.innerHTML = `
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: var(--radius-md); padding: 1.5rem; text-align: center;">
            <p style="font-size: 1rem; color: #9a3412;">This decision has not yet been reviewed.</p>
            <a href="/review.html?id=${d._id}" class="btn btn-primary btn-sm" style="margin-top: 0.75rem;">Conduct Review Now</a>
          </div>
        `;
      }
    } else if (replayStep === 3) {
      replayStepTitle.textContent = '3. Prediction vs. Reality';
      if (isReviewed) {
        let outcomeBadge = 'badge-achieved';
        if (d.review.result === 'Partially Achieved') outcomeBadge = 'badge-partial';
        if (d.review.result === 'Not Achieved') outcomeBadge = 'badge-failed';

        replayStepContent.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: var(--radius-md); padding: 1.25rem; text-align: center;">
              <span style="font-size: 0.8rem; text-transform: uppercase; color: #4338ca; font-weight: 700; display: block; margin-bottom: 0.5rem;">Target Hypothesis</span>
              <div style="font-size: 1.75rem; font-weight: 800; color: #3730a3; margin-bottom: 0.5rem;">${d.confidence}%</div>
              <p style="font-size: 0.85rem; color: #4338ca; margin: 0;">${escapeHTML(d.expectedOutcome)}</p>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 1.25rem; text-align: center;">
              <span style="font-size: 0.8rem; text-transform: uppercase; color: #166534; font-weight: 700; display: block; margin-bottom: 0.5rem;">Observed Reality</span>
              <div style="margin: 0.5rem 0;">
                <span class="badge ${outcomeBadge}" style="font-size: 1.1rem; padding: 0.35rem 0.75rem;">${d.review.result}</span>
              </div>
              <p style="font-size: 0.85rem; color: #166534; margin: 0;">${d.review.outcomeScore ? `Score: ${d.review.outcomeScore}/10` : 'Evaluated'}</p>
            </div>
          </div>
        `;
      } else {
        replayStepContent.innerHTML = `
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; text-align: center;">
            <p style="color: var(--text-muted);">Awaiting empirical outcome review to compare prediction vs. reality.</p>
          </div>
        `;
      }
    } else if (replayStep === 4) {
      replayStepTitle.textContent = '4. Lessons Learned';
      if (isReviewed) {
        replayStepContent.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 1.5rem;">
            <p style="font-size: 1.1rem; font-style: italic; color: #14532d; line-height: 1.6; margin: 0;">
              “${escapeHTML(d.review.lessonLearned)}”
            </p>
          </div>
        `;
      } else {
        replayStepContent.innerHTML = `
          <p style="color: var(--text-muted); text-align: center;">No lessons learned documented yet.</p>
        `;
      }
    }
  }
});
