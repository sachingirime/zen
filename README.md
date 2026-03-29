# 🌿 Zen · Your Mental Digital Twin
**Proactive Burnout Prevention through Biometric Synthesis & AI Feedback**

![Zen Dashboard](https://img.shields.io/badge/Status-Live-success) ![Vite](https://img.shields.io/badge/Vite-B73BFE?style=flat&logo=vite&logoColor=FFD62E) ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) ![Groq](https://img.shields.io/badge/AI-Groq--Llama3-orange)

**🚀 Live Demo:** [https://zen-hackathon.vercel.app/](https://zen-hackathon.vercel.app/)

---

## 📌 Problem Statement: The Invisible Cliff
Burnout isn't just "being tired." It exists in complex forms—overload, under-challenged, and neglect. Most individuals mistake early warning signs for normal fatigue, continuing unhealthy routines until symptoms escalate into serious mental and physical crises. By the time someone seeks help, the intervention is **reactive**. We need a **proactive** solution.

## 💡 The Solution: A Mental Digital Twin
Zen is a digital twin–based mental fitness application. It creates a personalized virtual replica of your mental well-being by continuously monitoring:
*   **Physiological Signals:** Heart Rate Variability (HRV), Resting Heart Rate (RHR), and Sleep Patterns.
*   **Behavioral Indicators:** Daily activity, steps, and sedentary levels.
*   **Environmental Context:** Your actual work schedule, meeting density, and deep-work sessions.

By synthesizing Fitbit/wearable data with your lived experience, Zen identifies when a "mental crash" is imminent and provides early intervention before burnout becomes chronic.

---

## 🛠 Features & Implementation

### 1. Fatigue Detection Engine (The Core)
Our algorithm processes massive arrays of data (via `PapaParse`) to generate a live **Wellness Score**. 
*   **Biometric Input:** Real-time analysis of Sleep Efficiency, RHR, and RMSSD (HRV).
*   **Schedule Integration:** Unlike standard trackers, Zen integrates your **Calendar**. It "knows" when you are in a high-stress meeting vs. deep work, adjusting your recovery needs accordingly.

### 2. Warm AI Check-ins (Closing the Feedback Loop)
Zen doesn't just show charts; it talks to you. Using the **Groq Llama-3 API**, our AI agent acts as a nurturing companion:
*   **Celebration:** When metrics improve, Zen identifies the lifestyle shifts that caused the boost.
*   **Gentle Inquiry:** When indicators dip, it offers a safe space to pinpoint stressors (e.g., *"Why are you worried today?"*), ensuring the digital twin stays calibrated to your reality.

### 3. Predictive Forecasting (MPC)
Inspired by Model Predictive Control, the dashboard forecasts your next 24 hours based on the last 3 days of recovery patterns, allowing you to adjust your Sunday plans before Monday hits.

---

## 🔬 Why Metrics Matter
*   **The Sleep-Depression Link:** Up to 90% of patients with major depressive disorder experience sleep disturbances. Zen focuses on **Sleep Quality** and **Fatigue** as the primary leading indicators of mental health decline.
*   **Early Intervention:** We target the "biology of hope." Actions taken during the fatigue stage prevent the move toward depersonalization and despair.

---

## 🏗 Tech Stack
*   **Frontend:** React.js + Vite (optimized for speed and low-latency).
*   **Data Processing:** `PapaParse` for client-side CSV ingestion of Fitbit datasets.
*   **Visualizations:** `Recharts` for dynamic heart rate and wellness trend analysis.
*   **Intelligence:** Groq API (Llama 3.1 8B) for compassionate, real-time feedback.
*   **Deployment:** Vercel (Continuous Integration/Deployment).

---

## 🚀 Setup & Installation

1. **Clone & Install:**
   ```bash
   git clone [https://github.com/sachingirime/zen.git](https://github.com/sachingirime/zen.git)
   cd zen
   npm install