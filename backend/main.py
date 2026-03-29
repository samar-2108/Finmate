# FastAPI entry point — with user auth + new google-genai SDK.

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from sqlalchemy.orm import Session
from google import genai
from knowledge_base import KNOWLEDGE_BASE

from database import engine, get_db, Base
from models import User, UserProfile as UserProfileModel
from auth_utils import hash_password, verify_password, create_access_token, decode_access_token

from financial_engine import (
    calc_sip, calc_fire_corpus, calc_fire_date,
    calc_emergency_shortfall, calc_insurance_gap,
    calc_tax_headroom, calc_savings_rate,
    calc_asset_allocation, calc_goal_future_cost,
)
from market_data import get_market_snapshot
from behaviour_profiler import detect_persona, VALID_ANSWERS
from system_prompt import build_system_prompt

load_dotenv()

Base.metadata.create_all(bind=engine)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in .env file")

client = genai.Client(api_key=GEMINI_API_KEY)

FRONTEND_URL = os.getenv("FRONTEND_URL", "")

app = FastAPI(
    title="FinMentor API",
    description="AI-powered Indian personal finance advisor — with user accounts",
    version="2.0.0",
)

_allowed_origins = ["http://localhost:5173", "http://localhost:3000"]
if FRONTEND_URL:
    _allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


#Auth dependency
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Decodes JWT, returns the User row. Raises 401 if invalid."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
    email: str = payload.get("sub")
    if not email:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise credentials_exception
    return user


#Pydantic models

class SignupRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)
    name: Optional[str] = "Friend"

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: str
    has_profile: bool


class UserProfile(BaseModel):
    name: Optional[str] = "Friend"
    age: int = Field(..., ge=18, le=70)
    city: Optional[str] = "India"
    city_tier: Optional[str] = "metro"
    dependants: Optional[int] = Field(0, ge=0)
    tax_regime: Optional[str] = "new"
    monthly_income: float = Field(..., gt=0)
    monthly_expenses: float = Field(..., gt=0)
    existing_investments: Optional[float] = 0
    outstanding_debt: Optional[float] = 0
    liquid_savings: Optional[float] = 0
    term_insurance_cover: Optional[float] = 0
    health_insurance_cover: Optional[float] = 0
    existing_80c_investments: Optional[float] = 0
    existing_nps_contribution: Optional[float] = 0
    health_premium_paid: Optional[float] = 0
    goals: Optional[list[str]] = ["retirement"]

    @field_validator("monthly_expenses")
    @classmethod
    def expenses_check(cls, v, info):
        income = info.data.get("monthly_income")
        if income and v > income:
            print(f"[warn] expenses (₹{v:,.0f}) exceed income (₹{income:,.0f})")
        return v


class SaveProfileRequest(BaseModel):
    financial_data: UserProfile
    quiz_answers: list[str] = Field(..., min_length=3, max_length=3)
    experience_spend_pct: Optional[int] = Field(20, ge=0, le=100)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    user: Optional[UserProfile] = None
    quiz_answers: Optional[list[str]] = None
    experience_spend_pct: Optional[int] = Field(20, ge=0, le=100)
    conversation_history: Optional[list[dict]] = []

    @field_validator("quiz_answers")
    @classmethod
    def validate_quiz_keys(cls, v):
        if v is None:
            return v
        for i, (answer, valid_set) in enumerate(zip(v, VALID_ANSWERS)):
            if answer not in valid_set:
                print(f"[warn] Invalid Q{i+1} answer: '{answer}'")
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


#Auth routes

