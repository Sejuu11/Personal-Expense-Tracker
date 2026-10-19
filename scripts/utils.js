// scripts/utils.js - Utility functions for formatting, calculations, and security

/**
 * Formats a number into Indian Rupee format (e.g. ₹1,25,000.00)
 * Uses Intl.NumberFormat with 'en-IN' locale.
 * @param {number|string} amount
 * @param {boolean} includeDecimals
 * @returns {string} Formatted currency string
 */
export function formatINR(amount, includeDecimals = true) {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(numericAmount)) {
    return '₹0.00';
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: includeDecimals ? 2 : 0
    }).format(numericAmount);
  } catch (e) {
    // Fallback if Intl fails
    const fixed = numericAmount.toFixed(includeDecimals ? 2 : 0);
    return '₹' + fixed;
  }
}

/**
 * Formats an ISO or YYYY-MM-DD date string into a clean, human-readable format
 * e.g., "19 Oct 2026"
 * @param {string} dateString
 * @param {object} options
 * @returns {string}
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return '—';
  
  // If it's YYYY-MM-DD, parse as local date to prevent timezone shift
  let dateObj;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = new Date(dateString);
  }

  if (isNaN(dateObj.getTime())) {
    return dateString;
  }

  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  };

  return dateObj.toLocaleDateString('en-IN', defaultOptions);
}

/**
 * Escapes unsafe HTML characters to prevent XSS attacks when injecting strings.
 * @param {string} str
 * @returns {string} Safe escaped string
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates a unique ID for expenses or trips
 * @returns {number}
 */
export function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Calculates equal-share participant balances and optimal settlement transactions.
 * Minimizes the number of cash transfers between people.
 * 
 * @param {Array} expenses - Array of expense objects with { amount, paidBy }
 * @returns {Object} Settlement calculation results
 */
export function calculateSettlement(expenses = []) {
  if (!expenses || expenses.length === 0) {
    return {
      members: [],
      totalSpent: 0,
      sharePerPerson: 0,
      memberStats: [],
      settlements: [],
      isSettled: true
    };
  }

  // Identify all unique participants (trimmed, case-preserved)
  const memberSet = new Set();
  expenses.forEach(exp => {
    if (exp.paidBy && exp.paidBy.trim()) {
      memberSet.add(exp.paidBy.trim());
    }
  });

  const members = Array.from(memberSet);
  if (members.length === 0) {
    return {
      members: [],
      totalSpent: 0,
      sharePerPerson: 0,
      memberStats: [],
      settlements: [],
      isSettled: true
    };
  }

  // Total spent across all expenses
  const totalSpent = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const memberCount = members.length;
  const sharePerPerson = memberCount > 0 ? totalSpent / memberCount : 0;

  // Calculate total paid by each member
  const paidMap = {};
  members.forEach(m => {
    paidMap[m] = 0;
  });

  expenses.forEach(exp => {
    const payer = exp.paidBy ? exp.paidBy.trim() : '';
    if (payer && paidMap[payer] !== undefined) {
      paidMap[payer] += (parseFloat(exp.amount) || 0);
    }
  });

  // Calculate net balances: positive means they should receive, negative means they owe
  const balanceMap = {};
  const memberStats = members.map(member => {
    const paid = paidMap[member];
    const net = paid - sharePerPerson;
    balanceMap[member] = net;

    return {
      name: member,
      paid: paid,
      share: sharePerPerson,
      netBalance: net, // > 0: gets back, < 0: owes, == 0: settled
      status: Math.abs(net) < 0.01 ? 'settled' : (net > 0 ? 'receive' : 'owe')
    };
  });

  // Sort member stats by paid descending
  memberStats.sort((a, b) => b.paid - a.paid);

  // Settlement optimization algorithm:
  // Debtors have negative balance, Creditors have positive balance
  const debtors = [];
  const creditors = [];

  // Deep clone balance map for settlement calculations
  const workingBalances = {};
  members.forEach(m => {
    const bal = balanceMap[m];
    workingBalances[m] = bal;
    if (bal < -0.01) {
      debtors.push({ name: m, amount: Math.abs(bal) });
    } else if (bal > 0.01) {
      creditors.push({ name: m, amount: bal });
    }
  });

  // Sort debtors and creditors descending by amount to minimize transactions
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.009) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: Math.round(settleAmount * 100) / 100
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return {
    members,
    totalSpent,
    sharePerPerson,
    memberStats,
    settlements,
    isSettled: settlements.length === 0
  };
}

/**
 * Debounce helper for inputs
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
