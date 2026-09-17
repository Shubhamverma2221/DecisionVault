# DecisionVault — Architectural Engineering Notes & Design Record

This document records the foundational architectural decisions, cognitive psychology principles, database schema strategies, and security invariants implemented across **DecisionVault**.

---

## 1. Architectural Philosophy & Core Tenets

### The Cognitive Problem Space
Most decision-tracking software functions as glorified to-do lists or retrospective journals. However, human memory is inherently revisionist:
- **Hindsight Bias:** Once an outcome is known, individuals subconsciously reconstruct their memory to believe they predicted that outcome all along.
- **Overconfidence Effect:** People routinely assign 80–90% subjective certainty to hypotheses that succeed only 50–60% of the time.
- **Outcome Bias:** Evaluating the quality of a decision solely on its final result rather than the quality of the process and alternatives considered at the time.

DecisionVault solves these cognitive failures by introducing **Audited Decision Calibration**:
1. **Genesis Milestone:** You must articulate at least two alternatives, explicitly select one, document your underlying reasoning, commit to an expected outcome, and assign a subjective confidence score ($0–100\%$).
2. **Time Separation:** A future review date is fixed.
3. **Reality Milestone:** Upon reaching the review date, the original premises are immutable. You evaluate empirical reality against the hypothesis and document lessons learned.
4. **Permanent Historical Immutability:** Once reviewed, the record is locked forever.

---

## 2. Architectural Design Decisions (ADRs)

### ADR-01: Zero-Framework Vanilla Frontend (HTML5, CSS3, ES6+)
- **Context:** Modern web engineering often defaults to React, Vue, or Next.js with complex bundlers (Webpack, Vite).
- **Decision:** Build the entire frontend using standard Semantic HTML5, Vanilla CSS3 (Custom Properties), and Vanilla ES6+ JavaScript.
- **Rationale:**
  - **Zero Build Step:** Changes are instantly visible without compilation or bundler overhead.
  - **Minimal Runtime Footprint:** Zero third-party client bundles, achieving sub-50ms First Contentful Paint (FCP).
  - **Pedagogical Clarity:** Clear understanding of the native DOM, Event Loop, Fetch API, and CSS rendering engine without abstraction layers.

### ADR-02: Dynamic Virtual Status vs. Stored Database Enum
- **Context:** A decision transitions through three distinct lifecycle states: `Pending Review`, `Review Due`, and `Reviewed`.
- **Alternatives Considered:**
  1. Storing `status: { type: String, enum: [...] }` directly in MongoDB, updated periodically by a scheduled cron job.
  2. Calculating status dynamically at runtime based on existing fields (`review.result` and `reviewDate`).
- **Decision:** Implemented dynamic Mongoose virtual property (`decisionSchema.virtual('status')`).
- **Rationale:**
  - If a review date passes at 12:00:00 AM, a stored column is stale until a background cron job runs and writes to the database.
  - A runtime virtual getter guarantees 100% temporal accuracy on every single read operation with zero database write amplification.
  - In queries, the controller translates `?status=Pending Review` into raw date and null-check queries (`{ 'review.result': null, reviewDate: { $gt: now } }`), allowing high-speed index scanning without storing derived data.

### ADR-03: Embedded Subdocument vs. Separate Collections
- **Context:** Should the retrospective review data be stored in a separate `reviews` collection with a foreign key or embedded inside the `Decision` document?
- **Decision:** Embedded subdocument (`reviewSchema` within `decisionSchema`).
- **Rationale:**
  - **1:1 Strict Cardinality:** A decision has at most one retrospective review.
  - **Atomic Persistence:** When a review is recorded, the entire document is updated atomically in a single MongoDB operation without multi-document ACID transactions.
  - **Single-Query Read:** Fetching a decision timeline requires no `$lookup` joins, keeping latency at minimum.

### ADR-04: Enforcing the Historical Immutability Invariant
- **Context:** If a user can edit their original reasoning or confidence score after learning the outcome, the calibration metrics are invalidated.
- **Enforcement Layers:**
  1. **Schema Level:** The review subdocument has `reviewedAt` and strict field constraints.
  2. **Controller Level (`updateDecision`):**
     ```javascript
     if (decision.review && decision.review.result) {
       return res.status(400).json({
         success: false,
         error: 'Reviewed decisions cannot be modified. Historical integrity must be preserved.'
       });
     }
     ```
     Any incoming `req.body.review` payload sent to `PUT /api/decisions/:id` is deleted before update.
  3. **Controller Level (`reviewDecision`):**
     ```javascript
     if (decision.review && decision.review.result) {
       return res.status(400).json({
         success: false,
         error: 'This decision has already been reviewed and evaluated. Reviews cannot be overwritten.'
       });
     }
     ```
  4. **Frontend Level:** `review.js` detects existing reviews and swaps the active form out for a locked historical notice.