@app.post("/auth/signup", response_model=TokenResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    user = User(
        email=req.email.lower(),
        name=req.name or "Friend",
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.email})
    return TokenResponse(
        access_token=token, user_id=user.id,
        name=user.name, email=user.email, has_profile=False,
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_access_token({"sub": user.email})
    has_profile = user.profile is not None and bool(user.profile.financial_data)
    return TokenResponse(
        access_token=token, user_id=user.id,
        name=user.name, email=user.email, has_profile=has_profile,
    )


@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    profile_data = quiz_answers = persona = chat_history = None
    if current_user.profile:
        profile_data  = current_user.profile.financial_data
        quiz_answers  = current_user.profile.quiz_answers
        persona       = current_user.profile.persona
        chat_history  = current_user.profile.chat_history
    return {
        "user_id":      current_user.id,
        "name":         current_user.name,
        "email":        current_user.email,
        "has_profile":  bool(profile_data),
        "profile":      profile_data or {},
        "quiz_answers": quiz_answers or [],
        "persona":      persona or {},
        "chat_history": chat_history or [],
    }


#Profile save route

@app.put("/profile/save")
def save_profile(
    req: SaveProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves financial profile + quiz after onboarding. Runs persona detection."""
    profile_dict = req.financial_data.model_dump()
    persona = detect_persona(
        quiz_answers=req.quiz_answers,
        monthly_income=profile_dict["monthly_income"],
        monthly_expense=profile_dict["monthly_expenses"],
        experience_spend_pct=req.experience_spend_pct,
        has_dependants=profile_dict.get("dependants", 0) > 0,
        outstanding_debt=profile_dict.get("outstanding_debt", 0),
    )
    db_profile = current_user.profile
    if not db_profile:
        db_profile = UserProfileModel(user_id=current_user.id)
        db.add(db_profile)
    db_profile.financial_data = profile_dict
    db_profile.quiz_answers   = req.quiz_answers
    db_profile.persona        = persona
    db.commit()
    return {"status": "saved", "persona_type": persona.get("type")}


#Financial calculation helper

def run_calculations(user_dict: dict, nifty_pe: float, market: dict) -> dict:
    raw_inflation = market.get("cpi_inflation", 6.0)
    inflation = raw_inflation / 100 if raw_inflation > 1 else raw_inflation

    savings   = calc_savings_rate(user_dict["monthly_income"], user_dict["monthly_expenses"])
    fire      = calc_fire_date(
        current_age=user_dict["age"],
        monthly_income=user_dict["monthly_income"],
        monthly_expense=user_dict["monthly_expenses"],
        current_corpus=user_dict.get("existing_investments", 0),
        annual_return=0.12,
        inflation=inflation,
    )
    emergency = calc_emergency_shortfall(
        monthly_expense=user_dict["monthly_expenses"],
        liquid_savings=user_dict.get("liquid_savings", 0),
    )
    insurance = calc_insurance_gap(
        annual_income=user_dict["monthly_income"] * 12,
        existing_term_cover=user_dict.get("term_insurance_cover", 0),
        existing_health_cover=user_dict.get("health_insurance_cover", 0),
        age=user_dict["age"],
        city_tier=user_dict.get("city_tier", "metro"),
    )
    tax = calc_tax_headroom(
        annual_income=user_dict["monthly_income"] * 12,
        existing_80c=user_dict.get("existing_80c_investments", 0),
        existing_nps=user_dict.get("existing_nps_contribution", 0),
        health_premium=user_dict.get("health_premium_paid", 0),
        regime=user_dict.get("tax_regime", "new"),
    )
    allocation       = calc_asset_allocation(risk_profile="moderate", nifty_pe=nifty_pe)
    fire_corpus      = calc_fire_corpus(user_dict["monthly_expenses"], inflation=inflation)
    years_to_60      = max(1, 60 - user_dict["age"])
    sip_for_retirement = calc_sip(target=fire_corpus, years=years_to_60, annual_rate=0.12)

    return {
        "fire_date": fire, "emergency_fund": emergency,
        "insurance_gap": insurance, "tax_headroom": tax,
        "savings_rate": savings, "asset_allocation": allocation,
        "sip_for_retirement": sip_for_retirement,
    }


#Chat route

@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Resolve profile: use request override, else load from DB
    if request.user:
        user_dict    = request.user.model_dump()
        quiz_answers = request.quiz_answers or []
    elif current_user.profile and current_user.profile.financial_data:
        user_dict    = current_user.profile.financial_data
        quiz_answers = current_user.profile.quiz_answers
    else:
        raise HTTPException(
            status_code=400,
            detail="No financial profile found. Please complete onboarding first."
        )

    # Step 1: Market data
    try:
        market = await get_market_snapshot()
    except Exception as e:
        print(f"[main] Market data failed: {e} — using fallbacks")
        market = {
            "usd_inr": 83.5, "nifty_price": 22500, "nifty_pe": 22.3,
            "nifty_change_pct": 0.0, "gold_price": 72000, "repo_rate": 6.5,
            "cpi_inflation": 5.1, "fd_best_rate": 7.25, "market_signal": "fair_value",
        }

    # Step 2: Calculations
    calculations = run_calculations(user_dict, market.get("nifty_pe", 22.3), market)

    # Step 3: Persona (use DB cache if available)
    if current_user.profile and current_user.profile.persona:
        persona = current_user.profile.persona
    else:
        persona = detect_persona(
            quiz_answers=quiz_answers,
            monthly_income=user_dict["monthly_income"],
            monthly_expense=user_dict["monthly_expenses"],
            experience_spend_pct=request.experience_spend_pct,
            has_dependants=user_dict.get("dependants", 0) > 0,
            outstanding_debt=user_dict.get("outstanding_debt", 0),
        )

    calculations["asset_allocation"] = calc_asset_allocation(
        risk_profile=persona.get("risk_profile", "moderate"),
        nifty_pe=market.get("nifty_pe"),
    )

    # Step 4: System prompt
    system = build_system_prompt(
        user=user_dict, market=market,
        persona=persona, calculations=calculations,
    )

    # Step 5: Model selection
    model_name = "gemini-2.5-flash-lite"
    if len(request.message) > 200:
        model_name = "gemini-2.5-flash"

    # Step 6: Build contents (saved DB history + request history + new message)
    contents = []
    saved_history = (current_user.profile.chat_history or []) if current_user.profile else []
    all_history = saved_history + (request.conversation_history or [])

    for turn in all_history:
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "model") and content:
            contents.append({"role": role, "parts": [{"text": content}]})

    contents.append({"role": "user", "parts": [{"text": request.message}]})

    # Step 7: Call Gemini
    try:
        gemini_response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=genai.types.GenerateContentConfig(system_instruction=system),
        )
        reply = gemini_response.text
        if not reply:
            reply = "I wasn't able to generate a response. Could you rephrase your financial question?"

    except Exception as e:
        error_str = str(e).lower()
        if "quota" in error_str or "rate" in error_str or "429" in error_str:
            return ChatResponse(
                reply="I'm a bit busy right now 😅 Try again in a few seconds.",
                persona=persona,
                calculations=CalculationsResponse(**calculations),
                market=market,
            )
        elif "safety" in error_str or "blocked" in error_str:
            raise HTTPException(status_code=400,
                detail="Request was blocked. Please rephrase your question.")
        else:
            raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Step 8: Save updated chat history to DB
    if current_user.profile:
        updated = (current_user.profile.chat_history or []) + [
            {"role": "user",  "content": request.message},
            {"role": "model", "content": reply},
        ]
        current_user.profile.chat_history = updated
        db.commit()

    return ChatResponse(
        reply=reply,
        persona=persona,
        calculations=CalculationsResponse(**calculations),
        market=market,
    )


#Utility routes

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "FinMentor API v2"}


@app.post("/calculate")
async def calculate_only(
    user: UserProfile,
    current_user: User = Depends(get_current_user),
):
    market = await get_market_snapshot()
    calculations = run_calculations(user.model_dump(), market.get("nifty_pe", 22.3), market)
    return {"calculations": calculations, "market": market}


@app.get("/goal-cost")
def goal_cost(
    current_cost: float,
    years_away: int,
    goal_type: str = "retirement",
    _: User = Depends(get_current_user),
):
    inflation = KNOWLEDGE_BASE["goal_inflation_rates"].get(goal_type, 0.06)
    future_cost = calc_goal_future_cost(current_cost, years_away, inflation)
    return {
        "current_cost": current_cost,
        "future_cost": future_cost,
        "years_away": years_away,
        "inflation_used": inflation,
        "goal_type": goal_type,
    }
