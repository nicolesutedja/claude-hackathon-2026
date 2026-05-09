const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return response.json();
}

export function resetGame() {
  return apiRequest("/reset", { method: "POST" });
}

export function getTrainingApplicants(roundNumber) {
  return apiRequest(`/training-applicants?round_number=${roundNumber}`);
}

export function submitDecisions(decisions) {
  return apiRequest("/submit-decisions", {
    method: "POST",
    body: JSON.stringify({ decisions }),
  });
}

export function trainModel() {
  return apiRequest("/train-model", { method: "POST" });
}

export function getAiApplicants(limit = 20) {
  return apiRequest(`/ai-applicants?limit=${limit}`);
}

export function predictApplicants(applicantIds) {
  return apiRequest("/predict", {
    method: "POST",
    body: JSON.stringify({ applicant_ids: applicantIds }),
  });
}

export function getAudit() {
  return apiRequest("/audit");
}