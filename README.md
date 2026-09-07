# 🎬 Agentic Cinema - AI Film Production Assistant

**Every day, film crews lose countless hours to manual administrative bottlenecks.** "Script breakdowns" are traditionally done by hand on static spreadsheets, leading to continuity errors and budget miscalculations. 

**Agentic Cinema** is an autonomous multi-agent platform built with the Google Agent Development Kit (ADK) that bridges natural language screenplays with real-time inventory, financial analytics, and production logic. It gives filmmakers their time back to focus on what actually matters: storytelling.

## 👥 Who is this for?

* **Line Producers:** Automatically generate daily rental budgets without manual data entry.
* **Prop Masters:** Instantly cross-reference script requirements with live warehouse inventory.
* **Script Supervisors:** Catch continuity errors (e.g., missing items between scenes) before the cameras even roll.

## 🚀 Key Features

* **AI Scene Breakdown (Extractor Agent):** Utilizes the Gemini API via Google ADK to intelligently ingest raw screenplay text and extract every prop, wardrobe item, and set piece required.
* **Real-Time Inventory Sync (Inventory Agent):** Connects directly to ClickHouse Cloud to query live physical inventory, verifying stock levels, repair statuses, and rental pricing in milliseconds.
* **Automated Business Logic (Judge Agent):** Evaluates the extracted data against strict production rules, automatically flagging continuity warnings and enforcing daily budget caps.
* **Multi-Agent Architecture:** A seamless, serverless handoff between specialized AI agents orchestrated entirely in Python.

## 🧠 Platform Architecture

Agentic Cinema follows a serverless multi-agent pipeline where an Orchestrator manages the flow between specialized sub-agents and database skills.

```text
                            Raw Screenplay (Input)
                                      │
                                      ▼
              ┌───────────────────────────────────────────────┐
              │                                               │
              │             ORCHESTRATOR AGENT                │
              │           (Central Hub & Manager)             │
              │                                               │
              │   3. Uses Skill to query DB with extracted ◄──┼─── ClickHouse
              │      items to get prices and availability     │    (Inventory DB)
              └─────┬──────▲─────────────────────┬──────▲─────┘
                    │      │                     │      │
         1. Sends   │      │ 2. Returns          │      │ 5. Returns
         Script     │      │ Items               │      │ Budget/Logic
                    │      │ Report              │      │ Report
                    ▼      │                     ▼      │
              ┌────────────┴─┐    4. Sends     ┌────────────┴─┐
              │   Agent 01   │    DB Info &    │ Judge Agent  │
              │ (Extractor)  │    Prop List    │ (Evaluator)  │
              └──────────────┘                 └──────────────┘
                 (Analyzes text                  (Checks errors
                 & extracts props)               & budget limits)
                                      │
                    6. Generates Final Consolidated Report
                                      │
                                      ▼
                           Agentic Web Dashboard UI
                  (Final Inventory + Judge Recommendations)
```

## 🛠️ Tech Stack

* **AI / Multi-Agent Framework:** Google Agent Development Kit (ADK), Google Gemini API
* **Database:** ClickHouse Cloud (High-speed analytical querying)
* **Backend:** Python, FastAPI
* **Deployment & Environment:** Replit

## 🚦 How to Run the App (For Judges)

1. Click the **Live Demo link** provided in Devpost, or click the **"Run"** button at the top of this Repl to start the backend server.
2. Wait a few seconds for the FastAPI server to initialize.
3. The web interface will load automatically in your browser or Replit preview window.
4. Paste a screenplay snippet into the input field and click "Analyze".
5. Watch as the multi-agent system processes the text, queries the ClickHouse database, and generates the final dashboard with the Judge Agent's budget and continuity verdict!

---
*Built for the Agentic Cinema: The Blockbuster Hackathon*
