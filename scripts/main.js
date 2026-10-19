// scripts/main.js - Application controller, routing, event binding, and lifecycle
import * as db from './db.js';
import * as ui from './ui.js';
import * as chartModule from './chart.js';
import { filterExpenses, sortExpenses, paginateExpenses } from './filters.js';
import { debounce, formatDate, formatINR, generateId } from './utils.js';

// Application State
const state = {
  currentView: 'overview',
  activeTrip: { title: '', date: '' },
  filters: {
    search: '',
    period: 'all',
    category: 'all',
    paidBy: 'all',
    sortBy: 'date-desc',
    page: 1,
    pageSize: 10
  },
  editingExpenseId: null,
  editingExpenseTrip: null,
  theme: 'light'
};

const FILTER_PREFIXES = ['filter-', 'ct-filter-', 'all-filter-'];

/**
 * Initializes the entire application
 */
function initApp() {
  // 1. Initialize Theme
  state.theme = db.getSavedTheme();
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeToggleUI();

  // 2. Initialize Active Trip
  const savedActive = db.getActiveTrip();
  const trips = db.getAllTrips();
  const titles = Object.keys(trips);

  if (savedActive.title && trips[savedActive.title]) {
    state.activeTrip = savedActive;
  } else if (titles.length > 0) {
    const firstTitle = titles[0];
    const firstDate = trips[firstTitle].length > 0 ? trips[firstTitle][0].date : new Date().toISOString().split('T')[0];
    state.activeTrip = { title: firstTitle, date: firstDate };
    db.setActiveTrip(state.activeTrip.title, state.activeTrip.date);
  } else {
    state.activeTrip = { title: '', date: '' };
  }

  // 3. Setup Dropdowns
  ui.populateCategorySelect('expense-category', false);
  ui.populateCategorySelect('filter-category', true);
  ui.populateCategorySelect('ct-filter-category', true);
  ui.populateCategorySelect('all-filter-category', true);

  // 4. Bind DOM Event Listeners
  setupNavigationEvents();
  setupHeaderEvents();
  setupAllFilterEvents();
  setupExpenseModalEvents();
  setupTripModalEvents();
  setupSettingsEvents();

  // 5. Expose global methods for backward compatibility
  window.triggerEditMode = triggerEditMode;
  window.deleteExpense = handleDeleteExpense;
  window.loadTrip = handleSelectTrip;

  // 6. Initial Render
  updatePayerFilterOptions();
  renderCurrentView();
}

/**
 * Updates UI for theme toggle buttons
 */
function updateThemeToggleUI() {
  const isDark = state.theme === 'dark';
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    const label = btn.querySelector('.theme-label');
    if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  });
}

/**
 * Toggles dark/light theme
 */
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  db.saveTheme(state.theme);
  updateThemeToggleUI();
  ui.showToast(`Switched to ${state.theme} mode`, 'info', 2000);

  // Re-render charts with new theme colors
  const expenses = getExpensesForCurrentView();
  chartModule.renderCharts(expenses, state.theme === 'dark');
}

/**
 * Determines which expenses belong to the current view scope
 */
function getExpensesForCurrentView() {
  if (state.currentView === 'all-expenses') {
    return db.getAllExpenses();
  }
  return db.getTripExpenses(state.activeTrip.title);
}

/**
 * Updates the options in all Paid By filter dropdowns dynamically
 */
function updatePayerFilterOptions() {
  const expenses = getExpensesForCurrentView();
  const payers = new Set();
  expenses.forEach(e => {
    if (e.paidBy && e.paidBy.trim()) payers.add(e.paidBy.trim());
  });

  const payerList = Array.from(payers).sort();

  ['filter-payer', 'ct-filter-payer', 'all-filter-payer'].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="all">All Payers</option>';
    payerList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === state.filters.paidBy) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

/**
 * Synchronizes filter values across all toolbars
 */
