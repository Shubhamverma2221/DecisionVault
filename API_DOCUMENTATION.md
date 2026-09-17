# DecisionVault — REST API Documentation

This document serves as the official API contract and technical specification for **DecisionVault**. All endpoints communicate using standard HTTP methods and serialize request and response payloads using JSON (`application/json`).

---

## 1. Global Specifications

* **Base URL (Local Development):** `http://localhost:5000`
* **Default Content-Type:** `application/json`
* **Default Accept:** `application/json`

### Standard Success Response Envelope
```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Error Response Envelope
```json
{
  "success": false,
  "error": "Human-readable error description",
  "stack": "Error stack trace (included in development mode only)"
}
```

### Common HTTP Status Codes
| Code | Constant | Meaning |
| :--- | :--- | :--- |
| **`200`** | `OK` | Request succeeded; returned requested resource or confirmed action. |
| **`201`** | `Created` | Resource successfully created. |
| **`400`** | `Bad Request` | Client sent invalid payload, failed validation, or violated business rules. |
| **`404`** | `Not Found` | Target endpoint or resource with specified `_id` does not exist. |
| **`500`** | `Internal Server Error` | Unexpected server or database exception. |

---

## 2. API Endpoints Overview

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check to verify server status | `200` |
| `POST` | `/api/decisions` | Create a new decision | `201`, `400` |
| `GET` | `/api/decisions` | Get all decisions (with filtering, search, sorting) | `200` |
| `GET` | `/api/decisions/stats` | Get aggregate statistics and calibration metrics | `200` |
| `GET` | `/api/decisions/:id` | Get a single decision by ID | `200`, `404` |
| `PUT` | `/api/decisions/:id` | Update decision (unreviewed decisions only) | `200`, `400`, `404` |
| `DELETE`| `/api/decisions/:id` | Permanently delete a decision | `200`, `404` |
| `POST` | `/api/decisions/:id/review` | Submit retrospective review for a decision | `200`, `400`, `404` |

---

## 3. Endpoint Specifications

### 3.1 Health Check
Verifies server uptime and environment.

* **Method:** `GET`
* **Path:** `/api/health`
* **Headers:** None required

#### Success Response (`200 OK`)
```json
{
  "status": "ok",
  "message": "DecisionVault API is running",
  "environment": "development",
  "timestamp": "2026-09-17T15:13:14.898Z"
}
```

---

### 3.2 Create Decision
Persists a new decision record to MongoDB.

* **Method:** `POST`
* **Path:** `/api/decisions`
* **Headers:** `Content-Type: application/json`

#### Request Body
| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `title` | `String` | Yes | 1 – 150 chars |
| `description` | `String` | No | Free text |
| `category` | `String` | Yes | Enum: `'Technology'`, `'Career'`, `'Finance'`, `'Life'`, `'Product'`, `'Health'`, `'Other'` |
| `options` | `Array[String]` | Yes | Minimum 2 options required |
| `selectedOption` | `String` | Yes | Must match one of the items in `options` |
| `reasoning` | `String` | Yes | Minimum 10 chars |
| `confidence` | `Number` | Yes | 0 – 100 |
| `expectedOutcome` | `String` | Yes | Minimum 5 chars |
| `reviewDate` | `Date` (ISO) | Yes | Valid date string |
| `tags` | `Array[String]` | No | Optional keywords |

#### Example Request
```json
{
  "title": "Should we migrate DecisionVault to MongoDB?",
  "description": "Evaluating database alternatives for agile application development.",
  "category": "Technology",
  "options": ["MongoDB", "PostgreSQL", "SQLite"],
  "selectedOption": "MongoDB",
  "reasoning": "MongoDB provides flexible schemas, native JSON handling, and fast development cycles.",
  "confidence": 85,
  "expectedOutcome": "Complete full backend development in record time with zero migration friction.",
  "reviewDate": "2026-10-17T00:00:00.000Z",
  "tags": ["database", "backend"]
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "_id": "65f8a12b9d3c8e4f5a123456",
    "title": "Should we migrate DecisionVault to MongoDB?",
    "description": "Evaluating database alternatives for agile application development.",
    "category": "Technology",
    "options": ["MongoDB", "PostgreSQL", "SQLite"],
    "selectedOption": "MongoDB",
    "reasoning": "MongoDB provides flexible schemas, native JSON handling, and fast development cycles.",
    "confidence": 85,
    "expectedOutcome": "Complete full backend development in record time with zero migration friction.",
    "reviewDate": "2026-10-17T00:00:00.000Z",
    "tags": ["database", "backend"],
    "review": null,
    "status": "Pending Review",
    "createdAt": "2026-09-17T15:20:00.000Z",
    "updatedAt": "2026-09-17T15:20:00.000Z"
  }
}
```

#### Error Response (`400 Bad Request`)
```json
{
  "success": false,
  "error": "A decision requires considering at least 2 alternative options.; Confidence cannot exceed 100%"
}
```

---

### 3.3 Get All Decisions
Retrieves decisions matching optional search, category, status, and sort criteria.

* **Method:** `GET`
* **Path:** `/api/decisions`
* **Query Parameters:**
  * `category` (`String`): Filter by category name (or `'All'`).
  * `status` (`String`): Filter by virtual status (`'Pending Review'`, `'Review Due'`, `'Reviewed'`).
  * `search` (`String`): Case-insensitive keyword search across title, description, and reasoning.
  * `sort` (`String`): `'newest'` (default), `'oldest'`, `'confidence_high'`, `'confidence_low'`, `'review_date'`.

#### Example Request
```http
GET /api/decisions?category=Technology&status=Pending%20Review&sort=confidence_high
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "65f8a12b9d3c8e4f5a123456",
      "title": "Should we migrate DecisionVault to MongoDB?",
      "category": "Technology",
      "confidence": 85,
      "status": "Pending Review",
      "review": null,
      "createdAt": "2026-09-17T15:20:00.000Z"
    }
  ]
}
```

---

### 3.4 Get Decision Statistics
Calculates aggregate metrics, category breakdowns, and calibration score.

* **Method:** `GET`
* **Path:** `/api/decisions/stats`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "totalDecisions": 20,
    "reviewedCount": 14,
    "pendingCount": 4,
    "dueCount": 2,
    "achievedCount": 10,
    "partiallyAchievedCount": 3,
    "notAchievedCount": 1,
    "successRate": 71,
    "avgConfidenceAll": 78,
    "avgConfidenceAchieved": 84,
    "avgConfidenceFailed": 62,
    "calibrationGap": 7,
    "categoryBreakdown": [
      {
        "category": "Technology",
        "count": 12,
        "achievedCount": 7
      },
      {
        "category": "Career",
        "count": 5,
        "achievedCount": 2
      },
      {
        "category": "Finance",
        "count": 3,
        "achievedCount": 1
      }
    ]
  }
}
```

