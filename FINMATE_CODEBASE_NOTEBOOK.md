# FinMate — Complete Codebase Notebook
> Last audited: March 2026 | Stack: FastAPI + SQLite + Gemini + React + Tailwind v4

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Backend — File-by-File](#3-backend-file-by-file)
4. [Frontend — File-by-File](#4-frontend-file-by-file)
5. [Data Flow Walkthrough](#5-data-flow-walkthrough)
6. [Bug Report](#6-bug-report)
7. [Improvement Suggestions](#7-improvement-suggestions)
8. [Environment Setup Checklist](#8-environment-setup-checklist)

---

## 1. Project Overview

**FinMate** (branded "FinMentor" in the backend, "FinMate" in the frontend) is an AI-powered personal finance advisor built for India. It combines:

- A **behaviour profiler** that classifies users into one of 6 financial personas via a quiz
- A **financial engine** with deterministic math (SIP, FIRE, insurance gap, tax headroom, etc.)
- A **live market data layer** (Nifty 50, RBI repo rate, gold, USD/INR)
- A **Gemini LLM** (Google) that receives all of the above as a structured system prompt and answers user questions
- A **React frontend** with a dark fintech UI, multi-step onboarding, and a real-time chat dashboard

The app is a full-stack monorepo. Backend is a FastAPI Python app; frontend is a Vite/React app.

---

## 2. Architecture Diagram

```
Browser (React)
│
├── AuthPage.jsx        → POST /auth/login | POST /auth/signup
├── OnboardingForm.jsx  → PUT  /profile/save
└── Chat.jsx            → POST /chat
                               │
                        FastAPI (main.py)
                               │
          ┌────────────────────┼────────────────────────┐
          │                    │                        │
  behaviour_profiler.py  financial_engine.py    market_data.py
  (Persona detection)    (Pure math formulas)   (Live APIs:
                                                 NSE, gold,
                                                 USD/INR)
          │                    │
          └────────────────────┘
                     │
             system_prompt.py
             (Assembles full context)
                     │
             Google Gemini API
             (gemini-2.5-flash / flash-lite)
                     │
             SQLite (SQLAlchemy)
             users + user_profiles tables
```

---

## 3. Backend — File-by-File

### 3.1 `main.py` — FastAPI Entry Point

**Purpose:** Registers all routes, wires together all modules, handles auth middleware.

**Key routes:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/signup | No | Create user, return JWT |
| POST | /auth/login | No | Verify password, return JWT |
| GET | /auth/me | Yes | Return user + profile + chat history |
| PUT | /profile/save | Yes | Save financial profile, run persona detection |
| POST | /chat | Yes | Core AI chat endpoint |
| POST | /calculate | Yes | Recalculate metrics for a given profile |
| GET | /goal-cost | Yes | Future-value calculator for a specific goal |
| GET | /health | No | Health check |

**Notable design decisions:**
- Profile resolution in `/chat`: uses DB profile if no `request.user` override is provided. This allows the frontend to either send a full profile override or rely on the saved one.
- Model selection: `gemini-2.5-flash-lite` for short messages (<200 chars), `gemini-2.5-flash` for longer ones.
- Chat history: saved to DB after every turn (last 20 turns only). The `contents` list merges DB history + request history + new message.

**Known issue (Bug #1):** The `google-generativeai` import uses the new `google.genai.Client` API but `requirements.txt` pins `google-generativeai>=0.8.0`, which ships the old `genai.configure()` API. These are two different packages/APIs. See Bug section.

---

### 3.2 `behaviour_profiler.py` — Persona Engine

**Purpose:** The core USP. Takes quiz answers + financial numbers → outputs one of 6 personas.

**Personas:**

| ID | Name | Tone | Risk | Plan Style |
|----|------|------|------|------------|
| fire | FIRE Seeker | structured | aggressive/moderate | number_heavy |
| yolo | YOLO Traveller | casual | moderate | story_driven |
| family | Family-First Planner | warm | moderate | balanced |
| debt | Debt Slayer | direct | conservative | number_heavy |
| wealth | Wealth Builder | ambitious | aggressive/moderate | number_heavy |
| balanced | Balanced Builder | friendly | moderate | balanced |

**Scoring logic:**
1. Q1 (windfall spending) + Q2 (biggest fear) + Q3 (retirement horizon) → score dict
2. Contextual boosts: savings rate ≥ 40% → +2 FIRE; experience_spend ≥ 35% → +2 YOLO; has_dependants → +2 family; debt > 24× income → +3 debt
3. If top two scores are within 2 points → "balanced" wins
4. `_calc_risk_score()` generates 1–10 risk score from savings rate + persona + fear answer

**Input validation:** `VALID_ANSWERS` set is exported for use in `main.py`'s Pydantic model.

---

### 3.3 `financial_engine.py` — Pure Math

**Purpose:** All deterministic financial calculations. Zero API calls, zero AI.

**Functions:**

| Function | Formula | Usage |
|----------|---------|-------|
| `calc_sip()` | FV × r / [(1+r)^n − 1] | Monthly SIP to reach a corpus |
| `calc_fire_corpus()` | Annual expenses × 25 (4% rule) | FIRE target |
| `calc_future_value()` | P × (1+r)^n | Lump sum growth |
| `calc_goal_future_cost()` | Cost × (1+inflation)^years | Inflation-adjusted goal |
| `calc_emergency_shortfall()` | 6× monthly expenses vs liquid savings | Emergency fund gap |
| `calc_insurance_gap()` | 12× annual income vs existing term cover | Insurance gap |
| `calc_tax_headroom()` | 80C/80D/NPS limits vs existing investments | Tax saving potential |
| `calc_fire_date()` | Year-by-year simulation (50yr cap) | FIRE age estimator |
| `calc_asset_allocation()` | Risk profile + Nifty P/E tilt | Recommended allocation |
| `calc_savings_rate()` | (Income - Expenses) / Income | Savings rate + assessment |

**`calc_fire_date()` is the most complex function.** It runs a year-by-year loop with:
- 12% equity return assumption
- Salary growth at 8% p.a.
- Inflation applied to expenses each year
- FIRE corpus target recalculated each year (since expenses inflate)

---

### 3.4 `knowledge_base.py` — Static Knowledge

**Purpose:** All Indian financial rules as a single Python dict. Sourced from SEBI, AMFI, Income Tax Act, RBI.

**Contains:**
- New and old regime tax slabs (FY 2024–25)
- 80C/80D/NPS/HRA deduction limits
- Investment instrument details (PPF, ELSS, NPS, FD, gold, Nifty50)
- Asset allocation by risk profile (conservative/moderate/aggressive/very_aggressive)
- Nifty P/E valuation zones (undervalued <18, overvalued >24)
- Rules of thumb (6-month emergency fund, 12× term insurance, 25× FIRE corpus)
- Inflation rates by category (general CPI 6%, education 10%, healthcare 10%)

**Update cadence:** Tax slabs → April each year. Instrument rates → quarterly. P/E tilt thresholds → annually.

---

### 3.5 `market_data.py` — Live Market APIs

**Purpose:** Fetch live data concurrently using `httpx` async. Every API has a hardcoded fallback.

**APIs used:**

| Data | Source | Notes |
|------|--------|-------|
| USD/INR | exchangerate-api.com | Free, no key, 1500 req/month |
| Gold price | Alpha Vantage (GOLDBEES.BSE) | Free key, 25 req/day |
| Nifty 50 P/E + price | NSE India | Blocks server-side; uses browser headers trick |
| Repo rate, CPI, FD rate | Hardcoded fallbacks | Updated manually |

**`get_market_snapshot()`** uses `asyncio.gather()` with `return_exceptions=True` so one API failure doesn't kill the others. Returns a clean dict with a derived `market_signal` string (e.g. "slightly_overvalued").

**Known issue (Bug #2):** NSE blocks server-side requests despite the browser-like headers. The fallback values will be used most of the time in production.

---

### 3.6 `system_prompt.py` — Context Builder

**Purpose:** Assembles the complete system prompt from user data + market + persona + calculations.

**Structure of the prompt:**
1. Role definition (FinMentor persona)
2. User profile section (name, age, income, expenses, surplus, corpus, debt, insurance, goals)
3. Persona section (type, risk score, framing instructions)
4. Live market data section (Nifty, P/E, repo rate, CPI, gold, FD rate)
5. Pre-calculated metrics (FIRE date, emergency fund, insurance gap, tax headroom, allocation)
6. Indian finance rules (priority order, tax limits, benchmarks, return assumptions, never-recommend list)
7. Response guidelines (use ₹/lakh/crore notation, add SEBI disclaimer, match persona tone)

**Quality note:** This is the single biggest factor in response quality. The persona-specific `framing` instruction in `behaviour_profiler.py` gets injected here and tells the LLM exactly how to talk to this user type.

---

### 3.7 `models.py` — Database Models

**Purpose:** SQLAlchemy ORM for two tables.

**`users` table:** id, email (unique), name, hashed_password, created_at, is_active

**`user_profiles` table:** id, user_id (FK), updated_at, financial_data (Text/JSON), quiz_answers (Text/JSON), persona (Text/JSON), chat_history (Text/JSON)

**JSON storage pattern:** All complex fields stored as JSON strings in Text columns. Helper `@property` / `.setter` pairs handle serialisation/deserialisation transparently.

**Chat history capped:** `chat_history.setter` slices to last 20 turns via `value[-20:]`.

---

### 3.8 `database.py` — DB Setup

**Purpose:** SQLAlchemy engine + session factory + `get_db()` FastAPI dependency.

**DB:** SQLite by default (`finmentor.db`). Swap `DATABASE_URL` env var to PostgreSQL for production.

---

### 3.9 `auth_utils.py` — JWT + Password

**Purpose:** bcrypt password hashing + JWT creation/verification.

**Tokens expire in 7 days.** Algorithm: HS256. Secret key from env var `JWT_SECRET_KEY` (defaults to a dev placeholder — must be changed in production).

---

## 4. Frontend — File-by-File

### 4.1 `main.jsx` — Entry Point

Wraps `<App>` in `<BrowserRouter>`. Imports global CSS (`index.css`).

---

### 4.2 `App.jsx` — Root Router

Three-state routing logic inside `AppContent`:

```
loading=true           → Loading spinner
!user                  → <AuthPage />
user && !has_profile   → <OnboardingForm />
user && has_profile    → <Chat />
```

`AuthProvider` wraps everything. A global CSS `@keyframes spin` is injected into `<head>` programmatically.

---

### 4.3 `AuthContext.jsx` — Global Auth State

**State managed:** `token`, `user`, `profile`, `quizAnswers`, `persona`, `chatHistory`, `loading`

**Session restore:** `useEffect` on `token` — calls `/auth/me` to restore full session from localStorage token on mount. The `loading` state is initialized to `true` only if a token already exists in localStorage (avoids extra render on fresh sessions).

**Functions:**
- `login(tokenResp)` — stores token in localStorage, triggers session restore effect
- `saveProfile(financialData, answers, personaData)` — updates local state after onboarding
- `appendChatTurn(userMsg, aiReply)` — appends to local `chatHistory`
- `logout()` — clears all state + localStorage

**Known issue (Bug #3):** `saveProfile` only stores `{ type: result.persona_type }` from the onboarding result — a stripped-down persona object. The full persona (risk_score, framing, etc.) is only loaded on the *next* session restore. This means the Chat dashboard sidebar will show skeleton loaders until the user refreshes.

---

### 4.4 `AuthPage.jsx` — Login / Signup

Dark fintech card with tab switcher. Direct `fetch` calls (not through `api.js`) to `/auth/login` and `/auth/signup`. On success, calls `login(data)` from AuthContext.

---

### 4.5 `OnboardingForm.jsx` — Multi-Step Onboarding

**5 steps:** basics → finances → insurance → quiz → confirm + save

**Step validation:** `canAdvance()` checks required fields before enabling "Continue →" button.

**On finish:** calls `apiSaveProfile()` from `api.js`, then calls `onComplete(financialData, quizAnswers, { type: result.persona_type })`.

**Known issue (Bug #4):** The goals field is hardcoded to `["retirement"]` with no UI to change it. The onboarding form has no goals selection step despite the system prompt using goals.

---

### 4.6 `Chat.jsx` — Main Chat Component

**State:**
- `messages` — UI message array (what user sees)
- `apiHistory` — separate history for Gemini API calls (correctly starts with "user" turn)
- `input`, `isLoading`, `lastError`
- `persona`, `calculations`, `market` — sidebar data from API responses

**Initial greeting flow:**
1. On mount, sends a hidden prompt to seed the conversation
2. Stores both sides (user prompt + model reply) in `apiHistory`
3. Shows only the model reply in `messages`
4. This correctly avoids the Gemini "history must start with user" error

**Markdown renderer:** Custom `renderMarkdown()` function — handles H1/H2/H3, bullet lists, horizontal rules, bold/italic/code inline formatting. Not a library — custom implementation.

**Sidebar dashboard:** Shows persona card, financial metrics (savings rate, surplus, FIRE age, FIRE target, emergency fund, insurance gaps), asset allocation bar chart, SIP needed, goals. Has a toggle to hide/show.

**Market ticker:** Top nav bar shows live Nifty price, P/E, repo rate, USD/INR, best FD rate.

**Known issue (Bug #5):** `sendChat()` in `api.js` does not send `conversation_history` parameter — the function signature is `sendChat(message, overrideUser, overrideQuiz)` but `Chat.jsx` calls it as `sendChat(userProfile, quizAnswers, text, apiHistory, experiencePct)`. The parameter order is wrong.

---

### 4.7 `api.js` — API Client

**`authFetch()`:** Wrapper that attaches `Authorization: Bearer <token>` header from localStorage.

**Functions:**
- `apiSignup()`, `apiLogin()` — unauthenticated fetch
- `apiGetMe()` — GET /auth/me
- `apiSaveProfile()` — PUT /profile/save
- `sendChat()` — POST /chat ← **has parameter order bug (Bug #5)**
- `getCalculations()` — POST /calculate

---

### 4.8 `index.css` — Global Styles

Imports Google Fonts (DM Sans, DM Serif Display, JetBrains Mono). Defines CSS custom properties via `@theme` (Tailwind v4 syntax). Includes animations (`fadeUp`, `pulse-dot`, `shimmer`, `spin`), scrollbar styling, and `.chat-content` markdown styles.

---

## 5. Data Flow Walkthrough

### 5.1 First-time User

```
1. User fills OnboardingForm (5 steps)
2. PUT /profile/save → detect_persona() → save to DB
3. App routes to <Chat />
4. Chat mounts → sendChat() with greeting prompt
5. /chat endpoint:
   a. Loads user profile from DB
   b. Calls get_market_snapshot() concurrently
   c. Runs all financial calculations (run_calculations())
   d. Loads/caches persona from DB
   e. Builds system_prompt via build_system_prompt()
   f. Calls Gemini API with full context
   g. Saves chat turn to DB
   h. Returns reply + persona + calculations + market
6. Chat sidebar populates with financial data
7. User chats; each message sends apiHistory for context continuity
```

### 5.2 Returning User

```
1. App mounts → finds fm_token in localStorage
2. GET /auth/me → restores user + profile + quiz_answers + persona + chat_history
3. App routes to <Chat /> (skips OnboardingForm)
4. Same flow from step 4 above
```

---




## 6. Improvement Suggestions

### 6.1 UX / Product

1. **Goals selection in onboarding** — Currently hardcoded to `["retirement"]`. A multi-select on Step 4 (confirm screen) would let users pick from: retirement, child education, home purchase, travel, etc. The financial engine already supports goal-specific inflation rates.

2. **FIRE date visualisation** — The sidebar shows FIRE age as a plain number. A small timeline bar showing current age → FIRE age → life expectancy would be far more motivating.

3. **Onboarding progress persistence** — If the user closes the browser mid-onboarding, they start over. Consider `localStorage` caching of `form` state per step.

4. **Chat export / share** — A "Copy plan as PDF/text" button would let users save their financial plan. Very common in fintech apps.

5. **Persona re-detection** — Currently persona is fixed after first onboarding. Add a "Retake quiz" option in the sidebar since life circumstances change.

6. **Empty state for new chat** — The current greeting is generated by the AI. If the API is down, users see an error message with no way to interact. A static "Welcome! Here are things you can ask me…" fallback would improve resilience.

### 6.2 Security

7. **JWT secret in production** — `auth_utils.py` has `SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-this-in-production")`. Add a startup check that raises an error if the default key is used in non-dev environments.

8. **Rate limiting** — No rate limiting on any endpoint. `/chat` calls the Gemini API on every request. Add `slowapi` or similar for rate limiting.

9. **Input sanitisation** — The `message` field allows up to 2000 chars but there's no XSS sanitisation. Since the frontend renders AI responses as raw HTML via `dangerouslySetInnerHTML`, an adversarially crafted AI response could inject HTML. The `renderMarkdown()` function does not sanitise — add DOMPurify or similar.

### 6.3 Technical / Performance

10. **Separate API history tracking** — `Chat.jsx` already correctly separates `messages` (UI) from `apiHistory` (API context). This is a good pattern but the `apiHistory` can grow unboundedly within a session. Mirror the DB's 20-turn cap in the frontend.

11. **Optimistic UI for chat** — The user message appears immediately, but a 2-3 second spinner feels long. Consider a streaming endpoint (Gemini supports streaming) for better perceived performance.

12. **Market data caching** — `get_market_snapshot()` is called on every `/chat` request. It fetches 3 external APIs concurrently. Even with a 5-8s timeout, this adds latency. Add an in-memory cache (e.g. `cachetools.TTLCache`) with a 5-minute TTL.

13. **`google-genai` vs `google-generativeai`** — See Bug #1. This is the most critical fix needed before the app works at all.

14. **requirements.txt versioning** — Several packages are pinned to specific old versions (FastAPI 0.111.0, Pydantic 2.7.1). These may have security patches. Run `pip-audit` before deploying.

15. **Database migrations** — `Base.metadata.create_all()` is used for schema setup. This is fine for an MVP but breaks in production when schema changes. Add Alembic for proper migrations.

---

## 7. Environment Setup Checklist

### Backend
```bash
cd backend  # or wherever main.py lives
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # Fix Bug #1 first

# .env file needed:
GEMINI_API_KEY=your_key_here
ALPHA_VANTAGE_KEY=your_key_here
JWT_SECRET_KEY=a_strong_random_hex_string
DATABASE_URL=sqlite:///./finmentor.db  # optional, this is the default

uvicorn main:app --reload --port 8000
```

### Frontend
```bash
npm install

# .env file needed:
VITE_API_URL=http://localhost:8000

npm run dev  # Starts on http://localhost:5173
```

### Required API Keys
| Key | Where to get | Free tier |
|-----|-------------|-----------|
| GEMINI_API_KEY | Google AI Studio | Yes (generous) |
| ALPHA_VANTAGE_KEY | alphavantage.co | Yes (25 req/day) |
| JWT_SECRET_KEY | Generate locally: `python -c "import secrets; print(secrets.token_hex(32))"` | N/A |

---

*End of FinMate Codebase Notebook*
