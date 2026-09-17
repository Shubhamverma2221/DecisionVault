# DecisionVault — REST API Documentation

This document serves as the official API contract and technical specification for **DecisionVault (Multi-User Cognitive Decision Platform)**. All endpoints communicate using standard HTTP methods and serialize request and response payloads using JSON (`application/json`).

---

## 1. Global Specifications

* **Base URL (Local Development):** `http://localhost:5000`
* **Default Content-Type:** `application/json`
* **Default Accept:** `application/json`
* **Authentication Scheme:** Bearer Token via HTTP Header: `Authorization: Bearer <jwt_token>`

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
| **`401`** | `Unauthorized` | Bearer token is missing, expired, or invalid. |
| **`403`** | `Forbidden` | Authenticated user lacks permission to access target resource. |
| **`404`** | `Not Found` | Target endpoint or resource with specified `_id` does not exist for this user. |
| **`500`** | `Internal Server Error` | Unexpected server or database exception. |

---

## 2. API Endpoints Overview

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register permanent user with name, email, password | No |
| `POST` | `/api/auth/login` | Log in with email and password | No |
| `POST` | `/api/auth/guest` | Instant demo login without credentials | No |
| `POST` | `/api/auth/google` | Sign in / register via Google ID token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile and decision summary | Yes |
| `PUT` | `/api/auth/convert-guest`| Upgrade guest session to permanent account preserving all data | Yes |

### Decision Operations (`/api/decisions`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/decisions` | Get all user decisions (supports search, category, status, tabs) | Yes |
| `POST` | `/api/decisions` | Create a new decision (supports multi-option criteria matrix) | Yes |
| `GET` | `/api/decisions/lessons` | Retrieve all reviewed decisions with extracted lessons | Yes |
| `GET` | `/api/decisions/calendar` | Retrieve calendar timeline events (created, due, reviewed) | Yes |
| `GET` | `/api/decisions/export` | Export decisions to JSON or CSV format (`?format=json\|csv`) | Yes |
| `GET` | `/api/decisions/stats` | Retrieve aggregate counts, review rates, and calibration gap | Yes |
| `GET` | `/api/decisions/:id` | Get full decision details, criteria matrix, and audit ledger | Yes |
| `PUT` | `/api/decisions/:id` | Update unreviewed decision (appends change to audit history) | Yes |
| `PATCH` | `/api/decisions/:id/favorite` | Toggle favorite flag on decision | Yes |
| `PATCH` | `/api/decisions/:id/archive` | Toggle archive flag on decision | Yes |
| `POST` | `/api/decisions/:id/review` | Submit retrospective review, outcome score (1–10), and lock | Yes |
| `DELETE`| `/api/decisions/:id` | Permanently delete decision and its history | Yes |

### Analytics (`/api/analytics`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/overview` | Comprehensive dashboard metrics, calibration, and distributions | Yes |
| `GET` | `/api/analytics/calibration` | Empirical calibration analysis comparing confidence bins vs actual success | Yes |

---

## 3. Authentication Endpoints

### 3.1 Register User
Registers a new permanent account with hashed credentials.
* **Method:** `POST /api/auth/register`
* **Payload:**
```json
{
  "name": "Sarah Connor",
  "email": "sarah@example.com",
  "password": "Password123!"
}
```
* **Success Response (`201 Created`):**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": {
    "_id": "65f8a12b9d3c8e4f5a123400",
    "name": "Sarah Connor",
    "email": "sarah@example.com",
    "isGuest": false
  }
}
```

### 3.2 Login User
Authenticates an existing user and issues a JWT token.
* **Method:** `POST /api/auth/login`
* **Payload:**
```json
{
  "email": "sarah@example.com",
  "password": "Password123!"
}
```

### 3.3 Guest Mode Login
Provides instant one-click access with an isolated guest user document.
* **Method:** `POST /api/auth/guest`
* **Payload:** Empty
* **Success Response (`200 OK`):**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": {
    "_id": "65f8a12b9d3c8e4f5a123499",
    "name": "Guest 4821",
    "email": "guest_4821_1726588800@decisionvault.local",
    "isGuest": true
  }
}
```

### 3.4 Convert Guest to Permanent Account
Converts the active guest account to a permanent email/password account in-place. All decisions created during the guest session remain intact because the `_id` is preserved.
* **Method:** `PUT /api/auth/convert-guest`
* **Headers:** `Authorization: Bearer <guest_token>`
* **Payload:**
```json
{
  "name": "Sarah Connor",
  "email": "sarah.permanent@example.com",
  "password": "NewPermanentPassword123!"
}
```

---

## 4. Decision Endpoints

### 4.1 Create Decision
* **Method:** `POST /api/decisions`
* **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Payload:**
```json
{
  "title": "Migrate to Microservices vs Modular Monolith",
  "description": "Architectural decision for scaling our high-throughput backend services.",
  "category": "Technology",
  "options": ["Modular Monolith", "Microservices via gRPC"],
  "selectedOption": "Modular Monolith",
  "reasoning": "Team size is under 15 engineers; microservices would introduce excessive operational overhead.",
  "confidence": 85,
  "expectedOutcome": "Maintain 99.95% uptime and ship core features 30% faster without distributed tracing complexity.",
  "reviewDate": "2026-12-01T00:00:00.000Z",
  "tags": ["architecture", "scaling", "backend"],
  "criteria": [
    { "name": "Deployment Simplicity", "weight": 40, "scores": { "Modular Monolith": 9, "Microservices via gRPC": 4 } },
    { "name": "Team Autonomy", "weight": 30, "scores": { "Modular Monolith": 6, "Microservices via gRPC": 9 } },
    { "name": "Infrastructure Cost", "weight": 30, "scores": { "Modular Monolith": 8, "Microservices via gRPC": 5 } }
  ]
}
```

### 4.2 Submit Retrospective Review
* **Method:** `POST /api/decisions/:id/review`
* **Headers:** `Authorization: Bearer <token>`
* **Payload:**
```json
{
  "actualOutcome": "Shipped 4 major features smoothly with 0 distributed outages. Cost stayed 40% below budget.",
  "result": "Achieved",
  "outcomeScore": 9,
  "lessonLearned": "Premature decomposition creates unnecessary cognitive load. Keep it simple until organizational boundaries demand separation."
}
```
* **Invariant:** Once reviewed, the decision is locked into history. Submitting a second review or updating the decision will return `400 Bad Request`.

### 4.3 Export Decisions
* **Method:** `GET /api/decisions/export?format=json` or `GET /api/decisions/export?format=csv`
* **Headers:** `Authorization: Bearer <token>`
* Returns a complete downloadable backup file with proper `Content-Disposition` attachment headers.
