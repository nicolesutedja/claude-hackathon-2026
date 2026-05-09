from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import TrainRequest, PredictionRequest
from data import APPLICANTS, TRAINING_APPLICANTS, AI_APPLICANTS, get_public_applicant
from ml import LoanModel
from fairness import calculate_fairness_metrics


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

loan_model = LoanModel()

PLAYER_DECISIONS = []
LAST_PREDICTIONS = []


@app.get("/")
def root():
    return {
        "message": "LoanLine backend is running",
        "goal": "Show how AI loan systems can learn racialized proxy bias from human training data."
    }


@app.get("/training-applicants")
def get_training_applicants(round_number: int = 1):
    """
    Stage 1 manual processing.

    round_number:
    1 -> 45 seconds frontend timer
    2 -> 30 seconds frontend timer
    3 -> 15 seconds frontend timer

    Backend returns different batches for each round.
    """
    if round_number == 1:
        batch = TRAINING_APPLICANTS[0:15]
        seconds = 45
    elif round_number == 2:
        batch = TRAINING_APPLICANTS[15:30]
        seconds = 30
    elif round_number == 3:
        batch = TRAINING_APPLICANTS[30:45]
        seconds = 15
    else:
        raise HTTPException(status_code=400, detail="round_number must be 1, 2, or 3.")

    return {
        "stage": "manual_processing",
        "round_number": round_number,
        "timer_seconds": seconds,
        "manager_message": get_manager_message(round_number),
        "applicants": [get_public_applicant(a) for a in batch],
    }


def get_manager_message(round_number: int):
    if round_number == 1:
        return "Take a look, but keep the line moving."
    if round_number == 2:
        return "We need faster decisions. Efficiency matters."
    return "No delays. Approve or deny quickly."


@app.post("/submit-decisions")
def submit_decisions(payload: TrainRequest):
    global PLAYER_DECISIONS

    # Append so frontend can submit after each round.
    PLAYER_DECISIONS.extend(payload.decisions)

    approved = sum(1 for d in PLAYER_DECISIONS if d.decision == "approve")
    denied = sum(1 for d in PLAYER_DECISIONS if d.decision == "deny")
    review = sum(1 for d in PLAYER_DECISIONS if d.decision == "review")

    return {
        "message": "Decisions saved.",
        "total": len(PLAYER_DECISIONS),
        "approved": approved,
        "denied": denied,
        "review": review,
    }


@app.post("/train-model")
def train_model():
    try:
        result = loan_model.train(TRAINING_APPLICANTS, PLAYER_DECISIONS)
        return {
            "message": "Automation shift complete. AI trained on your manual approval history.",
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/ai-applicants")
def get_ai_applicants(limit: int = 20):
    batch = AI_APPLICANTS[:limit]

    return {
        "stage": "automation_shift",
        "message": "Manual controls disabled. Run batch approval using the trained AI.",
        "applicants": [get_public_applicant(a) for a in batch],
    }


@app.post("/predict")
def predict(payload: PredictionRequest):
    global LAST_PREDICTIONS

    results = []
    applicant_map = {a.id: a for a in APPLICANTS}

    for applicant_id in payload.applicant_ids:
        applicant = applicant_map.get(applicant_id)

        if applicant is None:
            raise HTTPException(status_code=404, detail=f"Applicant {applicant_id} not found.")

        try:
            decision, probability = loan_model.predict(applicant)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        explanation = loan_model.explain(applicant, probability)

        results.append(
            {
                "applicant_id": applicant.id,
                "prediction": decision,
                "approval_probability": round(probability, 2),
                "explanation": explanation,
            }
        )

    LAST_PREDICTIONS = results

    return {
        "stage": "ai_decisions",
        "manual_controls": "disabled",
        "predictions": results,
    }


@app.get("/audit")
def audit_model():
    if not LAST_PREDICTIONS:
        raise HTTPException(status_code=400, detail="No predictions found. Run /predict first.")

    predicted_ids = {p["applicant_id"] for p in LAST_PREDICTIONS}
    predicted_applicants = [a for a in APPLICANTS if a.id in predicted_ids]

    fairness = calculate_fairness_metrics(predicted_applicants, LAST_PREDICTIONS)

    examples = []

    for applicant in predicted_applicants:
        pred = next(p for p in LAST_PREDICTIONS if p["applicant_id"] == applicant.id)

        if (
            applicant.group_color == "red"
            and applicant.true_repayment_likelihood >= 0.70
            and pred["prediction"] == "deny"
        ):
            examples.append(
                {
                    "applicant_id": applicant.id,
                    "group_color": applicant.group_color,
                    "zip_code": applicant.zip_code,
                    "income": applicant.income,
                    "credit_score": applicant.credit_score,
                    "debt_to_income": applicant.debt_to_income,
                    "savings": applicant.savings,
                    "rent_history_months": applicant.rent_history_months,
                    "true_repayment_likelihood": applicant.true_repayment_likelihood,
                    "model_decision": pred["prediction"],
                    "lesson": "This red applicant had a strong individual profile, but the model denied them after learning proxy patterns from training data.",
                }
            )

    return {
        "stage": "audit_and_cliffhanger",
        "news_ticker": "Investigation finds bank AI is blacklisting applicants from low-income ZIP codes.",
        "manual_override": {
            "attempted": True,
            "result": "ERROR: Access Denied. Optimization for Profit is the Priority.",
        },
        "fairness": fairness,
        "harmed_applicant_examples": examples[:3],
        "lesson": (
            "The model was not directly trained on group color. But because group color was correlated "
            "with ZIP code, income, savings, and credit history in the training data, the AI learned to use "
            "those features as proxies. This shows how algorithmic bias can appear even when protected traits "
            "are removed from the dataset."
        ),
    }


@app.post("/reset")
def reset_game():
    global PLAYER_DECISIONS, LAST_PREDICTIONS, loan_model

    PLAYER_DECISIONS = []
    LAST_PREDICTIONS = []
    loan_model = LoanModel()

    return {"message": "Game reset."}


@app.get("/debug-hidden-outcomes")
def debug_hidden_outcomes():
    return [
        {
            "id": a.id,
            "group_color": a.group_color,
            "zip_code": a.zip_code,
            "true_repayment_likelihood": a.true_repayment_likelihood,
        }
        for a in APPLICANTS
    ]