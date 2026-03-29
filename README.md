# 🌿 Zen · Digital Twin Dashboard
**Burnout Prevention & Peak State Tracking**

![Zen Dashboard](https://img.shields.io/badge/Status-Live-success) ![Vite](https://img.shields.io/badge/Vite-B73BFE?style=flat&logo=vite&logoColor=FFD62E) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)

**🚀 Live Demo:** [https://zen-hackathon.vercel.app/](https://zen-hackathon.vercel.app/)

Zen is a proactive wellness and productivity dashboard designed to act as your "Digital Twin." By synthesizing biometric data (sleep, heart rate, physical activity) with daily work schedules, Zen predicts burnout risk before it happens and helps you replicate your peak performance states.

## ⚠️ The Problem
In modern work environments, burnout is often invisible until it reaches a breaking point. Professionals struggle to understand how their daily habits, meeting loads, and sleep quality actively impact their cognitive baseline. Traditional wellness apps isolate health data from work data, failing to provide actionable, holistic context.

## 💡 Our Solution (Innovation & UX)
Zen bridges the gap between biometric wearables and the calendar. It processes massive arrays of daily physical data and translates it into a single, intuitive "Wellness Score." 
* **Proactive Interventions:** Instead of generic advice, Zen flags high burnout risks based on actual resting heart rate and sleep efficiency data.
* **Warm AI Companion:** Integrated with the Llama 3 API via Groq, Zen features a deeply empathetic AI check-in system that adjusts its tone based on the user's daily biometric score—offering gentle support on low-energy days and celebrating wins on peak days.

## ⚙️ Technical Complexity & Features
* **Massive Data Parsing:** Utilizes `PapaParse` to seamlessly ingest and process hundreds of thousands of rows of local CSV biometric data (Heart rate, steps, sleep, calories) entirely client-side.
* **Predictive Modeling:** Calculates a 10-point wellness score using a weighted algorithm combining RMSSD (HRV), resting heart rate, sleep efficiency, and daily schedule stress.
* **Interactive Data Visualization:** Implements `Recharts` for dynamic, responsive Area and Line charts displaying weekly trends and 24-hour heart rate rhythms.
* **Low-Latency LLM Integration:** Uses the Groq API for instantaneous, context-aware AI conversations.

## 📈 Business Impact & Feasibility
Zen is highly feasible as a B2B SaaS integration for corporate wellness or a B2C application for high-performers. By preventing burnout, companies can drastically reduce employee churn, lower healthcare costs, and foster a sustainable culture of peak productivity.

---

## 🚀 Setup & Installation Instructions

To run Zen locally on your machine, follow these steps:

### 1. Clone the repository
```bash
git clone [https://github.com/sachingirime/zen.git](https://github.com/sachingirime/zen.git)
cd zen