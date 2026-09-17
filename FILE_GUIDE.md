# DecisionVault — Exhaustive File Guide & Codebase Audit

This document provides a comprehensive technical index of every directory and file in the **DecisionVault** codebase. Each entry details the file's architectural layer, responsibilities, imported/exported interfaces, and design patterns.

---

## Architecture Overview

```
DecisionVault/
├── Configuration & Environment (.env, .env.example, .gitignore, package.json)
├── Documentation (README.md, API_DOCUMENTATION.md, FILE_GUIDE.md, PROJECT_NOTES.md)
├── Backend Layer: Node.js + Express + Mongoose (server/)
│   ├── Entry Point: server.js
│   ├── Database Configuration: config/db.js
│   ├── Data Models & Schemas: models/Decision.js
│   ├── Controllers & Business Logic: controllers/decisionController.js
│   ├── Middleware: middleware/errorHandler.js
│   └── Routing: routes/decisionRoutes.js
└── Frontend Layer: Vanilla Web Components (client/)
    ├── HTML Views: index.html, new-decision.html, decision.html, review.html
    ├── Stylesheets: css/variables.css, css/base.css, css/components.css
    └── JavaScript Modules: js/api.js, js/dashboard.js, js/new-decision.js, js/decision.js, js/review.js
```

---

## 1. Project Root & Configuration

### `.env.example`
- **Layer:** Configuration Template (Committed to Version Control)
- **Purpose:** Public template documenting all mandatory environment variables required to run DecisionVault locally or in production. Contains sanitized placeholder values.
- **Variables Documented:**
  - `PORT`: Network port for Express HTTP server (default: `5000`).
  - `NODE_ENV`: Application execution environment (`development`, `production`, `test`).
  - `MONGODB_URI`: Connection string for MongoDB database instance.

### `.env`
- **Layer:** Local Environment Secrets (Ignored by Git)
- **Purpose:** Contains machine-specific configurations and database connection secrets. Never committed to version control.

### `.gitignore`
- **Layer:** Git Configuration
- **Purpose:** Prevents accidental committing of secrets, runtime artifacts, compiled packages, and OS-generated files.
- **Rules:** Ignores `node_modules/`, `.env`, `.env.local`, `npm-debug.log*`, `.DS_Store`, and `Thumbs.db`.

### `package.json`
- **Layer:** Node.js Package Manifest
- **Purpose:** Declares project metadata, npm scripts, and third-party runtime/development dependencies.
- **Runtime Dependencies:**
  - `express`: Minimalist Node.js web application framework.
  - `mongoose`: Elegant MongoDB object modeling for Node.js.
  - `dotenv`: Loads environment variables from `.env` into `process.env`.
  - `cors`: Express middleware enabling Cross-Origin Resource Sharing.
- **Development Dependencies:**
  - `nodemon`: Hot-reloading server utility for developer productivity.
- **Scripts:**
  - `npm start`: Runs `node server/server.js` (production mode).
  - `npm run dev`: Runs `nodemon server/server.js` (development mode).

### `package-lock.json`
- **Layer:** Dependency Lockfile
- **Purpose:** Records exact dependency versions and integrity hashes for deterministic, reproducible installs across environments.

---

## 2. Server & Backend (`server/`)

### `server/server.js`
- **Layer:** Backend Application Entry Point
- **Purpose:** Initializes Express application, configures global middleware, mounts static asset directories, connects to MongoDB, mounts API route trees, and registers centralized error handling.
- **Key Responsibilities:**
  - Imports `dotenv/config` to populate `process.env`.
  - Invokes `connectDB()` to asynchronously establish MongoDB connection.
  - Applies security and parsing middleware: `cors()`, `express.json()`, `express.urlencoded({ extended: true })`.
  - Serves client directory statically via `express.static('client')`.
  - Mounts health check endpoint `GET /api/health`.
  - Mounts REST API routes under `/api/decisions`.
  - Mounts 404 handler (`notFound`) and global exception middleware (`errorHandler`).
  - Boots HTTP listener on `PORT` and exports `{ app, server }`.

### `server/config/db.js`
- **Layer:** Database Infrastructure
- **Purpose:** Manages asynchronous connection pooling, timeout configurations, and connection lifecycle events for MongoDB via Mongoose.
- **Key Exports:** `connectDB` (async function).
- **Features:**
  - Configures connection pool (`maxPoolSize: 10`), connection timeout (`serverSelectionTimeoutMS: 5000`), and socket timeout (`socketTimeoutMS: 45000`).
  - Registers lifecycle event listeners for `error` and `disconnected`.
  - Implements defensive process exit (`process.exit(1)`) on initial connection failure.

