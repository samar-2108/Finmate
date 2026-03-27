# 💰 FinMate — AI Personal Finance Advisor for India

An AI-powered personal finance advisor that combines behavioural profiling with live market data and deterministic financial math to give hyper-personalised advice.

---

## 🏗️ Project Structure

```
project/
├── backend/          # FastAPI Python server
│   ├── main.py
│   ├── financial_engine.py
│   ├── behaviour_profiler.py
│   ├── market_data.py
│   ├── system_prompt.py
│   ├── knowledge_base.py
│   └── requirements.txt
│
└── frontend/         # React + Vite app
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── Chat.jsx
    │   │   └── OnboardingForm.jsx
    │   └── api.js
    └── package.json
```

---

## 🚀 How to Run (Step-by-Step)

### Prerequisites

Make sure these are installed on your machine:

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.10 or higher | `python --version` |
| Node.js | 18 or higher | `node --version` |
| npm | 9 or higher | `npm --version` |

---

### Step 1 — Get API Keys (Free)

You need two free API keys before running anything:

**Gemini API Key (Required)**
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **"Get API Key"** → **"Create API key"**
4. Copy the key (starts with `AIzaSy...`)

**Alpha Vantage Key (Optional — for live gold price)**
1. Go to [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
2. Enter your email → get the free key instantly
3. Copy the key (e.g. `ABCD1234EFGH5678`)

---

### Step 2 — Set Up the Backend

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Create a virtual environment
python -m venv venv

# 3. Activate the virtual environment
#    On Mac / Linux:
source venv/bin/activate
#    On Windows (Command Prompt):
venv\Scripts\activate
#    On Windows (PowerShell):
venv\Scripts\Activate.ps1

# 4. Install Python dependencies
pip install -r requirements.txt

# 5. Create your environment file from the template
cp backend.env.example .env
#    (On Windows: copy backend.env.example .env)

# 6. Open .env in any text editor and fill in your keys:
#    GEMINI_API_KEY=AIzaSy...your actual key here...
#    ALPHA_VANTAGE_KEY=your alpha vantage key here   (optional)
#    FRONTEND_URL=                                    (leave blank for local dev)

# 7. Start the backend server
uvicorn main:app --reload --port 8000
```

✅ You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

**Verify it's working:**
- Open [http://localhost:8000/health](http://localhost:8000/health) → should return `{"status":"ok"}`
- Open [http://localhost:8000/docs](http://localhost:8000/docs) → auto-generated API explorer

---

### Step 3 — Set Up the Frontend

Open a **new terminal window** (keep the backend running):

```bash
# 1. Navigate to the frontend folder
cd frontend

# 2. Install Node dependencies
npm install

# 3. (Optional) Create a frontend env file
cp frontend.env.example .env
#    The default (http://localhost:8000) works for local dev
#    Only change VITE_API_URL if deploying to production

# 4. Start the Vite dev server
npm run dev
```

✅ You should see:
```
  VITE v7.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser. 🎉

---

### Step 4 — Use the App

1. Complete the **4-step onboarding form** (name, finances, insurance, quiz)
2. Click **"🚀 Build My Plan"**
3. Wait a few seconds for FinMate to analyse your profile
4. Start chatting!

---

## 🔄 Daily Workflow (For Contributors)

```bash
# Always pull latest changes before starting work
git pull origin main

# After making changes
git add .
git commit -m "descriptive message about what you changed"
git push origin main
```

**Recommended: use feature branches**
```bash
git checkout -b feature/your-feature-name
# ... make changes ...
git push origin feature/your-feature-name
# Create Pull Request on GitHub
```

---

## 🌐 Ports Reference

| Service | URL | Notes |
|---------|-----|-------|
| Frontend (React) | http://localhost:5173 | Vite dev server |
| Backend (FastAPI) | http://localhost:8000 | uvicorn |
| API Docs | http://localhost:8000/docs | Auto-generated Swagger UI |
| Health Check | http://localhost:8000/health | UptimeRobot ping endpoint |

---

## 🔧 Troubleshooting

**"GEMINI_API_KEY not set" error on backend start**
→ Make sure you created `.env` inside the `backend/` folder and added your key.

**Frontend shows "having trouble connecting" message**
→ Make sure the backend is running (`uvicorn main:app --reload --port 8000`).
→ Check that port 8000 is not blocked by a firewall.

**"CORS error" in browser console**
→ The frontend origin is not whitelisted. Add it to `FRONTEND_URL` in backend `.env`.

**Gemini returns 429 (rate limit)**
→ You've hit the free tier limit. Wait a minute and try again.
→ Consider upgrading to a paid Gemini API tier for production.

**NSE market data fails**
→ This is expected — NSE blocks server-side requests. The app falls back to hardcoded values automatically. Update `FALLBACKS` in `market_data.py` weekly.

---

## ⚠️ Rules for Contributors

- ❌ Do NOT push `node_modules/` or `venv/`
- ❌ Do NOT commit `.env` files (they contain secret keys)
- ✅ Always pull before starting work
- ✅ Write clear commit messages
- ✅ Test the full onboarding → chat flow before pushing

---

## 📚 Key Files Quick Reference

| Problem | File to edit |
|---------|-------------|
| AI response quality is bad | `system_prompt.py` |
| Wrong FIRE date / SIP numbers | `financial_engine.py` |
| Market data stale | `market_data.py` (update `FALLBACKS`) |
| Wrong persona detected | `behaviour_profiler.py` (adjust scores) |
| Tax limits changed (new FY) | `knowledge_base.py` |
| New API endpoint needed | `main.py` |
| React UI / chat changes | `Chat.jsx` |
| Onboarding form changes | `OnboardingForm.jsx` |