---

### 3.5 Get Single Decision by ID
Fetches full details and embedded review for a specific decision.

* **Method:** `GET`
* **Path:** `/api/decisions/:id`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "65f8a12b9d3c8e4f5a123456",
    "title": "Should we migrate DecisionVault to MongoDB?",
    "status": "Reviewed",
    "review": {
      "actualOutcome": "MongoDB allowed fast setup and schema iteration.",
      "result": "Achieved",
      "lessonLearned": "Document stores excel for fast product prototyping.",
      "reviewedAt": "2026-10-18T10:00:00.000Z"
    }
  }
}
```

#### Error Response (`404 Not Found`)
```json
{
  "success": false,
  "error": "Decision not found with ID: 65f8a12b9d3c8e4f5a123456"
}
```

---

### 3.6 Update Decision
Modifies fields of an unreviewed decision.

* **Method:** `PUT`
* **Path:** `/api/decisions/:id`
* **Headers:** `Content-Type: application/json`

> [!IMPORTANT]
> **Historical Immutability Rule:**  
> Once a decision has been reviewed (`review.result != null`), this endpoint returns `400 Bad Request` to preserve historical integrity. Direct manipulation of the `review` property via `PUT` is strictly stripped.

#### Example Request
```json
{
  "confidence": 90,
  "reasoning": "Updated rationale with additional architectural benchmark data."
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "65f8a12b9d3c8e4f5a123456",
    "confidence": 90,
    "reasoning": "Updated rationale with additional architectural benchmark data."
  }
}
```

#### Error Response — Reviewed Decision (`400 Bad Request`)
```json
{
  "success": false,
  "error": "Reviewed decisions cannot be modified. Historical integrity must be preserved."
}
```

---

### 3.7 Delete Decision
Permanently removes a decision from the database.

* **Method:** `DELETE`
* **Path:** `/api/decisions/:id`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Decision deleted successfully",
  "data": {}
}
```

---

### 3.8 Submit Retrospective Review
Appends retrospective reflection, evaluates outcome, and locks the decision into history.

* **Method:** `POST`
* **Path:** `/api/decisions/:id/review`
* **Headers:** `Content-Type: application/json`

#### Request Body
| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `actualOutcome` | `String` | Yes | Minimum 5 characters |
| `result` | `String` | Yes | Must be `'Achieved'`, `'Partially Achieved'`, or `'Not Achieved'` |
| `lessonLearned` | `String` | Yes | Minimum 5 characters |

#### Example Request
```json
{
  "actualOutcome": "MongoDB allowed us to build the backend in half the estimated time with no schema headaches.",
  "result": "Achieved",
  "lessonLearned": "Choosing developer velocity over premature relational normalization was the right tradeoff for this project stage."
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Decision review recorded successfully",
  "data": {
    "_id": "65f8a12b9d3c8e4f5a123456",
    "title": "Should we migrate DecisionVault to MongoDB?",
    "status": "Reviewed",
    "review": {
      "actualOutcome": "MongoDB allowed us to build the backend in half the estimated time with no schema headaches.",
      "result": "Achieved",
      "lessonLearned": "Choosing developer velocity over premature relational normalization was the right tradeoff for this project stage.",
      "reviewedAt": "2026-09-17T15:30:00.000Z"
    }
  }
}
```

#### Error Response — Duplicate Review (`400 Bad Request`)
```json
{
  "success": false,
  "error": "This decision has already been reviewed and evaluated. Reviews cannot be overwritten."
}
```