function syncFilterInputsAcrossBars() {
  FILTER_PREFIXES.forEach(prefix => {
    const search = document.getElementById(`${prefix}search`);
    const period = document.getElementById(`${prefix}period`);
    const category = document.getElementById(`${prefix}category`);
    const payer = document.getElementById(`${prefix}payer`);
    const sort = document.getElementById(`${prefix}sort`);

    if (search && search.value !== state.filters.search) search.value = state.filters.search;
    if (period && period.value !== state.filters.period) period.value = state.filters.period;
    if (category && category.value !== state.filters.category) category.value = state.filters.category;
    if (payer && payer.value !== state.filters.paidBy) payer.value = state.filters.paidBy;
    if (sort && sort.value !== state.filters.sortBy) sort.value = state.filters.sortBy;
  });
}

/**
 * Renders the active view based on state.currentView
 */
function renderCurrentView() {
  updateHeaderInfo();

  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
  });

  // Highlight active nav item
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.view === state.currentView) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Show active view panel
  const activePanel = document.getElementById(`view-${state.currentView}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
    activePanel.setAttribute('aria-hidden', 'false');
  }

  const tripExpenses = db.getTripExpenses(state.activeTrip.title);
  const allExpenses = db.getAllExpenses();
  const isDark = state.theme === 'dark';

  syncFilterInputsAcrossBars();

  // Helper for filtered & paginated data
  const getProcessedData = (rawList) => {
    const filtered = filterExpenses(rawList, {
      period: state.filters.period,
      category: state.filters.category,
      paidBy: state.filters.paidBy,
      search: state.filters.search
    });
    const sorted = sortExpenses(filtered, state.filters.sortBy);
    const paginated = paginateExpenses(sorted, state.filters.page, state.filters.pageSize);
    return { filtered, sorted, paginated };
  };

  // Render view-specific content
  switch (state.currentView) {
    case 'overview': {
      ui.renderSummaryCards(tripExpenses, 'stat-');
      chartModule.renderCharts(tripExpenses, isDark);
      
      const { paginated } = getProcessedData(tripExpenses);
      ui.renderTable(paginated.items, {
        tbodyId: 'expense-table-body',
        emptyStateId: 'table-empty-state',
        tableContainerId: 'expense-table-container',
        onEdit: triggerEditMode,
        onDelete: handleDeleteExpense
      });
      ui.renderPagination(paginated, newPage => {
        state.filters.page = newPage;
        renderCurrentView();
      }, 'pagination-container');

      ui.renderBalances(tripExpenses, 'balances');
      break;
    }

    case 'current-trip': {
      ui.renderSummaryCards(tripExpenses, 'ct-stat-');
      const { paginated } = getProcessedData(tripExpenses);
      ui.renderTable(paginated.items, {
        tbodyId: 'ct-expense-table-body',
        emptyStateId: 'ct-table-empty-state',
        tableContainerId: 'ct-expense-table-container',
        onEdit: triggerEditMode,
        onDelete: handleDeleteExpense
      });
      ui.renderPagination(paginated, newPage => {
        state.filters.page = newPage;
        renderCurrentView();
      }, 'ct-pagination-container');

      ui.renderBalances(tripExpenses, 'ct-balances');
      break;
    }

    case 'all-expenses': {
      ui.renderSummaryCards(allExpenses, 'all-stat-');
      const { paginated } = getProcessedData(allExpenses);
      ui.renderTable(paginated.items, {
        tbodyId: 'all-expense-table-body',
        emptyStateId: 'all-table-empty-state',
        tableContainerId: 'all-expense-table-container',
        onEdit: triggerEditMode,
        onDelete: handleDeleteExpense
      });
      ui.renderPagination(paginated, newPage => {
        state.filters.page = newPage;
        renderCurrentView();
      }, 'all-pagination-container');
      break;
    }

    case 'trip-history': {
      const allTrips = db.getAllTrips();
      ui.renderTripHistory(
        allTrips,
        state.activeTrip.title,
        handleSelectTrip,
        handleDeleteTrip
      );
      break;
    }

    case 'analytics': {
      chartModule.renderCharts(tripExpenses, isDark);
      ui.renderCategoryBreakdownTable(tripExpenses, 'analytics-category-table-body');
      break;
    }

    case 'settlement': {
      ui.renderBalances(tripExpenses, 'settlement-balances-container');
      break;
    }

    case 'settings': {
      break;
    }
  }
}

/**
 * Updates top header with current trip name and date
 */
function updateHeaderInfo() {
  const titleEl = document.getElementById('header-trip-title');
  const dateEl = document.getElementById('header-trip-date');
  const badgeEl = document.getElementById('header-trip-badge');
  const tripSelector = document.getElementById('header-trip-select');
  const metaSepEl = document.getElementById('header-meta-sep');

  const allTrips = db.getAllTrips();
  const titles = Object.keys(allTrips);
  const hasTrip = Boolean(state.activeTrip.title && allTrips[state.activeTrip.title]);

  if (titleEl) {
    titleEl.textContent = hasTrip ? state.activeTrip.title : 'No Active Trip';
  }
  if (dateEl) {
    dateEl.textContent = hasTrip ? `Started: ${formatDate(state.activeTrip.date)}` : 'Create or select a trip to get started';
  }
  if (badgeEl) {
    badgeEl.style.display = hasTrip ? 'inline-flex' : 'none';
  }
  if (metaSepEl) {
    metaSepEl.style.display = hasTrip && titles.length > 1 ? 'inline' : 'none';
  }

  // Populate header quick trip switcher
  if (tripSelector) {
    if (hasTrip && titles.length > 1) {
      tripSelector.style.display = 'inline-block';
      tripSelector.innerHTML = '';
      titles.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === state.activeTrip.title) opt.selected = true;
        tripSelector.appendChild(opt);
      });
    } else {
      tripSelector.style.display = 'none';
      tripSelector.innerHTML = '';
    }
  }
}

/**
 * Navigation event bindings
 */
function setupNavigationEvents() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetView = link.dataset.view;
      if (targetView && targetView !== state.currentView) {
        state.currentView = targetView;
        state.filters.page = 1;
        updatePayerFilterOptions();
        renderCurrentView();
      }

      // Close mobile drawer if open
      const sidebar = document.getElementById('app-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('visible');
      }
    });
  });

  // Mobile Hamburger Toggle
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      if (backdrop) backdrop.classList.toggle('visible');
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('visible');
    });
  }
}

/**
 * Header event bindings
 */
function setupHeaderEvents() {
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  const tripSelect = document.getElementById('header-trip-select');
  if (tripSelect) {
    tripSelect.addEventListener('change', e => {
      handleSelectTrip(e.target.value);
    });
  }

  const headerAddBtn = document.getElementById('header-add-expense-btn');
  if (headerAddBtn) {
    headerAddBtn.addEventListener('click', () => openExpenseModal());
  }

  const headerNewTripBtn = document.getElementById('header-new-trip-btn');
  if (headerNewTripBtn) {
    headerNewTripBtn.addEventListener('click', () => openNewTripModal());
  }

  const legacyStartTrip = document.getElementById('startTrip');
  if (legacyStartTrip) {
    legacyStartTrip.addEventListener('click', () => openNewTripModal());
  }

  const legacyNewTrip = document.getElementById('newTrip');
  if (legacyNewTrip) {
    legacyNewTrip.addEventListener('click', () => openNewTripModal());
  }

  const legacyViewHistory = document.getElementById('viewHistory');
  if (legacyViewHistory) {
    legacyViewHistory.addEventListener('click', () => {
      state.currentView = 'trip-history';
      renderCurrentView();
    });
  }
}

/**
 * Binds all filter toolbars across views
 */
function setupAllFilterEvents() {
  FILTER_PREFIXES.forEach(prefix => {
    const searchInput = document.getElementById(`${prefix}search`);
    const periodSelect = document.getElementById(`${prefix}period`);
    const categorySelect = document.getElementById(`${prefix}category`);
    const payerSelect = document.getElementById(`${prefix}payer`);
    const sortSelect = document.getElementById(`${prefix}sort`);
    const clearFiltersBtn = document.getElementById(`${prefix}clear-btn`);

    if (searchInput) {
      searchInput.addEventListener(
        'input',
        debounce(e => {
          state.filters.search = e.target.value;
          state.filters.page = 1;
          renderCurrentView();
        }, 250)
      );
    }

    if (periodSelect) {
      periodSelect.addEventListener('change', e => {
        state.filters.period = e.target.value;
        state.filters.page = 1;
        renderCurrentView();
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', e => {
        state.filters.category = e.target.value;
        state.filters.page = 1;
        renderCurrentView();
      });
    }

    if (payerSelect) {
      payerSelect.addEventListener('change', e => {
        state.filters.paidBy = e.target.value;
        state.filters.page = 1;
        renderCurrentView();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        state.filters.sortBy = e.target.value;
        renderCurrentView();
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        state.filters.search = '';
        state.filters.period = 'all';
        state.filters.category = 'all';
        state.filters.paidBy = 'all';
        state.filters.sortBy = 'date-desc';
        state.filters.page = 1;
        syncFilterInputsAcrossBars();
        renderCurrentView();
        ui.showToast('Filters reset', 'info', 1500);
      });
    }
  });
}

/**
 * Add / Edit Expense Modal handling
 */
function setupExpenseModalEvents() {
  const modal = document.getElementById('expense-modal');
  const form = document.getElementById('expense-form');
  const closeBtn = document.getElementById('expense-modal-close');
  const cancelBtn = document.getElementById('expense-modal-cancel');

  if (closeBtn) closeBtn.addEventListener('click', closeExpenseModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeExpenseModal);

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeExpenseModal();
    });
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal && modal.classList.contains('modal-visible')) {
      closeExpenseModal();
    }
  });

  if (form) {
    form.addEventListener('submit', handleExpenseFormSubmit);
  }
}

/**
 * Opens Expense Modal in add or edit mode
 * @param {Object|null} expenseToEdit
 */
export function openExpenseModal(expenseToEdit = null) {
  const modal = document.getElementById('expense-modal');
  const form = document.getElementById('expense-form');
  const titleEl = document.getElementById('expense-modal-title');
  const submitBtn = document.getElementById('expense-submit-btn');

  if (!modal || !form) return;

  if (!state.activeTrip.title && !expenseToEdit) {
    ui.showConfirmDialog({
      title: 'No Active Trip',
      message: 'You need to create or select a trip before adding expenses. Would you like to create one now?',
      confirmText: 'Create Trip',
      onConfirm: () => openNewTripModal()
    });
    return;
  }

  form.reset();

  const dateInput = document.getElementById('expense-date');
  const todayStr = new Date().toISOString().split('T')[0];

  if (expenseToEdit) {
    state.editingExpenseId = expenseToEdit.id;
    state.editingExpenseTrip = expenseToEdit.tripTitle || state.activeTrip.title;

    if (titleEl) titleEl.textContent = 'Edit Expense';
    if (submitBtn) submitBtn.textContent = 'Update Expense';

    document.getElementById('expense-category').value = expenseToEdit.category;
    document.getElementById('expense-desc').value = expenseToEdit.description;
    document.getElementById('expense-amount').value = expenseToEdit.amount;
    document.getElementById('expense-payer').value = expenseToEdit.paidBy;
    if (dateInput) dateInput.value = expenseToEdit.date || todayStr;
  } else {
    state.editingExpenseId = null;
    state.editingExpenseTrip = null;

    if (titleEl) titleEl.textContent = 'Add New Expense';
    if (submitBtn) submitBtn.textContent = 'Save Expense';

    if (dateInput) {
      dateInput.value = state.activeTrip.date || todayStr;
    }
  }

  modal.classList.add('modal-visible');
  document.getElementById('expense-desc').focus();
}

/**
 * Closes Expense Modal
 */
export function closeExpenseModal() {
  const modal = document.getElementById('expense-modal');
  if (modal) modal.classList.remove('modal-visible');
  state.editingExpenseId = null;
  state.editingExpenseTrip = null;
}

/**
 * Expense form submit handler
 * @param {Event} e
 */
function handleExpenseFormSubmit(e) {
  e.preventDefault();

  const category = document.getElementById('expense-category').value.trim();
  const desc = document.getElementById('expense-desc').value.trim();
  const amountStr = document.getElementById('expense-amount').value.trim();
  const payer = document.getElementById('expense-payer').value.trim();
  const date = document.getElementById('expense-date').value.trim();

  if (!category) {
    ui.showToast('Please select a category.', 'error');
    return;
  }
  if (!desc) {
    ui.showToast('Please enter an expense description.', 'error');
    return;
  }
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    ui.showToast('Please enter a valid positive amount greater than 0.', 'error');
    return;
  }
  if (!payer) {
    ui.showToast('Please enter who paid for this expense.', 'error');
    return;
  }
  if (!date) {
    ui.showToast('Please select a valid date.', 'error');
    return;
  }

  const submitBtn = document.getElementById('expense-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (state.editingExpenseId) {
      const tripTitle = state.editingExpenseTrip || state.activeTrip.title;
      db.updateTripExpense(tripTitle, state.editingExpenseId, {
        category,
        description: desc,
        amount,
        paidBy: payer,
        date
      });
      ui.showToast('Expense updated successfully!', 'success');
    } else {
      const newExpense = {
        id: generateId(),
        tripTitle: state.activeTrip.title,
        category,
        description: desc,
        amount,
        paidBy: payer,
        date
      };
      db.saveTripExpense(state.activeTrip.title, newExpense);
      ui.showToast(`Added "${desc}" for ${formatINR(amount)}`, 'success');
    }

    closeExpenseModal();
    updatePayerFilterOptions();
    renderCurrentView();
  } catch (err) {
    console.error('Error saving expense', err);
    ui.showToast('Failed to save expense. Please try again.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Triggers edit mode for an expense ID
 * @param {string|number} id
 */
export function triggerEditMode(id) {
  const allTrips = db.getAllTrips();
  let found = null;

  for (const title in allTrips) {
    const match = allTrips[title].find(e => String(e.id) === String(id));
    if (match) {
      found = { ...match, tripTitle: title };
      break;
    }
  }

  if (found) {
    openExpenseModal(found);
  } else {
    ui.showToast('Could not find expense to edit.', 'error');
  }
}

/**
 * Handles expense deletion with custom confirmation dialog
 * @param {string|number} id
 */
export function handleDeleteExpense(id) {
  const allTrips = db.getAllTrips();
  let found = null;
  let tripName = state.activeTrip.title;

  for (const title in allTrips) {
    const match = allTrips[title].find(e => String(e.id) === String(id));
    if (match) {
      found = match;
      tripName = title;
      break;
    }
  }

  const desc = found ? `"${found.description}" (${formatINR(found.amount)})` : 'this expense';

  ui.showConfirmDialog({
    title: 'Delete Expense',
    message: `Are you sure you want to delete ${desc}? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    onConfirm: () => {
      db.deleteTripExpense(tripName, id);
      ui.showToast('Expense deleted successfully.', 'info');
      updatePayerFilterOptions();
      renderCurrentView();
    }
  });
}

