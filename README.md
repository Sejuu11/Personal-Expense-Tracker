# ExpenseTracker PRO — Personal & Group Expense Management

> A premium, responsive, SaaS-grade personal finance and group expense tracker with trip management, equal-split settlements, and interactive analytics.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![Vanilla JavaScript](https://img.shields.io/badge/ES6_Modules-F7DF1E?style=flat&logo=javascript&logoColor=black)
![LocalStorage](https://img.shields.io/badge/Storage-LocalStorage-success)
![No Build Required](https://img.shields.io/badge/Build-Zero_Config-blue)

---

## 🌟 Highlights & Key Features

### 1. Modern SaaS Financial Dashboard
- **Deep Navy Sidebar Navigation**: Dedicated desktop sidebar and responsive mobile drawer navigation across Overview, Current Trip, All Expenses, Trip History, Analytics, Settlement, and Settings.
- **Dark & Light Mode**: Working theme toggle with smooth transitions, persisting user preference in `localStorage`.
- **Indian Rupee (INR ₹) Formatting**: Formatted currency (`₹1,25,000.00`) following standard Indian numbering system (`Intl.NumberFormat('en-IN')`).

### 2. Multi-Trip & Event Management
- Create trips with custom titles and start dates.
- Switch between active trips in a click from the header dropdown or trip cards.
- Comprehensive Trip History view with total spend, transaction counts, participant counts, load trip, and trip deletion.
- Auto-initializes with a starter trip (*Goa Vacation*) for immediate out-of-the-box exploration.

### 3. Add & Edit Expense Experience
- Polished, accessible modal dialog with backdrop blur.
- Category dropdown with 8 color-coded categories (Food, Travel, Accommodation, Shopping, Entertainment, Transport, Utilities, Other).
- Robust validation: requires positive amounts, auto-formats decimals, and prevents empty fields.
- Edit Mode: Click "Edit" on any transaction to populate and update the record in-place.
- Custom confirmation modal for safe deletions.

### 4. Search, Filtering, Sorting & Pagination
- **Real-time multi-field search**: Live search across description, category, payer, amount, and trip name.
- **Period Filter**: Filter by Today, This Week, This Month, This Year, or All Time.
- **Category & Payer Filter**: Filter by specific category and dynamic participant names.
- **Sorting**: By Date (Newest/Oldest), Amount (High to Low / Low to High), Category (A-Z), and Description (A-Z).
- **Pagination**: Clean, responsive pagination controls.

### 5. Participant Balances & Optimal Settlement
- Equal-share splitting algorithm: calculates exact fair share per participant.
- Visual breakdown cards showing total paid, fair share, and net status:
  - **Gets back** (Emerald green badge)
  - **Owes** (Rose red badge)
  - **Settled Up** (Neutral badge)
- **Direct Settlement Optimizer**: Minimizes cash transfers with greedy debtor-to-creditor resolution (e.g., `Amit owes ₹1,500.00 to Rahul`).
- Clear "All settled up!" celebration state when all debts are resolved.

### 6. Interactive Visualizations & Analytics
- **Category Distribution**: Donut chart with custom legends, percentage shares, and formatted tooltip amounts.
- **Daily Spending Timeline**: Bar chart displaying day-by-day expenditure trends.
- **Participant Comparison**: Horizontal bar chart comparing total spending across members.
- Built with Chart.js with theme-adaptive colors.

### 7. Backup, Export & Import
- **Export Data**: Single-click JSON backup download.
- **Import Data**: Safely merge or replace data from JSON backups with schema validation.
- **Reset**: Safe reset with confirmation dialog.

---

## 📁 Project Structure

```
Expense_Tracker/
├── index.html              # Main HTML5 application shell & view templates
├── README.md               # Documentation & usage guide
├── assets/
│   └── styles.css          # Design system, CSS variables, dark/light themes & responsive layout
└── scripts/
    ├── main.js             # App controller, view routing, lifecycle, and event listeners
    ├── ui.js               # UI components, summary cards, tables, toasts, and modals
    ├── db.js               # Centralized localStorage manager with migration & persistence
    ├── chart.js            # Chart.js visualization engine with theme awareness
    ├── category.js         # Category metadata, icons, badges, and colors
    ├── filters.js          # Search, filter predicates, sorting, and pagination logic
    └── utils.js            # INR currency formatting, date parsing, XSS escaping, settlements
```

---

## 🚀 Running the Project Locally

No build tools, bundlers, or `npm install` required! Because the project uses standard ES Modules (`type="module"`), it must be served through an HTTP server.

### Option 1: Using Python (Recommended)
Open a terminal in the project directory and run:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Option 2: Using Node.js `npx serve`
```bash
npx serve .
```

### Option 3: Using VS Code Live Server
1. Install the **Live Server** extension in VS Code.
2. Right-click on `index.html` and select **"Open with Live Server"**.

---

## 🔒 Security & Data Integrity

- **100% Client-side**: Data remains strictly inside your browser's `localStorage`. No data is uploaded to remote servers.
- **XSS Prevention**: All user input strings are escaped using `escapeHTML()` before DOM insertion.
- **Backward Compatibility**: Fully compatible with previous versions of `allTrips` and `advanced_expenses`.

---

## 📄 License
MIT License. Feel free to use and customize for personal or commercial group expense tracking.