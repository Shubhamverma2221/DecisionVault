# DecisionVault — Production Deployment & Cloud Infrastructure Guide

This guide provides a comprehensive, production-ready deployment walkthrough for running **DecisionVault** in a high-availability cloud environment using **MongoDB Atlas** (Database as a Service) and **Render / Railway / Fly.io** (Platform as a Service).

---

## 1. Production Architecture Overview

```
                        ┌───────────────────────────────┐
                        │      Client Web Browsers      │
                        └───────────────┬───────────────┘
                                        │ HTTPS (TLS 1.3)
                                        ▼
                        ┌───────────────────────────────┐
                        │     Cloudflare / CDN Edge     │
                        │ (DDoS Protection, SSL Term.)  │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │     PaaS Application Host     │
                        │    (Render / Railway / Fly)   │
                        │                               │
                        │   • Node.js v18+ Runtime      │
                        │   • Express HTTP Server       │
                        │   • Static Asset Serving      │
                        │   • Error Normalization       │
                        └───────────────┬───────────────┘
                                        │
                                        │ Encrypted TLS Tunnel
                                        │ (mongodb+srv://)
                                        ▼
                        ┌───────────────────────────────┐
                        │      MongoDB Atlas Cluster    │
                        │                               │
                        │   • 3-Node Replica Set        │
                        │   • Automated Daily Backups   │
                        │   • Primary/Secondary Elect.  │
                        │   • Compound B-Tree Indexes   │
                        └───────────────────────────────┘
```

---

## 2. Step 1: Provision Cloud Database (MongoDB Atlas)

1. **Create an Account:**
   Navigate to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and register.
2. **Deploy a Free Shared Cluster (M0 Sandbox):**
   - Cloud Provider: AWS or GCP.
   - Region: Select the region geographically closest to your application server (e.g., `us-east-1` or `eu-west-1`).
   - Cluster Name: `decisionvault-cluster`.
3. **Configure Database Security & Access:**
   - **Database User:**
     - Username: `decisionvault_admin`
     - Authentication Method: Password (generate a strong 32-character alphanumeric password).
     - Built-in Role: `Read and write to any database`.
   - **Network Access (IP Access List):**
     - For production with dynamic PaaS IPs (like Render or Railway), add `0.0.0.0/0` (Allow access from anywhere). Security is strictly enforced via strong database username/password and TLS encryption.
4. **Obtain the Connection URI:**
   - Click **Connect** → **Drivers** (Node.js).
   - Copy the SRV connection string:
     ```
     mongodb+srv://decisionvault_admin:<password>@decisionvault-cluster.mongodb.net/decisionvault?retryWrites=true&w=majority&appName=DecisionVault
     ```
   - Replace `<password>` with your database user password and specify the database name as `decisionvault`.

---

## 3. Step 2: Deploy Application Server (Render)

Render provides zero-downtime deployments, automated SSL certificates, and continuous deployment from GitHub.

### A. Repository Preparation
Ensure your repository is pushed to GitHub/GitLab:
```bash
git remote add origin https://github.com/yourusername/DecisionVault.git
git branch -M master
git push -u origin master
```

### B. Create a New Web Service on Render
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`DecisionVault`).
4. Configure the service settings:
   - **Name:** `decisionvault-api`
   - **Region:** Choose the region matching your MongoDB Atlas cluster (e.g., Oregon, Frankfurt, or Ohio).
   - **Branch:** `master`
   - **Root Directory:** *(leave blank — project root)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free or Starter.

### C. Configure Environment Variables
In the **Environment Variables** section on Render, add:

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables Express caching, hides error stack traces |
| `PORT` | `10000` | Render assigns ports dynamically or uses 10000 |
| `MONGODB_URI` | `mongodb+srv://...` | Your production MongoDB Atlas SRV URI |

5. Click **Create Web Service**.
6. Render will clone the repository, run `npm install`, execute `npm start`, and issue a secure `https://decisionvault.onrender.com` URL.

---

## 4. Alternative PaaS Options

### Deploying to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway init
railway add --plugin mongodb # (Optional: if not using Atlas)
railway up
```
Set `MONGODB_URI` and `NODE_ENV=production` in the Railway Variables dashboard.

### Deploying to Fly.io
1. Install `flyctl`.
2. Run `fly launch` in the root directory.
3. Set secrets:
   ```bash
   fly secrets set MONGODB_URI="mongodb+srv://..." NODE_ENV="production"
   ```
4. Run `fly deploy`.

---

## 5. Production Security Checklist

Before directing real users to production, verify the following security controls:

- [x] **Environment Variable Hygiene:** Ensure `.env` is never committed to Git. Verify `.gitignore` ignores `.env` and `node_modules`.
- [x] **NoSQL Injection Defense:** Mongoose schema definitions strictly sanitize input fields. Never pass raw unvalidated `req.body` directly to `$where` or `$expr` query operators.
- [x] **Centralized Error Masking:** Ensure `NODE_ENV=production` is set so internal database errors and stack traces are withheld from clients.
- [x] **HTTPS / TLS Enforcement:** Ensure the hosting platform enforces HTTPS redirection. Render, Railway, and Fly.io provide automatic TLS certificates.
- [x] **Historical Immutability Enforcement:** Verify that `PUT /api/decisions/:id` and `POST /api/decisions/:id/review` reject modifications on reviewed records.
- [x] **Client-Side Sanitization:** All text rendered into the DOM uses `textContent` rather than `innerHTML` to prevent Cross-Site Scripting (XSS).

---

## 6. Health Checks & Production Monitoring

### Health Endpoint
The server exposes an automated health check:
```http
GET /api/health
```
Response:
```json
{
  "status": "ok",
  "message": "DecisionVault API is running",
  "environment": "production",
  "timestamp": "2026-09-17T22:00:00.000Z"
}
```

### Free Uptime Monitoring
To prevent free-tier containers from sleeping, configure a free monitoring check (e.g. using [UptimeRobot](https://uptimerobot.com) or [BetterStack](https://betterstack.com)):
- **Monitor Type:** HTTP(s)
- **URL:** `https://your-app.onrender.com/api/health`
- **Interval:** Every 5 minutes.
- **Alert Condition:** HTTP status $\neq 200$.

---

## 7. Graceful Shutdown & Connection Teardown

In cloud orchestration platforms (Kubernetes, AWS ECS, Render), containers receive a `SIGTERM` signal prior to termination. The server gracefully terminates open HTTP connections and closes the MongoDB connection pool:

```javascript
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await mongoose.connection.close(false);
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});
```