### `server/models/Decision.js`
- **Layer:** Data Persistence & Domain Model
- **Purpose:** Defines the Mongoose schema, embedded subdocuments, validation rules, runtime virtual getters, and performance compound indexes for the `Decision` entity.
- **Key Schemas:**
  - `reviewSchema` (Subdocument): Stores retrospective evaluation (`actualOutcome`, `result`, `lessonLearned`, `reviewedAt`).
  - `decisionSchema` (Root Document): Stores core premises (`title`, `category`, `options`, `selectedOption`, `reasoning`, `expectedOutcome`, `confidence`, `reviewDate`, `review`).
- **Validators & Invariants:**
  - `options`: Requires an array with at least 2 distinct alternatives.
  - `selectedOption`: Custom validator ensuring the chosen option exists within the evaluated options array.
  - `confidence`: Integer between `0` and `100`.
  - `category`: Enum constrained to `['Technology', 'Career', 'Finance', 'Product', 'Health', 'Personal', 'General']`.
- **Dynamic Virtuals:**
  - `status`: Runtime getter calculating `'Reviewed'`, `'Review Due'`, or `'Pending Review'` dynamically without brittle database cron jobs.
- **Database Indexes:**
  - `{ reviewDate: 1 }`: Accelerated sorting and due date filtering.
  - `{ createdAt: -1 }`: Rapid recency queries.
  - `{ category: 1 }`: Instant domain filtering.

### `server/middleware/errorHandler.js`
- **Layer:** Centralized Error Handling
- **Purpose:** Standardizes error response payloads and converts internal exceptions (Mongoose validation, MongoDB duplicates, CastErrors) into uniform JSON HTTP envelopes.
- **Key Exports:**
  - `notFound(req, res, next)`: Catches unmatched URLs and forwards a 404 Error.
  - `errorHandler(err, req, res, next)`: 4-argument Express error middleware.
- **Error Normalization:**
  - Mongoose `CastError`: Returns `404 Not Found` ("Resource not found").
  - Mongoose `ValidationError`: Returns `400 Bad Request` with array of validation messages.
  - MongoDB `11000` Duplicate Key: Returns `400 Bad Request` ("Duplicate field value entered").
  - General Exceptions: Returns `err.statusCode || 500` with clean message in production and stack trace in development.

### `server/controllers/decisionController.js`
- **Layer:** Business Logic & Request Handlers
- **Purpose:** Implements all controller functions handling HTTP requests, query parsing, aggregation pipelines, validation, and database updates.
- **Key Exports:**
  - `createDecision`: Validates input and persists new decision document (201 Created).
  - `getDecisions`: Supports live regex text search (`$or`), category filtering, virtual status mapping, and flexible multi-field sorting.
  - `getDecisionById`: Retrieves single decision document by MongoDB `_id` with 404 checks.
  - `updateDecision`: Updates unreviewed decisions. Enforces **Historical Immutability Rule**: returns `400 Bad Request` if decision is already reviewed; strips any attempt to overwrite review subdocuments.
  - `deleteDecision`: Removes decision from database.
  - `reviewDecision`: Records empirical outcome (`POST /api/decisions/:id/review`). Validates subdocument fields, prevents duplicate reviews, and atomically commits the review.
  - `getDecisionStats`: High-performance aggregation pipeline using `$facet`, `$group`, `$cond`, and `$avg` to calculate total decisions, review rates, success breakdown, category counts, and cognitive calibration gap.

### `server/routes/decisionRoutes.js`
- **Layer:** Route Definitions & Dispatching
- **Purpose:** Maps RESTful HTTP verb/path combinations to controller methods using Express `Router`.
- **Route Precedence Rule:** Declares `/stats` *before* `/:id` to prevent Express from misinterpreting the string `"stats"` as an `ObjectId`.

---

## 3. Client & Frontend (`client/`)

### Design System & Stylesheets (`client/css/`)

#### `client/css/variables.css`
- **Layer:** Global Design Tokens & CSS Custom Properties
- **Purpose:** Single source of truth for design tokens across color palettes, typography, status badges, outcome evaluations, shadows, radiuses, and transitions.
- **Key Tokens:**
  - Obsidian Dark Theme: `--bg-primary: #0b0f19`, `--bg-card: #151d30`.
  - Brand Gradients: `--accent-primary: #6366f1` (Indigo), `--accent-secondary: #a855f7` (Purple).
  - Outcome Semantics: `--outcome-achieved: #10b981` (Emerald), `--outcome-partial: #f59e0b` (Amber), `--outcome-failed: #ef4444` (Rose).
  - Typography: `--font-sans: 'Inter'`, `--font-display: 'Outfit'`, `--font-mono: 'JetBrains Mono'`.

