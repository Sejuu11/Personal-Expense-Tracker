// scripts/db.js - Centralized database & localStorage operations with backward compatibility

const STORAGE_KEYS = {
  ALL_TRIPS: 'allTrips',
  LEGACY_EXPENSES: 'advanced_expenses',
  CURRENT_TRIP: 'expense_tracker_active_trip',
  TRIP_METADATA: 'expense_tracker_trip_meta',
  THEME: 'expense_tracker_theme'
};

/**
 * Initializes and auto-migrates any legacy data found in localStorage
 */
function initDB() {
  try {
    // 1. Check if legacy expenses exist in 'advanced_expenses'
    const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_EXPENSES);
    const tripsRaw = localStorage.getItem(STORAGE_KEYS.ALL_TRIPS);
    
    let trips = {};
    if (tripsRaw) {
      try {
        trips = JSON.parse(tripsRaw) || {};
      } catch (e) {
        console.error('Failed to parse allTrips from localStorage', e);
        trips = {};
      }
    }

    // If legacy expenses exist and aren't migrated, merge them
    if (legacyRaw) {
      try {
        const legacyExpenses = JSON.parse(legacyRaw);
        if (Array.isArray(legacyExpenses) && legacyExpenses.length > 0) {
          // If no trips exist yet, create a "General Expenses" trip
          const defaultTripName = 'General Expenses';
          if (!trips[defaultTripName]) {
            trips[defaultTripName] = [];
          }
          
          legacyExpenses.forEach(item => {
            const tripName = item.tripTitle || defaultTripName;
            if (!trips[tripName]) {
              trips[tripName] = [];
            }
            // Avoid duplicate ID injection
            const exists = trips[tripName].some(e => e.id === item.id);
            if (!exists) {
              trips[tripName].push({
                id: item.id || Date.now() + Math.random(),
                tripTitle: tripName,
                date: item.date || new Date().toISOString().split('T')[0],
                category: item.category || 'Other',
                description: item.description || 'Expense',
                amount: parseFloat(item.amount) || 0,
                paidBy: item.paidBy || 'Self'
              });
            }
          });
          
          localStorage.setItem(STORAGE_KEYS.ALL_TRIPS, JSON.stringify(trips));
        }
      } catch (err) {
        console.warn('Could not parse legacy expenses', err);
      }
    }

    // If the demo "Goa Vacation" was previously seeded, remove it so only real user data is used
    if (trips['Goa Vacation'] && Array.isArray(trips['Goa Vacation'])) {
      const isDemo = trips['Goa Vacation'].some(e => e.id === 1700000001);
      if (isDemo) {
        delete trips['Goa Vacation'];
        localStorage.setItem(STORAGE_KEYS.ALL_TRIPS, JSON.stringify(trips));
        try {
          const activeRaw = localStorage.getItem(STORAGE_KEYS.CURRENT_TRIP);
          if (activeRaw && JSON.parse(activeRaw).title === 'Goa Vacation') {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_TRIP);
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('Storage access error during initDB', e);
  }
}

// Auto-run initialization
initDB();

/**
 * Returns all trips object: { [tripTitle: string]: Expense[] }
 */
export function getAllTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALL_TRIPS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error reading allTrips', e);
    return {};
  }
}

/**
 * Saves all trips object to localStorage
 * @param {Object} trips
 */
export function saveAllTrips(trips) {
  try {
    localStorage.setItem(STORAGE_KEYS.ALL_TRIPS, JSON.stringify(trips));
    
    // Also keep legacy advanced_expenses synced with flattened list for safety
    const allExpenses = [];
    Object.keys(trips).forEach(title => {
      if (Array.isArray(trips[title])) {
        allExpenses.push(...trips[title]);
      }
    });
    localStorage.setItem(STORAGE_KEYS.LEGACY_EXPENSES, JSON.stringify(allExpenses));
  } catch (e) {
    console.error('Error saving allTrips', e);
  }
}

