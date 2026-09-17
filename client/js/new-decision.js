/**
 * ==========================================================================
 * DecisionVault New Decision Controller
 * ==========================================================================
 * Manages dynamic option builder rows, real-time confidence slider sync,
 * client-side schema validation, and asynchronous decision creation.
 */

// DOM Element References
const form = document.getElementById('decision-form');
const optionsContainer = document.getElementById('options-container');
const btnAddOption = document.getElementById('btn-add-option');
const confidenceSlider = document.getElementById('confidence');
const confidenceValBadge = document.getElementById('confidence-val');
const reviewDateInput = document.getElementById('reviewDate');
const btnSubmit = document.getElementById('btn-submit');

/**
 * Renders an option row in the dynamic builder
 */
function createOptionRow(placeholderText = '', value = '', isChecked = false) {
  const row = document.createElement('div');
  row.className = 'option-row';

  row.innerHTML = `
    <input 
      type="radio" 
      name="selectedOptionRadio" 
      class="option-radio" 
      title="Mark as your chosen option"
      ${isChecked ? 'checked' : ''}
      required
    />
    <input 
      type="text" 
      class="form-control option-text-input" 
      placeholder="${placeholderText}" 
      value="${value}"
      required
    />
    <button type="button" class="btn-remove-option" title="Remove this alternative">✕</button>
  `;

  // Sync radio value with typed input text
  const textInput = row.querySelector('.option-text-input');
  const radio = row.querySelector('.option-radio');

  textInput.addEventListener('input', () => {
    radio.value = textInput.value.trim();
  });

  // Remove button handler
  const btnRemove = row.querySelector('.btn-remove-option');
  btnRemove.addEventListener('click', () => {
    const totalRows = optionsContainer.querySelectorAll('.option-row').length;
    if (totalRows <= 2) {
      showToast('A decision requires considering at least 2 alternative options.', 'error');
      return;
    }
    row.remove();
    ensureAtLeastOneRadioSelected();
    updateRemoveButtonsState();
  });

  return row;
}

/**
 * Appends a new alternative option row
 */
function addOptionRow(placeholder = '', val = '', isChecked = false) {
  const total = optionsContainer.querySelectorAll('.option-row').length + 1;
  const row = createOptionRow(placeholder || `Alternative Option ${total}`, val, isChecked);
  optionsContainer.appendChild(row);
  updateRemoveButtonsState();
}

/**
 * Guarantees that if the checked row was deleted, another row gets checked
 */
function ensureAtLeastOneRadioSelected() {
  const checkedRadio = optionsContainer.querySelector('.option-radio:checked');
  if (!checkedRadio) {
    const firstRadio = optionsContainer.querySelector('.option-radio');
    if (firstRadio) firstRadio.checked = true;
  }
}

/**
 * Disables remove buttons when only 2 rows remain
 */
function updateRemoveButtonsState() {
  const rows = optionsContainer.querySelectorAll('.option-row');
  const removeButtons = optionsContainer.querySelectorAll('.btn-remove-option');
  removeButtons.forEach((btn) => {
    btn.disabled = rows.length <= 2;
    btn.style.opacity = rows.length <= 2 ? '0.3' : '1';
    btn.style.cursor = rows.length <= 2 ? 'not-allowed' : 'pointer';
  });
}

/**
 * Sets default target review date to 30 days in the future
 */
function initializeDatePicker() {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 30);

  // Format as YYYY-MM-DD
  const formatYMD = (d) => d.toISOString().split('T')[0];

  reviewDateInput.min = formatYMD(today);
  reviewDateInput.value = formatYMD(futureDate);
}

/**
 * Form Submission Handler
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  // Extract form inputs
  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value;
  const description = document.getElementById('description').value.trim();
  const reasoning = document.getElementById('reasoning').value.trim();
  const confidence = parseInt(confidenceSlider.value, 10);
  const expectedOutcome = document.getElementById('expectedOutcome').value.trim();
  const reviewDate = reviewDateInput.value;
  const tagsRaw = document.getElementById('tags').value.trim();

  // Extract and validate options
  const optionRows = optionsContainer.querySelectorAll('.option-row');
  const options = [];
  let selectedOption = '';

  optionRows.forEach((row) => {
    const text = row.querySelector('.option-text-input').value.trim();
    const isChecked = row.querySelector('.option-radio').checked;
    if (text) {
      options.push(text);
      if (isChecked) {
        selectedOption = text;
      }
    }
  });

  // Client-Side Defensive Validation
  if (!title) {
    showToast('Please enter a decision title.', 'error');
    document.getElementById('title').focus();
    return;
  }

  if (options.length < 2) {
    showToast('Please list at least 2 distinct alternative options.', 'error');
    return;
  }

  if (!selectedOption) {
    showToast('Please select which option you have chosen using the radio button.', 'error');
    return;
  }

  if (!reasoning || reasoning.length < 10) {
    showToast('Please provide detailed reasoning (at least 10 characters).', 'error');
    document.getElementById('reasoning').focus();
    return;
  }

  if (!expectedOutcome || expectedOutcome.length < 5) {
    showToast('Please describe your expected outcome (at least 5 characters).', 'error');
    document.getElementById('expectedOutcome').focus();
    return;
  }

  if (!reviewDate) {
    showToast('Please select a target review date.', 'error');
    reviewDateInput.focus();
    return;
  }

  // Parse tags
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    : [];

  const payload = {
    title,
    category,
    description,
    options,
    selectedOption,
    reasoning,
    confidence,
    expectedOutcome,
    reviewDate: new Date(reviewDate).toISOString(),
    tags
  };

  // Submit via API
  try {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Locking In...';

    await API.createDecision(payload);

    showToast('Decision recorded successfully into history!', 'success');

    // Smooth redirect back to dashboard after brief pause to allow toast visibility
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (error) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Lock In Decision';
    showToast(error.message, 'error');
  }
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Options Builder with 3 default rows
  addOptionRow('e.g. MongoDB (Flexible schema, fast prototyping)', '', true);
  addOptionRow('e.g. PostgreSQL (Relational schema, ACID compliance)', '', false);
  addOptionRow('e.g. SQLite (Local embedded storage)', '', false);

  // 2. Add Alternative button listener
  btnAddOption.addEventListener('click', () => addOptionRow());

  // 3. Confidence Slider dynamic counter
  confidenceSlider.addEventListener('input', (e) => {
    confidenceValBadge.textContent = `${e.target.value}%`;
  });

  // 4. Initialize Datepicker
  initializeDatePicker();

  // 5. Attach Form Submit
  form.addEventListener('submit', handleFormSubmit);
});
