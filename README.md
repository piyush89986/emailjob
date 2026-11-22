# JobMail

**JobMail** is a multi-tenant, responsible job-application email automation SaaS built with FastAPI, MongoDB (Motor + Beanie), Redis, ARQ workers, and a modern React 18 + TypeScript frontend.

---

## Architecture & Technology Stack

* **Backend:** Python 3.11+, FastAPI, Pydantic v2, `pydantic-settings`, structlog with request ID tracing.
* **Database & Tenancy:** MongoDB with Motor + Beanie ODM. Strict multi-tenant repository layer (`TenantRepository`) scoping all document queries and mutations to `tenant_id`.
* **Caching & Queue:** Redis + ARQ workers for asynchronous email dispatch, periodic polling sync, and token renewals.
* **Email Mailbox Providers:**
  * **Gmail API** (users.messages, users.history, users.watch via Pub/Sub)
  * **Microsoft Graph API** (Outlook / Microsoft 365 via MSAL)
  * **IMAP / SMTP** (`aiosmtplib`, `aioimaplib`)
* **Security & Encryption:** Symmetric Fernet encryption for OAuth tokens and mailbox passwords at rest, rotating JWT refresh tokens, direct bcrypt password hashing, and Redis rate limiting.
* **AI Engine:** Unified LLM router for OpenAI (`gpt-4o-mini`) and Google Gemini (`gemini-1.5-flash`) with automatic fallback, strict schema enforcement, SSRF-protected job description extraction, deterministic ATS keyword scoring, and anti-hallucination verification.
* **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Axios, Lucide icons.

---

## Quickstart (Local Development)

### Prerequisites
* Python 3.11+
* Node.js 18+ and npm
* (Optional) Docker & Docker Compose for containerized MongoDB & Redis

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env
```
Generate your Fernet encryption key and add it to `.env`:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Run the automated seed script to populate default email templates:
```bash
python -m app.scripts.seed
```
Start the FastAPI server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Start the ARQ background worker (in a separate terminal):
```bash
arq app.workers.worker.WorkerSettings
```
Open interactive OpenAPI documentation: [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).
* To run against real backend: set `VITE_USE_MOCK=false` in `frontend/.env`.
* To run standalone with mock data: set `VITE_USE_MOCK=true`.

### 3. Docker Compose (Full Stack)
```bash
docker compose up --build
```
This runs MongoDB replica set, Redis, API backend, ARQ worker, and frontend.

---

## Running the Automated Test Suite

JobMail includes a 21-test test suite covering tenant isolation, authentication, sync deduplication, threading, policy enforcement, and AI verification:

```bash
cd backend
python -m pytest -v
```

---

## Deployment Guide

### Deploying the Backend on Render
The repository includes a ready-to-deploy Render blueprint ([render.yaml](file:///render.yaml)) defining both the web API and the background worker.

1. Connect your GitHub repository to [Render](https://render.com).
2. Choose **New Blueprint Instance** and select your repository. Render will automatically detect `render.yaml`.
3. In the Render Dashboard, configure the environment variables:
   * `MONGO_URI`: Your MongoDB Atlas connection string (must be a replica set, standard on Atlas).
   * `REDIS_URL`: Your Redis instance URL (e.g., from Upstash or Redis Cloud).
   * `ENCRYPTION_KEY`: Your generated Fernet key.
   * `SECRET_KEY`: Auto-generated random JWT secret.
   * `CORS_ORIGINS`: Your Vercel frontend URL (e.g., `https://jobmail.vercel.app`).
   * API credentials for Google, Microsoft, OpenAI, and Gemini.

### Deploying the Frontend on Vercel
1. Import the `frontend` folder into [Vercel](https://vercel.com).
2. Set Framework Preset to **Vite**.
3. Configure Environment Variables in Vercel:
   * `VITE_API_URL`: Your Render backend URL (e.g., `https://jobmail-api.onrender.com`).
   * `VITE_USE_MOCK`: `false`.
4. Deploy! Vercel uses [frontend/vercel.json](file:///frontend/vercel.json) to handle single-page application routing.

---

## Manual Setup Checklist for Production Services

Follow these steps to connect production third-party APIs:

### 1. Google Cloud (Gmail API + Pub/Sub Webhooks)
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g., `jobmail-prod`).
2. **Enable APIs:** Enable **Gmail API** and **Cloud Pub/Sub API**.
3. **OAuth Consent Screen:**
   * User Type: External.
   * Add Scopes: `https://mail.google.com/` (send and read mail) and `userinfo.email`.
   * *Note:* Gmail read/send scopes are classified as **Restricted**. For local testing, add your email under **Test Users**. For public production launch, Google requires a Security Assessment (CASA Tier 2) and app verification.
4. **OAuth Credentials:**
   * Create **OAuth Client ID** (Web application).
   * Authorized Redirect URI: `https://your-backend.onrender.com/accounts/oauth/gmail/callback`.
   * Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **Pub/Sub Watch Setup:**
   * Create Pub/Sub Topic: `projects/YOUR_PROJECT_ID/topics/jobmail-gmail-watch`.
   * Grant publish rights to `gmail-api-push@system.gserviceaccount.com` with role `Pub/Sub Publisher`.
   * Create a Subscription with Delivery Type **Push** pointing to: `https://your-backend.onrender.com/webhooks/gmail?token=YOUR_PUBSUB_VERIFICATION_TOKEN`.

### 2. Microsoft Entra / Azure (Outlook / Microsoft 365)
1. Go to [Azure Portal](https://portal.azure.com/) -> **Microsoft Entra ID** -> **App registrations**.
2. Click **New registration**:
   * Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*.
   * Redirect URI (Web): `https://your-backend.onrender.com/accounts/oauth/outlook/callback`.
3. Create a **Client Secret** under *Certificates & secrets*.
4. Under **API permissions**, add delegated permissions for **Microsoft Graph**:
   * `Mail.ReadWrite`, `Mail.Send`, `offline_access`, `User.Read`.
5. Set `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, and `MS_TENANT_ID=common` in your environment.

### 3. AI Providers
* **OpenAI:** Create an API key at [platform.openai.com](https://platform.openai.com) and set `OPENAI_API_KEY`.
* **Google Gemini:** Create an API key in [Google AI Studio](https://aistudio.google.com) and set `GEMINI_API_KEY`.

### 4. Databases
* **MongoDB Atlas:** Create a free M0 or paid cluster. Click **Connect** -> **Drivers** and set `MONGO_URI`.
* **Redis:** Create a serverless Redis database on [Upstash](https://upstash.com) or [Redis Cloud](https://redis.io) and set `REDIS_URL`.




email validation 
configure nodes
upload image , text , just an image of gmail ,
theme 