/**
 * Gets expenses for a specific trip
 * @param {string} tripTitle
 * @returns {Array}
 */
export function getTripExpenses(tripTitle) {
  if (!tripTitle) return [];
  const trips = getAllTrips();
  return trips[tripTitle] || [];
}

/**
 * Returns a flat array of all expenses across all trips
 * @returns {Array}
 */
export function getAllExpenses() {
  const trips = getAllTrips();
  const all = [];
  Object.keys(trips).forEach(title => {
    if (Array.isArray(trips[title])) {
      trips[title].forEach(item => {
        all.push({ ...item, tripTitle: item.tripTitle || title });
      });
    }
  });
  // Sort by date descending
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Saves an expense into a given trip
 * @param {string} tripTitle
 * @param {Object} expense
 */
export function saveTripExpense(tripTitle, expense) {
  const trips = getAllTrips();
  if (!trips[tripTitle]) {
    trips[tripTitle] = [];
  }
  trips[tripTitle].push(expense);
  saveAllTrips(trips);
}

/**
 * Updates an existing expense in a trip
 * @param {string} tripTitle
 * @param {number|string} expenseId
 * @param {Object} updatedData
 */
export function updateTripExpense(tripTitle, expenseId, updatedData) {
  const trips = getAllTrips();
  if (!trips[tripTitle]) return false;

  const index = trips[tripTitle].findIndex(e => String(e.id) === String(expenseId));
  if (index !== -1) {
    trips[tripTitle][index] = { ...trips[tripTitle][index], ...updatedData };
    saveAllTrips(trips);
    return true;
  }
  return false;
}

/**
 * Deletes an expense by ID from a given trip (or searches all trips if tripTitle is omitted)
 * @param {string} tripTitle
 * @param {number|string} expenseId
 */
export function deleteTripExpense(tripTitle, expenseId) {
  const trips = getAllTrips();
  if (tripTitle && trips[tripTitle]) {
    trips[tripTitle] = trips[tripTitle].filter(e => String(e.id) !== String(expenseId));
    saveAllTrips(trips);
    return true;
  }

  // Fallback: search across all trips
  let found = false;
  Object.keys(trips).forEach(t => {
    const originalLength = trips[t].length;
    trips[t] = trips[t].filter(e => String(e.id) !== String(expenseId));
    if (trips[t].length !== originalLength) {
      found = true;
    }
  });

  if (found) {
    saveAllTrips(trips);
  }
  return found;
}

/**
 * Creates a new trip with given title and date
 * @param {string} title
 * @param {string} startDate
 */
export function createTrip(title, startDate) {
  const trips = getAllTrips();
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Trip title cannot be empty.');
  if (trips[trimmed]) throw new Error('A trip with this title already exists.');

  trips[trimmed] = [];
  saveAllTrips(trips);
  setActiveTrip(trimmed, startDate || new Date().toISOString().split('T')[0]);
  return trimmed;
}

/**
 * Deletes a trip entirely
 * @param {string} title
 */
export function deleteTrip(title) {
  const trips = getAllTrips();
  if (trips[title]) {
    delete trips[title];
    saveAllTrips(trips);

    // If active trip was deleted, reset active trip
    const active = getActiveTrip();
    if (active.title === title) {
      const remainingTitles = Object.keys(trips);
      if (remainingTitles.length > 0) {
        const nextTitle = remainingTitles[0];
        const nextDate = trips[nextTitle].length > 0 ? trips[nextTitle][0].date : new Date().toISOString().split('T')[0];
        setActiveTrip(nextTitle, nextDate);
      } else {
        setActiveTrip('', '');
      }
    }
    return true;
  }
  return false;
}

/**
 * Gets active trip info
 * @returns {{ title: string, date: string }}
 */
export function getActiveTrip() {
  const trips = getAllTrips();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_TRIP);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.title && trips[parsed.title]) {
        return parsed;
      }
    }
  } catch (e) {}

  // Fallback to first trip if any
  const titles = Object.keys(trips);
  if (titles.length > 0) {
    const title = titles[0];
    const date = trips[title].length > 0 ? trips[title][0].date : new Date().toISOString().split('T')[0];
    return { title, date };
  }

  return { title: '', date: '' };
}