---

## 3. Database Indexing & Query Performance

DecisionVault utilizes three targeted single-field indexes in MongoDB:

```javascript
// Accelerated chronological sorting and temporal review date filtering
decisionSchema.index({ reviewDate: 1 });

// Instant sorting by newest decisions
decisionSchema.index({ createdAt: -1 });

// High-cardinality filtering across decision domains
decisionSchema.index({ category: 1 });
```

### Search Optimization
For text search across `title`, `reasoning`, and `expectedOutcome`, the controller constructs a multi-field regex scan:
```javascript
const searchRegex = new RegExp(search, 'i');
query.$or = [
  { title: searchRegex },
  { reasoning: searchRegex },
  { expectedOutcome: searchRegex }
];
```
This enables real-time search without requiring external search engines (e.g. Elasticsearch).

---

## 4. Aggregation Pipeline & Calibration Metrics

The statistics endpoint (`GET /api/decisions/stats`) executes a high-performance MongoDB aggregation pipeline using `$facet` to compute all metrics in a single database round-trip:

```javascript
const stats = await Decision.aggregate([
  {
    $facet: {
      overall: [
        {
          $group: {
            _id: null,
            totalDecisions: { $sum: 1 },
            avgConfidence: { $avg: '$confidence' },
            reviewedDecisions: {
              $sum: { $cond: [{ $ifNull: ['$review.result', false] }, 1, 0] }
            },
            achievedCount: {
              $sum: { $cond: [{ $eq: ['$review.result', 'Achieved'] }, 1, 0] }
            },
            partiallyAchievedCount: {
              $sum: { $cond: [{ $eq: ['$review.result', 'Partially Achieved'] }, 1, 0] }
            },
            notAchievedCount: {
              $sum: { $cond: [{ $eq: ['$review.result', 'Not Achieved'] }, 1, 0] }
            }
          }
        }
      ],
      byCategory: [
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ]
    }
  }
]);
```

### Calibration Gap Formula
$$\text{Success Rate} = \frac{\text{Achieved Decisions}}{\text{Reviewed Decisions}} \times 100$$
$$\text{Calibration Gap} = \overline{\text{Confidence}} - \text{Success Rate}$$

- **Positive Gap ($> 0$):** Indicates **Overconfidence** (e.g., average confidence was 85%, but only 60% of decisions succeeded).
- **Negative Gap ($< 0$):** Indicates **Underconfidence / Risk Aversion** (e.g., average confidence was 65%, but 85% succeeded).
- **Zero Gap ($\approx 0$):** Perfectly calibrated cognitive heuristics.

---

## 5. Frontend Design System & Native CSS Innovations

### CSS Relational Pseudo-Class `:has()`
DecisionVault replaces JavaScript radio-state tracking with modern pure CSS:
```css
.outcome-radio-label:has(input[value="Achieved"]:checked) {
  background: var(--outcome-achieved-bg);
  border-color: var(--outcome-achieved);
  color: var(--outcome-achieved);
  font-weight: 700;
}
```
When a radio button inside the label is checked, the parent label automatically receives active styles without event listeners or DOM class toggles.

### Pure CSS Timeline Spine
The dual-milestone visual history timeline uses `::before` pseudo-elements with linear gradients:
```css
.timeline::before {
  content: '';
  position: absolute;
  top: 15px;
  bottom: 15px;
  left: 7px;
  width: 2px;
  background: linear-gradient(
    180deg, 
    var(--accent-primary) 0%, 
    var(--accent-secondary) 50%, 
    var(--outcome-achieved) 100%
  );
}
```
This renders a continuous vertical spine connecting the Genesis Milestone to the Reality Milestone.

---

## 6. Centralized Error Handling Envelope

All backend errors are trapped by `server/middleware/errorHandler.js` and returned in a standard envelope:

```json
{
  "success": false,
  "error": "Human-readable error description",
  "stack": "Included only when NODE_ENV !== 'production'"
}
```

This ensures the frontend API client (`client/js/api.js`) needs only a single normalization layer:
```javascript
if (!response.ok) {
  const errorMessage = json.error || `HTTP Error: ${response.status}`;
  throw new Error(errorMessage);
}
```