#### `client/css/base.css`
- **Layer:** Global CSS Reset & Layout Scaffolding
- **Purpose:** Resets browser defaults, applies root typography and backgrounds, defines layout container classes, sticky glassmorphic navbar, button variants, and animated toast notification container.
- **Key Classes:** `.container`, `.navbar`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.toast-container`, `.toast`.

#### `client/css/components.css`
- **Layer:** Component-Specific Stylesheets
- **Purpose:** Houses modular styling rules for cards, statistics KPIs, filter toolbars, dynamic form builders, radio pill groups, confidence slider, and the vertical dual-milestone history timeline.
- **Key Features:**
  - `.stats-grid`: Responsive 5-column dashboard KPI layout.
  - `.decision-card`: Hover-interactive cards with status indicator bars.
  - `.outcome-pill-group`: Styled radio buttons using modern CSS `:has()` pseudo-classes (`:has(input[value="Achieved"]:checked)`).
  - `.timeline`: Pure CSS dual-milestone vertical audit spine with gradient progress indicator.

---

### Client-Side Logic & Modules (`client/js/`)

#### `client/js/api.js`
- **Layer:** HTTP Bridge & Utility Service
- **Purpose:** Centralizes all asynchronous Fetch API requests to the backend, serializes JSON, parses query parameters, formats dates, and renders toast notifications.
- **Key Exports / Global Objects:**
  - `API`: Object containing `getHealth()`, `getDecisions()`, `getDecisionStats()`, `getDecisionById()`, `createDecision()`, `updateDecision()`, `deleteDecision()`, `reviewDecision()`.
  - `showToast(message, type, duration)`: DOM toast renderer with slide-in animations.
  - `formatDate(dateString)`: Formats ISO dates into human-readable strings (`Mar 17, 2026`).
  - `getDaysRemaining(dateString)`: Computes days until target review date or days overdue.

#### `client/js/dashboard.js`
- **Layer:** Dashboard View Controller
- **Purpose:** Orchestrates state management, live debounced search, category pill toggles, status/sort select inputs, stats rendering, and decision card grid rendering on `index.html`.
- **Key Features:**
  - Debounces search input (300ms) to prevent network query flooding.
  - Dynamically calculates Calibration Gap indicator with color coding (overconfident vs. underconfident).
  - Handles empty states with actionable "Record Your First Decision" callouts.

#### `client/js/new-decision.js`
- **Layer:** Decision Creation Form Controller
- **Purpose:** Manages interactive decision recording on `new-decision.html`.
- **Key Features:**
  - Dynamic options builder: users can add up to 8 alternative options and dynamically select the chosen one via linked radio buttons.
  - Real-time confidence range slider badge updater.
  - Sets default review date to 30 days in the future.
  - Comprehensive client-side validation ensuring $\ge 2$ non-empty options, a selected option, and minimum text lengths.

#### `client/js/decision.js`
- **Layer:** Decision Details & Visual Timeline Controller
- **Purpose:** Loads decision data on `decision.html` and renders the visual two-milestone timeline:
  - **Milestone 1 (Genesis):** Recorded date, evaluated options list, selected option, reasoning, and expected outcome.
  - **Milestone 2 (Empirical Reality):** Sealed review evaluation, actual outcome, lessons learned, or an active prompt to conduct the review.
  - Handles decision deletion with browser confirmation dialogs.

#### `client/js/review.js`
- **Layer:** Retrospective Review Execution Controller
- **Purpose:** Powers `review.html`.
- **Key Features:**
  - Reads `?id=` query parameter.
  - Renders read-only premise context card (Milestone 1) for direct cognitive comparison.
  - Enforces client-side Historical Immutability Guard: displays sealed card if already reviewed.
  - Validates outcome, selected radio result, and lessons learned.
  - Submits review payload to `POST /api/decisions/:id/review` and transitions to the completed timeline.

---

### User Views (`client/*.html`)

#### `client/index.html`
- **Layer:** Main Dashboard View
- **Purpose:** Landing page displaying platform KPI statistics (Total Decisions, Pending, Due, Reviewed, Success Rate, Calibration Gap), filter toolbars (search, category pills, status filter, sort order), and the decision cards grid.

#### `client/new-decision.html`
- **Layer:** Decision Creation View
- **Purpose:** Form interface for documenting new decisions, evaluating competing alternatives, establishing underlying reasoning, choosing target review dates, and locking initial confidence scores ($0–100\%$).

#### `client/decision.html`
- **Layer:** Decision Details & Timeline View
- **Purpose:** Displays decision details and the flagship vertical dual-milestone history timeline connecting Milestone 1 (Genesis) to Milestone 2 (Empirical Reality).

#### `client/review.html`
- **Layer:** Retrospective Review Execution View
- **Purpose:** Interface where users confront past hypotheses with empirical reality, evaluate success (`Achieved`, `Partially Achieved`, `Not Achieved`), and permanently lock the decision audit record.

---

## 4. Documentation

### `API_DOCUMENTATION.md`
- Complete REST API specification detailing all endpoints, HTTP methods, headers, request bodies, query parameters, success envelopes, error structures, and validation rules.

### `PROJECT_NOTES.md`
- Engineering and architectural decisions, cognitive bias principles, database indexing strategies, immutability guarantees, and technical design patterns.

### `README.md`
- Master project documentation including setup instructions, architectural blueprints, feature walkthroughs, environment configurations, and verification steps.
