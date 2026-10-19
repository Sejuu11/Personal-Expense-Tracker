// scripts/category.js - Category metadata, styling, and helper functions
import { escapeHTML } from './utils.js';

export const CATEGORIES = [
  {
    id: 'Food',
    name: 'Food & Dining',
    shortName: 'Food',
    icon: '🍽️',
    lucideIcon: 'utensils',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  {
    id: 'Travel',
    name: 'Travel & Flights',
    shortName: 'Travel',
    icon: '✈️',
    lucideIcon: 'plane',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.14)',
    borderColor: 'rgba(59, 130, 246, 0.3)'
  },
  {
    id: 'Accommodation',
    name: 'Accommodation & Hotel',
    shortName: 'Accommodation',
    icon: '🏨',
    lucideIcon: 'hotel',
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.14)',
    borderColor: 'rgba(139, 92, 246, 0.3)'
  },
  {
    id: 'Shopping',
    name: 'Shopping & Groceries',
    shortName: 'Shopping',
    icon: '🛍️',
    lucideIcon: 'shopping-bag',
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.14)',
    borderColor: 'rgba(236, 72, 153, 0.3)'
  },
  {
    id: 'Entertainment',
    name: 'Entertainment & Activities',
    shortName: 'Entertainment',
    icon: '🎬',
    lucideIcon: 'film',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  {
    id: 'Transport',
    name: 'Transport & Cab',
    shortName: 'Transport',
    icon: '🚗',
    lucideIcon: 'car',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  {
    id: 'Utilities',
    name: 'Utilities & Bills',
    shortName: 'Utilities',
    icon: '⚡',
    lucideIcon: 'zap',
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.14)',
    borderColor: 'rgba(6, 182, 212, 0.3)'
  },
  {
    id: 'Other',
    name: 'Other Expenses',
    shortName: 'Other',
    icon: '📦',
    lucideIcon: 'package',
    color: '#64748B',
    bgColor: 'rgba(100, 116, 139, 0.14)',
    borderColor: 'rgba(100, 116, 139, 0.3)'
  }
];

/**
 * Returns category metadata by id or name, with a safe fallback
 * @param {string} categoryName
 * @returns {Object}
 */
export function getCategoryDetails(categoryName) {
  if (!categoryName) {
    return CATEGORIES[CATEGORIES.length - 1]; // Other
  }

  const cleanName = categoryName.trim().toLowerCase();
  
  // Find exact match or partial match
  const found = CATEGORIES.find(
    c => c.id.toLowerCase() === cleanName || 
         c.name.toLowerCase() === cleanName ||
         c.shortName.toLowerCase() === cleanName
  );

  if (found) return found;

  // Fallback for custom category entered by user
  return {
    id: categoryName,
    name: categoryName,
    shortName: categoryName,
    icon: '🏷️',
    lucideIcon: 'tag',
    color: '#64748B',
    bgColor: 'rgba(100, 116, 139, 0.14)',
    borderColor: 'rgba(100, 116, 139, 0.3)'
  };
}

/**
 * Generates an HTML badge string for a category
 * @param {string} categoryName
 * @returns {string} HTML markup
 */
export function renderCategoryBadge(categoryName) {
  const cat = getCategoryDetails(categoryName);
  return `
    <span class="category-badge" style="--badge-color: ${cat.color}; --badge-bg: ${cat.bgColor}; --badge-border: ${cat.borderColor};">
      <span class="category-badge-icon" aria-hidden="true">${cat.icon}</span>
      <span class="category-badge-name">${escapeHTML(cat.shortName || cat.name)}</span>
    </span>
  `;
}
