/**
 * ==========================================================================
 * DecisionVault Calendar Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements
  const monthYearLabel = document.getElementById('calendar-month-year');
  const cellsGrid = document.getElementById('calendar-cells-grid');
  const btnPrev = document.getElementById('btn-prev-month');
  const btnNext = document.getElementById('btn-next-month');
  const btnToday = document.getElementById('btn-today');
  const btnNavLogout = document.getElementById('btn-nav-logout');

  if (btnNavLogout) btnNavLogout.addEventListener('click', () => API.logout());

  let currentDate = new Date();
  let eventsList = [];

  // Fetch events from API
  try {
    const res = await API.getCalendarEvents();
    eventsList = res.data || [];
    renderCalendar();
  } catch (error) {
    showToast('Failed to load calendar events', 'error');
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Set Month Year header
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    monthYearLabel.textContent = `${monthName} ${year}`;

    // Clear cells
    cellsGrid.innerHTML = '';

    // First day of current month (0: Sun, 1: Mon, ...)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Total days in previous month
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Map events by date string: 'YYYY-MM-DD'
    const eventMap = {};
    eventsList.forEach((e) => {
      const dateKey = new Date(e.date).toISOString().split('T')[0];
      if (!eventMap[dateKey]) eventMap[dateKey] = [];
      eventMap[dateKey].push(e);
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Render Previous Month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const cell = document.createElement('div');
      cell.className = 'calendar-cell other-month';
      cell.innerHTML = `<span class="calendar-date-number">${dayNum}</span>`;
      cellsGrid.appendChild(cell);
    }

    // 2. Render Current Month days
    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';

      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      const isToday = dateKey === todayStr;

      cell.innerHTML = `
        <span class="calendar-date-number" style="${isToday ? 'color: var(--accent-primary); font-weight: 800;' : ''}">
          ${day} ${isToday ? '• Today' : ''}
        </span>
        <div style="display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; max-height: 80px;"></div>
      `;

      const eventsContainer = cell.querySelector('div');

      if (eventMap[dateKey]) {
        eventMap[dateKey].forEach((ev) => {
          const pill = document.createElement('a');
          pill.href = `/decision.html?id=${ev.decisionId}`;
          pill.title = ev.title;

          let typeClass = 'event-created';
          if (ev.type === 'due') typeClass = 'event-due';
          if (ev.type === 'reviewed') typeClass = 'event-reviewed';

          pill.className = `calendar-event-pill ${typeClass}`;
          pill.textContent = ev.title;
          eventsContainer.appendChild(pill);
        });
      }

      cellsGrid.appendChild(cell);
    }

    // 3. Render Next Month leading days to fill grid (total cells multiple of 7)
    const totalCellsRendered = firstDayIndex + totalDays;
    const remainingCells = 7 - (totalCellsRendered % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<span class="calendar-date-number">${i}</span>`;
        cellsGrid.appendChild(cell);
      }
    }
  }

  // Navigation handlers
  btnPrev.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  btnNext.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  btnToday.addEventListener('click', () => {
    currentDate = new Date();
    renderCalendar();
  });
});
