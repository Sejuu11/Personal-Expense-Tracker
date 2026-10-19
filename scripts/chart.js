// scripts/chart.js - Chart visualizations using Chart.js with theme awareness and safe instance management
import { formatINR, formatDate } from './utils.js';
import { getCategoryDetails } from './category.js';

// Registry of active Chart instances keyed by canvas ID
const chartRegistry = {};

/**
 * Gets theme-aware colors for Chart.js
 * @param {boolean} isDark
 */
function getThemeColors(isDark) {
  return {
    textColor: isDark ? '#94A3B8' : '#64748B',
    titleColor: isDark ? '#F1F5F9' : '#0F172A',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
    borderColor: isDark ? '#1F2937' : '#FFFFFF',
    tooltipBg: isDark ? '#1F2937' : '#0F172A',
    tooltipText: isDark ? '#F8FAFC' : '#FFFFFF'
  };
}

/**
 * Destroys a chart instance safely
 * @param {string} canvasId
 */
export function destroyChart(canvasId) {
  if (chartRegistry[canvasId]) {
    try {
      chartRegistry[canvasId].destroy();
    } catch (e) {
      console.warn(`Error destroying chart ${canvasId}`, e);
    }
    delete chartRegistry[canvasId];
  }
}

/**
 * Destroys all active chart instances
 */
export function destroyAllCharts() {
  Object.keys(chartRegistry).forEach(canvasId => {
    destroyChart(canvasId);
  });
}

/**
 * Renders all charts across Overview and Analytics views
 * @param {Array} expenses
 * @param {boolean} isDark
 */
export function renderCharts(expenses = [], isDark = false) {
  if (typeof window.Chart === 'undefined') {
    console.warn('Chart.js library is not available.');
    return;
  }

  const theme = getThemeColors(isDark);

  // Overview Charts
  renderCategoryDonut('categoryChart', 'categoryChartEmpty', expenses, theme);
  renderTimelineChart('timelineChart', 'timelineChartEmpty', expenses, theme);

  // Analytics Detailed Charts
  renderCategoryDonut('analyticsCategoryChart', 'analyticsCategoryChartEmpty', expenses, theme);
  renderTimelineChart('analyticsTimelineChart', 'analyticsTimelineChartEmpty', expenses, theme);
  renderParticipantChart('analyticsParticipantChart', 'analyticsParticipantChartEmpty', expenses, theme);
}

/**
 * Category Distribution Donut Chart
 */
function renderCategoryDonut(canvasId, emptyId, expenses, theme) {
  const canvas = document.getElementById(canvasId);
  const emptyNotice = document.getElementById(emptyId);
  if (!canvas) return;

  destroyChart(canvasId);

  if (!expenses || expenses.length === 0) {
    canvas.style.display = 'none';
    if (emptyNotice) emptyNotice.style.display = 'flex';
    return;
  }

  canvas.style.display = 'block';
  if (emptyNotice) emptyNotice.style.display = 'none';

  // Aggregate by category
  const categoryTotals = {};
  let grandTotal = 0;

  expenses.forEach(exp => {
    const cat = exp.category || 'Other';
    const amount = parseFloat(exp.amount) || 0;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    grandTotal += amount;
  });

  const labels = Object.keys(categoryTotals);
  const data = labels.map(l => categoryTotals[l]);
  const bgColors = labels.map(l => getCategoryDetails(l).color);

  const ctx = canvas.getContext('2d');
  chartRegistry[canvasId] = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: bgColors,
          borderColor: theme.borderColor,
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: theme.textColor,
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function (context) {
              const val = context.raw || 0;
              const percent = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${formatINR(val)} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Spending by Date Timeline Chart
 */
function renderTimelineChart(canvasId, emptyId, expenses, theme) {
  const canvas = document.getElementById(canvasId);
  const emptyNotice = document.getElementById(emptyId);
  if (!canvas) return;

  destroyChart(canvasId);

  if (!expenses || expenses.length === 0) {
    canvas.style.display = 'none';
    if (emptyNotice) emptyNotice.style.display = 'flex';
    return;
  }

  canvas.style.display = 'block';
  if (emptyNotice) emptyNotice.style.display = 'none';

  // Group by date
  const dateTotals = {};
  expenses.forEach(exp => {
    const d = exp.date || 'Unknown';
    dateTotals[d] = (dateTotals[d] || 0) + (parseFloat(exp.amount) || 0);
  });

  const sortedDates = Object.keys(dateTotals).sort((a, b) => new Date(a) - new Date(b));
  const data = sortedDates.map(d => dateTotals[d]);
  const formattedLabels = sortedDates.map(d => formatDate(d, { day: 'numeric', month: 'short' }));

  const ctx = canvas.getContext('2d');
  chartRegistry[canvasId] = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: formattedLabels,
      datasets: [
        {
          label: 'Spending',
          data: data,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
          borderColor: '#10B981',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 34
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: "'Inter', sans-serif", size: 11 }
          }
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            font: { family: "'Inter', sans-serif", size: 11 },
            callback: function (val) {
              return '₹' + (val >= 1000 ? (val / 1000) + 'k' : val);
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function (context) {
              return ` Spent: ${formatINR(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

/**
 * Spending by Participant Horizontal Bar Chart
 */
function renderParticipantChart(canvasId, emptyId, expenses, theme) {
  const canvas = document.getElementById(canvasId);
  const emptyNotice = document.getElementById(emptyId);
  if (!canvas) return;

  destroyChart(canvasId);

  if (!expenses || expenses.length === 0) {
    canvas.style.display = 'none';
    if (emptyNotice) emptyNotice.style.display = 'flex';
    return;
  }

  canvas.style.display = 'block';
  if (emptyNotice) emptyNotice.style.display = 'none';

  // Group by paidBy
  const payerTotals = {};
  expenses.forEach(exp => {
    const payer = (exp.paidBy || 'Unknown').trim();
    payerTotals[payer] = (payerTotals[payer] || 0) + (parseFloat(exp.amount) || 0);
  });

  const payers = Object.keys(payerTotals).sort((a, b) => payerTotals[b] - payerTotals[a]);
  const data = payers.map(p => payerTotals[p]);

  const ctx = canvas.getContext('2d');
  chartRegistry[canvasId] = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: payers,
      datasets: [
        {
          label: 'Total Paid',
          data: data,
          backgroundColor: 'rgba(99, 102, 241, 0.75)',
          hoverBackgroundColor: 'rgba(99, 102, 241, 1)',
          borderColor: '#6366F1',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 28
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            font: { family: "'Inter', sans-serif", size: 11 },
            callback: function (val) {
              return '₹' + (val >= 1000 ? (val / 1000) + 'k' : val);
            }
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: "'Inter', sans-serif", size: 12, weight: '500' }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function (context) {
              return ` Paid: ${formatINR(context.raw)}`;
            }
          }
        }
      }
    }
  });
}
