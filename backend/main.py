# main.py
# ─────────────────────────────────────────────────────────────
# FastAPI entry point.
# Defines all API routes, request/response models, and
# orchestrates the flow: user input → calculations → persona
# → system prompt → Gemini → response.
#
# Run with: uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs  (auto-generated!)
# ─────────────────────────────────────────────────────────────

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import google.generativeai as genai
from knowledge_base import KNOWLEDGE_BASE

from financial_engine import (
    calc_sip,
    calc_fire_corpus,
    calc_fire_date,
    calc_emergency_shortfall,
    calc_insurance_gap,
    calc_tax_headroom,
    calc_savings_rate,
    calc_asset_allocation,
    calc_goal_future_cost,
)
from market_data import get_market_snapshot
from behaviour_profiler import detect_persona, VALID_ANSWERS
from system_prompt import build_system_prompt

# ── Load environment variables ────────────────────────────────
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in .env file")

genai.configure(api_key=GEMINI_API_KEY)

# ── Read frontend URL from environment (avoids hardcoded placeholder) ─────────
# Set FRONTEND_URL in your .env for production deployments.
# Example: FRONTEND_URL=https://your-app.vercel.app
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

# ── FastAPI app setup ─────────────────────────────────────────
app = FastAPI(
    title="FinMentor API",
    description="AI-powered Indian personal finance advisor backend",
    version="1.0.0",
)

# Build the allowed origins list — always include local dev servers,
# and add the production URL only if it has been configured.
_allowed_origins = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",   # CRA dev server (just in case)
]
if FRONTEND_URL:
    _allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────
# Pydantic validates all incoming data automatically.
# If required fields are missing, FastAPI returns a 422 error.

class UserProfile(BaseModel):
    # Identity
    name: Optional[str] = "Friend"
    age: int = Field(..., ge=18, le=70, description="Age in years")
    city: Optional[str] = "India"
    city_tier: Optional[str] = "metro"         # "metro" | "tier2" | "tier3"
    dependants: Optional[int] = Field(0, ge=0)
    tax_regime: Optional[str] = "new"          # "new" | "old"

    # Income & Expenses (monthly, in ₹)
    monthly_income: float = Field(..., gt=0)
    monthly_expenses: float = Field(..., gt=0)

    # Investments & Liabilities (in ₹)
    existing_investments: Optional[float] = 0
    outstanding_debt: Optional[float] = 0
    liquid_savings: Optional[float] = 0        # FD + savings account

    # Insurance (cover amounts in ₹)
    term_insurance_cover: Optional[float] = 0
    health_insurance_cover: Optional[float] = 0

    # Tax (annual amounts already invested under these sections)
    existing_80c_investments: Optional[float] = 0
    existing_nps_contribution: Optional[float] = 0
    health_premium_paid: Optional[float] = 0

    # Goals
    goals: Optional[list[str]] = ["retirement"]

    @field_validator("monthly_expenses")
    @classmethod
    def expenses_less_than_income(cls, v, info):
        # info.data holds previously validated fields
        income = info.data.get("monthly_income")
        if income and v > income:
            print(f"[warn] expenses (₹{v:,.0f}) exceed income (₹{income:,.0f})")
        return v


class ChatRequest(BaseModel):
    user: UserProfile
    quiz_answers: list[str] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly 3 quiz answer keys from onboarding"
    )
    experience_spend_pct: Optional[int] = Field(20, ge=0, le=100)
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_history: Optional[list[dict]] = []
    @field_validator("quiz_answers")
    @classmethod
    def validate_quiz_keys(cls, v):
        for i, (answer, valid_set) in enumerate(zip(v, VALID_ANSWERS)):
            if answer not in valid_set:
                print(f"[warn] Invalid Q{i+1} answer received: '{answer}'")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid quiz answer for question {i+1}"
                )
        return v


class CalculationsResponse(BaseModel):
    fire_date: dict
    emergency_fund: dict
    insurance_gap: dict
    tax_headroom: dict
    savings_rate: dict
    asset_allocation: dict
    sip_for_retirement: float


class ChatResponse(BaseModel):
    reply: str
    persona: dict
    calculations: CalculationsResponse
    market: dict


