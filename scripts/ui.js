// scripts/ui.js - View rendering, components, modals, toasts, and DOM interactions
import { formatINR, formatDate, escapeHTML, calculateSettlement } from './utils.js';
import { getCategoryDetails, renderCategoryBadge, CATEGORIES } from './category.js';

/**
 * Toast Notification System
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration
 */
export function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || '•'}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  const removeToast = () => {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 250);
  };

  toast.querySelector('.toast-close').addEventListener('click', removeToast);
  const timeoutId = setTimeout(removeToast, duration);

  toast.addEventListener('mouseenter', () => clearTimeout(timeoutId));
  toast.addEventListener('mouseleave', () => setTimeout(removeToast, 1500));
}

/**
 * Legacy status function for backward compatibility
 * @param {string} message
 */
export function showStatus(message) {
  showToast(message, 'success');
  const legacyStatus = document.getElementById('status');
  if (legacyStatus) {
    legacyStatus.textContent = message;
    legacyStatus.style.display = 'block';
    setTimeout(() => {
      if (legacyStatus) {
        legacyStatus.textContent = '';
        legacyStatus.style.display = 'none';
      }
    }, 3000);
  }
}

/**
 * Renders the top summary cards across various view panels
 * @param {Array} expenses
 * @param {string} prefix
 */
export function renderSummaryCards(expenses = [], prefix = 'stat-') {
  const totalAmountEl = document.getElementById(`${prefix}total-amount`);
  const totalCountEl = document.getElementById(`${prefix}total-count`);
  const avgAmountEl = document.getElementById(`${prefix}avg-amount`);
  const participantsCountEl = document.getElementById(`${prefix}participants-count`);
  const highestExpenseEl = document.getElementById(`${prefix}highest-expense`);

  if (!expenses || expenses.length === 0) {
    if (totalAmountEl) totalAmountEl.textContent = '₹0.00';
    if (totalCountEl) totalCountEl.textContent = '0';
    if (avgAmountEl) avgAmountEl.textContent = '₹0.00';
    if (participantsCountEl) participantsCountEl.textContent = '0';
    if (highestExpenseEl) highestExpenseEl.textContent = '₹0.00';
    return;
  }

  const count = expenses.length;
  const total = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const avg = count > 0 ? total / count : 0;

  const members = new Set();
  let highest = expenses[0];

  expenses.forEach(e => {
    if (e.paidBy && e.paidBy.trim()) members.add(e.paidBy.trim());
    if (parseFloat(e.amount) > parseFloat(highest.amount)) {
      highest = e;
    }
  });

  if (totalAmountEl) totalAmountEl.textContent = formatINR(total);
  if (totalCountEl) totalCountEl.textContent = count.toLocaleString('en-IN');
  if (avgAmountEl) avgAmountEl.textContent = formatINR(avg);
  if (participantsCountEl) participantsCountEl.textContent = members.size.toString();
  if (highestExpenseEl) {
    highestExpenseEl.innerHTML = `${formatINR(highest.amount)} <span class="stat-subtitle">(${escapeHTML(highest.description || 'Expense')})</span>`;
  }
}

/**
 * Renders transactions table
 * @param {Array} expenses - Filtered and paginated expenses
 * @param {Object} options - { tbodyId, emptyStateId, tableContainerId, showTripBadge, onEdit, onDelete }
 */
