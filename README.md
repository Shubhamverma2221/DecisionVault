# DecisionVault — Track Your Choices & Learn From Results

> **A simple, beautiful decision journal that helps you make smarter choices and learn from experience.**  
> Write down your decision today, check back later to see what really happened, and build your own library of wisdom.

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v4.19-lightgrey.svg)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%20Local-green.svg)](https://www.mongodb.com)
[![Theme](https://img.shields.io/badge/Design-Clean%20Light%20Mode-f8fafc.svg)](#design)
[![Auth](https://img.shields.io/badge/Auth-Email%20%7C%20Google%20%7C%20Guest-6366f1.svg)](#how-it-works)

---

## Why DecisionVault?

Whenever we make a big decision — whether in career, money, coding, or life — two things usually happen:

1. **We forget what we were actually thinking:** Months later, when things go well or badly, we tell ourselves *"I knew that would happen all along!"* Even though at the time, we were guessing or unsure.
2. **We repeat the same mistakes:** Without reviewing what actually happened versus what we expected, we never really learn.

**DecisionVault fixes this in 2 simple steps:**

```
  Step 1: Make Your Decision               Step 2: Review What Happened
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│ • List your options             │        │ • Write down what actually       │
│ • Pick the best one & why       │        │   happened in real life          │
│ • Set what you expect to happen │ ─────> │ • Rate how it went (1 to 10)     │
│ • Pick your confidence (0-100%) │ (Time) │ • Save what you learned for next │
│ • Choose a review date          │        │   time                           │
└─────────────────────────────────┘        └──────────────────────────────────┘
```

---

## Key Features

### 1. Easy Sign In
- **Try as Guest:** Start using the app immediately with 1 click — no sign up required.
- **Save Your Account:** If you start as a guest, you can create an email and password anytime without losing your saved decisions.
- **Email & Password or Google:** Secure login so your personal decisions remain private to you.

### 2. Simple Decision Making
- **Compare Choices:** Add 2 or more options and pick the one that fits best.
- **Optional Scoring Matrix:** Rate each option on criteria like cost, time, or ease to find the clear winner.
- **Confidence Slider:** Set how sure you feel (0% to 100%) so you can see if you tend to be too sure or too cautious.
- **Categories & Tags:** Organize your choices by Career, Money, Tech, Health, Projects, and more.

### 3. Review When Ready
- **Friendly Reminders:** A clear banner lets you know when a decision is ready for review.
- **Compare Expectations vs. Reality:** See what you originally hoped for right next to what actually took place.
- **Rate the Result:** Mark whether it was Achieved, Partially Achieved, or Not Achieved.
- **Locked for Honesty:** Once reviewed, the decision is locked so you can always trust your past records.

### 4. Decision Replay
- Click **"Replay Decision"** to walk through your decision step-by-step:
  1. What you were thinking when you made the choice.
  2. What really happened.
  3. The difference between expectation and reality.
  4. The lesson you wrote down.

### 5. Lessons Page & Calendar
- **Lessons Learned (`lessons.html`):** A collection of all the tips and takeaways you have learned from your past choices, searchable by topic.
- **Calendar (`calendar.html`):** View all your decision dates on a clean monthly calendar.
- **Export Data:** Download all your decisions anytime as a **JSON** or **CSV** file.

### 6. Clean, Beautiful Design
- Designed strictly with a crisp, easy-on-the-eyes **Light Theme**:
  - Soft background and pure white cards with smooth borders.
  - High-contrast typography that is easy to read on mobile and desktop.
  - Clear, colorful status badges so you always know what needs your attention.

---

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, bcryptjs
- **Frontend:** Plain HTML5, Modern CSS, Vanilla JavaScript (Fast, lightweight, no heavy frameworks)
- **Deployment:** Ready for Vercel and MongoDB Atlas

---

## Quick Start (Run Locally)

### Requirements
- Node.js (v18 or higher)
- A free MongoDB Atlas database URL or local MongoDB

### Setup Steps
```bash
# 1. Clone the repository
git clone https://github.com/Shubhamverma2221/DecisionVault.git
cd DecisionVault

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env

# 4. Start the app
npm run dev
```

Open your browser and visit: **`http://localhost:5000`**

---

## License
MIT License. Free to use, modify, and share!
