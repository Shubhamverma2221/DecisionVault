/**
 * ==========================================================================
 * DecisionVault Decision Creation Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements
  const form = document.getElementById('decision-form');
  const reviewDateInput = document.getElementById('reviewDate');
  const optionsContainer = document.getElementById('options-container');
  const btnAddOption = document.getElementById('btn-add-option');
  const confidenceSlider = document.getElementById('confidence');
  const confidenceValue = document.getElementById('confidence-value');
  const btnSubmit = document.getElementById('btn-submit');
  const btnNavLogout = document.getElementById('btn-nav-logout');

  // Criteria Elements
  const btnToggleCriteria = document.getElementById('btn-toggle-criteria');
  const criteriaSection = document.getElementById('criteria-section');
  const btnAddCriterion = document.getElementById('btn-add-criterion');
  const criteriaContainer = document.getElementById('criteria-container');
  const criteriaMatrixPreview = document.getElementById('criteria-matrix-preview');

  if (btnNavLogout) btnNavLogout.addEventListener('click', () => API.logout());

  let criteriaEnabled = false;
  let criteriaList = []; // [{ name: '', weight: 50, scores: { [option]: 8 } }]

  // 1. Set default review date to +30 days
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 30);
  reviewDateInput.value = defaultDate.toISOString().split('T')[0];

  // 2. Confidence Slider Badge
  confidenceSlider.addEventListener('input', (e) => {
    confidenceValue.textContent = `${e.target.value}%`;
  });

  // 3. Dynamic Options Management
  let optionCount = 0;

  function addOptionRow(initialValue = '', isChecked = false) {
    optionCount++;
    const rowId = `option-row-${optionCount}`;

    const row = document.createElement('div');
    row.className = 'option-row';
    row.id = rowId;

    row.innerHTML = `
      <input 
        type="radio" 
        name="selectedOptionRadio" 
        class="option-radio" 
        title="Mark as selected choice" 
        ${isChecked ? 'checked' : ''} 
      />
      <input 
        type="text" 
        class="form-control option-text-input" 
        placeholder="Alternative ${optionCount}..." 
        value="${initialValue}" 
        required 
      />
      <button type="button" class="btn-remove-option" title="Remove option">✕</button>
    `;

    optionsContainer.appendChild(row);

    // Option text change updates radio value & criteria matrix
    const textInput = row.querySelector('.option-text-input');
    const radio = row.querySelector('.option-radio');

    textInput.addEventListener('input', () => {
      radio.value = textInput.value.trim();
      updateCriteriaMatrix();
    });

    // Remove row handler
    row.querySelector('.btn-remove-option').addEventListener('click', () => {
      const allRows = optionsContainer.querySelectorAll('.option-row');
      if (allRows.length <= 2) {
        showToast('A decision requires considering at least 2 alternative options.', 'error');
        return;
      }
      row.remove();
      updateCriteriaMatrix();
    });

    radio.value = initialValue;
  }

  // Initialize with 3 clean options
  addOptionRow('', true);
  addOptionRow('', false);
  addOptionRow('', false);

  btnAddOption.addEventListener('click', () => {
    const allRows = optionsContainer.querySelectorAll('.option-row');
    if (allRows.length >= 8) {
      showToast('Maximum 8 options allowed per decision.', 'error');
      return;
    }
    addOptionRow();
    updateCriteriaMatrix();
  });

  // 4. Criteria Scoring Builder
  btnToggleCriteria.addEventListener('click', () => {
    criteriaEnabled = !criteriaEnabled;
    if (criteriaEnabled) {
      criteriaSection.style.display = 'block';
      btnToggleCriteria.textContent = '✕ Disable Criteria Scoring';
      if (criteriaList.length === 0) {
        addCriterionRow('Development Speed', 40);
        addCriterionRow('Scalability', 35);
        addCriterionRow('Cost Efficiency', 25);
      }
      updateCriteriaMatrix();
    } else {
      criteriaSection.style.display = 'none';
      btnToggleCriteria.textContent = '+ Enable Criteria Scoring';
    }
  });

  function addCriterionRow(defaultName = '', defaultWeight = 50) {
    const critDiv = document.createElement('div');
    critDiv.style.display = 'flex';
    critDiv.style.gap = '0.5rem';
    critDiv.style.marginBottom = '0.5rem';
    critDiv.style.alignItems = 'center';

    critDiv.innerHTML = `
      <input type="text" class="form-control crit-name" placeholder="Criterion (e.g. Speed)" value="${defaultName}" style="flex: 2;" required />
      <div style="display: flex; align-items: center; gap: 0.25rem; flex: 1;">
        <input type="number" class="form-control crit-weight" placeholder="Weight" min="1" max="100" value="${defaultWeight}" required />
        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">%</span>
      </div>
      <button type="button" class="btn-remove-option btn-remove-crit" title="Remove criterion">✕</button>
    `;

    criteriaContainer.appendChild(critDiv);

    critDiv.querySelector('.crit-name').addEventListener('input', updateCriteriaMatrix);
    critDiv.querySelector('.crit-weight').addEventListener('input', updateCriteriaMatrix);
    critDiv.querySelector('.btn-remove-crit').addEventListener('click', () => {
      critDiv.remove();
      updateCriteriaMatrix();
    });

    updateCriteriaMatrix();
  }

  btnAddCriterion.addEventListener('click', () => {
    addCriterionRow('', 25);
  });

  function getOptionsList() {
    return Array.from(optionsContainer.querySelectorAll('.option-text-input'))
      .map(i => i.value.trim())
      .filter(v => v !== '');
  }

  function updateCriteriaMatrix() {
    if (!criteriaEnabled) return;

    const options = getOptionsList();
    const critRows = criteriaContainer.children;

    if (options.length < 2 || critRows.length === 0) {
      criteriaMatrixPreview.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted);">Add criteria and options to see the scoring matrix.</p>';
      return;
    }

    let tableHTML = `
      <table class="criteria-table">
        <thead>
          <tr>
            <th style="text-align: left;">Criterion</th>
            <th>Weight</th>
            ${options.map(o => `<th>${escapeHTML(o)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    Array.from(critRows).forEach((row, idx) => {
      const name = row.querySelector('.crit-name').value.trim() || `Criterion ${idx + 1}`;
      const weight = row.querySelector('.crit-weight').value || 0;

      tableHTML += `
        <tr>
          <td style="text-align: left; font-weight: 600;">${escapeHTML(name)}</td>
          <td>${weight}%</td>
          ${options.map((opt, optIdx) => `
            <td>
              <input 
                type="number" 
                class="form-control crit-score-input" 
                data-crit-idx="${idx}" 
                data-option="${escapeHTML(opt)}" 
                min="1" 
                max="10" 
                value="7" 
                style="width: 55px; padding: 0.25rem; text-align: center; margin: 0 auto;"
              />
            </td>
          `).join('')}
        </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    criteriaMatrixPreview.innerHTML = tableHTML;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 5. Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const category = document.getElementById('category').value;
    const reviewDate = reviewDateInput.value;
    const reasoning = document.getElementById('reasoning').value.trim();
    const expectedOutcome = document.getElementById('expectedOutcome').value.trim();
    const confidence = Number(confidenceSlider.value);

    // Parse tags
    const tagsInput = document.getElementById('tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0) : [];

    // Harvest Options
    const optionRows = optionsContainer.querySelectorAll('.option-row');
    const options = [];
    let selectedOption = null;

    optionRows.forEach((row) => {
      const textVal = row.querySelector('.option-text-input').value.trim();
      const radio = row.querySelector('.option-radio');
      if (textVal) {
        options.push(textVal);
        if (radio.checked) {
          selectedOption = textVal;
        }
      }
    });

    // Validation
    if (!title) {
      showToast('Please provide a decision title', 'error');
      return;
    }

    if (options.length < 2) {
      showToast('Please enter at least 2 distinct alternative options', 'error');
      return;
    }

    if (!selectedOption) {
      showToast('Please select the chosen option using the radio button', 'error');
      return;
    }

    if (reasoning.length < 10) {
      showToast('Reasoning must be at least 10 characters long', 'error');
      return;
    }

    if (expectedOutcome.length < 5) {
      showToast('Expected outcome must be at least 5 characters long', 'error');
      return;
    }

    // Build criteria array if enabled
    let criteriaPayload = [];
    if (criteriaEnabled) {
      const critRows = criteriaContainer.children;
      const scoreInputs = criteriaMatrixPreview.querySelectorAll('.crit-score-input');

      Array.from(critRows).forEach((r, idx) => {
        const name = r.querySelector('.crit-name').value.trim();
        const weight = Number(r.querySelector('.crit-weight').value);
        if (name && weight > 0) {
          const scores = [];
          options.forEach(opt => {
            const matchInput = Array.from(scoreInputs).find(i => i.dataset.critIdx === String(idx) && i.dataset.option === opt);
            const score = matchInput ? Number(matchInput.value) : 5;
            scores.push({ option: opt, score });
          });
          criteriaPayload.push({ name, weight, scores });
        }
      });
    }

    const payload = {
      title,
      description,
      category,
      tags,
      options,
      selectedOption,
      reasoning,
      confidence,
      expectedOutcome,
      reviewDate,
      criteria: criteriaPayload
    };

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Recording Decision...';

      await API.createDecision(payload);
      showToast('Decision recorded successfully!', 'success');

      setTimeout(() => {
        window.location.href = '/';
      }, 600);
    } catch (error) {
      showToast(error.message || 'Failed to record decision', 'error');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Save Decision';
    }
  });
});