export function renderTable(expenses = [], options = {}) {
  const tbodyId = options.tbodyId || 'expense-table-body';
  const emptyStateId = options.emptyStateId || 'table-empty-state';
  const tableContainerId = options.tableContainerId || 'expense-table-container';

  const tbody = document.getElementById(tbodyId);
  const emptyState = document.getElementById(emptyStateId);
  const tableContainer = document.getElementById(tableContainerId);

  if (!tbody) return;
  tbody.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    if (tableContainer) tableContainer.classList.add('is-empty');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (tableContainer) tableContainer.classList.remove('is-empty');
  if (emptyState) emptyState.classList.add('hidden');

  expenses.forEach(exp => {
    const row = document.createElement('tr');
    row.className = 'expense-row';
    row.dataset.id = exp.id;

    const initial = (exp.paidBy || 'U').trim().charAt(0).toUpperCase();

    row.innerHTML = `
      <td class="col-date" data-label="Date">
        <span class="date-badge">${formatDate(exp.date)}</span>
      </td>
      <td class="col-category" data-label="Category">
        ${renderCategoryBadge(exp.category)}
      </td>
      <td class="col-desc" data-label="Description">
        <div class="expense-desc-wrapper">
          <span class="expense-title">${escapeHTML(exp.description)}</span>
          ${exp.tripTitle ? `<span class="expense-trip-tag">📍 ${escapeHTML(exp.tripTitle)}</span>` : ''}
        </div>
      </td>
      <td class="col-amount" data-label="Amount">
        <span class="amount-val">${formatINR(exp.amount)}</span>
      </td>
      <td class="col-payer" data-label="Paid By">
        <div class="payer-badge">
          <span class="payer-avatar" aria-hidden="true">${initial}</span>
          <span class="payer-name">${escapeHTML(exp.paidBy || 'Unknown')}</span>
        </div>
      </td>
      <td class="col-actions" data-label="Actions">
        <div class="action-btn-group">
          <button type="button" class="btn-icon edit-btn" data-id="${exp.id}" title="Edit expense" aria-label="Edit expense ${escapeHTML(exp.description)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span class="action-label">Edit</span>
          </button>
          <button type="button" class="btn-icon btn-icon-danger delete-btn" data-id="${exp.id}" title="Delete expense" aria-label="Delete expense ${escapeHTML(exp.description)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span class="action-label">Delete</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach event handlers
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      if (options.onEdit) {
        options.onEdit(id);
      } else if (typeof window.triggerEditMode === 'function') {
        window.triggerEditMode(id);
      }
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      if (options.onDelete) {
        options.onDelete(id);
      } else if (typeof window.deleteExpense === 'function') {
        window.deleteExpense(id);
      }
    });
  });
}

/**
 * Renders pagination controls
 * @param {Object} paginationInfo - { currentPage, totalPages, totalCount, startIndex, endIndex }
 * @param {Function} onPageChange
 * @param {string} containerId
 */
export function renderPagination(paginationInfo, onPageChange, containerId = 'pagination-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { currentPage, totalPages, totalCount, startIndex, endIndex } = paginationInfo;

  if (totalCount === 0 || totalPages <= 1) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = `
    <div class="pagination-info">
      Showing <strong>${startIndex}</strong> - <strong>${endIndex}</strong> of <strong>${totalCount}</strong> transactions
    </div>
    <div class="pagination-buttons">
      <button type="button" class="btn-pagination page-prev-btn" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Previous Page">
        ‹ Prev
      </button>
      <span class="page-indicator">Page ${currentPage} of ${totalPages}</span>
      <button type="button" class="btn-pagination page-next-btn" ${currentPage >= totalPages ? 'disabled' : ''} aria-label="Next Page">
        Next ›
      </button>
    </div>
  `;

  const prevBtn = container.querySelector('.page-prev-btn');
  const nextBtn = container.querySelector('.page-next-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1 && onPageChange) onPageChange(currentPage - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages && onPageChange) onPageChange(currentPage + 1);
    });
  }
}

/**
 * Renders the balances and settlements dashboard
 * @param {Array} expenses
 * @param {string} containerId
 */
export function renderBalances(expenses = [], containerId = 'balances') {
  const balancesDiv = document.getElementById(containerId);
  if (!balancesDiv) return;

  balancesDiv.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    balancesDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚖️</div>
        <h3>No Expenses to Settle</h3>
        <p>Add expenses with participants to calculate equal share balances and direct settlements.</p>
      </div>
    `;
    return;
  }

  const { members, totalSpent, sharePerPerson, memberStats, settlements, isSettled } = calculateSettlement(expenses);

  if (members.length === 0) {
    balancesDiv.innerHTML = `
      <div class="empty-state">
        <p>No participant information recorded yet.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="settlement-dashboard">
      <!-- Settlement Top Banner -->
      <div class="settlement-banner">
        <div class="banner-stat">
          <span class="banner-label">Total Spend</span>
          <span class="banner-value">${formatINR(totalSpent)}</span>
        </div>
        <div class="banner-divider"></div>
        <div class="banner-stat">
          <span class="banner-label">Participants</span>
          <span class="banner-value">${members.length}</span>
        </div>
        <div class="banner-divider"></div>
        <div class="banner-stat">
          <span class="banner-label">Equal Share Each</span>
          <span class="banner-value text-accent">${formatINR(sharePerPerson)}</span>
        </div>
      </div>

      <div class="settlement-rule-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>All expenses are split equally among ${members.length} participants (${formatINR(sharePerPerson)} per member).</span>
      </div>

      <!-- Member Balances Grid -->
      <h3 class="section-subtitle">Participant Balances</h3>
      <div class="member-cards-grid">
  `;

  memberStats.forEach(member => {
    const isCreditor = member.netBalance > 0.01;
    const isDebtor = member.netBalance < -0.01;
    const initial = member.name.charAt(0).toUpperCase();

    let balanceBadge = '';
    if (isCreditor) {
      balanceBadge = `<span class="balance-tag tag-receive">+${formatINR(member.netBalance)} (Gets back)</span>`;
    } else if (isDebtor) {
      balanceBadge = `<span class="balance-tag tag-owe">-${formatINR(Math.abs(member.netBalance))} (Owes)</span>`;
    } else {
      balanceBadge = `<span class="balance-tag tag-settled">Settled Up</span>`;
    }

    html += `
      <div class="member-card ${isCreditor ? 'card-creditor' : (isDebtor ? 'card-debtor' : 'card-settled')}">
        <div class="member-header">
          <div class="member-avatar">${initial}</div>
          <div class="member-info">
            <h4 class="member-name">${escapeHTML(member.name)}</h4>
            ${balanceBadge}
          </div>
        </div>
        <div class="member-details">
          <div class="detail-row">
            <span>Total Paid:</span>
            <strong>${formatINR(member.paid)}</strong>
          </div>
          <div class="detail-row">
            <span>Fair Share:</span>
            <span>${formatINR(member.share)}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <!-- Suggested Settlements -->
      <h3 class="section-subtitle">Optimal Direct Settlements (Fewest Transfers)</h3>
      <div class="settlement-steps">
  `;

  if (isSettled || settlements.length === 0) {
    html += `
      <div class="settled-notice">
        <div class="settled-icon">🎉</div>
        <h4>All Settled Up!</h4>
        <p>Everyone has paid their exact share. No balance transfers required.</p>
      </div>
    `;
  } else {
    settlements.forEach((s, idx) => {
      html += `
        <div class="settlement-item">
          <span class="settle-number">${idx + 1}</span>
          <div class="settle-body">
            <span class="settle-debtor">${escapeHTML(s.from)}</span>
            <span class="settle-arrow">➔ pays <strong>${formatINR(s.amount)}</strong> to</span>
            <span class="settle-creditor">${escapeHTML(s.to)}</span>
          </div>
          <span class="settle-badge">Pending</span>
        </div>
      `;
    });
  }

  html += `
      </div>
    </div>
  `;

  balancesDiv.innerHTML = html;
}

/**
 * Renders Category Breakdown Table in Analytics View
 * @param {Array} expenses
 * @param {string} tbodyId
 */
export function renderCategoryBreakdownTable(expenses = [], tbodyId = 'analytics-category-table-body') {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 2rem; color: var(--text-muted);">No expense records to analyze.</td></tr>`;
    return;
  }

  const categoryMap = {};
  let totalSpend = 0;

  expenses.forEach(e => {
    const cat = e.category || 'Other';
    const amt = parseFloat(e.amount) || 0;
    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, count: 0 };
    }
    categoryMap[cat].total += amt;
    categoryMap[cat].count += 1;
    totalSpend += amt;
  });

  const sortedCategories = Object.keys(categoryMap).sort((a, b) => categoryMap[b].total - categoryMap[a].total);

  sortedCategories.forEach((catName, index) => {
    const data = categoryMap[catName];
    const percentage = totalSpend > 0 ? ((data.total / totalSpend) * 100).toFixed(1) : 0;
    const catDetails = getCategoryDetails(catName);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>#${index + 1}</strong></td>
      <td>
        <span class="category-badge" style="--badge-color: ${catDetails.color}; --badge-bg: ${catDetails.bgColor}; --badge-border: ${catDetails.borderColor};">
          <span class="category-badge-icon">${catDetails.icon}</span>
          <span class="category-badge-name">${escapeHTML(catName)}</span>
        </span>
      </td>
      <td><strong>${formatINR(data.total)}</strong></td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="flex: 1; height: 6px; background-color: var(--border-color); border-radius: 3px; overflow: hidden; min-width: 60px;">
            <div style="width: ${percentage}%; height: 100%; background-color: ${catDetails.color};"></div>
          </div>
          <span>${percentage}%</span>
        </div>
      </td>
      <td>${data.count}</td>
    `;
    tbody.appendChild(row);
  });
}

/**
 * Renders the Trip History Grid
 * @param {Object} trips
 * @param {string} activeTripTitle
 * @param {Function} onLoadTrip
 * @param {Function} onDeleteTrip
 */
export function renderTripHistory(trips = {}, activeTripTitle = '', onLoadTrip, onDeleteTrip) {
  const listContainer = document.getElementById('trip-history-grid');
  if (!listContainer) return;

  const tripTitles = Object.keys(trips);
  listContainer.innerHTML = '';

  if (tripTitles.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✈️</div>
        <h3>No Trips Found</h3>
        <p>Start a new trip to record expenses and track balances.</p>
      </div>
    `;
    return;
  }

  tripTitles.forEach(title => {
    const expenses = trips[title] || [];
    const totalSpent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const date = expenses.length > 0 ? expenses[0].date : '';
    const isActive = title === activeTripTitle;

    const participants = new Set();
    expenses.forEach(e => {
      if (e.paidBy) participants.add(e.paidBy.trim());
    });

    const card = document.createElement('div');
    card.className = `trip-card ${isActive ? 'trip-card-active' : ''}`;
    card.innerHTML = `
      <div class="trip-card-header">
        <div class="trip-title-group">
          <h3 class="trip-card-title">${escapeHTML(title)}</h3>
          <span class="trip-card-date">📅 ${formatDate(date)}</span>
        </div>
        ${isActive ? '<span class="active-badge">Active Trip</span>' : ''}
      </div>

      <div class="trip-card-stats">
        <div class="trip-stat-item">
          <span class="trip-stat-label">Total Spend</span>
          <span class="trip-stat-val">${formatINR(totalSpent)}</span>
        </div>
        <div class="trip-stat-item">
          <span class="trip-stat-label">Transactions</span>
          <span class="trip-stat-val">${expenses.length}</span>
        </div>
        <div class="trip-stat-item">
          <span class="trip-stat-label">Members</span>
          <span class="trip-stat-val">${participants.size}</span>
        </div>
      </div>

      <div class="trip-card-actions">
        <button type="button" class="btn btn-secondary btn-sm load-trip-btn" data-title="${escapeHTML(title)}">
          ${isActive ? 'Viewing Active' : 'Load Trip'}
        </button>
        <button type="button" class="btn btn-ghost btn-sm btn-danger delete-trip-btn" data-title="${escapeHTML(title)}" title="Delete Trip">
          Delete
        </button>
      </div>
    `;

    card.querySelector('.load-trip-btn').addEventListener('click', () => {
      if (onLoadTrip) onLoadTrip(title);
    });

    card.querySelector('.delete-trip-btn').addEventListener('click', () => {
      if (onDeleteTrip) onDeleteTrip(title);
    });

    listContainer.appendChild(card);
  });
}

/**
 * Fills category dropdowns
 * @param {string} selectId
 * @param {boolean} includeAllOption
 */
export function populateCategorySelect(selectId, includeAllOption = false) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '';
  if (includeAllOption) {
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Categories';
    select.appendChild(allOpt);
  }

  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    select.appendChild(opt);
  });
}

/**
 * Custom Confirmation Dialog
 * @param {Object} options - { title, message, confirmText, cancelText, onConfirm }
 */
export function showConfirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm }) {
  const existing = document.getElementById('custom-confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'custom-confirm-modal';
  modal.className = 'modal-backdrop modal-visible';
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div class="modal-header">
        <h3 id="confirm-modal-title">${escapeHTML(title)}</h3>
        <button type="button" class="modal-close" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <p>${escapeHTML(message)}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary confirm-cancel">${escapeHTML(cancelText)}</button>
        <button type="button" class="btn btn-danger confirm-ok">${escapeHTML(confirmText)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeDialog = () => {
    modal.classList.remove('modal-visible');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.modal-close').addEventListener('click', closeDialog);
  modal.querySelector('.confirm-cancel').addEventListener('click', closeDialog);
  modal.querySelector('.confirm-ok').addEventListener('click', () => {
    closeDialog();
    if (onConfirm) onConfirm();
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) closeDialog();
  });

  const handleEsc = e => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}
