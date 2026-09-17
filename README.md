# DecisionVault — Your Decisions Have a History

> **A Cognitive Decision Tracking & Empirical Calibration Platform**  
> Confront past hypotheses with present reality. Neutralize hindsight bias. Calibrate subjective confidence against objective results.

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v4.19-lightgrey.svg)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0+-green.svg)](https://www.mongodb.com)
[![Vanilla Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20ES6+-blue.svg)](#frontend-architecture)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## The Philosophy: Why DecisionVault?

Human memory is inherently reconstructive. When an outcome occurs, we suffer from **hindsight bias** (*"I knew it all along"*), conveniently forgetting the doubts, alternative options, and flawed assumptions we held at the moment of decision. Furthermore, we fall victim to the **overconfidence effect**, regularly operating with 85% certainty while achieving only 50% success.

**DecisionVault fixes the feedback loop of human judgment.**

By enforcing a **two-milestone chronological model**, DecisionVault permanently records your premises *before* reality unfolds, locks the record upon retrospective review, and computes your mathematical **Calibration Gap** so you can systematically upgrade your mental models.

```
 Milestone 1: Genesis                       Milestone 2: Reality
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│ • Alternatives Considered (≥2)  │        │ • Concrete Empirical Reality     │
│ • Selected Option               │ ─────> │ • Evaluation (Achieved / Failed) │
│ • Core Reasoning & Hypothesis   │ (Time) │ • Lessons Learned & Bias Audit   │
│ • Concrete Expected Outcome     │        │ • Permanent Historical Lock 🔒   │
│ • Confidence Score (0–100%)     │        └──────────────────────────────────┘
└─────────────────────────────────┘
```

---

## Core Features

### 1. Decision Genesis Recording
- **Multi-Option Weighing:** Enforces listing at least two distinct alternatives before committing.
- **Hypothesis Formulation:** Documents the explicit reasoning and quantitative expected outcome.
- **Subjective Confidence Slider:** Locks in your certainty score ($0–100\%$) at the moment of choice.

### 2. Dynamic Temporal Lifecycle
- Calculates status on the fly without brittle cron jobs:
  - `Pending Review`: Target review date is in the future.
  - `Review Due`: Target review date has arrived or passed.
  - `Reviewed`: Retrospective evaluation has been recorded and permanently locked.

### 3. Retrospective Review & Empirical Confrontation
- When review day arrives, view the exact original hypothesis side-by-side with reality.
- Evaluate outcome as `Achieved`, `Partially Achieved`, or `Not Achieved`.
- Document lessons learned to calibrate future heuristics.

### 4. The Historical Immutability Invariant
- Once a review is recorded, the decision becomes **permanently immutable**.
- Updates (`PUT /api/decisions/:id`) and duplicate reviews (`POST /api/decisions/:id/review`) are rejected with `400 Bad Request`.
- Guarantees historical integrity against retroactive rewriting.

### 5. Dual-Milestone Visual History Timeline
- Flagship timeline view powered by pure CSS linear gradients and pseudo-elements.
- Renders the full evolutionary trajectory from intent to reality.

### 6. High-Performance Calibration Metrics
- Single-pass MongoDB `$facet` aggregation pipeline.
- Calculates success rates across domains and computes the mathematical **Calibration Gap**:
  $$\text{Calibration Gap} = \overline{\text{Confidence}} - \text{Success Rate}$$
  - **Positive Gap:** Warns of overconfidence.
  - **Negative Gap:** Indicates risk aversion / underconfidence.

### 7. Interactive Dashboard
- 5 real-time KPI cards.
- Debounced live search across titles, reasoning, and outcomes.
- Category filter pills (`Technology`, `Career`, `Finance`, `Product`, `Health`, `Personal`, `General`).
- Multi-parameter sorting (by review date, newest, confidence).

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Vanilla Client (Browser)                        │
│  index.html  │  new-decision.html  │  decision.html  │  review.html   │
│  ──────────  │  ────────────────── │  ────────────── │  ───────────   │
│  Dashboard   │  Genesis Form       │  Visual Timeline│  Review Lock   │
│                                                                        │
│  JavaScript: api.js (Fetch API Bridge) ◄──► Toast & DOM Controllers    │
│  CSS3: variables.css │ base.css │ components.css (:has() & Grid)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Node.js / Express Server                       │
│  server.js (Middleware, CORS, Static Files, Health Check)              │
│  routes/decisionRoutes.js (REST Dispatcher)                            │
│  controllers/decisionController.js (CRUD, Aggregation & Immutability) │
│  middleware/errorHandler.js (Centralized Error Normalization)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Mongoose ODM / Connection Pool
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             MongoDB Atlas / Local                      │
│  Database: decisionvault                                               │
│  Collection: decisions                                                 │
│  Indexes: { reviewDate: 1 }, { createdAt: -1 }, { category: 1 }        │
│  Embedded Subdocument: reviewSchema { actualOutcome, result, ... }     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

- **Backend:** Node.js (v18+), Express.js (v4.19), Mongoose ODM (v8.3), `dotenv`, `cors`.
- **Database:** MongoDB (Local or Atlas) with embedded subdocuments and `$facet` aggregation.
- **Frontend:** Semantic HTML5, Vanilla CSS3 (Custom Properties, Flexbox, CSS Grid, `:has()` relational selectors), Vanilla ES6+ JavaScript (Fetch API, DOM manipulation, no build steps or frameworks).

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher) installed.
- **MongoDB** running locally on port `27017` or a **MongoDB Atlas** connection URI.

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/yourusername/DecisionVault.git
cd DecisionVault
npm install
```

### 3. Configure Environment Variables
Copy the environment template:
```bash
cp .env.example .env
```
Edit `.env` to match your local setup:
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/decisionvault
```

### 4. Launch Development Server
```bash
npm run dev
```
Output:
```
=========================================
 DecisionVault Server Running on port 5000
 Environment: development
 Health check: http://localhost:5000/api/health
=========================================
 MongoDB Connected Successfully!
 Host: 127.0.0.1
 Database: decisionvault
 Port: 27017
=========================================
```

### 5. Access the Application
Open your browser and visit:
- **Dashboard:** [http://localhost:5000](http://localhost:5000)
- **Record Decision:** [http://localhost:5000/new-decision.html](http://localhost:5000/new-decision.html)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## REST API Overview

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/api/health` | Service health and uptime check | `200 OK` |
| `GET` | `/api/decisions/stats` | Aggregated metrics and calibration gap | `200 OK` |
| `GET` | `/api/decisions` | Filter, search, and sort decisions | `200 OK` |
| `POST` | `/api/decisions` | Record a new decision (Genesis) | `201 Created` |
| `GET` | `/api/decisions/:id` | Fetch single decision details and timeline | `200 OK` |
| `PUT` | `/api/decisions/:id` | Update unreviewed decision (Protected) | `200 OK` / `400 Bad Request` |
| `DELETE` | `/api/decisions/:id` | Delete a decision record | `200 OK` |
| `POST` | `/api/decisions/:id/review` | Submit review & lock decision permanently | `200 OK` / `400 Bad Request` |

For the complete API specification with request payloads, query parameters, and response schemas, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

---

## Project Documentation Index

- [FILE_GUIDE.md](FILE_GUIDE.md) — Comprehensive file-by-file audit, responsibilities, imports, exports, and architectural layers.
- [PROJECT_NOTES.md](PROJECT_NOTES.md) — Engineering notes, Architectural Decision Records (ADRs), cognitive psychology foundations, and indexing strategies.
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — Full REST API documentation.

---

## License
Distributed under the MIT License. See `LICENSE` for more information.