/**
 * Trip Management Modal Handling
 */
function setupTripModalEvents() {
  const modal = document.getElementById('trip-modal');
  const form = document.getElementById('trip-form');
  const closeBtn = document.getElementById('trip-modal-close');
  const cancelBtn = document.getElementById('trip-modal-cancel');

  if (closeBtn) closeBtn.addEventListener('click', closeTripModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeTripModal);

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeTripModal();
    });
  }

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const titleInput = document.getElementById('trip-title-input');
      const dateInput = document.getElementById('trip-date-input');

      const title = titleInput.value.trim();
      const date = dateInput.value.trim();

      if (!title) {
        ui.showToast('Please enter a trip title.', 'error');
        return;
      }
      if (!date) {
        ui.showToast('Please enter a trip start date.', 'error');
        return;
      }

      try {
        db.createTrip(title, date);
        state.activeTrip = { title, date };
        closeTripModal();
        ui.showToast(`Trip "${title}" created and activated!`, 'success');
        updatePayerFilterOptions();
        renderCurrentView();
      } catch (err) {
        ui.showToast(err.message || 'Could not create trip.', 'error');
      }
    });
  }
}

export function openNewTripModal() {
  const modal = document.getElementById('trip-modal');
  const form = document.getElementById('trip-form');
  if (!modal || !form) return;

  form.reset();
  const dateInput = document.getElementById('trip-date-input');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  modal.classList.add('modal-visible');
  document.getElementById('trip-title-input').focus();
}

