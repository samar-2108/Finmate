# SQLAlchemy ORM models.
# Two tables:
#   users         — email + hashed password
#   user_profiles — financial profile, quiz, persona (JSON)

from sqlalchemy import (
    Column, Integer, String, DateTime, Float,
    Boolean, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import json


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, index=True, nullable=False)
    name          = Column(String, default="Friend")
    hashed_password = Column(String, nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    is_active     = Column(Boolean, default=True)

    # One user → one profile (one-to-one via uselist=False)
    profile = relationship("UserProfile", back_populates="user", uselist=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now(),
                          server_default=func.now())

    # Financial data stored as JSON strings
    # Use the helper methods below to read/write
    _financial_data  = Column("financial_data", Text, default="{}")
    _quiz_answers    = Column("quiz_answers", Text, default="[]")
    _persona         = Column("persona", Text, default="{}")
    _chat_history    = Column("chat_history", Text, default="[]")

    user = relationship("User", back_populates="profile")

    # ── JSON helpers ──────────────────────────────────────────
    @property
    def financial_data(self) -> dict:
        return json.loads(self._financial_data or "{}")

    @financial_data.setter
    def financial_data(self, value: dict):
        self._financial_data = json.dumps(value)

    @property
    def quiz_answers(self) -> list:
        return json.loads(self._quiz_answers or "[]")

    @quiz_answers.setter
    def quiz_answers(self, value: list):
        self._quiz_answers = json.dumps(value)

    @property
    def persona(self) -> dict:
        return json.loads(self._persona or "{}")

    @persona.setter
    def persona(self, value: dict):
        self._persona = json.dumps(value)

    @property
    def chat_history(self) -> list:
        """Last 20 turns kept for context continuity."""
        return json.loads(self._chat_history or "[]")

    @chat_history.setter
    def chat_history(self, value: list):
        # Keep only last 20 turns to avoid unbounded growth
        self._chat_history = json.dumps(value[-20:])
