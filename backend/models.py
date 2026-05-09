from pydantic import BaseModel
from typing import List, Optional, Literal


Decision = Literal["approve", "deny", "review"]
GroupColor = Literal["red", "purple"]


class Applicant(BaseModel):
    id: int
    group_color: GroupColor
    income: int
    credit_score: int
    debt_to_income: float
    savings: int
    rent_history_months: int
    employment_years: float
    loan_amount: int
    monthly_payment: int
    zip_code: str
    employment_type: str
    context_note: str


class ApplicantInternal(Applicant):
    true_repayment_likelihood: float


class PlayerDecision(BaseModel):
    applicant_id: int
    decision: Decision
    decision_time_seconds: Optional[float] = None


class TrainRequest(BaseModel):
    decisions: List[PlayerDecision]


class PredictionRequest(BaseModel):
    applicant_ids: List[int]


class PredictionResult(BaseModel):
    applicant_id: int
    prediction: Decision
    approval_probability: float
    explanation: List[str]