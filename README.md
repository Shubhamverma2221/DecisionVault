# DecisionVault — Your Decisions Have a History

> **A Multi-User Cognitive Decision Tracking & Empirical Calibration Platform**  
> Confront past hypotheses with present reality. Neutralize hindsight bias. Calibrate subjective confidence against objective results.

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v4.19-lightgrey.svg)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0+-green.svg)](https://www.mongodb.com)
[![Theme](https://img.shields.io/badge/Theme-Light%20Mode%20Only-f8fafc.svg)](#light-mode-design-system)
[![Auth](https://img.shields.io/badge/Auth-JWT%20%7C%20Google%20%7C%20Guest-6366f1.svg)](#multi-user-authentication)

---

## The Philosophy: Why DecisionVault?

Human memory is inherently reconstructive. When an outcome occurs, we suffer from **hindsight bias** (*"I knew it all along"*), conveniently forgetting the doubts, alternative options, and flawed assumptions we held at the moment of decision. Furthermore, we fall victim to the **overconfidence effect**, regularly operating with 85% certainty while achieving only 50% success.

**DecisionVault fixes the feedback loop of human judgment.**

By enforcing a **two-milestone chronological model**, DecisionVault permanently records your premises *before* reality unfolds, locks the record upon retrospective review, and computes your mathematical **Calibration Gap** so you can systematically upgrade your mental models.

```
 Milestone 1: Genesis                       Milestone 2: Reality
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│ • Alternatives Considered (≥2)  │        │ • Concrete Empirical Reality     │
│ • Weighted Criteria Matrix      │        │ • Outcome (Achieved / Failed)    │
│ • Core Reasoning & Hypothesis   │ ─────> │ • Quantitative Score (1–10)      │
│ • Concrete Expected Outcome     │ (Time) │ • Lessons Learned & Bias Audit   │
│ • Confidence Score (0–100%)     │        │ • Permanent Historical Lock 🔒   │
└─────────────────────────────────┘        └──────────────────────────────────┘
```

---

## Key Features

### 1. Multi-User Authentication Suite
- **Email + Password Registration:** Full registration with bcrypt salt & hash encryption.
- **JWT Authorization:** Stateless Bearer tokens with strict user isolation across all records.
- **Guest Mode:** Instant one-click demo login with full CRUD privileges.
- **In-Place Guest Migration:** Upgrade a guest session to a permanent account at any time without losing any decisions.
- **Google Sign-In Ready:** Modular OAuth/Google Identity client integration.

### 2. Decision Genesis & Weighted Matrix
- **Multi-Option Weighing:** Compare at least 2 distinct alternatives before committing.
- **Weighted Criteria Scoring:** Define evaluation criteria (e.g. Speed, Cost, Scalability) with custom weights ($\sum \text{weight} = 100\%$) and calculate composite scores for each option.
- **Subjective Confidence Slider:** Record your calibrated certainty (0–100%) prior to the outcome.
- **Tags & Categorization:** Organize by Technology, Career, Finance, Product, Life, and Health.

### 3. Retrospective Review & Empirical Confrontation
- **Due Date Reminders:** Automated banner alerts for decisions awaiting evaluation.
- **Empirical Reality Confrontation:** Review what actually happened side-by-side with your initial expectations.
- **Outcome Assessment:** Categorize results as `Achieved`, `Partially Achieved`, or `Not Achieved` with a 1–10 quantitative score.
- **Lessons Learned:** Capture timeless takeaways to calibrate future decisions.

### 4. Decision Replay Mode
- Step through your decision like a flight recorder:
  1. **What You Believed:** Initial options, chosen alternative, confidence, and reasoning.
  2. **What Actually Happened:** Retrospective review and reality comparison.
  3. **Prediction vs. Reality:** Outcome status, accuracy differential, and score.
  4. **The Lesson Learned:** The lasting principle for your personal playbook.

### 5. Lessons Library & Decision Calendar
- **Lessons Library (`lessons.html`):** A centralized knowledge base of all your historical lessons, filterable by category and searchable.
- **Decision Calendar (`calendar.html`):** Interactive monthly calendar view highlighting decision genesis dates, review due dates, and completed reviews.
- **Data Portability:** 1-click export of all decisions to **JSON** or **CSV** formats.

### 6. Light Mode Only Design System
- Built strictly with a clean, modern **Light Mode aesthetic**:
  - Background Canvas: Crisp soft slate (`#f8fafc`)
  - Elevated Cards: Pure white (`#ffffff`) with subtle hairline borders (`#e2e8f0`)
  - Typography: Deep charcoal slate (`#0f172a` and `#334155`)
  - Accent Palette: Indigo (`#4f46e5`), Emerald (`#059669`), Amber (`#d97706`), and Rose (`#e11d48`)
  - Zero dark mode styles or toggles.

---

## Tech Stack

* **Backend:** Node.js, Express 4, Mongoose 8, MongoDB, `bcryptjs`, `jsonwebtoken`
* **Frontend:** Vanilla ES6+ JavaScript, CSS3 Design Tokens, Semantic HTML5
* **Security:** Strict per-user database scoping (`userId: req.user._id`), JWT auth middleware, sanitized inputs, and input validation.

---

## Quickstart

### Prerequisites
- Node.js (v18+)
- MongoDB running locally at `mongodb://127.0.0.1:27017`

### Setup & Run
```bash
# Clone or navigate to the directory
cd DecisionVault

# Install dependencies
npm install

# Configure environment (defaults work out of the box)
cp .env.example .env

# Start development server
npm run dev
```

Visit **`http://localhost:5000`** in your browser.
