## LoanLine: Gamifying the Fight Against Algorithmic Bias
## Inspiration

Algorithmic bias is often discussed in abstract, academic terms, making it difficult for the general public to grasp its real-world consequences despite it already happening. We wanted to showcase specifically how it was happening in the economic world but at the same time, make it engaging and educational for people. We wanted to create an experience that moves beyond just telling people that AI can be biased, we also wanted them to feel the pressure that leads to those biases and see their own decisions amplified by automation.

## What it does

**LoanLine** is an interactive, gamified simulation where players step into the high-pressure role of a loan officer.

* **Initial rounds:** Players must approve or deny loan applications based on characteristics like credit score, income, and background—all while a manager breathes down their neck and a timer ticks away.
* **AI integration:** After three rounds of simulating corporate pressure for "efficiency," the company announces a shift to full automation.
* **Final reveal:** The game concludes with a "Transparency Audit" showing the **Approval Gap**, which is a data visualization of how unintentional human bias was scaled by AI to unfairly deny qualified applicants.

## How we built it

We built the frontend using **React** and **Tailwind CSS**. The core logic was developed in **TypeScript** to manage the complex state of player decisions and the subsequent "AI Training" phase. The AI logic was designed to parse the user's initial data patterns and apply them as a rigid set of rules for the automation phase.

## Challenges we ran into

One of the biggest hurdles was balancing the game mechanics. We had to make the manager’s pressure and the timer feel stressful enough to cause "rushed decisions" without making the game unplayable. Mathematically representing the "Approval Gap" was also a challenge; we needed a way to clearly show players that the AI wasn't just wrong but was actually a representative, biased mirror of their own quick judgments.

## Accomplishments that we're proud of

* **Game logic:** Successfully creating the moment when players realize the "unfair" AI is actually just their own decision-making scaled up.
* **Aesthetic Immersion:** Building a UI that feels both engaging and high-stakes, effectively using a "Manager" component to drive user anxiety. 
* **Educational Impact:** Distilling complex ethics (Bias, Transparency, and Human Oversight) into a 5-minute gameplay loop.

## What we learned

We learned that **algorithmic bias isn't always born from malice.** By building LoanLine, we saw how environmental factors—like corporate pressure and time constraints—can bake bias into data before a single line of AI code is even written. We also deepened our understanding of how to use data visualization (like our Audit screen) to tell a story rather than just show numbers.

## What's next for LoanLine

Given another week, we want to expand LoanLine by adding more diverse risk factors to the training data to show how intersectional bias works. We would tune the data generator more carefully so red and purple applicants have strongly overlapping financial profiles, then test whether approval gaps and false denial gaps still appear over a larger sample of applicants. We also hope to implement a "Policy Sandbox" mode where users can try to fix the algorithm in real-time to see how difficult it is to maintain both efficiency and equity. Overall, we want LoanLine to be a tool used in classrooms and companies to spark honest conversations about AI ethics.

### Core Pillars of the Project:

* **Bias:** Demonstrating how training data reflects human insecurity and unintentional favoritism.
* **Transparency:** Clearly labeling when a decision is made by the user versus the AI.
* **Human Oversight:** Highlighting the irreversible damage that can occur when AI is implemented without constant monitoring and ethical checks.

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


