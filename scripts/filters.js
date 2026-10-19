// scripts/filters.js - Filtering, searching, sorting, and pagination logic

/**
 * Legacy period filter generator for backward compatibility
 * @param {string} period 'today' | 'week' | 'month' | 'year' | 'all'
 * @returns {Function}
 */
export function getPeriodFilter(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return function (expense) {
    if (!period || period === 'all') return true;
    if (!expense.date) return false;

    // Parse date safely
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(expense.date)) {
      const [year, month, day] = expense.date.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(expense.date);
    }
    date.setHours(0, 0, 0, 0);

    if (period === 'today') {
      return date.getTime() === today.getTime();
    }
    if (period === 'week') {
      const startOfWeek = new Date(today);
      const dayIndex = today.getDay(); // 0 is Sunday
      startOfWeek.setDate(today.getDate() - dayIndex);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return date >= startOfWeek && date <= endOfWeek;
    }
    if (period === 'month') {
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }
    if (period === 'year') {
      return date.getFullYear() === today.getFullYear();
    }
    return true;
  };
}

/**
 * Comprehensive filter function for expenses
 * @param {Array} expenses
 * @param {Object} filterOptions
 * @returns {Array} Filtered expenses
 */
export function filterExpenses(expenses = [], filterOptions = {}) {
  const {
    period = 'all',
    category = 'all',
    paidBy = 'all',
    search = ''
  } = filterOptions;

  const periodPredicate = getPeriodFilter(period);
  const normalizedSearch = search.trim().toLowerCase();

  return expenses.filter(exp => {
    // 1. Period check
    if (!periodPredicate(exp)) {
      return false;
    }

    // 2. Category check
    if (category && category !== 'all') {
      if ((exp.category || '').toLowerCase() !== category.toLowerCase()) {
        return false;
      }
    }

    // 3. Paid By check
    if (paidBy && paidBy !== 'all') {
      if ((exp.paidBy || '').toLowerCase() !== paidBy.toLowerCase()) {
        return false;
      }
    }

    // 4. Search query check (matches description, category, payer, amount, or trip title)
    if (normalizedSearch) {
      const matchDesc = (exp.description || '').toLowerCase().includes(normalizedSearch);
      const matchCategory = (exp.category || '').toLowerCase().includes(normalizedSearch);
      const matchPayer = (exp.paidBy || '').toLowerCase().includes(normalizedSearch);
      const matchAmount = String(exp.amount || '').includes(normalizedSearch);
      const matchTrip = (exp.tripTitle || '').toLowerCase().includes(normalizedSearch);

      if (!matchDesc && !matchCategory && !matchPayer && !matchAmount && !matchTrip) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts expenses based on selected sort criteria
 * @param {Array} expenses
 * @param {string} sortBy 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category-asc' | 'description-asc'
 * @returns {Array} Sorted copy of expenses
 */
export function sortExpenses(expenses = [], sortBy = 'date-desc') {
  const list = [...expenses];

  return list.sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return new Date(a.date || 0) - new Date(b.date || 0);

      case 'date-desc':
        return new Date(b.date || 0) - new Date(a.date || 0);

      case 'amount-asc':
        return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);

      case 'amount-desc':
        return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);

      case 'category-asc':
        return (a.category || '').localeCompare(b.category || '');

      case 'category-desc':
        return (b.category || '').localeCompare(a.category || '');

      case 'description-asc':
        return (a.description || '').localeCompare(b.description || '');

      case 'description-desc':
        return (b.description || '').localeCompare(a.description || '');

      default:
        return new Date(b.date || 0) - new Date(a.date || 0);
    }
  });
}

/**
 * Paginates an array of items
 * @param {Array} items
 * @param {number} page 1-indexed
 * @param {number} perPage
 * @returns {Object}
 */
export function paginateExpenses(items = [], page = 1, perPage = 10) {
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / perPage) || 1;
  const validPage = Math.max(1, Math.min(page, totalPages));

  const startIndex = (validPage - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, totalCount);
  const paginatedList = items.slice(startIndex, endIndex);

  return {
    items: paginatedList,
    totalPages,
    currentPage: validPage,
    totalCount,
    startIndex: totalCount > 0 ? startIndex + 1 : 0,
    endIndex
  };
}