# ── Helper: run all financial calculations ────────────────────
def run_calculations(user: UserProfile, nifty_pe: float, market: dict) -> dict:
    """
    Runs all financial engine functions and returns a single dict.
    Called once per chat request so numbers are always up-to-date.
    """
    savings = calc_savings_rate(user.monthly_income, user.monthly_expenses)

    # Read inflation once and convert once (avoids the inconsistent-default bug)
    raw_inflation = market.get("cpi_inflation", 6.0)
    inflation = raw_inflation / 100 if raw_inflation > 1 else raw_inflation

    fire = calc_fire_date(
        current_age=user.age,
        monthly_income=user.monthly_income,
        monthly_expense=user.monthly_expenses,
        current_corpus=user.existing_investments,
        annual_return=0.12,
        inflation=inflation,
    )

    emergency = calc_emergency_shortfall(
        monthly_expense=user.monthly_expenses,
        liquid_savings=user.liquid_savings,
    )

    insurance = calc_insurance_gap(
        annual_income=user.monthly_income * 12,
        existing_term_cover=user.term_insurance_cover,
        existing_health_cover=user.health_insurance_cover,
        age=user.age,
        city_tier=user.city_tier,
    )

    tax = calc_tax_headroom(
        annual_income=user.monthly_income * 12,
        existing_80c=user.existing_80c_investments,
        existing_nps=user.existing_nps_contribution,
        health_premium=user.health_premium_paid,
        regime=user.tax_regime,
    )

    allocation = calc_asset_allocation(
        risk_profile="moderate",   # Will be overwritten after persona detection
        nifty_pe=nifty_pe,
    )

    # Retirement SIP — how much to invest monthly to reach FIRE corpus
    fire_corpus = calc_fire_corpus(user.monthly_expenses)
    years_to_60 = max(1, 60 - user.age)
    sip_for_retirement = calc_sip(
        target=fire_corpus,
        years=years_to_60,
        annual_rate=0.12,
    )

    return {
        "fire_date": fire,
        "emergency_fund": emergency,
        "insurance_gap": insurance,
        "tax_headroom": tax,
        "savings_rate": savings,
        "asset_allocation": allocation,
        "sip_for_retirement": sip_for_retirement,
    }


# ── Routes ────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """
    Health check endpoint.
    Used by UptimeRobot to keep the Render server awake.
    """
    return {"status": "ok", "service": "FinMentor API"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint.

    Flow:
    1. Fetch live market data
    2. Run all financial calculations
    3. Detect user persona from quiz
    4. Build system prompt
    5. Call Gemini with conversation history
    6. Return AI reply + structured data for UI
    """
    user = request.user

    # Step 1: Get live market data (concurrent API calls)
    try:
        market = await get_market_snapshot()
    except Exception as e:
        print(f"[main] Market data failed: {e} — using fallbacks")
        market = {
            "usd_inr": 83.5, "nifty_price": 22500, "nifty_pe": 22.3,
            "nifty_change_pct": 0.0, "gold_price": 72000, "repo_rate": 6.5,
            "cpi_inflation": 5.1, "fd_best_rate": 7.25,
            "market_signal": "fair_value",
        }

    # Step 2: Run all financial calculations
    calculations = run_calculations(user, market.get("nifty_pe", 22.3), market)

    # Step 3: Detect persona
    persona = detect_persona(
        quiz_answers=request.quiz_answers,
        monthly_income=user.monthly_income,
        monthly_expense=user.monthly_expenses,
        experience_spend_pct=request.experience_spend_pct,
        has_dependants=user.dependants > 0,
        outstanding_debt=user.outstanding_debt,
    )

    # Update asset allocation with persona risk profile
    calculations["asset_allocation"] = calc_asset_allocation(
        risk_profile=persona.get("risk_profile", "moderate"),
        nifty_pe=market.get("nifty_pe"),
    )

    # Step 4: Build system prompt
    system = build_system_prompt(
        user=user.model_dump(),
        market=market,
        persona=persona,
        calculations=calculations,
    )

    # Step 5: Build conversation messages for Gemini
    gemini_model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system,
    )

    # Build message history for multi-turn.
    # The frontend sends apiHistory which always starts with a "user" turn
    # (the internal greeting prompt), so Gemini never receives history that
    # begins with a "model" message.
    history = []
    for turn in request.conversation_history:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ["user", "model"] and content:
            history.append({"role": role, "parts": [content]})

    # Step 6: Generate response
    try:
        if history:
            chat_session = gemini_model.start_chat(history=history)
            response = chat_session.send_message(request.message)
        else:
            response = gemini_model.generate_content(request.message)

        reply = response.text
        if not reply:
            reply = "I wasn't able to generate a response to that. Could you rephrase your financial question?"

    except Exception as e:
        error_str = str(e).lower()
        if "quota" in error_str or "rate" in error_str or "429" in error_str:
            raise HTTPException(
                status_code=429,
                detail="API rate limit reached. Please wait a moment and try again."
            )
        elif "safety" in error_str or "blocked" in error_str:
            raise HTTPException(
                status_code=400,
                detail="Request was blocked. Please rephrase your financial question."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {str(e)}"
            )

    return ChatResponse(
        reply=reply,
        persona=persona,
        calculations=CalculationsResponse(**calculations),
        market=market,
    )


@app.post("/calculate")
async def calculate_only(user: UserProfile):
    """
    Returns financial calculations without calling the AI.
    Useful for showing the Roadmap screen before the user chats.
    """
    market = await get_market_snapshot()
    calculations = run_calculations(user, market.get("nifty_pe", 22.3), market)
    return {"calculations": calculations, "market": market}


@app.get("/goal-cost")
def goal_cost(current_cost: float, years_away: int, goal_type: str = "retirement"):
    """
    Quick endpoint to calculate future cost of a goal.
    Example: /goal-cost?current_cost=2000000&years_away=10&goal_type=child_education
    """
    inflation = KNOWLEDGE_BASE["goal_inflation_rates"].get(goal_type, 0.06)
    future_cost = calc_goal_future_cost(current_cost, years_away, inflation)
    return {
        "current_cost": current_cost,
        "future_cost": future_cost,
        "years_away": years_away,
        "inflation_used": inflation,
        "goal_type": goal_type,
    }