export function closeTripModal() {
  const modal = document.getElementById('trip-modal');
  if (modal) modal.classList.remove('modal-visible');
}

/**
 * Selects/Loads a trip as active
 * @param {string} title
 */
export function handleSelectTrip(title) {
  const trips = db.getAllTrips();
  if (!trips[title]) {
    ui.showToast(`Trip "${title}" not found.`, 'error');
    return;
  }

  const expenses = trips[title];
  const date = expenses.length > 0 ? expenses[0].date : new Date().toISOString().split('T')[0];
  state.activeTrip = { title, date };
  db.setActiveTrip(title, date);

  ui.showToast(`Loaded trip: "${title}"`, 'success');
  updatePayerFilterOptions();
  renderCurrentView();
}

/**
 * Deletes a trip with confirmation
 * @param {string} title
 */
export function handleDeleteTrip(title) {
  ui.showConfirmDialog({
    title: 'Delete Trip',
    message: `Are you sure you want to delete trip "${title}" and all its recorded expenses?`,
    confirmText: 'Delete Entire Trip',
    cancelText: 'Cancel',
    onConfirm: () => {
      db.deleteTrip(title);
      state.activeTrip = db.getActiveTrip();
      ui.showToast(`Trip "${title}" was deleted.`, 'info');
      updatePayerFilterOptions();
      renderCurrentView();
    }
  });
}