/**
 * Sets active trip info
 * @param {string} title
 * @param {string} date
 */
export function setActiveTrip(title, date) {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TRIP, JSON.stringify({ title, date }));
  } catch (e) {
    console.error('Error saving active trip', e);
  }
}

/**
 * Theme management
 */
export function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
}

export function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

/**
 * Exports all data to a clean JSON string
 */
export function exportAllDataJSON() {
  const trips = getAllTrips();
  const active = getActiveTrip();
  const payload = {
    app: 'ExpenseTrackerPro',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    activeTrip: active,
    trips: trips
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports data from JSON safely
 * @param {string} jsonString
 * @param {boolean} merge - If true, merges with existing; if false, replaces
 */
export function importDataJSON(jsonString, merge = false) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid JSON format.');
  }

  // Handle both exported payload format and raw allTrips object
  let tripsToImport = {};
  if (parsed && parsed.trips && typeof parsed.trips === 'object') {
    tripsToImport = parsed.trips;
  } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    tripsToImport = parsed;
  } else if (Array.isArray(parsed)) {
    // Array of expenses
    tripsToImport = { 'Imported Trip': parsed };
  } else {
    throw new Error('Unrecognized data structure in JSON.');
  }

  // Validate trips structure
  for (const tripTitle in tripsToImport) {
    if (!Array.isArray(tripsToImport[tripTitle])) {
      throw new Error(`Data for trip "${tripTitle}" must be an array of expenses.`);
    }
  }

  const existingTrips = merge ? getAllTrips() : {};
  const mergedTrips = { ...existingTrips };

  for (const tripTitle in tripsToImport) {
    if (!mergedTrips[tripTitle]) {
      mergedTrips[tripTitle] = [];
    }
    
    // Ensure all items have valid fields
    const importedExpenses = tripsToImport[tripTitle].map(item => ({
      id: item.id || (Date.now() + Math.floor(Math.random() * 10000)),
      tripTitle: item.tripTitle || tripTitle,
      date: item.date || new Date().toISOString().split('T')[0],
      category: item.category || 'Other',
      description: item.description || 'Expense',
      amount: parseFloat(item.amount) || 0,
      paidBy: item.paidBy || 'Self'
    }));

    if (merge) {
      // Append only items with non-colliding IDs
      importedExpenses.forEach(exp => {
        if (!mergedTrips[tripTitle].some(e => e.id === exp.id)) {
          mergedTrips[tripTitle].push(exp);
        }
      });
    } else {
      mergedTrips[tripTitle] = importedExpenses;
    }
  }

  saveAllTrips(mergedTrips);

  // Set active trip if available
  const titles = Object.keys(mergedTrips);
  if (titles.length > 0) {
    const firstTitle = (parsed.activeTrip && parsed.activeTrip.title && mergedTrips[parsed.activeTrip.title])
      ? parsed.activeTrip.title
      : titles[0];
    const firstDate = mergedTrips[firstTitle].length > 0 ? mergedTrips[firstTitle][0].date : new Date().toISOString().split('T')[0];
    setActiveTrip(firstTitle, firstDate);
  }

  return true;
}

/**
 * Resets all data in localStorage
 */
export function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.ALL_TRIPS);
  localStorage.removeItem(STORAGE_KEYS.LEGACY_EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_TRIP);
  localStorage.removeItem(STORAGE_KEYS.TRIP_METADATA);
}

// Backward compatibility methods
export function getExpenses() {
  return getAllExpenses();
}

export function saveExpense(expense) {
  const active = getActiveTrip();
  const title = active.title || 'General Expenses';
  saveTripExpense(title, expense);
}
