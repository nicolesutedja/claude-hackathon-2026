## LoanLine: Gamifying the Fight Against Algorithmic Bias

## Inspiration

Algorithmic bias is often discussed in abstract, academic terms, making it difficult for the general public to understand its real-world consequences. We wanted to show how bias can appear in economic systems, especially in high-stakes decisions like loan approvals, while still making the experience engaging and educational. Instead of just telling people that AI can be biased, we wanted users to feel the pressure that can lead to biased decisions and then see how those decisions can be amplified by automation.

## What it does

**LoanLine** is an interactive, gamified simulation where players step into the high-pressure role of a loan officer.

* **Initial rounds:** Players approve or deny loan applications based on applicant information like income, credit score, savings, debt-to-income ratio, employment history, and ZIP code, while a manager pressures them and the timer gets shorter each round.
* **Automation phase:** After three rounds of corporate pressure for “efficiency,” the company shifts to an automated approval system trained on the player’s previous decisions.
* **Final reveal:** The game concludes with a fairness audit showing approval gaps, qualified-but-denied applicants, and similar applicant comparisons. This shows how rushed human decisions and uneven training data can be scaled by automation and lead to unfair outcomes.

## How we built it

We built the frontend using **React** and **Tailwind CSS** to create the game interface, applicant cards, timed rounds, automation stage, and final audit dashboard. The frontend tracks the player’s approve/deny decisions, round progression, approval rate warnings, AI batch results, and fairness audit displays.

For the backend, we used **Python** with **FastAPI** to generate applicants, store user decisions, train the model, run automated predictions, and return audit results to the frontend. Applicant profiles are generated with controlled random distributions, so red and purple applicants have overlapping profiles but slightly different averages in features like income and credit score. After the manual rounds, the backend trains a simple **logistic regression model** on the player’s decisions, then uses that model to approve or deny a new batch of applicants. The backend also calculates fairness metrics like approval gaps, false denial gaps, qualified-but-denied examples, and similar applicant comparisons so the final audit can show how biased training data affects automated outcomes.

## Challenges we ran into

One of the biggest hurdles was balancing the game mechanics. We had to make the manager’s pressure and timer feel stressful enough to encourage rushed decisions without making the game unplayable. Another challenge was representing the approval gap clearly; we needed a way to show players that the AI was not randomly wrong, but was learning and repeating patterns from earlier decisions.

## Accomplishments that we're proud of

* **Game logic:** We successfully created the moment where players realize the unfair AI is connected to earlier human decisions.
* **Aesthetic immersion:** We built a UI that feels engaging and high-stakes, using the manager component and timer to create pressure.
* **Educational impact:** We turned complex AI ethics concepts like bias, transparency, and human oversight into a short gameplay loop.

## What we learned

We learned that **algorithmic bias is not always born from malice.** By building LoanLine, we saw how environmental factors like corporate pressure, time constraints, and uneven data can introduce bias before the model is even trained. We also learned how important visualization is for explaining AI ethics; the audit screen helps tell a story instead of just showing numbers.

## What's next for LoanLine

Given another week, we would expand LoanLine by adding more diverse risk factors to the training data to show how intersectional bias works. We would tune the data generator more carefully so red and purple applicants have strongly overlapping financial profiles, then test whether approval gaps and false denial gaps still appear over a larger sample of applicants. We also hope to implement a “Policy Sandbox” mode where users can try to fix the algorithm in real time and see how difficult it is to balance efficiency and fairness. Overall, we want LoanLine to be a tool used in classrooms and companies to spark honest conversations about AI ethics.

---

### Core Pillars of the Project

* **Bias:** Demonstrating how training data can reflect human decision patterns and unintentional favoritism.
* **Transparency:** Showing when decisions are made by the user versus the automated system, and explaining what data the model learned from.
* **Human Oversight:** Highlighting the harm that can occur when automated systems are used without fairness checks, monitoring, and meaningful review.

## How to run it

LoanLine has a React frontend and a FastAPI backend. Run both at the same time.
1. Install dependencies
```
git clone https://github.com/nicolesutedja/claude-hackathon-2026.git
cd claude-hackathon-2026
npm install
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
2. Start the backend
In one terminal:
```
uvicorn backend.main:app --reload
```

3. Start the frontend
In a second terminal:
```
npm run dev
```

4. Open the frontend link: http://localhost:5173