/**
 * Settings & Preferences view handlers
 */
function setupSettingsEvents() {
  // Export Data JSON
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataStr = db.exportAllDataJSON();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ui.showToast('Expense data exported successfully!', 'success');
    });
  }

  // Import Data JSON
  const importFile = document.getElementById('import-file-input');
  if (importFile) {
    importFile.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const content = event.target.result;
          ui.showConfirmDialog({
            title: 'Import Data',
            message: 'Would you like to merge this data with your existing trips, or replace all current data?',
            confirmText: 'Merge Data',
            cancelText: 'Replace All',
            onConfirm: () => {
              db.importDataJSON(content, true);
              state.activeTrip = db.getActiveTrip();
              ui.showToast('Data merged successfully!', 'success');
              updatePayerFilterOptions();
              renderCurrentView();
            }
          });
        } catch (err) {
          ui.showToast(err.message || 'Failed to import JSON.', 'error');
        }
      };
      reader.readAsText(file);
      importFile.value = '';
    });
  }

  // Reset All Data
  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ui.showConfirmDialog({
        title: 'Reset All Data',
        message: 'CAUTION: This will delete all trips, expenses, and settings permanently from this browser. Are you sure?',
        confirmText: 'Yes, Reset Everything',
        cancelText: 'Cancel',
        onConfirm: () => {
          db.resetAllData();
          state.activeTrip = { title: '', date: '' };
          ui.showToast('All data has been reset.', 'warning');
          updatePayerFilterOptions();
          renderCurrentView();
        }
      });
    });
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', initApp);
